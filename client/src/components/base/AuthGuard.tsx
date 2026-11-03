import React from 'react';
import { Navigate, Location } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { BaseComponent } from './BaseComponent';

interface AuthGuardProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  location?: Location;
}

export class AuthGuard extends BaseComponent<AuthGuardProps> {
  render() {
    const { children, requireAuth = true } = this.props;
    const token = localStorage.getItem('token');
    const isAuthenticated = !!token;

    if (requireAuth && !isAuthenticated) {
      return <Navigate to={`/login${window.location.search}`} replace />;
    }

    if (!requireAuth && isAuthenticated) {
      // If returning with Google OAuth code or error, let LoginPage handle it
      if (typeof window !== 'undefined' && (window.location.search.includes('code=') || window.location.search.includes('error='))) {
        return <>{children}</>;
      }
      return <Navigate to="/dashboard" replace />;
    }

    return <>{children}</>;
  }
}

