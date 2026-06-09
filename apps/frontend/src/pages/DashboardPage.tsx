import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { api } from "../api";
import type { DashboardStats } from "../types";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Panel,
  ScoreBadge,
  StatCard,
  StatusBadge,
  formatDate
} from "../components/ui";

export function DashboardPage({ onGenerate }: { onGenerate: (jobId: string) => void }) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError("");
    try {
      setStats(await api.dashboard());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load dashboard");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  if (loading && !stats) return <LoadingState label="Loading dashboard" />;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="A working view of your job pipeline, match quality, and application activity."
        action={
          <button className="icon-button" onClick={load} title="Refresh dashboard">
            <RefreshCw size={18} />
          </button>
        }
      />
      <ErrorState error={error} />

      {stats ? (
        <>
          <div className="stats-grid">
            <StatCard label="Jobs collected" value={stats.totalJobs} detail="Manual imports and saved postings" />
            <StatCard label="Shortlisted" value={stats.shortlisted} detail="Ready for package work" />
            <StatCard label="Applied" value={stats.applied} detail={`${stats.interviews} interview stage`} />
            <StatCard label="Average score" value={stats.averageMatchScore} detail="Across collected jobs" />
          </div>

          <div className="two-column">
            <Panel title="High-Match Jobs">
              {stats.highMatchJobs.length === 0 ? (
                <EmptyState title="No high-match jobs yet" detail="Import jobs and run scoring to populate this list." />
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Job</th>
                        <th>Score</th>
                        <th>Status</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {stats.highMatchJobs.map((job) => (
                        <tr key={job.id}>
                          <td>
                            <strong>{job.title}</strong>
                            <span>{job.company}</span>
                          </td>
                          <td>
                            <ScoreBadge score={job.score} label={job.scoreLabel} />
                          </td>
                          <td>
                            <StatusBadge status={job.status} />
                          </td>
                          <td>
                            <button className="text-button" onClick={() => onGenerate(job.id)}>
                              Generate
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>

            <Panel title="Recent Jobs">
              {stats.recentJobs.length === 0 ? (
                <EmptyState title="No jobs imported" detail="Start with Search Builder or Manual Import." />
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Job</th>
                        <th>Source</th>
                        <th>Added</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.recentJobs.map((job) => (
                        <tr key={job.id}>
                          <td>
                            <strong>{job.title}</strong>
                            <span>{job.company}</span>
                          </td>
                          <td>{job.sourceName ?? job.sourceId ?? "Manual"}</td>
                          <td>{formatDate(job.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          </div>

          <div className="two-column">
            <Panel title="Applications By Status">
              <MetricList values={stats.applicationsByStatus} />
            </Panel>
            <Panel title="Applications By Source">
              <MetricList values={stats.applicationsBySource} />
            </Panel>
          </div>
        </>
      ) : null}
    </>
  );
}

function MetricList({ values }: { values: Record<string, number> }) {
  const entries = Object.entries(values);
  if (entries.length === 0) {
    return <EmptyState title="No activity yet" />;
  }

  return (
    <div className="metric-list">
      {entries.map(([label, count]) => (
        <div key={label}>
          <span>{label}</span>
          <strong>{count}</strong>
        </div>
      ))}
    </div>
  );
}
