import { FormEvent, useEffect, useMemo, useState } from "react";
import { Save, Trash2, Upload } from "lucide-react";
import { api } from "../api";
import { roleCategories } from "../constants";
import type { CoverLetterTemplate, CvTemplate, TemplateList } from "../types";
import { EmptyState, ErrorState, Field, LoadingState, PageHeader, Panel } from "../components/ui";

const cvDefaults = {
  roleCategory: "Integration",
  versionName: "",
  summaryText: "",
  skillsPriorityList: "",
  isDefault: true,
  notes: ""
};

const coverDefaults = {
  roleCategory: "Integration",
  versionName: "",
  content: "",
  isDefault: true,
  notes: ""
};

export function TemplatesPage() {
  const [templates, setTemplates] = useState<TemplateList>({ cvTemplates: [], coverLetterTemplates: [] });
  const [cvForm, setCvForm] = useState(cvDefaults);
  const [coverForm, setCoverForm] = useState(coverDefaults);
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [selectedCvId, setSelectedCvId] = useState("");
  const [selectedCoverId, setSelectedCoverId] = useState("");
  const [cvEdit, setCvEdit] = useState(cvDefaults);
  const [coverEdit, setCoverEdit] = useState(coverDefaults);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const selectedCv = useMemo(
    () => templates.cvTemplates.find((template) => template.id === selectedCvId),
    [templates.cvTemplates, selectedCvId]
  );
  const selectedCover = useMemo(
    () => templates.coverLetterTemplates.find((template) => template.id === selectedCoverId),
    [templates.coverLetterTemplates, selectedCoverId]
  );

  async function load() {
    setLoading(true);
    setError("");
    try {
      const loaded = await api.templates.list();
      setTemplates(loaded);
      const nextCv = loaded.cvTemplates.find((template) => template.id === selectedCvId) ?? loaded.cvTemplates[0];
      const nextCover =
        loaded.coverLetterTemplates.find((template) => template.id === selectedCoverId) ??
        loaded.coverLetterTemplates[0];
      if (nextCv) selectCv(nextCv);
      if (nextCover) selectCover(nextCover);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load templates");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function selectCv(template: CvTemplate) {
    setSelectedCvId(template.id);
    setCvEdit({
      roleCategory: template.roleCategory,
      versionName: template.versionName,
      summaryText: template.summaryText,
      skillsPriorityList: template.skillsPriorityList.join(", "),
      isDefault: template.isDefault,
      notes: template.notes ?? ""
    });
  }

  function selectCover(template: CoverLetterTemplate) {
    setSelectedCoverId(template.id);
    setCoverEdit({
      roleCategory: template.roleCategory,
      versionName: template.versionName,
      content: template.content,
      isDefault: template.isDefault,
      notes: template.notes ?? ""
    });
  }

  async function uploadCv(event: FormEvent) {
    event.preventDefault();
    await uploadTemplate("cv", cvForm, cvFile);
    setCvForm(cvDefaults);
    setCvFile(null);
  }

  async function uploadCover(event: FormEvent) {
    event.preventDefault();
    await uploadTemplate("coverLetter", coverForm, coverFile);
    setCoverForm(coverDefaults);
    setCoverFile(null);
  }

  async function uploadTemplate(type: string, values: Record<string, unknown>, file: File | null) {
    setError("");
    try {
      const formData = new FormData();
      formData.append("type", type);
      for (const [key, value] of Object.entries(values)) {
        formData.append(key, String(value));
      }
      if (file) formData.append("file", file);
      await api.templates.upload(formData);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to upload template");
    }
  }

  async function saveCv() {
    if (!selectedCv) return;
    setError("");
    try {
      await api.templates.update(selectedCv.id, cvEdit);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save CV template");
    }
  }

  async function saveCover() {
    if (!selectedCover) return;
    setError("");
    try {
      await api.templates.update(selectedCover.id, coverEdit);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save cover-letter template");
    }
  }

  async function remove(id: string) {
    setError("");
    try {
      await api.templates.delete(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete template");
    }
  }

  if (loading) return <LoadingState label="Loading templates" />;

  return (
    <>
      <PageHeader
        title="Templates"
        description="Store CVs and cover-letter templates by role category without overwriting originals."
      />
      <ErrorState error={error} />

      <div className="two-column">
        <Panel title="Upload CV">
          <form className="form-grid single" onSubmit={uploadCv}>
            <TemplateCommonFields values={cvForm} onChange={setCvForm} />
            <Field label="CV file">
              <input type="file" accept=".pdf,.doc,.docx,.txt,.md" onChange={(event) => setCvFile(event.target.files?.[0] ?? null)} />
            </Field>
            <Field label="Summary" wide>
              <textarea
                value={cvForm.summaryText}
                onChange={(event) => setCvForm({ ...cvForm, summaryText: event.target.value })}
                rows={5}
              />
            </Field>
            <Field label="Skills priority" wide>
              <input
                value={cvForm.skillsPriorityList}
                onChange={(event) => setCvForm({ ...cvForm, skillsPriorityList: event.target.value })}
                placeholder="Node.js, TypeScript, REST APIs"
              />
            </Field>
            <div className="form-actions">
              <button className="primary-button" type="submit">
                <Upload size={16} />
                Upload CV
              </button>
            </div>
          </form>
        </Panel>

        <Panel title="Upload Cover Letter">
          <form className="form-grid single" onSubmit={uploadCover}>
            <TemplateCommonFields values={coverForm} onChange={setCoverForm} />
            <Field label="Template file">
              <input type="file" accept=".txt,.md,.html,.doc,.docx,.pdf" onChange={(event) => setCoverFile(event.target.files?.[0] ?? null)} />
            </Field>
            <Field label="Editable content" wide>
              <textarea
                value={coverForm.content}
                onChange={(event) => setCoverForm({ ...coverForm, content: event.target.value })}
                rows={8}
                placeholder="Dear Hiring Team, ..."
              />
            </Field>
            <div className="form-actions">
              <button className="primary-button" type="submit">
                <Upload size={16} />
                Upload Template
              </button>
            </div>
          </form>
        </Panel>
      </div>

      <div className="two-column">
        <Panel title="CV Templates">
          <TemplateList
            items={templates.cvTemplates}
            selectedId={selectedCvId}
            onSelect={(item) => selectCv(item as CvTemplate)}
            onDelete={remove}
          />
        </Panel>

        <Panel title="Cover Letters">
          <TemplateList
            items={templates.coverLetterTemplates}
            selectedId={selectedCoverId}
            onSelect={(item) => selectCover(item as CoverLetterTemplate)}
            onDelete={remove}
          />
        </Panel>
      </div>

      <div className="two-column">
        <Panel
          title="Edit CV Template"
          action={
            <button className="primary-button" onClick={() => void saveCv()} disabled={!selectedCv}>
              <Save size={16} />
              Save
            </button>
          }
        >
          {selectedCv ? (
            <div className="form-grid single">
              <TemplateCommonFields values={cvEdit} onChange={setCvEdit} />
              <Field label="Summary" wide>
                <textarea
                  value={cvEdit.summaryText}
                  onChange={(event) => setCvEdit({ ...cvEdit, summaryText: event.target.value })}
                  rows={6}
                />
              </Field>
              <Field label="Skills priority" wide>
                <input
                  value={cvEdit.skillsPriorityList}
                  onChange={(event) => setCvEdit({ ...cvEdit, skillsPriorityList: event.target.value })}
                />
              </Field>
            </div>
          ) : (
            <EmptyState title="Select a CV template" />
          )}
        </Panel>

        <Panel
          title="Edit Cover Letter"
          action={
            <button className="primary-button" onClick={() => void saveCover()} disabled={!selectedCover}>
              <Save size={16} />
              Save
            </button>
          }
        >
          {selectedCover ? (
            <div className="form-grid single">
              <TemplateCommonFields values={coverEdit} onChange={setCoverEdit} />
              <Field label="Content" wide>
                <textarea
                  value={coverEdit.content}
                  onChange={(event) => setCoverEdit({ ...coverEdit, content: event.target.value })}
                  rows={12}
                />
              </Field>
            </div>
          ) : (
            <EmptyState title="Select a cover-letter template" />
          )}
        </Panel>
      </div>
    </>
  );
}

function TemplateCommonFields<T extends typeof cvDefaults | typeof coverDefaults>({
  values,
  onChange
}: {
  values: T;
  onChange: (values: T) => void;
}) {
  return (
    <>
      <Field label="Role category">
        <select
          value={values.roleCategory}
          onChange={(event) => onChange({ ...values, roleCategory: event.target.value } as T)}
        >
          {roleCategories.map((category) => (
            <option key={category}>{category}</option>
          ))}
        </select>
      </Field>
      <Field label="Version">
        <input
          value={values.versionName}
          onChange={(event) => onChange({ ...values, versionName: event.target.value } as T)}
          required
        />
      </Field>
      <Field label="Default">
        <input
          type="checkbox"
          checked={values.isDefault}
          onChange={(event) => onChange({ ...values, isDefault: event.target.checked } as T)}
        />
      </Field>
      <Field label="Notes">
        <input value={values.notes} onChange={(event) => onChange({ ...values, notes: event.target.value } as T)} />
      </Field>
    </>
  );
}

function TemplateList({
  items,
  selectedId,
  onSelect,
  onDelete
}: {
  items: Array<CvTemplate | CoverLetterTemplate>;
  selectedId: string;
  onSelect: (item: CvTemplate | CoverLetterTemplate) => void;
  onDelete: (id: string) => void;
}) {
  if (items.length === 0) {
    return <EmptyState title="No templates yet" />;
  }

  return (
    <div className="template-list">
      {items.map((item) => (
        <div
          className={selectedId === item.id ? "template-row active" : "template-row"}
          key={item.id}
          onClick={() => onSelect(item)}
        >
          <span>
            <strong>{item.versionName}</strong>
            <small>{item.roleCategory}{item.isDefault ? " - Default" : ""}</small>
          </span>
          <span className="row-actions" onClick={(event) => event.stopPropagation()}>
            <button className="icon-button danger" onClick={() => void onDelete(item.id)} title="Delete template">
              <Trash2 size={16} />
            </button>
          </span>
        </div>
      ))}
    </div>
  );
}
