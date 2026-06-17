import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import ServiceFormShell from '@/components/management/shared/ServiceFormShell';
import GenericPreviewCard from '@/components/management/shared/GenericPreviewCard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ManagementShell from '@/components/management/shared/ManagementShell';
import SubpageCard from '@/components/management/shared/SubpageCard';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  Utensils, Plus, LayoutDashboard, MessageSquare, RefreshCw, MapPin, Star, 
  Clock, Phone, Mail, Save, Trash2, Edit, Eye, ChevronRight, X, Menu, 
  DollarSign, ChevronLeft, Building2, Banknote, Receipt,
  Replace as ReplaceIcon
} from 'lucide-react';
import OperatorBookingsList from '@/components/management/shared/OperatorBookingsList';
import ReplaceResourceModal from '@/components/management/shared/ReplaceResourceModal';
import api from '@/api/client';
import { formatFCFA } from '@/utils/currency';
import { geocodeAddress } from '@/utils/geocode';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/contexts/PermissionsContext';
import PermissionGate from '@/components/common/PermissionGate';
import OperatorScopeFilter from '@/components/common/OperatorScopeFilter';
import { toast } from 'sonner';

// Shared components
import { SearchFilter, Pagination, EmptyState, ConfirmDialog } from '@/components/management/shared';
import { ImageCarousel } from '@/components/management/shared';
import BulkActionsBar, { BulkSelectCardWrapper } from '@/components/shared/BulkActionsBar';
import { useBulkSelection } from '@/hooks/useBulkSelection';

// Restaurant-specific components
import { RestaurantForm, MenuItemForm } from '@/components/management/restaurant';

// Service components
import ServiceExecutiveDashboard from '@/components/management/ServiceExecutiveDashboard';
import ServiceCommunicationsHub from '@/components/management/ServiceCommunicationsHub';
import { useRealDashboardData } from '@/hooks/useRealDashboardData';

const ITEMS_PER_PAGE = 8;
const PRICE_RANGE_LABELS = { budget: '$', moderate: '$$', upscale: '$$$', fine_dining: '$$$$' };
const CATEGORY_COLORS = {
  starters: 'bg-blue-100 text-blue-700',
  mains: 'bg-orange-100 text-orange-700',
  desserts: 'bg-pink-100 text-pink-700',
  drinks: 'bg-cyan-100 text-cyan-700',
  specials: 'bg-purple-100 text-purple-700',
  sides: 'bg-green-100 text-green-700'
};

const DEFAULT_RESTAURANT_FORM = {
  name: '', description: '', cuisine_type: [], address: '', city: '', country: 'Cameroon',
  phone: '', email: '', price_range: 'moderate', features: [], opening_hours: {}, images: [],
  operator_id: '', operator_name: '',
  // Map pin set by the geocoder so customer-facing detail page shows a
  // pixel-accurate live map instead of the city centroid.
  latitude: null, longitude: null,
};

const DEFAULT_MENU_ITEM = {
  name: '', description: '', category: '', price: '', is_available: true, image: '', images: [], ingredients: [], allergens: []
};

// Dashboard data generator
// Dashboard data now fetched from API via useRealDashboardData hook

