import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { setAppLanguage } from '../i18n';
import DatePickerField from '@/components/shared/DatePickerField';
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
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '../components/ui/select';
import { 
  User, Mail, Phone, Lock, Bell, Globe, Shield, Save, Camera,
  Settings as SettingsIcon, HelpCircle, CreditCard, FileText, Info,
  Languages, MessageSquare, ChevronRight, Check, Palette, Smartphone,
  Database, Key, AlertTriangle, Eye, EyeOff, Loader2, Edit, LogOut, MapPin, Heart, Trash2,
  Hotel, Bus, Car, Utensils, Calendar, Film, Sparkles, Gift, Package, Star,
  ExternalLink, RefreshCw, Scale
} from 'lucide-react';
import api from '../api/client';
import { toast } from 'sonner';
import { setTimezone as persistTimezone, detectBrowserTimezone, setDateFormat, setTimeFormat } from '@/utils/dateUtils';
import { syncPreferencesToLocal } from '@/utils/prefStore';

// Common IANA timezones grouped by region (rendered in the dropdown)
const COMMON_TIMEZONES = [
  { group: 'Africa', zones: [
    'Africa/Abidjan', 'Africa/Accra', 'Africa/Addis_Ababa', 'Africa/Algiers', 'Africa/Bamako',
    'Africa/Cairo', 'Africa/Casablanca', 'Africa/Dakar', 'Africa/Dar_es_Salaam', 'Africa/Djibouti',
    'Africa/Douala', 'Africa/Johannesburg', 'Africa/Kampala', 'Africa/Khartoum', 'Africa/Kigali',
    'Africa/Kinshasa', 'Africa/Lagos', 'Africa/Libreville', 'Africa/Luanda', 'Africa/Maputo',
    'Africa/Nairobi', 'Africa/Niamey', 'Africa/Ouagadougou', 'Africa/Tunis', 'Africa/Windhoek',
  ]},
  { group: 'Americas', zones: [
    'America/Anchorage', 'America/Argentina/Buenos_Aires', 'America/Bogota', 'America/Caracas',
    'America/Chicago', 'America/Denver', 'America/Halifax', 'America/Lima', 'America/Los_Angeles',
    'America/Mexico_City', 'America/Montreal', 'America/New_York', 'America/Sao_Paulo', 'America/Toronto',
  ]},
  { group: 'Europe', zones: [
    'Europe/Amsterdam', 'Europe/Athens', 'Europe/Berlin', 'Europe/Brussels', 'Europe/Dublin',
    'Europe/Istanbul', 'Europe/Lisbon', 'Europe/London', 'Europe/Madrid', 'Europe/Moscow',
    'Europe/Paris', 'Europe/Rome', 'Europe/Stockholm', 'Europe/Vienna', 'Europe/Warsaw', 'Europe/Zurich',
  ]},
  { group: 'Asia', zones: [
    'Asia/Bangkok', 'Asia/Beirut', 'Asia/Dubai', 'Asia/Hong_Kong', 'Asia/Jakarta', 'Asia/Jerusalem',
    'Asia/Karachi', 'Asia/Kolkata', 'Asia/Kuala_Lumpur', 'Asia/Manila', 'Asia/Riyadh', 'Asia/Seoul',
    'Asia/Shanghai', 'Asia/Singapore', 'Asia/Taipei', 'Asia/Tehran', 'Asia/Tokyo',
  ]},
  { group: 'Oceania', zones: [
    'Australia/Adelaide', 'Australia/Brisbane', 'Australia/Melbourne', 'Australia/Perth',
    'Australia/Sydney', 'Pacific/Auckland', 'Pacific/Fiji',
  ]},
  { group: 'UTC', zones: ['UTC'] },
];

// Settings menu items configuration - for Customers
const CUSTOMER_SETTINGS_SECTIONS = [
  { key: 'profile', label: 'Profile', icon: User, description: 'Manage your personal information' },
  { key: 'favourites', label: 'Favourites', icon: Heart, description: 'Your saved services and items' },
  { key: 'subscriptions', label: 'Subscriptions', icon: Bell, description: 'Operators you follow for promotions' },
  { key: 'location', label: 'Location', icon: MapPin, description: 'Set your country for local services' },
  { key: 'security', label: 'Security', icon: Shield, description: 'Password and authentication settings' },
  { key: 'notifications', label: 'Notifications', icon: Bell, description: 'Manage alerts and push messages' },
  { key: 'preferences', label: 'Preferences', icon: Globe, description: 'Language, currency, and display' },
  { key: 'payment', label: 'Payment Methods', icon: CreditCard, description: 'Manage your payment options' },
  { key: 'legal', label: 'Legal Information', icon: FileText, description: 'Terms, conditions & data protection' },
  { key: 'about', label: 'About / Impressum', icon: Info, description: 'App information' },
];

