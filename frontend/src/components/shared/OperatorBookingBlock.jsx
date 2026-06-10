import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

/**
 * Hard block placed at the top of every public /services/*\/booking page.
 *
 * Operators (owners + team members) are prohibited from self-booking on their
 * own marketplace to prevent comp-ticket abuse, fake demand metrics, and
 * conflict-of-interest reviews. This component returns a friendly
 * "Operators cannot self-book" interstitial. The booking form is short-
 * circuited entirely — no walk-in redirection (per product policy).
 *
 * Usage:
 *   const block = <OperatorBookingBlock />;
 *   if (block) return block;   // short-circuit before any booking JSX
 */
export default function OperatorBookingBlock() {
  const { user, isOperatorUser } = useAuth();
  const navigate = useNavigate();
  const isOperator = user?.role === 'operator' || isOperatorUser;

  if (!isOperator) return null;

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6" data-testid="operator-booking-block">
      <Card className="max-w-lg w-full border-2 border-amber-200 bg-amber-50/40 shadow-xl">
        <CardContent className="p-8 text-center space-y-5">
          <div className="mx-auto w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
            <ShieldAlert className="h-8 w-8 text-amber-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">
              Operator cannot self book
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Operator accounts are not permitted to place customer bookings.
              This safeguard prevents misuse of the marketplace by the same
              users who manage its supply.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => navigate(-1)}
            className="gap-2"
            data-testid="operator-booking-block-back"
          >
            <ArrowLeft className="h-4 w-4" /> Go back
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
