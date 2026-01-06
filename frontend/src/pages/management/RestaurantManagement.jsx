import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Utensils, Plus, LayoutDashboard, BarChart2, MessageSquare,
  RefreshCw, MapPin, Star, Clock, Phone, Mail, Save, Trash2
} from 'lucide-react';
import api from '@/api/client';
import { formatFCFA } from '@/utils/currency';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/contexts/PermissionsContext';
import PermissionGate from '@/components/common/PermissionGate';
import { toast } from 'sonner';

// Shared components
import { StatsGrid, MiniBarChart, MiniPieChart } from '@/components/management/shared';
import { SearchFilter, Pagination, EmptyState, ConfirmDialog } from '@/components/management/shared';
import { ImageCarousel } from '@/components/management/shared';

// Restaurant-specific components
import { RestaurantCard, MenuItemCard, RestaurantForm, MenuItemForm } from '@/components/management/restaurant';

// Service components
import ServiceExecutiveDashboard from '@/components/management/ServiceExecutiveDashboard';
import ServiceCommunicationsHub from '@/components/management/ServiceCommunicationsHub';

const ITEMS_PER_PAGE = 8;

const DEFAULT_RESTAURANT_FORM = {
  name: '', description: '', cuisine_type: [], address: '', city: '', country: 'Cameroon',
  phone: '', email: '', price_range: 'moderate', features: [], opening_hours: {}, images: [],
  operator_id: '', operator_name: ''
};

const DEFAULT_MENU_ITEM = {
  name: '', description: '', category: '', price: '', is_available: true, image: '', popular: false
};

// Dashboard data generator
const useDashboardData = (restaurants, menuItems) => {
  return useMemo(() => {
    const activeRestaurants = restaurants.filter(r => r.status === 'active');
    const totalMenuItems = menuItems?.length || 0;
    const totalRevenue = restaurants.reduce((sum, r) => sum + (r.total_revenue || 0), 0);
    const avgRating = restaurants.length > 0
      ? (restaurants.reduce((sum, r) => sum + (r.rating || 4.2), 0) / restaurants.length).toFixed(1)
      : 4.2;

    // Cuisine distribution
    const cuisineCount = {};
    restaurants.forEach(r => {
      (r.cuisine_type || ['local']).forEach(c => {
        cuisineCount[c] = (cuisineCount[c] || 0) + 1;
      });
    });
    const distribution = Object.entries(cuisineCount).slice(0, 5).map(([type, count]) => ({
      type: type.charAt(0).toUpperCase() + type.slice(1), count
    }));

    // Monthly trend (mock)
    const dailyTrend = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => ({
      name: day, reservations: Math.floor(Math.random() * 30) + 10
    }));

    return {
      stats: {
        totalItems: restaurants.length,
        activeItems: activeRestaurants.length,
        avgRating: parseFloat(avgRating),
        totalRevenue: totalRevenue || restaurants.length * 350000,
        pendingBookings: Math.floor(Math.random() * 20) + 5,
        completedToday: Math.floor(Math.random() * 15) + 3
      },
      bookingsByStatus: [
        { name: 'Pending', value: Math.floor(Math.random() * 20) + 5 },
        { name: 'Confirmed', value: Math.floor(Math.random() * 30) + 10 },
        { name: 'Completed', value: Math.floor(Math.random() * 50) + 20 },
        { name: 'Cancelled', value: Math.floor(Math.random() * 10) + 2 }
      ],
      dailyTrend,
      distribution,
      secondaryCount: totalMenuItems
    };
  }, [restaurants, menuItems]);
};

