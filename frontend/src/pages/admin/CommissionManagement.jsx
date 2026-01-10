import React, { useState, useEffect } from 'react';
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

const SERVICE_CATEGORIES = [
  { value: 'travel', label: 'Travel Services' },
  { value: 'hotels', label: 'Hotels' },
  { value: 'car_rental', label: 'Car Rental' },
  { value: 'restaurants', label: 'Restaurants' },
  { value: 'packages', label: 'Package Delivery' },
  { value: 'events', label: 'Events' },
  { value: 'entertainment', label: 'Entertainment' },
  { value: 'pressing', label: 'Laundry Services' },
  { value: 'banquet', label: 'Banquet Equipment' }
];

const DEFAULT_CONFIGS = [
  { id: '1', config_type: 'global_default', commission_rate: 13, is_active: true, updated_date: new Date().toISOString(), last_updated_by_name: 'System' },
  { id: '2', config_type: 'service_category', service_category: 'hotels', commission_rate: 15, is_active: true, updated_date: new Date().toISOString(), last_updated_by_name: 'Admin' },
  { id: '3', config_type: 'service_category', service_category: 'travel', commission_rate: 10, is_active: true, updated_date: new Date().toISOString(), last_updated_by_name: 'Admin' },
];

export default function CommissionManagement() {
  const [configs, setConfigs] = useState(DEFAULT_CONFIGS);
  const [operators, setOperators] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState(null);
  const [activeTab, setActiveTab] = useState('global');
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    config_type: 'global_default',
    service_category: '',
    operator_id: '',
    commission_rate: 13,
    is_active: true,
    notes: ''
  });

  const handleOpenDialog = (config = null) => {
    if (config) {
      setEditingConfig(config);
      setFormData({
        config_type: config.config_type,
        service_category: config.service_category || '',
        operator_id: config.operator_id || '',
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
        commission_rate: 13,
        is_active: true,
        notes: ''
      });
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const newConfig = {
        id: editingConfig?.id || String(Date.now()),
        ...formData,
        commission_rate: Number(formData.commission_rate),
        updated_date: new Date().toISOString(),
        last_updated_by_name: 'Admin'
      };

      if (editingConfig) {
        setConfigs(prev => prev.map(c => c.id === editingConfig.id ? newConfig : c));
      } else {
        setConfigs(prev => [...prev, newConfig]);
      }

      setIsDialogOpen(false);
    } catch (error) {
      console.error('Failed to save:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (id) => {
    if (!confirm('Are you sure you want to delete this configuration?')) return;
    setConfigs(prev => prev.filter(c => c.id !== id));
  };

  const handleToggleActive = (config) => {
    setConfigs(prev => prev.map(c => 
      c.id === config.id ? { ...c, is_active: !c.is_active } : c
    ));
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
                  {new Date(config.updated_date).toLocaleDateString()}
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
          <TrendingUp className="h-7 w-7 text-[#082c59]" />
          Commission Management
        </h1>
        <p className="text-slate-600 mt-1">Configure commission rates for services, categories, and operators</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6 bg-slate-100">
          <TabsTrigger value="global" className="flex items-center gap-2 data-[state=active]:bg-[#082c59] data-[state=active]:text-white">
            <Globe className="h-4 w-4" />
            Global Default
          </TabsTrigger>
          <TabsTrigger value="category" className="flex items-center gap-2 data-[state=active]:bg-[#082c59] data-[state=active]:text-white">
            <ShoppingBag className="h-4 w-4" />
            By Category
          </TabsTrigger>
          <TabsTrigger value="operator" className="flex items-center gap-2 data-[state=active]:bg-[#082c59] data-[state=active]:text-white">
            <Building className="h-4 w-4" />
            By Operator
          </TabsTrigger>
        </TabsList>

        <TabsContent value="global">
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
      </Tabs>

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

            {formData.config_type === 'service_category' && (
              <div>
                <Label>Service Category</Label>
                <Select
                  value={formData.service_category}
                  onValueChange={(value) => setFormData({ ...formData, service_category: value })}
                >
                  <SelectTrigger className="bg-white">
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
    </div>
  );
}
