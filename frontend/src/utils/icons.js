// Shared icon-name → lucide-react component resolver used by the global
// search dropdown and the GlobalSearchAllModal preview. Keeps the icon set in
// one place so the backend can return string icon names and the UI renders
// the matching React component.
import {
  Search, Bus, Hotel, Car, Utensils, Calendar, Package, Film, Gift, PartyPopper,
  Building2, User, Users, Receipt, LayoutDashboard, Ticket, Award, Star,
  CreditCard, Bell, HelpCircle, Settings, BarChart, Shield, MessageSquare,
  HeadphonesIcon, Sparkles, Database, FileText, MapPin, Globe, Monitor,
  Shirt,
} from 'lucide-react';

export const iconMap = {
  Bus, Hotel, Car, Utensils, Calendar, Package, Film, Gift, PartyPopper,
  Building2, User, Users, Receipt, LayoutDashboard, Ticket, Award, Star,
  CreditCard, Bell, HelpCircle, Settings, BarChart, Shield, MessageSquare,
  HeadphonesIcon, Sparkles, Database, FileText, MapPin, Globe, Monitor,
  Shirt, Search,
};

export function getIconComponent(iconName) {
  return iconMap[iconName] || Search;
}

export default getIconComponent;
