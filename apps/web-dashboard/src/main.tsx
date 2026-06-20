import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { AuthProvider } from './providers/AuthProvider';
import './index.css';

import Layout from './components/Layout';
import Home from './pages/Home';
import Pricing from './pages/Pricing';
import Support from './pages/Support';
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';
import Changelog from './pages/Changelog';
import Status from './pages/Status';
import Dashboard from './pages/Dashboard';

// Screenshot Generator imports
import ScreenshotLayout from './pages/screenshots/ScreenshotLayout';
import DashboardShot from './pages/screenshots/DashboardShot';
import CaptureShot from './pages/screenshots/CaptureShot';
import InjectionShot from './pages/screenshots/InjectionShot';
import HandoffShot from './pages/screenshots/HandoffShot';
import SyncMcpShot from './pages/screenshots/SyncMcpShot';
import PrivacyBackupShot from './pages/screenshots/PrivacyBackupShot';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* V2 NOTE: Consider pre-rendering or full SSR (e.g. Next.js/Remix) later for stronger search indexing. */}
    <HelmetProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="pricing" element={<Pricing />} />
              <Route path="support" element={<Support />} />
              <Route path="privacy" element={<Privacy />} />
              <Route path="terms" element={<Terms />} />
              <Route path="changelog" element={<Changelog />} />
              <Route path="status" element={<Status />} />
              <Route path="dashboard" element={<Dashboard />} />
            </Route>
            
            <Route path="/screenshots" element={<ScreenshotLayout />}>
              <Route path="dashboard" element={<DashboardShot />} />
              <Route path="capture" element={<CaptureShot />} />
              <Route path="injection" element={<InjectionShot />} />
              <Route path="handoff" element={<HandoffShot />} />
              <Route path="sync-mcp" element={<SyncMcpShot />} />
              <Route path="privacy-backup" element={<PrivacyBackupShot />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </HelmetProvider>
  </React.StrictMode>
);
