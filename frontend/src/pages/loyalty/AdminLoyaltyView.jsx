import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Textarea } from '../../components/ui/textarea';
import {
  TrendingUp, Gift, Star, Users, Crown, Trophy, Zap, Sparkles, Coins,
  Clock, ArrowRight, Loader2, Plus, Edit2, Trash2, Search, BarChart3,
  Target, Percent, User
} from 'lucide-react';
import { formatCurrency } from '../../utils/currency';
import { formatDate, formatDateShort } from '../../utils/dateUtils';
import api from '../../api/client';
import { toast } from 'sonner';
import { AdminModal, FormField, StyledInput } from '../../components/shared/AdminModal';
import { TIER_CONFIG, TIER_SYMBOLS, DEFAULT_REWARDS, REWARD_TYPE_ICONS } from './constants';

export default function AdminLoyaltyView() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';
  const isReadOnly = user?.role === 'admin';

  const [activeTab, setActiveTab] = useState('overview');
  const [rewards, setRewards] = useState(DEFAULT_REWARDS);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showRewardDialog, setShowRewardDialog] = useState(false);
  const [editingReward, setEditingReward] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [tierFilter, setTierFilter] = useState('all');
  const [rewardForm, setRewardForm] = useState({
    title: '', description: '', points_required: '', min_tier: 'bronze', type: 'discount', discount_value: '', service_types: [], valid_from: '', valid_to: '', max_redemptions: '', total_available: ''
  });
  const [selectedMember, setSelectedMember] = useState(null);
  const [memberDetail, setMemberDetail] = useState(null);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [loadingMember, setLoadingMember] = useState(false);
  const [savingReward, setSavingReward] = useState(false);

  const [programStats, setProgramStats] = useState({
    totalMembers: 0, totalPointsIssued: 0, totalPointsRedeemed: 0, activeRewards: 0,
    membersByTier: { bronze: 0, silver: 0, gold: 0, platinum: 0 }
  });

  useEffect(() => { loadAdminData(); }, []);

  const loadAdminData = async () => {
    setLoading(true);
    try {
      const [rewardsRes, statsRes, membersRes] = await Promise.all([
        api.get('/loyalty/admin/rewards'),
        api.get('/loyalty/admin/stats'),
        api.get('/loyalty/admin/members')
      ]);
      if (rewardsRes.data?.rewards?.length > 0) setRewards(rewardsRes.data.rewards);
      if (statsRes.data) setProgramStats(statsRes.data);
      if (membersRes.data?.members) setMembers(membersRes.data.members);
    } catch (error) {
      console.error('Failed to load admin data:', error);
    } finally { setLoading(false); }
  };

  const handleSaveReward = async () => {
    if (!rewardForm.title || !rewardForm.points_required) {
      toast.error('Please fill in required fields (Title, Points)');
      return;
    }
    setSavingReward(true);
    try {
      const payload = {
        title: rewardForm.title, description: rewardForm.description,
        points_required: parseInt(rewardForm.points_required), min_tier: rewardForm.min_tier,
        type: rewardForm.type, discount_value: rewardForm.discount_value ? parseFloat(rewardForm.discount_value) : null,
        service_types: rewardForm.service_types, valid_from: rewardForm.valid_from || null,
        valid_to: rewardForm.valid_to || null,
        max_redemptions: rewardForm.max_redemptions ? parseInt(rewardForm.max_redemptions) : null,
        total_available: rewardForm.total_available ? parseInt(rewardForm.total_available) : null
      };
      if (editingReward) {
        await api.put(`/loyalty/admin/rewards/${editingReward.id}`, payload);
        toast.success('Reward updated successfully!');
      } else {
        await api.post('/loyalty/admin/rewards', payload);
        toast.success('Reward created successfully!');
      }
      const rewardsRes = await api.get('/loyalty/admin/rewards');
      if (rewardsRes.data?.rewards) setRewards(rewardsRes.data.rewards);
      setShowRewardDialog(false);
      setEditingReward(null);
      resetRewardForm();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save reward');
    } finally { setSavingReward(false); }
  };

  const resetRewardForm = () => setRewardForm({ title: '', description: '', points_required: '', min_tier: 'bronze', type: 'discount', discount_value: '', service_types: [], valid_from: '', valid_to: '', max_redemptions: '', total_available: '' });

  const handleDeleteReward = async (rewardId) => {
    if (!confirm('Delete this reward?')) return;
    try {
      await api.delete(`/loyalty/admin/rewards/${rewardId}`);
      const rewardsRes = await api.get('/loyalty/admin/rewards');
      if (rewardsRes.data?.rewards) setRewards(rewardsRes.data.rewards);
      else setRewards(prev => prev.filter(r => r.id !== rewardId));
      toast.success('Reward deleted');
    } catch { toast.error('Failed to delete reward'); }
  };

  const handleEditReward = (reward) => {
    setEditingReward(reward);
    setRewardForm({
      title: reward.title, description: reward.description || '',
      points_required: reward.points_required?.toString() || '', min_tier: reward.min_tier || 'bronze',
      type: reward.type || 'discount', discount_value: reward.discount_value?.toString() || '',
      service_types: reward.service_types || [], valid_from: reward.valid_from || '',
      valid_to: reward.valid_to || '', max_redemptions: reward.max_redemptions?.toString() || '',
      total_available: reward.total_available?.toString() || ''
    });
    setShowRewardDialog(true);
  };

  const handleViewMember = async (member) => {
    setSelectedMember(member);
    setShowMemberModal(true);
    setLoadingMember(true);
    try {
      const res = await api.get(`/loyalty/admin/members/${member.id}`);
      setMemberDetail(res.data);
    } catch { setMemberDetail(null); }
    finally { setLoadingMember(false); }
  };

  const filteredMembers = useMemo(() => {
    return members.filter(m => {
      const matchesSearch = !searchTerm || m.name.toLowerCase().includes(searchTerm.toLowerCase()) || m.email.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesTier = tierFilter === 'all' || m.tier === tierFilter;
      return matchesSearch && matchesTier;
    });
  }, [members, searchTerm, tierFilter]);

  const totalTierMembers = Object.values(programStats.membersByTier).reduce((s, v) => s + v, 0) || 1;

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="h-10 w-10 animate-spin text-[#082c59]" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-600 to-indigo-700 border-0 text-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div><p className="text-blue-200 text-xs font-medium uppercase tracking-wide">Total Members</p><p className="text-3xl font-bold mt-1">{programStats.totalMembers.toLocaleString()}</p></div>
              <Users className="h-10 w-10 text-blue-300/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-500 to-orange-600 border-0 text-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div><p className="text-amber-200 text-xs font-medium uppercase tracking-wide">Points Issued</p><p className="text-3xl font-bold mt-1">{programStats.totalPointsIssued.toLocaleString()}</p></div>
              <Coins className="h-10 w-10 text-amber-300/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-500 to-teal-600 border-0 text-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div><p className="text-emerald-200 text-xs font-medium uppercase tracking-wide">Points Redeemed</p><p className="text-3xl font-bold mt-1">{programStats.totalPointsRedeemed.toLocaleString()}</p></div>
              <Gift className="h-10 w-10 text-emerald-300/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-violet-500 to-purple-600 border-0 text-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div><p className="text-violet-200 text-xs font-medium uppercase tracking-wide">Active Rewards</p><p className="text-3xl font-bold mt-1">{rewards.filter(r => r.is_active !== false).length}</p></div>
              <Trophy className="h-10 w-10 text-violet-300/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 max-w-lg bg-slate-100 p-1 rounded-xl">
          <TabsTrigger value="overview" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm"><BarChart3 className="w-4 h-4 mr-1.5" /> Overview</TabsTrigger>
          <TabsTrigger value="rewards" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm"><Gift className="w-4 h-4 mr-1.5" /> Rewards</TabsTrigger>
          <TabsTrigger value="members" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm"><Users className="w-4 h-4 mr-1.5" /> Members</TabsTrigger>
        </TabsList>

        {/* === OVERVIEW TAB === */}
        <TabsContent value="overview" className="space-y-6 mt-6">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Crown className="w-5 h-5 text-amber-500" /> Tier Distribution</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4 mb-6">
                {['bronze', 'silver', 'gold', 'platinum'].map(tier => {
                  const cfg = TIER_CONFIG[tier];
                  const count = programStats.membersByTier[tier] || 0;
                  const pct = Math.round((count / totalTierMembers) * 100);
                  return (
                    <div key={tier} className={`p-4 rounded-xl border-2 ${cfg.borderColor} ${cfg.bgColor} text-center`}>
                      <span className="text-3xl">{TIER_SYMBOLS[tier]}</span>
                      <p className={`text-lg font-bold mt-2 ${cfg.textColor}`}>{count.toLocaleString()}</p>
                      <p className="text-xs text-slate-500 capitalize">{cfg.name}</p>
                      <div className="w-full bg-slate-200 rounded-full h-1.5 mt-2">
                        <div className={`h-1.5 rounded-full bg-gradient-to-r ${cfg.color}`} style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">{pct}%</p>
                    </div>
                  );
                })}
              </div>
              <div className="p-4 bg-slate-50 rounded-xl">
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-3">Tier Symbols Guide</p>
                <div className="grid grid-cols-4 gap-3">
                  {Object.entries(TIER_CONFIG).map(([key, cfg]) => {
                    const TIcon = cfg.icon;
                    return (
                      <div key={key} className="flex items-center gap-2">
                        <span className="text-lg">{TIER_SYMBOLS[key]}</span>
                        <TIcon className={`w-4 h-4 ${cfg.textColor}`} />
                        <span className="text-sm font-medium capitalize">{cfg.name}</span>
                        <span className="text-xs text-slate-400">({cfg.pointsRequired.toLocaleString()}+ pts)</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Target className="w-5 h-5 text-blue-500" /> Points Flow</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-amber-50 rounded-xl border border-amber-100">
                  <div className="flex items-center gap-3"><Coins className="w-6 h-6 text-amber-600" /><div><p className="font-bold text-amber-800">{programStats.totalPointsIssued.toLocaleString()}</p><p className="text-xs text-amber-600">Points Issued</p></div></div>
                  <ArrowRight className="w-5 h-5 text-slate-300" />
                  <div className="flex items-center gap-3"><Gift className="w-6 h-6 text-emerald-600" /><div><p className="font-bold text-emerald-800">{programStats.totalPointsRedeemed.toLocaleString()}</p><p className="text-xs text-emerald-600">Redeemed</p></div></div>
                </div>
                <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 text-center">
                  <p className="text-2xl font-bold text-blue-700">{(programStats.totalPointsIssued - programStats.totalPointsRedeemed).toLocaleString()}</p>
                  <p className="text-xs text-blue-600">Outstanding Points in Circulation</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Zap className="w-5 h-5 text-amber-500" /> Earning Rules</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100"><Coins className="w-5 h-5 text-blue-600 shrink-0" /><div><p className="font-semibold text-sm">Every Booking</p><p className="text-xs text-slate-500">1-3x points per 1,000 FCFA based on tier</p></div></div>
                  <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg border border-purple-100"><Star className="w-5 h-5 text-purple-600 shrink-0" /><div><p className="font-semibold text-sm">Write Reviews</p><p className="text-xs text-slate-500">5 points per review submitted</p></div></div>
                  <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-lg border border-emerald-100"><Users className="w-5 h-5 text-emerald-600 shrink-0" /><div><p className="font-semibold text-sm">Referrals</p><p className="text-xs text-slate-500">10 points per successful referral</p></div></div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* === REWARDS TAB === */}
        <TabsContent value="rewards" className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Manage Rewards</h3>
              {isReadOnly && <p className="text-sm text-amber-600">Read-only access. Only Super Admins can modify.</p>}
            </div>
            {isSuperAdmin && (
              <Button onClick={() => { setEditingReward(null); resetRewardForm(); setShowRewardDialog(true); }} className="bg-[#082c59] hover:bg-[#0a3a75]">
                <Plus className="h-4 w-4 mr-2" /> Add Reward
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rewards.map(reward => {
              const tierCfg = TIER_CONFIG[reward.min_tier] || TIER_CONFIG.bronze;
              const TypeIcon = REWARD_TYPE_ICONS[reward.type] || Gift;
              return (
                <Card key={reward.id} className={`border-l-4 hover:shadow-md transition-shadow ${reward.is_active === false ? 'opacity-50' : ''}`} style={{ borderLeftColor: tierCfg.textColor.includes('amber') ? '#D97706' : tierCfg.textColor.includes('slate') ? '#64748B' : tierCfg.textColor.includes('yellow') ? '#CA8A04' : '#9333EA' }}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className={`p-2.5 rounded-xl ${tierCfg.bgColor}`}>
                          <TypeIcon className={`w-5 h-5 ${tierCfg.textColor}`} />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900">{reward.title}</h4>
                          <p className="text-sm text-slate-500 mt-0.5">{reward.description}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge className={`${tierCfg.bgColor} ${tierCfg.textColor} capitalize text-xs`}>{TIER_SYMBOLS[reward.min_tier]} {reward.min_tier}</Badge>
                            <Badge variant="outline" className="text-xs capitalize">{reward.type}</Badge>
                            <span className="text-sm font-bold text-[#082c59]">{reward.points_required?.toLocaleString()} pts</span>
                          </div>
                          {reward.discount_value && <p className="text-xs text-emerald-600 mt-1">{reward.discount_value}% discount</p>}
                        </div>
                      </div>
                      {isSuperAdmin && (
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditReward(reward)}><Edit2 className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => handleDeleteReward(reward.id)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* === MEMBERS TAB === */}
        <TabsContent value="members" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <CardTitle>Loyalty Members</CardTitle>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input placeholder="Search members..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" data-testid="member-search" />
                  </div>
                  <Select value={tierFilter} onValueChange={setTierFilter}>
                    <SelectTrigger className="w-[130px]" data-testid="tier-filter">
                      <SelectValue placeholder="All Tiers" />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      <SelectItem value="all">All Tiers</SelectItem>
                      {['bronze', 'silver', 'gold', 'platinum'].map(t => (
                        <SelectItem key={t} value={t}><span>{TIER_SYMBOLS[t]} {TIER_CONFIG[t].name}</span></SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-slate-50">
                      <th className="text-left py-3 px-3 text-xs font-semibold text-slate-600 uppercase">Member</th>
                      <th className="text-left py-3 px-3 text-xs font-semibold text-slate-600 uppercase">Tier</th>
                      <th className="text-right py-3 px-3 text-xs font-semibold text-slate-600 uppercase">Total Points</th>
                      <th className="text-right py-3 px-3 text-xs font-semibold text-slate-600 uppercase">Available</th>
                      <th className="text-right py-3 px-3 text-xs font-semibold text-slate-600 uppercase">Total Spent</th>
                      <th className="text-right py-3 px-3 text-xs font-semibold text-slate-600 uppercase">Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMembers.map(member => {
                      const tierCfg = TIER_CONFIG[member.tier] || TIER_CONFIG.bronze;
                      return (
                        <tr key={member.id} className="border-b hover:bg-slate-50 cursor-pointer transition-colors" onClick={() => handleViewMember(member)} data-testid={`member-row-${member.id}`}>
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{TIER_SYMBOLS[member.tier]}</span>
                              <div><p className="font-medium">{member.name}</p><p className="text-xs text-slate-500">{member.email}</p></div>
                            </div>
                          </td>
                          <td className="py-3 px-3"><Badge className={`${tierCfg.bgColor} ${tierCfg.textColor} capitalize`}>{member.tier}</Badge></td>
                          <td className="text-right py-3 px-3 font-medium">{member.total_points?.toLocaleString()}</td>
                          <td className="text-right py-3 px-3 text-emerald-600 font-medium">{member.available_points?.toLocaleString()}</td>
                          <td className="text-right py-3 px-3">{formatCurrency(member.total_spent || 0)}</td>
                          <td className="text-right py-3 px-3 text-slate-500 text-xs">{member.joined_at ? formatDateShort(member.joined_at) : '-'}</td>
                        </tr>
                      );
                    })}
                    {filteredMembers.length === 0 && (
                      <tr><td colSpan={6} className="text-center py-8 text-slate-400">No members found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Reward Create/Edit Modal */}
      <AdminModal
        open={showRewardDialog}
        onOpenChange={setShowRewardDialog}
        title={editingReward ? 'Edit Reward' : 'Create New Reward'}
        subtitle={editingReward ? 'Update reward details and configuration' : 'Define a new loyalty reward for members'}
        icon={<Gift className="w-5 h-5 text-white" />}
        accentColor="violet"
        size="lg"
        footer={<>
          <Button variant="outline" onClick={() => setShowRewardDialog(false)} disabled={savingReward}>Cancel</Button>
          <Button onClick={handleSaveReward} disabled={savingReward} className="bg-violet-600 hover:bg-violet-700 text-white" data-testid="save-reward-btn">
            {savingReward && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {editingReward ? 'Update Reward' : 'Create Reward'}
          </Button>
        </>}
      >
        <div className="space-y-5">
          <AdminModal.Section title="Reward Details" icon={<Gift className="w-4 h-4" />}>
            <div className="space-y-4 p-4 bg-slate-50/60 rounded-xl border border-slate-100">
              <FormField label="Title" required>
                <StyledInput value={rewardForm.title} onChange={(e) => setRewardForm({...rewardForm, title: e.target.value})} placeholder="5% Discount Voucher" />
              </FormField>
              <FormField label="Description">
                <Textarea value={rewardForm.description} onChange={(e) => setRewardForm({...rewardForm, description: e.target.value})} placeholder="Get 5% off your next booking" className="bg-slate-50/80 border-slate-200 focus:bg-white" />
              </FormField>
            </div>
          </AdminModal.Section>

          <AdminModal.Section title="Points & Eligibility" icon={<Coins className="w-4 h-4" />}>
            <div className="grid grid-cols-2 gap-4 p-4 bg-amber-50/40 rounded-xl border border-amber-100">
              <FormField label="Points Required" required>
                <StyledInput type="number" value={rewardForm.points_required} onChange={(e) => setRewardForm({...rewardForm, points_required: e.target.value})} placeholder="1000" />
              </FormField>
              <FormField label="Minimum Tier">
                <Select value={rewardForm.min_tier} onValueChange={(v) => setRewardForm({...rewardForm, min_tier: v})}>
                  <SelectTrigger className="bg-white border-amber-200"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white">
                    {['bronze', 'silver', 'gold', 'platinum'].map(t => (
                      <SelectItem key={t} value={t}>{TIER_SYMBOLS[t]} {TIER_CONFIG[t].name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            </div>
          </AdminModal.Section>

          <AdminModal.Section title="Reward Type & Value" icon={<Percent className="w-4 h-4" />}>
            <div className="grid grid-cols-2 gap-4 p-4 bg-emerald-50/40 rounded-xl border border-emerald-100">
              <FormField label="Type">
                <Select value={rewardForm.type} onValueChange={(v) => setRewardForm({...rewardForm, type: v})}>
                  <SelectTrigger className="bg-white border-emerald-200"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="discount">Discount</SelectItem>
                    <SelectItem value="upgrade">Upgrade</SelectItem>
                    <SelectItem value="service">Free Service</SelectItem>
                    <SelectItem value="gift">Gift</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
              {rewardForm.type === 'discount' && (
                <FormField label="Discount %" hint="Percentage off the total">
                  <StyledInput type="number" value={rewardForm.discount_value} onChange={(e) => setRewardForm({...rewardForm, discount_value: e.target.value})} placeholder="10" />
                </FormField>
              )}
            </div>
          </AdminModal.Section>

          <AdminModal.Section title="Availability & Limits" icon={<Clock className="w-4 h-4" />}>
            <div className="grid grid-cols-2 gap-4 p-4 bg-blue-50/40 rounded-xl border border-blue-100">
              <FormField label="Valid From" hint="Leave empty for no start date">
                <StyledInput type="date" value={rewardForm.valid_from} onChange={(e) => setRewardForm({...rewardForm, valid_from: e.target.value})} />
              </FormField>
              <FormField label="Valid To" hint="Leave empty for no expiry">
                <StyledInput type="date" value={rewardForm.valid_to} onChange={(e) => setRewardForm({...rewardForm, valid_to: e.target.value})} />
              </FormField>
              <FormField label="Max Redemptions per User" hint="Leave empty for unlimited">
                <StyledInput type="number" value={rewardForm.max_redemptions} onChange={(e) => setRewardForm({...rewardForm, max_redemptions: e.target.value})} placeholder="5" />
              </FormField>
              <FormField label="Total Available" hint="Leave empty for unlimited">
                <StyledInput type="number" value={rewardForm.total_available} onChange={(e) => setRewardForm({...rewardForm, total_available: e.target.value})} placeholder="100" />
              </FormField>
            </div>
          </AdminModal.Section>
        </div>
      </AdminModal>

      {/* Member Detail Modal */}
      <AdminModal
        open={showMemberModal}
        onOpenChange={(open) => { setShowMemberModal(open); if (!open) { setSelectedMember(null); setMemberDetail(null); } }}
        title={selectedMember?.name || 'Member Details'}
        subtitle={selectedMember?.email}
        icon={<User className="w-5 h-5 text-white" />}
        accentColor="blue"
        size="lg"
      >
        {loadingMember ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>
        ) : selectedMember && (
          <div className="space-y-5">
            <div className={`p-5 rounded-xl border-2 ${(TIER_CONFIG[selectedMember.tier] || TIER_CONFIG.bronze).borderColor} ${(TIER_CONFIG[selectedMember.tier] || TIER_CONFIG.bronze).bgColor}`}>
              <div className="flex items-center gap-4">
                <span className="text-4xl">{TIER_SYMBOLS[selectedMember.tier]}</span>
                <div>
                  <p className={`text-lg font-bold capitalize ${(TIER_CONFIG[selectedMember.tier] || TIER_CONFIG.bronze).textColor}`}>{selectedMember.tier} Member</p>
                  <p className="text-sm text-slate-500">Joined {selectedMember.joined_at ? formatDate(selectedMember.joined_at) : 'N/A'}</p>
                </div>
                <div className="ml-auto text-right">
                  <p className="text-2xl font-bold text-slate-900">{selectedMember.total_points?.toLocaleString()}</p>
                  <p className="text-xs text-slate-500">total points</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-slate-200/50">
                <div className="text-center"><p className="text-lg font-bold text-emerald-700">{selectedMember.available_points?.toLocaleString()}</p><p className="text-xs text-slate-500">Available</p></div>
                <div className="text-center"><p className="text-lg font-bold text-blue-700">{formatCurrency(selectedMember.total_spent || 0)}</p><p className="text-xs text-slate-500">Total Spent</p></div>
                <div className="text-center"><p className="text-lg font-bold text-amber-700">{(selectedMember.total_points - selectedMember.available_points)?.toLocaleString()}</p><p className="text-xs text-slate-500">Redeemed</p></div>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">Point Activity</h4>
              {memberDetail?.transactions?.length > 0 ? (
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {memberDetail.transactions.map((tx, i) => (
                    <div key={i} className={`flex items-center justify-between p-3 rounded-lg ${tx.transaction_type === 'earn' ? 'bg-emerald-50' : 'bg-red-50'}`}>
                      <div className="flex items-center gap-2">
                        {tx.transaction_type === 'earn' ? <TrendingUp className="w-4 h-4 text-emerald-600" /> : <Gift className="w-4 h-4 text-red-500" />}
                        <div><p className="text-sm font-medium">{tx.description || tx.transaction_type}</p><p className="text-xs text-slate-400">{tx.created_at ? formatDateShort(tx.created_at) : ''}</p></div>
                      </div>
                      <span className={`font-bold text-sm ${tx.transaction_type === 'earn' ? 'text-emerald-700' : 'text-red-600'}`}>
                        {tx.transaction_type === 'earn' ? '+' : '-'}{Math.abs(tx.points).toLocaleString()} pts
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400 text-center py-4">No point activity yet</p>
              )}
            </div>

            {memberDetail?.redemptions?.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">Redemptions</h4>
                <div className="space-y-2">
                  {memberDetail.redemptions.map((rd, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-violet-50 rounded-lg">
                      <div><p className="text-sm font-medium">{rd.reward_name}</p><p className="text-xs text-slate-400">Code: {rd.code}</p></div>
                      <Badge className="capitalize">{rd.status}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </AdminModal>
    </div>
  );
}
