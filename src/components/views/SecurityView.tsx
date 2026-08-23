import { useState } from 'react';
import { Shield, KeyRound } from '@/lib/icons';
import { MFASetup } from '../Settings/MFASetup';
import { SAMLConfig } from '../Settings/SAMLConfig';
import { SAMLProviderList } from '../Settings/SAMLProviderList';
import clsx from 'clsx';

type SecurityTab = 'mfa' | 'saml-providers' | 'saml-config';

export function SecurityView() {
  const [tab, setTab] = useState<SecurityTab>('mfa');

  return (
    <div className="h-full overflow-y-auto">
      <div className="flex h-full">
        <div className="w-48 flex-shrink-0 border-r border-white/[0.04] bg-ink-900/50 p-3">
          <div className="mb-4 flex items-center gap-2 px-2">
            <Shield className="h-4 w-4 text-slate-400" />
            <span className="text-sm font-semibold text-slate-200">Security</span>
          </div>
          <nav className="space-y-0.5">
            {([
              { key: 'mfa' as const, label: 'MFA', icon: Shield },
              { key: 'saml-providers' as const, label: 'SAML Providers', icon: KeyRound },
              { key: 'saml-config' as const, label: 'SSO Config', icon: KeyRound },
            ]).map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.key}
                  onClick={() => setTab(item.key)}
                  className={clsx(
                    'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
                    tab === item.key
                      ? 'bg-white/5 text-slate-100'
                      : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="flex-1 overflow-y-auto px-8 py-8">
          {tab === 'mfa' && <MFASetup />}
          {tab === 'saml-providers' && <SAMLProviderList />}
          {tab === 'saml-config' && <SAMLConfig />}
        </div>
      </div>
    </div>
  );
}
