import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { Input } from '../components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { 
  Award, TrendingUp, Gift, Star, Users, Calendar, Crown, Trophy, 
  Zap, Check, Copy, Sparkles, Coins, Clock, ArrowRight, Loader2,
  Plus, Edit2, Trash2, Settings, Search, BarChart3, Target, Percent, User
} from 'lucide-react';
import { formatCurrency } from '../utils/currency';
import { formatDate, formatDateShort } from '../utils/dateUtils';
import api from '../api/client';
import { toast } from 'sonner';
import { AdminModal, FormField, StyledInput } from '../components/shared/AdminModal';

// Tier configuration
const TIER_CONFIG = {
  bronze: {
    name: 'Bronze',
    color: 'from-amber-600 to-amber-800',
    textColor: 'text-amber-700',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    icon: Award,
    pointsRequired: 0,
    discount: 0,
    benefits: ['Basic Support', 'Earn 1 point per 1,000 FCFA']
  },
  silver: {
    name: 'Silver',
    color: 'from-slate-400 to-slate-600',
    textColor: 'text-slate-600',
    bgColor: 'bg-slate-50',
    borderColor: 'border-slate-200',
    icon: Star,
    pointsRequired: 1000,
    discount: 5,
    benefits: ['Priority Support', 'Early Access', 'Earn 1.5x points']
  },
  gold: {
    name: 'Gold',
    color: 'from-yellow-400 to-yellow-600',
    textColor: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    icon: TrendingUp,
    pointsRequired: 5000,
    discount: 10,
    benefits: ['VIP Support', 'Early Access', 'Free Cancellation', 'Earn 2x points']
  },
  platinum: {
    name: 'Platinum',
    color: 'from-purple-500 to-purple-700',
    textColor: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    icon: Gift,
    pointsRequired: 15000,
    discount: 15,
    benefits: ['Dedicated Support', 'Exclusive Offers', 'Free Upgrades', 'Earn 3x points']
  }
};

// Default rewards (fallback if API fails)
const DEFAULT_REWARDS = [
  { id: '1', title: '5% Discount Voucher', description: 'Get 5% off your next booking', points_required: 500, min_tier: 'bronze', type: 'discount', discount_value: 5 },
  { id: '2', title: '10% Discount Voucher', description: 'Get 10% off your next booking', points_required: 1000, min_tier: 'silver', type: 'discount', discount_value: 10 },
  { id: '3', title: 'Free Room Upgrade', description: 'Upgrade to a better room for free', points_required: 2000, min_tier: 'gold', type: 'upgrade', discount_value: 0 },
  { id: '4', title: 'Airport Transfer', description: 'Free airport pickup or dropoff', points_required: 3000, min_tier: 'gold', type: 'service', discount_value: 0 },
  { id: '5', title: '25% Super Discount', description: 'Massive 25% off any service', points_required: 5000, min_tier: 'platinum', type: 'discount', discount_value: 25 },
  { id: '6', title: 'VIP Experience Package', description: 'Premium amenities and priority service', points_required: 7500, min_tier: 'platinum', type: 'gift', discount_value: 0 },
];

