import { Award, Star, TrendingUp, Gift, Percent, Sparkles } from 'lucide-react';

export const TIER_CONFIG = {
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

export const TIER_SYMBOLS = { bronze: '🥉', silver: '🥈', gold: '🥇', platinum: '💎' };
export const TIER_ORDER = ['bronze', 'silver', 'gold', 'platinum'];
export const TIER_THRESHOLDS = { bronze: 0, silver: 1000, gold: 5000, platinum: 15000 };

export const DEFAULT_REWARDS = [
  { id: '1', title: '5% Discount Voucher', description: 'Get 5% off your next booking', points_required: 500, min_tier: 'bronze', type: 'discount', discount_value: 5 },
  { id: '2', title: '10% Discount Voucher', description: 'Get 10% off your next booking', points_required: 1000, min_tier: 'silver', type: 'discount', discount_value: 10 },
  { id: '3', title: 'Free Room Upgrade', description: 'Upgrade to a better room for free', points_required: 2000, min_tier: 'gold', type: 'upgrade', discount_value: 0 },
  { id: '4', title: 'Airport Transfer', description: 'Free airport pickup or dropoff', points_required: 3000, min_tier: 'gold', type: 'service', discount_value: 0 },
  { id: '5', title: '25% Super Discount', description: 'Massive 25% off any service', points_required: 5000, min_tier: 'platinum', type: 'discount', discount_value: 25 },
  { id: '6', title: 'VIP Experience Package', description: 'Premium amenities and priority service', points_required: 7500, min_tier: 'platinum', type: 'gift', discount_value: 0 },
];

export const REWARD_TYPE_ICONS = { discount: Percent, upgrade: TrendingUp, service: Gift, gift: Sparkles };

export function getExpiryInfo(expiresAt) {
  if (!expiresAt) return { text: 'No expiry', color: 'text-slate-400' };
  const daysLeft = Math.ceil((new Date(expiresAt) - new Date()) / 86400000);
  if (daysLeft < 0) return { text: 'Expired', color: 'text-red-600' };
  if (daysLeft <= 7) return { text: `${daysLeft}d left`, color: 'text-amber-600' };
  return { text: `${daysLeft}d left`, color: 'text-slate-500' };
}
