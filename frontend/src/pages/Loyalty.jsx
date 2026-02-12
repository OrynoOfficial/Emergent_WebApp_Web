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
  Plus, Edit2, Trash2, Settings, Search, BarChart3, Target, Percent
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
  const [showReferralDialog, setShowReferralDialog] = useState(false);
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState(false);
  
  // Real data from API
  const [loyaltyProgram, setLoyaltyProgram] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [rewards, setRewards] = useState(DEFAULT_REWARDS);
  const [redemptions, setRedemptions] = useState([]);

  useEffect(() => {
    loadLoyaltyData();
  }, []);

  const loadLoyaltyData = async () => {
    setLoading(true);
    try {
      // Load loyalty program
      const programRes = await api.get('/loyalty/program');
      const program = programRes.data;
      
      // Calculate tier progress
      const tierThresholds = { bronze: 0, silver: 1000, gold: 5000, platinum: 15000 };
      const tiers = ['bronze', 'silver', 'gold', 'platinum'];
      const currentTierIdx = tiers.indexOf(program.tier || 'bronze');
      const nextTier = currentTierIdx < tiers.length - 1 ? tiers[currentTierIdx + 1] : null;
      const currentThreshold = tierThresholds[program.tier || 'bronze'];
      const nextThreshold = nextTier ? tierThresholds[nextTier] : tierThresholds.platinum;
      const progress = nextTier ? ((program.total_points - currentThreshold) / (nextThreshold - currentThreshold)) * 100 : 100;
      
      setLoyaltyProgram({
        ...program,
        tier: program.tier || 'bronze',
        tier_progress: Math.min(progress, 100),
        next_tier: nextTier,
        points_to_next_tier: nextTier ? nextThreshold - program.total_points : 0,
        referral_code: 'ORYNO' + (user?.id?.slice(-6) || 'ABC123').toUpperCase(),
        total_referrals: program.total_referrals || 0,
        member_since: program.joined_at || program.created_at
      });

      // Load transactions
      const txRes = await api.get('/loyalty/transactions');
      setTransactions(txRes.data.transactions || []);

      // Load rewards
      const rewardsRes = await api.get('/loyalty/rewards');
      if (rewardsRes.data.rewards?.length > 0) {
        setRewards(rewardsRes.data.rewards);
      }

      // Load redemptions
      const redemptionsRes = await api.get('/loyalty/redemptions');
      setRedemptions(redemptionsRes.data.redemptions || []);

    } catch (error) {
      console.error('Failed to load loyalty data:', error);
      // Set default values on error
      setLoyaltyProgram({
        tier: 'bronze',
        total_points: 0,
        available_points: 0,
        tier_progress: 0,
        next_tier: 'silver',
        points_to_next_tier: 1000,
        referral_code: 'ORYNO' + (user?.id?.slice(-6) || 'ABC123').toUpperCase(),
        total_referrals: 0,
        member_since: new Date().toISOString()
      });
    } finally {
      setLoading(false);
    }
  };

  const currentTierConfig = TIER_CONFIG[loyaltyProgram?.tier || 'bronze'] || TIER_CONFIG.bronze;
  const TierIcon = currentTierConfig.icon;

  const handleRedeemReward = (reward) => {
    setSelectedReward(reward);
    setShowRedeemDialog(true);
  };

  const confirmRedemption = async () => {
    if (!selectedReward) return;
    
    setRedeeming(true);
    try {
      const res = await api.post(`/loyalty/redeem/${selectedReward.id}`);
      toast.success(`Successfully redeemed: ${selectedReward.title}\nYour code: ${res.data.redemption_code}`);
      setShowRedeemDialog(false);
      loadLoyaltyData(); // Refresh data
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to redeem reward');
    } finally {
      setRedeeming(false);
    }
  };

  const copyReferralCode = () => {
    navigator.clipboard.writeText(loyaltyProgram?.referral_code || '');
    toast.success('Referral code copied to clipboard!');
  };

  // formatDate is now imported from dateUtils

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#082c59]" />
      </div>
    );
  }

  if (!loyaltyProgram) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <p className="text-slate-500">Unable to load loyalty program</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
          <Award className="h-7 w-7 text-[#082c59]" />
          My Loyalty Program
        </h1>
        <p className="text-slate-600 mt-1">Earn points and unlock exclusive rewards</p>
      </div>

      {/* Tier Status Card */}
      <Card className={`border-2 ${currentTierConfig.borderColor} ${currentTierConfig.bgColor} relative overflow-hidden`}>
        <div className="absolute top-0 right-0 opacity-10">
          <TierIcon className="h-48 w-48" />
        </div>
        <CardContent className="p-6 relative z-10">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <div className="flex items-center gap-4 mb-4">
                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${currentTierConfig.color} flex items-center justify-center shadow-lg`}>
                  <TierIcon className="h-8 w-8 text-white" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Current Tier</p>
                  <h2 className="text-2xl font-bold text-slate-900">{currentTierConfig.name}</h2>
                </div>
              </div>

              {loyaltyProgram?.next_tier && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Progress to {TIER_CONFIG[loyaltyProgram.next_tier]?.name}</span>
                    <span className="font-semibold">{loyaltyProgram.tier_progress || 0}%</span>
                  </div>
                  <Progress value={loyaltyProgram.tier_progress || 0} className="h-3" />
                  <p className="text-xs text-slate-500">
                    {(loyaltyProgram.points_to_next_tier || 0).toLocaleString()} more points needed
                  </p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 text-center shadow">
                <Star className="h-6 w-6 text-amber-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-slate-900">{(loyaltyProgram?.available_points || 0).toLocaleString()}</p>
                <p className="text-xs text-slate-600">Available Points</p>
              </div>
              <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 text-center shadow">
                <TrendingUp className="h-6 w-6 text-green-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-slate-900">{(loyaltyProgram?.total_points || 0).toLocaleString()}</p>
                <p className="text-xs text-slate-600">Total Earned</p>
              </div>
              <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 text-center shadow">
                <Gift className="h-6 w-6 text-blue-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-slate-900">{(loyaltyProgram?.redeemed_points || 0).toLocaleString()}</p>
                <p className="text-xs text-slate-600">Redeemed</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Referral Card */}
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-500 to-teal-500 p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold mb-1">Refer Friends & Earn</h3>
              <p className="text-emerald-100">Share your code and earn 10 points per referral</p>
            </div>
            <div className="h-14 w-14 bg-white/20 rounded-full flex items-center justify-center">
              <Users className="h-7 w-7" />
            </div>
          </div>
        </div>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="flex-1 bg-slate-100 rounded-lg p-4 text-center w-full">
              <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Your Referral Code</p>
              <p className="text-2xl font-bold text-slate-900 tracking-wider">{loyaltyProgram?.referral_code || 'ORYNO000000'}</p>
            </div>
            <Button onClick={copyReferralCode} className="bg-[#082c59] hover:bg-[#0a3a75] gap-2 w-full sm:w-auto">
              <Copy className="h-4 w-4" />
              Copy Code
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4 text-center text-sm">
            <div className="bg-emerald-50 p-3 rounded-lg">
              <p className="font-bold text-emerald-900">{loyaltyProgram?.total_referrals || 0}</p>
              <p className="text-emerald-700">Total Referrals</p>
            </div>
            <div className="bg-blue-50 p-3 rounded-lg">
              <p className="font-bold text-blue-900">10 pts</p>
              <p className="text-blue-700">Per Referral</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="rewards" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 bg-slate-100">
          <TabsTrigger value="rewards" className="data-[state=active]:bg-[#082c59] data-[state=active]:text-white">
            <Gift className="h-4 w-4 mr-2" />
            Rewards
          </TabsTrigger>
          <TabsTrigger value="activity" className="data-[state=active]:bg-[#082c59] data-[state=active]:text-white">
            <Clock className="h-4 w-4 mr-2" />
            Activity
          </TabsTrigger>
          <TabsTrigger value="redemptions" className="data-[state=active]:bg-[#082c59] data-[state=active]:text-white">
            <Trophy className="h-4 w-4 mr-2" />
            My Rewards
          </TabsTrigger>
        </TabsList>

        {/* Rewards Tab */}
        <TabsContent value="rewards" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rewards.map((reward) => {
              const canRedeem = loyaltyProgram.available_points >= reward.points_required;
              const tierIndex = ['bronze', 'silver', 'gold', 'platinum'].indexOf(loyaltyProgram.tier);
              const rewardTierIndex = ['bronze', 'silver', 'gold', 'platinum'].indexOf(reward.min_tier);
              const tierUnlocked = tierIndex >= rewardTierIndex;
              const pointsProgress = Math.min(100, (loyaltyProgram.available_points / reward.points_required) * 100);
              const pointsNeeded = Math.max(0, reward.points_required - loyaltyProgram.available_points);

              return (
                <Card key={reward.id} className={`overflow-hidden transition-all duration-300 ${!tierUnlocked ? 'opacity-60' : ''}`}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#082c59] to-blue-600 flex items-center justify-center">
                        {reward.type === 'discount' ? <Coins className="h-6 w-6 text-white" /> : 
                         reward.type === 'upgrade' ? <Zap className="h-6 w-6 text-white" /> :
                         <Gift className="h-6 w-6 text-white" />}
                      </div>
                      <Badge className={TIER_CONFIG[reward.min_tier].bgColor + ' ' + TIER_CONFIG[reward.min_tier].textColor}>
                        {TIER_CONFIG[reward.min_tier].name}+
                      </Badge>
                    </div>

                    <h4 className="font-bold text-lg mb-1">{reward.title}</h4>
                    <p className="text-sm text-slate-600 mb-4">{reward.description}</p>

                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-xl font-bold text-[#082c59]">{reward.points_required.toLocaleString()}</p>
                          <p className="text-xs text-slate-500">points required</p>
                        </div>
                        {canRedeem ? (
                          <Badge className="bg-green-100 text-green-700">
                            <Check className="h-3 w-3 mr-1" />Ready
                          </Badge>
                        ) : (
                          <div className="text-right">
                            <p className="text-sm font-semibold text-orange-600">{pointsNeeded.toLocaleString()}</p>
                            <p className="text-xs text-slate-500">more needed</p>
                          </div>
                        )}
                      </div>
                      <Progress value={pointsProgress} className={`h-1.5 ${canRedeem ? 'bg-green-100' : 'bg-slate-100'}`} />
                    </div>

                    <Button
                      onClick={() => handleRedeemReward(reward)}
                      disabled={!canRedeem || !tierUnlocked}
                      className={`w-full ${canRedeem && tierUnlocked ? 'bg-[#082c59] hover:bg-[#0a3a75]' : 'bg-slate-300'}`}
                    >
                      {!tierUnlocked ? 'Tier Locked' : canRedeem ? 'Redeem Now' : `Need ${pointsNeeded.toLocaleString()} pts`}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {transactions.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <Clock className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No transactions yet</p>
                    <p className="text-sm">Start booking to earn points!</p>
                  </div>
                ) : transactions.map((tx) => (
                  <div key={tx.id || tx._id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        tx.transaction_type === 'earn' || tx.type === 'earn' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                      }`}>
                        {tx.transaction_type === 'earn' || tx.type === 'earn' ? <TrendingUp className="h-5 w-5" /> : <Gift className="h-5 w-5" />}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{tx.description}</p>
                        <p className="text-sm text-slate-500">{formatDate(tx.date || tx.created_at)}</p>
                      </div>
                    </div>
                    <div className={`text-lg font-bold ${tx.transaction_type === 'earn' || tx.type === 'earn' ? 'text-green-600' : 'text-red-600'}`}>
                      {tx.transaction_type === 'earn' || tx.type === 'earn' ? '+' : ''}{tx.points}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Redemptions Tab */}
        <TabsContent value="redemptions">
          <Card>
            <CardHeader>
              <CardTitle>My Redeemed Rewards</CardTitle>
            </CardHeader>
            <CardContent>
              {redemptions.length === 0 ? (
                <div className="text-center py-12">
                  <Trophy className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                  <h3 className="font-medium text-slate-700 mb-2">No rewards redeemed yet</h3>
                  <p className="text-slate-500 mb-4">Start earning points and redeem exciting rewards!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {redemptions.map((redemption) => (
                    <div key={redemption.id || redemption._id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-bold">{redemption.reward_title}</h4>
                          <Badge className={
                            redemption.status === 'active' ? 'bg-green-100 text-green-700' :
                            redemption.status === 'used' ? 'bg-blue-100 text-blue-700' :
                            'bg-slate-100 text-slate-700'
                          }>
                            {redemption.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-600 mb-1">Code: <strong>{redemption.code}</strong></p>
                        <div className="flex items-center gap-4 text-xs text-slate-500">
                          <span>Redeemed: {formatDate(redemption.redeemed_at)}</span>
                          <span>Expires: {formatDate(redemption.expires_at)}</span>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(redemption.code)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* How to Earn */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            How to Earn Points
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Gift className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="font-semibold">Every Booking</p>
                <p className="text-sm text-slate-600">Earn 1-3x points per 1,000 FCFA spent</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 bg-purple-50 rounded-lg">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                <Star className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="font-semibold">Write Reviews</p>
                <p className="text-sm text-slate-600">Earn 5 points per review</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-lg">
              <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
                <Users className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <p className="font-semibold">Refer Friends</p>
                <p className="text-sm text-slate-600">Earn 10 points per referral</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tier Benefits */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-amber-500" />
            Tier Benefits
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(TIER_CONFIG).map(([tierKey, tier]) => {
              const TIcon = tier.icon;
              const isCurrentTier = loyaltyProgram.tier === tierKey;
              const tierOrder = ['bronze', 'silver', 'gold', 'platinum'];
              const isUnlocked = tierOrder.indexOf(loyaltyProgram.tier) >= tierOrder.indexOf(tierKey);

              return (
                <div
                  key={tierKey}
                  className={`p-4 rounded-lg border-2 ${
                    isCurrentTier
                      ? `bg-gradient-to-br ${tier.color} text-white border-transparent`
                      : isUnlocked
                      ? `${tier.bgColor} ${tier.borderColor}`
                      : 'bg-slate-50 border-slate-200 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <TIcon className={`h-5 w-5 ${isCurrentTier ? 'text-white' : tier.textColor}`} />
                    <span className={`font-bold ${isCurrentTier ? 'text-white' : 'text-slate-900'}`}>
                      {tier.name}
                    </span>
                    {isCurrentTier && (
                      <Badge className="bg-white/20 text-white text-xs ml-auto">Current</Badge>
                    )}
                  </div>
                  <p className={`text-xs mb-2 ${isCurrentTier ? 'text-white/80' : 'text-slate-500'}`}>
                    {tier.pointsRequired === 0 ? '0+' : `${tier.pointsRequired.toLocaleString()}+`} points
                  </p>
                  {tier.discount > 0 && (
                    <Badge className={`mb-2 ${isCurrentTier ? 'bg-white/20 text-white' : 'bg-green-100 text-green-700'}`}>
                      {tier.discount}% off
                    </Badge>
                  )}
                  <ul className={`text-xs space-y-1 ${isCurrentTier ? 'text-white/90' : 'text-slate-600'}`}>
                    {tier.benefits.map((benefit, idx) => (
                      <li key={idx} className="flex items-center gap-1">
                        <Check className="h-3 w-3" />
                        {benefit}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Redeem Dialog */}
      <Dialog open={showRedeemDialog} onOpenChange={setShowRedeemDialog}>
        <DialogContent className="bg-white">
          <DialogHeader>
            <DialogTitle className="text-[#082c59]">Confirm Redemption</DialogTitle>
            <DialogDescription>Are you sure you want to redeem this reward?</DialogDescription>
          </DialogHeader>
          {selectedReward && (
            <div className="p-4 bg-slate-50 rounded-lg">
              <h4 className="font-bold text-lg mb-2">{selectedReward.title}</h4>
              <p className="text-slate-600 mb-4">{selectedReward.description}</p>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Points Required:</span>
                <span className="font-bold text-[#082c59]">{selectedReward.points_required.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-slate-500">Your Balance After:</span>
                <span className="font-bold text-green-600">
                  {(loyaltyProgram.available_points - selectedReward.points_required).toLocaleString()}
                </span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRedeemDialog(false)}>Cancel</Button>
            <Button onClick={confirmRedemption} className="bg-[#082c59] hover:bg-[#0a3a75]">
              Confirm Redemption
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Admin Loyalty Program Management View
function AdminLoyaltyView() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';
  const isReadOnly = user?.role === 'admin'; // Admin has read-only access
  
  const [activeTab, setActiveTab] = useState('overview');
  const [rewards, setRewards] = useState(DEFAULT_REWARDS);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showRewardDialog, setShowRewardDialog] = useState(false);
  const [editingReward, setEditingReward] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [rewardForm, setRewardForm] = useState({
    title: '', description: '', points_required: '', min_tier: 'bronze', type: 'discount', discount_value: ''
  });

  // Stats
  const [programStats, setProgramStats] = useState({
    totalMembers: 0,
    totalPointsIssued: 0,
    totalPointsRedeemed: 0,
    activeRewards: 0,
    membersByTier: { bronze: 0, silver: 0, gold: 0, platinum: 0 }
  });

  useEffect(() => {
    loadAdminData();
  }, []);

  const loadAdminData = async () => {
    setLoading(true);
    try {
      // Load rewards
      const rewardsRes = await api.get('/loyalty/admin/rewards');
      if (rewardsRes.data?.rewards?.length > 0) {
        setRewards(rewardsRes.data.rewards);
      }

      // Load program stats
      const statsRes = await api.get('/loyalty/admin/stats');
      if (statsRes.data) {
        setProgramStats(statsRes.data);
      }

      // Load members
      const membersRes = await api.get('/loyalty/admin/members');
      if (membersRes.data?.members) {
        setMembers(membersRes.data.members);
      }

    } catch (error) {
      console.error('Failed to load admin data:', error);
      // Set mock data for demo
      setProgramStats({
        totalMembers: 2847,
        totalPointsIssued: 458900,
        totalPointsRedeemed: 125600,
        activeRewards: 6,
        membersByTier: { bronze: 1850, silver: 620, gold: 285, platinum: 92 }
      });
      setMembers([
        { id: '1', name: 'John Doe', email: 'john@example.com', tier: 'gold', total_points: 7500, available_points: 4200 },
        { id: '2', name: 'Marie Claire', email: 'marie@example.com', tier: 'platinum', total_points: 18500, available_points: 12000 },
        { id: '3', name: 'Pierre Martin', email: 'pierre@example.com', tier: 'silver', total_points: 2500, available_points: 1800 },
        { id: '4', name: 'Sophie Williams', email: 'sophie@example.com', tier: 'bronze', total_points: 450, available_points: 450 },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const [savingReward, setSavingReward] = useState(false);

  const handleSaveReward = async () => {
    if (!rewardForm.title || !rewardForm.points_required) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    setSavingReward(true);
    try {
      const payload = {
        title: rewardForm.title,
        description: rewardForm.description,
        points_required: parseInt(rewardForm.points_required),
        min_tier: rewardForm.min_tier,
        type: rewardForm.type,
        discount_value: rewardForm.discount_value ? parseFloat(rewardForm.discount_value) : null
      };

      if (editingReward) {
        await api.put(`/loyalty/admin/rewards/${editingReward.id}`, payload);
        toast.success('Reward updated successfully!');
      } else {
        await api.post('/loyalty/admin/rewards', payload);
        toast.success('Reward created successfully!');
      }
      
      // Reload rewards from server to get fresh data
      try {
        const rewardsRes = await api.get('/loyalty/admin/rewards');
        if (rewardsRes.data?.rewards) {
          setRewards(rewardsRes.data.rewards);
        }
      } catch (e) {
        console.error('Failed to reload rewards:', e);
      }
      
      setShowRewardDialog(false);
      setEditingReward(null);
      setRewardForm({ title: '', description: '', points_required: '', min_tier: 'bronze', type: 'discount', discount_value: '' });
    } catch (error) {
      console.error('Failed to save reward:', error);
      toast.error(error.response?.data?.detail || 'Failed to save reward');
    } finally {
      setSavingReward(false);
    }
  };

  const handleDeleteReward = async (rewardId) => {
    if (!confirm('Are you sure you want to delete this reward?')) return;
    try {
      await api.delete(`/loyalty/admin/rewards/${rewardId}`);
      
      // Reload rewards from server
      try {
        const rewardsRes = await api.get('/loyalty/admin/rewards');
        if (rewardsRes.data?.rewards) {
          setRewards(rewardsRes.data.rewards);
        }
      } catch (e) {
        // Fallback to local state update
        setRewards(prev => prev.filter(r => r.id !== rewardId));
      }
      
      toast.success('Reward deleted successfully!');
    } catch (error) {
      console.error('Failed to delete reward:', error);
      toast.error(error.response?.data?.detail || 'Failed to delete reward');
    }
  };

  const handleEditReward = (reward) => {
    setEditingReward(reward);
    setRewardForm({
      title: reward.title,
      description: reward.description,
      points_required: reward.points_required.toString(),
      min_tier: reward.min_tier,
      type: reward.type,
      discount_value: reward.discount_value?.toString() || ''
    });
    setShowRewardDialog(true);
  };

  const filteredMembers = useMemo(() => {
    if (!searchTerm) return members;
    return members.filter(m =>
      m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.email.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [members, searchTerm]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-[#082c59] mx-auto" />
          <p className="mt-4 text-slate-600">Loading program data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-100 rounded-lg">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{programStats.totalMembers.toLocaleString()}</p>
                <p className="text-xs text-slate-600">Total Members</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-100 rounded-lg">
                <Coins className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{programStats.totalPointsIssued.toLocaleString()}</p>
                <p className="text-xs text-slate-600">Points Issued</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 border-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-100 rounded-lg">
                <Gift className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{programStats.totalPointsRedeemed.toLocaleString()}</p>
                <p className="text-xs text-slate-600">Points Redeemed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-50 to-violet-50 border-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-purple-100 rounded-lg">
                <Trophy className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{rewards.length}</p>
                <p className="text-xs text-slate-600">Active Rewards</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-rose-50 to-pink-50 border-0">
          <CardContent className="p-4">
            <div className="text-xs space-y-1">
              {['platinum', 'gold', 'silver', 'bronze'].map(tier => (
                <div key={tier} className="flex items-center justify-between">
                  <span className="capitalize">{tier}</span>
                  <span className="font-medium">{programStats.membersByTier[tier]?.toLocaleString() || 0}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="rewards">Rewards</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Tier Configuration</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {Object.entries(TIER_CONFIG).map(([tierKey, tier]) => {
                  const TIcon = tier.icon;
                  return (
                    <div key={tierKey} className={`p-4 rounded-lg border-2 ${tier.bgColor} ${tier.borderColor}`}>
                      <div className="flex items-center gap-2 mb-3">
                        <TIcon className={`h-5 w-5 ${tier.textColor}`} />
                        <span className="font-bold">{tier.name}</span>
                      </div>
                      <p className="text-xs text-slate-500 mb-2">{tier.pointsRequired.toLocaleString()}+ points</p>
                      <Badge className="bg-green-100 text-green-700 mb-2">{tier.discount}% discount</Badge>
                      <ul className="text-xs text-slate-600 space-y-1">
                        {tier.benefits.map((b, i) => <li key={i}>• {b}</li>)}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Point Earning Rules</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="font-semibold mb-1">Every Booking</p>
                  <p className="text-sm text-slate-600">1-3x points per 1,000 FCFA based on tier</p>
                </div>
                <div className="p-4 bg-purple-50 rounded-lg">
                  <p className="font-semibold mb-1">Write Reviews</p>
                  <p className="text-sm text-slate-600">5 points per review submitted</p>
                </div>
                <div className="p-4 bg-emerald-50 rounded-lg">
                  <p className="font-semibold mb-1">Referrals</p>
                  <p className="text-sm text-slate-600">10 points per successful referral</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Rewards Tab */}
        <TabsContent value="rewards" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Manage Rewards</CardTitle>
                {isReadOnly && (
                  <p className="text-sm text-amber-600 mt-1">Read-only access. Only Super Admins can modify rewards.</p>
                )}
              </div>
              {isSuperAdmin && (
                <Button onClick={() => { setEditingReward(null); setRewardForm({ title: '', description: '', points_required: '', min_tier: 'bronze', type: 'discount', discount_value: '' }); setShowRewardDialog(true); }} className="bg-[#082c59] hover:bg-[#0a3a75]">
                  <Plus className="h-4 w-4 mr-2" /> Add Reward
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {rewards.map((reward) => (
                  <div key={reward.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-bold">{reward.title}</h4>
                        <Badge className="capitalize text-xs">{reward.min_tier}</Badge>
                        <Badge variant="outline" className="text-xs">{reward.type}</Badge>
                      </div>
                      <p className="text-sm text-slate-600 mb-2">{reward.description}</p>
                      <p className="text-sm"><strong>{reward.points_required.toLocaleString()}</strong> points required</p>
                    </div>
                    {isSuperAdmin && (
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleEditReward(reward)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" className="text-red-600 hover:bg-red-50" onClick={() => handleDeleteReward(reward.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Members Tab */}
        <TabsContent value="members" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <CardTitle>Loyalty Members</CardTitle>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input placeholder="Search members..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-2">Member</th>
                      <th className="text-left py-3 px-2">Tier</th>
                      <th className="text-right py-3 px-2">Total Points</th>
                      <th className="text-right py-3 px-2">Available</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMembers.map((member) => {
                      const tierConfig = TIER_CONFIG[member.tier] || TIER_CONFIG.bronze;
                      return (
                        <tr key={member.id} className="border-b hover:bg-slate-50">
                          <td className="py-3 px-2">
                            <p className="font-medium">{member.name}</p>
                            <p className="text-xs text-slate-500">{member.email}</p>
                          </td>
                          <td className="py-3 px-2">
                            <Badge className={`${tierConfig.bgColor} ${tierConfig.textColor} capitalize`}>
                              {member.tier}
                            </Badge>
                          </td>
                          <td className="text-right py-3 px-2 font-medium">{member.total_points.toLocaleString()}</td>
                          <td className="text-right py-3 px-2 text-green-600">{member.available_points.toLocaleString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Reward Dialog */}
      <Dialog open={showRewardDialog} onOpenChange={setShowRewardDialog}>
        <DialogContent className="bg-white max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingReward ? 'Edit Reward' : 'Create New Reward'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">Title</label>
              <Input value={rewardForm.title} onChange={(e) => setRewardForm({ ...rewardForm, title: e.target.value })} placeholder="Reward title" className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Textarea value={rewardForm.description} onChange={(e) => setRewardForm({ ...rewardForm, description: e.target.value })} placeholder="Describe the reward" className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Points Required</label>
                <Input type="number" value={rewardForm.points_required} onChange={(e) => setRewardForm({ ...rewardForm, points_required: e.target.value })} placeholder="1000" className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Minimum Tier</label>
                <Select value={rewardForm.min_tier} onValueChange={(v) => setRewardForm({ ...rewardForm, min_tier: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="bronze">Bronze</SelectItem>
                    <SelectItem value="silver">Silver</SelectItem>
                    <SelectItem value="gold">Gold</SelectItem>
                    <SelectItem value="platinum">Platinum</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Type</label>
                <Select value={rewardForm.type} onValueChange={(v) => setRewardForm({ ...rewardForm, type: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="discount">Discount</SelectItem>
                    <SelectItem value="upgrade">Upgrade</SelectItem>
                    <SelectItem value="service">Free Service</SelectItem>
                    <SelectItem value="gift">Gift</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {rewardForm.type === 'discount' && (
                <div>
                  <label className="text-sm font-medium">Discount %</label>
                  <Input type="number" value={rewardForm.discount_value} onChange={(e) => setRewardForm({ ...rewardForm, discount_value: e.target.value })} placeholder="10" className="mt-1" />
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRewardDialog(false)} disabled={savingReward}>Cancel</Button>
            <Button onClick={handleSaveReward} disabled={savingReward} className="bg-[#082c59] hover:bg-[#0a3a75]">
              {savingReward && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingReward ? 'Update Reward' : 'Create Reward'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
