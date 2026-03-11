import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { 
  Bell, Check, Trash2, CheckCheck, Package, CreditCard, 
  Info, AlertTriangle, Gift, Calendar, Settings, X, ExternalLink, Megaphone
} from 'lucide-react';
import { useNotifications, NOTIFICATION_TYPES } from '../contexts/NotificationContext';
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
    [NOTIFICATION_TYPES.SYSTEM]: { icon: Settings, color: 'text-slate-500', bg: 'bg-slate-100' }
  };
  return icons[type] || icons[NOTIFICATION_TYPES.INFO];
};

export default function Notifications() {
  const navigate = useNavigate();
  const { 
    notifications, 
    unreadCount, 
    loading,
    markAsRead, 
    markAllAsRead, 
    deleteNotification, 
    clearAll,
    fetchNotifications 
  } = useNotifications();

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const formatTime = (dateString) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return dateString;
    }
  };

  const getActionUrl = (notification) => {
    // Use action_url from backend if available
    if (notification.action_url) return notification.action_url;
    // Fallback mapping by type/source
    const type = notification.type || notification.source || '';
    if (type === 'operator_alert' || type === 'promotion' || type === 'operator_promotion') return '/ratings?tab=messages&subtab=alerts';
    if (type === 'promotion_pending') return '/admin/validation';
    if (type === 'booking' || type === 'order') return '/orders';
    if (type === 'payment') return '/orders';
    if (type === 'ticket_reply' || type === 'support') return '/support';
    if (type === 'system') return '/ratings?tab=messages&subtab=notifications';
    return null;
  };

  const handleNotificationClick = (notification) => {
    const url = getActionUrl(notification);
    if (!notification.read) markAsRead(notification.id);
    if (url) navigate(url);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
          <p className="text-slate-600">
            {unreadCount > 0 
              ? `You have ${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}`
              : 'All caught up!'}
          </p>
        </div>
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <Button 
              variant="outline" 
              onClick={markAllAsRead}
              className="gap-2"
            >
              <CheckCheck className="h-4 w-4" />
              Mark all read
            </Button>
          )}
          {notifications.length > 0 && (
            <Button 
              variant="outline" 
              onClick={clearAll}
              className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
              Clear all
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <Bell className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{notifications.length}</p>
                <p className="text-sm text-slate-500">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                <Info className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{unreadCount}</p>
                <p className="text-sm text-slate-500">Unread</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <Check className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{notifications.length - unreadCount}</p>
                <p className="text-sm text-slate-500">Read</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Notifications List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-[#082c59]" />
            All Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#082c59] mx-auto"></div>
              <p className="text-slate-500 mt-2">Loading notifications...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <Bell className="h-8 w-8 text-slate-400" />
              </div>
              <h3 className="font-semibold text-slate-700 mb-1">No notifications</h3>
              <p className="text-sm text-slate-500">You're all caught up! Check back later for updates.</p>
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
                    className={`p-4 flex items-start gap-4 hover:bg-slate-50 transition-colors ${
                      !notification.read ? 'bg-blue-50/50' : ''
                    } ${actionUrl ? 'cursor-pointer' : ''}`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className={`w-10 h-10 rounded-full ${bg} flex items-center justify-center flex-shrink-0`}>
                      <Icon className={`h-5 w-5 ${color}`} />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className={`font-semibold text-slate-900 ${!notification.read ? 'text-[#082c59]' : ''}`}>
                            {notification.title}
                          </h4>
                          <p className="text-sm text-slate-600 mt-0.5 line-clamp-2">
                            {notification.message}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {!notification.read && (
                            <Badge className="bg-[#082c59] text-white text-xs">New</Badge>
                          )}
                          {actionUrl && (
                            <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-slate-400">
                          {notification.time || formatTime(notification.created_at)}
                        </span>
                        
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          {!notification.read && (
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => markAsRead(notification.id)}
                              className="h-8 text-xs gap-1"
                              data-testid={`mark-read-${notification.id}`}
                            >
                              <Check className="h-3 w-3" />
                              Mark read
                            </Button>
                          )}
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => deleteNotification(notification.id)}
                            className="h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                            data-testid={`delete-notification-${notification.id}`}
                          >
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

      {/* Notification Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-[#082c59]" />
            Notification Preferences
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-cyan-600" />
                <div>
                  <p className="font-medium text-slate-900">Booking Updates</p>
                  <p className="text-sm text-slate-500">Receive updates about your bookings</p>
                </div>
              </div>
              <input type="checkbox" defaultChecked className="h-5 w-5 rounded border-slate-300 text-[#082c59] focus:ring-[#082c59]" />
            </div>
            
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-3">
                <CreditCard className="h-5 w-5 text-emerald-600" />
                <div>
                  <p className="font-medium text-slate-900">Payment Alerts</p>
                  <p className="text-sm text-slate-500">Get notified about payments and refunds</p>
                </div>
              </div>
              <input type="checkbox" defaultChecked className="h-5 w-5 rounded border-slate-300 text-[#082c59] focus:ring-[#082c59]" />
            </div>
            
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Gift className="h-5 w-5 text-purple-600" />
                <div>
                  <p className="font-medium text-slate-900">Promotions & Offers</p>
                  <p className="text-sm text-slate-500">Receive special deals and discounts</p>
                </div>
              </div>
              <input type="checkbox" defaultChecked className="h-5 w-5 rounded border-slate-300 text-[#082c59] focus:ring-[#082c59]" />
            </div>
            
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Settings className="h-5 w-5 text-slate-600" />
                <div>
                  <p className="font-medium text-slate-900">System Updates</p>
                  <p className="text-sm text-slate-500">Important system and security notifications</p>
                </div>
              </div>
              <input type="checkbox" defaultChecked className="h-5 w-5 rounded border-slate-300 text-[#082c59] focus:ring-[#082c59]" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
