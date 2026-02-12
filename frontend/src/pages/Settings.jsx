import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Separator } from '../components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { 
  User, Mail, Phone, Lock, Bell, Globe, Shield, Save, Camera,
  Settings as SettingsIcon, HelpCircle, CreditCard, FileText, Info,
  Languages, MessageSquare, ChevronRight, Check, Palette, Smartphone,
  Database, Key, AlertTriangle, Eye, EyeOff, Loader2, Edit, LogOut, MapPin, Heart, Trash2,
  Hotel, Bus, Car, Utensils, Calendar, Film, Sparkles, Gift, Package
} from 'lucide-react';
import api from '../api/client';
import { toast } from 'sonner';

// Settings menu items configuration - for Customers
const CUSTOMER_SETTINGS_SECTIONS = [
  { key: 'profile', label: 'Profile', icon: User, description: 'Manage your personal information' },
  { key: 'favourites', label: 'Favourites', icon: Heart, description: 'Your saved services and items' },
  { key: 'location', label: 'Location', icon: MapPin, description: 'Set your country for local services' },
  { key: 'security', label: 'Security', icon: Shield, description: 'Password and authentication settings' },
  { key: 'notifications', label: 'Notifications', icon: Bell, description: 'Manage alerts and push messages' },
  { key: 'preferences', label: 'Preferences', icon: Globe, description: 'Language, currency, and display' },
  { key: 'payment', label: 'Payment Methods', icon: CreditCard, description: 'Manage your payment options' },
  { key: 'data_protection', label: 'Data Protection', icon: Lock, description: 'Privacy and data settings' },
  { key: 'legal', label: 'Legal Information', icon: FileText, description: 'Terms and conditions' },
  { key: 'about', label: 'About / Impressum', icon: Info, description: 'App information' },
];

// Settings menu items for Operators (no Payment Methods)
const OPERATOR_SETTINGS_SECTIONS = [
  { key: 'profile', label: 'Profile', icon: User, description: 'Manage your personal information' },
  { key: 'security', label: 'Security', icon: Shield, description: 'Password and authentication settings' },
  { key: 'notifications', label: 'Notifications', icon: Bell, description: 'Manage alerts and push messages' },
  { key: 'preferences', label: 'Preferences', icon: Globe, description: 'Language, currency, and display' },
  { key: 'data_protection', label: 'Data Protection', icon: Lock, description: 'Privacy and data settings' },
  { key: 'legal', label: 'Legal Information', icon: FileText, description: 'Terms and conditions' },
  { key: 'about', label: 'About / Impressum', icon: Info, description: 'App information' },
];

// Admin-only settings sections (in addition to base sections)
const ADMIN_SETTINGS_SECTIONS = [
  { key: 'system', label: 'System Configuration', icon: Database, description: 'Global system settings' },
  { key: 'api_keys', label: 'API Keys', icon: Key, description: 'Manage API integrations' },
];

const SERVICE_ICONS = {
  hotels: Hotel, travel: Bus, car_rental: Car, restaurants: Utensils,
  events: Calendar, cinema: Film, laundry: Sparkles, banquets: Gift, packages: Package
};

