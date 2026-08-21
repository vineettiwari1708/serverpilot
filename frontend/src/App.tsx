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
        <Route path="monitoring"        element={<Placeholder title="Monitoring" desc="CPU, RAM, disk metrics. Coming in Phase 6." />} />
        <Route path="logs"              element={<Placeholder title="Logs"       desc="Container and system logs. Coming in Phase 6." />} />
        <Route path="alerts"            element={<Placeholder title="Alerts"     desc="Threshold alerts. Coming in Phase 6." />} />
        <Route path="users"             element={<Placeholder title="Users"      desc="User management." />} />
        <Route path="settings"          element={<Placeholder title="Settings"   desc="System configuration." />} />
        <Route path="audit-logs"        element={<Placeholder title="Audit Logs" desc="Action history. Coming in Phase 6." />} />
        <Route path="*"                 element={<Placeholder title="404"        desc="Page not found." />} />
      </Route>
    </Routes>
  )
}
