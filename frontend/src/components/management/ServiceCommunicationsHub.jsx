import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  MessageSquare, Bell, Send, Info, Calendar, RefreshCw,
  AlertTriangle, CheckCircle, Megaphone, AlertCircle,
  Headphones, Video, FileText, Check, Clock, Building2
} from 'lucide-react';
import api from '@/api/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

// Notification Type Icons
const getNotificationIcon = (type) => {
  const icons = {
    booking: <Calendar className="h-4 w-4 text-blue-500" />,
    payment: <CheckCircle className="h-4 w-4 text-green-500" />,
    alert: <AlertTriangle className="h-4 w-4 text-amber-500" />,
    system: <Info className="h-4 w-4 text-slate-500" />,
    support: <MessageSquare className="h-4 w-4 text-purple-500" />,
    announcement: <Megaphone className="h-4 w-4 text-blue-600" />,
    default: <Bell className="h-4 w-4 text-slate-400" />
  };
  return icons[type] || icons.default;
};

/**
 * ServiceCommunicationsHub - Reusable Communications component for all Service Management pages
 * 
 * @param {string} serviceType - The service type (Hotels, Travel, Restaurants, etc.)
 * @param {string} serviceTag - The tag to use for support tickets
 * @param {React.ReactNode} serviceIcon - The icon component to use for the service
 * @param {string} primaryColor - The primary color for the service (e.g., 'blue', 'orange', 'purple')
 * @param {function} onAnnouncementSend - Custom handler for announcements (optional)
 * @param {function} onAlertCreate - Custom handler for alerts (optional)
 */