function FavouritesSection() {
  const [favourites, setFavourites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      try {
        const params = filter !== 'all' ? `?service_type=${filter}` : '';
        const res = await api.get(`/favourites/${params}`);
        setFavourites(res.data.favourites || []);
      } catch { setFavourites([]); }
      finally { setLoading(false); }
    };
    load();
  }, [filter]);

  const removeFav = async (svc, itemId) => {
    try {
      await api.delete(`/favourites/${svc}/${itemId}`);
      setFavourites(prev => prev.filter(f => !(f.service_type === svc && f.item_id === itemId)));
      toast.success('Removed from favourites');
    } catch { toast.error('Failed to remove'); }
  };

  const serviceTypes = [...new Set(favourites.map(f => f.service_type))];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-slate-900 mb-1">Your Favourites</h3>
          <p className="text-sm text-slate-500">{favourites.length} saved item{favourites.length !== 1 ? 's' : ''}</p>
        </div>
        {serviceTypes.length > 1 && (
          <select value={filter} onChange={e => setFilter(e.target.value)} className="text-sm border rounded-lg px-3 py-1.5 bg-white">
            <option value="all">All Services</option>
            {serviceTypes.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
      ) : favourites.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-xl">
          <Heart className="h-12 w-12 mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">No favourites yet</p>
          <p className="text-sm text-slate-400 mt-1">Tap the heart icon on any service to save it here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {favourites.map((fav, i) => {
            const Icon = SERVICE_ICONS[fav.service_type] || Heart;
            return (
              <div key={i} className="flex items-center gap-4 p-4 bg-white border border-slate-200 rounded-xl hover:shadow-sm transition-shadow" data-testid={`fav-item-${fav.item_id}`}>
                {fav.item_image ? (
                  <img src={fav.item_image} alt="" className="w-16 h-16 rounded-lg object-cover" />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-slate-100 flex items-center justify-center"><Icon className="h-6 w-6 text-slate-400" /></div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 truncate">{fav.item_name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-slate-500 capitalize bg-slate-100 px-2 py-0.5 rounded">{fav.service_type.replace('_', ' ')}</span>
                    {fav.item_location && <span className="text-xs text-slate-500">{fav.item_location}</span>}
                    {fav.item_rating > 0 && <span className="text-xs text-amber-600 flex items-center gap-0.5"><Star className="h-3 w-3" />{fav.item_rating}</span>}
                  </div>
                  {fav.item_price > 0 && <p className="text-sm font-bold text-[#082c59] mt-1">{fav.item_price.toLocaleString()} FCFA</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => removeFav(fav.service_type, fav.item_id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function Settings() {
  const { user, logout, reAuthenticate } = useAuth();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState('profile');
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  
  // Success states for visual feedback
  const [saveSuccess, setSaveSuccess] = useState({
    profile: false,
    security: false,
    notifications: false,
    preferences: false,
  });
  
  // Profile form data
  const [profileData, setProfileData] = useState({
    full_name: user?.full_name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    date_of_birth: user?.date_of_birth || '',
    id_document_number: user?.id_document_number || '',
    gender: user?.gender || '',
    address: user?.address || '',
    city: user?.city || '',
    region: user?.region || '',
    postal_code: user?.postal_code || '',
    country: user?.country || 'Cameroon',
    avatar_url: user?.avatar_url || '',
  });

  // Security form data
  const [securityData, setSecurityData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
    two_factor_enabled: false,
  });

  // Notification preferences
  const [notificationSettings, setNotificationSettings] = useState({
    email_notifications: true,
    sms_notifications: false,
    push_notifications: true,
    booking_updates: true,
    promotional: false,
    newsletter: false,
  });

  // Preferences
  const [preferences, setPreferences] = useState({
    language: 'en',
    currency: 'XAF',
    timezone: 'Africa/Douala',
    theme: 'light',
  });

  // Admin system config
  const [systemConfig, setSystemConfig] = useState({
    maintenance_mode: false,
    booking_enabled: true,
    default_commission: 10,
    payment_gateway: 'stripe',
  });

  // Session timeout settings
  const [sessionTimeoutConfig, setSessionTimeoutConfig] = useState({
    session_timeout_minutes: 30,
    min_session_timeout: 15,
    max_session_timeout: 120,
    loading: true,
    saving: false,
    saveSuccess: false,
  });

  // Content data (Data Protection, Legal, About)
  const [contentData, setContentData] = useState({
    data_protection: { title: '', content: '' },
    legal: { title: '', content: '' },
    about: { title: '', content: '' },
  });
  const [editingContent, setEditingContent] = useState(null);

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const isOperator = user?.role === 'operator';
  const isCustomer = !isAdmin && !isOperator;

  // Determine which settings sections to show based on role
  const getSettingsSections = () => {
    if (isAdmin) {
      // Admins see all sections including system config
      return [...OPERATOR_SETTINGS_SECTIONS, ...ADMIN_SETTINGS_SECTIONS];
    } else if (isOperator) {
      // Operators see everything except Payment Methods
      return OPERATOR_SETTINGS_SECTIONS;
    } else {
      // Customers see all base sections including Payment Methods
      return CUSTOMER_SETTINGS_SECTIONS;
    }
  };

  const allSections = getSettingsSections();

  // Load notification preferences from backend on mount
  useEffect(() => {
    const loadNotificationPreferences = async () => {
      try {
        const response = await api.get('/users/me/notifications');
        if (response.data) {
          setNotificationSettings(prev => ({
            ...prev,
            ...response.data
          }));
        }
      } catch (error) {
        console.log('Could not load notification preferences:', error);
      }
    };
    
    loadNotificationPreferences();
  }, []);

  // Load user preferences (language, currency, etc.) from user object
  useEffect(() => {
    if (user) {
      setPreferences(prev => ({
        ...prev,
        language: user.language || 'en',
        currency: user.currency || 'XAF',
        timezone: user.timezone || 'Africa/Douala',
        theme: user.theme || 'light',
      }));
    }
  }, [user]);

  // Load session timeout settings for admins
  useEffect(() => {
    const loadSessionTimeoutSettings = async () => {
      if (user?.role === 'admin' || user?.role === 'super_admin') {
        try {
          const response = await api.get('/system-settings/');
          if (response.data) {
            setSessionTimeoutConfig(prev => ({
              ...prev,
              session_timeout_minutes: response.data.session_timeout_minutes,
              min_session_timeout: response.data.min_session_timeout,
              max_session_timeout: response.data.max_session_timeout,
              loading: false,
            }));
          }
        } catch (error) {
          console.log('Could not load session timeout settings:', error);
          setSessionTimeoutConfig(prev => ({ ...prev, loading: false }));
        }
      }
    };
    
    loadSessionTimeoutSettings();
  }, [user?.role]);

  // Handle avatar upload
  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', 'avatars');

      const response = await api.post('/uploads/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data?.file_url) {
        setProfileData({ ...profileData, avatar_url: response.data.file_url });
        toast.success('Profile picture uploaded successfully');
      }
    } catch (error) {
      console.error('Avatar upload failed:', error);
      toast.error('Failed to upload profile picture');
      
      // Fallback to base64 for demo purposes
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileData({ ...profileData, avatar_url: reader.result });
        toast.success('Profile picture updated locally');
      };
      reader.readAsDataURL(file);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    setSaveSuccess(prev => ({ ...prev, profile: false }));
    try {
      // Use the user's ID to update profile
      const userId = user?._id || user?.id;
      if (!userId) {
        toast.error('User ID not found');
        return;
      }
      await api.put(`/users/${userId}`, profileData);
      toast.success('Profile updated successfully');
      setSaveSuccess(prev => ({ ...prev, profile: true }));
      // Re-authenticate to refresh user data in context
      if (reAuthenticate) await reAuthenticate();
      // Reset success indicator after 3 seconds
      setTimeout(() => setSaveSuccess(prev => ({ ...prev, profile: false })), 3000);
    } catch (error) {
      console.error('Profile update error:', error);
      toast.error(error.response?.data?.detail || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!securityData.current_password || !securityData.new_password) {
      toast.error('Please fill in all password fields');
      return;
    }
    if (securityData.new_password.length < 8) {
      toast.error('New password must be at least 8 characters');
      return;
    }
    if (securityData.new_password !== securityData.confirm_password) {
      toast.error('Passwords do not match');
      return;
    }
    setSaving(true);
    setSaveSuccess(prev => ({ ...prev, security: false }));
    try {
      await api.post('/auth/change-password', {
        current_password: securityData.current_password,
        new_password: securityData.new_password,
      });
      toast.success('Password changed successfully');
      setSaveSuccess(prev => ({ ...prev, security: true }));
      setSecurityData({ ...securityData, current_password: '', new_password: '', confirm_password: '' });
      setTimeout(() => setSaveSuccess(prev => ({ ...prev, security: false })), 3000);
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Failed to change password';
      toast.error(errorMsg);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNotifications = async () => {
    setSaving(true);
    setSaveSuccess(prev => ({ ...prev, notifications: false }));
    try {
      await api.put('/users/me/notifications', notificationSettings);
      toast.success('Notification preferences saved');
      setSaveSuccess(prev => ({ ...prev, notifications: true }));
      setTimeout(() => setSaveSuccess(prev => ({ ...prev, notifications: false })), 3000);
    } catch (error) {
      console.error('Notification save error:', error);
      toast.error(error.response?.data?.detail || 'Failed to save notification preferences');
    } finally {
      setSaving(false);
    }
  };

  const handleSavePreferences = async () => {
    setSaving(true);
    setSaveSuccess(prev => ({ ...prev, preferences: false }));
    try {
      await api.put('/users/me/preferences', preferences);
      toast.success('Preferences saved successfully');
      setSaveSuccess(prev => ({ ...prev, preferences: true }));
      setTimeout(() => setSaveSuccess(prev => ({ ...prev, preferences: false })), 3000);
    } catch (error) {
      console.error('Preferences save error:', error);
      toast.error(error.response?.data?.detail || 'Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveContent = async (type) => {
    setSaving(true);
    try {
      await api.put(`/settings/content/${type}`, contentData[type]);
      toast.success(`${type.replace('_', ' ')} content saved`);
      setEditingContent(null);
    } catch (error) {
      toast.error('Failed to save content');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
    toast.success('Logged out successfully');
  };

  const handleSaveSessionTimeout = async () => {
    setSessionTimeoutConfig(prev => ({ ...prev, saving: true, saveSuccess: false }));
    try {
      await api.put('/system-settings/session-timeout', {
        session_timeout_minutes: sessionTimeoutConfig.session_timeout_minutes,
      });
      toast.success('Session timeout updated successfully');
      setSessionTimeoutConfig(prev => ({ ...prev, saveSuccess: true }));
      // Reset success indicator after 3 seconds
      setTimeout(() => {
        setSessionTimeoutConfig(prev => ({ ...prev, saveSuccess: false }));
      }, 3000);
    } catch (error) {
      console.error('Session timeout save error:', error);
      toast.error(error.response?.data?.detail || 'Failed to update session timeout');
    } finally {
      setSessionTimeoutConfig(prev => ({ ...prev, saving: false }));
    }
  };

  const renderSectionContent = () => {
    switch (activeSection) {
      case 'profile':
        return (
          <div className="space-y-6">
            {/* Avatar Section with Upload */}
            <div className="flex items-center gap-6">
              <div className="relative group">
                {profileData.avatar_url ? (
                  <img 
                    src={profileData.avatar_url.startsWith('data:') || profileData.avatar_url.startsWith('http') 
                      ? profileData.avatar_url 
                      : `${import.meta.env.VITE_BACKEND_URL || ''}${profileData.avatar_url}`
                    } 
                    alt="Profile" 
                    className="w-24 h-24 rounded-full object-cover border-4 border-[#082c59]/20"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-gradient-to-r from-[#082c59] to-[#4D96FF] flex items-center justify-center text-white text-3xl font-bold">
                    {user?.full_name?.charAt(0) || 'U'}
                  </div>
                )}
                {uploadingAvatar && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                    <Loader2 className="h-6 w-6 text-white animate-spin" />
                  </div>
                )}
                <label className={`absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity ${uploadingAvatar ? 'pointer-events-none' : 'cursor-pointer'}`}>
                  <Camera className="h-6 w-6 text-white" />
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden"
                    disabled={uploadingAvatar}
                    onChange={handleAvatarUpload}
                  />
                </label>
                <button 
                  className="absolute bottom-0 right-0 p-2 bg-white rounded-full shadow-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50"
                  onClick={() => document.querySelector('input[type="file"]')?.click()}
                  disabled={uploadingAvatar}
                >
                  {uploadingAvatar ? (
                    <Loader2 className="h-4 w-4 text-slate-600 animate-spin" />
                  ) : (
                    <Camera className="h-4 w-4 text-slate-600" />
                  )}
                </button>
              </div>
              <div>
                <h3 className="font-bold text-slate-900">{user?.full_name || 'User'}</h3>
                <p className="text-sm text-slate-500">{user?.email}</p>
                <Badge className={`mt-1 ${
                  user?.role === 'admin' ? 'bg-red-100 text-red-700' :
                  user?.role === 'operator' ? 'bg-amber-100 text-amber-700' :
                  'bg-green-100 text-green-700'
                }`}>
                  {user?.role || 'customer'}
                </Badge>
              </div>
            </div>

            <Separator />

            {/* Basic Information - Read-only for Customers */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <h4 className="font-semibold text-slate-900">Basic Information</h4>
                {isCustomer && (
                  <Badge variant="outline" className="text-xs">Some fields are read-only</Badge>
                )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="full_name">Full Name {isCustomer && <span className="text-xs text-slate-400">(read-only)</span>}</Label>
                  <Input
                    id="full_name"
                    value={profileData.full_name}
                    onChange={(e) => setProfileData({ ...profileData, full_name: e.target.value })}
                    className={`mt-1 ${isCustomer ? 'bg-slate-100 cursor-not-allowed' : 'bg-white'}`}
                    disabled={isCustomer}
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={profileData.email}
                    onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                    className="mt-1 bg-white"
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    value={profileData.phone}
                    onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                    placeholder="+237 6XX XXX XXX"
                    className="mt-1 bg-white"
                  />
                </div>
                <div>
                  <Label htmlFor="dob">Date of Birth {isCustomer && <span className="text-xs text-slate-400">(read-only)</span>}</Label>
                  <Input
                    id="dob"
                    type="date"
                    value={profileData.date_of_birth}
                    onChange={(e) => setProfileData({ ...profileData, date_of_birth: e.target.value })}
                    className={`mt-1 ${isCustomer ? 'bg-slate-100 cursor-not-allowed' : 'bg-white'}`}
                    disabled={isCustomer}
                  />
                </div>
                <div>
                  <Label htmlFor="id_doc">ID Card / Passport Number {isCustomer && <span className="text-xs text-slate-400">(read-only)</span>}</Label>
                  <Input
                    id="id_doc"
                    value={profileData.id_document_number}
                    onChange={(e) => setProfileData({ ...profileData, id_document_number: e.target.value })}
                    className={`mt-1 ${isCustomer ? 'bg-slate-100 cursor-not-allowed' : 'bg-white'}`}
                    disabled={isCustomer}
                    placeholder="e.g., 12345678"
                  />
                </div>
                <div>
                  <Label htmlFor="gender">Gender</Label>
                  <select
                    id="gender"
                    value={profileData.gender || ''}
                    onChange={(e) => setProfileData({ ...profileData, gender: e.target.value })}
                    className="mt-1 w-full h-10 px-3 rounded-md border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#082c59]/20 focus:border-[#082c59]"
                  >
                    <option value="">Select gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                    <option value="prefer_not_to_say">Prefer not to say</option>
                  </select>
                </div>
              </div>
            </div>

            <Separator />

            {/* Address Information */}
            <div className="space-y-4">
              <h4 className="font-semibold text-slate-900">Address Information</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <Label htmlFor="address">Street Address</Label>
                  <Input
                    id="address"
                    value={profileData.address || ''}
                    onChange={(e) => setProfileData({ ...profileData, address: e.target.value })}
                    placeholder="Enter your street address"
                    className="mt-1 bg-white"
                  />
                </div>
                <div>
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={profileData.city || ''}
                    onChange={(e) => setProfileData({ ...profileData, city: e.target.value })}
                    placeholder="e.g., Yaoundé"
                    className="mt-1 bg-white"
                  />
                </div>
                <div>
                  <Label htmlFor="region">Region/State</Label>
                  <Input
                    id="region"
                    value={profileData.region || ''}
                    onChange={(e) => setProfileData({ ...profileData, region: e.target.value })}
                    placeholder="e.g., Centre"
                    className="mt-1 bg-white"
                  />
                </div>
                <div>
                  <Label htmlFor="postal_code">Postal Code</Label>
                  <Input
                    id="postal_code"
                    value={profileData.postal_code || ''}
                    onChange={(e) => setProfileData({ ...profileData, postal_code: e.target.value })}
                    placeholder="e.g., 00237"
                    className="mt-1 bg-white"
                  />
                </div>
                <div>
                  <Label htmlFor="country">Country</Label>
                  <Input
                    id="country"
                    value={profileData.country || 'Cameroon'}
                    onChange={(e) => setProfileData({ ...profileData, country: e.target.value })}
                    className="mt-1 bg-white"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t">
              <Button 
                onClick={handleSaveProfile} 
                disabled={saving} 
                className={`transition-all duration-300 ${
                  saveSuccess.profile 
                    ? 'bg-green-600 hover:bg-green-700' 
                    : 'bg-[#082c59] hover:bg-[#0a3a75]'
                }`}
              >
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : saveSuccess.profile ? (
                  <Check className="mr-2 h-4 w-4" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                {saveSuccess.profile ? 'Saved!' : 'Save Changes'}
              </Button>
            </div>
          </div>
        );

      case 'favourites':
        return <FavouritesSection />;

      case 'location':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="font-bold text-slate-900 mb-2">Your Location</h3>
              <p className="text-sm text-slate-500 mb-4">Controls which services are shown to you. In Africa = local services only; outside Africa = global view.</p>
            </div>
            {(() => {
              const stored = JSON.parse(localStorage.getItem('oryno_user_location') || 'null');
              return (
                <div className="space-y-4">
                  <Card className={stored ? 'border-blue-200 bg-blue-50/50' : 'border-slate-200'}>
                    <CardContent className="p-4">
                      {stored ? (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 rounded-lg"><MapPin className="w-5 h-5 text-blue-600" /></div>
                            <div>
                              <p className="font-semibold text-slate-900">{stored.country_name || stored.country_code}</p>
                              <p className="text-xs text-slate-500">
                                {stored.manual_override ? 'Manually set' : stored.auto_updated ? 'Auto-detected from IP' : 'Set on first visit'}
                                {stored.is_in_africa ? ' — Local mode' : ' — Global mode'}
                              </p>
                            </div>
                          </div>
                          <Badge className={stored.is_in_africa ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'}>
                            {stored.is_in_africa ? 'Local' : 'Global'}
                          </Badge>
                        </div>
                      ) : (
                        <p className="text-slate-500">No location set yet</p>
                      )}
                    </CardContent>
                  </Card>
                  <Button variant="outline" onClick={() => {
                    // Import from Layout's hook — open the modal
                    // Clear the stored location so the modal appears fresh
                    localStorage.removeItem('oryno_user_location');
                    localStorage.removeItem('oryno_location_prompted');
                    window.location.reload();
                  }}>
                    <MapPin className="w-4 h-4 mr-2" /> Change Location
                  </Button>
                  <p className="text-xs text-slate-400">
                    Your location is auto-detected from your IP address. Manual selections override automatic detection.
                  </p>
                </div>
              );
            })()}
          </div>
        );

      case 'security':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="font-bold text-slate-900 mb-4">Change Password</h3>
              <div className="space-y-4 max-w-md">
                <div>
                  <Label>Current Password</Label>
                  <div className="relative mt-1">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={securityData.current_password}
                      onChange={(e) => setSecurityData({ ...securityData, current_password: e.target.value })}
                      className="pr-10 bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <Label>New Password</Label>
                  <Input
                    type="password"
                    value={securityData.new_password}
                    onChange={(e) => setSecurityData({ ...securityData, new_password: e.target.value })}
                    className="mt-1 bg-white"
                  />
                </div>
                <div>
                  <Label>Confirm New Password</Label>
                  <Input
                    type="password"
                    value={securityData.confirm_password}
                    onChange={(e) => setSecurityData({ ...securityData, confirm_password: e.target.value })}
                    className="mt-1 bg-white"
                  />
                </div>
                <Button 
                  onClick={handleChangePassword} 
                  disabled={saving} 
                  className={`transition-all duration-300 ${
                    saveSuccess.security 
                      ? 'bg-green-600 hover:bg-green-700' 
                      : 'bg-[#082c59]'
                  }`}
                >
                  {saving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : saveSuccess.security ? (
                    <Check className="mr-2 h-4 w-4" />
                  ) : (
                    <Lock className="mr-2 h-4 w-4" />
                  )}
                  {saveSuccess.security ? 'Password Updated!' : 'Update Password'}
                </Button>
              </div>
            </div>

            <Separator />

            <div>
              <h3 className="font-bold text-slate-900 mb-4">Two-Factor Authentication</h3>
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <div>
                  <p className="font-medium text-slate-900">Authenticator App</p>
                  <p className="text-sm text-slate-500">Add extra security with 2FA</p>
                </div>
                <Switch
                  checked={securityData.two_factor_enabled}
                  onCheckedChange={(checked) => setSecurityData({ ...securityData, two_factor_enabled: checked })}
                />
              </div>
            </div>

            <Separator />

            <div>
              <h3 className="font-bold text-slate-900 mb-4">Active Sessions</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center gap-3">
                    <Smartphone className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="font-medium text-slate-900">Current Device</p>
                      <p className="text-sm text-slate-500">Chrome on Windows • Active now</p>
                    </div>
                  </div>
                  <Badge className="bg-green-100 text-green-700">Active</Badge>
                </div>
              </div>
            </div>
          </div>
        );

      case 'notifications':
        return (
          <div className="space-y-4">
            <h3 className="font-bold text-slate-900 mb-4">Notification Preferences</h3>
            
            {[
              { key: 'email_notifications', label: 'Email Notifications', desc: 'Receive updates via email' },
              { key: 'sms_notifications', label: 'SMS Notifications', desc: 'Receive updates via text message' },
              { key: 'push_notifications', label: 'Push Notifications', desc: 'Browser push notifications' },
              { key: 'booking_updates', label: 'Booking Updates', desc: 'Status changes and reminders' },
              { key: 'promotional', label: 'Promotional', desc: 'Deals, offers, and discounts' },
              { key: 'newsletter', label: 'Newsletter', desc: 'Weekly digest and news' },
            ].map((item) => (
              <div key={item.key} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <div>
                  <p className="font-medium text-slate-900">{item.label}</p>
                  <p className="text-sm text-slate-500">{item.desc}</p>
                </div>
                <Switch
                  checked={notificationSettings[item.key]}
                  onCheckedChange={(checked) => setNotificationSettings({ ...notificationSettings, [item.key]: checked })}
                />
              </div>
            ))}

            <div className="pt-4">
              <Button 
                onClick={handleSaveNotifications} 
                disabled={saving} 
                className={`transition-all duration-300 ${
                  saveSuccess.notifications 
                    ? 'bg-green-600 hover:bg-green-700' 
                    : 'bg-[#082c59]'
                }`}
              >
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : saveSuccess.notifications ? (
                  <Check className="mr-2 h-4 w-4" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                {saveSuccess.notifications ? 'Saved!' : 'Save Preferences'}
              </Button>
            </div>
          </div>
        );

      case 'preferences':
        return (
          <div className="space-y-6">
            <div>
              <Label>Language</Label>
              <div className="grid grid-cols-2 gap-3 mt-2">
                {[
                  { code: 'en', label: 'English', flag: '🇬🇧' },
                  { code: 'fr', label: 'Français', flag: '🇫🇷' },
                ].map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => setPreferences({ ...preferences, language: lang.code })}
                    className={`p-4 rounded-lg border flex items-center gap-3 transition-colors ${
                      preferences.language === lang.code
                        ? 'bg-blue-50 border-[#082c59] text-[#082c59]'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <span className="text-2xl">{lang.flag}</span>
                    <span className="font-medium">{lang.label}</span>
                    {preferences.language === lang.code && <Check className="ml-auto h-5 w-5" />}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label>Currency</Label>
              <select
                value={preferences.currency}
                onChange={(e) => setPreferences({ ...preferences, currency: e.target.value })}
                className="w-full mt-1 p-2 border rounded-lg bg-white"
              >
                <option value="XAF">XAF (FCFA)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
              </select>
            </div>

            <div>
              <Label>Timezone</Label>
              <select
                value={preferences.timezone}
                onChange={(e) => setPreferences({ ...preferences, timezone: e.target.value })}
                className="w-full mt-1 p-2 border rounded-lg bg-white"
              >
                <option value="Africa/Douala">Africa/Douala (WAT)</option>
                <option value="UTC">UTC</option>
                <option value="Europe/Paris">Europe/Paris (CET)</option>
                <option value="America/New_York">America/New_York (ET)</option>
              </select>
            </div>

            <div>
              <Label>Theme</Label>
              <p className="text-sm text-slate-500 mt-1 mb-2">Theme customization coming soon</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { code: 'light', label: 'Light', icon: '☀️' },
                  { code: 'dark', label: 'Dark', icon: '🌙', disabled: true },
                ].map((themeOption) => (
                  <button
                    key={themeOption.code}
                    disabled={themeOption.disabled}
                    className={`p-4 rounded-lg border flex items-center gap-3 transition-colors ${
                      themeOption.code === 'light'
                        ? 'bg-blue-50 border-[#082c59]'
                        : 'bg-slate-100 border-slate-200 opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <span className="text-xl">{themeOption.icon}</span>
                    <span className="font-medium">{themeOption.label}</span>
                    {themeOption.code === 'light' && <Check className="ml-auto h-5 w-5 text-[#082c59]" />}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t">
              <Button 
                onClick={handleSavePreferences} 
                disabled={saving} 
                className={`transition-all duration-300 ${
                  saveSuccess.preferences 
                    ? 'bg-green-600 hover:bg-green-700' 
                    : 'bg-[#082c59]'
                }`}
              >
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : saveSuccess.preferences ? (
                  <Check className="mr-2 h-4 w-4" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                {saveSuccess.preferences ? 'Saved!' : 'Save Preferences'}
              </Button>
            </div>
          </div>
        );

      case 'payment':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900">Payment Methods</h3>
              <Button variant="outline" className="gap-2">
                <CreditCard className="h-4 w-4" />
                Add Payment Method
              </Button>
            </div>

            <div className="space-y-3">
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-8 bg-gradient-to-r from-orange-500 to-yellow-500 rounded flex items-center justify-center text-white font-bold text-xs">
                      MTN
                    </div>
                    <div>
                      <p className="font-medium">MTN Mobile Money</p>
                      <p className="text-sm text-slate-500">•••• 7890</p>
                    </div>
                  </div>
                  <Badge>Default</Badge>
                </div>
              </div>
              
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-8 bg-orange-600 rounded flex items-center justify-center text-white font-bold text-xs">
                      OM
                    </div>
                    <div>
                      <p className="font-medium">Orange Money</p>
                      <p className="text-sm text-slate-500">•••• 4567</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm">Remove</Button>
                </div>
              </div>
            </div>

            <p className="text-sm text-slate-500">
              Your payment information is stored securely. We never store your full card details.
            </p>
          </div>
        );

      case 'data_protection':
      case 'legal':
      case 'about':
        const contentType = activeSection;
        const content = contentData[contentType];
        const isEditing = editingContent === contentType;
        
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 capitalize">{contentType.replace('_', ' ')}</h3>
              {isAdmin && (
                <Button 
                  variant="outline" 
                  onClick={() => setEditingContent(isEditing ? null : contentType)}
                >
                  {isEditing ? 'Cancel' : 'Edit'}
                </Button>
              )}
            </div>

            {isEditing ? (
              <div className="space-y-4">
                <div>
                  <Label>Title</Label>
                  <Input
                    value={content.title}
                    onChange={(e) => setContentData({ 
                      ...contentData, 
                      [contentType]: { ...content, title: e.target.value } 
                    })}
                    className="mt-1 bg-white"
                  />
                </div>
                <div>
                  <Label>Content</Label>
                  <Textarea
                    value={content.content}
                    onChange={(e) => setContentData({ 
                      ...contentData, 
                      [contentType]: { ...content, content: e.target.value } 
                    })}
                    rows={12}
                    className="mt-1 bg-white"
                  />
                </div>
                <Button onClick={() => handleSaveContent(contentType)} disabled={saving} className="bg-[#082c59]">
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save Changes
                </Button>
              </div>
            ) : (
              <div className="prose max-w-none">
                {content.title ? (
                  <>
                    <h4>{content.title}</h4>
                    <div className="whitespace-pre-wrap text-slate-700">{content.content}</div>
                  </>
                ) : (
                  <p className="text-slate-500">No {contentType.replace('_', ' ')} content available.</p>
                )}
              </div>
            )}
          </div>
        );

      case 'system':
        if (!isAdmin) return null;
        return (
          <div className="space-y-6">
            <h3 className="font-bold text-slate-900">System Configuration</h3>
            
            {/* Session Timeout Configuration - Modern Card Design */}
            <div className="bg-gradient-to-br from-slate-50 to-blue-50/50 rounded-xl border border-slate-200 overflow-hidden">
              <div className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-blue-100 rounded-lg">
                      <Lock className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-900">Session Timeout</h4>
                      <p className="text-sm text-slate-500 mt-0.5">
                        Auto-logout after inactivity period
                      </p>
                    </div>
                  </div>
                  {sessionTimeoutConfig.saveSuccess && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-100 text-green-700 rounded-full text-sm font-medium animate-pulse">
                      <Check className="h-4 w-4" />
                      Saved
                    </div>
                  )}
                </div>
                
                {sessionTimeoutConfig.loading ? (
                  <div className="flex items-center gap-2 text-slate-500 mt-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Loading settings...</span>
                  </div>
                ) : (
                  <div className="mt-5 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                      <div className="flex-1">
                        <Label htmlFor="session_timeout_select" className="text-sm font-medium text-slate-700">
                          Session Duration
                        </Label>
                        <select
                          id="session_timeout_select"
                          value={sessionTimeoutConfig.session_timeout_minutes}
                          onChange={(e) => setSessionTimeoutConfig(prev => ({
                            ...prev,
                            session_timeout_minutes: parseInt(e.target.value),
                            saveSuccess: false,
                          }))}
                          disabled={user?.role !== 'super_admin'}
                          className="mt-1.5 w-full sm:w-48 h-11 px-4 rounded-lg border border-slate-200 bg-white text-slate-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed transition-all appearance-none cursor-pointer"
                          style={{
                            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                            backgroundRepeat: 'no-repeat',
                            backgroundPosition: 'right 12px center',
                            backgroundSize: '16px',
                            paddingRight: '40px'
                          }}
                        >
                          <option value={15}>15 minutes</option>
                          <option value={30}>30 minutes (Default)</option>
                          <option value={45}>45 minutes</option>
                          <option value={60}>1 hour</option>
                          <option value={90}>1.5 hours</option>
                          <option value={120}>2 hours (Maximum)</option>
                        </select>
                      </div>
                      
                      {user?.role === 'super_admin' && (
                        <Button 
                          onClick={handleSaveSessionTimeout} 
                          disabled={sessionTimeoutConfig.saving}
                          className={`h-11 px-5 transition-all duration-300 ${
                            sessionTimeoutConfig.saveSuccess 
                              ? 'bg-green-600 hover:bg-green-700' 
                              : 'bg-blue-600 hover:bg-blue-700'
                          }`}
                        >
                          {sessionTimeoutConfig.saving ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Saving...
                            </>
                          ) : sessionTimeoutConfig.saveSuccess ? (
                            <>
                              <Check className="mr-2 h-4 w-4" />
                              Saved!
                            </>
                          ) : (
                            <>
                              <Save className="mr-2 h-4 w-4" />
                              Save Changes
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                    
                    {user?.role !== 'super_admin' && (
                      <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                        <p className="text-sm text-amber-700">
                          Only Super Admins can modify session timeout settings
                        </p>
                      </div>
                    )}
                    
                    <p className="text-xs text-slate-500">
                      Changes apply to new login sessions. Current sessions remain active until their original timeout.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <Separator />
            
            <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg border border-red-200">
              <div>
                <p className="font-medium text-red-900">Maintenance Mode</p>
                <p className="text-sm text-red-700">Disable all bookings temporarily</p>
              </div>
              <Switch
                checked={systemConfig.maintenance_mode}
                onCheckedChange={(checked) => setSystemConfig({ ...systemConfig, maintenance_mode: checked })}
              />
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
              <div>
                <p className="font-medium text-slate-900">Bookings Enabled</p>
                <p className="text-sm text-slate-500">Allow new bookings</p>
              </div>
              <Switch
                checked={systemConfig.booking_enabled}
                onCheckedChange={(checked) => setSystemConfig({ ...systemConfig, booking_enabled: checked })}
              />
            </div>

            <div>
              <Label>Default Commission (%)</Label>
              <Input
                type="number"
                value={systemConfig.default_commission}
                onChange={(e) => setSystemConfig({ ...systemConfig, default_commission: e.target.value })}
                className="mt-1 bg-white max-w-xs"
              />
            </div>

            <div>
              <Label>Payment Gateway</Label>
              <select
                value={systemConfig.payment_gateway}
                onChange={(e) => setSystemConfig({ ...systemConfig, payment_gateway: e.target.value })}
                className="w-full mt-1 p-2 border rounded-lg bg-white max-w-xs"
              >
                <option value="stripe">Stripe</option>
                <option value="mtn_momo">MTN MoMo</option>
                <option value="orange_money">Orange Money</option>
              </select>
            </div>
          </div>
        );

      case 'api_keys':
        if (!isAdmin) return null;
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900">API Keys</h3>
              <Button className="bg-[#082c59]">Generate New Key</Button>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-800">Security Warning</p>
                  <p className="text-sm text-amber-700">API keys provide full access to your account. Keep them secret and never share them publicly.</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="p-4 bg-slate-50 rounded-lg border">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Production Key</p>
                    <p className="text-sm text-slate-500 font-mono">sk_live_••••••••••••••••</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">Copy</Button>
                    <Button variant="outline" size="sm" className="text-red-600">Revoke</Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
          <SettingsIcon className="h-7 w-7 text-[#082c59]" />
          Settings
        </h1>
        <p className="text-slate-600 mt-1">Manage your account settings and preferences</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Settings Menu */}
        <div className="lg:col-span-1">
          <Card>
            <CardContent className="p-2">
              <nav className="space-y-1">
                {allSections.map((section) => {
                  const IconComp = section.icon;
                  const isActive = activeSection === section.key;
                  return (
                    <button
                      key={section.key}
                      onClick={() => setActiveSection(section.key)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-left ${
                        isActive
                          ? 'bg-[#082c59] text-white'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <IconComp className="h-5 w-5" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{section.label}</p>
                        <p className={`text-xs truncate ${isActive ? 'text-white/70' : 'text-slate-400'}`}>
                          {section.description}
                        </p>
                      </div>
                      <ChevronRight className={`h-4 w-4 ${isActive ? 'text-white/70' : 'text-slate-400'}`} />
                    </button>
                  );
                })}
              </nav>
              
              {/* Logout Button */}
              <div className="mt-4 pt-4 border-t border-slate-200">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-left text-red-600 hover:bg-red-50"
                >
                  <LogOut className="h-5 w-5" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">Logout</p>
                    <p className="text-xs text-red-400">Sign out of your account</p>
                  </div>
                </button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Settings Content */}
        <div className="lg:col-span-3">
          <Card>
            <CardContent className="p-6">
              {renderSectionContent()}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
