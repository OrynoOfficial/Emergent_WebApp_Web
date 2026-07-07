import React from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

export default function IdleWarningModal({ open, secondsLeft, onStay, onLogout }) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onStay(); }}>
      <DialogContent className="max-w-md" data-testid="idle-warning-modal">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <DialogTitle data-testid="idle-warning-title">{t('idle.title', 'You\'re about to be signed out')}</DialogTitle>
          </div>
          <DialogDescription data-testid="idle-warning-description">
            {t('idle.description', 'For your security, you\'ll be signed out after inactivity. Click "Stay signed in" to continue.')}
          </DialogDescription>
        </DialogHeader>
        <div className="text-center py-4">
          <div className="text-4xl font-bold text-slate-900 tabular-nums" data-testid="idle-warning-countdown">
            {Math.max(0, secondsLeft)}s
          </div>
          <p className="text-xs text-slate-500 mt-1">{t('idle.until_logout', 'until automatic logout')}</p>
        </div>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onLogout} data-testid="idle-warning-logout">
            {t('idle.sign_out_now', 'Sign out now')}
          </Button>
          <Button onClick={onStay} className="bg-[#082c59]" data-testid="idle-warning-stay">
            {t('idle.stay_signed_in', 'Stay signed in')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
