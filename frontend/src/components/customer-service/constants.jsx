import { Calendar, Briefcase, RefreshCw, Zap, AlertTriangle, MessageCircle, Building2, FileText, Inbox, Clock, Activity, CheckCircle, Archive } from 'lucide-react';

export const TICKET_CATEGORIES = ['booking', 'payment', 'refund', 'technical', 'complaint', 'inquiry', 'operator', 'general'];
export const TICKET_PRIORITIES = ['low', 'medium', 'high', 'urgent'];
export const TICKET_STATUSES = ['open', 'pending', 'in_progress', 'resolved', 'closed'];
export const USER_TYPES = ['customer', 'operator'];
export const CHART_COLORS = ['#3B82F6', '#8B5CF6', '#EC4899', '#F97316', '#10B981', '#06B6D4', '#EAB308', '#EF4444'];
export const ITEMS_PER_PAGE = 10;

// Status badge configuration
export const getStatusConfig = (status) => {
  const configs = {
    open: { bg: 'bg-blue-100', text: 'text-blue-700', icon: <Inbox className="w-3 h-3" /> },
    pending: { bg: 'bg-amber-100', text: 'text-amber-700', icon: <Clock className="w-3 h-3" /> },
    in_progress: { bg: 'bg-purple-100', text: 'text-purple-700', icon: <Activity className="w-3 h-3" /> },
    resolved: { bg: 'bg-green-100', text: 'text-green-700', icon: <CheckCircle className="w-3 h-3" /> },
    closed: { bg: 'bg-slate-100', text: 'text-slate-700', icon: <Archive className="w-3 h-3" /> }
  };
  return configs[status] || configs.open;
};

// Priority badge configuration
export const getPriorityConfig = (priority) => {
  const configs = {
    low: { bg: 'bg-slate-100', text: 'text-slate-700', dot: 'bg-slate-400' },
    medium: { bg: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-500' },
    high: { bg: 'bg-orange-100', text: 'text-orange-700', dot: 'bg-orange-500' },
    urgent: { bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500' }
  };
  return configs[priority] || configs.medium;
};

// Category icons mapping
export const getCategoryIcon = (category) => {
  const icons = {
    booking: <Calendar className="w-4 h-4" />,
    payment: <Briefcase className="w-4 h-4" />,
    refund: <RefreshCw className="w-4 h-4" />,
    technical: <Zap className="w-4 h-4" />,
    complaint: <AlertTriangle className="w-4 h-4" />,
    inquiry: <MessageCircle className="w-4 h-4" />,
    operator: <Building2 className="w-4 h-4" />,
    general: <FileText className="w-4 h-4" />
  };
  return icons[category] || icons.general;
};

// Time ago formatter
export const getTimeAgo = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};

// Stats card color classes
export const getColorClasses = (color) => {
  const colorClasses = {
    blue: "from-blue-500 to-blue-600",
    purple: "from-purple-500 to-purple-600",
    amber: "from-amber-500 to-amber-600",
    green: "from-green-500 to-green-600",
    red: "from-red-500 to-red-600",
    slate: "from-slate-500 to-slate-600"
  };
  return colorClasses[color] || colorClasses.blue;
};
