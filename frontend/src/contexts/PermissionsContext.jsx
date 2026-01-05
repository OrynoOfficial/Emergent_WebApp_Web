import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';

const PermissionsContext = createContext(null);

export const usePermissions = () => {
  const context = useContext(PermissionsContext);
  if (!context) {
    throw new Error('usePermissions must be used within PermissionsProvider');
  }
  return context;
};

/**
 * Check if user has a specific permission
 * @param {string} permission - Permission code to check (e.g., "hotels.create")
 * @returns {boolean}
 */
export const useHasPermission = (permission) => {
  const { hasPermission } = usePermissions();
  return hasPermission(permission);
};

/**
 * Check if user has any of the specified permissions
 * @param {string[]} permissions - Array of permission codes
 * @returns {boolean}
 */
export const useHasAnyPermission = (permissions) => {
  const { hasAnyPermission } = usePermissions();
  return hasAnyPermission(permissions);
};

/**
 * Check if user has all of the specified permissions
 * @param {string[]} permissions - Array of permission codes
 * @returns {boolean}
 */
export const useHasAllPermissions = (permissions) => {
  const { hasAllPermissions } = usePermissions();
  return hasAllPermissions(permissions);
};

export const PermissionsProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [permissions, setPermissions] = useState(new Set());
  const [assignedRoles, setAssignedRoles] = useState([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [hasAllPermissionsFlag, setHasAllPermissionsFlag] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch user permissions from the API
  const fetchPermissions = useCallback(async () => {
    if (!isAuthenticated) {
      setPermissions(new Set());
      setAssignedRoles([]);
      setIsSuperAdmin(false);
      setHasAllPermissionsFlag(false);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('access_token');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/access/my-permissions`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch permissions');
      }

      const data = await response.json();
      
      setPermissions(new Set(data.effective_permissions || []));
      setAssignedRoles(data.assigned_roles || []);
      setIsSuperAdmin(data.is_super_admin || false);
      setHasAllPermissionsFlag(data.has_all_permissions || false);
      setError(null);
    } catch (err) {
      console.error('Error fetching permissions:', err);
      setError(err.message);
      // Set safe defaults
      setPermissions(new Set());
      setIsSuperAdmin(false);
      setHasAllPermissionsFlag(false);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  // Refetch permissions when user changes
  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions, user]);

  /**
   * Check if user has a specific permission
   */
  const hasPermission = useCallback((permission) => {
    // Super admin has all permissions
    if (isSuperAdmin || hasAllPermissionsFlag) {
      return true;
    }

    // Check for wildcard in permissions
    if (permissions.has('*')) {
      return true;
    }

    // Check exact match
    if (permissions.has(permission)) {
      return true;
    }

    // Check module-level wildcard (e.g., "hotels.*" grants all hotels permissions)
    const module = permission.split('.')[0];
    if (permissions.has(`${module}.*`)) {
      return true;
    }

    return false;
  }, [permissions, isSuperAdmin, hasAllPermissionsFlag]);

  /**
   * Check if user has any of the specified permissions
   */
  const hasAnyPermission = useCallback((permissionList) => {
    if (!Array.isArray(permissionList) || permissionList.length === 0) {
      return true; // No permissions required
    }

    // Super admin has all permissions
    if (isSuperAdmin || hasAllPermissionsFlag) {
      return true;
    }

    return permissionList.some(permission => hasPermission(permission));
  }, [hasPermission, isSuperAdmin, hasAllPermissionsFlag]);

  /**
   * Check if user has all of the specified permissions
   */
  const hasAllPermissions = useCallback((permissionList) => {
    if (!Array.isArray(permissionList) || permissionList.length === 0) {
      return true; // No permissions required
    }

    // Super admin has all permissions
    if (isSuperAdmin || hasAllPermissionsFlag) {
      return true;
    }

    return permissionList.every(permission => hasPermission(permission));
  }, [hasPermission, isSuperAdmin, hasAllPermissionsFlag]);

  /**
   * Check if user can access a specific module
   */
  const canAccessModule = useCallback((module) => {
    if (isSuperAdmin || hasAllPermissionsFlag) {
      return true;
    }

    // Check if user has any permission for this module
    const modulePrefix = `${module}.`;
    for (const perm of permissions) {
      if (perm.startsWith(modulePrefix) || perm === `${module}.*`) {
        return true;
      }
    }

    return false;
  }, [permissions, isSuperAdmin, hasAllPermissionsFlag]);

  const value = {
    permissions: Array.from(permissions),
    assignedRoles,
    isSuperAdmin,
    hasAllPermissionsFlag,
    loading,
    error,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    canAccessModule,
    refetchPermissions: fetchPermissions
  };

  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  );
};

export default PermissionsContext;
