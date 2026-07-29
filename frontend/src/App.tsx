import { Navigate, Route, Routes } from "react-router-dom";
import { useCurrentUser } from "./hooks/useCurrentUser";
import { CreateUserView } from "./pages/CreateUserView";
import { ProjectDashboard } from "./pages/ProjectDashboard";
import { ProjectCreatePage } from "./pages/ProjectCreatePage";
import { ProjectSetupPage } from "./pages/ProjectSetupPage";
import { ProjectWorkspace } from "./pages/ProjectWorkspace";
import { AffinityBoardView } from "./pages/AffinityBoardView";

export function App() {
  const { user, loading, refresh } = useCurrentUser();

  if (loading) return null;
  if (!user) return <CreateUserView onCreated={refresh} />;

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/projects" replace />} />
      <Route path="/projects" element={<ProjectDashboard />} />
      <Route path="/projects/new" element={<ProjectCreatePage />} />
      <Route path="/projects/new/setup" element={<ProjectSetupPage />} />
      <Route path="/projects/:projectId/setup" element={<ProjectSetupPage />} />
      <Route path="/projects/:projectId/affinity-map" element={<AffinityBoardView />} />
      <Route path="/projects/:projectId" element={<ProjectWorkspace currentUser={user} />} />
      <Route path="*" element={<Navigate to="/projects" replace />} />
    </Routes>
  );
}
