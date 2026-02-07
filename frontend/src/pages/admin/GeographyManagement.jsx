import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Globe, MapPin, Plus, Edit2, Trash2, Search, RefreshCw, Flag,
  ChevronRight, Building2, Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import api from '@/api/client';

export default function GeographyManagement() {
  const [activeTab, setActiveTab] = useState('countries');
  const [countries, setCountries] = useState([]);
  const [regions, setRegions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal states
  const [showCountryModal, setShowCountryModal] = useState(false);
  const [showRegionModal, setShowRegionModal] = useState(false);
  const [editingCountry, setEditingCountry] = useState(null);
  const [editingRegion, setEditingRegion] = useState(null);
  const [selectedCountryFilter, setSelectedCountryFilter] = useState('all');
  
  // Form states
  const [countryForm, setCountryForm] = useState({
    code: '', name: '', continent: 'Africa', currency_code: 'XAF', phone_code: '+237', timezone: 'Africa/Douala'
  });
  const [regionForm, setRegionForm] = useState({
    country_id: '', code: '', name: '', capital_city: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [countriesRes, regionsRes] = await Promise.all([
        api.get('/api/geography/countries'),
        api.get('/api/geography/regions')
      ]);
      setCountries(countriesRes.data.countries || []);
      setRegions(regionsRes.data.regions || []);
    } catch (error) {
      toast.error('Failed to fetch geography data');
    } finally {
      setLoading(false);
    }
  };

  const initializeDefaults = async () => {
    try {
      const res = await api.post('/api/geography/initialize-defaults');
      toast.success(res.data.message);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to initialize');
    }
  };

  // Country CRUD
  const handleSaveCountry = async () => {
    try {
      if (editingCountry) {
        await api.put(`/api/geography/countries/${editingCountry.id}`, countryForm);
        toast.success('Country updated');
      } else {
        await api.post('/api/geography/countries', countryForm);
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
      await api.delete(`/api/geography/countries/${id}`);
      toast.success('Country deactivated');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete');
    }
  };

  // Region CRUD
  const handleSaveRegion = async () => {
    try {
      if (editingRegion) {
        await api.put(`/api/geography/regions/${editingRegion.id}`, regionForm);
        toast.success('Region updated');
      } else {
        await api.post('/api/geography/regions', regionForm);
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
      await api.delete(`/api/geography/regions/${id}`);
      toast.success('Region deactivated');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete');
    }
  };

  const filteredCountries = countries.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredRegions = regions.filter(r => {
    const matchesSearch = r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          r.code.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCountry = selectedCountryFilter === 'all' || r.country_code === selectedCountryFilter;
    return matchesSearch && matchesCountry;
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Geography Management</h1>
          <p className="text-slate-600">Manage countries and regions for operator classification</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {countries.length === 0 && (
            <Button onClick={initializeDefaults}>
              <Flag className="w-4 h-4 mr-2" />
              Initialize Defaults
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-xl">
                <Globe className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{countries.length}</p>
                <p className="text-slate-600">Countries</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-xl">
                <MapPin className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{regions.length}</p>
                <p className="text-slate-600">Regions</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-100 rounded-xl">
                <Building2 className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">Africa</p>
                <p className="text-slate-600">Primary Continent</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="countries">Countries</TabsTrigger>
            <TabsTrigger value="regions">Regions</TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-64"
              />
            </div>
            {activeTab === 'countries' && (
              <Button onClick={() => { setEditingCountry(null); setCountryForm({ code: '', name: '', continent: 'Africa', currency_code: 'XAF', phone_code: '+237', timezone: 'Africa/Douala' }); setShowCountryModal(true); }}>
                <Plus className="w-4 h-4 mr-2" /> Add Country
              </Button>
            )}
            {activeTab === 'regions' && (
              <>
                <Select value={selectedCountryFilter} onValueChange={setSelectedCountryFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Filter by country" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Countries</SelectItem>
                    {countries.map(c => (
                      <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={() => { setEditingRegion(null); setRegionForm({ country_id: '', code: '', name: '', capital_city: '' }); setShowRegionModal(true); }}>
                  <Plus className="w-4 h-4 mr-2" /> Add Region
                </Button>
              </>
            )}
          </div>
        </div>

        <TabsContent value="countries" className="mt-4">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCountries.map(country => (
                <Card key={country.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-lg font-bold text-blue-600">
                          {country.code}
                        </div>
                        <div>
                          <h3 className="font-semibold">{country.name}</h3>
                          <p className="text-sm text-slate-500">{country.phone_code} · {country.currency_code}</p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => { setEditingCountry(country); setCountryForm(country); setShowCountryModal(true); }}>
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteCountry(country.id)}>
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between text-sm">
                      <Badge variant="outline">{country.continent}</Badge>
                      <span className="text-slate-500">{country.timezone}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="regions" className="mt-4">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredRegions.map(region => (
                <Card key={region.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                          <MapPin className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold">{region.name}</h3>
                          <p className="text-sm text-slate-500">{region.code}</p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => { setEditingRegion(region); setRegionForm(region); setShowRegionModal(true); }}>
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteRegion(region.id)}>
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between text-sm">
                      <Badge>{region.country_code}</Badge>
                      {region.capital_city && <span className="text-slate-500">Capital: {region.capital_city}</span>}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

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
                <Input value={countryForm.code} onChange={(e) => setCountryForm({...countryForm, code: e.target.value.toUpperCase()})} placeholder="CM" maxLength={2} />
              </div>
              <div>
                <Label>Country Name</Label>
                <Input value={countryForm.name} onChange={(e) => setCountryForm({...countryForm, name: e.target.value})} placeholder="Cameroon" />
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
            <Button onClick={handleSaveCountry}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Region Modal */}
      <Dialog open={showRegionModal} onOpenChange={setShowRegionModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRegion ? 'Edit Region' : 'Add Region'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Region Code</Label>
                <Input value={regionForm.code} onChange={(e) => setRegionForm({...regionForm, code: e.target.value})} placeholder="CM-LT" />
              </div>
              <div>
                <Label>Region Name</Label>
                <Input value={regionForm.name} onChange={(e) => setRegionForm({...regionForm, name: e.target.value})} placeholder="Littoral" />
              </div>
            </div>
            <div>
              <Label>Capital City (Optional)</Label>
              <Input value={regionForm.capital_city} onChange={(e) => setRegionForm({...regionForm, capital_city: e.target.value})} placeholder="Douala" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRegionModal(false)}>Cancel</Button>
            <Button onClick={handleSaveRegion}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
