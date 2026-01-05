import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Search, HelpCircle, Book, MessageCircle, Phone, Mail,
  ChevronDown, ChevronRight, ExternalLink, Clock,
  CreditCard, Calendar, Users, Car, Hotel, Utensils
} from 'lucide-react';

const FAQ_CATEGORIES = [
  {
    id: 'booking',
    name: 'Booking & Reservations',
    icon: Calendar,
    faqs: [
      { q: 'How do I make a booking?', a: 'Select your desired service (hotel, travel, car rental, etc.), choose your dates and preferences, then proceed to checkout. You can pay using mobile money (MTN MoMo, Orange Money) or card.' },
      { q: 'Can I modify my booking?', a: 'Yes, you can modify most bookings up to 24 hours before the scheduled date. Go to "My Orders" and select the booking you want to modify.' },
      { q: 'How do I cancel a booking?', a: 'Navigate to "My Orders", find your booking, and click "Cancel". Refund policies vary by service type. Most services offer free cancellation up to 24-48 hours before.' },
      { q: 'Why was my booking not confirmed?', a: 'Bookings may not be confirmed due to payment issues, unavailability, or incomplete information. Check your email for details or contact support.' }
    ]
  },
  {
    id: 'payment',
    name: 'Payments & Refunds',
    icon: CreditCard,
    faqs: [
      { q: 'What payment methods do you accept?', a: 'We accept MTN Mobile Money, Orange Money, Visa, Mastercard, and bank transfers. All payments are processed securely.' },
      { q: 'How long do refunds take?', a: 'Mobile money refunds are processed within 24-48 hours. Card refunds may take 5-10 business days depending on your bank.' },
      { q: 'Is my payment information secure?', a: 'Yes, all payments are processed through secure, encrypted channels. We never store your full card details.' },
      { q: 'Can I pay in installments?', a: 'Installment payments are available for bookings above 100,000 FCFA. Select "Pay in Installments" at checkout.' }
    ]
  },
  {
    id: 'account',
    name: 'Account & Profile',
    icon: Users,
    faqs: [
      { q: 'How do I create an account?', a: 'Click "Sign Up" on the login page, enter your email, phone number, and create a password. Verify your phone number to complete registration.' },
      { q: 'I forgot my password', a: 'Click "Forgot Password" on the login page, enter your email, and follow the instructions sent to your inbox.' },
      { q: 'How do I update my profile?', a: 'Go to Settings > Profile and update your information. Remember to save changes.' },
      { q: 'How do I earn loyalty points?', a: 'You earn points on every booking. Points can be redeemed for discounts on future bookings. Check the Loyalty page for your balance.' }
    ]
  },
  {
    id: 'services',
    name: 'Our Services',
    icon: Hotel,
    faqs: [
      { q: 'What services do you offer?', a: 'We offer hotel bookings, bus/travel tickets, car rentals, restaurant reservations, event tickets, laundry services, banquet halls, cinema tickets, and travel packages.' },
      { q: 'Are all listings verified?', a: 'Yes, all service providers on our platform are verified. We conduct regular quality checks to ensure standards are maintained.' },
      { q: 'Can I become a service provider?', a: 'Yes! Register as an Operator through our platform. You\'ll need to provide business documentation for verification.' },
      { q: 'Do you operate in my city?', a: 'We currently operate in major cities across Cameroon including Yaoundé, Douala, Bafoussam, Bamenda, Kribi, Limbe, and more.' }
    ]
  }
];

const QUICK_LINKS = [
  { title: 'Getting Started Guide', icon: Book, href: '#' },
  { title: 'Video Tutorials', icon: ExternalLink, href: '#' },
  { title: 'Terms & Conditions', icon: Book, href: '/terms' },
  { title: 'Privacy Policy', icon: Book, href: '/privacy' }
];

export default function HelpCenter() {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategory, setExpandedCategory] = useState('booking');
  const [expandedFaq, setExpandedFaq] = useState(null);

  const filteredCategories = FAQ_CATEGORIES.map(cat => ({
    ...cat,
    faqs: cat.faqs.filter(faq =>
      faq.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.a.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(cat => cat.faqs.length > 0 || searchQuery === '');

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero Section */}
      <div className="bg-[#082c59] text-white py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <HelpCircle className="w-16 h-16 mx-auto mb-4 opacity-80" />
          <h1 className="text-4xl font-bold mb-4">How can we help you?</h1>
          <p className="text-lg text-blue-100 mb-8">Search our knowledge base or browse categories below</p>
          <div className="relative max-w-xl mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              placeholder="Search for help..."
              className="pl-12 h-14 text-lg bg-white text-gray-900 border-0"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* FAQ Section */}
          <div className="lg:col-span-2 space-y-6">
            <h2 className="text-2xl font-bold text-[#082c59]">Frequently Asked Questions</h2>
            
            {filteredCategories.map(category => (
              <Card key={category.id} className="overflow-hidden">
                <button
                  className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
                  onClick={() => setExpandedCategory(expandedCategory === category.id ? null : category.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <category.icon className="w-5 h-5 text-[#082c59]" />
                    </div>
                    <span className="font-semibold text-lg">{category.name}</span>
                    <Badge variant="outline">{category.faqs.length}</Badge>
                  </div>
                  {expandedCategory === category.id ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                </button>
                
                {expandedCategory === category.id && (
                  <CardContent className="pt-0 pb-4">
                    <div className="space-y-2">
                      {category.faqs.map((faq, idx) => (
                        <div key={idx} className="border rounded-lg overflow-hidden">
                          <button
                            className="w-full p-4 text-left hover:bg-slate-50 transition-colors flex justify-between items-center"
                            onClick={() => setExpandedFaq(expandedFaq === `${category.id}-${idx}` ? null : `${category.id}-${idx}`)}
                          >
                            <span className="font-medium pr-4">{faq.q}</span>
                            {expandedFaq === `${category.id}-${idx}` ? <ChevronDown className="w-4 h-4 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 flex-shrink-0" />}
                          </button>
                          {expandedFaq === `${category.id}-${idx}` && (
                            <div className="px-4 pb-4 text-gray-600 bg-slate-50">
                              {faq.a}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Contact Support */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="w-5 h-5" /> Contact Support
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-gray-600">Can't find what you're looking for? Our support team is here to help.</p>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-sm">
                    <Phone className="w-4 h-4 text-[#082c59]" />
                    <span>+237 699 123 456</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Mail className="w-4 h-4 text-[#082c59]" />
                    <span>support@oryno.cm</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Clock className="w-4 h-4 text-[#082c59]" />
                    <span>Mon-Sat: 8AM - 8PM</span>
                  </div>
                </div>
                <Button className="w-full bg-[#082c59]">Start Live Chat</Button>
              </CardContent>
            </Card>

            {/* Quick Links */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Links</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {QUICK_LINKS.map((link, idx) => (
                    <a
                      key={idx}
                      href={link.href}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      <link.icon className="w-4 h-4 text-[#082c59]" />
                      <span>{link.title}</span>
                    </a>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
