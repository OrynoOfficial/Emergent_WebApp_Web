import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI } from '../api/client';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    // Initialize user from localStorage if available
    const cachedUser = localStorage.getItem('user');
    if (cachedUser) {
      try {
        return JSON.parse(cachedUser);
      } catch (e) {
        return null;
      }
    }
    return null;
  });
  const [operatorContext, setOperatorContext] = useState(() => {
    const cached = localStorage.getItem('operator_context');
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        return null;
      }
    }
    return null;
  });
  const [effectivePermissions, setEffectivePermissions] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      setLoading(false);
      return;
    }
    
    try {
      const response = await authAPI.getCurrentUser();
      const userData = response.data;
      
      // Extract operator context and permissions from user data
      const opContext = userData.operator_context || null;
      const permissions = userData.effective_permissions || [];
      
      setUser(userData);
      setOperatorContext(opContext);
      setEffectivePermissions(permissions);
      
      // Cache data for resilience
      localStorage.setItem('user', JSON.stringify(userData));
      if (opContext) {
        localStorage.setItem('operator_context', JSON.stringify(opContext));
      } else {
        localStorage.removeItem('operator_context');
      }
    } catch (error) {
      console.error('Failed to fetch user:', error);
      // Only clear on explicit 401, keep cached user for other errors
      if (error.response?.status === 401) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        localStorage.removeItem('operator_context');
        setUser(null);
        setOperatorContext(null);
        setEffectivePermissions([]);
      } else {
        // For network errors, use cached user
        console.warn('Network error while fetching user, using cached data');
        const cachedUser = localStorage.getItem('user');
        const cachedOpContext = localStorage.getItem('operator_context');
        if (cachedUser) {
          try {
            setUser(JSON.parse(cachedUser));
            if (cachedOpContext) {
              setOperatorContext(JSON.parse(cachedOpContext));
            }
          } catch (e) {
            // Invalid cached data, but don't clear token
          }
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const login = async (email, password) => {
    const response = await authAPI.login({ email, password });
    const { access_token, refresh_token, user: userData } = response.data;
    localStorage.setItem('access_token', access_token);
    localStorage.setItem('refresh_token', refresh_token);
    
    // Store operator context from login response if available
    if (userData?.operator_context) {
      localStorage.setItem('operator_context', JSON.stringify(userData.operator_context));
      setOperatorContext(userData.operator_context);
    }
    
    // Fetch full user data after login
    await fetchUser();
    
    return response.data;
  };

  const register = async (data) => {
    const response = await authAPI.register(data);
    return response.data;
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    localStorage.removeItem('operator_context');
    setUser(null);
    setOperatorContext(null);
    setEffectivePermissions([]);
    window.location.href = '/login';
  };

  // Re-authenticate function to refresh user state without full page reload
  const reAuthenticate = useCallback(async () => {
    const token = localStorage.getItem('access_token');
    if (token) {
      await fetchUser();
    }
  }, [fetchUser]);

  // Helper to check if user is an operator user (assigned to an operator)
  const isOperatorUser = !!operatorContext;
  
  // Get operator's allowed service types
  const operatorServiceTypes = operatorContext?.service_types || [];
  const operatorType = operatorContext?.operator_type || null;

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    reAuthenticate,
    isAuthenticated: !!user || !!localStorage.getItem('access_token'),
    // Operator-related data
    operatorContext,
    effectivePermissions,
    isOperatorUser,
    operatorServiceTypes,
    operatorType,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};