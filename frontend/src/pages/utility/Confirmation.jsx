import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  CheckCircle, XCircle, Clock, Home, RefreshCw,
  HelpCircle, Download, Share2
} from 'lucide-react';

const STATUS_CONFIG = {
  success: {
    icon: CheckCircle,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    title: 'Success!',
    defaultMessage: 'Your action was completed successfully.'
  },
  error: {
    icon: XCircle,
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    title: 'Error',
    defaultMessage: 'Something went wrong. Please try again.'
  },
  pending: {
    icon: Clock,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100',
    title: 'Pending',
    defaultMessage: 'Your request is being processed.'
  }
};

export default function Confirmation() {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Get state from navigation or use defaults
  const state = location.state || {};
  const status = state.status || 'success';
  const title = state.title || STATUS_CONFIG[status]?.title || 'Confirmation';
  const message = state.message || STATUS_CONFIG[status]?.defaultMessage;
  const details = state.details || [];
  const primaryAction = state.primaryAction || { label: 'Go to Dashboard', path: '/dashboard' };
  const secondaryAction = state.secondaryAction;

  const config = STATUS_CONFIG[status] || STATUS_CONFIG.success;
  const Icon = config.icon;

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardContent className="p-8 text-center">
          <div className={`w-20 h-20 ${config.bgColor} rounded-full flex items-center justify-center mx-auto mb-6`}>
            <Icon className={`w-10 h-10 ${config.color}`} />
          </div>

          <h1 className={`text-2xl font-bold ${config.color} mb-2`}>{title}</h1>
          <p className="text-gray-600 mb-6">{message}</p>

          {details.length > 0 && (
            <div className="bg-slate-50 rounded-lg p-4 mb-6 text-left">
              {details.map((detail, idx) => (
                <div key={idx} className="flex justify-between py-2 border-b last:border-0">
                  <span className="text-gray-500">{detail.label}</span>
                  <span className="font-medium">{detail.value}</span>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-3">
            <Button 
              className="w-full bg-[#082c59]" 
              onClick={() => navigate(primaryAction.path)}
            >
              {primaryAction.label}
            </Button>
            
            {secondaryAction && (
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => navigate(secondaryAction.path)}
              >
                {secondaryAction.label}
              </Button>
            )}
          </div>

          {status === 'error' && (
            <Button 
              variant="ghost" 
              className="mt-4 text-gray-500"
              onClick={() => navigate('/support')}
            >
              <HelpCircle className="w-4 h-4 mr-2" /> Need Help?
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
