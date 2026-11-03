import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { BaseComponent } from './components/base/BaseComponent';
import { AuthGuard } from './components/base/AuthGuard';
import { LoginPage } from './pages/LoginPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { DashboardPage } from './pages/DashboardPage';

export class App extends BaseComponent {
  render() {
    return (
      <BrowserRouter>
        <Routes>
          {/* Public Authentication Route */}
          <Route
            path="/login"
            element={
              <AuthGuard requireAuth={false}>
                <LoginPage />
              </AuthGuard>
            }
          />

          {/* Protected Onboarding Wizard Route */}
          <Route
            path="/onboarding"
            element={
              <AuthGuard requireAuth={true}>
                <OnboardingPage />
              </AuthGuard>
            }
          />

          {/* Protected Dashboard Route */}
          <Route
            path="/dashboard"
            element={
              <AuthGuard requireAuth={true}>
                <DashboardPage />
              </AuthGuard>
            }
          />

          {/* Root OAuth & Dashboard Fallback */}
          <Route
            path="/"
            element={
              typeof window !== 'undefined' && (window.location.search.includes('code=') || window.location.search.includes('error=')) ? (
                <Navigate to={`/login${window.location.search}`} replace />
              ) : (
                <Navigate to="/dashboard" replace />
              )
            }
          />

          {/* Root Fallback */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    );
  }
}

export default App;

