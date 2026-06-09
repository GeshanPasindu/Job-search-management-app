import {
  Briefcase,
  ClipboardList,
  Database,
  FileText,
  KeyRound,
  LayoutDashboard,
  Search,
  Settings,
  Sparkles,
  Globe,
} from "lucide-react";
import { ApplicationsPage } from "./pages/ApplicationsPage";
import { ApplicationGeneratorPage } from "./pages/ApplicationGeneratorPage";
import { DashboardPage } from "./pages/DashboardPage";
import { JobsPage } from "./pages/JobsPage";
import { KeywordsPage } from "./pages/KeywordsPage";
import { SearchBuilderPage } from "./pages/SearchBuilderPage";
import { SettingsPage } from "./pages/SettingsPage";
import { SourcesPage } from "./pages/SourcesPage";
import { TemplatesPage } from "./pages/TemplatesPage";
import { TopJobsPage } from "./pages/TopJobsPage";
import { useState } from "react";

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "keywords", label: "Keywords", icon: KeyRound },
  { id: "sources", label: "Sources", icon: Database },
  { id: "search", label: "Search Builder", icon: Search },
  { id: "jobs", label: "Jobs", icon: Briefcase },
  { id: "templates", label: "Templates", icon: FileText },
  { id: "generator", label: "Generator", icon: Sparkles },
  { id: "applications", label: "Applications", icon: ClipboardList },
  { id: "settings", label: "Settings", icon: Settings },
] as const;

type PageId = (typeof navItems)[number]["id"];

export default function App() {
  const [activePage, setActivePage] = useState<PageId>("dashboard");
  const [selectedGeneratorJobId, setSelectedGeneratorJobId] = useState<
    string | null
  >(null);

  function openGenerator(jobId: string) {
    setSelectedGeneratorJobId(jobId);
    setActivePage("generator");
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span>JS</span>
          <div>
            <strong>Job Search CRM</strong>
            <small>Application Assistant</small>
          </div>
        </div>
        <nav>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={activePage === item.id ? "active" : ""}
                onClick={() => setActivePage(item.id)}
                title={item.label}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      <main className="workspace">
        {activePage === "dashboard" ? (
          <DashboardPage onGenerate={openGenerator} />
        ) : null}
        {activePage === "keywords" ? <KeywordsPage /> : null}
        {activePage === "sources" ? <SourcesPage /> : null}
        {activePage === "search" ? <SearchBuilderPage /> : null}
        {activePage === "jobs" ? <JobsPage onGenerate={openGenerator} /> : null}
        {activePage === "templates" ? <TemplatesPage /> : null}
        {activePage === "generator" ? (
          <ApplicationGeneratorPage selectedJobId={selectedGeneratorJobId} />
        ) : null}
        {activePage === "applications" ? <ApplicationsPage /> : null}
        {activePage === "settings" ? <SettingsPage /> : null}
      </main>
    </div>
  );
}
