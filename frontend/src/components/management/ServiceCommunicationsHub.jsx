import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  MessageSquare, Bell, Send, Calendar, RefreshCw,
  AlertTriangle, CheckCircle, Megaphone, Star,
  Users, Tag, Clock, Ticket, ArrowRight, Trash2, Eye
} from 'lucide-react';
import api from '@/api/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { formatDate } from '@/utils/dateUtils';

export default function ServiceCommunicationsHub({
  serviceType = "General",
  serviceTag = "general",
  serviceIcon = <MessageSquare className="h-5 w-5" />,
  primaryColor = "blue",
}) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [supportTickets, setSupportTickets] = useState([]);
  const [recentReviews, setRecentReviews] = useState([]);
  const [subscriberCount, setSubscriberCount] = useState(0);
  const [promotions, setPromotions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showPromoDialog, setShowPromoDialog] = useState(false);
  const [promoForm, setPromoForm] = useState({ title: '', message: '', promotion_type: 'general', discount_value: '', valid_until: '' });
  const [submitting, setSubmitting] = useState(false);

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const isOperator = user?.role === 'operator';
  const operatorId = user?.operator_id;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Load support tickets for this operator
      const ticketRes = await api.get(`/support-tickets/?limit=5`).catch(() => ({ data: { tickets: [] } }));
      const tickets = (ticketRes.data?.tickets || []).slice(0, 5);
      setSupportTickets(tickets);

      // Load recent reviews for operator's services
      if (operatorId) {
        const ratingRes = await api.get(`/ratings/?entity_type=${serviceTag}&limit=5`).catch(() => ({ data: { ratings: [] } }));
        setRecentReviews(ratingRes.data?.ratings || []);
      }

      // Load subscriber count
      const subRes = await api.get('/subscriptions/operator-count').catch(() => ({ data: { count: 0 } }));
      setSubscriberCount(subRes.data?.count || 0);

      // Load promotions
      const promoRes = await api.get('/subscriptions/promotions?limit=10').catch(() => ({ data: { promotions: [] } }));
      setPromotions(promoRes.data?.promotions || []);
    } catch (err) {
      console.error('Failed to load communications data:', err);
    } finally {
      setLoading(false);
    }
  }, [serviceTag, operatorId]);

  useEffect(() => { loadData(); }, [loadData]);

  const createPromotion = async () => {
    if (!promoForm.title.trim() || !promoForm.message.trim()) {
      toast.error('Please fill in title and message');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post('/subscriptions/promotions', {
        ...promoForm,
        service_type: serviceTag,
        valid_until: promoForm.valid_until || null,
      });
      toast.success(`Promotion sent to ${res.data.notified_count} subscribers`);
      setShowPromoDialog(false);
      setPromoForm({ title: '', message: '', promotion_type: 'general', discount_value: '', valid_until: '' });
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create promotion');
    } finally {
      setSubmitting(false);
    }
  };

  const deletePromotion = async (id) => {
    try {
      await api.delete(`/subscriptions/promotions/${id}`);
      toast.success('Promotion deleted');
      loadData();
    } catch { toast.error('Failed to delete'); }
  };

  const colorMap = {
    blue: { gradient: 'from-blue-600 to-blue-700', light: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', accent: 'bg-blue-600' },
    orange: { gradient: 'from-orange-500 to-orange-600', light: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', accent: 'bg-orange-600' },
    purple: { gradient: 'from-purple-600 to-purple-700', light: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', accent: 'bg-purple-600' },
    green: { gradient: 'from-emerald-600 to-emerald-700', light: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', accent: 'bg-emerald-600' },
    red: { gradient: 'from-red-500 to-red-600', light: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', accent: 'bg-red-600' },
    pink: { gradient: 'from-pink-500 to-pink-600', light: 'bg-pink-50', border: 'border-pink-200', text: 'text-pink-700', accent: 'bg-pink-600' },
    teal: { gradient: 'from-teal-600 to-teal-700', light: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-700', accent: 'bg-teal-600' },
    amber: { gradient: 'from-amber-500 to-amber-600', light: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', accent: 'bg-amber-600' },
    indigo: { gradient: 'from-indigo-600 to-indigo-700', light: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700', accent: 'bg-indigo-600' },
  };
  const c = colorMap[primaryColor] || colorMap.blue;

  const promoTypeLabels = { general: 'General', discount: 'Discount', event: 'Event', new_service: 'New Service' };

  return (
    <div className="space-y-6" data-testid="communications-hub">
      {/* Header Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className={`bg-gradient-to-br ${c.gradient} text-white border-0 shadow-lg`}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/80 text-sm font-medium">Subscribers</p>
                <p className="text-3xl font-bold mt-1">{subscriberCount}</p>
                <p className="text-white/70 text-xs mt-1">Users following your services</p>
              </div>
              <div className="bg-white/20 rounded-2xl p-3">
                <Users className="h-7 w-7" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white border-0 shadow-lg">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-amber-100 text-sm font-medium">Open Tickets</p>
                <p className="text-3xl font-bold mt-1">{supportTickets.filter(t => t.status !== 'closed' && t.status !== 'resolved').length}</p>
                <p className="text-amber-200 text-xs mt-1">Awaiting your response</p>
              </div>
              <div className="bg-white/20 rounded-2xl p-3">
                <Ticket className="h-7 w-7" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-violet-500 to-violet-600 text-white border-0 shadow-lg">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-violet-100 text-sm font-medium">Promotions Sent</p>
                <p className="text-3xl font-bold mt-1">{promotions.length}</p>
                <p className="text-violet-200 text-xs mt-1">Alerts & offers to subscribers</p>
              </div>
              <div className="bg-white/20 rounded-2xl p-3">
                <Megaphone className="h-7 w-7" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Support Tickets */}
        <Card className="shadow-lg border-0">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Ticket className="h-5 w-5 text-amber-600" />
                Support Tickets
              </CardTitle>
              <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => navigate('/support')}>
                View All <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[260px]">
              {supportTickets.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                  <CheckCircle className="h-10 w-10 mb-2" />
                  <p className="text-sm">No open tickets</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {supportTickets.map((ticket, i) => (
                    <div key={ticket.id || i} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer" onClick={() => navigate('/support')}>
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        ticket.status === 'open' ? 'bg-amber-500' :
                        ticket.status === 'in_progress' ? 'bg-blue-500' :
                        ticket.status === 'resolved' ? 'bg-green-500' : 'bg-slate-400'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{ticket.subject}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {ticket.status?.replace('_', ' ')}
                          </Badge>
                          {ticket.priority && (
                            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${
                              ticket.priority === 'urgent' ? 'border-red-300 text-red-600' :
                              ticket.priority === 'high' ? 'border-amber-300 text-amber-600' : ''
                            }`}>{ticket.priority}</Badge>
                          )}
                        </div>
                      </div>
                      <Clock className="h-3 w-3 text-slate-400" />
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Recent Reviews */}
        <Card className="shadow-lg border-0">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Star className="h-5 w-5 text-yellow-500" />
                Recent Reviews
              </CardTitle>
              <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => navigate('/ratings')}>
                My Ratings <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[260px]">
              {recentReviews.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                  <Star className="h-10 w-10 mb-2" />
                  <p className="text-sm">No reviews yet</p>
                  <p className="text-xs mt-1">Reviews will appear here when users rate your services</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentReviews.map((review, i) => (
                    <div key={review.id || i} className="p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{review.user_name || 'Customer'}</p>
                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map(s => (
                            <Star key={s} className={`h-3 w-3 ${s <= (review.rating || 0) ? 'text-yellow-400 fill-yellow-400' : 'text-slate-200'}`} />
                          ))}
                        </div>
                      </div>
                      {review.review && <p className="text-xs text-slate-600 mt-1 line-clamp-2">{review.review}</p>}
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[10px] text-slate-400">{review.created_at ? formatDate(review.created_at) : ''}</span>
                        <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={() => navigate('/ratings')}>
                          Reply <ArrowRight className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Promotions / Alerts Section */}
      <Card className="shadow-lg border-0">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Megaphone className="h-5 w-5 text-violet-600" />
              Promotions & Alerts
              {subscriberCount > 0 && (
                <Badge variant="outline" className="text-xs ml-2">{subscriberCount} subscribers</Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={loadData}
                disabled={loading}
                className="gap-1"
              >
                <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
              </Button>
              {(isOperator || isAdmin) && (
                <Button
                  size="sm"
                  className={`${c.accent} hover:opacity-90 text-white gap-1`}
                  onClick={() => setShowPromoDialog(true)}
                  data-testid="create-promotion-btn"
                >
                  <Megaphone className="h-3 w-3" /> New Promotion
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {promotions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-slate-400">
              <Megaphone className="h-12 w-12 mb-3" />
              <p className="text-sm font-medium">No promotions yet</p>
              <p className="text-xs mt-1">Create a promotion to alert your subscribers about offers and news</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {promotions.map((promo) => (
                <div key={promo.id} className={`p-4 rounded-xl ${c.light} ${c.border} border relative group`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Badge className={`text-[10px] ${c.accent} text-white`}>
                        {promoTypeLabels[promo.promotion_type] || promo.promotion_type}
                      </Badge>
                      {promo.discount_value && (
                        <Badge variant="outline" className="text-[10px]">
                          <Tag className="h-2.5 w-2.5 mr-1" />{promo.discount_value}
                        </Badge>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-600"
                      onClick={() => deletePromotion(promo.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  <h4 className={`font-semibold text-sm mt-2 ${c.text}`}>{promo.title}</h4>
                  <p className="text-xs text-slate-600 mt-1 line-clamp-2">{promo.message}</p>
                  <div className="flex items-center justify-between mt-3 text-[10px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {promo.created_at ? formatDate(promo.created_at) : 'Just now'}
                    </span>
                    {promo.valid_until && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Until {formatDate(promo.valid_until)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Promotion Dialog */}
      <Dialog open={showPromoDialog} onOpenChange={setShowPromoDialog}>
        <DialogContent className="bg-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-violet-600" />
              Create Promotion
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Title *</Label>
              <Input
                value={promoForm.title}
                onChange={(e) => setPromoForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. 50% Off Weekend Special"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Message *</Label>
              <Textarea
                value={promoForm.message}
                onChange={(e) => setPromoForm(f => ({ ...f, message: e.target.value }))}
                placeholder="Describe your promotion..."
                rows={3}
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <select
                  value={promoForm.promotion_type}
                  onChange={(e) => setPromoForm(f => ({ ...f, promotion_type: e.target.value }))}
                  className="mt-1 w-full h-9 rounded-md border border-slate-200 px-3 text-sm bg-white"
                >
                  <option value="general">General</option>
                  <option value="discount">Discount</option>
                  <option value="event">Event</option>
                  <option value="new_service">New Service</option>
                </select>
              </div>
              <div>
                <Label>Discount Value</Label>
                <Input
                  value={promoForm.discount_value}
                  onChange={(e) => setPromoForm(f => ({ ...f, discount_value: e.target.value }))}
                  placeholder="e.g. 50%"
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label>Valid Until</Label>
              <Input
                type="date"
                value={promoForm.valid_until}
                onChange={(e) => setPromoForm(f => ({ ...f, valid_until: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div className={`p-3 ${c.light} rounded-lg ${c.border} border`}>
              <p className={`text-xs ${c.text}`}>
                This promotion will be sent as a notification to all <strong>{subscriberCount}</strong> subscribers of your services.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPromoDialog(false)}>Cancel</Button>
            <Button onClick={createPromotion} disabled={submitting} className={`${c.accent} text-white`}>
              {submitting ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              Send to {subscriberCount} subscribers
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
