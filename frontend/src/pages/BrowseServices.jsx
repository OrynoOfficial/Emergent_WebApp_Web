import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { 
  Search, Bus, Hotel, Car, Gift, Package, Utensils, 
  Calendar, Sparkles, Clapperboard, Ticket, Settings,
  Star, ArrowRight
} from 'lucide-react';

// Service category configurations
const SERVICE_CATEGORIES = [
  {
    key: 'travel',
    title: 'Travels & Bus',
    subtitle: 'Intercity Travel',
    icon: Bus,
    emoji: '🚌',
    path: '/services/travel',
    managePath: '/manage/travel',
    image: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?q=80&w=2069',
    description: 'Book comfortable bus tickets for intercity travel with premium amenities and reliable service',
    color: 'from-blue-500 to-blue-600',
    bgColor: 'bg-blue-50',
  },
  {
    key: 'hotels',
    title: 'Hotels & Stay',
    subtitle: 'Accommodation',
    icon: Hotel,
    emoji: '🏨',
    path: '/services/hotels',
    managePath: '/manage/hotels',
    image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=2070',
    description: 'Find and book the perfect accommodation from luxury hotels to cozy apartments',
    color: 'from-pink-500 to-rose-500',
    bgColor: 'bg-pink-50',
  },
  {
    key: 'car_rental',
    title: 'Car Rental',
    subtitle: 'Vehicle Hire',
    icon: Car,
    emoji: '🚗',
    path: '/services/car-rental',
    managePath: '/manage/car-rental',
    image: 'https://images.unsplash.com/photo-1502877338535-766e1452684a?q=80&w=2072',
    description: 'Rent premium vehicles for your next adventure with flexible rental options',
    color: 'from-emerald-500 to-green-500',
    bgColor: 'bg-emerald-50',
  },
  {
    key: 'restaurants',
    title: 'Restaurants',
    subtitle: 'Fine Dining',
    icon: Utensils,
    emoji: '🍽️',
    path: '/services/restaurants',
    managePath: '/manage/restaurants',
    image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=2070',
    description: 'Reserve tables at the finest restaurants and discover culinary excellence',
    color: 'from-orange-500 to-amber-500',
    bgColor: 'bg-orange-50',
  },
  {
    key: 'packages',
    title: 'Packages Delivery',
    subtitle: 'Shipping Services',
    icon: Package,
    emoji: '📦',
    path: '/services/packages',
    managePath: '/manage/packages',
    image: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?q=80&w=2070',
    description: 'Send packages anywhere with secure, fast, and reliable delivery services',
    color: 'from-red-500 to-pink-500',
    bgColor: 'bg-red-50',
  },
  {
    key: 'banquet',
    title: 'Banquets Equipment',
    subtitle: 'Event Rentals',
    icon: Gift,
    emoji: '🎪',
    path: '/services/banquet',
    managePath: '/manage/banquet',
    image: 'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?q=80&w=2069',
    description: 'Rent professional banquet equipment for weddings, corporate events, and special occasions',
    color: 'from-purple-500 to-violet-500',
    bgColor: 'bg-purple-50',
  },
  {
    key: 'laundry',
    title: 'Pressings',
    subtitle: 'Clothes & More',
    icon: Sparkles,
    emoji: '🧺',
    path: '/services/laundry',
    managePath: '/manage/laundry',
    image: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?q=80&w=2069',
    description: 'Professional pressing and finishing services with reliable pickups and on-time delivery',
    color: 'from-fuchsia-500 to-pink-500',
    bgColor: 'bg-fuchsia-50',
  },
  {
    key: 'events',
    title: 'Events',
    subtitle: 'Concerts • Sports • Shows',
    icon: Ticket,
    emoji: '🎟️',
    path: '/services/events',
    managePath: '/manage/events',
    image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=2069',
    description: 'Discover upcoming events and book tickets instantly with secure checkout',
    color: 'from-amber-500 to-yellow-500',
    bgColor: 'bg-amber-50',
  },
  {
    key: 'entertainment',
    title: 'Entertainment',
    subtitle: 'Movies & More',
    icon: Clapperboard,
    emoji: '🎬',
    path: '/services/entertainment',
    managePath: '/manage/entertainment',
    image: 'https://images.unsplash.com/photo-1513106580091-1d82408b8cd6?q=80&w=2069',
    description: 'Browse showtimes, book seats, and enjoy the latest blockbusters and entertainment',
    color: 'from-slate-700 to-slate-900',
    bgColor: 'bg-slate-50',
  },
];

