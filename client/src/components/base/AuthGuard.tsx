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
      return <Navigate to="/login" replace />;
    }

    if (!requireAuth && isAuthenticated) {
      return <Navigate to="/dashboard" replace />;
    }

    return <>{children}</>;
  }
}