export default function RestaurantManagement() {
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  
  // Data state
  const [restaurants, setRestaurants] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [operators, setOperators] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // UI state
  const [activeTab, setActiveTab] = useState('dashboard');
  const [viewMode, setViewMode] = useState('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  
  // Selection state
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [menuViewMode, setMenuViewMode] = useState('grid');
  
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

  const dashboardData = useDashboardData(restaurants, menuItems);

  // Load restaurants
  const loadRestaurants = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/restaurants/');
      setRestaurants(res.data.restaurants || res.data || []);
    } catch (error) {
      console.error('Failed to load restaurants:', error);
      toast.error('Failed to load restaurants');
    } finally {
      setLoading(false);
    }
  }, []);

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

  // Load operators for assignment
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

  const totalPages = Math.ceil(filteredRestaurants.length / ITEMS_PER_PAGE);

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
      if (editingRestaurant) {
        await api.put(`/restaurants/${editingRestaurant.id}`, restaurantForm);
        toast.success('Restaurant updated');
      } else {
        await api.post('/restaurants/', restaurantForm);
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
      const data = { ...menuForm, price: parseFloat(menuForm.price) || 0 };
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-orange-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg">
                <Utensils className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Restaurant Management</h1>
                <p className="text-slate-500">Manage restaurants, menus, and reservations</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={loadRestaurants} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <PermissionGate permission="restaurants.create">
                <Button onClick={() => openRestaurantDialog()} className="bg-orange-600 hover:bg-orange-700">
                  <Plus className="h-4 w-4 mr-2" /> Add Restaurant
                </Button>
              </PermissionGate>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-white border shadow-sm p-1 rounded-xl mb-6">
            <TabsTrigger value="dashboard" className="data-[state=active]:bg-orange-600 data-[state=active]:text-white rounded-lg px-4 py-2">
              <LayoutDashboard className="h-4 w-4 mr-2" /> Dashboard
            </TabsTrigger>
            <TabsTrigger value="management" className="data-[state=active]:bg-orange-600 data-[state=active]:text-white rounded-lg px-4 py-2">
              <Utensils className="h-4 w-4 mr-2" /> Management
            </TabsTrigger>
            <TabsTrigger value="communications" className="data-[state=active]:bg-orange-600 data-[state=active]:text-white rounded-lg px-4 py-2">
              <MessageSquare className="h-4 w-4 mr-2" /> Communications
            </TabsTrigger>
            <TabsTrigger value="analytics" className="data-[state=active]:bg-orange-600 data-[state=active]:text-white rounded-lg px-4 py-2">
              <BarChart2 className="h-4 w-4 mr-2" /> Analytics
            </TabsTrigger>
          </TabsList>

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
            />
          </TabsContent>

          {/* Management Tab */}
          <TabsContent value="management">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Restaurants List */}
              <div className="lg:col-span-2">
                <Card className="shadow-lg border-0">
                  <CardHeader className="bg-gradient-to-r from-orange-600 to-orange-700 text-white rounded-t-xl">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <Utensils className="h-5 w-5" />
                        Restaurants ({filteredRestaurants.length})
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4">
                    <SearchFilter
                      searchValue={searchQuery}
                      onSearchChange={setSearchQuery}
                      searchPlaceholder="Search restaurants..."
                      filters={[{
                        key: 'status',
                        placeholder: 'Status',
                        options: [
                          { value: 'active', label: 'Active' },
                          { value: 'inactive', label: 'Inactive' }
                        ]
                      }]}
                      filterValues={{ status: filterStatus }}
                      onFilterChange={(key, val) => setFilterStatus(val)}
                      showViewToggle
                      viewMode={viewMode}
                      onViewModeChange={setViewMode}
                      className="mb-4"
                    />

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
                        <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : 'space-y-3'}>
                          {paginatedRestaurants.map(restaurant => (
                            <RestaurantCard
                              key={restaurant.id}
                              restaurant={restaurant}
                              viewMode={viewMode}
                              onView={(r) => { setSelectedRestaurant(r); setIsViewDialogOpen(true); }}
                              onEdit={openRestaurantDialog}
                              onDelete={confirmDeleteRestaurant}
                              canEdit={canEdit}
                              canDelete={canDelete}
                            />
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

              {/* Menu Panel */}
              <div className="lg:col-span-1">
                <Card className="shadow-lg border-0 sticky top-4">
                  <CardHeader className="bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-t-xl">
                    <CardTitle className="flex items-center gap-2 text-base">
                      Menu Items
                      {selectedRestaurant && (
                        <Badge variant="secondary" className="bg-white/20 text-white">
                          {selectedRestaurant.name}
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4">
                    {!selectedRestaurant ? (
                      <div className="text-center py-8 text-slate-500">
                        <Utensils className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                        <p>Select a restaurant to view menu</p>
                      </div>
                    ) : (
                      <>
                        <div className="flex justify-between items-center mb-4">
                          <span className="text-sm text-slate-500">{menuItems.length} items</span>
                          <PermissionGate permission="restaurants.edit">
                            <Button size="sm" onClick={() => openMenuDialog()} className="bg-amber-600 hover:bg-amber-700">
                              <Plus className="h-4 w-4 mr-1" /> Add Item
                            </Button>
                          </PermissionGate>
                        </div>
                        <ScrollArea className="h-[400px]">
                          <div className="space-y-2">
                            {menuItems.map(item => (
                              <MenuItemCard
                                key={item.id}
                                item={item}
                                viewMode="list"
                                onEdit={openMenuDialog}
                                onDelete={confirmDeleteMenuItem}
                                canEdit={canEdit}
                                canDelete={canDelete}
                              />
                            ))}
                          </div>
                        </ScrollArea>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Communications Tab */}
          <TabsContent value="communications">
            <ServiceCommunicationsHub serviceType="Restaurants" serviceIcon={<Utensils className="h-6 w-6" />} />
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle>Reservations by Day</CardTitle>
                </CardHeader>
                <CardContent>
                  <MiniBarChart data={dashboardData.dailyTrend} dataKey="reservations" nameKey="name" height={250} />
                </CardContent>
              </Card>
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle>Cuisine Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <MiniPieChart data={dashboardData.distribution} dataKey="count" nameKey="type" height={250} />
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Restaurant Dialog */}
      <Dialog open={isRestaurantDialogOpen} onOpenChange={setIsRestaurantDialogOpen}>
        <DialogContent className="bg-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Utensils className="h-5 w-5 text-orange-600" />
              {editingRestaurant ? 'Edit Restaurant' : 'Add Restaurant'}
            </DialogTitle>
          </DialogHeader>
          <RestaurantForm
            form={restaurantForm}
            onChange={setRestaurantForm}
            operators={operators}
            isEditing={!!editingRestaurant}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRestaurantDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveRestaurant} disabled={saving} className="bg-orange-600 hover:bg-orange-700">
              {saving ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              {editingRestaurant ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      {/* View Restaurant Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="bg-white max-w-2xl">
          {selectedRestaurant && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedRestaurant.name}</DialogTitle>
                <DialogDescription>Restaurant details and information</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <ImageCarousel images={selectedRestaurant.images || []} height={200} emptyIcon={Utensils} />
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-slate-500">Location</label>
                    <p className="flex items-center gap-1"><MapPin className="w-4 h-4" /> {selectedRestaurant.city}, {selectedRestaurant.country}</p>
                  </div>
                  <div>
                    <label className="text-sm text-slate-500">Rating</label>
                    <p className="flex items-center gap-1"><Star className="w-4 h-4 text-amber-500" /> {selectedRestaurant.rating || 4.5}</p>
                  </div>
                  <div>
                    <label className="text-sm text-slate-500">Phone</label>
                    <p className="flex items-center gap-1"><Phone className="w-4 h-4" /> {selectedRestaurant.phone || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-sm text-slate-500">Email</label>
                    <p className="flex items-center gap-1"><Mail className="w-4 h-4" /> {selectedRestaurant.email || 'N/A'}</p>
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
              <DialogFooter>
                <Button variant="outline" onClick={() => { openRestaurantDialog(selectedRestaurant); setIsViewDialogOpen(false); }}>
                  Edit
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
    </div>
  );
}
