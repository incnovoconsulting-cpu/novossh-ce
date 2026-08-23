import { ArrowLeft } from '@/lib/icons';

export function TermsPage() {
  return (
    <div className="min-h-screen bg-ink-950 text-slate-200">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <a href="/" className="mb-8 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to NovoSSH
        </a>

        <h1 className="mt-6 text-3xl font-bold tracking-tight text-white">Terms of Service</h1>
        <p className="mt-2 text-sm text-slate-500">Effective Date: June 13, 2026</p>

        <div className="prose prose-invert mt-8 max-w-none space-y-6 text-[15px] leading-relaxed text-slate-300">
          <section>
            <h2 className="text-xl font-semibold text-white">1. Acceptance of Terms</h2>
            <p>
              By accessing or using NovoSSH ("the Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">2. Description of Service</h2>
            <p>
              NovoSSH provides an SSH terminal client and related tools for connecting to remote servers. The Service is available via web dashboard, macOS application, iOS application, Android application, and Windows application.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">3. User Accounts</h2>
            <p>You are responsible for:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>Maintaining the confidentiality of your account credentials</li>
              <li>All activity that occurs under your account</li>
              <li>Notifying us immediately of any unauthorized use of your account</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">4. Acceptable Use</h2>
            <p>You agree not to use the Service to:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>Access systems you are not authorized to access</li>
              <li>Engage in any activity that violates applicable laws or regulations</li>
              <li>Attempt to disrupt or compromise the security of any system</li>
              <li>Resell or commercially exploit the Service without prior written consent</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">5. Subscription and Billing</h2>
            <p>
              Paid plans are billed monthly or annually as selected. Free trial periods, where offered, automatically convert to paid subscriptions unless cancelled before the trial ends. You may cancel at any time; cancellation takes effect at the end of the current billing period.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">6. Data and Privacy</h2>
            <p>
              Your use of the Service is also governed by our <a href="/privacy" className="text-neon hover:text-neon/80 transition-colors">Privacy Policy</a>. Most SSH credentials and connection data are stored locally on your device and are not transmitted to our servers.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">7. Service Availability</h2>
            <p>
              We strive for high availability but do not guarantee uninterrupted access. We may modify, suspend, or discontinue the Service (or any part thereof) at any time with reasonable notice where practicable.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">8. Limitation of Liability</h2>
            <p>
              To the fullest extent permitted by law, NovoSSH shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising out of or related to your use of the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">9. Changes to Terms</h2>
            <p>
              We may update these Terms from time to time. We will notify you of material changes by email or via the Service. Continued use after such notice constitutes acceptance of the updated Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">10. Contact</h2>
            <p>
              For questions about these Terms, contact us at{' '}
              <a href="mailto:support@novossh.com" className="text-neon hover:text-neon/80 transition-colors">
                support@novossh.com
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

export default TermsPage;
