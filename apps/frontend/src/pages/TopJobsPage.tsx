import { useEffect, useState } from "react";
import { ExternalLink, RefreshCw, Search } from "lucide-react";
import { api } from "../api";
import type { Job } from "../types";
import { EmptyState, ErrorState, Field, LoadingState, PageHeader, Panel } from "../components/ui";

export function TopJobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const result = await api.jobs.list({
          search: "topjobs",
          sourceId: "topjobs"
        });
        setJobs(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load top jobs");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  async function refresh() {
    try {
      const result = await api.jobs.list({
        search: "topjobs",
        sourceId: "topjobs"
      });
      setJobs(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to refresh top jobs");
    }
  }

  if (loading) return <LoadingState label="Loading top jobs" />;

  return (
    <>
      <PageHeader
        title="TopJobs.lk Listings"
        description={`${jobs.length} job${jobs.length === 1 ? "" : "s"} from TopJobs`}
        action={
          <>
            <button className="secondary-button" onClick={() => void refresh()}>
              <RefreshCw size={16} />
              Refresh
            </button>
            {searchQuery && (
              <button className="secondary-button" onClick={() => setSearchQuery("")}>
                Clear search
              </button>
            )}
          </>
        }
      />

      <ErrorState error={error} />

      <div className="two-column wide-left">
        <Panel title="TopJobs Listings">
          {jobs.length === 0 ? (
            <EmptyState title="No top jobs yet" detail="The page will populate with TopJobs listings." />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Job</th>
                    <th>Company</th>
                    <th>Location</th>
                    <th>Salary</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => (
                    <tr key={job.id}>
                      <td>
                        <strong>{job.title}</strong>
                        <span className="muted">{job.description?.substring(0, 80)}...</span>
                      </td>
                      <td>{job.company}</td>
                      <td>{job.location ?? "Not listed"}</td>
                      <td>{job.salaryText ?? "Not listed"}</td>
                      <td className="row-actions">
                        {(job.applyUrl || job.jobUrl) ? (
                          <a className="icon-button" href={job.applyUrl ?? job.jobUrl} target="_blank" rel="noreferrer">
                            <ExternalLink size={16} />
                          </a>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        {searchQuery && (
          <Panel title="Search">
            <Field label="Search in listings" wide>
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Job title, company..."
              />
            </Field>
          </Panel>
        )}
      </div>
    </>
  );
}
