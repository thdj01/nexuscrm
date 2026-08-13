import React, { createContext, useContext, useEffect, useState } from 'react';
import API from '../api/axios';
import {
  CUSTOMER_PERMISSIONS,
  PROJECT_PERMISSIONS,
  UNIVERSAL_EMPLOYEE_PERMISSIONS,
} from '../constants/permissions';

const AuthContext = createContext(null);

const PROJECT_PLANNING_DEPARTMENTS = new Set([
  'DESIGN',
  'PRODUCTION',
  'PURCHASE',
  'AUTOMATION',
  'STORE',
  'QC',
]);

const PROJECT_MANAGEMENT_PERMISSIONS = new Set([
  PROJECT_PERMISSIONS.CREATE,
  PROJECT_PERMISSIONS.EDIT,
  PROJECT_PERMISSIONS.PLANNING_GRID,
  PROJECT_PERMISSIONS.ADD_DUPLICATE_PLANNING_GRID,
  PROJECT_PERMISSIONS.UPDATE_COMPLETION,
  PROJECT_PERMISSIONS.MARK_COMPLETED,
]);

const safelyParseUser = () => {
  try {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  } catch {
    localStorage.removeItem('user');
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(safelyParseUser);
  const [loading, setLoading] = useState(false);
  const [authReady, setAuthReady] = useState(() => !localStorage.getItem('token'));

  const syncUser = (nextUser) => {
    if (!nextUser) {
      localStorage.removeItem('user');
      setUser(null);
      return null;
    }

    localStorage.setItem('user', JSON.stringify(nextUser));
    setUser(nextUser);
    return nextUser;
  };

  const refreshAuthUser = async () => {
    const token = localStorage.getItem('token');
    if (!token) return null;

    try {
      const { data } = await API.get('/auth/me');
      return syncUser(data.user);
    } catch (error) {
      if (error.response?.status === 401) {
        localStorage.removeItem('token');
        syncUser(null);
      }
      return null;
    }
  };

  useEffect(() => {
    let mounted = true;

    (async () => {
      await refreshAuthUser();
      if (mounted) setAuthReady(true);
    })();

    return () => {
      mounted = false;
    };
    // Refresh once on application load so Employee Access changes made by an
    // administrator are reflected without relying only on stale local storage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (email, password) => {
    setLoading(true);
    try {
      const { data } = await API.post('/auth/login', { email, password });
      localStorage.setItem('token', data.token);
      syncUser(data.user);
      setAuthReady(true);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Login failed',
      };
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    syncUser(null);
    setAuthReady(true);
  };

  const updateAuthUser = (updatedUser) => {
    if (!updatedUser) return user;

    const mergedUser = {
      ...(user || {}),
      ...updatedUser,
      employeeAccess:
        updatedUser.employeeAccess ||
        updatedUser.effectiveEmployeeAccess ||
        user?.employeeAccess ||
        [],
    };

    return syncUser(mergedUser);
  };

  const isAdmin = user?.role === 'admin';
  const isHod = user?.role === 'hod';
  const isManagerRole = user?.role === 'manager';
  const isTeamLead = user?.role === 'team_lead';
  const isEmployee = user?.role === 'employee';

  const isManager = isAdmin || isHod || isManagerRole || isTeamLead;
  const isTicketAssignee = isEmployee;

  const planningLeadershipPermissions = [
    PROJECT_PERMISSIONS.PLANNING_GRID,
    PROJECT_PERMISSIONS.ADD_DUPLICATE_PLANNING_GRID,
    PROJECT_PERMISSIONS.UPDATE_COMPLETION,
  ];

  const employeeRestrictedProjectPermissions = [
    PROJECT_PERMISSIONS.CREATE,
    PROJECT_PERMISSIONS.PLANNING_GRID,
    PROJECT_PERMISSIONS.ADD_DUPLICATE_PLANNING_GRID,
  ];

  const departmentNames = [
    user?.departmentName,
    user?.departmentCode,
    ...(Array.isArray(user?.hodDepartmentNames) ? user.hodDepartmentNames : []),
    ...(Array.isArray(user?.hodDepartmentInfo)
      ? user.hodDepartmentInfo.flatMap((department) => [department?.name, department?.code])
      : []),
  ]
    .map((value) => String(value || '').trim().toUpperCase())
    .filter(Boolean);
  const managedDepartmentNames = new Set(departmentNames);
  const hasPlanningDepartmentParticipation = departmentNames.some(
    (department) => PROJECT_PLANNING_DEPARTMENTS.has(department)
  );
  const hasPlanningDepartmentAuthority = isAdmin || (
    isManager && hasPlanningDepartmentParticipation
  );
  const isAutomationHod = (isHod || isManagerRole) && departmentNames.includes('AUTOMATION');

  const canManagePlanningDepartment = (department) => {
    if (isAdmin) return true;
    if (!isManager) return false;
    return managedDepartmentNames.has(String(department || '').trim().toUpperCase());
  };

  const hasPermission = (permission) => {
    if (!permission || !user) return false;
    if (isAdmin) return true;
    // Sales/Estimation and other non-planning departments have Project View
    // only. This also neutralizes stale project-management checkboxes saved on
    // accounts before department-aware planning access was enforced.
    if (PROJECT_MANAGEMENT_PERMISSIONS.has(permission) && !hasPlanningDepartmentParticipation) return false;
    if (isEmployee && employeeRestrictedProjectPermissions.includes(permission)) return false;
    if (isManager && planningLeadershipPermissions.includes(permission)) {
      return hasPlanningDepartmentAuthority;
    }
    if (isAutomationHod && permission === CUSTOMER_PERMISSIONS.VIEW) return true;
    if (UNIVERSAL_EMPLOYEE_PERMISSIONS.includes(permission)) return true;
    return Array.isArray(user.employeeAccess) && user.employeeAccess.includes(permission);
  };

  const hasAnyPermission = (permissions = []) => (
    permissions.some((permission) => hasPermission(permission))
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        authReady,
        login,
        logout,
        updateAuthUser,
        refreshAuthUser,
        hasPermission,
        hasAnyPermission,
        canManagePlanningDepartment,
        hasPlanningDepartmentAuthority,
        isAdmin,
        isHod,
        isTeamLead,
        isEmployee,
        isManagerRole,
        isManager,
        isTicketAssignee,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
