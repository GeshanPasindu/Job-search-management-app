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
  LogOut,
  Loader,
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
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { useState } from "react";
import { useAuth } from "./hooks/useAuth";

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "jobs", label: "Jobs", icon: Briefcase },
  { id: "search", label: "Search Builder", icon: Search },
  { id: "generator", label: "Generator", icon: Sparkles },
  { id: "keywords", label: "Keywords", icon: KeyRound },
  { id: "sources", label: "Sources", icon: Database },
  { id: "templates", label: "Templates", icon: FileText },
  { id: "applications", label: "Applications", icon: ClipboardList },
  { id: "settings", label: "Settings", icon: Settings },
] as const;

type PageId = (typeof navItems)[number]["id"];

export default function App() {
  const { user, loading, logout } = useAuth();
  const [activePage, setActivePage] = useState<PageId>("dashboard");
  const [selectedGeneratorJobId, setSelectedGeneratorJobId] = useState<
    string | null
  >(null);
  const [authView, setAuthView] = useState<"login" | "register">("login");

  if (loading) {
    return (
      <div style={{ display: "grid", placeItems: "center", minHeight: "100vh", backgroundColor: "var(--surface-subtle)" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem", color: "var(--muted)" }}>
          <Loader className="spin" size={32} color="var(--teal)" />
          <span style={{ fontWeight: 500 }}>Loading Job Search Assistant...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    if (authView === "login") {
      return <LoginPage onNavigateToRegister={() => setAuthView("register")} />;
    }
    return <RegisterPage onNavigateToLogin={() => setAuthView("login")} />;
  }

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
            <strong>Job Search Assistant</strong>
            <small>Application process support</small>
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
        
        <div className="sidebar-footer" style={{ marginTop: "auto" }}>
          <nav>
            <button onClick={logout} title="Sign out">
              <LogOut size={18} />
              <span>Sign out</span>
            </button>
          </nav>
        </div>
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
