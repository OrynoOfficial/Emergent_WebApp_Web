import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Card } from '../components/ui/card';
import { Award } from 'lucide-react';
import CustomerLoyaltyView from './loyalty/CustomerLoyaltyView';
import AdminLoyaltyView from './loyalty/AdminLoyaltyView';

export default function LoyaltyPage() {
  const { user, isOperatorUser } = useAuth();

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const isOperator = user?.role === 'operator' || isOperatorUser;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#082c59]" data-testid="loyalty-title">
            {isAdmin ? 'Loyalty Program' : isOperator ? 'Promo & Alerts' : 'Loyalty Rewards'}
          </h1>
          <p className="text-slate-600">
            {isAdmin
              ? 'Manage and configure the loyalty program'
              : isOperator
                ? 'Manage your promotions and alerts — visible only to you'
                : 'Earn points and redeem exclusive rewards'}
          </p>
        </div>
      </div>
      {/* Operators get the AdminLoyaltyView scoped to their own data — the backend
          /api/subscriptions/promotions endpoint already forces operator scoping for
          role === 'operator' regardless of any operator_id query param. */}
      {(isAdmin || isOperator) ? <AdminLoyaltyView /> : <CustomerLoyaltyView />}
    </div>
  );
}
