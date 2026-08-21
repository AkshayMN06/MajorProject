import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MainLayout } from './components/layout/MainLayout';
import { DashboardPage } from './pages/DashboardPage';
import ScenarioPage from './pages/ScenarioPage';
import PracticeLabsPage from './pages/PracticeLabsPage';
import PracticeSessionPage from './pages/PracticeSessionPage';
import AnalyticsPage from './pages/AnalyticsPage';
import ProfilePage from './pages/ProfilePage';
import { SettingsPage } from './pages/SettingsPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';

import AdminDashboardPage from './pages/AdminDashboardPage';

import { AuthInitializer } from './components/auth/AuthInitializer';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { PublicRoute } from './components/auth/PublicRoute';
import { AdminRoute } from './components/auth/AdminRoute';
import { UserRoute } from './components/auth/UserRoute';

function App() {
  return (
    <AuthInitializer>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
          
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<MainLayout />}>
              <Route element={<UserRoute />}>
                <Route index element={<DashboardPage />} />
                <Route path="scenario" element={<ScenarioPage />} />
                <Route path="labs" element={<PracticeLabsPage />} />
                <Route path="labs/:module" element={<PracticeSessionPage />} />
                <Route path="analytics" element={<AnalyticsPage />} />
              </Route>
              <Route path="profile" element={<ProfilePage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route element={<AdminRoute />}>
                <Route path="admin" element={<AdminDashboardPage />} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthInitializer>
  );
}

export default App;
