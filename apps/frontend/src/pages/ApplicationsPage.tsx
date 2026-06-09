import { FormEvent, useEffect, useMemo, useState } from "react";
import { Save, Trash2 } from "lucide-react";
import { api } from "../api";
import { jobStatuses, roleCategories } from "../constants";
import type { Application, Job, SourceConfig } from "../types";
import {
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  PageHeader,
  Panel,
  StatusBadge,
  formatDate
} from "../components/ui";

const formDefaults = {
  jobId: "",
  status: "Applied",
  appliedDate: new Date().toISOString().slice(0, 10),
  followUpDate: "",
  roleCategory: "Integration",
  recruiterName: "",
  recruiterEmail: "",
  salaryRange: "",
  interviewDates: "",
  rejectionReason: "",
  notes: ""
};

export function ApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [sources, setSources] = useState<SourceConfig[]>([]);
  const [sourceFilter, setSourceFilter] = useState("");
  const [form, setForm] = useState(formDefaults);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [loadedApplications, loadedJobs, loadedSources] = await Promise.all([
        api.applications.list(),
        api.jobs.list(),
        api.sources.list()
      ]);
      setApplications(loadedApplications);
      setJobs(loadedJobs);
      setSources(loadedSources);
      if (!form.jobId && loadedJobs[0]) {
        setForm((current) => ({
          ...current,
          jobId: loadedJobs[0].id,
          roleCategory: loadedJobs[0].matchingCategory ?? current.roleCategory
        }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load applications");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filteredApplications = useMemo(
    () =>
      applications.filter((application) => {
        if (!sourceFilter) return true;
        if (sourceFilter === "manual") return !application.job?.sourceId;
        return application.job?.sourceId === sourceFilter;
      }),
    [applications, sourceFilter]
  );

  const platformCounts = useMemo(() => {
    const counts = new Map<string, { label: string; count: number }>();
    for (const application of applications) {
      const key = application.job?.sourceId ?? "manual";
      const label = application.job?.sourceName ?? application.job?.sourceId ?? "Manual";
      const current = counts.get(key);
      counts.set(key, { label, count: (current?.count ?? 0) + 1 });
    }

    return Array.from(counts.entries())
      .map(([sourceId, value]) => ({ sourceId, ...value }))
      .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
  }, [applications]);

  function edit(application: Application) {
    setEditingId(application.id);
    setForm({
      jobId: application.jobId,
      status: application.status,
      appliedDate: application.appliedDate?.slice(0, 10) ?? "",
      followUpDate: application.followUpDate?.slice(0, 10) ?? "",
      roleCategory: application.roleCategory ?? "Integration",
      recruiterName: application.recruiterName ?? "",
      recruiterEmail: application.recruiterEmail ?? "",
      salaryRange: application.salaryRange ?? "",
      interviewDates: application.interviewDates.join(", "),
      rejectionReason: application.rejectionReason ?? "",
      notes: application.notes ?? ""
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    const payload = {
      ...form,
      interviewDates: form.interviewDates
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
    };
    try {
      if (editingId) {
        await api.applications.update(editingId, payload);
      } else {
        await api.applications.create(payload);
      }
      setEditingId(null);
      setForm({ ...formDefaults, jobId: jobs[0]?.id ?? "" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save application");
    }
  }

  async function remove(id: string) {
    setError("");
    try {
      await api.applications.delete(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete application");
    }
  }

  async function updateStatus(application: Application, status: string) {
    setError("");
    try {
      await api.applications.update(application.id, { status });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update status");
    }
  }

  if (loading) return <LoadingState label="Loading applications" />;

  return (
    <>
      <PageHeader
        title="Applications"
        description="Track applications, follow-ups, contacts, salary notes, interviews, and outcomes."
      />
      <ErrorState error={error} />

      <Panel title={editingId ? "Edit Application" : "Add Application"}>
        <form className="form-grid" onSubmit={submit}>
          <Field label="Job" wide>
            <select
              value={form.jobId}
              onChange={(event) => {
                const job = jobs.find((item) => item.id === event.target.value);
                setForm({
                  ...form,
                  jobId: event.target.value,
                  roleCategory: job?.matchingCategory ?? form.roleCategory
                });
              }}
              required
            >
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.title} - {job.company}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Status">
            <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
              {jobStatuses.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </Field>
          <Field label="Role category">
            <select
              value={form.roleCategory}
              onChange={(event) => setForm({ ...form, roleCategory: event.target.value })}
            >
              {roleCategories.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
          </Field>
          <Field label="Applied date">
            <input
              type="date"
              value={form.appliedDate}
              onChange={(event) => setForm({ ...form, appliedDate: event.target.value })}
            />
          </Field>
          <Field label="Follow-up date">
            <input
              type="date"
              value={form.followUpDate}
              onChange={(event) => setForm({ ...form, followUpDate: event.target.value })}
            />
          </Field>
          <Field label="Recruiter">
            <input
              value={form.recruiterName}
              onChange={(event) => setForm({ ...form, recruiterName: event.target.value })}
            />
          </Field>
          <Field label="Recruiter email">
            <input
              value={form.recruiterEmail}
              onChange={(event) => setForm({ ...form, recruiterEmail: event.target.value })}
            />
          </Field>
          <Field label="Salary range">
            <input
              value={form.salaryRange}
              onChange={(event) => setForm({ ...form, salaryRange: event.target.value })}
            />
          </Field>
          <Field label="Interview dates">
            <input
              value={form.interviewDates}
              onChange={(event) => setForm({ ...form, interviewDates: event.target.value })}
              placeholder="2026-06-15, 2026-06-22"
            />
          </Field>
          <Field label="Rejection reason">
            <input
              value={form.rejectionReason}
              onChange={(event) => setForm({ ...form, rejectionReason: event.target.value })}
            />
          </Field>
          <Field label="Notes" wide>
            <textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} rows={4} />
          </Field>
          <div className="form-actions">
            <button className="primary-button" type="submit">
              <Save size={16} />
              {editingId ? "Save" : "Track"}
            </button>
            {editingId ? (
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setEditingId(null);
                  setForm(formDefaults);
                }}
              >
                Cancel
              </button>
            ) : null}
          </div>
        </form>
      </Panel>

      <Panel title="Applications by Platform">
        <div className="form-grid compact">
          <Field label="Platform">
            <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}>
              <option value="">All platforms</option>
              {sources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.name}
                </option>
              ))}
              <option value="manual">Manual</option>
            </select>
          </Field>
          <Field label="Showing">
            <input readOnly value={`${filteredApplications.length} application(s)`} />
          </Field>
        </div>
        {platformCounts.length > 0 ? (
          <div className="metric-list">
            {platformCounts.map((platform) => (
              <div key={platform.sourceId}>
                <span>{platform.label}</span>
                <strong>{platform.count}</strong>
              </div>
            ))}
          </div>
        ) : null}
      </Panel>

      <Panel title="Tracked Applications">
        {filteredApplications.length === 0 ? (
          <EmptyState title="No applications tracked" detail="Mark jobs as applied or add a record above." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Job</th>
                  <th>Platform</th>
                  <th>Status</th>
                  <th>Applied</th>
                  <th>Follow-up</th>
                  <th>Contact</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filteredApplications.map((application) => (
                  <tr key={application.id}>
                    <td>
                      <strong>{application.job?.title ?? "Unknown job"}</strong>
                      <span>{application.job?.company}</span>
                    </td>
                    <td>{application.job?.sourceName ?? application.job?.sourceId ?? "Manual"}</td>
                    <td>
                      <select
                        value={application.status}
                        onChange={(event) => void updateStatus(application, event.target.value)}
                      >
                        {jobStatuses.map((status) => (
                          <option key={status}>{status}</option>
                        ))}
                      </select>
                    </td>
                    <td>{formatDate(application.appliedDate)}</td>
                    <td>{formatDate(application.followUpDate)}</td>
                    <td>{application.recruiterName ?? application.recruiterEmail}</td>
                    <td className="row-actions">
                      <button className="text-button" onClick={() => edit(application)}>
                        Edit
                      </button>
                      <button className="icon-button danger" onClick={() => void remove(application.id)} title="Delete application">
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
    </>
  );
}
