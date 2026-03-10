import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import {
  Bell, Megaphone, RefreshCw, Calendar, User, Check, Trash2,
  CheckCheck, Info, AlertTriangle, Gift, CreditCard, Settings, X
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useNotifications, NOTIFICATION_TYPES } from '../../contexts/NotificationContext';
import api from '../../api/client';
import { formatDistanceToNow } from 'date-fns';

const getNotificationIcon = (type) => {
  const icons = {
    [NOTIFICATION_TYPES.INFO]: { icon: Info, color: 'text-blue-500', bg: 'bg-blue-100' },
    [NOTIFICATION_TYPES.SUCCESS]: { icon: Check, color: 'text-green-500', bg: 'bg-green-100' },
    [NOTIFICATION_TYPES.WARNING]: { icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-100' },
    [NOTIFICATION_TYPES.ERROR]: { icon: X, color: 'text-red-500', bg: 'bg-red-100' },
    [NOTIFICATION_TYPES.PROMO]: { icon: Gift, color: 'text-purple-500', bg: 'bg-purple-100' },
    [NOTIFICATION_TYPES.BOOKING]: { icon: Calendar, color: 'text-cyan-500', bg: 'bg-cyan-100' },
    [NOTIFICATION_TYPES.PAYMENT]: { icon: CreditCard, color: 'text-emerald-500', bg: 'bg-emerald-100' },
    [NOTIFICATION_TYPES.SYSTEM]: { icon: Settings, color: 'text-slate-500', bg: 'bg-slate-100' },
    'operator_alert': { icon: Megaphone, color: 'text-blue-500', bg: 'bg-blue-100' },
    'ticket_reply': { icon: Info, color: 'text-cyan-500', bg: 'bg-cyan-100' },
    'promotion_pending': { icon: Gift, color: 'text-purple-500', bg: 'bg-purple-100' },
    'promotion': { icon: Gift, color: 'text-purple-500', bg: 'bg-purple-100' },
  };
  return icons[type] || icons[NOTIFICATION_TYPES.INFO];
};

const getActionUrl = (notification) => {
  if (notification.action_url) return notification.action_url;
  const type = notification.type || notification.source || '';
  if (type === 'operator_alert') return null; // Already on messages page
  if (type === 'promotion_pending') return '/admin/validation';
  if (type === 'booking' || type === 'order') return '/orders';
  if (type === 'payment') return '/orders';
  if (type === 'ticket_reply' || type === 'support') return '/support';
  return null;
};

export default function MessagesTab() {
  const navigate = useNavigate();
  const [subTab, setSubTab] = useState('alerts');
  const [alerts, setAlerts] = useState([]);
  const [alertsLoading, setAlertsLoading] = useState(true);

  const {
    notifications, unreadCount, loading: notifLoading,
    markAsRead, markAllAsRead, deleteNotification, clearAll, fetchNotifications
  } = useNotifications();

  const fetchAlerts = useCallback(async () => {
    try {
      setAlertsLoading(true);
      const res = await api.get('/subscriptions/user-alerts');
      // Only show alerts, not promotions
      const allItems = res.data?.alerts || [];
      setAlerts(allItems.filter(a => a.type === 'alert'));
    } catch (err) {
      console.error('Failed to fetch alerts:', err);
    } finally {
      setAlertsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
    fetchNotifications();
  }, [fetchAlerts, fetchNotifications]);

  const formatTime = (dateString) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return dateString || '';
    }
  };

  const handleNotificationClick = (notification) => {
    if (!notification.read) markAsRead(notification.id);
    const url = getActionUrl(notification);
    if (url) navigate(url);
  };

  return (
    <div className="space-y-4">
      <Tabs value={subTab} onValueChange={setSubTab}>
        <TabsList className="bg-slate-100 p-1 rounded-lg">
          <TabsTrigger value="alerts" className="rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm text-sm" data-testid="messages-alerts-tab">
            <Megaphone className="h-4 w-4 mr-1.5" /> Alerts
          </TabsTrigger>
          <TabsTrigger value="notifications" className="rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm text-sm" data-testid="messages-notifications-tab">
            <Bell className="h-4 w-4 mr-1.5" /> Notifications
            {unreadCount > 0 && (
              <Badge className="ml-1.5 bg-red-100 text-red-600 text-xs px-1.5">{unreadCount}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Alerts Sub-Tab */}
        <TabsContent value="alerts" className="mt-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-slate-500">Alerts from operators you follow</p>
            <Button variant="outline" size="sm" onClick={fetchAlerts} disabled={alertsLoading} data-testid="alerts-refresh-btn">
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${alertsLoading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
          </div>
          <Card>
            <CardContent className="p-0">
              {alertsLoading ? (
                <div className="p-8 text-center">
                  <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-[#082c59] mx-auto" />
                  <p className="text-slate-500 mt-2 text-sm">Loading alerts...</p>
                </div>
              ) : alerts.length === 0 ? (
                <div className="p-8 text-center" data-testid="alerts-empty-state">
                  <Megaphone className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                  <h3 className="font-semibold text-slate-700 mb-1">No alerts yet</h3>
                  <p className="text-sm text-slate-500">Subscribe to operators to receive their alerts.</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate('/settings')} data-testid="manage-subs-btn">
                    Manage Subscriptions
                  </Button>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {alerts.map((item) => (
                    <div key={item.id} className="p-4 hover:bg-slate-50 transition-colors" data-testid={`alert-item-${item.id}`}>
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                          <Megaphone className="h-4 w-4 text-blue-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-slate-900 text-sm">{item.title}</h4>
                          <p className="text-sm text-slate-600 mt-0.5">{item.message}</p>
                          <div className="flex items-center gap-3 text-xs text-slate-400 mt-1.5">
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" /> {item.operator_name || 'Operator'}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" /> {formatTime(item.created_at)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Sub-Tab */}
        <TabsContent value="notifications" className="mt-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-slate-500">
              {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'}
            </p>
            <div className="flex gap-2">
              {unreadCount > 0 && (
                <Button variant="outline" size="sm" onClick={markAllAsRead} data-testid="mark-all-read-btn">
                  <CheckCheck className="h-3.5 w-3.5 mr-1.5" /> Mark all read
                </Button>
              )}
              {notifications.length > 0 && (
                <Button variant="outline" size="sm" onClick={clearAll} className="text-red-600 hover:text-red-700 hover:bg-red-50" data-testid="clear-all-btn">
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Clear all
                </Button>
              )}
            </div>
          </div>
          <Card>
            <CardContent className="p-0">
              {notifLoading ? (
                <div className="p-8 text-center">
                  <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-[#082c59] mx-auto" />
                  <p className="text-slate-500 mt-2 text-sm">Loading...</p>
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-8 text-center">
                  <Bell className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                  <h3 className="font-semibold text-slate-700 mb-1">No notifications</h3>
                  <p className="text-sm text-slate-500">Check back later for updates.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {notifications.map((notification) => {
                    const { icon: Icon, color, bg } = getNotificationIcon(notification.type);
                    const actionUrl = getActionUrl(notification);
                    return (
                      <div
                        key={notification.id}
                        data-testid={`notification-item-${notification.id}`}
                        className={`p-4 flex items-start gap-3 hover:bg-slate-50 transition-colors ${
                          !notification.read ? 'bg-blue-50/50' : ''
                        } ${actionUrl ? 'cursor-pointer' : ''}`}
                        onClick={() => handleNotificationClick(notification)}
                      >
                        <div className={`w-9 h-9 rounded-full ${bg} flex items-center justify-center flex-shrink-0`}>
                          <Icon className={`h-4 w-4 ${color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className={`font-semibold text-sm ${!notification.read ? 'text-[#082c59]' : 'text-slate-900'}`}>
                              {notification.title}
                            </h4>
                            {!notification.read && <Badge className="bg-[#082c59] text-white text-[10px]">New</Badge>}
                          </div>
                          <p className="text-sm text-slate-600 mt-0.5 line-clamp-2">{notification.message}</p>
                          <div className="flex items-center justify-between mt-1.5">
                            <span className="text-xs text-slate-400">{notification.time || formatTime(notification.created_at)}</span>
                            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                              {!notification.read && (
                                <Button variant="ghost" size="sm" onClick={() => markAsRead(notification.id)} className="h-7 text-xs gap-1">
                                  <Check className="h-3 w-3" /> Read
                                </Button>
                              )}
                              <Button variant="ghost" size="sm" onClick={() => deleteNotification(notification.id)} className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50">
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
