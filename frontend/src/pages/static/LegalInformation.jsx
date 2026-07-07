import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Scale, FileText, Shield, AlertTriangle, Gavel, Handshake } from 'lucide-react';

const SECTIONS = [
  {
    id: 'terms-of-use',
    title: '1. Terms of Use Summary',
    icon: FileText,
    content: `By using the Oryno platform, you agree to be bound by our full Terms & Conditions and this Legal Information notice. This summary is provided for convenience and does not replace the binding documents.

The Terms & Conditions cover: eligibility, account creation, acceptable use, booking flow, payments, cancellations, refunds, dispute resolution, and termination.

Our Privacy Policy covers: what personal data we collect, how we process it, your rights under Cameroon Law No. 2010/012 and (where applicable) the GDPR, and how to exercise those rights.`
  },
  {
    id: 'compliance',
    title: '2. Regulatory Compliance',
    icon: Shield,
    content: `**Cameroon**
- Law No. 2010/021 of 21 December 2010 governing electronic commerce
- Law No. 2010/012 of 21 December 2010 on cybersecurity and cybercrime (data protection)
- CEMAC Regulation No. 02/03-CEMAC-UMAC-CM on electronic payments

**International**
- PCI DSS Level 1 (payments handled via Stripe, a certified PCI DSS Level 1 provider)
- General Data Protection Regulation (GDPR) — where the customer is an EU/EEA resident
- OECD Model Convention on personal data protection

**Payment operators (regulated in Cameroon)**
- MTN Cameroon Mobile Money (MoMo) — regulated by BEAC
- Orange Cameroon (Orange Money) — regulated by BEAC
- Stripe Payments Europe Ltd. — regulated by the Central Bank of Ireland`
  },
  {
    id: 'operator-tos',
    title: '3. Operator Terms',
    icon: Handshake,
    content: `Operators (hotels, cinemas, event venues, restaurants, transport companies, etc.) who list on Oryno agree to a separate Operator Agreement, available upon request from partners@oryno.cm.

Operators warrant that:
- They hold all required business licences, safety certifications, and insurance
- The content they publish (photos, descriptions, prices) is accurate
- They will honour every confirmed booking placed through Oryno
- They comply with local tax and consumer-protection laws

Oryno acts as a technology intermediary and is not the direct provider of the underlying services. Complaints about the underlying service should be addressed to the operator first; Oryno provides support and mediation.`
  },
  {
    id: 'liability',
    title: '4. Liability & Warranty',
    icon: AlertTriangle,
    content: `**No warranty on operator content.** Oryno does not verify individual operator claims about their services beyond periodic quality-assurance reviews. We rely on operators to publish accurate information.

**Limitation of liability.** To the maximum extent permitted by Cameroon law, Oryno's total liability for any claim arising from the use of the platform is capped at the total amount paid by the customer to Oryno in the 12 months preceding the claim.

**Force majeure.** Oryno is not liable for delays or failures caused by events beyond its reasonable control — including but not limited to internet outages, mobile-network failures, natural disasters, government action, or third-party payment-provider downtime.

**Consumer rights preserved.** Nothing in these terms limits or excludes any rights that cannot be limited or excluded under applicable consumer-protection law.`
  },
  {
    id: 'ip',
    title: '5. Intellectual Property',
    icon: Scale,
    content: `The "Oryno" name, logo, colour palette, and all platform code are trademarks and copyrighted works of Oryno Technology Ltd.

Third-party trademarks appearing on the platform (e.g. MTN, Orange, Stripe, Visa, Mastercard) are the property of their respective owners and are used solely to indicate the availability of those services.

Operator-supplied content remains the intellectual property of the operator. By publishing content on Oryno, operators grant us a non-exclusive licence to display it on the platform and in related marketing materials.

To report copyright infringement, please email legal@oryno.cm with the details required under our DMCA-style takedown procedure (attached to any request as an auto-reply).`
  },
  {
    id: 'jurisdiction',
    title: '6. Governing Law & Jurisdiction',
    icon: Gavel,
    content: `These terms are governed by the laws of the Republic of Cameroon.

Disputes will first be addressed through good-faith negotiation. If unresolved after 30 days, either party may refer the matter to:

- **Tribunal de Première Instance de Douala-Bonanjo** for customer disputes below XAF 5,000,000
- **Tribunal de Grande Instance du Wouri** for disputes above that threshold
- **CCJA (OHADA arbitration)** for commercial disputes between Oryno and an operator, at the option of the operator

Customers residing in the EU may also invoke consumer-protection venues in their country of residence, where those rights apply.`
  },
];

export default function LegalInformation() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-2xl mb-4">
            <Scale className="w-8 h-8 text-[#082c59]" />
          </div>
          <h1 className="text-4xl font-bold text-[#082c59] mb-2" data-testid="legal-info-title">Legal Information</h1>
          <p className="text-slate-600">Terms, compliance, and how disputes are handled.</p>
        </div>

        <Card className="mb-8">
          <CardContent className="p-6">
            <h2 className="font-semibold mb-4">Table of Contents</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {SECTIONS.map((s) => (
                <a key={s.id} href={`#${s.id}`} className="text-[#082c59] hover:underline text-sm">{s.title}</a>
              ))}
            </div>
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
                  {section.content.split('\n').map((p, idx) => (
                    <p key={idx} className="text-gray-600 mb-3 whitespace-pre-line">{p}</p>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <p className="text-center text-xs text-slate-500 mt-8">
          For the binding legal documents, see also our{' '}
          <a href="/terms" className="text-[#082c59] underline">Terms & Conditions</a>,{' '}
          <a href="/privacy" className="text-[#082c59] underline">Privacy Policy</a> and{' '}
          <a href="/impressum" className="text-[#082c59] underline">Impressum</a>.
        </p>
      </div>
    </div>
  );
}
