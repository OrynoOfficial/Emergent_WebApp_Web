import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import api from '@/api/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, XCircle, AlertTriangle, Key, ExternalLink, RefreshCw, Shield } from 'lucide-react';

const STATUS_CONFIG = {
  ok: { color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle2, label: 'Valid' },
  invalid: { color: 'bg-red-100 text-red-700 border-red-200', icon: XCircle, label: 'Invalid' },
  error: { color: 'bg-amber-100 text-amber-700 border-amber-200', icon: AlertTriangle, label: 'Error' },
};

const MODE_BADGES = {
  live: { color: 'bg-emerald-100 text-emerald-800', label: 'LIVE' },
  test: { color: 'bg-blue-100 text-blue-800', label: 'TEST' },
  unknown: { color: 'bg-slate-100 text-slate-700', label: '—' },
  not_set: { color: 'bg-slate-100 text-slate-500', label: 'not set' },
};

export default function APIKeysStatus() {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState({});

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/api-keys/');
      setKeys(res.data.keys || []);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to load API keys');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Group keys by provider so we can validate the whole provider at once.
  const grouped = keys.reduce((acc, k) => {
    (acc[k.provider] = acc[k.provider] || []).push(k);
    return acc;
  }, {});

  const validateProvider = async (provider) => {
    setValidating((v) => ({ ...v, [provider]: true }));
    try {
      const res = await api.post(`/admin/api-keys/${encodeURIComponent(provider)}/validate`);
      const { status, message } = res.data;
      if (status === 'ok') toast.success(`${provider}: ${message}`);
      else if (status === 'invalid') toast.error(`${provider}: ${message}`);
      else toast.warning(`${provider}: ${message}`);
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || `Failed to validate ${provider}`);
    } finally {
      setValidating((v) => ({ ...v, [provider]: false }));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16" data-testid="api-keys-loading">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="api-keys-status-page">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Key className="h-6 w-6 text-[#082c59]" /> API Keys
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Read-only audit of every third-party integration key. Keys are stored in the backend
            <code className="mx-1 px-1.5 py-0.5 bg-slate-100 rounded text-xs">.env</code> file and cannot be edited from the UI.
          </p>
        </div>
        <Button variant="outline" onClick={load} data-testid="api-keys-refresh">
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="p-4 flex items-start gap-3">
          <Shield className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-900">
            <p className="font-semibold">Security notice</p>
            <p className="text-amber-800">
              Full key values never leave the backend. Only a 4+4 masked preview is shown here.
              To change a key, update the environment file and restart the backend.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {Object.entries(grouped).map(([provider, providerKeys]) => (
          <Card key={provider} data-testid={`api-key-provider-${provider}`}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{provider}</h3>
                  <p className="text-xs text-slate-500">
                    {providerKeys.filter((k) => k.is_set).length} of {providerKeys.length} keys configured
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {providerKeys[0]?.last_validation_status && (
                    (() => {
                      const cfg = STATUS_CONFIG[providerKeys[0].last_validation_status];
                      if (!cfg) return null;
                      const Icon = cfg.icon;
                      return (
                        <Badge className={`${cfg.color} border gap-1`}>
                          <Icon className="h-3 w-3" /> {cfg.label}
                        </Badge>
                      );
                    })()
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => validateProvider(provider)}
                    disabled={validating[provider]}
                    data-testid={`api-key-validate-${provider}`}
                  >
                    {validating[provider] ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />}
                    Test key
                  </Button>
                </div>
              </div>

              {providerKeys[0]?.last_validation_message && (
                <p className="text-xs text-slate-500 mb-3">
                  Last check: <span className="font-mono">{providerKeys[0].last_validation_message}</span>
                  {providerKeys[0].last_validated_at && (
                    <span className="ml-2">· {new Date(providerKeys[0].last_validated_at).toLocaleString()}</span>
                  )}
                </p>
              )}

              <div className="space-y-2">
                {providerKeys.map((k) => {
                  const modeCfg = MODE_BADGES[k.mode] || MODE_BADGES.unknown;
                  return (
                    <div key={k.env} className="flex items-center justify-between gap-4 p-3 bg-slate-50 rounded-lg" data-testid={`api-key-row-${k.env}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <code className="text-xs font-mono text-slate-700">{k.env}</code>
                          <Badge className={`text-[10px] ${modeCfg.color}`}>{modeCfg.label}</Badge>
                          {!k.is_set && <Badge className="bg-red-100 text-red-700 text-[10px]">missing</Badge>}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">{k.purpose}</p>
                      </div>
                      <div className="text-xs font-mono text-slate-600 tabular-nums">
                        {k.is_set ? k.masked : '—'}
                      </div>
                      {k.docs_url && (
                        <a href={k.docs_url} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-slate-700" title="Provider docs">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
