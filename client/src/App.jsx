import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import AnimatedBackground from './components/AnimatedBackground';
import AssistantOrb from './components/AssistantOrb';
import Layout from './components/Layout';

const AuthPage = lazy(() => import('./pages/AuthPage'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Chat = lazy(() => import('./pages/Chat'));
const Tasks = lazy(() => import('./pages/Tasks'));
const Notes = lazy(() => import('./pages/Notes'));
const Reminders = lazy(() => import('./pages/Reminders'));
const Bots = lazy(() => import('./pages/Bots'));
const Settings = lazy(() => import('./pages/Settings'));
const Connections = lazy(() => import('./pages/Connections'));
const AdminOverview = lazy(() => import('./pages/admin/Overview'));
const AdminSales = lazy(() => import('./pages/admin/Sales'));
const AdminFinance = lazy(() => import('./pages/admin/Finance'));
const AdminContent = lazy(() => import('./pages/admin/Content'));
const AdminProjects = lazy(() => import('./pages/admin/Projects'));

export default function App() {
  const { user, loading } = useAuth();

  return (
    <>
      <AnimatedBackground />
      {loading ? (
        <div style={{ position: 'relative', zIndex: 1, height: '100vh', display: 'grid', placeItems: 'center' }}>
          <AssistantOrb size={90} state="thinking" />
        </div>
      ) : (
        <Suspense fallback={null}>
        <Routes>
          <Route path="/login" element={user ? <Navigate to="/" /> : <AuthPage />} />
          <Route element={user ? <Layout /> : <Navigate to="/login" />}>
            <Route index element={<Dashboard />} />
            <Route path="chat" element={<Chat />} />
            <Route path="chat/:id" element={<Chat />} />
            <Route path="tasks" element={<Tasks />} />
            <Route path="notes" element={<Notes />} />
            <Route path="reminders" element={<Reminders />} />
            <Route path="bots" element={<Bots />} />
            <Route path="settings" element={<Settings />} />
            <Route path="connections" element={<Connections />} />
            <Route path="admin" element={<AdminOverview />} />
            <Route path="admin/sales" element={<AdminSales />} />
            <Route path="admin/finance" element={<AdminFinance />} />
            <Route path="admin/content" element={<AdminContent />} />
            <Route path="admin/projects" element={<AdminProjects />} />
          </Route>
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
        </Suspense>
      )}
    </>
  );
}
