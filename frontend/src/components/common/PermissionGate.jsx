import React from 'react';
import { usePermissions } from '@/contexts/PermissionsContext';

/**
 * PermissionGate - Conditionally renders children based on user permissions
 * 
 * @param {string} permission - Single permission required (e.g., "hotels.create")
 * @param {string[]} permissions - Array of permissions (use with requireAll)
 * @param {boolean} requireAll - If true, user must have ALL permissions. Default: false (any)
 * @param {React.ReactNode} children - Content to render if permission check passes
 * @param {React.ReactNode} fallback - Optional content to render if permission check fails
 * @param {string} module - Check if user can access any permission in this module
 * 
 * Usage Examples:
 * 
 * // Single permission
 * <PermissionGate permission="hotels.create">
 *   <Button>Add Hotel</Button>
 * </PermissionGate>
 * 
 * // Any of multiple permissions
 * <PermissionGate permissions={["hotels.edit", "hotels.delete"]}>
 *   <Button>Manage Hotel</Button>
 * </PermissionGate>
 * 
 * // All permissions required
 * <PermissionGate permissions={["users.view", "users.edit"]} requireAll>
 *   <UserEditForm />
 * </PermissionGate>
 * 
 * // Module access
 * <PermissionGate module="hotels">
 *   <HotelManagement />
 * </PermissionGate>
 * 
 * // With fallback
 * <PermissionGate permission="analytics.export" fallback={<UpgradePrompt />}>
 *   <ExportButton />
 * </PermissionGate>
 */
const PermissionGate = ({ 
  permission, 
  permissions, 
  requireAll = false, 
  module,
  children, 
  fallback = null 
}) => {
  const { 
    hasPermission, 
    hasAnyPermission, 
    hasAllPermissions, 
    canAccessModule,
    loading 
  } = usePermissions();

  // Don't render anything while loading permissions
  if (loading) {
    return null;
  }

  let hasAccess = false;

  // Check module access
  if (module) {
    hasAccess = canAccessModule(module);
  }
  // Check single permission
  else if (permission) {
    hasAccess = hasPermission(permission);
  }
  // Check multiple permissions
  else if (permissions && Array.isArray(permissions)) {
    hasAccess = requireAll 
      ? hasAllPermissions(permissions)
      : hasAnyPermission(permissions);
  }
  // No permission specified - allow access
  else {
    hasAccess = true;
  }

  if (hasAccess) {
    return <>{children}</>;
  }

  return fallback ? <>{fallback}</> : null;
};

/**
 * withPermission - HOC to wrap components with permission check
 * 
 * Usage:
 * const ProtectedComponent = withPermission(MyComponent, "hotels.create");
 */
export const withPermission = (Component, permission, fallback = null) => {
  return function PermissionWrappedComponent(props) {
    return (
      <PermissionGate permission={permission} fallback={fallback}>
        <Component {...props} />
      </PermissionGate>
    );
  };
};

/**
 * useCanAccess - Hook to check access in component logic
 * 
 * Usage:
 * const canCreate = useCanAccess("hotels.create");
 * const canManage = useCanAccess(["hotels.edit", "hotels.delete"]);
 */
export const useCanAccess = (permissionOrPermissions, requireAll = false) => {
  const { hasPermission, hasAnyPermission, hasAllPermissions } = usePermissions();

  if (Array.isArray(permissionOrPermissions)) {
    return requireAll 
      ? hasAllPermissions(permissionOrPermissions)
      : hasAnyPermission(permissionOrPermissions);
  }

  return hasPermission(permissionOrPermissions);
};

export default PermissionGate;
