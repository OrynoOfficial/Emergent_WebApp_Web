import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Mail, Send, Loader2, Copy, Check, Clock, UserPlus, XCircle,
  CheckCircle, AlertCircle, Trash2, RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import api from '@/api/client';
import OperatorPicker from '@/components/shared/OperatorPicker';

const STATUS_STYLES = {
  pending: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', icon: Clock },
  used: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: CheckCircle },
  expired: { bg: 'bg-slate-50', text: 'text-slate-500', border: 'border-slate-200', icon: AlertCircle },
  revoked: { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-200', icon: XCircle },
};

export default function InvitationsManagement() {
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [sending, setSending] = useState(false);
  const [copiedToken, setCopiedToken] = useState(null);
  const [form, setForm] = useState({ email: '', role: 'customer', message: '', operator_id: '' });

  const loadInvitations = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/invitations/');
      setInvitations(data.invitations || []);
    } catch {
      toast.error('Failed to load invitations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadInvitations(); }, []);

  const handleSend = async () => {
    if (!form.email) { toast.error('Email is required'); return; }
    if (form.role === 'operator' && !form.operator_id) {
      toast.error('Pick an operator to assign this user to');
      return;
    }
    setSending(true);
    try {
      const payload = { ...form };
      if (form.role !== 'operator') delete payload.operator_id;
      await api.post('/invitations/send', payload);
      toast.success(`Invitation sent to ${form.email}`);
      setShowSendDialog(false);
      setForm({ email: '', role: 'customer', message: '', operator_id: '' });
      loadInvitations();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to send invitation');
    } finally {
      setSending(false);
    }
  };

  const handleRevoke = async (token) => {
    try {
      await api.delete(`/invitations/${token}`);
      toast.success('Invitation revoked');
      loadInvitations();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to revoke');
    }
  };

  const copyLink = (link) => {
    navigator.clipboard.writeText(link);
    setCopiedToken(link);
    setTimeout(() => setCopiedToken(null), 2000);
    toast.success('Link copied to clipboard');
  };

  return (
    <div className="space-y-6" data-testid="invitations-management">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Invitations</h2>
          <p className="text-sm text-slate-500">Invite new users to join the platform</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadInvitations} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Button onClick={() => setShowSendDialog(true)} className="bg-[#082c59] hover:bg-[#0a3a75]" data-testid="send-invite-btn">
            <UserPlus className="w-4 h-4 mr-2" /> Send Invitation
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {['pending', 'used', 'expired', 'revoked'].map(status => {
          const count = invitations.filter(i => i.status === status).length;
          const style = STATUS_STYLES[status];
          const Icon = style.icon;
          return (
            <div key={status} className={`p-4 rounded-xl border ${style.border} ${style.bg}`}>
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`w-4 h-4 ${style.text}`} />
                <span className={`text-xs font-semibold capitalize ${style.text}`}>{status}</span>
              </div>
              <span className="text-2xl font-bold text-slate-900">{count}</span>
            </div>
          );
        })}
      </div>

      {/* Invitations List */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#082c59] mx-auto mb-3" />
            <p className="text-slate-500 text-sm">Loading invitations...</p>
          </div>
        ) : invitations.length === 0 ? (
          <div className="p-12 text-center">
            <Mail className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No invitations sent yet</p>
            <Button className="mt-4 bg-[#082c59]" onClick={() => setShowSendDialog(true)}>
              <Send className="w-4 h-4 mr-2" /> Send Your First Invitation
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {invitations.map((inv, idx) => {
              const style = STATUS_STYLES[inv.status] || STATUS_STYLES.pending;
              const Icon = style.icon;
              return (
                <div key={idx} className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors" data-testid={`invitation-row-${idx}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${style.bg} border ${style.border}`}>
                      <Mail className={`w-5 h-5 ${style.text}`} />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900 text-sm">{inv.email}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="outline" className="text-[10px] capitalize">{inv.role}</Badge>
                        <span className="text-[10px] text-slate-400">
                          {inv.created_at ? new Date(inv.created_at).toLocaleDateString() : ''}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={`${style.bg} ${style.text} border ${style.border} text-[10px] capitalize`}>
                      <Icon className="w-3 h-3 mr-1" /> {inv.status}
                    </Badge>
                    {inv.invite_link && inv.status === 'pending' && (
                      <Button variant="ghost" size="sm" onClick={() => copyLink(inv.invite_link)} className="h-8 px-2">
                        {copiedToken === inv.invite_link ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </Button>
                    )}
                    {inv.status === 'pending' && (
                      <Button variant="ghost" size="sm" onClick={() => handleRevoke(inv.token)} className="h-8 px-2 text-red-500 hover:text-red-700">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Send Dialog */}
      <Dialog open={showSendDialog} onOpenChange={setShowSendDialog}>
        <DialogContent className="sm:max-w-lg bg-white max-h-[92vh] overflow-y-auto" data-testid="invite-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-[#082c59]" />
              Send Invitation
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-sm font-medium">Email Address *</Label>
              <div className="relative mt-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  placeholder="user@example.com"
                  className="pl-10"
                  data-testid="invite-email-input"
                />
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium">Role</Label>
              <Select value={form.role} onValueChange={v => setForm(p => ({ ...p, role: v, operator_id: v === 'operator' ? p.operator_id : '' }))}>
                <SelectTrigger className="mt-1" data-testid="invite-role-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="customer">Customer</SelectItem>
                  <SelectItem value="operator">Operator</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.role === 'operator' && (
              <div>
                <Label className="text-sm font-medium">Assign to operator <span className="text-red-500">*</span></Label>
                <div className="mt-1">
                  <OperatorPicker
                    value={form.operator_id}
                    onChange={(id) => setForm(p => ({ ...p, operator_id: id }))}
                    required
                  />
                </div>
              </div>
            )}
            <div>
              <Label className="text-sm font-medium">Personal Message (optional)</Label>
              <Textarea
                value={form.message}
                onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
                placeholder="Welcome to our platform..."
                className="mt-1"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSendDialog(false)}>Cancel</Button>
            <Button onClick={handleSend} disabled={sending || !form.email} className="bg-[#082c59]" data-testid="confirm-send-invite-btn">
              {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              {sending ? 'Sending...' : 'Send Invitation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
