import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Docs from './pages/Docs'
import Servers from './pages/Servers'
import ServerDetail from './pages/ServerDetail'
import Applications from './pages/Applications'
import AppDetail from './pages/AppDetail'
import DeploymentLog from './pages/DeploymentLog'
import Backups from './pages/Backups'
import BackupDetail from './pages/BackupDetail'
import Alerts from './pages/Alerts'
import Monitoring from './pages/Monitoring'
import Users from './pages/Users'
import Settings from './pages/Settings'
import Placeholder from './pages/Placeholder'

export default function App() {
  return (
    <Routes>
      {/* Public — no auth required */}
      <Route path="/login" element={<Login />} />

      {/* Protected — Layout handles the auth redirect internally */}
      <Route element={<Layout />}>
        <Route index                    element={<Dashboard />} />
        <Route path="docs"              element={<Navigate to="/docs/1a" replace />} />
        <Route path="docs/:phaseId"     element={<Docs />} />
        <Route path="servers"           element={<Servers />} />
        <Route path="servers/:id"       element={<ServerDetail />} />
        <Route path="applications"      element={<Applications />} />
        <Route path="applications/:id"  element={<AppDetail />} />
        <Route path="deployments/:id"   element={<DeploymentLog />} />
        <Route path="backups"             element={<Backups />} />
        <Route path="backups/:id"         element={<BackupDetail />} />
        <Route path="monitoring"          element={<Monitoring />} />
        <Route path="alerts"            element={<Alerts />} />
        <Route path="logs"              element={<Placeholder title="Logs" desc="Container and system logs. Coming in Phase 7." />} />
        <Route path="users"             element={<Users />} />
        <Route path="settings"          element={<Settings />} />
        <Route path="audit-logs"        element={<Placeholder title="Audit Logs" desc="Action history. Coming in Phase 6." />} />
        <Route path="*"                 element={<Placeholder title="404"        desc="Page not found." />} />
      </Route>
    </Routes>
  )
}
