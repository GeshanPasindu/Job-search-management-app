import { FormEvent, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  CheckCircle2,
  ExternalLink,
  ListFilter,
  Mail,
  PlusCircle,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  X,
  XCircle
} from "lucide-react";
import { api, buildQuery } from "../api";
import { jobStatuses, roleCategories, workplaceTypes } from "../constants";
import type { Job, SourceConfig } from "../types";
import {
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  PageHeader,
  Panel,
  ScoreBadge,
  StatusBadge,
  formatDate
} from "../components/ui";

const importDefaults = {
  title: "",
  company: "",
  sourceId: "linkedin",
  location: "",
  workplaceType: "remote",
  jobUrl: "",
  applyUrl: "",
  applyEmail: "",
  salaryText: "",
  rawText: "",
  notes: ""
};

const publicImportSourceIds = ["xpressjobs", "topjobs", "rooster", "itpro"];
const statusFilterOptions = ["", ...jobStatuses];

type PublicImportResult = Awaited<ReturnType<typeof api.jobs.importPublicAll>>;
type JobsModal = "public" | "gmail" | "manual" | "filters" | null;

function compactPayload(values: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== undefined && value !== null && value !== "")
  );
}

function describePublicImport(result: PublicImportResult, label: string) {
  const sourceDetails = result.sources
    ?.map(
      (source) =>
        `${source.sourceName}: ${source.importedCount} new, ${source.skippedCount} duplicate, ${source.filteredCount ?? 0} off-target`
    )
    .join("; ");
  const errorDetails = result.errors?.length
    ? ` Errors: ${result.errors.map((source) => `${source.sourceName} (${source.error})`).join("; ")}.`
    : "";

  return `${label} ${result.importedCount} new job(s). Skipped ${result.skippedCount} duplicate job(s). Filtered ${result.filteredCount ?? 0} off-target job(s).${
    sourceDetails ? ` ${sourceDetails}.` : ""
  }${errorDetails}`;
}

