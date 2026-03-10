import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSearchParams } from 'react-router-dom';
import { Card } from '../components/ui/card';
import { Award } from 'lucide-react';
import CustomerLoyaltyView from './loyalty/CustomerLoyaltyView';
import AdminLoyaltyView from './loyalty/AdminLoyaltyView';

export default function LoyaltyPage() {
  const { user, isOperatorUser } = useAuth();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || null;

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const isOperator = user?.role === 'operator' || isOperatorUser;

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
      {isAdmin ? <AdminLoyaltyView /> : <CustomerLoyaltyView initialTab={initialTab} />}
    </div>
  );
}
