import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Switch } from '../../components/ui/switch';
import { Textarea } from '../../components/ui/textarea';
import { 
  Percent, Plus, Edit, Trash2, TrendingUp, Building, ShoppingBag, Globe, Loader2, Save
} from 'lucide-react';
import { formatDate } from '../../utils/dateUtils';
import ManagementShell from '../../components/management/shared/ManagementShell';
import api from '../../api/client';
import { toast } from 'sonner';

const SERVICE_CATEGORIES = [
  { value: 'travel', label: 'Travel Services' },
  { value: 'hotels', label: 'Hotels' },
  { value: 'car_rental', label: 'Car Rental' },
  { value: 'restaurants', label: 'Restaurants' },
  { value: 'packages', label: 'Package Delivery' },
  { value: 'events', label: 'Events' },
  { value: 'cinema', label: 'Cinema' },
  { value: 'pressing', label: 'Laundry Services' },
  { value: 'banquet', label: 'Banquet Equipment' }
];

// ── Mapping helpers — convert between the frontend's `config_type` /
// `service_category` shape and the backend's flat `service_type` / `operator_id`
// columns. Backend convention:
//   global  → service_type="*"  operator_id=null
//   category→ service_type=<cat>operator_id=null
//   operator→ service_type=<cat>operator_id=<id>
// ───────────────────────────────────────────────────────────────────────────
function toConfigType(serviceType, operatorId) {
  if (operatorId) return 'operator_specific';
  if (!serviceType || serviceType === '*') return 'global_default';
  return 'service_category';
}

function backendToUI(doc) {
  return {
    id: doc._id || doc.id,
    config_type: toConfigType(doc.service_type, doc.operator_id),
    service_category: doc.service_type === '*' ? '' : doc.service_type,
    operator_id: doc.operator_id || '',
    operator_name: doc.operator_name || '',
    commission_rate: doc.base_rate,
    is_active: doc.is_active,
    notes: doc.description || '',
    updated_date: doc.updated_at,
    last_updated_by_name: doc.created_by || 'Admin',
  };
}

function uiToBackend(form) {
  const serviceType =
    form.config_type === 'global_default'
      ? '*'
      : (form.service_category || '');
  return {
    name: form.config_type === 'global_default'
      ? 'Global Default'
      : (form.config_type === 'service_category'
          ? `${form.service_category} default`
          : `${form.service_category} · ${form.operator_name || form.operator_id}`),
    description: form.notes || null,
    service_type: serviceType,
    commission_type: 'percentage',
    base_rate: Number(form.commission_rate),
    operator_id: form.operator_id || null,
    operator_name: form.operator_name || null,
  };
}