// Modern Restaurant Card Component
const RestaurantCard = ({ restaurant, onViewMenu, onEdit, onDelete, onReplace, canEdit, canDelete, isSelected = false, isOtherSelected = false }) => {
  const images = restaurant.images?.filter(img => img) || [];
  const cuisineTypes = restaurant.cuisine_type || [];
  const backendUrl = import.meta.env.VITE_BACKEND_URL || '';
  const getImageUrl = (img) => img?.startsWith('/api') ? `${backendUrl}${img}` : img;

  return (
    <Card className={`group overflow-hidden transition-all duration-300 border-0 shadow-md ${
      isSelected 
        ? 'ring-2 ring-orange-500 shadow-xl shadow-orange-100 scale-[1.02]' 
        : isOtherSelected 
          ? 'opacity-60 hover:opacity-80' 
          : 'hover:shadow-xl'
    }`}>
      {/* Image Section */}
      <div className="relative h-44 bg-gradient-to-br from-slate-100 to-slate-200 overflow-hidden">
        {images.length > 0 ? (
          <img 
            src={getImageUrl(images[0])} 
            alt={restaurant.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            onError={(e) => { e.target.src = 'https://placehold.co/400x300/f1f5f9/64748b?text=No+Image'; }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Utensils className="w-16 h-16 text-slate-300" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        <div className="absolute top-3 left-3">
          <Badge className={restaurant.status === 'active' ? 'bg-emerald-500 text-white border-0' : 'bg-slate-500 text-white border-0'}>
            {restaurant.status || 'Active'}
          </Badge>
        </div>
        <div className="absolute top-3 right-3 flex items-center gap-1 bg-white/90 px-2 py-1 rounded-lg">
          <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
          <span className="font-semibold text-sm">{restaurant.rating || 4.5}</span>
        </div>
        <div className="absolute bottom-3 left-3 right-3 text-white">
          <h3 className="font-bold text-lg truncate">{restaurant.name}</h3>
          <div className="flex items-center gap-1 text-white/90 text-sm">
            <MapPin className="w-3.5 h-3.5" />
            <span className="truncate">{restaurant.address || restaurant.city}</span>
          </div>
        </div>
      </div>
      
      <CardContent className="p-4">
        {/* Operator Assignment */}
        {restaurant.operator_name && (
          <div className="flex items-center gap-2 mb-3 p-2 bg-indigo-50 rounded-lg border border-indigo-100">
            <Building2 className="w-4 h-4 text-indigo-600 flex-shrink-0" />
            <span className="text-sm font-medium text-indigo-800 truncate">{restaurant.operator_name}</span>
          </div>
        )}
        
        <div className="flex flex-wrap gap-1.5 mb-3">
          <Badge variant="outline">{PRICE_RANGE_LABELS[restaurant.price_range] || '$$'}</Badge>
          {cuisineTypes.slice(0, 2).map(c => (
            <Badge key={c} variant="secondary" className="capitalize text-xs">{c}</Badge>
          ))}
          {cuisineTypes.length > 2 && (
            <Badge variant="outline" className="text-xs">+{cuisineTypes.length - 2}</Badge>
          )}
        </div>

        <div className="flex items-center gap-3 text-sm text-slate-500 mb-3">
          <div className="flex items-center gap-1">
            <Phone className="w-3.5 h-3.5" />
            <span>{restaurant.phone || 'No phone'}</span>
          </div>
        </div>

        <div className="flex gap-2 pt-3 border-t">
          <Button 
            size="sm" 
            onClick={() => onViewMenu(restaurant)} 
            className="flex-1 bg-orange-600 hover:bg-orange-700"
          >
            <Menu className="w-4 h-4 mr-1" /> View Menu
          </Button>
          {canEdit && (
            <PermissionGate permission="restaurants.edit">
              <Button size="sm" variant="outline" onClick={() => onReplace?.(restaurant)} title="Migrate bookings to another restaurant" className="text-[#082c59] hover:bg-[#082c59]/10" data-testid={`replace-restaurant-btn-${restaurant.id}`}>
                <ReplaceIcon className="w-4 h-4" />
              </Button>
            </PermissionGate>
          )}
          {canEdit && (
            <PermissionGate permission="restaurants.edit">
              <Button size="sm" variant="outline" onClick={() => onEdit(restaurant)}>
                <Edit className="w-4 h-4" />
              </Button>
            </PermissionGate>
          )}
          {canDelete && (
            <PermissionGate permission="restaurants.delete">
              <Button size="sm" variant="outline" className="text-red-600 hover:bg-red-50" onClick={() => onDelete(restaurant)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </PermissionGate>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// Enhanced Menu Item Card with more info
const EnhancedMenuItemCard = ({ item, onEdit, onDelete, canEdit, canDelete }) => {
  const isAvailable = item.is_available !== false && item.available !== false;
  const categoryColor = CATEGORY_COLORS[item.category] || 'bg-slate-100 text-slate-700';
  const backendUrl = import.meta.env.VITE_BACKEND_URL || '';
  const getImageUrl = (img) => img?.startsWith('/api') ? `${backendUrl}${img}` : img;

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-all duration-300 border-0 shadow-md">
      <div className="flex">
        {/* Image with scrollable thumbnails */}
        <div className="w-32 h-32 flex-shrink-0 bg-gradient-to-br from-slate-100 to-slate-200 overflow-hidden relative">
          {item.image ? (
            <img 
              src={getImageUrl(item.image)} 
              alt={item.name}
              className="w-full h-full object-cover"
              onError={(e) => { e.target.src = 'https://placehold.co/200x200/f1f5f9/64748b?text=No+Image'; }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Utensils className="w-10 h-10 text-slate-300" />
            </div>
          )}
          {item.popular && (
            <div className="absolute top-1 left-1">
              <Badge className="bg-amber-500 text-white text-[10px] px-1.5 py-0.5">Popular</Badge>
            </div>
          )}
        </div>
        
        {/* Info Section */}
        <div className="flex-1 p-3 flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between gap-2 mb-1">
              <h4 className="font-bold text-slate-900 line-clamp-1">{item.name}</h4>
              <Badge className={`${categoryColor} text-xs`}>{item.category}</Badge>
            </div>
            <p className="text-xs text-slate-500 line-clamp-2 mb-2">{item.description || 'No description'}</p>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg text-orange-600">{formatFCFA(item.price)}</span>
              <Badge className={`text-xs ${isAvailable ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                {isAvailable ? 'Available' : 'Unavailable'}
              </Badge>
            </div>
            
            <div className="flex gap-1">
              {canEdit && (
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEdit(item)}>
                  <Edit className="w-3.5 h-3.5" />
                </Button>
              )}
              {canDelete && (
                <Button size="icon" variant="ghost" className="h-7 w-7 text-red-600" onClick={() => onDelete(item)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default function RestaurantManagement() {
  useAuth();
  const { hasPermission } = usePermissions();
  
  // Data state
  const [restaurants, setRestaurants] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [operators, setOperators] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // UI state
  const [activeTab, setActiveTab] = useState('dashboard');
  const [viewMode, setViewMode] = useState('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  
  // Selection state
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [showMenuPanel, setShowMenuPanel] = useState(false);
  
  // Dialog state
  const [isRestaurantDialogOpen, setIsRestaurantDialogOpen] = useState(false);
  const [isMenuDialogOpen, setIsMenuDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  
  // Form state
  const [restaurantForm, setRestaurantForm] = useState(DEFAULT_RESTAURANT_FORM);
  const [menuForm, setMenuForm] = useState(DEFAULT_MENU_ITEM);
  const [editingRestaurant, setEditingRestaurant] = useState(null);
  const [editingMenuItem, setEditingMenuItem] = useState(null);
  const [saving, setSaving] = useState(false);
  const [scopeOperatorId, setScopeOperatorId] = useState('');
  const [bookingsRefreshKey, setBookingsRefreshKey] = useState(0);
  const [replaceRestaurant, setReplaceRestaurant] = useState(null);

  const dashboardData = useRealDashboardData('restaurants', '30days', scopeOperatorId);

  // Load restaurants
  const loadRestaurants = useCallback(async () => {
    try {
      setLoading(true);
      const params = scopeOperatorId ? `?operator_id=${scopeOperatorId}` : '';
      const res = await api.get(`/restaurants/management/my-restaurants${params}`);
      setRestaurants(res.data.restaurants || res.data || []);
    } catch (error) {
      console.error('Failed to load restaurants:', error);
      toast.error('Failed to load restaurants');
    } finally {
      setLoading(false);
    }
  }, [scopeOperatorId]);

  // Load menu for selected restaurant
  const loadMenu = useCallback(async (restaurantId) => {
    try {
      const res = await api.get(`/restaurants/${restaurantId}/menu`);
      setMenuItems(res.data.items || res.data.menu || []);
    } catch (error) {
      console.error('Failed to load menu:', error);
      setMenuItems([]);
    }
  }, []);

  // Load operators
  const loadOperators = useCallback(async () => {
    try {
      const res = await api.get('/operators/');
      setOperators(res.data.operators || []);
    } catch (error) {
      console.error('Failed to load operators:', error);
    }
  }, []);

  useEffect(() => {
    loadRestaurants();
    loadOperators();
  }, [loadRestaurants, loadOperators]);

  useEffect(() => {
    if (selectedRestaurant) {
      loadMenu(selectedRestaurant.id);
    }
  }, [selectedRestaurant, loadMenu]);

  // Filter restaurants
  const filteredRestaurants = useMemo(() => {
    return restaurants.filter(r => {
      const matchesSearch = !searchQuery || 
        r.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.city?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = filterStatus === 'all' || r.status === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [restaurants, searchQuery, filterStatus]);

  // Paginate
  const paginatedRestaurants = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredRestaurants.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredRestaurants, currentPage]);

  // Bulk selection on visible page (card grid via BulkSelectCardWrapper).
  const restaurantBulk = useBulkSelection(paginatedRestaurants, { idKey: 'id' });
  const _restBulkRun = async (action, ids) => {
    await api.post('/admin/bulk', { collection: 'restaurants', action, ids });
    if (typeof loadRestaurants === 'function') await loadRestaurants();
  };
  const bulkRestaurantDelete     = (ids) => _restBulkRun('delete', ids);
  const bulkRestaurantActivate   = (ids) => _restBulkRun('activate', ids);
  const bulkRestaurantDeactivate = (ids) => _restBulkRun('deactivate', ids);

  const totalPages = Math.ceil(filteredRestaurants.length / ITEMS_PER_PAGE);

  // Handle View Menu - opens menu panel on right
  const handleViewMenu = (restaurant) => {
    setSelectedRestaurant(restaurant);
    setShowMenuPanel(true);
  };

  // Handle View Restaurant Details
  const handleViewRestaurant = (restaurant) => {
    setSelectedRestaurant(restaurant);
    setIsViewDialogOpen(true);
  };

  // Restaurant CRUD
  const openRestaurantDialog = (restaurant = null) => {
    if (restaurant) {
      setEditingRestaurant(restaurant);
      setRestaurantForm({ ...restaurant });
    } else {
      setEditingRestaurant(null);
      setRestaurantForm(DEFAULT_RESTAURANT_FORM);
    }
    setIsRestaurantDialogOpen(true);
  };

  const handleSaveRestaurant = async () => {
    if (!restaurantForm.name || !restaurantForm.city) {
      toast.error('Name and city are required');
      return;
    }
    
    try {
      setSaving(true);
      // Auto-geocode silently when address/city exist but no pin set.
      let payload = { ...restaurantForm };
      if ((payload.latitude == null || payload.longitude == null) && (payload.address || payload.city)) {
        const queryParts = [payload.address, payload.city, payload.country || 'Cameroon'].filter(Boolean).join(', ');
        const hit = await geocodeAddress(queryParts);
        if (hit) {
          payload.latitude = hit.lat;
          payload.longitude = hit.lon;
        }
      }
      if (editingRestaurant) {
        await api.put(`/restaurants/${editingRestaurant.id}`, payload);
        toast.success('Restaurant updated');
      } else {
        await api.post('/restaurants/', payload);
        toast.success('Restaurant created');
      }
      setIsRestaurantDialogOpen(false);
      loadRestaurants();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteRestaurant = (restaurant) => {
    setDeleteTarget({ type: 'restaurant', item: restaurant });
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteRestaurant = async () => {
    if (!deleteTarget?.item) return;
    try {
      setSaving(true);
      await api.delete(`/restaurants/${deleteTarget.item.id}`);
      toast.success('Restaurant deleted');
      setIsDeleteDialogOpen(false);
      setDeleteTarget(null);
      if (selectedRestaurant?.id === deleteTarget.item.id) {
        setSelectedRestaurant(null);
        setShowMenuPanel(false);
      }
      loadRestaurants();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete');
    } finally {
      setSaving(false);
    }
  };

  // Menu CRUD
  const openMenuDialog = (item = null) => {
    if (item) {
      setEditingMenuItem(item);
      setMenuForm({ ...item, price: item.price?.toString() || '' });
    } else {
      setEditingMenuItem(null);
      setMenuForm(DEFAULT_MENU_ITEM);
    }
    setIsMenuDialogOpen(true);
  };

  const handleSaveMenuItem = async () => {
    if (!menuForm.name || !menuForm.category || !menuForm.price) {
      toast.error('Name, category, and price are required');
      return;
    }
    
    try {
      setSaving(true);
      const { popular: _popular, ...rest } = menuForm;
      const data = { ...rest, price: parseFloat(menuForm.price) || 0 };
      if (editingMenuItem) {
        await api.put(`/restaurants/${selectedRestaurant.id}/menu/${editingMenuItem.id}`, data);
        toast.success('Menu item updated');
      } else {
        await api.post(`/restaurants/${selectedRestaurant.id}/menu`, data);
        toast.success('Menu item added');
      }
      setIsMenuDialogOpen(false);
      loadMenu(selectedRestaurant.id);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteMenuItem = (item) => {
    setDeleteTarget({ type: 'menu', item });
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteMenuItem = async () => {
    if (!deleteTarget?.item) return;
    try {
      setSaving(true);
      await api.delete(`/restaurants/${selectedRestaurant.id}/menu/${deleteTarget.item.id}`);
      toast.success('Menu item deleted');
      setIsDeleteDialogOpen(false);
      setDeleteTarget(null);
      loadMenu(selectedRestaurant.id);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete');
    } finally {
      setSaving(false);
    }
  };

  const canEdit = hasPermission('restaurants.edit');
  const canDelete = hasPermission('restaurants.delete');

  return (
    <>
      <ManagementShell
        title="Restaurant Management"
        icon={Utensils}
        subtitle="Manage restaurants, menus, and reservations"
        scopeFilter={
          <>
            <OperatorScopeFilter serviceType="restaurant" value={scopeOperatorId} onChange={setScopeOperatorId} />
            <PermissionGate permission="restaurants.create">
              <Button onClick={() => openRestaurantDialog()} size="sm" className="bg-orange-600 hover:bg-orange-700 h-8" data-testid="add-restaurant-btn">
                <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Restaurant
              </Button>
            </PermissionGate>
          </>
        }
        onRefresh={loadRestaurants}
        refreshing={loading}
        tabs={[
          { value: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { value: 'management', label: 'Management', icon: Utensils },
          { value: 'communications', label: 'Communications', icon: MessageSquare },
        ]}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        testIdPrefix="restaurant-mgmt"
      >

          {/* Dashboard Tab */}
          <TabsContent value="dashboard">
            <ServiceExecutiveDashboard
              serviceType="Restaurants"
              serviceIcon={<Utensils className="h-8 w-8" />}
              primaryColor="orange"
              stats={dashboardData.stats}
              bookingsByStatus={dashboardData.bookingsByStatus}
              dailyTrend={dashboardData.dailyTrend}
              distribution={dashboardData.distribution}
              itemLabel="Restaurants"
              secondaryLabel="Menu Items"
              secondaryCount={dashboardData.secondaryCount}
              recentBookingsSlot={
                <OperatorBookingsList serviceType="restaurant" refreshKey={bookingsRefreshKey} compact viewAllHref="/admin/bookings" />
              }
            />
          </TabsContent>

          {/* Management Tab */}
          <TabsContent value="management" className="space-y-4">
            <div className="flex gap-6">
              {/* Restaurants List */}
              <div className={`${showMenuPanel ? 'flex-1' : 'w-full'} transition-all duration-300 space-y-4`}>
                <SubpageCard
                  title="Restaurants"
                  icon={Utensils}
                  iconColorClass="text-orange-600"
                  count={filteredRestaurants.length}
                  testId="restaurant-mgmt-subpage-card"
                >
                  <div className="flex-1 min-w-[200px]">
                    <SearchFilter
                      searchValue={searchQuery}
                      onSearchChange={setSearchQuery}
                      searchPlaceholder="Search restaurants…"
                      filters={[{
                        key: 'status',
                        placeholder: 'Status',
                        options: [
                          { value: 'active', label: 'Active' },
                          { value: 'inactive', label: 'Inactive' },
                        ],
                      }]}
                      filterValues={{ status: filterStatus }}
                      onFilterChange={(key, val) => setFilterStatus(val)}
                      showViewToggle
                      viewMode={viewMode}
                      onViewModeChange={setViewMode}
                    />
                  </div>
                </SubpageCard>

                <Card className="shadow-lg border-0">
                  <CardContent className="p-4">
                    {loading ? (
                      <div className="flex items-center justify-center py-12">
                        <RefreshCw className="h-8 w-8 animate-spin text-orange-500" />
                      </div>
                    ) : paginatedRestaurants.length === 0 ? (
                      <EmptyState
                        icon={Utensils}
                        title="No restaurants found"
                        description={searchQuery ? "Try adjusting your search" : "Create your first restaurant to get started"}
                        actionLabel="Add Restaurant"
                        onAction={() => openRestaurantDialog()}
                      />
                    ) : (
                      <>
                        <div className={
                          viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
                          : viewMode === 'details' ? 'space-y-4'
                          : 'space-y-3'
                        }>
                          {paginatedRestaurants.map(restaurant => (
                            <BulkSelectCardWrapper key={restaurant.id} bulk={restaurantBulk} id={restaurant.id}>
                            <RestaurantCard
                              restaurant={restaurant}
                              onViewMenu={handleViewMenu}
                              onEdit={openRestaurantDialog}
                              onDelete={confirmDeleteRestaurant}
                              onReplace={setReplaceRestaurant}
                              canEdit={canEdit}
                              canDelete={canDelete}
                              isSelected={showMenuPanel && selectedRestaurant?.id === restaurant.id}
                              isOtherSelected={showMenuPanel && selectedRestaurant?.id !== restaurant.id}
                            />
                            </BulkSelectCardWrapper>
                          ))}
                        </div>
                        {totalPages > 1 && (
                          <Pagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            totalItems={filteredRestaurants.length}
                            itemsPerPage={ITEMS_PER_PAGE}
                            onPageChange={setCurrentPage}
                            className="mt-4 pt-4 border-t"
                          />
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Menu Panel (Slide-in from right) */}
              {showMenuPanel && selectedRestaurant && (
                <div className="w-[420px] flex-shrink-0 animate-in slide-in-from-right duration-300">
                  <Card className="shadow-lg border-0 sticky top-4">
                    <CardHeader className="bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-t-xl pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-xl font-bold truncate">
                            {selectedRestaurant.name}
                          </CardTitle>
                          <div className="flex items-center gap-2 mt-1">
                            <Menu className="h-4 w-4 text-amber-200" />
                            <span className="text-amber-100 text-sm">Menu Items</span>
                            {selectedRestaurant.operator_name && (
                              <>
                                <span className="text-amber-200">•</span>
                                <span className="text-amber-200 text-xs truncate">{selectedRestaurant.operator_name}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-8 w-8 text-white hover:bg-white/20"
                            onClick={() => handleViewRestaurant(selectedRestaurant)}
                            title="View Restaurant"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-8 w-8 text-white hover:bg-white/20"
                            onClick={() => openRestaurantDialog(selectedRestaurant)}
                            title="Edit Restaurant"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-8 w-8 text-white hover:bg-white/20"
                            onClick={() => { setShowMenuPanel(false); setSelectedRestaurant(null); }}
                            title="Close Menu"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4">
                      <div className="flex justify-between items-center mb-4">
                        <span className="text-sm text-slate-500 font-medium">{menuItems.length} items</span>
                        <PermissionGate permission="restaurants.edit">
                          <Button size="sm" onClick={() => openMenuDialog()} className="bg-amber-600 hover:bg-amber-700">
                            <Plus className="h-4 w-4 mr-1" /> Add Item
                          </Button>
                        </PermissionGate>
                      </div>
                      
                      <ScrollArea className="h-[500px] pr-2">
                        {menuItems.length === 0 ? (
                          <div className="text-center py-8 text-slate-500">
                            <Utensils className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                            <p>No menu items yet</p>
                            <Button size="sm" onClick={() => openMenuDialog()} className="mt-3 bg-amber-600">
                              <Plus className="h-4 w-4 mr-1" /> Add First Item
                            </Button>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {menuItems.map(item => (
                              <EnhancedMenuItemCard
                                key={item.id}
                                item={item}
                                onEdit={openMenuDialog}
                                onDelete={confirmDeleteMenuItem}
                                canEdit={canEdit}
                                canDelete={canDelete}
                              />
                            ))}
                          </div>
                        )}
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Communications Tab */}
          <TabsContent value="communications">
            <ServiceCommunicationsHub serviceType="Restaurants" operatorId={scopeOperatorId} serviceIcon={<Utensils className="h-6 w-6" />} />
          </TabsContent>
      </ManagementShell>

      {/* Restaurant Dialog */}
      <ServiceFormShell
        open={isRestaurantDialogOpen}
        onOpenChange={setIsRestaurantDialogOpen}
        icon={Utensils}
        title={editingRestaurant ? 'Edit Restaurant' : 'Add Restaurant'}
        subtitle={editingRestaurant
          ? 'Update cuisine, hours, photos and contact info — changes go live immediately.'
          : 'Tell us about the restaurant — cuisine, location, ambience and photos.'}
        editing={!!editingRestaurant}
        accent="orange"
        leftColumn={
          <RestaurantForm
            form={restaurantForm}
            onChange={setRestaurantForm}
            operators={operators}
            isEditing={!!editingRestaurant}
          />
        }
        preview={
          <GenericPreviewCard
            cover={(restaurantForm.images || [])[0]}
            thumbs={(restaurantForm.images || []).slice(1, 3)}
            icon={Utensils}
            badgeText="Restaurant"
            badgeClass="bg-orange-500 text-white"
            placeholderColor="from-orange-600 via-orange-500 to-amber-500"
            title={restaurantForm.name}
            subtitle={(restaurantForm.cuisine_type || []).slice(0, 2).join(' · ') || 'Cuisine pending'}
            location={`${restaurantForm.city || 'City'}${restaurantForm.address ? ', ' + restaurantForm.address : ''}`}
            tags={[
              ...(restaurantForm.cuisine_type || []),
              ...(restaurantForm.features || []),
            ]}
            tagsAccentClass="bg-orange-50 text-orange-700"
            priceLabel="Price range"
            priceValue={(() => {
              const p = restaurantForm.price_range;
              if (p === 'budget') return '$ Budget';
              if (p === 'moderate') return '$$ Moderate';
              if (p === 'upscale') return '$$$ Upscale';
              if (p === 'fine_dining') return '$$$$ Fine dining';
              return '—';
            })()}
            accentTextClass="text-orange-700"
          />
        }
        submitting={saving}
        submitLabel={editingRestaurant ? 'Update Restaurant' : 'Create Restaurant'}
        onSubmit={handleSaveRestaurant}
        submitDataTestId="save-restaurant-btn"
      />

      {/* Menu Item Dialog */}
      <Dialog open={isMenuDialogOpen} onOpenChange={setIsMenuDialogOpen}>
        <DialogContent className="bg-white max-w-md">
          <DialogHeader>
            <DialogTitle>{editingMenuItem ? 'Edit Menu Item' : 'Add Menu Item'}</DialogTitle>
          </DialogHeader>
          <MenuItemForm form={menuForm} onChange={setMenuForm} isEditing={!!editingMenuItem} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsMenuDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveMenuItem} disabled={saving} className="bg-amber-600 hover:bg-amber-700">
              {saving ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              {editingMenuItem ? 'Update' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Restaurant Dialog - with Edit button */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="bg-white max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedRestaurant && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Utensils className="h-5 w-5 text-orange-600" />
                  {selectedRestaurant.name}
                </DialogTitle>
                <DialogDescription>Restaurant details and information</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <ImageCarousel images={selectedRestaurant.images || []} height={200} emptyIcon={Utensils} />
                
                {/* Operator Assignment - Added */}
                {selectedRestaurant.operator_name && (
                  <div className="flex items-center gap-2 p-3 bg-indigo-50 rounded-lg border border-indigo-100">
                    <Building2 className="w-5 h-5 text-indigo-600 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-indigo-600">Operated by</p>
                      <p className="font-medium text-indigo-800">{selectedRestaurant.operator_name}</p>
                    </div>
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-slate-500">Location</label>
                    <p className="flex items-center gap-1 font-medium"><MapPin className="w-4 h-4" /> {selectedRestaurant.city}, {selectedRestaurant.country}</p>
                  </div>
                  <div>
                    <label className="text-sm text-slate-500">Rating</label>
                    <p className="flex items-center gap-1 font-medium"><Star className="w-4 h-4 text-amber-500" /> {selectedRestaurant.rating || 4.5}</p>
                  </div>
                  <div>
                    <label className="text-sm text-slate-500">Phone</label>
                    <p className="flex items-center gap-1"><Phone className="w-4 h-4" /> {selectedRestaurant.phone || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-sm text-slate-500">Email</label>
                    <p className="flex items-center gap-1"><Mail className="w-4 h-4" /> {selectedRestaurant.email || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-sm text-slate-500">Price Range</label>
                    <p className="font-medium">{PRICE_RANGE_LABELS[selectedRestaurant.price_range] || '$$'}</p>
                  </div>
                  <div>
                    <label className="text-sm text-slate-500">Address</label>
                    <p className="font-medium">{selectedRestaurant.address || 'N/A'}</p>
                  </div>
                </div>
                {selectedRestaurant.description && (
                  <div>
                    <label className="text-sm text-slate-500">Description</label>
                    <p className="text-slate-700">{selectedRestaurant.description}</p>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  {(selectedRestaurant.cuisine_type || []).map(c => (
                    <Badge key={c} variant="secondary" className="capitalize">{c}</Badge>
                  ))}
                  {(selectedRestaurant.features || []).map(f => (
                    <Badge key={f} variant="outline" className="capitalize">{f.replace('_', ' ')}</Badge>
                  ))}
                </div>
              </div>
              <DialogFooter className="gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => { 
                    handleViewMenu(selectedRestaurant); 
                    setIsViewDialogOpen(false); 
                  }}
                  className="gap-2"
                >
                  <Menu className="w-4 h-4" /> View Menu
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => { 
                    openRestaurantDialog(selectedRestaurant); 
                    setIsViewDialogOpen(false); 
                  }}
                  className="gap-2"
                >
                  <Edit className="w-4 h-4" /> Edit
                </Button>
                <Button onClick={() => setIsViewDialogOpen(false)} className="bg-orange-600 hover:bg-orange-700">Close</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        title={`Delete ${deleteTarget?.type === 'restaurant' ? 'Restaurant' : 'Menu Item'}?`}
        description="This action cannot be undone."
        warningMessage={deleteTarget?.type === 'restaurant' ? 'All menu items will also be deleted.' : undefined}
        onConfirm={deleteTarget?.type === 'restaurant' ? handleDeleteRestaurant : handleDeleteMenuItem}
        isSubmitting={saving}
      />


      <ReplaceResourceModal
        open={!!replaceRestaurant}
        onClose={() => setReplaceRestaurant(null)}
        serviceType="restaurant"
        oldResource={replaceRestaurant}
        allResources={restaurants}
        onSuccess={() => {
          setBookingsRefreshKey((k) => k + 1);
          loadRestaurants?.();
        }}
      />

      <BulkActionsBar
        count={restaurantBulk.count}
        entityLabel="restaurant"
        selectedIds={restaurantBulk.selectedIds}
        selectedRows={restaurantBulk.selectedRows}
        onClear={restaurantBulk.clear}
        onDelete={bulkRestaurantDelete}
        onActivate={bulkRestaurantActivate}
        onDeactivate={bulkRestaurantDeactivate}
        onExport={(rows) => rows.map(r => ({
          id: r.id, name: r.name, cuisine: r.cuisine, city: r.city,
          rating: r.rating, operator: r.operator_name || '',
        }))}
      />
    </>
  );
}
