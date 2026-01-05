import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Newspaper, Calendar, ArrowRight, Search, Tag,
  TrendingUp, Bell, Share2
} from 'lucide-react';

const NEWS_ITEMS = [
  {
    id: 1,
    title: 'Oryno Expands to 5 New Cities Across Cameroon',
    excerpt: 'We are excited to announce our expansion to Bamenda, Garoua, Maroua, Bertoua, and Ebolowa. Customers in these cities can now enjoy our full range of services.',
    category: 'Expansion',
    date: '2025-12-20',
    image: null,
    featured: true
  },
  {
    id: 2,
    title: 'New Partnership with Top Hotel Chains',
    excerpt: 'Oryno has partnered with leading hotel chains to bring you exclusive deals and guaranteed best rates on premium accommodations.',
    category: 'Partnership',
    date: '2025-12-18',
    image: null,
    featured: true
  },
  {
    id: 3,
    title: 'Introducing Loyalty Points Program',
    excerpt: 'Earn points on every booking and redeem them for discounts. Our new loyalty program rewards our valued customers.',
    category: 'Feature',
    date: '2025-12-15',
    image: null,
    featured: false
  },
  {
    id: 4,
    title: 'Holiday Season Special Offers',
    excerpt: 'Celebrate the festive season with up to 30% off on hotel bookings, travel packages, and car rentals. Valid until January 15, 2026.',
    category: 'Promotion',
    date: '2025-12-10',
    image: null,
    featured: true
  },
  {
    id: 5,
    title: 'Mobile App Update: New Features Released',
    excerpt: 'Our latest app update includes improved booking flow, real-time notifications, and enhanced payment options.',
    category: 'Product',
    date: '2025-12-05',
    image: null,
    featured: false
  },
  {
    id: 6,
    title: 'Customer Service Excellence Award',
    excerpt: 'Oryno has been recognized for outstanding customer service in the travel and hospitality sector.',
    category: 'Award',
    date: '2025-12-01',
    image: null,
    featured: false
  },
  {
    id: 7,
    title: 'New Bus Routes: Yaoundé to Kribi Express',
    excerpt: 'Direct bus service now available from Yaoundé to Kribi with multiple daily departures. Book your beach getaway today!',
    category: 'Service',
    date: '2025-11-28',
    image: null,
    featured: false
  },
  {
    id: 8,
    title: 'Payment Options Expanded',
    excerpt: 'We now accept Orange Money alongside MTN Mobile Money and cards, making payments even more convenient.',
    category: 'Feature',
    date: '2025-11-25',
    image: null,
    featured: false
  }
];

const CATEGORIES = ['All', 'Expansion', 'Partnership', 'Feature', 'Promotion', 'Product', 'Award', 'Service'];

export default function News() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const filteredNews = NEWS_ITEMS.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.excerpt.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const featuredNews = NEWS_ITEMS.filter(item => item.featured).slice(0, 3);

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getCategoryColor = (category) => {
    const colors = {
      'Expansion': 'bg-green-100 text-green-800',
      'Partnership': 'bg-blue-100 text-blue-800',
      'Feature': 'bg-purple-100 text-purple-800',
      'Promotion': 'bg-amber-100 text-amber-800',
      'Product': 'bg-indigo-100 text-indigo-800',
      'Award': 'bg-yellow-100 text-yellow-800',
      'Service': 'bg-teal-100 text-teal-800'
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero Section */}
      <div className="bg-[#082c59] text-white py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <Newspaper className="w-16 h-16 mx-auto mb-4 opacity-80" />
          <h1 className="text-4xl font-bold mb-4">News & Updates</h1>
          <p className="text-lg text-blue-100">Stay informed about the latest from Oryno</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-12">
        {/* Featured News */}
        <div className="mb-12">
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp className="w-5 h-5 text-[#082c59]" />
            <h2 className="text-2xl font-bold text-[#082c59]">Featured Stories</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {featuredNews.map((item, idx) => (
              <Card key={item.id} className={`overflow-hidden hover:shadow-lg transition-shadow cursor-pointer ${idx === 0 ? 'md:col-span-2 md:row-span-2' : ''}`}>
                <div className={`bg-gradient-to-br from-blue-100 to-indigo-100 ${idx === 0 ? 'h-64' : 'h-32'} flex items-center justify-center`}>
                  <Newspaper className={`${idx === 0 ? 'w-16 h-16' : 'w-10 h-10'} text-blue-300`} />
                </div>
                <CardContent className="p-4">
                  <Badge className={getCategoryColor(item.category)}>{item.category}</Badge>
                  <h3 className={`font-bold mt-2 ${idx === 0 ? 'text-xl' : 'text-lg'}`}>{item.title}</h3>
                  {idx === 0 && <p className="text-gray-600 mt-2">{item.excerpt}</p>}
                  <div className="flex items-center gap-2 mt-3 text-sm text-gray-500">
                    <Calendar className="w-4 h-4" />
                    {formatDate(item.date)}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              placeholder="Search news..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map(cat => (
              <Button
                key={cat}
                variant={selectedCategory === cat ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory(cat)}
                className={selectedCategory === cat ? 'bg-[#082c59]' : ''}
              >
                {cat}
              </Button>
            ))}
          </div>
        </div>

        {/* All News */}
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-[#082c59]">All News</h2>
          {filteredNews.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No news found matching your criteria
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredNews.map(item => (
                <Card key={item.id} className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-3">
                      <Badge className={getCategoryColor(item.category)}>{item.category}</Badge>
                      <span className="text-sm text-gray-500 flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {formatDate(item.date)}
                      </span>
                    </div>
                    <h3 className="font-bold text-lg mb-2 hover:text-[#082c59] transition-colors">{item.title}</h3>
                    <p className="text-gray-600 text-sm mb-4">{item.excerpt}</p>
                    <div className="flex items-center justify-between">
                      <Button variant="ghost" size="sm" className="text-[#082c59]">
                        Read More <ArrowRight className="w-4 h-4 ml-1" />
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Share2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Newsletter Signup */}
        <Card className="mt-12 bg-[#082c59] text-white">
          <CardContent className="p-8 text-center">
            <Bell className="w-12 h-12 mx-auto mb-4 opacity-80" />
            <h3 className="text-2xl font-bold mb-2">Stay Updated</h3>
            <p className="text-blue-100 mb-6">Subscribe to our newsletter for the latest news and exclusive offers</p>
            <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
              <Input placeholder="Enter your email" className="bg-white text-gray-900" />
              <Button className="bg-white text-[#082c59] hover:bg-gray-100">Subscribe</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
