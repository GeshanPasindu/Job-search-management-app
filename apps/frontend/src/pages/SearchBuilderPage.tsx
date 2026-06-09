import { FormEvent, useEffect, useState } from "react";
import { ExternalLink, Search } from "lucide-react";
import { api } from "../api";
import {
  datePostedOptions,
  experienceLevels,
  preferredLocations,
  workplaceTypes
} from "../constants";
import type { Keyword, SourceConfig } from "../types";
import { EmptyState, ErrorState, Field, LoadingState, PageHeader, Panel } from "../components/ui";

export function SearchBuilderPage() {
  const [sources, setSources] = useState<SourceConfig[]>([]);
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [sourceId, setSourceId] = useState("linkedin");
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);
  const [location, setLocation] = useState("Sri Lanka");
  const [workplaceType, setWorkplaceType] = useState("remote");
  const [datePosted, setDatePosted] = useState("pastWeek");
  const [experienceLevel, setExperienceLevel] = useState("entryLevel");
  const [urls, setUrls] = useState<string[]>([]);
  const [notes, setNotes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [loadedSources, loadedKeywords] = await Promise.all([
        api.sources.list(),
        api.keywords.list()
      ]);
      const enabledSources = loadedSources.filter((source) => source.enabled);
      const enabledKeywords = loadedKeywords.filter((keyword) => keyword.enabled);
      setSources(enabledSources);
      setKeywords(enabledKeywords);
      setSourceId(enabledSources.find((source) => source.id === "linkedin")?.id ?? enabledSources[0]?.id ?? "");
      setSelectedKeywords(enabledKeywords.slice(0, 3).map((keyword) => keyword.keyword));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load search builder");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function toggleKeyword(keyword: string) {
    setSelectedKeywords((current) =>
      current.includes(keyword)
        ? current.filter((item) => item !== keyword)
        : [...current, keyword]
    );
  }

  async function generate(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const result = await api.sources.testUrl({
        sourceId,
        filters: {
          keywords: selectedKeywords,
          location,
          workplaceType,
          datePosted,
          experienceLevel,
          sortBy: "recent"
        }
      });
      setUrls(result.urls);
      setNotes([result.safetyNote, ...result.notes]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to generate search URLs");
    }
  }

  if (loading) return <LoadingState label="Loading search builder" />;

  return (
    <>
      <PageHeader
        title="Search Builder"
        description="Generate manual-open job search URLs from enabled sources and your target keywords."
      />
      <ErrorState error={error} />

      <Panel title="Filters">
        <form className="form-grid" onSubmit={generate}>
          <Field label="Source">
            <select value={sourceId} onChange={(event) => setSourceId(event.target.value)} required>
              {sources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Location">
            <input
              list="preferred-locations"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
            />
            <datalist id="preferred-locations">
              {preferredLocations.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
          </Field>
          <Field label="Workplace">
            <select value={workplaceType} onChange={(event) => setWorkplaceType(event.target.value)}>
              {workplaceTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Date posted">
            <select value={datePosted} onChange={(event) => setDatePosted(event.target.value)}>
              {datePostedOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Experience">
            <select value={experienceLevel} onChange={(event) => setExperienceLevel(event.target.value)}>
              {experienceLevels.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </Field>
          <div className="form-actions">
            <button className="primary-button" type="submit" disabled={!sourceId || selectedKeywords.length === 0}>
              <Search size={16} />
              Generate
            </button>
          </div>
        </form>
      </Panel>

      <Panel title="Keywords">
        {keywords.length === 0 ? (
          <EmptyState title="No enabled keywords" detail="Enable keywords on the Keywords page first." />
        ) : (
          <div className="checkbox-grid">
            {keywords.map((keyword) => (
              <label key={keyword.id}>
                <input
                  type="checkbox"
                  checked={selectedKeywords.includes(keyword.keyword)}
                  onChange={() => toggleKeyword(keyword.keyword)}
                />
                <span>{keyword.keyword}</span>
              </label>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Generated URLs">
        {notes.length > 0 ? (
          <div className="note-list">
            {notes.map((note) => (
              <span key={note}>{note}</span>
            ))}
          </div>
        ) : null}
        {urls.length === 0 ? (
          <EmptyState title="No URLs generated yet" detail="Select filters and generate URLs." />
        ) : (
          <div className="url-list">
            {urls.map((url) => (
              <a key={url} href={url} target="_blank" rel="noreferrer">
                <ExternalLink size={16} />
                {url}
              </a>
            ))}
          </div>
        )}
      </Panel>
    </>
  );
}
