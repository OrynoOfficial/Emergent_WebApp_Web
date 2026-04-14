import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Progress } from '../../components/ui/progress';
import { Input } from '../../components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../../components/ui/collapsible';
import {
  TrendingUp, Gift, Crown, Trophy, Check, Copy, Sparkles, Clock,
  Loader2, Percent, Users, ChevronDown, Tag, Store, Search, Filter, X
} from 'lucide-react';
import { formatDateShort } from '../../utils/dateUtils';
import api from '../../api/client';
import { toast } from 'sonner';
import { TIER_CONFIG, TIER_SYMBOLS, TIER_ORDER, TIER_THRESHOLDS, DEFAULT_REWARDS, getExpiryInfo } from './constants';

export default function CustomerLoyaltyView() {
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
  const [copiedCode, setCopiedCode] = useState(null);
  const [approvedPromos, setApprovedPromos] = useState([]);
  const [promoRedemptions, setPromoRedemptions] = useState([]);
  const [codesOpen, setCodesOpen] = useState(false);
  const [redeemedOpen, setRedeemedOpen] = useState(false);
  const [selectedPromo, setSelectedPromo] = useState(null);
  const [showPromoRedeemDialog, setShowPromoRedeemDialog] = useState(false);
  const [redeemingPromo, setRedeemingPromo] = useState(false);
  const [promoRedeemSuccess, setPromoRedeemSuccess] = useState(null);

  // Search & filter states
  const [codesSearch, setCodesSearch] = useState('');
  const [codesFilter, setCodesFilter] = useState('all'); // all, referral, loyalty, operator
  const [redeemedSearch, setRedeemedSearch] = useState('');
  const [redeemedFilter, setRedeemedFilter] = useState('all'); // all, active, used, expired, loyalty, operator
  const [rewardsSearch, setRewardsSearch] = useState('');
  const [rewardsFilter, setRewardsFilter] = useState('all'); // all, available, locked, promotion
  const [activityFilter, setActivityFilter] = useState('all'); // all, earn, redeem

  useEffect(() => { loadLoyaltyData(); }, []);

  const loadLoyaltyData = async () => {
    setLoading(true);
    try {
      const [programRes, txRes, rewardsRes, redemptionsRes, referralRes, promosRes, promoRedemptionsRes] = await Promise.all([
        api.get('/loyalty/program'), api.get('/loyalty/transactions'), api.get('/loyalty/rewards'),
        api.get('/loyalty/redemptions'), api.get('/loyalty/referral').catch(() => ({ data: null })),
        api.get('/subscriptions/user-alerts').catch(() => ({ data: { alerts: [] } })),
        api.get('/subscriptions/promotions/my-redeemed').catch(() => ({ data: { redemptions: [] } }))
      ]);
      const program = programRes.data;
      const currentTierIdx = TIER_ORDER.indexOf(program.tier || 'bronze');
      const nextTier = currentTierIdx < TIER_ORDER.length - 1 ? TIER_ORDER[currentTierIdx + 1] : null;
      const currentThreshold = TIER_THRESHOLDS[program.tier || 'bronze'];
      const nextThreshold = nextTier ? TIER_THRESHOLDS[nextTier] : TIER_THRESHOLDS.platinum;
      const progress = nextTier ? ((program.total_points - currentThreshold) / (nextThreshold - currentThreshold)) * 100 : 100;
      setLoyaltyProgram({
        ...program, tier: program.tier || 'bronze',
        tier_progress: Math.min(Math.max(progress, 0), 100),
        next_tier: nextTier,
        points_to_next_tier: nextTier ? Math.max(0, nextThreshold - program.total_points) : 0,
        member_since: program.joined_at || program.created_at
      });
      setTransactions(txRes.data.transactions || []);
      if (rewardsRes.data.rewards?.length > 0) setRewards(rewardsRes.data.rewards);
      setRedemptions(redemptionsRes.data.redemptions || []);
      if (referralRes.data) setReferralInfo(referralRes.data);
      const allAlerts = promosRes.data?.alerts || [];
      const redeemedPromoIds = new Set((promoRedemptionsRes.data?.redemptions || []).map(r => r.promotion_id));
      setApprovedPromos(allAlerts.filter(a => a.type === 'promotion' && a.status === 'approved' && !redeemedPromoIds.has(a.id)));
      setPromoRedemptions(promoRedemptionsRes.data?.redemptions || []);
    } catch {
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

  const handleRedeemPromo = (promo) => { setSelectedPromo(promo); setPromoRedeemSuccess(null); setShowPromoRedeemDialog(true); };

  const confirmPromoRedemption = async () => {
    if (!selectedPromo) return;
    setRedeemingPromo(true);
    try {
      const res = await api.post(`/subscriptions/promotions/${selectedPromo.id}/redeem`);
      setPromoRedeemSuccess({ code: res.data.code, expires_at: res.data.expires_at, operator_name: res.data.operator_name, service_type: res.data.service_type, promo_title: selectedPromo.title });
      toast.success('Promotion redeemed! Code generated.');
      setCodesOpen(true);
      loadLoyaltyData();
    } catch (error) { toast.error(error.response?.data?.detail || 'Failed to redeem promotion'); }
    finally { setRedeemingPromo(false); }
  };

  const copyCode = async (code) => {
    if (!code) return;
    try { await navigator.clipboard.writeText(code); } catch {
      const ta = document.createElement('textarea'); ta.value = code; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
    }
    setCopiedCode(code);
    toast.success('Code copied!');
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Derived lists
  const redeemedRewardIds = new Set(redemptions.map(r => r.reward_id));
  const availableRewards = rewards.filter(r => !redeemedRewardIds.has(r.id));
  const activeLoyaltyCodes = redemptions.filter(r => r.status === 'pending' || r.status === 'active');
  const activePromoCodes = promoRedemptions.filter(r => r.status === 'active');
  const usedPromoCodes = promoRedemptions.filter(r => r.status === 'used');
  const totalActiveCodes = activeLoyaltyCodes.length + activePromoCodes.length + 1;

  // ---- Filtered lists (memoized) ----

  // Redeemable codes filtering
  const filteredActiveCodes = useMemo(() => {
    const q = codesSearch.toLowerCase();
    let loyaltyCodes = activeLoyaltyCodes;
    let promoCodes = activePromoCodes;
    let showReferral = true;

    if (codesFilter === 'referral') { loyaltyCodes = []; promoCodes = []; }
    else if (codesFilter === 'loyalty') { promoCodes = []; showReferral = false; }
    else if (codesFilter === 'operator') { loyaltyCodes = []; showReferral = false; }

    if (q) {
      loyaltyCodes = loyaltyCodes.filter(r => (r.reward_name || r.reward_title || '').toLowerCase().includes(q) || (r.code || '').toLowerCase().includes(q));
      promoCodes = promoCodes.filter(r => (r.promotion_title || '').toLowerCase().includes(q) || (r.code || '').toLowerCase().includes(q) || (r.operator_name || '').toLowerCase().includes(q));
      showReferral = showReferral && ((referralInfo?.code || '').toLowerCase().includes(q) || 'refer a friend'.includes(q));
    }
    return { loyaltyCodes, promoCodes, showReferral };
  }, [activeLoyaltyCodes, activePromoCodes, referralInfo, codesSearch, codesFilter]);

  // All redeemed filtering
  const filteredRedeemed = useMemo(() => {
    const q = redeemedSearch.toLowerCase();
    let allItems = [
      ...usedPromoCodes.map(r => ({ ...r, _source: 'operator' })),
      ...activePromoCodes.map(r => ({ ...r, _source: 'operator' })),
      ...redemptions.map(r => ({ ...r, _source: 'loyalty' })),
    ];
    if (redeemedFilter === 'active') allItems = allItems.filter(r => r.status === 'active' || r.status === 'pending');
    else if (redeemedFilter === 'used') allItems = allItems.filter(r => r.status === 'used');
    else if (redeemedFilter === 'expired') allItems = allItems.filter(r => r.status === 'expired');
    else if (redeemedFilter === 'loyalty') allItems = allItems.filter(r => r._source === 'loyalty');
    else if (redeemedFilter === 'operator') allItems = allItems.filter(r => r._source === 'operator');
    if (q) {
      allItems = allItems.filter(r =>
        (r.promotion_title || r.reward_name || r.reward_title || '').toLowerCase().includes(q) ||
        (r.code || '').toLowerCase().includes(q) ||
        (r.operator_name || '').toLowerCase().includes(q)
      );
    }
    return allItems;
  }, [usedPromoCodes, activePromoCodes, redemptions, redeemedSearch, redeemedFilter]);

  // Rewards tab filtering
  const filteredRewards = useMemo(() => {
    const q = rewardsSearch.toLowerCase();
    let list = availableRewards;
    if (rewardsFilter === 'available') list = list.filter(r => loyaltyProgram && loyaltyProgram.available_points >= r.points_required);
    else if (rewardsFilter === 'locked') list = list.filter(r => loyaltyProgram && loyaltyProgram.available_points < r.points_required);
    if (q) list = list.filter(r => r.title.toLowerCase().includes(q) || (r.description || '').toLowerCase().includes(q));
    let promos = approvedPromos;
    if (rewardsFilter === 'available' || rewardsFilter === 'locked') promos = rewardsFilter === 'promotion' ? approvedPromos : (rewardsFilter === 'available' ? approvedPromos : []);
    if (rewardsFilter === 'promotion') list = [];
    if (q) promos = promos.filter(p => p.title.toLowerCase().includes(q) || (p.message || '').toLowerCase().includes(q) || (p.operator_name || '').toLowerCase().includes(q));
    return { rewards: list, promos };
  }, [availableRewards, approvedPromos, loyaltyProgram, rewardsSearch, rewardsFilter]);

  // Activity filtering
  const filteredTransactions = useMemo(() => {
    if (activityFilter === 'all') return transactions;
    return transactions.filter(tx => {
      const type = tx.transaction_type || tx.type;
      return type === activityFilter;
    });
  }, [transactions, activityFilter]);

  const totalRedeemedCount = redemptions.length + promoRedemptions.length;

  if (loading) return <div className="min-h-[400px] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[#082c59]" /></div>;
  if (!loyaltyProgram) return <div className="min-h-[400px] flex items-center justify-center text-slate-500">Unable to load</div>;

  return (
    <div className="space-y-6">
      {/* Tier Card */}
      <Card className={`border ${currentTierConfig.borderColor} overflow-hidden`}><CardContent className="p-0">
        <div className={`bg-gradient-to-r ${currentTierConfig.color} p-6 text-white`}><div className="flex items-center justify-between"><div className="flex items-center gap-4"><span className="text-5xl">{TIER_SYMBOLS[loyaltyProgram.tier]}</span><div><p className="text-white/70 text-sm">Current Tier</p><h2 className="text-2xl font-bold">{currentTierConfig.name} Member</h2><p className="text-white/60 text-xs mt-0.5">Since {loyaltyProgram.member_since ? formatDateShort(loyaltyProgram.member_since) : 'N/A'}</p></div></div><div className="text-right hidden sm:block"><p className="text-3xl font-bold">{(loyaltyProgram.available_points || 0).toLocaleString()}</p><p className="text-white/70 text-sm">available points</p></div></div></div>
        <div className="p-5"><div className="grid grid-cols-3 gap-4 text-center"><div className="p-3 bg-slate-50 rounded-xl"><p className="text-xl font-bold text-slate-900">{(loyaltyProgram.available_points || 0).toLocaleString()}</p><p className="text-xs text-slate-500">Available</p></div><div className="p-3 bg-slate-50 rounded-xl"><p className="text-xl font-bold text-slate-900">{(loyaltyProgram.total_points || 0).toLocaleString()}</p><p className="text-xs text-slate-500">Total Earned</p></div><div className="p-3 bg-slate-50 rounded-xl"><p className="text-xl font-bold text-slate-900">{((loyaltyProgram.total_points || 0) - (loyaltyProgram.available_points || 0)).toLocaleString()}</p><p className="text-xs text-slate-500">Redeemed</p></div></div></div>
      </CardContent></Card>

      {/* Collapsible Redeemable Codes */}
      <Collapsible open={codesOpen} onOpenChange={setCodesOpen}>
        <Card className="border border-slate-200">
          <CollapsibleTrigger asChild>
            <button className="w-full flex items-center justify-between p-5 cursor-pointer hover:bg-slate-50/50 transition-colors rounded-t-lg" data-testid="redeemable-codes-toggle">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-violet-50 rounded-lg"><Gift className="w-4 h-4 text-violet-600" /></div>
                <h3 className="font-bold text-slate-900">Redeemable Codes</h3>
                <Badge className="bg-slate-100 text-slate-600 text-xs">{totalActiveCodes}</Badge>
              </div>
              <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${codesOpen ? 'rotate-180' : ''}`} />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 px-5 pb-5">
              {/* Search & Filter bar */}
              <div className="flex items-center gap-2 mb-3">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <Input value={codesSearch} onChange={e => setCodesSearch(e.target.value)} placeholder="Search codes..." className="h-8 pl-8 text-sm" data-testid="codes-search-input" />
                  {codesSearch && <button onClick={() => setCodesSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2"><X className="w-3.5 h-3.5 text-slate-400" /></button>}
                </div>
                <div className="flex items-center gap-1">
                  {['all', 'referral', 'loyalty', 'operator'].map(f => (
                    <Button key={f} variant={codesFilter === f ? 'default' : 'outline'} size="sm" className={`h-8 text-xs px-2.5 ${codesFilter === f ? 'bg-[#082c59]' : ''}`} onClick={() => setCodesFilter(f)} data-testid={`codes-filter-${f}`}>
                      {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                {/* Referral Code */}
                {filteredActiveCodes.showReferral && (codesFilter === 'all' || codesFilter === 'referral') && (
                  <div className="flex items-center justify-between p-3 bg-blue-50/60 rounded-xl border border-blue-100">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center"><Users className="w-4 h-4 text-blue-600" /></div>
                      <div><p className="font-medium text-sm text-slate-900">Refer a Friend</p><p className="text-xs text-slate-500">Share to earn 10 pts per referral</p></div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm text-blue-800 bg-blue-100 px-2.5 py-1 rounded">{referralInfo?.code || '...'}</span>
                      <Button variant="ghost" size="icon" className={`h-8 w-8 ${copiedCode === (referralInfo?.code || '') ? 'text-emerald-600' : ''}`} onClick={() => copyCode(referralInfo?.code || '')} data-testid="copy-referral-btn">
                        {copiedCode === (referralInfo?.code || '') ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-blue-600" />}
                      </Button>
                    </div>
                  </div>
                )}
                {/* Active Operator Promo Codes */}
                {filteredActiveCodes.promoCodes.map(rd => {
                  const expiry = getExpiryInfo(rd.expires_at);
                  return (
                    <div key={rd.id || rd.code} className="flex items-center justify-between p-3 bg-purple-50/40 rounded-xl border border-purple-100" data-testid={`promo-code-${rd.code}`}>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center"><Store className="w-4 h-4 text-purple-600" /></div>
                        <div>
                          <p className="font-medium text-sm text-slate-900">{rd.promotion_title}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge variant="outline" className="text-[10px] text-purple-600 border-purple-300 px-1.5 py-0">{rd.operator_name}</Badge>
                            {rd.service_type && <Badge variant="outline" className="text-[10px] text-slate-500 border-slate-300 px-1.5 py-0">{rd.service_type}</Badge>}
                            <span className={`text-xs ${expiry.color}`}>{expiry.text}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm text-purple-800 bg-purple-100 px-2.5 py-1 rounded">{rd.code}</span>
                        <Button variant="ghost" size="icon" className={`h-8 w-8 ${copiedCode === rd.code ? 'text-emerald-600' : ''}`} onClick={() => copyCode(rd.code)}>
                          {copiedCode === rd.code ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-purple-600" />}
                        </Button>
                      </div>
                    </div>
                  );
                })}
                {/* Active Loyalty Codes */}
                {filteredActiveCodes.loyaltyCodes.map(rd => {
                  const expiry = getExpiryInfo(rd.expires_at);
                  return (
                    <div key={rd.id || rd.code} className="flex items-center justify-between p-3 bg-violet-50/40 rounded-xl border border-violet-100">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center"><Sparkles className="w-4 h-4 text-violet-600" /></div>
                        <div>
                          <p className="font-medium text-sm text-slate-900">{rd.reward_name || rd.reward_title}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`text-xs ${expiry.color}`}>{expiry.text}</span>
                            {rd.expires_at && <span className="text-xs text-slate-400">(Exp: {formatDateShort(rd.expires_at)})</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm text-violet-800 bg-violet-100 px-2.5 py-1 rounded">{rd.code}</span>
                        <Button variant="ghost" size="icon" className={`h-8 w-8 ${copiedCode === rd.code ? 'text-emerald-600' : ''}`} onClick={() => copyCode(rd.code)}>
                          {copiedCode === rd.code ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-violet-600" />}
                        </Button>
                      </div>
                    </div>
                  );
                })}
                {!filteredActiveCodes.showReferral && filteredActiveCodes.loyaltyCodes.length === 0 && filteredActiveCodes.promoCodes.length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-2">No matching codes found.</p>
                )}
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Collapsible All Redeemed Codes */}
      <Collapsible open={redeemedOpen} onOpenChange={setRedeemedOpen}>
        <Card className="border border-slate-200">
          <CollapsibleTrigger asChild>
            <button className="w-full flex items-center justify-between p-5 cursor-pointer hover:bg-slate-50/50 transition-colors rounded-t-lg" data-testid="redeemed-codes-toggle">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-slate-100 rounded-lg"><Trophy className="w-4 h-4 text-violet-500" /></div>
                <h3 className="font-bold text-slate-900">All Redeemed</h3>
                <Badge className="bg-slate-100 text-slate-600 text-xs">{totalRedeemedCount}</Badge>
              </div>
              <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${redeemedOpen ? 'rotate-180' : ''}`} />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 px-5 pb-5">
              {/* Search & Filter bar */}
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <div className="relative flex-1 min-w-[160px]">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <Input value={redeemedSearch} onChange={e => setRedeemedSearch(e.target.value)} placeholder="Search redeemed..." className="h-8 pl-8 text-sm" data-testid="redeemed-search-input" />
                  {redeemedSearch && <button onClick={() => setRedeemedSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2"><X className="w-3.5 h-3.5 text-slate-400" /></button>}
                </div>
                <div className="flex items-center gap-1 flex-wrap">
                  {['all', 'active', 'used', 'loyalty', 'operator'].map(f => (
                    <Button key={f} variant={redeemedFilter === f ? 'default' : 'outline'} size="sm" className={`h-8 text-xs px-2.5 ${redeemedFilter === f ? 'bg-[#082c59]' : ''}`} onClick={() => setRedeemedFilter(f)} data-testid={`redeemed-filter-${f}`}>
                      {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                    </Button>
                  ))}
                </div>
              </div>
              {filteredRedeemed.length === 0 ? (
                <div className="text-center py-6"><Trophy className="h-10 w-10 text-slate-200 mx-auto mb-2" /><p className="text-sm text-slate-400">No matching redeemed codes</p></div>
              ) : (
                <div className="space-y-2">
                  {filteredRedeemed.map(rd => {
                    const isOperator = rd._source === 'operator';
                    const expiry = getExpiryInfo(rd.expires_at);
                    return (
                      <div key={rd.id || rd.code} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg" data-testid={`redeemed-item-${rd.code}`}>
                        <div className="flex items-center gap-3">
                          {isOperator ? <Store className="w-5 h-5 text-purple-500" /> : <Gift className="w-5 h-5 text-violet-500" />}
                          <div>
                            <p className="font-medium text-sm">{isOperator ? rd.promotion_title : (rd.reward_name || rd.reward_title)}</p>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs text-slate-400">Code: <span className="font-mono font-bold">{rd.code}</span></span>
                              {isOperator && <Badge variant="outline" className="text-[10px] text-purple-600 border-purple-300 px-1.5 py-0">{rd.operator_name}</Badge>}
                              <span className={`text-xs ${expiry.color}`}>{expiry.text}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={rd.status === 'pending' || rd.status === 'active' ? 'bg-green-100 text-green-700' : rd.status === 'used' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}>{rd.status}</Badge>
                          <Button variant="ghost" size="icon" className={`h-7 w-7 ${copiedCode === rd.code ? 'text-emerald-600' : ''}`} onClick={() => copyCode(rd.code)}>
                            {copiedCode === rd.code ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* 3-Tab */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 mb-6 bg-slate-100">
          <TabsTrigger value="my-rewards" className="flex items-center gap-2 data-[state=active]:bg-[#082c59] data-[state=active]:text-white text-sm"><Crown className="h-4 w-4" /> My Rewards</TabsTrigger>
          <TabsTrigger value="activity" className="flex items-center gap-2 data-[state=active]:bg-[#082c59] data-[state=active]:text-white text-sm"><TrendingUp className="h-4 w-4" /> Activity</TabsTrigger>
          <TabsTrigger value="rewards" className="flex items-center gap-2 data-[state=active]:bg-[#082c59] data-[state=active]:text-white text-sm" data-testid="rewards-tab-trigger">
            <Gift className="h-4 w-4 mr-1.5" /> Rewards
            {approvedPromos.length > 0 && <Badge className="bg-purple-100 text-purple-700 text-[10px] ml-1.5 px-1.5">{approvedPromos.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        {/* My Rewards Tab */}
        <TabsContent value="my-rewards" className="space-y-6">
          <Card><CardHeader><CardTitle className="flex items-center gap-2"><Crown className="w-5 h-5 text-amber-500" /> Tier Roadmap</CardTitle></CardHeader><CardContent>
            <div className="relative"><div className="flex items-center justify-between mb-2">{TIER_ORDER.map((tier, i) => { const cfg = TIER_CONFIG[tier]; const isActive = loyaltyProgram.tier === tier; const isUnlocked = TIER_ORDER.indexOf(loyaltyProgram.tier) >= i; return (<div key={tier} className="flex flex-col items-center flex-1"><div className={`w-14 h-14 rounded-full flex items-center justify-center border-3 transition-all ${isActive ? `bg-gradient-to-br ${cfg.color} text-white shadow-lg scale-110` : isUnlocked ? `${cfg.bgColor} ${cfg.borderColor} border-2` : 'bg-slate-100 border-2 border-slate-200'}`}><span className="text-2xl">{TIER_SYMBOLS[tier]}</span></div><p className={`text-xs font-semibold mt-2 ${isActive ? cfg.textColor : isUnlocked ? 'text-slate-700' : 'text-slate-400'}`}>{cfg.name}</p><p className="text-[10px] text-slate-400">{TIER_THRESHOLDS[tier].toLocaleString()} pts</p></div>); })}</div><div className="absolute top-7 left-[12%] right-[12%] h-1 bg-slate-200 rounded -z-10"><div className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded transition-all" style={{ width: `${Math.min(100, (TIER_ORDER.indexOf(loyaltyProgram.tier) / 3) * 100 + (loyaltyProgram.tier_progress / 3))}%` }} /></div></div>
            {loyaltyProgram.next_tier && <div className="mt-6 p-4 bg-slate-50 rounded-xl"><div className="flex items-center justify-between mb-2"><span className="text-sm text-slate-600">Progress to <strong>{TIER_CONFIG[loyaltyProgram.next_tier]?.name}</strong></span><span className="text-sm font-bold text-slate-900">{Math.round(loyaltyProgram.tier_progress)}%</span></div><Progress value={loyaltyProgram.tier_progress} className="h-2.5" /><p className="text-xs text-slate-500 mt-1.5">{(loyaltyProgram.points_to_next_tier || 0).toLocaleString()} more points to {TIER_SYMBOLS[loyaltyProgram.next_tier]} {TIER_CONFIG[loyaltyProgram.next_tier]?.name}</p></div>}
          </CardContent></Card>
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2"><TrendingUp className="w-5 h-5 text-emerald-500" /> Points Activity</CardTitle>
                <div className="flex items-center gap-1">
                  {['all', 'earn', 'redeem'].map(f => (
                    <Button key={f} variant={activityFilter === f ? 'default' : 'outline'} size="sm" className={`h-7 text-xs px-2.5 ${activityFilter === f ? 'bg-[#082c59]' : ''}`} onClick={() => setActivityFilter(f)} data-testid={`activity-filter-${f}`}>
                      {f === 'all' ? 'All' : f === 'earn' ? 'Earned' : 'Redeemed'}
                    </Button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filteredTransactions.length === 0 ? (
                <div className="text-center py-8"><Clock className="w-12 h-12 text-slate-200 mx-auto mb-3" /><p className="text-slate-500">{activityFilter === 'all' ? 'No activity yet' : `No ${activityFilter} transactions`}</p></div>
              ) : (
                <div className="space-y-2">
                  {filteredTransactions.map((tx, i) => {
                    const isEarn = tx.transaction_type === 'earn' || tx.type === 'earn';
                    return (
                      <div key={tx.id || i} className={`flex items-center justify-between p-3.5 rounded-xl border ${isEarn ? 'bg-emerald-50/50 border-emerald-100' : 'bg-red-50/50 border-red-100'}`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${isEarn ? 'bg-emerald-100' : 'bg-red-100'}`}>{isEarn ? <TrendingUp className="h-4 w-4 text-emerald-600" /> : <Gift className="h-4 w-4 text-red-500" />}</div>
                          <div><p className="font-medium text-sm text-slate-900">{tx.description}</p><p className="text-xs text-slate-400">{tx.created_at ? formatDateShort(tx.created_at) : ''}{tx.service_type ? ` \u00B7 ${tx.service_type}` : ''}</p></div>
                        </div>
                        <span className={`font-bold text-sm ${isEarn ? 'text-emerald-700' : 'text-red-600'}`}>{isEarn ? '+' : ''}{tx.points?.toLocaleString()} pts</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Rewards Tab */}
        <TabsContent value="rewards" className="space-y-4">
          {/* Search & Filter */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[160px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <Input value={rewardsSearch} onChange={e => setRewardsSearch(e.target.value)} placeholder="Search rewards & promotions..." className="h-9 pl-8 text-sm" data-testid="rewards-search-input" />
              {rewardsSearch && <button onClick={() => setRewardsSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2"><X className="w-3.5 h-3.5 text-slate-400" /></button>}
            </div>
            <div className="flex items-center gap-1 flex-wrap">
              {[{ k: 'all', l: 'All' }, { k: 'available', l: 'Available' }, { k: 'locked', l: 'Locked' }, { k: 'promotion', l: 'Promotions' }].map(f => (
                <Button key={f.k} variant={rewardsFilter === f.k ? 'default' : 'outline'} size="sm" className={`h-8 text-xs px-2.5 ${rewardsFilter === f.k ? 'bg-[#082c59]' : ''}`} onClick={() => setRewardsFilter(f.k)} data-testid={`rewards-filter-${f.k}`}>
                  {f.l}
                </Button>
              ))}
            </div>
          </div>

          {/* Approved Promotions */}
          {filteredRewards.promos.length > 0 && (
            <Card className="border border-purple-200">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Store className="w-5 h-5 text-purple-500" /> Operator Promotions
                  <Badge className="bg-purple-100 text-purple-700 text-xs">{filteredRewards.promos.length} redeemable</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredRewards.promos.map(promo => (
                    <Card key={promo.id} className="border border-purple-100 overflow-hidden" data-testid={`promo-card-${promo.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="p-2 rounded-lg bg-purple-50"><Gift className="h-4 w-4 text-purple-600" /></div>
                          <Badge className="bg-purple-50 text-purple-700 text-[10px]">Discount</Badge>
                        </div>
                        <h4 className="font-bold text-slate-900 text-sm mb-1">{promo.title}</h4>
                        <p className="text-xs text-slate-500 mb-2 line-clamp-2">{promo.message}</p>
                        <div className="flex items-center gap-2 text-xs text-slate-400 mb-3">
                          <span>{promo.operator_name}</span>
                          {promo.discount_value && <Badge variant="outline" className="text-[10px] text-green-600 border-green-300">{promo.discount_value}</Badge>}
                          {promo.service_type && <Badge variant="outline" className="text-[10px] text-slate-500 border-slate-300">{promo.service_type}</Badge>}
                        </div>
                        {promo.valid_until && <p className="text-[10px] text-amber-600 mb-3">Valid until {new Date(promo.valid_until).toLocaleDateString()}</p>}
                        <Button onClick={() => handleRedeemPromo(promo)} className="w-full bg-purple-600 hover:bg-purple-700 text-white text-sm" data-testid={`redeem-promo-btn-${promo.id}`}>
                          <Tag className="w-3.5 h-3.5 mr-1.5" /> Redeem Offer
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Point-based Rewards */}
          {filteredRewards.rewards.length === 0 && filteredRewards.promos.length === 0 ? (
            <Card><CardContent className="py-12 text-center"><Gift className="w-12 h-12 text-slate-200 mx-auto mb-3" /><p className="text-slate-500">{rewardsSearch || rewardsFilter !== 'all' ? 'No matching rewards found' : 'All rewards redeemed!'}</p></CardContent></Card>
          ) : filteredRewards.rewards.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredRewards.rewards.map(reward => {
                const canRedeem = loyaltyProgram.available_points >= reward.points_required;
                const tierIdx = TIER_ORDER.indexOf(loyaltyProgram.tier);
                const rewardTierIdx = TIER_ORDER.indexOf(reward.min_tier);
                const tierUnlocked = tierIdx >= rewardTierIdx;
                const pointsNeeded = Math.max(0, reward.points_required - loyaltyProgram.available_points);
                const rewardTierCfg = TIER_CONFIG[reward.min_tier] || TIER_CONFIG.bronze;
                return (
                  <Card key={reward.id} className={`overflow-hidden transition-all border ${!tierUnlocked ? 'opacity-50' : canRedeem ? 'border-emerald-200 shadow-sm' : 'border-slate-200'}`}>
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className={`p-2.5 rounded-xl ${rewardTierCfg.bgColor}`}>{reward.type === 'discount' ? <Percent className="h-5 w-5 text-slate-600" /> : <Gift className="h-5 w-5 text-slate-600" />}</div>
                        <Badge className={`${rewardTierCfg.bgColor} ${rewardTierCfg.textColor} text-xs`}>{TIER_SYMBOLS[reward.min_tier]} {rewardTierCfg.name}+</Badge>
                      </div>
                      <h4 className="font-bold text-slate-900 mb-1">{reward.title}</h4>
                      <p className="text-sm text-slate-500 mb-2">{reward.description}</p>
                      {reward.valid_to && <p className="text-xs text-amber-600 mb-2">Expires: {formatDateShort(reward.valid_to)}</p>}
                      <div className="mb-3">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-lg font-bold text-[#082c59]">{reward.points_required?.toLocaleString()} pts</span>
                          {canRedeem && <Badge className="bg-emerald-100 text-emerald-700 text-xs"><Check className="h-3 w-3 mr-0.5" /> Ready</Badge>}
                        </div>
                        <Progress value={Math.min(100, (loyaltyProgram.available_points / reward.points_required) * 100)} className="h-1.5" />
                        {!canRedeem && <p className="text-xs text-slate-400 mt-1">{pointsNeeded.toLocaleString()} more needed</p>}
                      </div>
                      <Button onClick={() => handleRedeemReward(reward)} disabled={!canRedeem || !tierUnlocked} className={`w-full ${canRedeem && tierUnlocked ? 'bg-[#082c59] hover:bg-[#0a3a75]' : ''}`} variant={canRedeem && tierUnlocked ? 'default' : 'outline'}>
                        {!tierUnlocked ? 'Tier Locked' : canRedeem ? 'Redeem Now' : `Need ${pointsNeeded.toLocaleString()} pts`}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Loyalty Reward Redeem Dialog */}
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
                <Button variant="outline" onClick={() => copyCode(redeemSuccess.code)} className="gap-2" data-testid="copy-redeemed-code">{copiedCode === redeemSuccess.code ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />} {copiedCode === redeemSuccess.code ? 'Copied!' : 'Copy Code'}</Button>
              </div>
              <div className="flex items-center justify-between text-sm p-3 bg-amber-50 rounded-lg border border-amber-100"><span className="text-amber-700">Expires:</span><span className="font-medium text-amber-800">{redeemSuccess.expires_at ? formatDateShort(redeemSuccess.expires_at) : '30 days'}</span></div>
              <p className="text-xs text-slate-400 mt-3">Find this code in your Redeemable Codes section.</p>
              <Button onClick={() => setShowRedeemDialog(false)} className="mt-4 bg-[#082c59] hover:bg-[#0a3a75]">Done</Button>
            </div>
          ) : (
            <>
              <DialogHeader><DialogTitle>Confirm Redemption</DialogTitle><DialogDescription>This will deduct points from your balance.</DialogDescription></DialogHeader>
              {selectedReward && <div className="p-4 bg-slate-50 rounded-lg space-y-3"><h4 className="font-bold text-lg">{selectedReward.title}</h4><p className="text-slate-600 text-sm">{selectedReward.description}</p><div className="flex items-center justify-between"><span className="text-slate-500 text-sm">Points Required:</span><span className="font-bold text-[#082c59]">{selectedReward.points_required?.toLocaleString()}</span></div><div className="flex items-center justify-between"><span className="text-slate-500 text-sm">Balance After:</span><span className="font-bold text-emerald-600">{((loyaltyProgram.available_points || 0) - (selectedReward.points_required || 0)).toLocaleString()}</span></div></div>}
              <DialogFooter><Button variant="outline" onClick={() => setShowRedeemDialog(false)}>Cancel</Button><Button onClick={confirmRedemption} disabled={redeeming} className="bg-[#082c59] hover:bg-[#0a3a75]">{redeeming ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Confirm Redemption</Button></DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Operator Promotion Redeem Dialog */}
      <Dialog open={showPromoRedeemDialog} onOpenChange={(open) => { setShowPromoRedeemDialog(open); if (!open) setPromoRedeemSuccess(null); }}>
        <DialogContent className="bg-white">
          {promoRedeemSuccess ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 mx-auto mb-4 bg-purple-100 rounded-full flex items-center justify-center"><Tag className="w-8 h-8 text-purple-600" /></div>
              <h3 className="text-xl font-bold text-slate-900 mb-1">Offer Redeemed!</h3>
              <p className="text-sm text-slate-500 mb-1">{promoRedeemSuccess.promo_title}</p>
              <p className="text-xs text-purple-600 mb-5">from {promoRedeemSuccess.operator_name}{promoRedeemSuccess.service_type ? ` \u00B7 ${promoRedeemSuccess.service_type}` : ''}</p>
              <div className="bg-purple-50 rounded-xl p-5 mb-4">
                <p className="text-xs text-slate-400 uppercase font-semibold mb-2">Your Promotion Code</p>
                <div className="flex items-center justify-center gap-2 mb-2">
                  <span className="text-2xl font-mono font-bold text-purple-800 tracking-widest bg-white px-4 py-2 rounded-lg border-2 border-dashed border-purple-200">{promoRedeemSuccess.code}</span>
                </div>
                <Button variant="outline" onClick={() => copyCode(promoRedeemSuccess.code)} className="gap-2" data-testid="copy-promo-redeemed-code">
                  {copiedCode === promoRedeemSuccess.code ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                  {copiedCode === promoRedeemSuccess.code ? 'Copied!' : 'Copy Code'}
                </Button>
              </div>
              <div className="space-y-2 mb-4">
                <div className="flex items-center justify-between text-sm p-3 bg-amber-50 rounded-lg border border-amber-100">
                  <span className="text-amber-700">Expires:</span>
                  <span className="font-medium text-amber-800">{promoRedeemSuccess.expires_at ? formatDateShort(promoRedeemSuccess.expires_at) : '30 days'}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-left">
                  <p className="text-xs text-slate-500">This code is valid <strong>only</strong> for <strong>{promoRedeemSuccess.operator_name}</strong>{promoRedeemSuccess.service_type ? <> &mdash; <strong>{promoRedeemSuccess.service_type}</strong></> : ''} services.</p>
                </div>
              </div>
              <p className="text-xs text-slate-400">Find this code in your Redeemable Codes section.</p>
              <Button onClick={() => setShowPromoRedeemDialog(false)} className="mt-4 bg-purple-600 hover:bg-purple-700">Done</Button>
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Redeem Operator Promotion</DialogTitle>
                <DialogDescription>This will generate a promo code you can use when booking.</DialogDescription>
              </DialogHeader>
              {selectedPromo && (
                <div className="p-4 bg-purple-50 rounded-lg space-y-3">
                  <h4 className="font-bold text-lg text-slate-900">{selectedPromo.title}</h4>
                  <p className="text-slate-600 text-sm">{selectedPromo.message}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 text-sm">Operator:</span>
                    <span className="font-medium text-purple-700">{selectedPromo.operator_name}</span>
                  </div>
                  {selectedPromo.service_type && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 text-sm">Service:</span>
                      <span className="font-medium text-slate-700">{selectedPromo.service_type}</span>
                    </div>
                  )}
                  {selectedPromo.discount_value && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 text-sm">Discount:</span>
                      <Badge className="bg-green-100 text-green-700">{selectedPromo.discount_value}</Badge>
                    </div>
                  )}
                  <div className="p-2 bg-white rounded border border-purple-200 text-xs text-slate-500">
                    The generated code will only work for <strong>{selectedPromo.operator_name}</strong>{selectedPromo.service_type ? <> &mdash; <strong>{selectedPromo.service_type}</strong></> : ''} services.
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowPromoRedeemDialog(false)}>Cancel</Button>
                <Button onClick={confirmPromoRedemption} disabled={redeemingPromo} className="bg-purple-600 hover:bg-purple-700" data-testid="confirm-promo-redeem-btn">
                  {redeemingPromo ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Tag className="h-4 w-4 mr-2" />}
                  Redeem Offer
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
