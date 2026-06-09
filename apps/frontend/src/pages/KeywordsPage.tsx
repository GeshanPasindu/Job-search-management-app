import { FormEvent, useEffect, useState } from "react";
import { Edit3, Plus, Save, Trash2 } from "lucide-react";
import { api } from "../api";
import { roleCategories } from "../constants";
import type { Keyword } from "../types";
import { EmptyState, ErrorState, Field, LoadingState, PageHeader, Panel } from "../components/ui";

const emptyForm = {
  keyword: "",
  category: "Integration",
  enabled: true,
  priority: 50,
  notes: ""
};

export function KeywordsPage() {
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      setKeywords(await api.keywords.list());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load keywords");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function edit(keyword: Keyword) {
    setEditingId(keyword.id);
    setForm({
      keyword: keyword.keyword,
      category: keyword.category,
      enabled: keyword.enabled,
      priority: keyword.priority,
      notes: keyword.notes ?? ""
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      if (editingId) {
        await api.keywords.update(editingId, form);
      } else {
        await api.keywords.create(form);
      }
      setEditingId(null);
      setForm(emptyForm);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save keyword");
    }
  }

  async function remove(id: string) {
    setError("");
    try {
      await api.keywords.delete(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete keyword");
    }
  }

  async function toggle(keyword: Keyword) {
    await api.keywords.update(keyword.id, { enabled: !keyword.enabled });
    await load();
  }

  if (loading) return <LoadingState label="Loading keywords" />;

  return (
    <>
      <PageHeader
        title="Keywords"
        description="Target roles used by search URL generation and manual job scoring."
      />
      <ErrorState error={error} />

      <Panel title={editingId ? "Edit Keyword" : "Add Keyword"}>
        <form className="form-grid" onSubmit={submit}>
          <Field label="Keyword">
            <input
              value={form.keyword}
              onChange={(event) => setForm({ ...form, keyword: event.target.value })}
              required
            />
          </Field>
          <Field label="Category">
            <select
              value={form.category}
              onChange={(event) => setForm({ ...form, category: event.target.value })}
            >
              {roleCategories.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
          </Field>
          <Field label="Priority">
            <input
              type="number"
              min="0"
              max="100"
              value={form.priority}
              onChange={(event) => setForm({ ...form, priority: Number(event.target.value) })}
            />
          </Field>
          <Field label="Enabled">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(event) => setForm({ ...form, enabled: event.target.checked })}
            />
          </Field>
          <Field label="Notes" wide>
            <input
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
            />
          </Field>
          <div className="form-actions">
            <button className="primary-button" type="submit">
              {editingId ? <Save size={16} /> : <Plus size={16} />}
              {editingId ? "Save" : "Add"}
            </button>
            {editingId ? (
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setEditingId(null);
                  setForm(emptyForm);
                }}
              >
                Cancel
              </button>
            ) : null}
          </div>
        </form>
      </Panel>

      <Panel title="Target Keywords">
        {keywords.length === 0 ? (
          <EmptyState title="No keywords yet" detail="Add your first target role keyword above." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Keyword</th>
                  <th>Category</th>
                  <th>Priority</th>
                  <th>Enabled</th>
                  <th>Notes</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {keywords.map((keyword) => (
                  <tr key={keyword.id}>
                    <td>
                      <strong>{keyword.keyword}</strong>
                    </td>
                    <td>{keyword.category}</td>
                    <td>{keyword.priority}</td>
                    <td>
                      <input
                        type="checkbox"
                        checked={keyword.enabled}
                        onChange={() => void toggle(keyword)}
                        title="Enable keyword"
                      />
                    </td>
                    <td>{keyword.notes}</td>
                    <td className="row-actions">
                      <button className="icon-button" onClick={() => edit(keyword)} title="Edit keyword">
                        <Edit3 size={16} />
                      </button>
                      <button className="icon-button danger" onClick={() => void remove(keyword.id)} title="Delete keyword">
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
