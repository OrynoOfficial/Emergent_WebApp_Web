import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { 
  Bell, Megaphone, Gift, ArrowLeft, RefreshCw, 
  Calendar, User, Tag, ExternalLink
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { formatDistanceToNow } from 'date-fns';

export default function Alerts() {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  const fetchAlerts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/subscriptions/user-alerts');
      setAlerts(res.data?.alerts || []);
      setTotal(res.data?.total || 0);
    } catch (err) {
      console.error('Failed to fetch alerts:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const formatTime = (dateString) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return dateString || '';
    }
  };

  const getAlertStyle = (item) => {
    if (item.type === 'promotion') {
      return { icon: Gift, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200', badge: 'Promotion', badgeClass: 'bg-purple-100 text-purple-700' };
    }
    return { icon: Megaphone, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', badge: 'Alert', badgeClass: 'bg-blue-100 text-blue-700' };
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} data-testid="alerts-back-btn">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900" data-testid="alerts-page-title">Messages & Alerts</h1>
            <p className="text-slate-600">Alerts and promotions from operators you follow</p>
          </div>
        </div>
        <Button variant="outline" onClick={fetchAlerts} disabled={loading} data-testid="alerts-refresh-btn">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <Megaphone className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900" data-testid="alerts-count">
                  {alerts.filter(a => a.type === 'alert').length}
                </p>
                <p className="text-sm text-slate-500">Alerts</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                <Gift className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900" data-testid="promos-count">
                  {alerts.filter(a => a.type === 'promotion').length}
                </p>
                <p className="text-sm text-slate-500">Promotions</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-[#082c59]" />
            All Messages ({total})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#082c59] mx-auto" />
              <p className="text-slate-500 mt-2">Loading alerts...</p>
            </div>
          ) : alerts.length === 0 ? (
            <div className="p-8 text-center" data-testid="alerts-empty-state">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <Megaphone className="h-8 w-8 text-slate-400" />
              </div>
              <h3 className="font-semibold text-slate-700 mb-1">No alerts yet</h3>
              <p className="text-sm text-slate-500">Subscribe to operators to receive their alerts and promotions.</p>
              <Button variant="outline" className="mt-4" onClick={() => navigate('/settings')} data-testid="manage-subs-btn">
                Manage Subscriptions
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {alerts.map((item) => {
                const style = getAlertStyle(item);
                const Icon = style.icon;

                return (
                  <div
                    key={item.id}
                    className={`p-4 hover:bg-slate-50 transition-colors`}
                    data-testid={`alert-item-${item.id}`}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`w-10 h-10 rounded-full ${style.bg} flex items-center justify-center flex-shrink-0`}>
                        <Icon className={`h-5 w-5 ${style.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-semibold text-slate-900">{item.title}</h4>
                            <Badge className={`text-xs ${style.badgeClass}`}>{style.badge}</Badge>
                          </div>
                        </div>
                        <p className="text-sm text-slate-600 mb-2">{item.message}</p>
                        <div className="flex items-center gap-4 text-xs text-slate-400 flex-wrap">
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {item.operator_name || 'Unknown operator'}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatTime(item.created_at)}
                          </span>
                          {item.promotion_type && item.promotion_type !== 'general' && (
                            <span className="flex items-center gap-1">
                              <Tag className="h-3 w-3" />
                              {item.promotion_type}
                            </span>
                          )}
                          {item.discount_value && (
                            <Badge variant="outline" className="text-xs text-green-600 border-green-300">
                              {item.discount_value}
                            </Badge>
                          )}
                          {item.valid_until && (
                            <span className="text-xs text-amber-600">
                              Valid until {new Date(item.valid_until).toLocaleDateString()}
                            </span>
                          )}
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
    </div>
  );
}
