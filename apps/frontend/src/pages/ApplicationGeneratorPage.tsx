import { FormEvent, useEffect, useMemo, useState } from "react";
import { Save, Sparkles } from "lucide-react";
import { api } from "../api";
import { roleCategories } from "../constants";
import type { ApplicationPackage, Job, TemplateList } from "../types";
import { EmptyState, ErrorState, Field, LoadingState, PageHeader, Panel } from "../components/ui";

export function ApplicationGeneratorPage({ selectedJobId }: { selectedJobId?: string | null }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [templates, setTemplates] = useState<TemplateList>({ cvTemplates: [], coverLetterTemplates: [] });
  const [jobId, setJobId] = useState(selectedJobId ?? "");
  const [roleCategory, setRoleCategory] = useState("Integration");
  const [cvTemplateId, setCvTemplateId] = useState("");
  const [coverLetterTemplateId, setCoverLetterTemplateId] = useState("");
  const [applicationPackage, setApplicationPackage] = useState<ApplicationPackage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (selectedJobId) {
      setJobId(selectedJobId);
    }
  }, [selectedJobId]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [loadedJobs, loadedTemplates] = await Promise.all([api.jobs.list(), api.templates.list()]);
      setJobs(loadedJobs);
      setTemplates(loadedTemplates);
      const initialJob = selectedJobId
        ? loadedJobs.find((job) => job.id === selectedJobId)
        : loadedJobs[0];
      if (initialJob) {
        setJobId(initialJob.id);
        setRoleCategory(initialJob.matchingCategory ?? "Integration");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load generator");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const categoryCvTemplates = useMemo(
    () => templates.cvTemplates.filter((template) => template.roleCategory === roleCategory),
    [templates.cvTemplates, roleCategory]
  );
  const categoryCoverTemplates = useMemo(
    () => templates.coverLetterTemplates.filter((template) => template.roleCategory === roleCategory),
    [templates.coverLetterTemplates, roleCategory]
  );

  useEffect(() => {
    setCvTemplateId(categoryCvTemplates.find((template) => template.isDefault)?.id ?? categoryCvTemplates[0]?.id ?? "");
    setCoverLetterTemplateId(
      categoryCoverTemplates.find((template) => template.isDefault)?.id ?? categoryCoverTemplates[0]?.id ?? ""
    );
  }, [categoryCvTemplates, categoryCoverTemplates]);

  async function generate(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      setApplicationPackage(
        await api.applicationPackages.generate({
          jobId,
          roleCategory,
          cvTemplateId: cvTemplateId || undefined,
          coverLetterTemplateId: coverLetterTemplateId || undefined
        })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to generate package");
    }
  }

  async function savePackage() {
    if (!applicationPackage) return;
    setError("");
    try {
      setApplicationPackage(
        await api.applicationPackages.update(applicationPackage.id, {
          cvSummarySuggestion: applicationPackage.cvSummarySuggestion,
          skillsOrderingSuggestion: applicationPackage.skillsOrderingSuggestion,
          coverLetterText: applicationPackage.coverLetterText,
          emailSubject: applicationPackage.emailSubject,
          emailBody: applicationPackage.emailBody,
          checklist: applicationPackage.checklist
        })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save package");
    }
  }

  if (loading) return <LoadingState label="Loading generator" />;

  return (
    <>
      <PageHeader
        title="Application Generator"
        description="Generate editable CV-summary suggestions, cover letters, and email drafts from your real profile/template data."
      />
      <ErrorState error={error} />

      <Panel title="Generate Package">
        <form className="form-grid" onSubmit={generate}>
          <Field label="Job" wide>
            <select value={jobId} onChange={(event) => setJobId(event.target.value)} required>
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.title} - {job.company}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Role category">
            <select value={roleCategory} onChange={(event) => setRoleCategory(event.target.value)}>
              {roleCategories.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
          </Field>
          <Field label="CV template">
            <select value={cvTemplateId} onChange={(event) => setCvTemplateId(event.target.value)}>
              <option value="">Auto/default</option>
              {categoryCvTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.versionName}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Cover letter">
            <select
              value={coverLetterTemplateId}
              onChange={(event) => setCoverLetterTemplateId(event.target.value)}
            >
              <option value="">Auto/default</option>
              {categoryCoverTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.versionName}
                </option>
              ))}
            </select>
          </Field>
          <div className="form-actions">
            <button className="primary-button" type="submit" disabled={!jobId}>
              <Sparkles size={16} />
              Generate
            </button>
          </div>
        </form>
      </Panel>

      {applicationPackage ? (
        <div className="two-column">
          <Panel
            title="CV and Skills"
            action={
              <button className="primary-button" onClick={() => void savePackage()}>
                <Save size={16} />
                Save
              </button>
            }
          >
            <div className="form-grid single">
              <Field label="CV summary suggestion" wide>
                <textarea
                  value={applicationPackage.cvSummarySuggestion}
                  onChange={(event) =>
                    setApplicationPackage({
                      ...applicationPackage,
                      cvSummarySuggestion: event.target.value
                    })
                  }
                  rows={7}
                />
              </Field>
              <Field label="Skills ordering" wide>
                <input
                  value={applicationPackage.skillsOrderingSuggestion.join(", ")}
                  onChange={(event) =>
                    setApplicationPackage({
                      ...applicationPackage,
                      skillsOrderingSuggestion: event.target.value
                        .split(",")
                        .map((skill) => skill.trim())
                        .filter(Boolean)
                    })
                  }
                />
              </Field>
              <Field label="Checklist" wide>
                <textarea
                  value={applicationPackage.checklist.join("\n")}
                  onChange={(event) =>
                    setApplicationPackage({
                      ...applicationPackage,
                      checklist: event.target.value
                        .split(/\r?\n/)
                        .map((item) => item.trim())
                        .filter(Boolean)
                    })
                  }
                  rows={5}
                />
              </Field>
            </div>
          </Panel>

          <Panel title="Cover Letter and Email">
            <div className="form-grid single">
              <Field label="Cover letter" wide>
                <textarea
                  value={applicationPackage.coverLetterText}
                  onChange={(event) =>
                    setApplicationPackage({
                      ...applicationPackage,
                      coverLetterText: event.target.value
                    })
                  }
                  rows={14}
                />
              </Field>
              <Field label="Email subject" wide>
                <input
                  value={applicationPackage.emailSubject}
                  onChange={(event) =>
                    setApplicationPackage({
                      ...applicationPackage,
                      emailSubject: event.target.value
                    })
                  }
                />
              </Field>
              <Field label="Email body" wide>
                <textarea
                  value={applicationPackage.emailBody}
                  onChange={(event) =>
                    setApplicationPackage({
                      ...applicationPackage,
                      emailBody: event.target.value
                    })
                  }
                  rows={8}
                />
              </Field>
            </div>
          </Panel>
        </div>
      ) : (
        <Panel>
          <EmptyState title="No package generated yet" detail="Select a job and templates, then generate." />
        </Panel>
      )}
    </>
  );
}
