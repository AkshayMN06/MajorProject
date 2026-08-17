import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MainLayout } from './components/layout/MainLayout';
import { DashboardPage } from './pages/DashboardPage';
import ScenarioPage from './pages/ScenarioPage';
import PreTestPage from './pages/PreTestPage';
import PostTestPage from './pages/PostTestPage';
import PracticeLabsPage from './pages/PracticeLabsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import ProfilePage from './pages/ProfilePage';
import { SettingsPage } from './pages/SettingsPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';

import { AuthInitializer } from './components/auth/AuthInitializer';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { PublicRoute } from './components/auth/PublicRoute';

function App() {
  return (
    <AuthInitializer>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
          
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<MainLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="scenario" element={<ScenarioPage />} />
              <Route path="pre-test" element={<PreTestPage />} />
              <Route path="post-test" element={<PostTestPage />} />
              <Route path="labs" element={<PracticeLabsPage />} />
              <Route path="analytics" element={<AnalyticsPage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthInitializer>
  );
}

export default App;