// Customer Loyalty View
function Loyalty() {
  const { user } = useAuth();
  const [selectedReward, setSelectedReward] = useState(null);
  const [showRedeemDialog, setShowRedeemDialog] = useState(false);
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState(false);
  const [activeTab, setActiveTab] = useState('my-rewards');
  const [redeemSuccess, setRedeemSuccess] = useState(null);
  const [loyaltyProgram, setLoyaltyProgram] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [rewards, setRewards] = useState(DEFAULT_REWARDS);
  const [redemptions, setRedemptions] = useState([]);
  const [referralInfo, setReferralInfo] = useState(null);
  const TIER_SYMBOLS = { bronze: '🥉', silver: '🥈', gold: '🥇', platinum: '💎' };
  const TIER_ORDER = ['bronze', 'silver', 'gold', 'platinum'];
  const TIER_THRESHOLDS_LOCAL = { bronze: 0, silver: 1000, gold: 5000, platinum: 15000 };
  useEffect(() => { loadLoyaltyData(); }, []);
  const loadLoyaltyData = async () => {
    setLoading(true);
    try {
      const [programRes, txRes, rewardsRes, redemptionsRes, referralRes] = await Promise.all([
        api.get('/loyalty/program'), api.get('/loyalty/transactions'), api.get('/loyalty/rewards'),
        api.get('/loyalty/redemptions'), api.get('/loyalty/referral').catch(() => ({ data: null }))
      ]);
      const program = programRes.data;
      const currentTierIdx = TIER_ORDER.indexOf(program.tier || 'bronze');
      const nextTier = currentTierIdx < TIER_ORDER.length - 1 ? TIER_ORDER[currentTierIdx + 1] : null;
      const currentThreshold = TIER_THRESHOLDS_LOCAL[program.tier || 'bronze'];
      const nextThreshold = nextTier ? TIER_THRESHOLDS_LOCAL[nextTier] : TIER_THRESHOLDS_LOCAL.platinum;
      const progress = nextTier ? ((program.total_points - currentThreshold) / (nextThreshold - currentThreshold)) * 100 : 100;
      setLoyaltyProgram({ ...program, tier: program.tier || 'bronze', tier_progress: Math.min(Math.max(progress, 0), 100), next_tier: nextTier, points_to_next_tier: nextTier ? Math.max(0, nextThreshold - program.total_points) : 0, member_since: program.joined_at || program.created_at });
      setTransactions(txRes.data.transactions || []);
      if (rewardsRes.data.rewards?.length > 0) setRewards(rewardsRes.data.rewards);
      setRedemptions(redemptionsRes.data.redemptions || []);
      if (referralRes.data) setReferralInfo(referralRes.data);
    } catch (error) {
      setLoyaltyProgram({ tier: 'bronze', total_points: 0, available_points: 0, tier_progress: 0, next_tier: 'silver', points_to_next_tier: 1000, member_since: new Date().toISOString() });
    } finally { setLoading(false); }
  };
  const currentTierConfig = TIER_CONFIG[loyaltyProgram?.tier || 'bronze'] || TIER_CONFIG.bronze;
  const handleRedeemReward = (reward) => { setSelectedReward(reward); setRedeemSuccess(null); setShowRedeemDialog(true); };
  const confirmRedemption = async () => {
    if (!selectedReward) return;
    setRedeeming(true);
    try {
      const res = await api.post(`/loyalty/redeem/${selectedReward.id}`);
      setRedeemSuccess({ code: res.data.redemption_code, expires_at: res.data.expires_at, reward_name: selectedReward.title, points_used: res.data.points_used });
      toast.success('Reward redeemed!');
      loadLoyaltyData();
    } catch (error) { toast.error(error.response?.data?.detail || 'Failed to redeem'); }
    finally { setRedeeming(false); }
  };
  const [copiedCode, setCopiedCode] = useState(null);
  const copyCode = async (code) => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      // Fallback for non-HTTPS
      const ta = document.createElement('textarea');
      ta.value = code;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopiedCode(code);
    toast.success('Code copied to clipboard!');
    setTimeout(() => setCopiedCode(null), 2000);
  };
  const getExpiryInfo = (expiresAt) => {
    if (!expiresAt) return { text: 'No expiry', color: 'text-slate-400' };
    const daysLeft = Math.ceil((new Date(expiresAt) - new Date()) / 86400000);
    if (daysLeft < 0) return { text: 'Expired', color: 'text-red-600' };
    if (daysLeft <= 7) return { text: `${daysLeft}d left`, color: 'text-amber-600' };
    return { text: `${daysLeft}d left`, color: 'text-slate-500' };
  };
  const redeemedRewardIds = new Set(redemptions.map(r => r.reward_id));
  const availableRewards = rewards.filter(r => !redeemedRewardIds.has(r.id));
  if (loading) return <div className="min-h-[400px] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[#082c59]" /></div>;
  if (!loyaltyProgram) return <div className="min-h-[400px] flex items-center justify-center text-slate-500">Unable to load</div>;
  return (
    <div className="space-y-6">
      {/* Tier Card */}
      <Card className={`border ${currentTierConfig.borderColor} overflow-hidden`}><CardContent className="p-0">
        <div className={`bg-gradient-to-r ${currentTierConfig.color} p-6 text-white`}><div className="flex items-center justify-between"><div className="flex items-center gap-4"><span className="text-5xl">{TIER_SYMBOLS[loyaltyProgram.tier]}</span><div><p className="text-white/70 text-sm">Current Tier</p><h2 className="text-2xl font-bold">{currentTierConfig.name} Member</h2><p className="text-white/60 text-xs mt-0.5">Since {loyaltyProgram.member_since ? formatDateShort(loyaltyProgram.member_since) : 'N/A'}</p></div></div><div className="text-right hidden sm:block"><p className="text-3xl font-bold">{(loyaltyProgram.available_points || 0).toLocaleString()}</p><p className="text-white/70 text-sm">available points</p></div></div></div>
        <div className="p-5"><div className="grid grid-cols-3 gap-4 text-center"><div className="p-3 bg-slate-50 rounded-xl"><p className="text-xl font-bold text-slate-900">{(loyaltyProgram.available_points || 0).toLocaleString()}</p><p className="text-xs text-slate-500">Available</p></div><div className="p-3 bg-slate-50 rounded-xl"><p className="text-xl font-bold text-slate-900">{(loyaltyProgram.total_points || 0).toLocaleString()}</p><p className="text-xs text-slate-500">Total Earned</p></div><div className="p-3 bg-slate-50 rounded-xl"><p className="text-xl font-bold text-slate-900">{((loyaltyProgram.total_points || 0) - (loyaltyProgram.available_points || 0)).toLocaleString()}</p><p className="text-xs text-slate-500">Redeemed</p></div></div></div>
      </CardContent></Card>

      {/* Redeemable Codes */}
      <Card className="border border-slate-200"><CardContent className="p-5">
        <div className="flex items-center gap-2 mb-4"><div className="p-2 bg-violet-50 rounded-lg"><Gift className="w-4 h-4 text-violet-600" /></div><h3 className="font-bold text-slate-900">Redeemable Codes</h3><Badge className="bg-slate-100 text-slate-600 text-xs">{redemptions.filter(r => r.status === 'pending' || r.status === 'active').length + 1}</Badge></div>
        <div className="space-y-2">
          <div className="flex items-center justify-between p-3 bg-blue-50/60 rounded-xl border border-blue-100"><div className="flex items-center gap-3"><div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center"><Users className="w-4 h-4 text-blue-600" /></div><div><p className="font-medium text-sm text-slate-900">Refer a Friend</p><p className="text-xs text-slate-500">Share to earn 10 pts per referral</p></div></div><div className="flex items-center gap-2"><span className="font-mono font-bold text-sm text-blue-800 bg-blue-100 px-2.5 py-1 rounded">{referralInfo?.code || '...'}</span><Button variant="ghost" size="icon" className={`h-8 w-8 transition-colors ${copiedCode === (referralInfo?.code || '') ? 'text-emerald-600' : ''}`} onClick={() => copyCode(referralInfo?.code || '')} data-testid="copy-referral-btn">{copiedCode === (referralInfo?.code || '') ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-blue-600" />}</Button></div></div>
          {redemptions.filter(r => r.status === 'pending' || r.status === 'active').map(rd => { const expiry = getExpiryInfo(rd.expires_at); return (
            <div key={rd.id || rd.code} className="flex items-center justify-between p-3 bg-violet-50/40 rounded-xl border border-violet-100"><div className="flex items-center gap-3"><div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center"><Sparkles className="w-4 h-4 text-violet-600" /></div><div><p className="font-medium text-sm text-slate-900">{rd.reward_name || rd.reward_title}</p><div className="flex items-center gap-2 mt-0.5"><span className={`text-xs ${expiry.color}`}>{expiry.text}</span>{rd.expires_at && <span className="text-xs text-slate-400">(Exp: {formatDateShort(rd.expires_at)})</span>}</div></div></div><div className="flex items-center gap-2"><span className="font-mono font-bold text-sm text-violet-800 bg-violet-100 px-2.5 py-1 rounded">{rd.code}</span><Button variant="ghost" size="icon" className={`h-8 w-8 ${copiedCode === rd.code ? 'text-emerald-600' : ''}`} onClick={() => copyCode(rd.code)}>{copiedCode === rd.code ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-violet-600" />}</Button></div></div>
          ); })}
          {redemptions.filter(r => r.status === 'pending' || r.status === 'active').length === 0 && <p className="text-xs text-slate-400 text-center py-2">No active reward codes yet. Redeem a reward to get one!</p>}
        </div>
      </CardContent></Card>

      {/* 3-Tab */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 bg-slate-100 p-1 rounded-xl"><TabsTrigger value="my-rewards" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm text-sm"><Crown className="h-4 w-4 mr-1.5" /> My Rewards</TabsTrigger><TabsTrigger value="activity" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm text-sm"><TrendingUp className="h-4 w-4 mr-1.5" /> Activity</TabsTrigger><TabsTrigger value="rewards" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm text-sm"><Gift className="h-4 w-4 mr-1.5" /> Rewards</TabsTrigger></TabsList>

        <TabsContent value="my-rewards" className="space-y-6">
          <Card><CardHeader><CardTitle className="flex items-center gap-2"><Crown className="w-5 h-5 text-amber-500" /> Tier Roadmap</CardTitle></CardHeader><CardContent>
            <div className="relative"><div className="flex items-center justify-between mb-2">{TIER_ORDER.map((tier, i) => { const cfg = TIER_CONFIG[tier]; const isActive = loyaltyProgram.tier === tier; const isUnlocked = TIER_ORDER.indexOf(loyaltyProgram.tier) >= i; return (<div key={tier} className="flex flex-col items-center flex-1"><div className={`w-14 h-14 rounded-full flex items-center justify-center border-3 transition-all ${isActive ? `bg-gradient-to-br ${cfg.color} text-white shadow-lg scale-110` : isUnlocked ? `${cfg.bgColor} ${cfg.borderColor} border-2` : 'bg-slate-100 border-2 border-slate-200'}`}><span className="text-2xl">{TIER_SYMBOLS[tier]}</span></div><p className={`text-xs font-semibold mt-2 ${isActive ? cfg.textColor : isUnlocked ? 'text-slate-700' : 'text-slate-400'}`}>{cfg.name}</p><p className="text-[10px] text-slate-400">{TIER_THRESHOLDS_LOCAL[tier].toLocaleString()} pts</p></div>); })}</div><div className="absolute top-7 left-[12%] right-[12%] h-1 bg-slate-200 rounded -z-10"><div className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded transition-all" style={{ width: `${Math.min(100, (TIER_ORDER.indexOf(loyaltyProgram.tier) / 3) * 100 + (loyaltyProgram.tier_progress / 3))}%` }} /></div></div>
            {loyaltyProgram.next_tier && <div className="mt-6 p-4 bg-slate-50 rounded-xl"><div className="flex items-center justify-between mb-2"><span className="text-sm text-slate-600">Progress to <strong>{TIER_CONFIG[loyaltyProgram.next_tier]?.name}</strong></span><span className="text-sm font-bold text-slate-900">{Math.round(loyaltyProgram.tier_progress)}%</span></div><Progress value={loyaltyProgram.tier_progress} className="h-2.5" /><p className="text-xs text-slate-500 mt-1.5">{(loyaltyProgram.points_to_next_tier || 0).toLocaleString()} more points to {TIER_SYMBOLS[loyaltyProgram.next_tier]} {TIER_CONFIG[loyaltyProgram.next_tier]?.name}</p></div>}
          </CardContent></Card>
          <Card><CardHeader><CardTitle className="flex items-center gap-2"><Trophy className="w-5 h-5 text-violet-500" /> All Redeemed</CardTitle></CardHeader><CardContent>
            {redemptions.length === 0 ? <div className="text-center py-8"><Trophy className="h-12 w-12 text-slate-200 mx-auto mb-3" /><p className="text-slate-500">No rewards redeemed yet</p></div> : <div className="space-y-2">{redemptions.map(rd => { const expiry = getExpiryInfo(rd.expires_at); return (<div key={rd.id || rd.code} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"><div className="flex items-center gap-3"><Gift className="w-5 h-5 text-violet-500" /><div><p className="font-medium text-sm">{rd.reward_name || rd.reward_title}</p><div className="flex items-center gap-2"><span className="text-xs text-slate-400">Code: <span className="font-mono font-bold">{rd.code}</span></span><span className={`text-xs ${expiry.color}`}>{expiry.text}</span>{rd.expires_at && <span className="text-xs text-slate-400">(Exp: {formatDateShort(rd.expires_at)})</span>}</div></div></div><div className="flex items-center gap-2"><Badge className={rd.status === 'pending' || rd.status === 'active' ? 'bg-green-100 text-green-700' : rd.status === 'used' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}>{rd.status}</Badge><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyCode(rd.code)}><Copy className="h-3.5 w-3.5" /></Button></div></div>); })}</div>}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="activity"><Card><CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="w-5 h-5 text-emerald-500" /> Points Activity</CardTitle></CardHeader><CardContent>
          {transactions.length === 0 ? <div className="text-center py-8"><Clock className="w-12 h-12 text-slate-200 mx-auto mb-3" /><p className="text-slate-500">No activity yet</p></div> : <div className="space-y-2">{transactions.map((tx, i) => { const isEarn = tx.transaction_type === 'earn' || tx.type === 'earn'; return (<div key={tx.id || i} className={`flex items-center justify-between p-3.5 rounded-xl border ${isEarn ? 'bg-emerald-50/50 border-emerald-100' : 'bg-red-50/50 border-red-100'}`}><div className="flex items-center gap-3"><div className={`w-9 h-9 rounded-lg flex items-center justify-center ${isEarn ? 'bg-emerald-100' : 'bg-red-100'}`}>{isEarn ? <TrendingUp className="h-4 w-4 text-emerald-600" /> : <Gift className="h-4 w-4 text-red-500" />}</div><div><p className="font-medium text-sm text-slate-900">{tx.description}</p><p className="text-xs text-slate-400">{tx.created_at ? formatDateShort(tx.created_at) : ''}{tx.service_type ? ` \u00B7 ${tx.service_type}` : ''}</p></div></div><span className={`font-bold text-sm ${isEarn ? 'text-emerald-700' : 'text-red-600'}`}>{isEarn ? '+' : ''}{tx.points?.toLocaleString()} pts</span></div>); })}</div>}
        </CardContent></Card></TabsContent>

        <TabsContent value="rewards" className="space-y-4">
          {availableRewards.length === 0 ? <Card><CardContent className="py-12 text-center"><Gift className="w-12 h-12 text-slate-200 mx-auto mb-3" /><p className="text-slate-500">All rewards redeemed!</p></CardContent></Card> : <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{availableRewards.map(reward => { const canRedeem = loyaltyProgram.available_points >= reward.points_required; const tierIdx = TIER_ORDER.indexOf(loyaltyProgram.tier); const rewardTierIdx = TIER_ORDER.indexOf(reward.min_tier); const tierUnlocked = tierIdx >= rewardTierIdx; const pointsNeeded = Math.max(0, reward.points_required - loyaltyProgram.available_points); const rewardTierCfg = TIER_CONFIG[reward.min_tier] || TIER_CONFIG.bronze; return (<Card key={reward.id} className={`overflow-hidden transition-all border ${!tierUnlocked ? 'opacity-50' : canRedeem ? 'border-emerald-200 shadow-sm' : 'border-slate-200'}`}><CardContent className="p-5"><div className="flex items-start justify-between mb-3"><div className={`p-2.5 rounded-xl ${rewardTierCfg.bgColor}`}>{reward.type === 'discount' ? <Percent className="h-5 w-5 text-slate-600" /> : <Gift className="h-5 w-5 text-slate-600" />}</div><Badge className={`${rewardTierCfg.bgColor} ${rewardTierCfg.textColor} text-xs`}>{TIER_SYMBOLS[reward.min_tier]} {rewardTierCfg.name}+</Badge></div><h4 className="font-bold text-slate-900 mb-1">{reward.title}</h4><p className="text-sm text-slate-500 mb-2">{reward.description}</p>{reward.valid_to && <p className="text-xs text-amber-600 mb-2">Expires: {formatDateShort(reward.valid_to)}</p>}<div className="mb-3"><div className="flex justify-between items-center mb-1"><span className="text-lg font-bold text-[#082c59]">{reward.points_required?.toLocaleString()} pts</span>{canRedeem && <Badge className="bg-emerald-100 text-emerald-700 text-xs"><Check className="h-3 w-3 mr-0.5" /> Ready</Badge>}</div><Progress value={Math.min(100, (loyaltyProgram.available_points / reward.points_required) * 100)} className="h-1.5" />{!canRedeem && <p className="text-xs text-slate-400 mt-1">{pointsNeeded.toLocaleString()} more needed</p>}</div><Button onClick={() => handleRedeemReward(reward)} disabled={!canRedeem || !tierUnlocked} className={`w-full ${canRedeem && tierUnlocked ? 'bg-[#082c59] hover:bg-[#0a3a75]' : ''}`} variant={canRedeem && tierUnlocked ? 'default' : 'outline'}>{!tierUnlocked ? 'Tier Locked' : canRedeem ? 'Redeem Now' : `Need ${pointsNeeded.toLocaleString()} pts`}</Button></CardContent></Card>); })}</div>}
        </TabsContent>
      </Tabs>

      {/* Redeem Dialog with Success */}
      <Dialog open={showRedeemDialog} onOpenChange={(open) => { setShowRedeemDialog(open); if (!open) setRedeemSuccess(null); }}>
        <DialogContent className="bg-white">
          {redeemSuccess ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 mx-auto mb-4 bg-emerald-100 rounded-full flex items-center justify-center"><Check className="w-8 h-8 text-emerald-600" /></div>
              <h3 className="text-xl font-bold text-slate-900 mb-1">Reward Redeemed!</h3>
              <p className="text-sm text-slate-500 mb-5">{redeemSuccess.reward_name}</p>
              <div className="bg-slate-50 rounded-xl p-5 mb-4">
                <p className="text-xs text-slate-400 uppercase font-semibold mb-2">Your Redemption Code</p>
                <div className="flex items-center justify-center gap-2 mb-2"><span className="text-2xl font-mono font-bold text-[#082c59] tracking-widest bg-white px-4 py-2 rounded-lg border-2 border-dashed border-blue-200">{redeemSuccess.code}</span></div>
                <Button variant="outline" onClick={() => copyCode(redeemSuccess.code)} className="gap-2" data-testid="copy-redeemed-code"><Copy className="h-4 w-4" /> Copy Code</Button>
              </div>
              <div className="flex items-center justify-between text-sm p-3 bg-amber-50 rounded-lg border border-amber-100"><span className="text-amber-700">Expires:</span><span className="font-medium text-amber-800">{redeemSuccess.expires_at ? formatDateShort(redeemSuccess.expires_at) : '30 days'}</span></div>
              <p className="text-xs text-slate-400 mt-3">Find this code in your Redeemable Codes section.</p>
              <Button onClick={() => setShowRedeemDialog(false)} className="mt-4 bg-[#082c59] hover:bg-[#0a3a75]">Done</Button>
            </div>
          ) : (
            <><DialogHeader><DialogTitle>Confirm Redemption</DialogTitle><DialogDescription>This will deduct points from your balance.</DialogDescription></DialogHeader>
            {selectedReward && <div className="p-4 bg-slate-50 rounded-lg space-y-3"><h4 className="font-bold text-lg">{selectedReward.title}</h4><p className="text-slate-600 text-sm">{selectedReward.description}</p><div className="flex items-center justify-between"><span className="text-slate-500 text-sm">Points Required:</span><span className="font-bold text-[#082c59]">{selectedReward.points_required?.toLocaleString()}</span></div><div className="flex items-center justify-between"><span className="text-slate-500 text-sm">Balance After:</span><span className="font-bold text-emerald-600">{((loyaltyProgram.available_points || 0) - (selectedReward.points_required || 0)).toLocaleString()}</span></div></div>}
            <DialogFooter><Button variant="outline" onClick={() => setShowRedeemDialog(false)}>Cancel</Button><Button onClick={confirmRedemption} disabled={redeeming} className="bg-[#082c59] hover:bg-[#0a3a75]">{redeeming ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Confirm Redemption</Button></DialogFooter></>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Admin Loyalty Program Management View
function AdminLoyaltyView() {
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
    } finally {
      setLoading(false);
    }
  };

  const [savingReward, setSavingReward] = useState(false);

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
    } finally {
      setSavingReward(false);
    }
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
    } catch (error) { toast.error('Failed to delete reward'); }
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

  const TIER_SYMBOLS = { bronze: '🥉', silver: '🥈', gold: '🥇', platinum: '💎' };
  const REWARD_TYPE_ICONS = { discount: Percent, upgrade: TrendingUp, service: Gift, gift: Sparkles };

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
              <div>
                <p className="text-blue-200 text-xs font-medium uppercase tracking-wide">Total Members</p>
                <p className="text-3xl font-bold mt-1">{programStats.totalMembers.toLocaleString()}</p>
              </div>
              <Users className="h-10 w-10 text-blue-300/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-500 to-orange-600 border-0 text-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-amber-200 text-xs font-medium uppercase tracking-wide">Points Issued</p>
                <p className="text-3xl font-bold mt-1">{programStats.totalPointsIssued.toLocaleString()}</p>
              </div>
              <Coins className="h-10 w-10 text-amber-300/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-500 to-teal-600 border-0 text-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-emerald-200 text-xs font-medium uppercase tracking-wide">Points Redeemed</p>
                <p className="text-3xl font-bold mt-1">{programStats.totalPointsRedeemed.toLocaleString()}</p>
              </div>
              <Gift className="h-10 w-10 text-emerald-300/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-violet-500 to-purple-600 border-0 text-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-violet-200 text-xs font-medium uppercase tracking-wide">Active Rewards</p>
                <p className="text-3xl font-bold mt-1">{rewards.filter(r => r.is_active !== false).length}</p>
              </div>
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
          {/* Tier Distribution Visual */}
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

              {/* Tier Legend */}
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

          {/* Points Flow + Earning Rules */}
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
                              <div>
                                <p className="font-medium">{member.name}</p>
                                <p className="text-xs text-slate-500">{member.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <Badge className={`${tierCfg.bgColor} ${tierCfg.textColor} capitalize`}>{member.tier}</Badge>
                          </td>
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
            {/* Tier Card */}
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

            {/* Transactions */}
            <div>
              <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">Point Activity</h4>
              {memberDetail?.transactions?.length > 0 ? (
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {memberDetail.transactions.map((tx, i) => (
                    <div key={i} className={`flex items-center justify-between p-3 rounded-lg ${tx.transaction_type === 'earn' ? 'bg-emerald-50' : 'bg-red-50'}`}>
                      <div className="flex items-center gap-2">
                        {tx.transaction_type === 'earn' ? <TrendingUp className="w-4 h-4 text-emerald-600" /> : <Gift className="w-4 h-4 text-red-500" />}
                        <div>
                          <p className="text-sm font-medium">{tx.description || tx.transaction_type}</p>
                          <p className="text-xs text-slate-400">{tx.created_at ? formatDateShort(tx.created_at) : ''}</p>
                        </div>
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

            {/* Redemptions */}
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

// Main Loyalty Export - Determines which view to show
export default function LoyaltyPage() {
  const { user, isOperatorUser } = useAuth();
  
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const isOperator = user?.role === 'operator' || isOperatorUser;
  
  // Operators don't have access to loyalty
  if (isOperator && !isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md text-center p-8">
          <Award className="h-16 w-16 text-slate-300 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-700 mb-2">Access Restricted</h2>
          <p className="text-slate-500">The loyalty program is only available for customers.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#082c59]" data-testid="loyalty-title">
            {isAdmin ? 'Loyalty Program' : 'Loyalty Rewards'}
          </h1>
          <p className="text-slate-600">
            {isAdmin 
              ? 'Manage and configure the loyalty program'
              : 'Earn points and redeem exclusive rewards'}
          </p>
        </div>
      </div>

      {/* Render appropriate view */}
      {isAdmin ? <AdminLoyaltyView /> : <Loyalty />}
    </div>
  );
}
