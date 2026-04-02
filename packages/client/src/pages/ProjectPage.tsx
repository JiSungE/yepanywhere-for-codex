import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { SessionListItem } from "../components/SessionListItem";
import { useProject } from "../hooks/useProjects";
import { useGlobalSessions } from "../hooks/useGlobalSessions";
import { useRemoteBasePath } from "../hooks/useRemoteBasePath";
import { useI18n } from "../i18n";
import { useNavigationLayout } from "../layouts";

export function ProjectPage() {
  const { t } = useI18n();
  const { projectId } = useParams<{ projectId: string }>();
  const basePath = useRemoteBasePath();
  const { openSidebar, isWideScreen, toggleSidebar, isSidebarCollapsed } =
    useNavigationLayout();

  const { project, loading: projectLoading, error: projectError } =
    useProject(projectId);
  const {
    sessions,
    loading: sessionsLoading,
    error: sessionsError,
  } = useGlobalSessions({
    projectId,
    includeArchived: true,
    includeStats: false,
  });

  const grouped = useMemo(() => {
    const active = sessions.filter(
      (session) =>
        session.activity === "in-turn" ||
        session.activity === "waiting-input" ||
        session.pendingInputType,
    );
    const pinned = sessions.filter(
      (session) =>
        !session.isArchived &&
        !active.some((candidate) => candidate.id === session.id) &&
        session.isStarred,
    );
    const archived = sessions.filter((session) => session.isArchived);
    const recent = sessions.filter(
      (session) =>
        !session.isArchived &&
        !session.isStarred &&
        !active.some((candidate) => candidate.id === session.id),
    );

    return { active, pinned, recent, archived };
  }, [sessions]);

  const loading = projectLoading || sessionsLoading;
  const error = projectError ?? sessionsError;

  if (loading) return <div className="loading">{t("projectsLoading")}</div>;
  if (!projectId || !project) {
    return <div className="error">{t("newSessionNoProjects")}</div>;
  }
  if (error) {
    return (
      <div className="error">
        {t("projectsErrorPrefix")} {error.message}
      </div>
    );
  }

  const sections: Array<{
    key: string;
    title: string;
    sessions: typeof sessions;
  }> = [
    { key: "active", title: "In progress", sessions: grouped.active },
    { key: "pinned", title: "Pinned", sessions: grouped.pinned },
    { key: "recent", title: "Recent", sessions: grouped.recent },
    { key: "archived", title: "Archived", sessions: grouped.archived },
  ].filter((section) => section.sessions.length > 0);

  return (
    <div
      className={isWideScreen ? "main-content-wrapper" : "main-content-mobile"}
    >
      <div
        className={
          isWideScreen
            ? "main-content-constrained"
            : "main-content-mobile-inner"
        }
      >
        <PageHeader
          title={project.name}
          onOpenSidebar={openSidebar}
          onToggleSidebar={toggleSidebar}
          isWideScreen={isWideScreen}
          isSidebarCollapsed={isSidebarCollapsed}
        />

        <main className="page-scroll-container">
          <div className="page-content-inner">
            <div className="inbox-toolbar">
              <Link
                to={`${basePath}/new-thread?projectId=${encodeURIComponent(project.id)}`}
                className="inbox-refresh-button"
              >
                {t("projectsAddConfirm")}
              </Link>
              <span className="project-card__path" title={project.path}>
                {project.path}
              </span>
            </div>

            {sections.length === 0 ? (
              <div className="inbox-empty">
                <h3>New project</h3>
                <p>No threads yet. Start the first Codex thread for this project.</p>
              </div>
            ) : (
              <div className="session-list-cards">
                {sections.map((section) => (
                  <section key={section.key} className="inbox-section">
                    <div className="inbox-section-header">
                      <h2>{section.title}</h2>
                      <span>{section.sessions.length}</span>
                    </div>
                    <div className="session-list-cards">
                      {section.sessions.map((session) => (
                        <SessionListItem
                          key={session.id}
                          sessionId={session.id}
                          projectId={project.id}
                          projectName={project.name}
                          title={session.customTitle ?? session.title}
                          fullTitle={session.title}
                          updatedAt={session.updatedAt}
                          hasUnread={session.hasUnread}
                          activity={session.activity}
                          pendingInputType={session.pendingInputType}
                          contextUsage={undefined}
                          status={session.ownership}
                          provider={session.provider}
                          executor={session.executor}
                          mode="card"
                          showProjectName={false}
                          isStarred={session.isStarred}
                          isArchived={session.isArchived}
                          messageCount={session.messageCount}
                          basePath={basePath}
                        />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
