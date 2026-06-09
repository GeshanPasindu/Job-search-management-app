import { FormEvent, useEffect, useMemo, useState } from "react";
import { ExternalLink, Save, TestTube2 } from "lucide-react";
import { api } from "../api";
import { datePostedOptions, workplaceTypes } from "../constants";
import type { SourceConfig } from "../types";
import { EmptyState, ErrorState, Field, LoadingState, PageHeader, Panel } from "../components/ui";

export function SourcesPage() {
  const [sources, setSources] = useState<SourceConfig[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [jsonText, setJsonText] = useState("");
  const [testKeyword, setTestKeyword] = useState("Integration Engineer");
  const [testLocation, setTestLocation] = useState("Sri Lanka");
  const [testWorkplace, setTestWorkplace] = useState("remote");
  const [testDatePosted, setTestDatePosted] = useState("pastWeek");
  const [urls, setUrls] = useState<string[]>([]);
  const [notes, setNotes] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const loaded = await api.sources.list();
      setSources(loaded);
      const selected = loaded.find((source) => source.id === selectedId) ?? loaded[0];
      if (selected) {
        setSelectedId(selected.id);
        setJsonText(JSON.stringify(selected, null, 2));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load sources");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const selectedSource = useMemo(
    () => sources.find((source) => source.id === selectedId),
    [sources, selectedId]
  );

  function selectSource(source: SourceConfig) {
    setSelectedId(source.id);
    setJsonText(JSON.stringify(source, null, 2));
    setUrls([]);
    setNotes([]);
  }

  async function saveConfig() {
    setError("");
    try {
      const parsed = JSON.parse(jsonText) as SourceConfig;
      await api.sources.update(parsed.id || selectedId, parsed);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid source JSON");
    }
  }

  async function testUrl(event: FormEvent) {
    event.preventDefault();
    if (!selectedId) return;
    setError("");
    try {
      const result = await api.sources.testUrl({
        sourceId: selectedId,
        filters: {
          keywords: [testKeyword],
          location: testLocation,
          workplaceType: testWorkplace,
          datePosted: testDatePosted,
          sortBy: "recent"
        }
      });
      setUrls(result.urls);
      setNotes([result.safetyNote, ...result.notes]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to test source URL");
    }
  }

  if (loading) return <LoadingState label="Loading sources" />;

  return (
    <>
      <PageHeader
        title="Sources"
        description="Manage JSON-backed job sources and test safe manual-open search URL generation."
      />
      <ErrorState error={error} />

      <div className="two-column wide-left">
        <Panel title="Configured Sources">
          {sources.length === 0 ? (
            <EmptyState title="No sources configured" />
          ) : (
            <div className="source-list">
              {sources.map((source) => (
                <button
                  key={source.id}
                  className={source.id === selectedId ? "source-row active" : "source-row"}
                  onClick={() => selectSource(source)}
                >
                  <span>
                    <strong>{source.name}</strong>
                    <small>{source.type}</small>
                  </span>
                  <span className={source.enabled ? "pill active" : "pill"}>{source.enabled ? "On" : "Off"}</span>
                </button>
              ))}
            </div>
          )}
        </Panel>

        <Panel
          title="Source JSON"
          action={
            <button className="primary-button" onClick={() => void saveConfig()}>
              <Save size={16} />
              Save
            </button>
          }
        >
          <textarea
            className="code-editor"
            value={jsonText}
            onChange={(event) => setJsonText(event.target.value)}
            spellCheck={false}
          />
        </Panel>
      </div>

      <Panel title="Test URL Generation">
        <form className="form-grid" onSubmit={testUrl}>
          <Field label="Source">
            <select value={selectedId} onChange={(event) => selectSource(sources.find((source) => source.id === event.target.value) as SourceConfig)}>
              {sources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Keyword">
            <input value={testKeyword} onChange={(event) => setTestKeyword(event.target.value)} />
          </Field>
          <Field label="Location">
            <input value={testLocation} onChange={(event) => setTestLocation(event.target.value)} />
          </Field>
          <Field label="Workplace">
            <select value={testWorkplace} onChange={(event) => setTestWorkplace(event.target.value)}>
              {workplaceTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Date posted">
            <select value={testDatePosted} onChange={(event) => setTestDatePosted(event.target.value)}>
              {datePostedOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </Field>
          <div className="form-actions">
            <button className="primary-button" type="submit" disabled={!selectedSource}>
              <TestTube2 size={16} />
              Test
            </button>
          </div>
        </form>
        {notes.length > 0 ? (
          <div className="note-list">
            {notes.map((note) => (
              <span key={note}>{note}</span>
            ))}
          </div>
        ) : null}
        {urls.length > 0 ? (
          <div className="url-list">
            {urls.map((url) => (
              <a href={url} target="_blank" rel="noreferrer" key={url}>
                <ExternalLink size={16} />
                {url}
              </a>
            ))}
          </div>
        ) : null}
      </Panel>
    </>
  );
}
