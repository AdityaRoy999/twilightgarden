import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

// Opening a callback URL must never change an existing account's role.
const PartnerAuthCallback: React.FC = () => {
  const { user, loading } = useAuth();
  if (loading) return <div role="status" className="min-h-screen flex items-center justify-center">Signing in…</div>;
  const destination = !user ? '/partner/login' : user.role === 'admin' ? '/admin/users' : user.role === 'partner' ? '/partner/dashboard' : '/dashboard';
  return <Navigate to={destination} replace />;
};
export default PartnerAuthCallback;