export default function ServiceCommunicationsHub({ 
  serviceType = "General",
  serviceTag = "general",
  serviceIcon = <MessageSquare className="h-5 w-5" />,
  primaryColor = "blue",
  onAnnouncementSend,
  onAlertCreate
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // State
  const [notifications, setNotifications] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [operators, setOperators] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Announcement & Alert state
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementText, setAnnouncementText] = useState('');
  const [alertTitle, setAlertTitle] = useState('');
  const [alertText, setAlertText] = useState('');
  
  // Support Dialog state
  const [showSupportDialog, setShowSupportDialog] = useState(false);
  const [selectedOperator, setSelectedOperator] = useState(null);
  const [supportSubject, setSupportSubject] = useState('');
  const [supportMessage, setSupportMessage] = useState('');
  const [supportPriority, setSupportPriority] = useState('normal');
  const [submittingTicket, setSubmittingTicket] = useState(false);
  
  // Meeting Dialog state
  const [showMeetingDialog, setShowMeetingDialog] = useState(false);
  const [meetingTitle, setMeetingTitle] = useState('');
  const [meetingDate, setMeetingDate] = useState('');
  const [meetingTime, setMeetingTime] = useState('');
  const [meetingDescription, setMeetingDescription] = useState('');
  
  // Determine if user is admin/super_admin
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const isOperator = user?.role === 'operator';
  
  // Load communications data
  const loadCommunications = useCallback(async () => {
    setLoading(true);
    try {
      // Load recent communications (notifications + announcements + alerts)
      const recentRes = await api.get(`/communications/recent?service_type=${serviceTag}&limit=10`);
      const items = recentRes.data.items || [];
      setNotifications(items.filter(i => i.comm_type === 'notification' || i.comm_type === 'announcement'));
      setAlerts(items.filter(i => i.comm_type === 'alert'));
    } catch (error) {
      console.error('Failed to load communications:', error);
      // Fallback: load notifications separately
      try {
        const notifRes = await api.get('/notifications/?limit=10');
        setNotifications(notifRes.data.notifications || []);
      } catch { setNotifications([]); }
      setAlerts([]);
    }
    
    // Load operators for support dialog (admin/super_admin only)
    if (isAdmin) {
      try {
        const opRes = await api.get(`/support-tickets/operators-by-service?service_type=${serviceType}`);
        setOperators(opRes.data.operators || []);
      } catch {
        setOperators([]);
      }
    }
    
    setLoading(false);
  }, [serviceTag, serviceType, isAdmin]);
  
  useEffect(() => {
    loadCommunications();
  }, [loadCommunications]);
  
  // Set default operator for operators
  useEffect(() => {
    if (isOperator && user?.operator_id) {
      setSelectedOperator({
        id: user.operator_id,
        name: user.operator_name || 'My Operator'
      });
    }
  }, [isOperator, user]);
  
  // Send announcement
  const sendAnnouncement = async () => {
    if (!announcementTitle.trim() || !announcementText.trim()) {
      toast.error('Please fill in both title and message');
      return;
    }
    
    if (onAnnouncementSend) {
      await onAnnouncementSend(announcementTitle, announcementText);
    } else {
      try {
        await api.post(`/communications/announcements?title=${encodeURIComponent(announcementTitle)}&message=${encodeURIComponent(announcementText)}&service_type=${serviceTag}`);
        toast.success('Announcement sent successfully');
        loadCommunications();
      } catch (error) {
        toast.error('Failed to send announcement');
      }
    }
    
    setAnnouncementTitle('');
    setAnnouncementText('');
  };
  
  // Create alert
  const createAlert = async () => {
    if (!alertTitle.trim() || !alertText.trim()) {
      toast.error('Please fill in both title and description');
      return;
    }
    
    if (onAlertCreate) {
      await onAlertCreate(alertTitle, alertText);
    } else {
      try {
        await api.post(`/communications/alerts?title=${encodeURIComponent(alertTitle)}&message=${encodeURIComponent(alertText)}&service_type=${serviceTag}`);
        toast.success('Alert created successfully');
        loadCommunications();
      } catch (error) {
        toast.error('Failed to create alert');
      }
    }
    
    setAlertTitle('');
    setAlertText('');
  };
  
  // Resolve alert
  const resolveAlert = async (alertId) => {
    try {
      await api.put(`/communications/alerts/${alertId}/resolve`);
      toast.success('Alert resolved');
      loadCommunications();
    } catch (error) {
      toast.error('Failed to resolve alert');
    }
  };
  
  // Submit support ticket
  const submitSupportTicket = async () => {
    if (!supportSubject.trim() || !supportMessage.trim()) {
      toast.error('Please fill in subject and message');
      return;
    }
    
    // For admin/super_admin, operator selection is required
    if (isAdmin && !selectedOperator) {
      toast.error('Please select an operator');
      return;
    }
    
    setSubmittingTicket(true);
    try {
      await api.post('/support-tickets/', {
        subject: supportSubject,
        description: supportMessage,
        category: 'operator',
        priority: supportPriority,
        source: 'management_portal',
        service_tag: serviceType,
        operator_id: selectedOperator?.id || user?.operator_id,
        operator_name: selectedOperator?.name || user?.operator_name
      });
      
      toast.success('Support ticket submitted successfully');
      setShowSupportDialog(false);
      setSupportSubject('');
      setSupportMessage('');
      setSupportPriority('normal');
      if (isAdmin) setSelectedOperator(null);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to submit support ticket');
    } finally {
      setSubmittingTicket(false);
    }
  };
  
  // Schedule meeting
  const scheduleMeeting = async () => {
    if (!meetingTitle.trim() || !meetingDate || !meetingTime) {
      toast.error('Please fill in all meeting details');
      return;
    }
    
    try {
      await api.post('/notifications/', {
        title: `Meeting: ${meetingTitle}`,
        message: `Scheduled for ${meetingDate} at ${meetingTime}. ${meetingDescription}`,
        type: 'meeting',
        service_type: serviceTag
      });
      
      toast.success('Meeting scheduled successfully');
      setShowMeetingDialog(false);
      setMeetingTitle('');
      setMeetingDate('');
      setMeetingTime('');
      setMeetingDescription('');
    } catch (error) {
      toast.success('Meeting scheduled (notification pending)');
      setShowMeetingDialog(false);
    }
  };
  
  // Get color classes based on primary color
  const getColorClasses = (variant = 'bg') => {
    const colorMap = {
      blue: { bg: 'bg-blue-50', border: 'border-blue-100', text: 'text-blue-800', icon: 'text-blue-600' },
      orange: { bg: 'bg-orange-50', border: 'border-orange-100', text: 'text-orange-800', icon: 'text-orange-600' },
      purple: { bg: 'bg-purple-50', border: 'border-purple-100', text: 'text-purple-800', icon: 'text-purple-600' },
      green: { bg: 'bg-green-50', border: 'border-green-100', text: 'text-green-800', icon: 'text-green-600' },
      amber: { bg: 'bg-amber-50', border: 'border-amber-100', text: 'text-amber-800', icon: 'text-amber-600' },
      red: { bg: 'bg-red-50', border: 'border-red-100', text: 'text-red-800', icon: 'text-red-600' },
      indigo: { bg: 'bg-indigo-50', border: 'border-indigo-100', text: 'text-indigo-800', icon: 'text-indigo-600' },
      pink: { bg: 'bg-pink-50', border: 'border-pink-100', text: 'text-pink-800', icon: 'text-pink-600' },
      teal: { bg: 'bg-teal-50', border: 'border-teal-100', text: 'text-teal-800', icon: 'text-teal-600' }
    };
    return colorMap[primaryColor] || colorMap.blue;
  };
  
  const colors = getColorClasses();
  
  return (
    <div className="space-y-6">
      {/* Top Row: Notifications & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Notifications */}
        <Card className="shadow-lg">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Bell className={`h-5 w-5 ${colors.icon}`} />
                Recent Notifications
              </span>
              <Badge variant="outline" className="text-xs">
                {notifications.filter(n => !n.is_read).length} unread
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[280px] pr-4">
              <div className="space-y-3">
                {notifications.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <Bell className="h-10 w-10 mx-auto text-slate-300 mb-2" />
                    <p>No notifications yet</p>
                  </div>
                ) : (
                  notifications.map((notif, i) => (
                    <div 
                      key={notif.id || i} 
                      className={`p-3 rounded-lg border transition-colors hover:bg-slate-50 ${
                        !notif.is_read ? `${colors.bg} ${colors.border}` : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {getNotificationIcon(notif.type)}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{notif.title}</p>
                          <p className="text-xs text-slate-600 line-clamp-2 mt-0.5">{notif.message}</p>
                          <p className="text-xs text-slate-400 mt-1">
                            {notif.created_at ? new Date(notif.created_at).toLocaleString() : 'Just now'}
                          </p>
                        </div>
                        {!notif.is_read && <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className={`h-5 w-5 ${colors.icon}`} />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Send Announcement */}
            <div className={`space-y-2 p-3 ${colors.bg} rounded-lg border ${colors.border}`}>
              <Label className={`text-sm font-medium flex items-center gap-2 ${colors.text}`}>
                <Megaphone className="h-4 w-4" /> Send Announcement
              </Label>
              <Input 
                placeholder="Title..." 
                value={announcementTitle} 
                onChange={(e) => setAnnouncementTitle(e.target.value)} 
                className="bg-white" 
              />
              <div className="flex gap-2">
                <Input 
                  placeholder="Message..." 
                  value={announcementText} 
                  onChange={(e) => setAnnouncementText(e.target.value)} 
                  className="bg-white" 
                />
                <Button onClick={sendAnnouncement} className="bg-blue-600 hover:bg-blue-700 px-3">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Create Alert */}
            <div className="space-y-2 p-3 bg-amber-50 rounded-lg border border-amber-100">
              <Label className="text-sm font-medium flex items-center gap-2 text-amber-800">
                <AlertTriangle className="h-4 w-4" /> Create Alert
              </Label>
              <Input 
                placeholder="Alert title..." 
                value={alertTitle} 
                onChange={(e) => setAlertTitle(e.target.value)} 
                className="bg-white" 
              />
              <div className="flex gap-2">
                <Input 
                  placeholder="Description..." 
                  value={alertText} 
                  onChange={(e) => setAlertText(e.target.value)} 
                  className="bg-white" 
                />
                <Button onClick={createAlert} variant="outline" className="text-amber-600 border-amber-300 hover:bg-amber-100 px-3">
                  <Bell className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="grid grid-cols-2 gap-2 pt-2">
              <Button 
                variant="outline" 
                className="justify-start gap-2 hover:bg-slate-50" 
                onClick={() => setShowSupportDialog(true)}
              >
                <Headphones className="h-4 w-4 text-purple-500" /> Contact Support
              </Button>
              <Button 
                variant="outline" 
                className="justify-start gap-2 hover:bg-slate-50" 
                onClick={() => setShowMeetingDialog(true)}
              >
                <Video className="h-4 w-4 text-indigo-500" /> Schedule Meeting
              </Button>
              <Button 
                variant="outline" 
                className="justify-start gap-2 hover:bg-slate-50" 
                onClick={() => navigate('/reports')}
              >
                <FileText className="h-4 w-4 text-slate-500" /> View Reports
              </Button>
              <Button 
                variant="outline" 
                className="justify-start gap-2 hover:bg-slate-50" 
                onClick={loadCommunications}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 text-slate-500 ${loading ? 'animate-spin' : ''}`} /> Refresh
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Alerts */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-600" />
            Active Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          {alerts.filter(a => !a.is_resolved).length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <CheckCircle className="h-12 w-12 mx-auto text-green-300 mb-2" />
              <p>No active alerts - All clear!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.filter(a => !a.is_resolved).map((alert, i) => (
                <div key={alert.id || i} className="flex items-center justify-between p-4 bg-amber-50 rounded-lg border border-amber-200">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                    <div>
                      <p className="font-medium text-amber-900">{alert.title}</p>
                      <p className="text-sm text-amber-700">{alert.message}</p>
                    </div>
                  </div>
                  <Button size="sm" onClick={() => resolveAlert(alert.id)} className="bg-green-600 hover:bg-green-700">
                    <Check className="h-4 w-4 mr-1" /> Resolve
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Support Dialog */}
      <Dialog open={showSupportDialog} onOpenChange={setShowSupportDialog}>
        <DialogContent className="bg-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Headphones className="h-5 w-5 text-purple-600" />
              Contact Support - {serviceType}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Operator Selection - Above Subject */}
            <div>
              <Label className="flex items-center gap-2">
                <Building2 className="h-4 w-4" /> Operator *
              </Label>
              {isOperator ? (
                // For operators, show their operator (read-only)
                <div className="mt-1.5 p-3 bg-slate-100 rounded-lg border">
                  <p className="font-medium text-slate-800">{user?.operator_name || 'My Operator'}</p>
                  <p className="text-xs text-slate-500">Your associated operator</p>
                </div>
              ) : isAdmin ? (
                // For admin/super_admin, show dropdown of operators
                <Select 
                  value={selectedOperator?.id || ''} 
                  onValueChange={(id) => {
                    const op = operators.find(o => o.id === id);
                    setSelectedOperator(op ? { id: op.id, name: op.name } : null);
                  }}
                >
                  <SelectTrigger className="mt-1.5 bg-white">
                    <SelectValue placeholder="Select an operator..." />
                  </SelectTrigger>
                  <SelectContent className="bg-white max-h-60">
                    <ScrollArea className="max-h-[200px]">
                      {operators.length === 0 ? (
                        <div className="p-3 text-center text-slate-500 text-sm">
                          No operators found for {serviceType}
                        </div>
                      ) : (
                        operators.map(op => (
                          <SelectItem key={op.id} value={op.id}>
                            <div className="flex flex-col">
                              <span>{op.name}</span>
                              {op.email && <span className="text-xs text-slate-500">{op.email}</span>}
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </ScrollArea>
                  </SelectContent>
                </Select>
              ) : (
                <p className="mt-1.5 text-sm text-slate-500">
                  Only operators and administrators can submit support tickets from management pages.
                </p>
              )}
            </div>
            
            <div>
              <Label>Subject *</Label>
              <Input 
                value={supportSubject} 
                onChange={(e) => setSupportSubject(e.target.value)} 
                placeholder="What do you need help with?" 
                className="mt-1.5" 
              />
            </div>
            
            <div>
              <Label>Priority</Label>
              <Select value={supportPriority} onValueChange={setSupportPriority}>
                <SelectTrigger className="mt-1.5 bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Message *</Label>
              <Textarea 
                value={supportMessage} 
                onChange={(e) => setSupportMessage(e.target.value)} 
                placeholder="Describe your issue in detail..." 
                rows={4} 
                className="mt-1.5" 
              />
            </div>
            
            {/* Service Tag Info */}
            <div className={`p-3 ${colors.bg} rounded-lg border ${colors.border}`}>
              <div className="flex items-center gap-2 text-sm">
                {serviceIcon}
                <span className={colors.text}>
                  This ticket will be tagged as <strong>{serviceType}</strong>
                </span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSupportDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={submitSupportTicket} 
              className="bg-purple-600 hover:bg-purple-700"
              disabled={submittingTicket || (!isOperator && !isAdmin) || (isAdmin && !selectedOperator)}
            >
              {submittingTicket ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit Ticket'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Meeting Dialog */}
      <Dialog open={showMeetingDialog} onOpenChange={setShowMeetingDialog}>
        <DialogContent className="bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Video className="h-5 w-5 text-indigo-600" />
              Schedule Meeting
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Meeting Title *</Label>
              <Input 
                value={meetingTitle} 
                onChange={(e) => setMeetingTitle(e.target.value)} 
                placeholder="Meeting title..." 
                className="mt-1.5" 
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Date *</Label>
                <Input 
                  type="date" 
                  value={meetingDate} 
                  onChange={(e) => setMeetingDate(e.target.value)} 
                  className="mt-1.5" 
                />
              </div>
              <div>
                <Label>Time *</Label>
                <Input 
                  type="time" 
                  value={meetingTime} 
                  onChange={(e) => setMeetingTime(e.target.value)} 
                  className="mt-1.5" 
                />
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea 
                value={meetingDescription} 
                onChange={(e) => setMeetingDescription(e.target.value)} 
                placeholder="Meeting details..." 
                rows={3} 
                className="mt-1.5" 
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMeetingDialog(false)}>
              Cancel
            </Button>
            <Button onClick={scheduleMeeting} className="bg-indigo-600 hover:bg-indigo-700">
              Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
