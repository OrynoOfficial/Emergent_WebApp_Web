import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Info, Sparkles, Users, Target, MapPin, Handshake } from 'lucide-react';
import RenderMarkdownLite from '@/components/shared/RenderMarkdownLite';

const SECTIONS = [
  {
    id: 'mission',
    title: '1. Our Mission',
    icon: Target,
    content: `Oryno exists to make everyday life in Cameroon and across Central Africa easier by putting hotels, restaurants, cinemas, events, packages, banquets, laundries, transport and car rentals in a single, trustworthy marketplace.

We believe great services deserve great tools. That's why we build a platform that is fast for customers, respectful of operators, and safe for everyone.`
  },
  {
    id: 'story',
    title: '2. Our Story',
    icon: Sparkles,
    content: `Oryno started in 2024 as a small side-project in Douala. The founding team was tired of switching between five apps to book a weekend: one for the hotel, one for the movie tickets, one for the ride home. So we set out to build the "one app" experience — but honest about the fact that a good marketplace only works when local operators genuinely benefit from it.

Today, dozens of operators use Oryno to reach new customers, and thousands of customers rely on Oryno for a smoother booking experience.`
  },
  {
    id: 'team',
    title: '3. The Team',
    icon: Users,
    content: `Oryno is built by a distributed team of engineers, designers, and operations specialists who care about the little details. We come from hospitality, fintech, and consumer product backgrounds.

Have a question or want to join us? Write to careers@oryno.cm.`
  },
  {
    id: 'values',
    title: '4. Our Values',
    icon: Handshake,
    content: `**Local first.** We build for local realities — MoMo/Orange payments, offline-friendly flows, French/English throughout.

**Operator trust.** Operators keep 100% control of their inventory, pricing, and customer relationships. We're their tool, not their competitor.

**Transparent pricing.** No hidden fees. No surprise charges. What you see at checkout is what you pay.

**Privacy by default.** Your data belongs to you. We never sell it. Read our Privacy Policy for the full details.`
  },
  {
    id: 'reach',
    title: '5. Where We Operate',
    icon: MapPin,
    content: `Oryno is available across Cameroon — Douala, Yaoundé, Bafoussam, Bamenda, Buea, Limbe, Kribi and beyond — with new cities joining every quarter. Expansion into neighbouring markets is on our 2026 roadmap.`
  },
  {
    id: 'contact',
    title: '6. Get in Touch',
    icon: Info,
    content: `**General enquiries:** hello@oryno.cm
**Customer support:** support@oryno.cm
**Operator partnerships:** partners@oryno.cm
**Press & media:** press@oryno.cm
**Careers:** careers@oryno.cm

Postal address is available in our Impressum page.`
  },
];

export default function About() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-2xl mb-4">
            <Info className="w-8 h-8 text-[#082c59]" />
          </div>
          <h1 className="text-4xl font-bold text-[#082c59] mb-2" data-testid="about-title">About Oryno</h1>
          <p className="text-slate-600">The story, the team, and what we're building.</p>
        </div>

        <Card className="mb-8">
          <CardContent className="p-6">
            <p className="text-gray-600 leading-relaxed">
              Oryno is a multi-service marketplace operated by <strong>Oryno Technology Ltd.</strong> — a Cameroon-registered technology company. This page tells you who we are, what we care about, and how to reach us.
            </p>
          </CardContent>
        </Card>

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
      </div>
    </div>
  );
}
