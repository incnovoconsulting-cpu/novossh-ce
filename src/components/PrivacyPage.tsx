import { ArrowLeft } from '@/lib/icons';

export function PrivacyPage() {
  return (
    <div className="min-h-screen bg-ink-950 text-slate-200">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <a href="/" className="mb-8 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to NovoSSH
        </a>

        <h1 className="mt-6 text-3xl font-bold tracking-tight text-white">Privacy Policy</h1>
        <p className="mt-2 text-sm text-slate-500">Effective Date: June 13, 2026</p>

        <div className="prose prose-invert mt-8 max-w-none space-y-6 text-[15px] leading-relaxed text-slate-300">
          <section>
            <h2 className="text-xl font-semibold text-white">Overview</h2>
            <p>
              NovoSSH is a privacy-first SSH terminal client available on web, macOS, iOS, Android, and Windows. We believe your data is yours, and we're transparent about how we handle it.
            </p>
            <p className="text-neon font-medium">
              Most importantly: All data is stored locally on your device. We don't have access to your SSH credentials, connection history, or any other data you store in NovoSSH.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">What Data We Collect and Store</h2>
            <h3 className="text-lg font-medium text-white mt-4">On Your Device (Encrypted)</h3>
            <p>When you use NovoSSH, the following data is stored <strong>locally on your device</strong> in an encrypted database:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li><strong>SSH Connection Details</strong> — Hostnames, IP addresses, port numbers, usernames, authentication methods, SSH private keys</li>
              <li><strong>Terminal History</strong> — Command history for each connection, session duration and timestamps</li>
              <li><strong>Snippets & Configuration</strong> — Command snippets, user preferences, biometric lock settings, port forwarding rules</li>
            </ul>

            <h3 className="text-lg font-medium text-white mt-4">Encryption</h3>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>All sensitive data is encrypted using <strong>AES-256</strong> (EncryptedSharedPreferences)</li>
              <li>SSH private keys are double-encrypted: first by JSch library, then by EncryptedSharedPreferences</li>
              <li>Encryption keys are stored securely using Android's Keystore system</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">What We Don't Do</h2>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>✅ <strong>No Cloud Syncing</strong> — SSH data stays on your device</li>
              <li>✅ <strong>No Crash Reporting</strong> — We don't collect automatic crash dumps</li>
              <li>✅ <strong>No Ads</strong> — We don't display advertisements</li>
              <li>✅ <strong>No Data Selling</strong> — Your data is never sold to third parties</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">Internet Connection</h2>
            <p>
              NovoSSH requires <strong>INTERNET</strong> permission to establish SSH connections to remote servers and transfer files via SFTP.
            </p>
            <p className="mt-2">
              <strong>The app does not transmit any of your stored data to our servers.</strong> It only connects directly to SSH servers you explicitly choose.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">Android Permissions</h2>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="py-2 text-left text-white">Permission</th>
                    <th className="py-2 text-left text-white">Why We Need It</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-white/5">
                    <td className="py-2 font-mono text-neon">INTERNET</td>
                    <td className="py-2">SSH connections to remote servers</td>
                  </tr>
                  <tr className="border-b border-white/5">
                    <td className="py-2 font-mono text-neon">USE_BIOMETRIC</td>
                    <td className="py-2">Fingerprint lock (optional)</td>
                  </tr>
                  <tr>
                    <td className="py-2 font-mono text-neon">USE_FINGERPRINT</td>
                    <td className="py-2">Legacy biometric support</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">Data Retention</h2>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li><strong>Your Control</strong>: You control when data is deleted</li>
              <li><strong>On Uninstall</strong>: All data is deleted when you uninstall the app</li>
              <li><strong>No Backup</strong>: We don't backup your data to cloud services</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">Third-Party Libraries</h2>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li><strong>JSch</strong>: SSH protocol implementation</li>
              <li><strong>AndroidX</strong>: Google's Android libraries</li>
              <li><strong>Jetpack Compose</strong>: Modern UI toolkit</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">Contact Us</h2>
            <p>Questions about privacy?</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li><strong>Email</strong>: privacy@novossh.com</li>
              <li><strong>Website</strong>: https://novossh.com</li>
              <li><strong>Support</strong>: support@novossh.com</li>
            </ul>
          </section>

          <section className="border-t border-white/10 pt-6 mt-8">
            <p className="text-sm text-slate-500">
              This Privacy Policy was last updated on June 13, 2026. Thank you for trusting NovoSSH with your SSH connections.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
export default PrivacyPage;
