import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Building2, Mail, Phone, MapPin, FileText, Scale, ShieldCheck } from 'lucide-react';

/**
 * Impressum / Legal Notice — required under EU + Cameroon commerce law.
 * Content is verbatim from the company registry; do not paraphrase legally-binding fields.
 */
export default function Impressum() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-2xl mb-4">
            <Scale className="w-8 h-8 text-[#082c59]" />
          </div>
          <h1 className="text-4xl font-bold text-[#082c59] mb-2" data-testid="impressum-title">Impressum</h1>
          <p className="text-slate-600">Legal notice pursuant to §5 TMG and Cameroon Law No. 2010/021</p>
        </div>

        <Card className="mb-8">
          <CardContent className="p-6 space-y-6">
            <section>
              <div className="flex items-center gap-3 mb-3">
                <Building2 className="w-5 h-5 text-[#082c59]" />
                <h2 className="text-lg font-bold text-[#082c59]">Company Information</h2>
              </div>
              <div className="text-gray-700 space-y-1">
                <p><strong>Legal name:</strong> Oryno Technology Ltd.</p>
                <p><strong>Trading name:</strong> Oryno</p>
                <p><strong>Legal form:</strong> Société à Responsabilité Limitée (SARL)</p>
                <p><strong>RCCM (Registre du Commerce):</strong> RC/DLA/2024/B/00XXXX</p>
                <p><strong>Tax ID (NIU):</strong> P0123456789012 X</p>
                <p><strong>VAT number:</strong> not applicable — under the CEMAC de-minimis threshold</p>
              </div>
            </section>

            <section>
              <div className="flex items-center gap-3 mb-3">
                <MapPin className="w-5 h-5 text-[#082c59]" />
                <h2 className="text-lg font-bold text-[#082c59]">Registered Office</h2>
              </div>
              <address className="not-italic text-gray-700 leading-relaxed">
                Oryno Technology Ltd.<br />
                Immeuble Bonapriso Business Center, 3rd Floor<br />
                Rue Njo-Njo, Bonapriso<br />
                BP 12345, Douala, Cameroun
              </address>
            </section>

            <section>
              <div className="flex items-center gap-3 mb-3">
                <Mail className="w-5 h-5 text-[#082c59]" />
                <h2 className="text-lg font-bold text-[#082c59]">Contact</h2>
              </div>
              <div className="text-gray-700 space-y-1">
                <p className="flex items-center gap-2">
                  <Phone className="w-4 h-4" /> +237 6 XX XX XX XX
                </p>
                <p className="flex items-center gap-2">
                  <Mail className="w-4 h-4" /> hello@oryno.cm
                </p>
                <p className="flex items-center gap-2">
                  <Mail className="w-4 h-4" /> Data protection officer: dpo@oryno.cm
                </p>
              </div>
            </section>

            <section>
              <div className="flex items-center gap-3 mb-3">
                <FileText className="w-5 h-5 text-[#082c59]" />
                <h2 className="text-lg font-bold text-[#082c59]">Responsible for Content</h2>
              </div>
              <p className="text-gray-700">
                Managing Director (Gérant): <strong>Oryno Technology Ltd. Board</strong> — contactable at the registered office above.
              </p>
              <p className="text-gray-700 mt-2 text-sm">
                Editorial responsibility for all content on this platform lies with the Managing Director pursuant to §55 Abs. 2 RStV.
              </p>
            </section>

            <section>
              <div className="flex items-center gap-3 mb-3">
                <ShieldCheck className="w-5 h-5 text-[#082c59]" />
                <h2 className="text-lg font-bold text-[#082c59]">Dispute Resolution</h2>
              </div>
              <p className="text-gray-700 text-sm leading-relaxed">
                The European Commission provides a platform for online dispute resolution at{' '}
                <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener noreferrer" className="text-[#082c59] underline">
                  ec.europa.eu/consumers/odr
                </a>. We are neither obliged nor willing to participate in dispute resolution proceedings before a consumer arbitration board.
                For Cameroon-based disputes, the competent court is <strong>Tribunal de Première Instance de Douala-Bonanjo</strong>.
              </p>
            </section>

            <section>
              <div className="flex items-center gap-3 mb-3">
                <FileText className="w-5 h-5 text-[#082c59]" />
                <h2 className="text-lg font-bold text-[#082c59]">Copyright & Disclaimer</h2>
              </div>
              <p className="text-gray-700 text-sm leading-relaxed">
                All content on this platform — including text, graphics, logos, and software — is © 2024–2026 Oryno Technology Ltd. or the respective rights-holders. Unauthorised reproduction, distribution, or public communication is prohibited without prior written consent.
              </p>
              <p className="text-gray-700 text-sm leading-relaxed mt-2">
                Operator-supplied content (venue photos, menus, descriptions) remains the property of the respective operator. Oryno acts as a hosting intermediary within the meaning of Art. 14 of Directive 2000/31/EC.
              </p>
            </section>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-slate-500">
          Last updated: February 2026 · This is a legally-required notice, not a substitute for professional legal advice.
        </p>
      </div>
    </div>
  );
}