export default function BrowseServices() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');

  const isAdmin = user?.role === 'admin';
  const isOperator = user?.role === 'operator';
  const canManage = isAdmin || isOperator;

  const filteredServices = SERVICE_CATEGORIES.filter(service =>
    service.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    service.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-900">Browse Services</h1>
          <p className="text-slate-600 mt-1">Choose from our comprehensive range of premium services</p>
        </div>
        {canManage && (
          <Link to="/admin/analytics">
            <Button variant="outline" className="gap-2 border-[#082c59] text-[#082c59]">
              <Settings className="h-4 w-4" />
              Manage Services
            </Button>
          </Link>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
        <Input
          type="text"
          placeholder="Search services..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-12 h-12 bg-white border-slate-200 focus:border-[#082c59] focus:ring-[#082c59]"
        />
      </div>

      {/* Services Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredServices.map((service) => {
          const IconComponent = service.icon;
          
          return (
            <Card 
              key={service.key}
              className="group overflow-hidden border-0 shadow-lg hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-3 hover:scale-[1.02] cursor-pointer relative"
              onClick={() => navigate(service.path)}
            >
              {/* Glow effect on hover */}
              <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl bg-gradient-to-r ${service.color} -z-10 scale-95`}></div>
              
              {/* Image Section */}
              <div className="aspect-[16/10] overflow-hidden relative">
                <img
                  src={service.image}
                  alt={service.title}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
                />
                {/* Gradient overlay with enhanced animation */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/40 to-transparent group-hover:from-slate-900/95 transition-all duration-500" />
                
                {/* Icon badge with bounce effect */}
                <div className={`absolute top-4 right-4 w-14 h-14 rounded-2xl bg-gradient-to-br ${service.color} flex items-center justify-center shadow-lg group-hover:scale-125 group-hover:rotate-6 group-hover:shadow-xl transition-all duration-500 ease-out`}>
                  <span className="text-2xl group-hover:animate-bounce">{service.emoji}</span>
                </div>

                {/* Title on image with slide-up effect */}
                <div className="absolute bottom-4 left-4 right-4 text-white transform group-hover:translate-y-[-4px] transition-transform duration-300">
                  <h3 className="font-bold text-xl drop-shadow-lg mb-1">{service.title}</h3>
                  <p className="text-white/90 text-sm drop-shadow">{service.subtitle}</p>
                </div>
              </div>

              {/* Content Section */}
              <CardContent className={`${service.bgColor} p-5 group-hover:bg-opacity-90 transition-all duration-300`}>
                <p className="text-slate-700 text-sm leading-relaxed mb-4 line-clamp-2">
                  {service.description}
                </p>

                <div className="flex flex-col gap-2">
                  <Button
                    className="w-full bg-[#082c59] hover:bg-[#0a3a75] text-white font-semibold py-5 rounded-xl shadow-md transition-all duration-300 active:scale-95 group-hover:shadow-xl"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(service.path);
                    }}
                  >
                    Book Now
                    <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform duration-300" />
                  </Button>

                  {canManage && service.managePath && (
                    <Button
                      variant="outline"
                      className="w-full border-slate-300 hover:border-[#082c59] text-slate-600 hover:text-[#082c59] py-5 rounded-xl hover:bg-white/50 transition-all duration-300 active:scale-95"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(service.managePath);
                      }}
                    >
                      <Settings className="mr-2 h-4 w-4 group-hover:rotate-90 transition-transform duration-500" />
                      Manage
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Empty state with enhanced visuals */}
      {filteredServices.length === 0 && (
        <div className="text-center py-16 px-6">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center mx-auto mb-6 animate-float">
            <Search className="h-12 w-12 text-slate-400" />
          </div>
          <h3 className="text-2xl font-bold text-slate-800 mb-3">No services found</h3>
          <p className="text-slate-500 max-w-md mx-auto mb-6">We couldn&apos;t find any services matching your search. Try different keywords or clear your filters.</p>
          <Button 
            variant="outline" 
            className="px-6 py-3 border-[#082c59] text-[#082c59] hover:bg-[#082c59] hover:text-white transition-all duration-300 active:scale-95"
            onClick={() => setSearchTerm('')}
          >
            Clear Search
          </Button>
        </div>
      )}
    </div>
  );
}
