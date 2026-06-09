import { FormEvent, useEffect, useState } from "react";
import { Save } from "lucide-react";
import { api } from "../api";
import type { ProfileResponse } from "../types";
import { EmptyState, ErrorState, Field, LoadingState, PageHeader, Panel } from "../components/ui";

export function SettingsPage() {
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [form, setForm] = useState({
    summary: "",
    preferredRoles: "",
    preferredLocations: "",
    salaryExpectation: "",
    aiEnabled: false,
    skills: ""
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const loaded = await api.profile.get();
      setProfile(loaded);
      setForm({
        summary: loaded.profile.summary,
        preferredRoles: loaded.profile.preferredRoles.join(", "),
        preferredLocations: loaded.profile.preferredLocations.join(", "),
        salaryExpectation: loaded.profile.salaryExpectation ?? "",
        aiEnabled: loaded.profile.aiEnabled,
        skills: loaded.skills.map((skill) => skill.name).join(", ")
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load settings");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const updated = await api.profile.update({
        summary: form.summary,
        preferredRoles: form.preferredRoles,
        preferredLocations: form.preferredLocations,
        salaryExpectation: form.salaryExpectation,
        aiEnabled: form.aiEnabled,
        skills: form.skills
      });
      setProfile(updated);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save settings");
    }
  }

  if (loading) return <LoadingState label="Loading settings" />;

  return (
    <>
      <PageHeader
        title="Settings"
        description="Maintain the profile inputs used for scoring, templates, and generated packages."
      />
      <ErrorState error={error} />

      {profile ? (
        <Panel title="Profile">
          <form className="form-grid" onSubmit={save}>
            <Field label="Summary" wide>
              <textarea
                value={form.summary}
                onChange={(event) => setForm({ ...form, summary: event.target.value })}
                rows={5}
              />
            </Field>
            <Field label="Skills" wide>
              <textarea
                value={form.skills}
                onChange={(event) => setForm({ ...form, skills: event.target.value })}
                rows={5}
              />
            </Field>
            <Field label="Preferred roles" wide>
              <textarea
                value={form.preferredRoles}
                onChange={(event) => setForm({ ...form, preferredRoles: event.target.value })}
                rows={4}
              />
            </Field>
            <Field label="Preferred locations">
              <input
                value={form.preferredLocations}
                onChange={(event) => setForm({ ...form, preferredLocations: event.target.value })}
              />
            </Field>
            <Field label="Salary expectation">
              <input
                value={form.salaryExpectation}
                onChange={(event) => setForm({ ...form, salaryExpectation: event.target.value })}
              />
            </Field>
            <Field label="AI enabled">
              <input
                type="checkbox"
                checked={form.aiEnabled}
                onChange={(event) => setForm({ ...form, aiEnabled: event.target.checked })}
              />
            </Field>
            <div className="note-list">
              <span>
                AI key configured: {profile.profile.aiKeyConfigured ? "yes" : "no"}. The MVP uses deterministic templates unless an AI assistant is implemented.
              </span>
              <span>File storage: local uploads directory. S3 can be added behind the backend storage abstraction.</span>
            </div>
            <div className="form-actions">
              <button className="primary-button" type="submit">
                <Save size={16} />
                Save settings
              </button>
            </div>
          </form>
        </Panel>
      ) : (
        <EmptyState title="Profile unavailable" />
      )}
    </>
  );
}
