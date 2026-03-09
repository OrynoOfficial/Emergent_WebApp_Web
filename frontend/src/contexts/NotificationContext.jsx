import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../api/client';
import { useAuth } from './AuthContext';

const NotificationContext = createContext(null);

// Notification types
export const NOTIFICATION_TYPES = {
  INFO: 'info',
  SUCCESS: 'success',
  WARNING: 'warning',
  ERROR: 'error',
  PROMO: 'promo',
  BOOKING: 'booking',
  PAYMENT: 'payment',
  SYSTEM: 'system'
};

// Helper function to calculate relative time
const getRelativeTime = (dateString) => {
  if (!dateString) return 'Unknown';
  
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);
  
  if (diffInSeconds < 0) return 'Just now'; // Future date (clock sync issues)
  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  }
  if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  }
  if (diffInSeconds < 604800) {
    const days = Math.floor(diffInSeconds / 86400);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  }
  if (diffInSeconds < 2592000) {
    const weeks = Math.floor(diffInSeconds / 604800);
    return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
  }
  // More than a month, show the date
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
};

export function NotificationProvider({ children }) {
  const { user, isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch notifications from backend
  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated) return;
    
    try {
      setLoading(true);
      const response = await api.get('/notifications/');
      const data = response.data?.notifications || [];
      
      // Transform data - store created_at, calculate time dynamically
      const transformedData = data.map(n => ({
        ...n,
        id: n.id || n._id,
        read: n.read ?? n.is_read ?? false,
        created_at: n.created_at || n.timestamp || new Date().toISOString()
      }));
      
      setNotifications(transformedData);
      setUnreadCount(transformedData.filter(n => !n.read).length);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      // Don't use mock data - just keep empty or existing notifications
      // This prevents "fake" notifications from appearing
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  // Initial fetch and periodic refresh
  useEffect(() => {
    if (isAuthenticated) {
      fetchNotifications();
      
      // Refresh every 30 seconds
      const interval = setInterval(fetchNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, fetchNotifications]);

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId) => {
    try {
      await api.put(`/notifications/${notificationId}/read`);
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
    
    setNotifications(prev => 
      prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    try {
      await api.put('/notifications/read-all');
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
    
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  }, []);

  // Delete notification
  const deleteNotification = useCallback(async (notificationId) => {
    try {
      await api.delete(`/notifications/${notificationId}`);
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
    
    setNotifications(prev => {
      const notification = prev.find(n => n.id === notificationId);
      if (notification && !notification.read) {
        setUnreadCount(c => Math.max(0, c - 1));
      }
      return prev.filter(n => n.id !== notificationId);
    });
  }, []);

  // Clear all notifications
  const clearAll = useCallback(async () => {
    try {
      await api.delete('/notifications/clear-all');
      setNotifications([]);
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to clear notifications:', error);
      // Still clear locally even if API fails
      setNotifications([]);
      setUnreadCount(0);
    }
  }, []);

  // Add new notification (for local use)
  const addNotification = useCallback((notification) => {
    const createdAt = new Date().toISOString();
    const newNotification = {
      id: Date.now().toString(),
      read: false,
      created_at: createdAt,
      ...notification
    };
    
    setNotifications(prev => [newNotification, ...prev]);
    setUnreadCount(prev => prev + 1);
    
    return newNotification;
  }, []);

  // State to trigger re-render for timestamp updates
  const [, setTimestampTick] = useState(0);
  
  // Update timestamps every minute
  useEffect(() => {
    const timestampInterval = setInterval(() => {
      setTimestampTick(tick => tick + 1);
    }, 60000); // Update every minute
    
    return () => clearInterval(timestampInterval);
  }, []);

  // Compute notifications with dynamic timestamps
  const notificationsWithTime = notifications.map(n => ({
    ...n,
    time: getRelativeTime(n.created_at)
  }));

  const value = {
    notifications: notificationsWithTime,
    unreadCount,
    loading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
    addNotification
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  // Return safe fallback if context is null (not inside provider)
  if (!context) {
    return {
      notifications: [],
      unreadCount: 0,
      loading: false,
      fetchNotifications: () => {},
      markAsRead: () => {},
      markAllAsRead: () => {},
      deleteNotification: () => {},
      clearAll: () => {},
      addNotification: () => {}
    };
  }
  return context;
}

export default NotificationContext;
