import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollText, Shield, CreditCard, Users, AlertTriangle, Scale } from 'lucide-react';

const SECTIONS = [
  {
    id: 'acceptance',
    title: '1. Acceptance of Terms',
    icon: ScrollText,
    content: `By accessing and using the Oryno platform ("Service"), you agree to be bound by these Terms and Conditions. If you do not agree to these terms, please do not use our Service.

These terms apply to all users of the platform, including customers, operators, and visitors. We reserve the right to modify these terms at any time, and your continued use of the Service constitutes acceptance of any modifications.`
  },
  {
    id: 'services',
    title: '2. Description of Services',
    icon: Users,
    content: `Oryno provides a platform connecting customers with various service providers including:

• Hotel accommodations and room bookings
• Travel and transportation services (bus tickets, travel routes)
• Vehicle rentals (cars, vans, luxury vehicles)
• Restaurant reservations and dining experiences
• Event tickets and bookings
• Laundry and pressing services
• Banquet hall reservations
• Cinema tickets and movie bookings
• Travel packages and tours

We act as an intermediary between customers and service providers. The actual services are provided by third-party operators who are solely responsible for the quality and delivery of their services.`
  },
  {
    id: 'booking',
    title: '3. Booking and Reservations',
    icon: ScrollText,
    content: `3.1 Making a Booking
All bookings are subject to availability and confirmation. A booking is only confirmed when you receive a confirmation email or notification from us.

3.2 Accuracy of Information
You are responsible for providing accurate information when making a booking. Incorrect information may result in service denial or additional charges.

3.3 Modifications and Cancellations
• Modifications to bookings are subject to availability and may incur additional charges
• Cancellation policies vary by service type and operator
• Free cancellation is typically available up to 24-48 hours before the service date
• Late cancellations may result in partial or no refund

3.4 No-Shows
Failure to show up for a confirmed booking without prior cancellation may result in full charges being applied.`
  },
  {
    id: 'payment',
    title: '4. Payment Terms',
    icon: CreditCard,
    content: `4.1 Accepted Payment Methods
We accept the following payment methods:
• MTN Mobile Money
• Orange Money
• Visa and Mastercard
• Bank transfers (for select services)

4.2 Pricing
All prices are displayed in Central African CFA Franc (FCFA) and include applicable taxes unless otherwise stated. Prices are subject to change without notice.

4.3 Payment Security
All payment transactions are processed through secure, encrypted channels. We do not store complete credit card information on our servers.

4.4 Refunds
• Refund eligibility depends on the cancellation policy of each service
• Mobile money refunds are processed within 24-48 hours
• Card refunds may take 5-10 business days
• Processing fees may be non-refundable`
  },
  {
    id: 'user',
    title: '5. User Responsibilities',
    icon: Users,
    content: `5.1 Account Security
You are responsible for maintaining the confidentiality of your account credentials and for all activities under your account.

5.2 Prohibited Activities
Users must not:
• Provide false or misleading information
• Use the platform for illegal purposes
• Attempt to access other users' accounts
• Interfere with the proper functioning of the platform
• Resell or commercially exploit our services without authorization

5.3 Content Standards
Any content submitted (reviews, comments) must be accurate, respectful, and not contain offensive, defamatory, or illegal material.`
  },
  {
    id: 'liability',
    title: '6. Limitation of Liability',
    icon: Shield,
    content: `6.1 Service Provider Responsibility
Oryno acts as an intermediary platform. The actual services are provided by third-party operators who are solely responsible for:
• Service quality and delivery
• Safety and compliance with local regulations
• Accuracy of service descriptions

6.2 Platform Liability
Oryno shall not be liable for:
• Actions or omissions of service providers
• Service disruptions beyond our control
• Indirect, incidental, or consequential damages
• Loss of data or unauthorized access to your account

6.3 Maximum Liability
Our maximum liability shall not exceed the amount paid by you for the specific service in question.`
  },
  {
    id: 'disputes',
    title: '7. Disputes and Resolution',
    icon: Scale,
    content: `7.1 Customer Support
For any issues or complaints, please contact our customer support team first. We will make reasonable efforts to resolve disputes amicably.

7.2 Governing Law
These terms are governed by the laws of the Republic of Cameroon. Any disputes shall be subject to the exclusive jurisdiction of the courts of Yaoundé.

7.3 Arbitration
For disputes exceeding 500,000 FCFA, parties may opt for arbitration under the rules of the Cameroon Arbitration Centre.`
  },
  {
    id: 'privacy',
    title: '8. Privacy and Data Protection',
    icon: Shield,
    content: `Your privacy is important to us. Please refer to our Privacy Policy for detailed information on how we collect, use, and protect your personal data.

By using our Service, you consent to:
• Collection of necessary personal information
• Use of data to provide and improve our services
• Sharing of relevant information with service providers to fulfill bookings
• Communication regarding your bookings and promotional offers (with opt-out option)`
  },
  {
    id: 'termination',
    title: '9. Account Termination',
    icon: AlertTriangle,
    content: `9.1 User Termination
You may close your account at any time by contacting customer support. Outstanding obligations must be settled before account closure.

9.2 Platform Termination
We reserve the right to suspend or terminate accounts that:
• Violate these terms
• Engage in fraudulent activities
• Abuse our platform or other users
• Remain inactive for extended periods

9.3 Effect of Termination
Upon termination, your right to use the Service ceases immediately. Provisions that should survive termination will remain in effect.`
  }
];

export default function TermsAndConditions() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero Section */}
      <div className="bg-[#082c59] text-white py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <ScrollText className="w-16 h-16 mx-auto mb-4 opacity-80" />
          <h1 className="text-4xl font-bold mb-4">Terms and Conditions</h1>
          <p className="text-lg text-blue-100">Please read these terms carefully before using our services</p>
          <p className="text-sm text-blue-200 mt-4">Last updated: December 2025</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-12">
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
                    <p key={idx} className="text-gray-600 mb-3 whitespace-pre-line">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Contact */}
        <Card className="mt-8">
          <CardContent className="p-6 text-center">
            <h3 className="font-semibold mb-2">Questions about these terms?</h3>
            <p className="text-gray-600 mb-4">Contact our legal team at legal@oryno.cm or call +237 222 123 456</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
