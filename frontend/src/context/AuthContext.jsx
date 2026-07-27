import React, { createContext, useContext, useEffect, useState } from 'react';
import API from '../api/axios';
import { UNIVERSAL_EMPLOYEE_PERMISSIONS } from '../constants/permissions';

const AuthContext = createContext(null);

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

  const hasPermission = (permission) => {
    if (!permission || !user) return false;
    if (isAdmin) return true;
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
