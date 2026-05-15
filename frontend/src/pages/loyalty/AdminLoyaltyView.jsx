import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import DatePickerField from '@/components/shared/DatePickerField';
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
  Target, Percent, User, Tag, Copy, Check, Megaphone, Bell, Store, X, Filter
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
  // Honour ?tab=... deep links from other pages (e.g. Communications hub).
  // Map "promotions" → the operator-rewards tab where ops promotions live.
  const [searchParams] = useSearchParams();
  useEffect(() => {
    const t = searchParams.get('tab');
    if (!t) return;
    const map = { promotions: 'operator-rewards', rewards: 'rewards', members: 'members', overview: 'overview', 'operator-rewards': 'operator-rewards' };
    const target = map[t];
    if (target) {
      setActiveTab(target);
      if (t === 'promotions') setOpSubTab('promotions');
    }
  }, [searchParams]);
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
  const [generatingPromo, setGeneratingPromo] = useState(null);
  const [loyaltyPromos, setLoyaltyPromos] = useState([]);
  const [opRewards, setOpRewards] = useState([]);
  const [opRewardsLoading, setOpRewardsLoading] = useState(false);
  const [opSubTab, setOpSubTab] = useState('promotions');
  const [opSearch, setOpSearch] = useState('');
  const [opStatusFilter, setOpStatusFilter] = useState('all');
  const [opOperatorFilter, setOpOperatorFilter] = useState('all');

  const [programStats, setProgramStats] = useState({
    totalMembers: 0, totalPointsIssued: 0, totalPointsRedeemed: 0, activeRewards: 0,
    membersByTier: { bronze: 0, silver: 0, gold: 0, platinum: 0 }
  });

  useEffect(() => { loadAdminData(); }, []);

  useEffect(() => {
    if (activeTab === 'operator-rewards' && opRewards.length === 0) loadOpRewards();
  }, [activeTab]);

  const loadOpRewards = async () => {
    setOpRewardsLoading(true);
    try {
      const res = await api.get('/subscriptions/promotions?limit=500');
      setOpRewards(res.data?.promotions || []);
    } catch { setOpRewards([]); }
    finally { setOpRewardsLoading(false); }
  };

  const loadAdminData = async () => {
    setLoading(true);
    try {
      const [rewardsRes, statsRes, membersRes, promosRes] = await Promise.all([
        api.get('/loyalty/admin/rewards').catch(() => ({ data: { rewards: [] } })),
        api.get('/loyalty/admin/stats').catch(() => ({ data: null })),
        api.get('/loyalty/admin/members').catch(() => ({ data: { members: [] } })),
        api.get('/loyalty/admin/promo-codes').catch(() => ({ data: { promo_codes: [] } }))
      ]);
      if (rewardsRes.data?.rewards?.length > 0) setRewards(rewardsRes.data.rewards);
      if (statsRes.data) setProgramStats(statsRes.data);
      if (membersRes.data?.members) setMembers(membersRes.data.members);
      setLoyaltyPromos(promosRes.data?.promo_codes || []);
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

  const handleGeneratePromo = async (reward) => {
    setGeneratingPromo(reward.id);
    try {
      const res = await api.post(`/loyalty/admin/rewards/${reward.id}/generate-promo`);
      toast.success(`Promo code generated: ${res.data.code}`);
      loadAdminData(); // Refresh to show new promo
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to generate promo code');
    } finally { setGeneratingPromo(null); }
  };

  const [copiedPromoCode, setCopiedPromoCode] = useState(null);
  const copyPromo = (code) => {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopiedPromoCode(code);
    toast.success('Code copied!');
    setTimeout(() => setCopiedPromoCode(null), 2000);
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

  const filteredOpRewards = useMemo(() => {
    const q = opSearch.toLowerCase();
    return opRewards.filter(item => {
      if (opSubTab === 'promotions' && item.type !== 'promotion') return false;
      if (opSubTab === 'alerts' && item.type !== 'alert') return false;
      if (opStatusFilter !== 'all' && item.status !== opStatusFilter) return false;
      if (opOperatorFilter !== 'all' && item.operator_name !== opOperatorFilter) return false;
      if (q) {
        const text = [item.title, item.message, item.operator_name, item.service_type].filter(Boolean).join(' ').toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [opRewards, opSubTab, opSearch, opStatusFilter, opOperatorFilter]);

  const opOperatorNames = useMemo(() => {
    const names = new Set(opRewards.map(r => r.operator_name).filter(Boolean));
    return [...names].sort();
  }, [opRewards]);

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
        <TabsList className="grid w-full grid-cols-4 mb-6 bg-slate-100">
          <TabsTrigger value="overview" className="flex items-center gap-2 data-[state=active]:bg-[#082c59] data-[state=active]:text-white text-xs sm:text-sm"><BarChart3 className="w-4 h-4" /> Overview</TabsTrigger>
          <TabsTrigger value="rewards" className="flex items-center gap-2 data-[state=active]:bg-[#082c59] data-[state=active]:text-white text-xs sm:text-sm"><Gift className="w-4 h-4" /> Rewards</TabsTrigger>
          <TabsTrigger value="operator-rewards" className="flex items-center gap-2 data-[state=active]:bg-[#082c59] data-[state=active]:text-white text-xs sm:text-sm" data-testid="operator-rewards-tab"><Megaphone className="w-4 h-4" /> Op. Rewards</TabsTrigger>
          <TabsTrigger value="members" className="flex items-center gap-2 data-[state=active]:bg-[#082c59] data-[state=active]:text-white text-xs sm:text-sm"><Users className="w-4 h-4" /> Members</TabsTrigger>
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
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-violet-600" title="Generate Promo Code" onClick={() => handleGeneratePromo(reward)} disabled={generatingPromo === reward.id} data-testid={`gen-promo-${reward.id}`}>
                            {generatingPromo === reward.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Tag className="h-4 w-4" />}
                          </Button>
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

          {/* Generated Promo Codes Section */}
          {loyaltyPromos.length > 0 && (
            <div className="mt-6">
              <h3 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
                <Tag className="h-5 w-5 text-violet-600" /> Generated Promo Codes
                <Badge className="bg-violet-100 text-violet-700 text-xs">{loyaltyPromos.length}</Badge>
              </h3>
              <div className="overflow-x-auto bg-white rounded-xl border">
                <table className="w-full text-sm" data-testid="promo-codes-table">
                  <thead>
                    <tr className="border-b bg-slate-50">
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 uppercase">Code</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 uppercase">Reward</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 uppercase">Source</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 uppercase">Discount</th>
                      <th className="text-center py-3 px-4 text-xs font-semibold text-slate-600 uppercase">Used / Limit</th>
                      <th className="text-center py-3 px-4 text-xs font-semibold text-slate-600 uppercase">Status</th>
                      <th className="text-center py-3 px-4 text-xs font-semibold text-slate-600 uppercase">Copy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loyaltyPromos.map((promo, i) => {
                      const isExpired = promo.valid_to && new Date(promo.valid_to) < new Date();
                      const isExhausted = promo.usage_limit && promo.times_used >= promo.usage_limit;
                      return (
                        <tr key={i} className="border-b last:border-0 hover:bg-slate-50">
                          <td className="py-3 px-4"><code className="font-mono font-bold text-violet-700 bg-violet-50 px-2 py-0.5 rounded">{promo.code}</code></td>
                          <td className="py-3 px-4 text-slate-700">{promo.reward_title || promo.name}</td>
                          <td className="py-3 px-4">
                            {promo.source === 'loyalty_redemption' ? (
                              <div><Badge className="bg-blue-100 text-blue-700 text-[10px]">Redeemed</Badge>{promo.redeemed_by_name && <p className="text-[10px] text-slate-500 mt-0.5">{promo.redeemed_by_name}</p>}</div>
                            ) : (
                              <Badge className="bg-violet-100 text-violet-700 text-[10px]">Admin</Badge>
                            )}
                          </td>
                          <td className="py-3 px-4"><span className="font-medium text-emerald-700">{promo.discount_type === 'percentage' ? `${promo.discount_value}%` : `${promo.discount_value} FCFA`}</span></td>
                          <td className="py-3 px-4 text-center"><span className={`font-bold ${isExhausted ? 'text-red-600' : 'text-slate-700'}`}>{promo.times_used}</span><span className="text-slate-400"> / {promo.usage_limit || '--'}</span></td>
                          <td className="py-3 px-4 text-center"><Badge className={`text-xs ${isExpired ? 'bg-red-100 text-red-700' : isExhausted ? 'bg-amber-100 text-amber-700' : promo.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{isExpired ? 'Expired' : isExhausted ? 'Exhausted' : promo.is_active ? 'Active' : 'Used'}</Badge></td>
                          <td className="py-3 px-4 text-center"><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyPromo(promo.code)}>{copiedPromoCode === promo.code ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5 text-slate-500" />}</Button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>

        {/* === OPERATOR REWARDS & ALERTS TAB === */}
        <TabsContent value="operator-rewards" className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-violet-600" /> Operator Rewards & Alerts
              </h3>
              <p className="text-sm text-slate-500">All promotions and alerts from operators across the platform</p>
            </div>
            <Button variant="outline" size="sm" onClick={loadOpRewards} disabled={opRewardsLoading} className="gap-1.5">
              {opRewardsLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Filter className="h-3.5 w-3.5" />} Refresh
            </Button>
          </div>

          {/* Sub-tabs: Promotions / Alerts */}
          <div className="flex items-center gap-2">
            {[{ k: 'promotions', l: 'Promotions', icon: Gift }, { k: 'alerts', l: 'Alerts', icon: Bell }].map(t => (
              <Button key={t.k} variant={opSubTab === t.k ? 'default' : 'outline'} size="sm" className={`gap-1.5 ${opSubTab === t.k ? 'bg-[#082c59]' : ''}`} onClick={() => setOpSubTab(t.k)} data-testid={`op-subtab-${t.k}`}>
                <t.icon className="h-3.5 w-3.5" /> {t.l}
                <Badge className={`ml-1 text-[10px] px-1.5 ${opSubTab === t.k ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  {opRewards.filter(r => r.type === (t.k === 'promotions' ? 'promotion' : 'alert')).length}
                </Badge>
              </Button>
            ))}
          </div>

          {/* Search & Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <Input value={opSearch} onChange={e => setOpSearch(e.target.value)} placeholder="Search by title, operator, service..." className="h-9 pl-8 text-sm" data-testid="op-rewards-search" />
              {opSearch && <button onClick={() => setOpSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2"><X className="w-3.5 h-3.5 text-slate-400" /></button>}
            </div>
            <Select value={opStatusFilter} onValueChange={setOpStatusFilter}>
              <SelectTrigger className="w-[140px] h-9 text-sm" data-testid="op-status-filter"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending_approval">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <Select value={opOperatorFilter} onValueChange={setOpOperatorFilter}>
              <SelectTrigger className="w-[160px] h-9 text-sm" data-testid="op-operator-filter"><SelectValue placeholder="Operator" /></SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="all">All Operators</SelectItem>
                {opOperatorNames.map(name => <SelectItem key={name} value={name}>{name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Results */}
          {opRewardsLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-[#082c59]" /></div>
          ) : filteredOpRewards.length === 0 ? (
            <Card><CardContent className="py-12 text-center">
              {opSubTab === 'promotions' ? <Gift className="h-12 w-12 text-slate-200 mx-auto mb-3" /> : <Bell className="h-12 w-12 text-slate-200 mx-auto mb-3" />}
              <p className="text-slate-500">{opSearch || opStatusFilter !== 'all' || opOperatorFilter !== 'all' ? 'No matching items found' : `No ${opSubTab} yet`}</p>
            </CardContent></Card>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-slate-400">{filteredOpRewards.length} {opSubTab} found</p>
              {filteredOpRewards.map(item => {
                const isPromo = item.type === 'promotion';
                const statusColors = {
                  pending_approval: 'bg-amber-100 text-amber-700',
                  approved: 'bg-green-100 text-green-700',
                  rejected: 'bg-red-100 text-red-700',
                };
                return (
                  <Card key={item.id} className={`border-l-4 ${isPromo ? 'border-l-purple-400' : 'border-l-amber-400'} hover:shadow-sm transition-shadow`} data-testid={`op-item-${item.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className={`p-2 rounded-lg shrink-0 ${isPromo ? 'bg-purple-50' : 'bg-amber-50'}`}>
                            {isPromo ? <Gift className="w-4 h-4 text-purple-600" /> : <Bell className="w-4 h-4 text-amber-600" />}
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-semibold text-sm text-slate-900 truncate">{item.title}</h4>
                            <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{item.message}</p>
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              <Badge variant="outline" className="text-[10px] gap-1"><Store className="h-2.5 w-2.5" /> {item.operator_name}</Badge>
                              {item.service_type && <Badge variant="outline" className="text-[10px]">{item.service_type}</Badge>}
                              {item.discount_value && <Badge className="bg-green-50 text-green-700 text-[10px]">{item.discount_value}</Badge>}
                              {item.valid_until && <span className="text-[10px] text-slate-400">Valid until {new Date(item.valid_until).toLocaleDateString()}</span>}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <Badge className={`text-[10px] ${statusColors[item.status] || 'bg-slate-100 text-slate-600'}`}>{item.status === 'pending_approval' ? 'Pending' : item.status}</Badge>
                          <span className="text-[10px] text-slate-400">{item.created_at ? formatDateShort(item.created_at) : ''}</span>
                          {item.created_by_name && <span className="text-[10px] text-slate-400">by {item.created_by_name}</span>}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

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
                <DatePickerField value={rewardForm.valid_from} onChange={(v) => setRewardForm({...rewardForm, valid_from: v})} placeholder="Start date" title="Valid From" minDate={null} />
              </FormField>
              <FormField label="Valid To" hint="Leave empty for no expiry">
                <DatePickerField value={rewardForm.valid_to} onChange={(v) => setRewardForm({...rewardForm, valid_to: v})} placeholder="End date" title="Valid To" minDate={rewardForm.valid_from ? new Date(rewardForm.valid_from) : null} />
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
