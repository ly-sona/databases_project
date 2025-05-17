import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredPermission?: string;
  anyOfPermissions?: string[];
}

export default function ProtectedRoute({ children, requiredPermission, anyOfPermissions }: ProtectedRouteProps) {
  const { user, hasPermission } = useAuth();

  if (!user) {
    return <Navigate to="/login" />;
  }

  // Check for a specific permission
  if (requiredPermission && !hasPermission(requiredPermission)) {
    return <Navigate to="/unauthorized" />;
  }

  // Check if user has any of the specified permissions
  if (anyOfPermissions && anyOfPermissions.length > 0) {
    const hasAnyPermission = anyOfPermissions.some(permission => hasPermission(permission));
    if (!hasAnyPermission) {
      return <Navigate to="/unauthorized" />;
    }
  }

  return <>{children}</>;
} 