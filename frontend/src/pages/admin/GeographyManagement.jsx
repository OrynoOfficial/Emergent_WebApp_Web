import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Globe, MapPin, Plus, Edit2, Trash2, Search, Flag,
  ChevronDown, ChevronRight, Building, Loader2, TrendingUp
} from 'lucide-react';
import { toast } from 'sonner';
import api from '@/api/client';
import ManagementShell from '@/components/management/shared/ManagementShell';
import SubpageCard from '@/components/management/shared/SubpageCard';
import IconButton from '@/components/shared/IconButton';
import { TabsContent } from '@/components/ui/tabs';

export default function GeographyManagement() {
  const navigate = useNavigate();
  const [countries, setCountries] = useState([]);
  const [regions, setRegions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCountries, setExpandedCountries] = useState(new Set());

  // Modal states
  const [showCountryModal, setShowCountryModal] = useState(false);
  const [showRegionModal, setShowRegionModal] = useState(false);
  const [editingCountry, setEditingCountry] = useState(null);
  const [editingRegion, setEditingRegion] = useState(null);
  const [regionParentCountry, setRegionParentCountry] = useState(null);

  // Form states
  const [countryForm, setCountryForm] = useState({
    code: '', name: '', continent: 'Africa', currency_code: 'XAF', phone_code: '+237', timezone: 'Africa/Douala'
  });
  const [regionForm, setRegionForm] = useState({
    country_id: '', code: '', name: '', capital_city: ''
  });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [countriesRes, regionsRes] = await Promise.all([
        api.get('/geography/countries'),
        api.get('/geography/regions')
      ]);
      setCountries(countriesRes.data.countries || []);
      setRegions(regionsRes.data.regions || []);
    } catch {
      toast.error('Failed to fetch geography data');
    } finally {
      setLoading(false);
    }
  };

  const initializeDefaults = async () => {
    try {
      const res = await api.post('/geography/initialize-defaults');
      toast.success(res.data.message);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to initialize');
    }
  };

  const toggleCountry = (countryId) => {
    setExpandedCountries(prev => {
      const next = new Set(prev);
      if (next.has(countryId)) next.delete(countryId);
      else next.add(countryId);
      return next;
    });
  };

  const getRegionsForCountry = (countryId) =>
    regions.filter(r => r.country_id === countryId);

  // Country CRUD
  const handleSaveCountry = async () => {
    try {
      if (editingCountry) {
        await api.put(`/geography/countries/${editingCountry.id}`, countryForm);
        toast.success('Country updated');
      } else {
        await api.post('/geography/countries', countryForm);
        toast.success('Country created');
      }
      setShowCountryModal(false);
      setEditingCountry(null);
      setCountryForm({ code: '', name: '', continent: 'Africa', currency_code: 'XAF', phone_code: '+237', timezone: 'Africa/Douala' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save country');
    }
  };

  const handleDeleteCountry = async (id) => {
    if (!confirm('Deactivate this country?')) return;
    try {
      await api.delete(`/geography/countries/${id}`);
      toast.success('Country deactivated');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete');
    }
  };

  // Region CRUD
  const openAddRegion = (country) => {
    setRegionParentCountry(country);
    setEditingRegion(null);
    setRegionForm({ country_id: country.id, code: '', name: '', capital_city: '' });
    setShowRegionModal(true);
  };

  const openEditRegion = (region) => {
    setEditingRegion(region);
    setRegionParentCountry(countries.find(c => c.id === region.country_id) || null);
    setRegionForm({ country_id: region.country_id, code: region.code, name: region.name, capital_city: region.capital_city || '' });
    setShowRegionModal(true);
  };

  const handleSaveRegion = async () => {
    try {
      if (editingRegion) {
        await api.put(`/geography/regions/${editingRegion.id}`, regionForm);
        toast.success('Region updated');
      } else {
        await api.post('/geography/regions', regionForm);
        toast.success('Region created');
      }
      setShowRegionModal(false);
      setEditingRegion(null);
      setRegionForm({ country_id: '', code: '', name: '', capital_city: '' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save region');
    }
  };

  const handleDeleteRegion = async (id) => {
    if (!confirm('Deactivate this region?')) return;
    try {
      await api.delete(`/geography/regions/${id}`);
      toast.success('Region deactivated');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete');
    }
  };

  const filteredCountries = countries.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    getRegionsForCountry(c.id).some(r =>
      r.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  return (
    <ManagementShell
      title="Operator Management"
      icon={Building}
      subtitle="Manage service providers and operators"
      scopeFilter={
        <div className="flex items-center gap-2 flex-wrap">
          {countries.length === 0 && (
            <IconButton icon={Flag} label="Initialize defaults" variant="outline" onClick={initializeDefaults} data-testid="init-defaults-btn" />
          )}
          <IconButton
            icon={Plus}
            label="Add country"
            variant="solid"
            onClick={() => { setEditingCountry(null); setCountryForm({ code: '', name: '', continent: 'Africa', currency_code: 'XAF', phone_code: '+237', timezone: 'Africa/Douala' }); setShowCountryModal(true); }}
            data-testid="add-country-btn"
          />
        </div>
      }
      onRefresh={fetchData}
      refreshing={loading}
      tabs={[
        { value: 'operators', label: 'Operators', icon: Building, testId: 'tab-operators' },
        { value: 'geography', label: 'Geography', icon: Globe, testId: 'tab-geography' },
        { value: 'market-segments', label: 'Market Segments', icon: TrendingUp, testId: 'tab-market-segments' },
      ]}
      activeTab="geography"
      onTabChange={(v) => {
        if (v === 'operators') navigate('/admin/operators');
        else if (v === 'geography') navigate('/admin/operators/geography');
        else if (v === 'market-segments') navigate('/admin/operators/market-segments');
      }}
      testIdPrefix="geography-mgmt"
    >
      <TabsContent value="geography" className="mt-4 space-y-4" forceMount>

      {/* Search */}
      <SubpageCard title="Countries & Regions" icon={Globe} count={countries.length} testId="geography-subpage">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <Input
            placeholder="Search countries or regions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-8 bg-white text-sm"
            data-testid="geography-search"
          />
        </div>
      </SubpageCard>

      {/* Stats — compact chip strip */}
      <div className="flex flex-wrap items-center gap-2" data-testid="geography-stats-grid">
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-[11px] font-medium">
          <Globe className="h-3 w-3" /> Countries <span className="font-bold">{filteredCountries.length}</span>
        </div>
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-green-50 border border-green-200 text-green-700 text-[11px] font-medium">
          <MapPin className="h-3 w-3" /> Regions <span className="font-bold">{filteredCountries.reduce((acc, c) => acc + getRegionsForCountry(c.id).length, 0)}</span>
        </div>
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-medium">
          <Flag className="h-3 w-3" /> With regions <span className="font-bold">{filteredCountries.filter(c => getRegionsForCountry(c.id).length > 0).length}</span>
        </div>
      </div>

      {/* Countries with nested Regions */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
      ) : filteredCountries.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-slate-500">
            <Globe className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p className="font-medium">No countries found</p>
            <p className="text-sm mt-1">Add a country or initialize defaults to get started</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3" data-testid="countries-list">
          {filteredCountries.map(country => {
            const countryRegions = getRegionsForCountry(country.id);
            const isExpanded = expandedCountries.has(country.id);

            return (
              <Card key={country.id} className="overflow-hidden border-slate-200 hover:border-slate-300 transition-colors" data-testid={`country-card-${country.code}`}>
                {/* Country Header */}
                <div
                  className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-slate-50/80 transition-colors"
                  onClick={() => toggleCountry(country.id)}
                  data-testid={`country-toggle-${country.code}`}
                >
                  <div className="flex items-center gap-4">
                    <button className="p-1 rounded transition-transform" style={{ transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)' }}>
                      <ChevronDown className="w-5 h-5 text-slate-500" />
                    </button>
                    <div className="w-11 h-11 bg-blue-100 rounded-lg flex items-center justify-center text-sm font-bold text-blue-700">
                      {country.code}
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">{country.name}</h3>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                        <span>{country.phone_code}</span>
                        <span className="text-slate-300">|</span>
                        <span>{country.currency_code}</span>
                        <span className="text-slate-300">|</span>
                        <span>{country.timezone}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-xs">{country.continent}</Badge>
                    <Badge className="bg-green-50 text-green-700 border border-green-200">
                      <MapPin className="w-3 h-3 mr-1" />
                      {countryRegions.length} region{countryRegions.length !== 1 ? 's' : ''}
                    </Badge>
                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingCountry(country); setCountryForm(country); setShowCountryModal(true); }} data-testid={`edit-country-${country.code}`}>
                        <Edit2 className="w-4 h-4 text-slate-500" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDeleteCountry(country.id)} data-testid={`delete-country-${country.code}`}>
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Regions (Expanded) */}
                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50/50">
                    <div className="px-5 py-3 flex items-center justify-between">
                      <p className="text-sm font-medium text-slate-600">Regions in {country.name}</p>
                      <Button size="sm" variant="outline" onClick={() => openAddRegion(country)} data-testid={`add-region-${country.code}`}>
                        <Plus className="w-3.5 h-3.5 mr-1" /> Add Region
                      </Button>
                    </div>
                    {countryRegions.length === 0 ? (
                      <div className="px-5 pb-4 text-sm text-slate-400 italic">No regions added yet</div>
                    ) : (
                      <div className="px-5 pb-4 space-y-2">
                        {countryRegions.map(region => (
                          <div
                            key={region.id}
                            className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200 hover:border-green-200 transition-colors"
                            data-testid={`region-row-${region.code}`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-green-50 rounded-md flex items-center justify-center">
                                <MapPin className="w-4 h-4 text-green-600" />
                              </div>
                              <div>
                                <p className="font-medium text-slate-800 text-sm">{region.name}</p>
                                <p className="text-xs text-slate-400">{region.code}{region.capital_city ? ` \u00B7 Capital: ${region.capital_city}` : ''}</p>
                              </div>
                            </div>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditRegion(region)} data-testid={`edit-region-${region.code}`}>
                                <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeleteRegion(region.id)} data-testid={`delete-region-${region.code}`}>
                                <Trash2 className="w-3.5 h-3.5 text-red-400" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Country Modal */}
      <Dialog open={showCountryModal} onOpenChange={setShowCountryModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCountry ? 'Edit Country' : 'Add Country'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Country Code (ISO 3166-1)</Label>
                <Input value={countryForm.code} onChange={(e) => setCountryForm({...countryForm, code: e.target.value.toUpperCase()})} placeholder="CM" maxLength={2} data-testid="country-code-input" />
              </div>
              <div>
                <Label>Country Name</Label>
                <Input value={countryForm.name} onChange={(e) => setCountryForm({...countryForm, name: e.target.value})} placeholder="Cameroon" data-testid="country-name-input" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Phone Code</Label>
                <Input value={countryForm.phone_code} onChange={(e) => setCountryForm({...countryForm, phone_code: e.target.value})} placeholder="+237" />
              </div>
              <div>
                <Label>Currency Code</Label>
                <Input value={countryForm.currency_code} onChange={(e) => setCountryForm({...countryForm, currency_code: e.target.value.toUpperCase()})} placeholder="XAF" maxLength={3} />
              </div>
            </div>
            <div>
              <Label>Timezone</Label>
              <Input value={countryForm.timezone} onChange={(e) => setCountryForm({...countryForm, timezone: e.target.value})} placeholder="Africa/Douala" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCountryModal(false)}>Cancel</Button>
            <Button onClick={handleSaveCountry} data-testid="save-country-btn">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Region Modal */}
      <Dialog open={showRegionModal} onOpenChange={setShowRegionModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingRegion ? 'Edit Region' : `Add Region to ${regionParentCountry?.name || 'Country'}`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {!regionParentCountry && (
              <div>
                <Label>Country</Label>
                <Select value={regionForm.country_id} onValueChange={(v) => setRegionForm({...regionForm, country_id: v})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent>
                    {countries.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name} ({c.code})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Region Code</Label>
                <Input value={regionForm.code} onChange={(e) => setRegionForm({...regionForm, code: e.target.value})} placeholder="CM-LT" data-testid="region-code-input" />
              </div>
              <div>
                <Label>Region Name</Label>
                <Input value={regionForm.name} onChange={(e) => setRegionForm({...regionForm, name: e.target.value})} placeholder="Littoral" data-testid="region-name-input" />
              </div>
            </div>
            <div>
              <Label>Capital City (Optional)</Label>
              <Input value={regionForm.capital_city} onChange={(e) => setRegionForm({...regionForm, capital_city: e.target.value})} placeholder="Douala" data-testid="region-capital-input" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRegionModal(false)}>Cancel</Button>
            <Button onClick={handleSaveRegion} data-testid="save-region-btn">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </TabsContent>
    </ManagementShell>
  );
}
