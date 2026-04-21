import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Layout from './Layout';
import { useState, useEffect } from 'react';

// Role hierarchy - super_admin should have access to all admin routes
const ROLE_HIERARCHY = {
  customer: ['customer'],
  employee: ['employee', 'customer'],
  service_provider: ['service_provider', 'employee', 'customer'],
  operator: ['operator', 'service_provider', 'employee', 'customer'],
  admin: ['admin', 'operator', 'service_provider', 'employee', 'customer'],
  super_admin: ['super_admin', 'admin', 'operator', 'service_provider', 'employee', 'customer']
};

const hasAccess = (userRole, requiredRoles) => {
  if (requiredRoles.length === 0) return true;
  
  // Get all roles this user has access to based on hierarchy
  const accessibleRoles = ROLE_HIERARCHY[userRole] || [userRole];
  
  // Check if any of the user's accessible roles match the required roles
  return requiredRoles.some(role => accessibleRoles.includes(role));
};

export default function ProtectedRoute({ children, requiredRoles = [], bare = false }) {
  const { user, loading, isAuthenticated } = useAuth();
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Wait for initial auth check to complete
    if (!loading) {
      setIsInitialized(true);
    }
  }, [loading]);

  // Show loading while AuthContext is initializing
  if (!isInitialized || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Check if user is authenticated (either user object exists or token exists)
  const hasToken = !!localStorage.getItem('access_token');
  
  if (!isAuthenticated && !hasToken) {
    return <Navigate to="/login" replace />;
  }

  // If we have a token but user isn't loaded yet, use cached user for role check
  const effectiveUser = user || (() => {
    try {
      const cached = localStorage.getItem('user');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  })();

  // Check role-based access using hierarchy
  if (requiredRoles.length > 0 && effectiveUser && !hasAccess(effectiveUser.role, requiredRoles)) {
    return (
      <Layout>
        <div className="text-center py-20">
          <div className="text-6xl mb-4">🚫</div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Access Denied</h2>
          <p className="text-slate-600 mb-6">You don't have permission to access this page.</p>
          <a href="/dashboard" className="btn btn-primary">
            Go to Dashboard
          </a>
        </div>
      </Layout>
    );
  }

  return bare ? <>{children}</> : <Layout>{children}</Layout>;
}