// Settings menu items for Operators (no Payment Methods)
const OPERATOR_SETTINGS_SECTIONS = [
  { key: 'profile', label: 'Profile', icon: User, description: 'Manage your personal information' },
  { key: 'security', label: 'Security', icon: Shield, description: 'Password and authentication settings' },
  { key: 'notifications', label: 'Notifications', icon: Bell, description: 'Manage alerts and push messages' },
  { key: 'preferences', label: 'Preferences', icon: Globe, description: 'Language, currency, and display' },
  { key: 'legal', label: 'Legal Information', icon: FileText, description: 'Terms, conditions & data protection' },
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

function SubscriptionsSection() {
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/subscriptions/my');
        setSubs(res.data.subscriptions || []);
      } catch { setSubs([]); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  const unsubscribe = async (operatorId) => {
    try {
      await api.post('/subscriptions/unsubscribe', { operator_id: operatorId });
      setSubs(prev => prev.filter(s => s.operator_id !== operatorId));
      toast.success('Unsubscribed');
    } catch { toast.error('Failed to unsubscribe'); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-bold text-slate-900 mb-1">Your Subscriptions</h3>
        <p className="text-sm text-slate-500">{subs.length} operator{subs.length !== 1 ? 's' : ''} you follow for promotions and updates</p>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
      ) : subs.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-xl">
          <Bell className="h-12 w-12 mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">No subscriptions yet</p>
          <p className="text-sm text-slate-400 mt-1">Subscribe to operators on service pages to receive their promotions</p>
        </div>
      ) : (
        <div className="space-y-3">
          {subs.map((sub, i) => (
            <div key={i} className="flex items-center gap-4 p-4 bg-white border border-slate-200 rounded-xl hover:shadow-sm transition-shadow" data-testid={`sub-item-${sub.operator_id}`}>
              <div className="w-12 h-12 rounded-full bg-gradient-to-r from-blue-500 to-violet-500 flex items-center justify-center text-white font-bold text-lg">
                {(sub.operator_name || 'O').charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900">{sub.operator_name || 'Operator'}</p>
                <p className="text-xs text-slate-500 mt-0.5">Subscribed {sub.created_at ? new Date(sub.created_at).toLocaleDateString() : ''}</p>
              </div>
              <Button variant="outline" size="sm" className="text-red-500 border-red-200 hover:bg-red-50" onClick={() => unsubscribe(sub.operator_id)}>
                Unsubscribe
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Legal Information panel
// ─────────────────────────────────────────────────────────────────────
// Two tabs: Terms & Conditions and Data Protection (Privacy).
// Each tab pulls content from the backend cache populated by /api/legal/content
// (server-side scrape of oryno.tech/terms & oryno.tech/privacy with a 24h TTL).
// If the cached HTML is empty (the marketing site is JS-rendered → server-side
// scrape returns no body), we fall back to an embedded iframe of the live page
// so the user always sees up-to-date content.
function LegalContentPanel() {
  const [activeTab, setActiveTab] = useState('terms');
  const [data, setData] = useState({ terms: null, privacy: null });
  const [loading, setLoading] = useState({ terms: false, privacy: false });
  const [refreshing, setRefreshing] = useState(false);

  const loadContent = async (type, force = false) => {
    setLoading((s) => ({ ...s, [type]: true }));
    try {
      const url = `/legal/content?type=${type}${force ? '&refresh=true' : ''}`;
      const { data: res } = await api.get(url);
      setData((s) => ({ ...s, [type]: res }));
    } catch (e) {
      // fall back to "no content" state — iframe will still render
      setData((s) => ({ ...s, [type]: null }));
    } finally {
      setLoading((s) => ({ ...s, [type]: false }));
    }
  };

  useEffect(() => {
    loadContent('terms');
    loadContent('privacy');
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadContent('terms', true), loadContent('privacy', true)]);
    setRefreshing(false);
    toast.success('Legal content refreshed from oryno.tech');
  };

  const renderTabContent = (type) => {
    const content = data[type];
    const isLoading = loading[type];
    const sourceUrl = type === 'terms' ? 'https://oryno.tech/terms' : 'https://oryno.tech/privacy';
    const hasCachedText = content && content.html_content && content.html_content.length > 200;

    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          <span className="ml-3 text-sm text-slate-500">Loading from oryno.tech…</span>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {/* Header strip — source + last fetched */}
        <div className="flex items-center justify-between flex-wrap gap-2 text-[11px] text-slate-500">
          <div className="flex items-center gap-2">
            <Globe className="h-3 w-3" />
            <span>Source:</span>
            <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="text-[#082c59] hover:underline font-mono">
              {sourceUrl}
            </a>
            <ExternalLink className="h-3 w-3 text-slate-400" />
          </div>
          {content?.fetched_at && (
            <span>
              Cached: {new Date(content.fetched_at).toLocaleString()}
            </span>
          )}
        </div>

        {hasCachedText ? (
          <div
            className="prose prose-sm max-w-none p-4 rounded-lg border border-slate-200 bg-slate-50/50 overflow-x-auto"
            data-testid={`legal-${type}-content`}
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: content.html_content }}
          />
        ) : (
          // Live fallback — the marketing site is a SPA so the server-side
          // scrape returns no body. Embed the page directly so the user still
          // sees the live, dynamic copy.
          <div className="space-y-2" data-testid={`legal-${type}-iframe-wrapper`}>
            <p className="text-[11px] text-slate-500 italic">
              Live view (server-side cache empty — pulling directly from oryno.tech).
            </p>
            <div className="rounded-lg border border-slate-200 overflow-hidden bg-white">
              <iframe
                src={sourceUrl}
                title={type === 'terms' ? 'Terms & Conditions' : 'Privacy Policy'}
                className="w-full"
                style={{ minHeight: '60vh' }}
                sandbox="allow-same-origin allow-scripts allow-popups"
                data-testid={`legal-${type}-iframe`}
              />
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4" data-testid="legal-panel">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-bold text-slate-900 flex items-center gap-2">
            <Scale className="h-4 w-4 text-[#082c59]" /> Legal Information
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Terms &amp; Conditions and Data Protection notice. Pulled live from oryno.tech and cached for 24 h.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
          data-testid="legal-refresh-btn"
          className="gap-1.5"
        >
          {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Refresh now
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 bg-slate-100">
          <TabsTrigger value="terms" className="gap-2 data-[state=active]:bg-[#082c59] data-[state=active]:text-white" data-testid="legal-tab-terms">
            <FileText className="h-3.5 w-3.5" />Terms &amp; Conditions
          </TabsTrigger>
          <TabsTrigger value="privacy" className="gap-2 data-[state=active]:bg-[#082c59] data-[state=active]:text-white" data-testid="legal-tab-privacy">
            <Lock className="h-3.5 w-3.5" />Data Protection
          </TabsTrigger>
        </TabsList>
        <TabsContent value="terms" className="mt-4">{renderTabContent('terms')}</TabsContent>
        <TabsContent value="privacy" className="mt-4">{renderTabContent('privacy')}</TabsContent>
      </Tabs>
    </div>
  );
}



export default function Settings() {
  const { t } = useTranslation();
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
    avatar_url: user?.avatar_url || user?.profile_picture || '',
  });

  // Re-sync profileData when user object refreshes (e.g. after avatar upload + reauth)
  useEffect(() => {
    if (!user) return;
    setProfileData((prev) => ({
      ...prev,
      full_name: user.full_name || prev.full_name,
      email: user.email || prev.email,
      phone: user.phone || prev.phone,
      date_of_birth: user.date_of_birth || prev.date_of_birth,
      id_document_number: user.id_document_number || prev.id_document_number,
      gender: user.gender || prev.gender,
      address: user.address ?? prev.address,
      city: user.city ?? prev.city,
      region: user.region ?? prev.region,
      postal_code: user.postal_code ?? prev.postal_code,
      country: user.country || prev.country,
      avatar_url: user.avatar_url || user.profile_picture || prev.avatar_url,
    }));
  }, [user]);

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

  // Preferences — default to the browser-detected timezone + extended options
  const [preferences, setPreferences] = useState({
    language: 'en',
    currency: 'XAF',
    timezone: detectBrowserTimezone(),
    theme: 'light',
    // Display
    date_format: 'DD/MM/YYYY',
    time_format: '24h',
    first_day_of_week: 'monday',
    number_format: 'fr',
    distance_unit: 'km',
    temperature_unit: 'celsius',
    // App behaviour
    default_landing_page: 'auto',
    default_search_radius_km: 25,
    results_per_page: 20,
    // Communication
    marketing_opt_in: false,
    show_profile_publicly: false,
    share_usage_data: true,
    // Accessibility
    reduce_motion: false,
    high_contrast: false,
    font_scale: 'normal',
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

  // Mobile access policy (Salesforce-style "use the app" gate)
  const [mobilePolicy, setMobilePolicy] = useState({
    mobile_access_policy: 'hybrid',
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

  // Load extended user preferences from backend.
  // The user object only contains the basic 4 fields (language, currency, timezone, theme);
  // the extended display/behaviour/communication/accessibility fields live behind the
  // /users/me/preferences endpoint.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get('/users/me/preferences');
        if (cancelled || !data) return;
        setPreferences(prev => ({ ...prev, ...data }));
        if (data.timezone) persistTimezone(data.timezone);
      } catch (e) {
        // Fallback to the basic four from the user object
        const tz = user.timezone || detectBrowserTimezone() || 'Africa/Douala';
        setPreferences(prev => ({
          ...prev,
          language: user.language || 'en',
          currency: user.currency || 'XAF',
          timezone: tz,
          theme: user.theme || 'light',
        }));
        persistTimezone(tz);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load session timeout & mobile policy settings for admins
  useEffect(() => {
    const loadSystemSettings = async () => {
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
            setMobilePolicy(prev => ({
              ...prev,
              mobile_access_policy: response.data.mobile_access_policy || 'hybrid',
              loading: false,
            }));
          }
        } catch (error) {
          console.log('Could not load system settings:', error);
          setSessionTimeoutConfig(prev => ({ ...prev, loading: false }));
          setMobilePolicy(prev => ({ ...prev, loading: false }));
        }
      }
    };
    
    loadSystemSettings();
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
        const newAvatar = response.data.file_url;
        setProfileData((prev) => ({ ...prev, avatar_url: newAvatar }));

        // Persist immediately so the avatar survives logout/login.
        // Save both `avatar_url` and `profile_picture` so older/newer clients
        // and the User model both pick it up.
        try {
          const userId = user?._id || user?.id;
          if (userId) {
            await api.put(`/users/${userId}`, {
              avatar_url: newAvatar,
              profile_picture: newAvatar,
            });
            if (reAuthenticate) await reAuthenticate();
          }
          toast.success('Profile picture saved');
        } catch (saveErr) {
          console.error('Avatar persist error:', saveErr);
          toast.error('Picture uploaded but failed to save to your profile. Click "Save Changes" to retry.');
        }
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
      // Persist locally so every part of the app picks them up immediately
      persistTimezone(preferences.timezone);
      setDateFormat(preferences.date_format);
      setTimeFormat(preferences.time_format);
      syncPreferencesToLocal(preferences);
      // Apply accessibility prefs to <html> right away (no page refresh needed)
      const root = document.documentElement;
      if (preferences.reduce_motion) root.setAttribute('data-reduce-motion', 'true');
      else root.removeAttribute('data-reduce-motion');
      if (preferences.high_contrast) root.setAttribute('data-high-contrast', 'true');
      else root.removeAttribute('data-high-contrast');
      root.setAttribute('data-font-scale', preferences.font_scale || 'normal');
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

  const handleSaveMobilePolicy = async (nextValue) => {
    const prevValue = mobilePolicy.mobile_access_policy;
    setMobilePolicy(prev => ({
      ...prev,
      mobile_access_policy: nextValue,
      saving: true,
      saveSuccess: false,
    }));
    try {
      await api.put('/system-settings/mobile-access-policy', {
        mobile_access_policy: nextValue,
      });
      toast.success(`Mobile access policy set to "${nextValue.replace('_', ' ')}"`);
      setMobilePolicy(prev => ({ ...prev, saveSuccess: true }));
      setTimeout(() => {
        setMobilePolicy(prev => ({ ...prev, saveSuccess: false }));
      }, 3000);
    } catch (error) {
      console.error('Mobile policy save error:', error);
      toast.error(error.response?.data?.detail || 'Failed to update mobile access policy');
      // Roll back the optimistic update on failure
      setMobilePolicy(prev => ({ ...prev, mobile_access_policy: prevValue }));
    } finally {
      setMobilePolicy(prev => ({ ...prev, saving: false }));
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

            {/* Basic Information — fill once. Locks after first save. */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 justify-between">
                <h4 className="font-semibold text-slate-900">{t('settings.basic_info')}</h4>
                <Badge variant="outline" className="text-[11px] gap-1 border-amber-300 text-amber-700 bg-amber-50">
                  <Lock className="h-3 w-3" /> {t('settings.fill_once_locks')}
                </Badge>
              </div>
              <p className="text-xs text-slate-500 -mt-2">
                {t('settings.locked_admin_note')}
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="full_name">{t('settings.full_name')} {!!user?.full_name && <span className="text-xs text-amber-600">{t('settings.locked_tag')}</span>}</Label>
                  <Input
                    id="full_name"
                    value={profileData.full_name}
                    onChange={(e) => setProfileData({ ...profileData, full_name: e.target.value })}
                    className={`mt-1 ${user?.full_name ? 'bg-slate-100 cursor-not-allowed' : 'bg-white'}`}
                    disabled={!!user?.full_name}
                    data-testid="profile-full-name"
                  />
                </div>
                <div>
                  <Label htmlFor="email">{t('settings.email_address')} {!!user?.email && <span className="text-xs text-amber-600">{t('settings.locked_tag')}</span>}</Label>
                  <Input
                    id="email"
                    type="email"
                    value={profileData.email}
                    onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                    className={`mt-1 ${user?.email ? 'bg-slate-100 cursor-not-allowed' : 'bg-white'}`}
                    disabled={!!user?.email}
                    data-testid="profile-email"
                  />
                </div>
                <div>
                  <Label htmlFor="phone">{t('settings.phone_number')} {!!user?.phone && <span className="text-xs text-amber-600">{t('settings.locked_tag')}</span>}</Label>
                  <Input
                    id="phone"
                    value={profileData.phone}
                    onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                    placeholder="+237 6XX XXX XXX"
                    className={`mt-1 ${user?.phone ? 'bg-slate-100 cursor-not-allowed' : 'bg-white'}`}
                    disabled={!!user?.phone}
                    data-testid="profile-phone"
                  />
                </div>
                <div>
                  <Label htmlFor="dob">{t('settings.date_of_birth')} {!!user?.date_of_birth && <span className="text-xs text-amber-600">{t('settings.locked_tag')}</span>}</Label>
                  <DatePickerField
                    value={profileData.date_of_birth}
                    onChange={(v) => setProfileData({ ...profileData, date_of_birth: v })}
                    placeholder={t('settings.date_of_birth')}
                    title={t('settings.date_of_birth')}
                    minDate={null}
                    disabled={!!user?.date_of_birth}
                  />
                </div>
                <div>
                  <Label htmlFor="id_doc">{t('settings.id_document_number')} {!!user?.id_document_number && <span className="text-xs text-amber-600">{t('settings.locked_tag')}</span>}</Label>
                  <Input
                    id="id_doc"
                    value={profileData.id_document_number}
                    onChange={(e) => setProfileData({ ...profileData, id_document_number: e.target.value })}
                    className={`mt-1 ${user?.id_document_number ? 'bg-slate-100 cursor-not-allowed' : 'bg-white'}`}
                    disabled={!!user?.id_document_number}
                    placeholder="e.g., 12345678"
                    data-testid="profile-id-doc"
                  />
                </div>
                <div>
                  <Label htmlFor="gender">Gender {!!user?.gender && <span className="text-xs text-amber-600">(locked)</span>}</Label>
                  <select
                    id="gender"
                    value={profileData.gender || ''}
                    onChange={(e) => setProfileData({ ...profileData, gender: e.target.value })}
                    disabled={!!user?.gender}
                    className={`mt-1 w-full h-10 px-3 rounded-md border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#082c59]/20 focus:border-[#082c59] ${user?.gender ? 'bg-slate-100 cursor-not-allowed' : 'bg-white'}`}
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
              <h4 className="font-semibold text-slate-900">{t('settings.address_information')}</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <Label htmlFor="address">{t('settings.street_address')}</Label>
                  <Input
                    id="address"
                    value={profileData.address || ''}
                    onChange={(e) => setProfileData({ ...profileData, address: e.target.value })}
                    placeholder={t('settings.street_address_placeholder')}
                    className="mt-1 bg-white"
                  />
                </div>
                <div>
                  <Label htmlFor="city">{t('settings.city')}</Label>
                  <Input
                    id="city"
                    value={profileData.city || ''}
                    onChange={(e) => setProfileData({ ...profileData, city: e.target.value })}
                    placeholder="e.g., Yaoundé"
                    className="mt-1 bg-white"
                  />
                </div>
                <div>
                  <Label htmlFor="region">{t('settings.region_state')}</Label>
                  <Input
                    id="region"
                    value={profileData.region || ''}
                    onChange={(e) => setProfileData({ ...profileData, region: e.target.value })}
                    placeholder="e.g., Centre"
                    className="mt-1 bg-white"
                  />
                </div>
                <div>
                  <Label htmlFor="postal_code">{t('settings.postal_code')}</Label>
                  <Input
                    id="postal_code"
                    value={profileData.postal_code || ''}
                    onChange={(e) => setProfileData({ ...profileData, postal_code: e.target.value })}
                    placeholder="e.g., 00237"
                    className="mt-1 bg-white"
                  />
                </div>
                <div>
                  <Label htmlFor="country">{t('settings.country')}</Label>
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

      case 'subscriptions':
        return <SubscriptionsSection />;

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
            {/* Hint banner explaining which prefs are enforced today */}
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-[11px] text-blue-800 flex items-start gap-2" data-testid="prefs-info-banner">
              <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-blue-600" />
              <div>
                <p className="font-semibold mb-0.5">All preferences are saved to your account and persist across sessions.</p>
                <p>Live-applied right now: <strong>Timezone, Date / Time format, Theme, Reduce motion, High contrast, Font size, Default landing page, Distance unit, Number format</strong>. Other preferences (results-per-page, search radius, marketing &amp; profile flags, temperature unit, first day of week) are stored on your account and surfaced to feature endpoints — full UI plumbing rolls out incrementally.</p>
              </div>
            </div>

            {/* Language & locale */}
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <Languages className="h-4 w-4 text-[#082c59]" />
                <h3 className="font-bold text-slate-900">Language &amp; Locale</h3>
              </div>
              <div>
                <Label>Language</Label>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  {[
                    { code: 'en', label: 'English', flag: '🇬🇧' },
                    { code: 'fr', label: 'Français', flag: '🇫🇷' },
                  ].map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => {
                        setPreferences({ ...preferences, language: lang.code });
                        // Apply the language change instantly so the page
                        // re-renders in the newly chosen language without
                        // waiting for the Save button.
                        setAppLanguage(lang.code);
                      }}
                      className={`p-3 rounded-lg border flex items-center gap-3 transition-colors ${
                        preferences.language === lang.code
                          ? 'bg-blue-50 border-[#082c59] text-[#082c59]'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                      data-testid={`pref-lang-${lang.code}`}
                    >
                      <span className="text-xl">{lang.flag}</span>
                      <span className="font-medium text-sm">{lang.label}</span>
                      {preferences.language === lang.code && <Check className="ml-auto h-4 w-4" />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Currency</Label>
                  <select
                    value={preferences.currency}
                    onChange={(e) => setPreferences({ ...preferences, currency: e.target.value })}
                    className="w-full mt-1 h-10 px-3 border rounded-lg bg-white text-sm"
                    data-testid="pref-currency"
                  >
                    <option value="XAF">XAF (FCFA)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                  </select>
                </div>
                <div>
                  <Label>Number format</Label>
                  <select
                    value={preferences.number_format}
                    onChange={(e) => setPreferences({ ...preferences, number_format: e.target.value })}
                    className="w-full mt-1 h-10 px-3 border rounded-lg bg-white text-sm"
                    data-testid="pref-number-format"
                  >
                    <option value="fr">1 234,56 (FR)</option>
                    <option value="en">1,234.56 (EN)</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label>Timezone</Label>
                  <button
                    type="button"
                    onClick={() => {
                      const browserTz = detectBrowserTimezone();
                      setPreferences({ ...preferences, timezone: browserTz });
                      toast.success(`Detected: ${browserTz}`);
                    }}
                    className="text-xs text-[#082c59] hover:underline font-medium"
                    data-testid="detect-timezone-btn"
                  >
                    Use system timezone
                  </button>
                </div>
                <Select
                  value={preferences.timezone}
                  onValueChange={(v) => setPreferences({ ...preferences, timezone: v })}
                >
                  <SelectTrigger className="mt-1 bg-white" data-testid="timezone-select">
                    <SelectValue placeholder="Select timezone" />
                  </SelectTrigger>
                  <SelectContent className="bg-white max-h-80">
                    {COMMON_TIMEZONES.map((group) => (
                      <SelectGroup key={group.group}>
                        <SelectLabel>{group.group}</SelectLabel>
                        {group.zones.map((tz) => (
                          <SelectItem key={tz} value={tz}>{tz.replace('_', ' ')}</SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500 mt-1">
                  All dates and times across the app use this timezone.
                </p>
              </div>
            </section>

            <Separator />

            {/* Display */}
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <Palette className="h-4 w-4 text-[#082c59]" />
                <h3 className="font-bold text-slate-900">Display</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Date format</Label>
                  <select
                    value={preferences.date_format}
                    onChange={(e) => setPreferences({ ...preferences, date_format: e.target.value })}
                    className="w-full mt-1 h-10 px-3 border rounded-lg bg-white text-sm"
                    data-testid="pref-date-format"
                  >
                    <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                    <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                    <option value="DD MMM YYYY">DD MMM YYYY</option>
                  </select>
                </div>
                <div>
                  <Label>Time format</Label>
                  <select
                    value={preferences.time_format}
                    onChange={(e) => setPreferences({ ...preferences, time_format: e.target.value })}
                    className="w-full mt-1 h-10 px-3 border rounded-lg bg-white text-sm"
                    data-testid="pref-time-format"
                  >
                    <option value="24h">24-hour (14:30)</option>
                    <option value="12h">12-hour (2:30 PM)</option>
                  </select>
                </div>
                <div>
                  <Label>First day of week</Label>
                  <select
                    value={preferences.first_day_of_week}
                    onChange={(e) => setPreferences({ ...preferences, first_day_of_week: e.target.value })}
                    className="w-full mt-1 h-10 px-3 border rounded-lg bg-white text-sm"
                    data-testid="pref-first-day"
                  >
                    <option value="monday">Monday</option>
                    <option value="sunday">Sunday</option>
                    <option value="saturday">Saturday</option>
                  </select>
                </div>
                <div>
                  <Label>Distance unit</Label>
                  <select
                    value={preferences.distance_unit}
                    onChange={(e) => setPreferences({ ...preferences, distance_unit: e.target.value })}
                    className="w-full mt-1 h-10 px-3 border rounded-lg bg-white text-sm"
                    data-testid="pref-distance"
                  >
                    <option value="km">Kilometers</option>
                    <option value="mi">Miles</option>
                  </select>
                </div>
                <div>
                  <Label>Temperature unit</Label>
                  <select
                    value={preferences.temperature_unit}
                    onChange={(e) => setPreferences({ ...preferences, temperature_unit: e.target.value })}
                    className="w-full mt-1 h-10 px-3 border rounded-lg bg-white text-sm"
                    data-testid="pref-temperature"
                  >
                    <option value="celsius">Celsius (°C)</option>
                    <option value="fahrenheit">Fahrenheit (°F)</option>
                  </select>
                </div>
                <div>
                  <Label>Theme</Label>
                  <select
                    value={preferences.theme}
                    onChange={(e) => setPreferences({ ...preferences, theme: e.target.value })}
                    className="w-full mt-1 h-10 px-3 border rounded-lg bg-white text-sm"
                    data-testid="pref-theme"
                  >
                    <option value="light">Light</option>
                    <option value="dark" disabled>Dark (coming soon)</option>
                    <option value="system" disabled>System (coming soon)</option>
                  </select>
                </div>
              </div>
            </section>

            <Separator />

            {/* App behaviour */}
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-[#082c59]" />
                <h3 className="font-bold text-slate-900">App Behaviour</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Default landing page</Label>
                  <select
                    value={preferences.default_landing_page}
                    onChange={(e) => setPreferences({ ...preferences, default_landing_page: e.target.value })}
                    className="w-full mt-1 h-10 px-3 border rounded-lg bg-white text-sm"
                    data-testid="pref-landing-page"
                  >
                    <option value="auto">Smart (by role)</option>
                    <option value="dashboard">Dashboard</option>
                    <option value="orders">My Orders</option>
                    <option value="services">Browse Services</option>
                  </select>
                </div>
                <div>
                  <Label>Default search radius</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      type="number"
                      min={1} max={500}
                      value={preferences.default_search_radius_km}
                      onChange={(e) => setPreferences({ ...preferences, default_search_radius_km: Number(e.target.value) })}
                      className="h-10 bg-white"
                      data-testid="pref-search-radius"
                    />
                    <span className="text-sm text-slate-500">{preferences.distance_unit}</span>
                  </div>
                </div>
                <div>
                  <Label>Results per page</Label>
                  <select
                    value={preferences.results_per_page}
                    onChange={(e) => setPreferences({ ...preferences, results_per_page: Number(e.target.value) })}
                    className="w-full mt-1 h-10 px-3 border rounded-lg bg-white text-sm"
                    data-testid="pref-results-per-page"
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
              </div>
            </section>

            <Separator />

            {/* Communication & privacy */}
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-[#082c59]" />
                <h3 className="font-bold text-slate-900">Communication &amp; Privacy</h3>
              </div>
              <PrefToggle
                label="Promotional emails &amp; offers"
                description="Receive marketing emails about new deals and operators you might like."
                checked={preferences.marketing_opt_in}
                onChange={(v) => setPreferences({ ...preferences, marketing_opt_in: v })}
                testid="pref-marketing"
              />
              <PrefToggle
                label="Show my profile publicly"
                description="Operators can see your reviews next to your display name."
                checked={preferences.show_profile_publicly}
                onChange={(v) => setPreferences({ ...preferences, show_profile_publicly: v })}
                testid="pref-public-profile"
              />
              <PrefToggle
                label="Share anonymous usage data"
                description="Helps us improve the app. No personal information is shared."
                checked={preferences.share_usage_data}
                onChange={(v) => setPreferences({ ...preferences, share_usage_data: v })}
                testid="pref-usage-data"
              />
            </section>

            <Separator />

            {/* Accessibility */}
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-[#082c59]" />
                <h3 className="font-bold text-slate-900">Accessibility</h3>
              </div>
              <PrefToggle
                label="Reduce motion"
                description="Disable non-essential animations and transitions."
                checked={preferences.reduce_motion}
                onChange={(v) => setPreferences({ ...preferences, reduce_motion: v })}
                testid="pref-reduce-motion"
              />
              <PrefToggle
                label="High contrast"
                description="Boost colour contrast for easier reading."
                checked={preferences.high_contrast}
                onChange={(v) => setPreferences({ ...preferences, high_contrast: v })}
                testid="pref-high-contrast"
              />
              <div>
                <Label>Font size</Label>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  {['small', 'normal', 'large'].map(size => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setPreferences({ ...preferences, font_scale: size })}
                      className={`p-2.5 rounded-lg border text-sm font-medium capitalize transition ${
                        preferences.font_scale === size
                          ? 'bg-[#082c59] text-white border-[#082c59]'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                      data-testid={`pref-font-${size}`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <div className="pt-4 border-t sticky bottom-0 bg-white">
              <Button 
                onClick={handleSavePreferences} 
                disabled={saving} 
                className={`transition-all duration-300 ${
                  saveSuccess.preferences 
                    ? 'bg-green-600 hover:bg-green-700' 
                    : 'bg-[#082c59]'
                }`}
                data-testid="save-preferences-btn"
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

      case 'legal':
        return <LegalContentPanel />;

      case 'about':
        // eslint-disable-next-line no-case-declarations
        const aboutContent = contentData.about;
        // eslint-disable-next-line no-case-declarations
        const isAboutEditing = editingContent === 'about';
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900">About / Impressum</h3>
              {isAdmin && (
                <Button variant="outline" onClick={() => setEditingContent(isAboutEditing ? null : 'about')}>
                  {isAboutEditing ? 'Cancel' : 'Edit'}
                </Button>
              )}
            </div>

            {isAboutEditing ? (
              <div className="space-y-4">
                <div>
                  <Label>Title</Label>
                  <Input
                    value={aboutContent.title}
                    onChange={(e) => setContentData({
                      ...contentData,
                      about: { ...aboutContent, title: e.target.value },
                    })}
                    className="mt-1 bg-white"
                  />
                </div>
                <div>
                  <Label>Content</Label>
                  <Textarea
                    value={aboutContent.content}
                    onChange={(e) => setContentData({
                      ...contentData,
                      about: { ...aboutContent, content: e.target.value },
                    })}
                    rows={12}
                    className="mt-1 bg-white"
                  />
                </div>
                <Button onClick={() => handleSaveContent('about')} disabled={saving} className="bg-[#082c59]">
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save Changes
                </Button>
              </div>
            ) : (
              <div className="prose max-w-none">
                {aboutContent.title ? (
                  <>
                    <h4>{aboutContent.title}</h4>
                    <div className="whitespace-pre-wrap text-slate-700">{aboutContent.content}</div>
                  </>
                ) : (
                  <p className="text-slate-500">No about content available.</p>
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

            {/* Mobile Access Policy — Salesforce-style "use the app" gate */}
            <div className="bg-gradient-to-br from-slate-50 to-indigo-50/50 rounded-xl border border-slate-200 overflow-hidden" data-testid="mobile-access-policy-card">
              <div className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-indigo-100 rounded-lg">
                      <Smartphone className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-900">Mobile Access Policy</h4>
                      <p className="text-sm text-slate-500 mt-0.5">
                        Control whether phones and tablets can use the web app or must use the native Oryno app.
                      </p>
                    </div>
                  </div>
                  {mobilePolicy.saveSuccess && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-100 text-green-700 rounded-full text-sm font-medium animate-pulse">
                      <Check className="h-4 w-4" />
                      Saved
                    </div>
                  )}
                </div>

                {mobilePolicy.loading ? (
                  <div className="flex items-center gap-2 text-slate-500 mt-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Loading policy...</span>
                  </div>
                ) : (
                  <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
                    {[
                      {
                        value: 'hybrid',
                        label: 'Hybrid',
                        desc: 'Phones, tablets & desktops all welcome on web. (Default — keep this until the native apps ship.)',
                        accent: 'border-slate-200 bg-white',
                        active: 'border-indigo-500 ring-2 ring-indigo-500/30 bg-indigo-50/60',
                      },
                      {
                        value: 'mobile_only',
                        label: 'Mobile-app-only',
                        desc: 'Phones & tablets must use the Oryno app. Web browser on those devices gets a takeover screen.',
                        accent: 'border-slate-200 bg-white',
                        active: 'border-indigo-500 ring-2 ring-indigo-500/30 bg-indigo-50/60',
                      },
                      {
                        value: 'web_only',
                        label: 'Web only (emergency)',
                        desc: 'Disable the gate entirely. Use this only if the native apps go down.',
                        accent: 'border-slate-200 bg-white',
                        active: 'border-amber-500 ring-2 ring-amber-500/30 bg-amber-50/60',
                      },
                    ].map(opt => {
                      const isActive = mobilePolicy.mobile_access_policy === opt.value;
                      const disabled = user?.role !== 'super_admin' || mobilePolicy.saving;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          disabled={disabled}
                          onClick={() => handleSaveMobilePolicy(opt.value)}
                          data-testid={`mobile-policy-option-${opt.value}`}
                          className={`text-left p-4 rounded-xl border transition-all ${
                            isActive ? opt.active : opt.accent
                          } ${disabled ? 'cursor-not-allowed opacity-60' : 'hover:border-indigo-400 hover:shadow-sm'}`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-slate-900 text-sm">{opt.label}</span>
                            {isActive && <Check className="h-4 w-4 text-indigo-600" />}
                          </div>
                          <p className="text-xs text-slate-600 leading-relaxed">{opt.desc}</p>
                        </button>
                      );
                    })}
                  </div>
                )}

                {user?.role !== 'super_admin' && !mobilePolicy.loading && (
                  <div className="flex items-center gap-2 p-3 mt-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                    <p className="text-sm text-amber-700">
                      Only Super Admins can modify the mobile access policy.
                    </p>
                  </div>
                )}

                <p className="text-xs text-slate-500 mt-4">
                  Super-admins are always allowed through the gate as an escape hatch. The native app sends a
                  signed <code className="bg-slate-100 px-1.5 py-0.5 rounded">X-Oryno-Client</code> header so the
                  backend can tell it apart from a phone web browser.
                </p>
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
    <div className="space-y-6">
      {/* Header card — title + description live inside a modal-style card */}
      <Card className="bg-gradient-to-br from-[#082c59] to-[#0a3a75] text-white border-0 shadow-md">
        <CardContent className="p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
            <SettingsIcon className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold flex items-center gap-2" data-testid="settings-title">{t('settings.title')}</h1>
            <p className="text-sm text-white/80 mt-0.5" data-testid="settings-description">
              {t('settings.manage_account')}
            </p>
          </div>
        </CardContent>
      </Card>

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
                        <p className="font-medium text-sm">{t(`settings.section_${section.key}`, section.label)}</p>
                        <p className={`text-xs truncate ${isActive ? 'text-white/70' : 'text-slate-400'}`}>
                          {t(`settings.desc_${section.key}`, section.description)}
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
                    <p className="text-xs text-red-400">{t('settings.sign_out_label')}</p>
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

// Compact toggle row used in Preferences > Communication / Accessibility
function PrefToggle({ label, description, checked, onChange, testid }) {
  return (
    <div className="flex items-start justify-between gap-4 p-3 rounded-lg border border-slate-200 bg-white">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-900">{label}</p>
        {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
      </div>
      <Switch checked={!!checked} onCheckedChange={onChange} data-testid={testid} />
    </div>
  );
}