export default function CommissionManagement() {
  const [configs, setConfigs] = useState([]);
  const [operators, setOperators] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState(null);
  const [activeTab, setActiveTab] = useState('global');
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    config_type: 'global_default',
    service_category: '',
    operator_id: '',
    operator_name: '',
    commission_rate: 13,
    is_active: true,
    notes: ''
  });

  const loadConfigs = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/commission-config/', { params: { limit: 100, is_active: 'all' } });
      setConfigs((res.data?.configs || []).map(backendToUI));
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to load commission configs');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadOperators = useCallback(async () => {
    try {
      const res = await api.get('/operators', { params: { limit: 200 } });
      setOperators(res.data?.operators || res.data || []);
    } catch {/* operators are optional */}
  }, []);

  useEffect(() => {
    loadConfigs();
    loadOperators();
  }, [loadConfigs, loadOperators]);

  const handleOpenDialog = (config = null) => {
    if (config) {
      setEditingConfig(config);
      setFormData({
        config_type: config.config_type,
        service_category: config.service_category || '',
        operator_id: config.operator_id || '',
        operator_name: config.operator_name || '',
        commission_rate: config.commission_rate,
        is_active: config.is_active,
        notes: config.notes || ''
      });
    } else {
      setEditingConfig(null);
      setFormData({
        config_type: activeTab === 'global' ? 'global_default' : activeTab === 'category' ? 'service_category' : 'operator_specific',
        service_category: '',
        operator_id: '',
        operator_name: '',
        commission_rate: 13,
        is_active: true,
        notes: ''
      });
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (formData.config_type !== 'global_default' && !formData.service_category) {
      toast.error('Pick a service category'); return;
    }
    if (formData.config_type === 'operator_specific' && !formData.operator_id) {
      toast.error('Pick an operator'); return;
    }
    setIsSaving(true);
    try {
      const payload = uiToBackend(formData);
      if (editingConfig) {
        // Backend update only patches certain fields.
        await api.put(`/commission-config/${editingConfig.id}`, {
          name: payload.name,
          description: payload.description,
          base_rate: payload.base_rate,
          is_active: formData.is_active,
        });
        toast.success('Commission updated');
      } else {
        await api.post('/commission-config/', payload);
        toast.success('Commission config created');
      }
      setIsDialogOpen(false);
      loadConfigs();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Save failed');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this commission configuration?')) return;
    try {
      await api.delete(`/commission-config/${id}`);
      toast.success('Deleted');
      loadConfigs();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Delete failed');
    }
  };

  const handleToggleActive = async (config) => {
    try {
      await api.put(`/commission-config/${config.id}`, { is_active: !config.is_active });
      loadConfigs();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Update failed');
    }
  };

  const getConfigsByType = (type) => configs.filter(c => c.config_type === type);

  const getCategoryLabel = (value) => SERVICE_CATEGORIES.find(cat => cat.value === value)?.label || value;

  const ConfigTable = ({ data, showCategory = false, showOperator = false }) => (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-200">
            {showCategory && <th className="text-left py-3 px-4 font-medium text-slate-600">Category</th>}
            {showOperator && <th className="text-left py-3 px-4 font-medium text-slate-600">Operator</th>}
            <th className="text-left py-3 px-4 font-medium text-slate-600">Commission Rate</th>
            <th className="text-left py-3 px-4 font-medium text-slate-600">Status</th>
            <th className="text-left py-3 px-4 font-medium text-slate-600">Last Updated</th>
            <th className="text-right py-3 px-4 font-medium text-slate-600">Actions</th>
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={showCategory || showOperator ? 6 : 4} className="text-center text-slate-500 py-8">
                No configurations found
              </td>
            </tr>
          ) : (
            data.map((config) => (
              <tr key={config.id} className="border-b border-slate-100 hover:bg-slate-50">
                {showCategory && (
                  <td className="py-3 px-4 font-medium">{getCategoryLabel(config.service_category)}</td>
                )}
                {showOperator && (
                  <td className="py-3 px-4 font-medium">
                    <div className="flex items-center gap-2">
                      <Building className="h-4 w-4 text-slate-400" />
                      {config.operator_name || 'Unknown'}
                    </div>
                  </td>
                )}
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <Percent className="h-4 w-4 text-[#082c59]" />
                    <span className="font-semibold text-[#082c59]">{config.commission_rate}%</span>
                  </div>
                </td>
                <td className="py-3 px-4">
                  <Switch checked={config.is_active} onCheckedChange={() => handleToggleActive(config)} />
                </td>
                <td className="py-3 px-4 text-sm text-slate-600">
                  {formatDate(config.updated_date)}
                  <br />
                  <span className="text-xs text-slate-400">{config.last_updated_by_name}</span>
                </td>
                <td className="py-3 px-4 text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(config)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    {config.config_type !== 'global_default' && (
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(config.id)}>
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <ManagementShell
      title="Commission Management"
      icon={TrendingUp}
      subtitle="Configure commission rates for services, categories, and operators"
      tabs={[
        { value: 'global', label: 'Global Default', icon: Globe },
        { value: 'category', label: 'By Category', icon: ShoppingBag },
        { value: 'operator', label: 'By Operator', icon: Building },
      ]}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      testIdPrefix="commission-mgmt"
    >
        <TabsContent value="global" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Global Default Commission</CardTitle>
              <CardDescription>Default commission rate applied to all services unless overridden</CardDescription>
            </CardHeader>
            <CardContent>
              <ConfigTable data={getConfigsByType('global_default')} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="category">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Category-Specific Commissions</CardTitle>
                <CardDescription>Set different commission rates for each service category</CardDescription>
              </div>
              <Button onClick={() => handleOpenDialog()} className="gap-2 bg-[#082c59] hover:bg-[#0a3a75]">
                <Plus className="h-4 w-4" />
                Add Category Rate
              </Button>
            </CardHeader>
            <CardContent>
              <ConfigTable data={getConfigsByType('service_category')} showCategory />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="operator">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Operator-Specific Commissions</CardTitle>
                <CardDescription>Set custom commission rates for specific operators</CardDescription>
              </div>
              <Button onClick={() => handleOpenDialog()} className="gap-2 bg-[#082c59] hover:bg-[#0a3a75]">
                <Plus className="h-4 w-4" />
                Add Operator Rate
              </Button>
            </CardHeader>
            <CardContent>
              <ConfigTable data={getConfigsByType('operator_specific')} showOperator />
            </CardContent>
          </Card>
        </TabsContent>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="text-[#082c59]">
              {editingConfig ? 'Edit Commission Configuration' : 'New Commission Configuration'}
            </DialogTitle>
            <DialogDescription>Set the commission rate and configure the settings</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Configuration Type</Label>
              <Select
                value={formData.config_type}
                onValueChange={(value) => setFormData({ ...formData, config_type: value })}
                disabled={!!editingConfig}
              >
                <SelectTrigger className="bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="global_default">Global Default</SelectItem>
                  <SelectItem value="service_category">Service Category</SelectItem>
                  <SelectItem value="operator_specific">Operator Specific</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(formData.config_type === 'service_category' || formData.config_type === 'operator_specific') && (
              <div>
                <Label>Service Category</Label>
                <Select
                  value={formData.service_category}
                  onValueChange={(value) => setFormData({ ...formData, service_category: value })}
                >
                  <SelectTrigger className="bg-white" data-testid="commission-category-select">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    {SERVICE_CATEGORIES.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {formData.config_type === 'operator_specific' && (
              <div>
                <Label>Operator</Label>
                <Select
                  value={formData.operator_id}
                  onValueChange={(value) => {
                    const op = operators.find((o) => (o._id || o.id) === value);
                    setFormData((p) => ({
                      ...p,
                      operator_id: value,
                      operator_name: op?.business_name || op?.name || '',
                    }));
                  }}
                >
                  <SelectTrigger className="bg-white" data-testid="commission-operator-select">
                    <SelectValue placeholder="Select operator" />
                  </SelectTrigger>
                  <SelectContent className="bg-white max-h-72">
                    {operators.map((op) => (
                      <SelectItem key={op._id || op.id} value={op._id || op.id}>
                        {op.business_name || op.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label>Commission Rate (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={formData.commission_rate}
                onChange={(e) => setFormData({ ...formData, commission_rate: e.target.value })}
                className="bg-white"
              />
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Add any notes about this configuration..."
                rows={3}
                className="bg-white"
              />
            </div>

            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
              <div>
                <Label>Active</Label>
                <p className="text-xs text-slate-600">Enable this configuration</p>
              </div>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving} className="bg-[#082c59] hover:bg-[#0a3a75]">
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {editingConfig ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ManagementShell>
  );
}