function JobsModalShell({
  title,
  children,
  onClose
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="icon-button" type="button" onClick={onClose} title="Close">
            <X size={16} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

export function JobsPage({ onGenerate }: { onGenerate: (jobId: string) => void }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [sources, setSources] = useState<SourceConfig[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [activeModal, setActiveModal] = useState<JobsModal>(null);
  const [filters, setFilters] = useState({
    search: "",
    status: "",
    category: "",
    sourceId: "",
    workplaceType: "",
    minScore: "",
    sort: "createdAt"
  });
  const [manual, setManual] = useState(importDefaults);
  const [publicImport, setPublicImport] = useState({
    sourceId: "all",
    keyword: "",
    location: "",
    includeDetails: true
  });
  const [importSummary, setImportSummary] = useState("");
  const [autoImporting, setAutoImporting] = useState(false);
  const [gmailStatus, setGmailStatus] = useState<{
    configured: boolean;
    connected: boolean;
    redirectUri: string;
  } | null>(null);
  const [emailImport, setEmailImport] = useState({
    query:
      'newer_than:30d ("job alert" OR "jobs for you" OR "new jobs" OR linkedin OR xpressjobs OR topjobs OR rooster OR itpro)',
    maxResults: 25,
    limit: 50
  });
  const [emailImportSummary, setEmailImportSummary] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const autoImportStarted = useRef(false);

  const selectedJob = useMemo(
    () => jobs.find((job) => job.id === selectedJobId) ?? jobs[0],
    [jobs, selectedJobId]
  );

  async function load(showLoading = true, nextFilters = filters) {
    if (showLoading) setLoading(true);
    setError("");
    try {
      const [loadedJobs, loadedSources, loadedGmailStatus] = await Promise.all([
        api.jobs.list(
          buildQuery({
            search: nextFilters.search,
            status: nextFilters.status,
            category: nextFilters.category,
            sourceId: nextFilters.sourceId,
            workplaceType: nextFilters.workplaceType,
            minScore: nextFilters.minScore,
            sort: nextFilters.sort
          })
        ),
        api.sources.list(),
        api.email.gmailStatus()
      ]);
      setJobs(loadedJobs);
      setSources(loadedSources);
      setGmailStatus(loadedGmailStatus);
      if (loadedJobs.length === 0) {
        setSelectedJobId(null);
      } else if (!selectedJobId || !loadedJobs.some((job) => job.id === selectedJobId)) {
        setSelectedJobId(loadedJobs[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load jobs");
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  useEffect(() => {
    async function initialize() {
      await load();
      await syncPublicJobs();
    }

    void initialize();
  }, []);

  async function syncPublicJobs(force = false) {
    if (!force && autoImportStarted.current) return;
    if (!force) autoImportStarted.current = true;

    setAutoImporting(true);
    setImportSummary("Checking public job sources...");
    try {
      const result = await api.jobs.importPublicAll({
        includeDetails: true,
        todayOnly: true
      });
      setImportSummary(describePublicImport(result, "Auto-synced public sources."));
      await load(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sync public jobs");
      setImportSummary("");
    } finally {
      setAutoImporting(false);
    }
  }

  async function submitManual(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const created = await api.jobs.importManual(
        compactPayload({
          ...manual,
          description: manual.rawText || manual.notes || manual.title
        })
      );
      setManual(importDefaults);
      setSelectedJobId(created.id);
      setActiveModal(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to import job");
    }
  }

  async function submitPublicImport(event: FormEvent) {
    event.preventDefault();
    setError("");
    setImportSummary("");
    try {
      if (publicImport.sourceId === "all") {
        const result = await api.jobs.importPublicAll({
          keyword: publicImport.keyword,
          location: publicImport.location,
          includeDetails: publicImport.includeDetails,
          todayOnly: true
        });
        setImportSummary(describePublicImport(result, "Synced public sources."));
      } else {
        const result = await api.jobs.importPublic({ ...publicImport, todayOnly: true });
        setImportSummary(describePublicImport(result, "Imported public jobs."));
      }
      setActiveModal(null);
      await load(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to import public jobs");
    }
  }

  async function connectGmail() {
    setError("");
    try {
      const result = await api.email.gmailAuthUrl();
      window.open(result.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start Gmail connection");
    }
  }

  async function submitEmailImport(event: FormEvent) {
    event.preventDefault();
    setError("");
    setEmailImportSummary("");
    try {
      const result = await api.email.importJobAlerts(emailImport);
      setEmailImportSummary(
        `Scanned ${result.messagesScanned} email(s), found ${result.candidateJobsFound} candidate job link(s), imported ${result.importedCount}, skipped ${result.skippedCount} duplicate(s), filtered ${result.filteredCount} off-target.`
      );
      setActiveModal(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to import Gmail job alerts");
    }
  }

  async function updateJobStatus(job: Job, status: string) {
    setError("");
    try {
      if (status === "Applied") {
        await api.applications.create({
          jobId: job.id,
          status: "Applied",
          appliedDate: new Date().toISOString().slice(0, 10),
          roleCategory: job.matchingCategory
        });
      } else {
        await api.jobs.update(job.id, { status });
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update status");
    }
  }

  async function rescore(job: Job) {
    setError("");
    try {
      await api.jobs.score(job.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to score job");
    }
  }

  async function rescoreAll() {
    setError("");
    try {
      await api.jobs.rescoreAll();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to rescore jobs");
    }
  }

  async function remove(job: Job) {
    setError("");
    try {
      await api.jobs.delete(job.id);
      setSelectedJobId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete job");
    }
  }

  async function submitFilters(event: FormEvent) {
    event.preventDefault();
    await load();
    setActiveModal(null);
  }

  async function applyStatusFilter(status: string) {
    const nextFilters = { ...filters, status };
    setFilters(nextFilters);
    await load(false, nextFilters);
  }

  if (loading) return <LoadingState label="Loading jobs" />;

  return (
    <>
      <PageHeader
        title="Jobs"
        description={`${jobs.length} collected job${jobs.length === 1 ? "" : "s"}`}
        action={
          <>
            <button className="secondary-button" onClick={() => void syncPublicJobs(true)} disabled={autoImporting}>
              <RefreshCw size={16} />
              Sync today
            </button>
            <button className="secondary-button" onClick={() => setActiveModal("public")}>
              <Search size={16} />
              Public import
            </button>
            <button className="secondary-button" onClick={() => setActiveModal("manual")}>
              <PlusCircle size={16} />
              Add job
            </button>
            <button className="secondary-button" onClick={() => setActiveModal("gmail")}>
              <Mail size={16} />
              Gmail
            </button>
            <button className="secondary-button" onClick={() => setActiveModal("filters")}>
              <ListFilter size={16} />
              Filters
            </button>
            <button className="secondary-button" onClick={() => void rescoreAll()}>
              <RefreshCw size={16} />
              Rescore all
            </button>
          </>
        }
      />
      <ErrorState error={error} />

      <div className="jobs-status-banner">
        <RefreshCw size={16} className={autoImporting ? "spin" : undefined} />
        <div>
          <strong>{autoImporting ? "Public sync running" : "Public sync idle"}</strong>
          <span>{autoImporting ? "Checking public job sources..." : importSummary || emailImportSummary || "No import currently running."}</span>
        </div>
        <span className={gmailStatus?.connected ? "status-badge applied" : "status-badge on-hold"}>
          Gmail {gmailStatus?.connected ? "connected" : gmailStatus?.configured ? "ready" : "not configured"}
        </span>
      </div>

      <div className="two-column wide-left">
        <Panel title="Collected Jobs">
          <div className="status-filter-row" aria-label="Filter jobs by status">
            {statusFilterOptions.map((status) => {
              const active = filters.status === status;
              return (
                <button
                  key={status || "all"}
                  type="button"
                  className={active ? "status-filter-button active" : "status-filter-button"}
                  aria-pressed={active}
                  onClick={() => void applyStatusFilter(status)}
                >
                  {status || "All"}
                </button>
              );
            })}
          </div>
          {jobs.length === 0 ? (
            <EmptyState
              title={filters.status ? `No ${filters.status} jobs` : "No jobs yet"}
              detail={filters.status ? "Choose another status or clear the filter." : "Import a posting or generate search URLs first."}
            />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Job</th>
                    <th>Platform</th>
                    <th>Posted</th>
                    <th>End date</th>
                    <th>Score</th>
                    <th>Category</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => (
                    <tr
                      key={job.id}
                      className={selectedJob?.id === job.id ? "selected-row" : undefined}
                      onClick={() => setSelectedJobId(job.id)}
                    >
                      <td>
                        <strong>{job.title}</strong>
                        <span>{job.company} {job.location ? `- ${job.location}` : ""}</span>
                      </td>
                      <td>{job.sourceName ?? job.sourceId ?? "Manual"}</td>
                      <td>{formatDate(job.postedDate) || "-"}</td>
                      <td>{formatDate(job.deadline) || "-"}</td>
                      <td>
                        <ScoreBadge score={job.score} label={job.scoreLabel} />
                      </td>
                      <td>{job.matchingCategory}</td>
                      <td>
                        <StatusBadge status={job.status} />
                      </td>
                      <td className="row-actions" onClick={(event) => event.stopPropagation()}>
                        <button className="icon-button" onClick={() => void rescore(job)} title="Rescore job">
                          <RefreshCw size={16} />
                        </button>
                        <button className="icon-button" onClick={() => onGenerate(job.id)} title="Generate package">
                          <Sparkles size={16} />
                        </button>
                        <button className="icon-button danger" onClick={() => void remove(job)} title="Delete job">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel title="Job Detail">
          {selectedJob ? (
            <div className="detail-stack">
              <div>
                <h3>{selectedJob.title}</h3>
                <p>{selectedJob.company}</p>
              </div>
              <div className="detail-row">
                <ScoreBadge score={selectedJob.score} label={selectedJob.scoreLabel} />
                <StatusBadge status={selectedJob.status} />
                <span className="pill">{selectedJob.matchingCategory}</span>
              </div>
              <p className="muted">{selectedJob.scoreExplanation}</p>
              <div className="tag-list">
                {selectedJob.matchedSkills.map((skill) => (
                  <span key={skill}>{skill}</span>
                ))}
              </div>
              {selectedJob.missingSkills.length > 0 ? (
                <div>
                  <strong>Review gaps</strong>
                  <div className="tag-list warning">
                    {selectedJob.missingSkills.map((skill) => (
                      <span key={skill}>{skill}</span>
                    ))}
                  </div>
                </div>
              ) : null}
              <dl className="details-list">
                <div>
                  <dt>Source</dt>
                  <dd>{selectedJob.sourceName ?? selectedJob.sourceId ?? "Manual"}</dd>
                </div>
                <div>
                  <dt>Posted</dt>
                  <dd>{formatDate(selectedJob.postedDate)}</dd>
                </div>
                <div>
                  <dt>Deadline</dt>
                  <dd>{formatDate(selectedJob.deadline)}</dd>
                </div>
                <div>
                  <dt>Salary</dt>
                  <dd>{selectedJob.salaryText ?? "Not listed"}</dd>
                </div>
              </dl>
              <div className="button-row">
                {(selectedJob.applyUrl || selectedJob.jobUrl) ? (
                  <a className="secondary-button" href={selectedJob.applyUrl ?? selectedJob.jobUrl ?? "#"} target="_blank" rel="noreferrer">
                    <ExternalLink size={16} />
                    Open apply link
                  </a>
                ) : null}
                <button className="secondary-button" onClick={() => void updateJobStatus(selectedJob, "New")}>
                  <PlusCircle size={16} />
                  New
                </button>
                <button className="secondary-button" onClick={() => void updateJobStatus(selectedJob, "Applied")}>
                  <CheckCircle2 size={16} />
                  Applied
                </button>
                <button className="secondary-button" onClick={() => void updateJobStatus(selectedJob, "On-Progress")}>
                  <RefreshCw size={16} />
                  On-Progress
                </button>
                <button className="secondary-button" onClick={() => void updateJobStatus(selectedJob, "Interviewed")}>
                  <CheckCircle2 size={16} />
                  Interviewed
                </button>
                <button className="secondary-button" onClick={() => void updateJobStatus(selectedJob, "Rejected")}>
                  <XCircle size={16} />
                  Rejected
                </button>
              </div>
              <pre className="description-box">{selectedJob.description}</pre>
            </div>
          ) : (
            <EmptyState title="Select a job" />
          )}
        </Panel>
      </div>

      {activeModal === "public" ? (
        <JobsModalShell title="Public Job Import" onClose={() => setActiveModal(null)}>
          <form className="form-grid" onSubmit={submitPublicImport}>
            <Field label="Source">
              <select
                value={publicImport.sourceId}
                onChange={(event) => setPublicImport({ ...publicImport, sourceId: event.target.value })}
              >
                <option value="all">All public sources</option>
                {sources
                  .filter((source) => publicImportSourceIds.includes(source.id))
                  .map((source) => (
                    <option key={source.id} value={source.id}>
                      {source.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Keyword">
              <input
                value={publicImport.keyword}
                onChange={(event) => setPublicImport({ ...publicImport, keyword: event.target.value })}
                placeholder="Software Engineer"
              />
            </Field>
            <Field label="Location">
              <input
                value={publicImport.location}
                onChange={(event) => setPublicImport({ ...publicImport, location: event.target.value })}
                placeholder="Colombo"
              />
            </Field>
            <Field label="Details">
              <input
                type="checkbox"
                checked={publicImport.includeDetails}
                onChange={(event) =>
                  setPublicImport({ ...publicImport, includeDetails: event.target.checked })
                }
              />
            </Field>
            <div className="form-actions">
              <button className="primary-button" type="submit" disabled={autoImporting}>
                {autoImporting ? <RefreshCw size={16} /> : <Search size={16} />}
                {autoImporting ? "Syncing" : "Sync jobs"}
              </button>
            </div>
          </form>
        </JobsModalShell>
      ) : null}

      {activeModal === "manual" ? (
        <JobsModalShell title="Add Manual Job" onClose={() => setActiveModal(null)}>
          <form className="form-grid" onSubmit={submitManual}>
            <Field label="Title">
              <input value={manual.title} onChange={(event) => setManual({ ...manual, title: event.target.value })} />
            </Field>
            <Field label="Company">
              <input
                value={manual.company}
                onChange={(event) => setManual({ ...manual, company: event.target.value })}
              />
            </Field>
            <Field label="Source">
              <select
                value={manual.sourceId}
                onChange={(event) => setManual({ ...manual, sourceId: event.target.value })}
              >
                {sources.map((source) => (
                  <option key={source.id} value={source.id}>
                    {source.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Location">
              <input
                value={manual.location}
                onChange={(event) => setManual({ ...manual, location: event.target.value })}
              />
            </Field>
            <Field label="Workplace">
              <select
                value={manual.workplaceType}
                onChange={(event) => setManual({ ...manual, workplaceType: event.target.value })}
              >
                {workplaceTypes.filter((type) => type !== "any").map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Job URL">
              <input value={manual.jobUrl} onChange={(event) => setManual({ ...manual, jobUrl: event.target.value })} />
            </Field>
            <Field label="Apply URL">
              <input
                value={manual.applyUrl}
                onChange={(event) => setManual({ ...manual, applyUrl: event.target.value })}
              />
            </Field>
            <Field label="Apply email">
              <input
                value={manual.applyEmail}
                onChange={(event) => setManual({ ...manual, applyEmail: event.target.value })}
              />
            </Field>
            <Field label="Salary">
              <input
                value={manual.salaryText}
                onChange={(event) => setManual({ ...manual, salaryText: event.target.value })}
              />
            </Field>
            <Field label="Notes">
              <input value={manual.notes} onChange={(event) => setManual({ ...manual, notes: event.target.value })} />
            </Field>
            <Field label="Pasted description" wide>
              <textarea
                value={manual.rawText}
                onChange={(event) => setManual({ ...manual, rawText: event.target.value })}
                rows={8}
                required={!manual.title}
              />
            </Field>
            <div className="form-actions">
              <button className="primary-button" type="submit">
                <Search size={16} />
                Import and score
              </button>
            </div>
          </form>
        </JobsModalShell>
      ) : null}

      {activeModal === "gmail" ? (
        <JobsModalShell title="Gmail Job Alerts" onClose={() => setActiveModal(null)}>
          <div className="modal-toolbar">
            <button className="secondary-button" type="button" onClick={() => void connectGmail()}>
              <ExternalLink size={16} />
              Connect Gmail
            </button>
          </div>
          <form className="form-grid" onSubmit={submitEmailImport}>
            <Field label="Gmail status">
              <input
                readOnly
                value={
                  gmailStatus?.connected
                    ? "Connected"
                    : gmailStatus?.configured
                      ? "Configured, not connected"
                      : "Missing OAuth env"
                }
              />
            </Field>
            <Field label="Max emails">
              <input
                type="number"
                min="1"
                max="100"
                value={emailImport.maxResults}
                onChange={(event) =>
                  setEmailImport({ ...emailImport, maxResults: Number(event.target.value) })
                }
              />
            </Field>
            <Field label="Import limit">
              <input
                type="number"
                min="1"
                max="100"
                value={emailImport.limit}
                onChange={(event) => setEmailImport({ ...emailImport, limit: Number(event.target.value) })}
              />
            </Field>
            <Field label="Redirect URI">
              <input readOnly value={gmailStatus?.redirectUri ?? ""} />
            </Field>
            <Field label="Gmail search query" wide>
              <input
                value={emailImport.query}
                onChange={(event) => setEmailImport({ ...emailImport, query: event.target.value })}
              />
            </Field>
            <div className="form-actions">
              <button className="primary-button" type="submit" disabled={!gmailStatus?.connected}>
                <Mail size={16} />
                Import Gmail alerts
              </button>
            </div>
          </form>
        </JobsModalShell>
      ) : null}

      {activeModal === "filters" ? (
        <JobsModalShell title="Job Filters" onClose={() => setActiveModal(null)}>
          <form className="form-grid compact" onSubmit={submitFilters}>
            <Field label="Search">
              <input value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} />
            </Field>
            <Field label="Status">
              <select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
                <option value="">All</option>
                {jobStatuses.map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
            </Field>
            <Field label="Category">
              <select
                value={filters.category}
                onChange={(event) => setFilters({ ...filters, category: event.target.value })}
              >
                <option value="">All</option>
                {roleCategories.map((category) => (
                  <option key={category}>{category}</option>
                ))}
              </select>
            </Field>
            <Field label="Source">
              <select
                value={filters.sourceId}
                onChange={(event) => setFilters({ ...filters, sourceId: event.target.value })}
              >
                <option value="">All</option>
                {sources.map((source) => (
                  <option key={source.id} value={source.id}>
                    {source.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Min score">
              <input
                type="number"
                value={filters.minScore}
                onChange={(event) => setFilters({ ...filters, minScore: event.target.value })}
              />
            </Field>
            <div className="form-actions">
              <button className="primary-button" type="submit">
                <ListFilter size={16} />
                Apply
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={() =>
                  setFilters({
                    search: "",
                    status: "",
                    category: "",
                    sourceId: "",
                    workplaceType: "",
                    minScore: "",
                    sort: "createdAt"
                  })
                }
              >
                Clear
              </button>
            </div>
          </form>
        </JobsModalShell>
      ) : null}
    </>
  );
}
