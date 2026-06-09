import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  action
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {action ? <div className="page-actions">{action}</div> : null}
    </div>
  );
}

export function Panel({ title, children, action }: { title?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="panel">
      {title || action ? (
        <div className="panel-header">
          {title ? <h2>{title}</h2> : <span />}
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function StatCard({ label, value, detail }: { label: string; value: ReactNode; detail?: string }) {
  return (
    <div className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? <small>{detail}</small> : null}
    </div>
  );
}

export function ScoreBadge({ score, label }: { score: number; label?: string }) {
  const tone = score >= 75 ? "excellent" : score >= 55 ? "good" : score >= 35 ? "maybe" : "skip";
  return (
    <span className={`score-badge ${tone}`} title={label}>
      {score}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const className = status.toLowerCase().replace(/\s+/g, "-");
  return <span className={`status-badge ${className}`}>{status}</span>;
}

export function LoadingState({ label = "Loading" }: { label?: string }) {
  return <div className="state">{label}</div>;
}

export function ErrorState({ error }: { error?: string }) {
  if (!error) return null;
  return <div className="error-state">{error}</div>;
}

export function EmptyState({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      {detail ? <span>{detail}</span> : null}
    </div>
  );
}

export function Field({
  label,
  children,
  wide
}: {
  label: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={wide ? "field wide" : "field"}>
      <span>{label}</span>
      {children}
    </label>
  );
}

export function formatDate(value?: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));
}
