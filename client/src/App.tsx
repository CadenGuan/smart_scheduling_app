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

          {/* Root Fallback */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    );
  }
}

export default App;

