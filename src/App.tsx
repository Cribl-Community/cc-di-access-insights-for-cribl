import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { RbacDataProvider } from './context/RbacDataContext';
import { AppSidebar } from './components/shell/AppSidebar';
import { TopBar } from './components/shell/TopBar';
import { DirectoryLayout } from './components/shell/DirectoryLayout';
import { DashboardPage } from './pages/DashboardPage';
import { UsersPage } from './pages/UsersPage';
import { TeamsPage } from './pages/TeamsPage';
import { ComparePage } from './pages/ComparePage';
import { QueryPage } from './pages/QueryPage';
import { HelpPage } from './pages/HelpPage';
import { WorkerGroupsPage } from './pages/WorkerGroupsPage';
import { ApiKeysPage } from './pages/ApiKeysPage';
import './App.css';

/** Redirect that keeps the query string (old /compare?a=…&b= links stay shareable). */
function RedirectKeepingSearch({ to }: { to: string }) {
  const { search } = useLocation();
  return <Navigate to={`${to}${search}`} replace />;
}

function AppShell() {
  return (
    <div className="app-shell">
      <AppSidebar />
      <div className="app-main">
        <TopBar />
        <main className="app-content">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/overview" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />

            <Route path="/directory" element={<Navigate to="/users" replace />} />
            <Route element={<DirectoryLayout />}>
              <Route path="/users" element={<UsersPage />} />
              <Route path="/users/:userId" element={<UsersPage />} />
              <Route path="/teams" element={<TeamsPage />} />
              <Route path="/teams/:teamId" element={<TeamsPage />} />
              <Route path="/api-keys" element={<ApiKeysPage />} />
              <Route path="/api-keys/:keyId" element={<ApiKeysPage />} />
            </Route>

            <Route path="/access-check" element={<ComparePage />} />
            <Route path="/compare" element={<RedirectKeepingSearch to="/access-check" />} />
            <Route path="/query" element={<QueryPage />} />
            <Route path="/query-search" element={<RedirectKeepingSearch to="/query" />} />

            <Route path="/worker-groups" element={<WorkerGroupsPage />} />
            <Route path="/worker-groups/:groupId" element={<WorkerGroupsPage />} />
            <Route path="/help" element={<HelpPage />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter basename={window.CRIBL_BASE_PATH}>
      <RbacDataProvider>
        <AppShell />
      </RbacDataProvider>
    </BrowserRouter>
  );
}

export default App;
