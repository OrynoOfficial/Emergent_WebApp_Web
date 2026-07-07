import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollText, Shield, Database, Share2, Lock, Eye } from 'lucide-react';
import RenderMarkdownLite from '@/components/shared/RenderMarkdownLite';

const SECTIONS = [
  {
    id: 'collection',
    title: '1. Information We Collect',
    icon: Database,
    content: `We collect information you provide directly to us, including:

**Personal Information:**
- Name, email address, phone number
- Payment information (processed securely through third-party providers)
- Identity documents for certain services

**Booking Information:**
- Travel itineraries and preferences
- Service selections and special requests
- Transaction history

**Device Information:**
- IP address, browser type, device identifiers
- Usage data and interaction with our services
- Location data (with your consent)`
  },
  {
    id: 'usage',
    title: '2. How We Use Your Information',
    icon: Eye,
    content: `We use the information we collect to:

- Process and manage your bookings
- Send booking confirmations and updates
- Provide customer support
- Process payments securely
- Personalize your experience
- Send promotional communications (with your consent)
- Improve our services and develop new features
- Comply with legal obligations
- Prevent fraud and ensure security`
  },
  {
    id: 'sharing',
    title: '3. Information Sharing',
    icon: Share2,
    content: `We may share your information with:

**Service Providers:**
- Hotels, transport operators, and other partners necessary to fulfill your bookings
- Payment processors for secure transactions
- Customer service providers

**Legal Requirements:**
- When required by law or legal process
- To protect our rights and safety
- In connection with a merger or acquisition

**With Your Consent:**
- For purposes disclosed at the time of collection
- For marketing with your explicit consent

We do not sell your personal information to third parties.`
  },
  {
    id: 'security',
    title: '4. Data Security',
    icon: Lock,
    content: `We implement appropriate security measures to protect your information:

- Encryption of sensitive data in transit and at rest
- Secure payment processing through certified providers
- Regular security assessments and updates
- Access controls and authentication
- Employee training on data protection

While we strive to protect your information, no method of transmission over the internet is 100% secure. We encourage you to use strong passwords and protect your account credentials.`
  },
  {
    id: 'rights',
    title: '5. Your Rights',
    icon: Shield,
    content: `You have the following rights regarding your personal data:

**Access:** Request a copy of your personal data
**Correction:** Request correction of inaccurate data
**Deletion:** Request deletion of your data (subject to legal requirements)
**Portability:** Receive your data in a portable format
**Opt-out:** Unsubscribe from marketing communications
**Consent Withdrawal:** Withdraw consent for data processing

To exercise these rights, contact us at privacy@oryno.cm`
  },
  {
    id: 'cookies',
    title: '6. Cookies and Tracking',
    icon: Database,
    content: `We use cookies and similar technologies to:

- Remember your preferences and settings
- Analyze site traffic and usage patterns
- Personalize content and advertisements
- Enable social media features

**Types of Cookies:**
- Essential cookies (required for site functionality)
- Analytics cookies (help us improve our services)
- Marketing cookies (used for targeted advertising)

You can manage cookie preferences through your browser settings.`
  },
  {
    id: 'retention',
    title: '7. Data Retention',
    icon: Database,
    content: `We retain your personal information for as long as necessary to:

- Provide our services to you
- Comply with legal obligations
- Resolve disputes and enforce agreements
- Maintain business records

Booking records are retained for 7 years for tax and legal purposes. You may request earlier deletion of non-essential data.`
  },
  {
    id: 'contact',
    title: '8. Contact Us',
    icon: Shield,
    content: `For questions about this Privacy Policy or our data practices, contact us:

**Data Protection Officer**
Oryno Technology Ltd.
Avenue Kennedy, Bastos
Yaounde, Cameroon

Email: privacy@oryno.cm
Phone: +237 222 123 456

We will respond to your inquiry within 30 days.`
  }
];

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero Section */}
      <div className="bg-[#082c59] text-white py-16">
        <div className="px-4 text-center">
          <Shield className="w-16 h-16 mx-auto mb-4 opacity-80" />
          <h1 className="text-4xl font-bold mb-4">Privacy Policy</h1>
          <p className="text-lg text-blue-100">How we collect, use, and protect your information</p>
          <p className="text-sm text-blue-200 mt-4">Last updated: December 2025</p>
        </div>
      </div>

      <div className="px-4 py-12">
        {/* Introduction */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <p className="text-gray-600 leading-relaxed">
              Oryno Technology Ltd. ("we", "us", or "our") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our platform and services.
            </p>
            <p className="text-gray-600 leading-relaxed mt-4">
              By using our services, you agree to the collection and use of information in accordance with this policy. If you do not agree with our policies, please do not use our services.
            </p>
          </CardContent>
        </Card>

        {/* Table of Contents */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <h2 className="font-semibold mb-4">Table of Contents</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {SECTIONS.map((section) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className="text-[#082c59] hover:underline text-sm"
                >
                  {section.title}
                </a>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Sections */}
        <div className="space-y-8">
          {SECTIONS.map((section) => (
            <Card key={section.id} id={section.id}>
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <section.icon className="w-5 h-5 text-[#082c59]" />
                  </div>
                  <h2 className="text-xl font-bold text-[#082c59]">{section.title}</h2>
                </div>
                <div className="prose prose-slate max-w-none">
                  {section.content.split('\n').map((paragraph, idx) => (
                    <RenderMarkdownLite key={idx} text={paragraph} />
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Footer Note */}
        <Card className="mt-8">
          <CardContent className="p-6 text-center">
            <h3 className="font-semibold mb-2">Questions about your privacy?</h3>
            <p className="text-gray-600 mb-4">Contact our Data Protection Officer at privacy@oryno.cm</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
