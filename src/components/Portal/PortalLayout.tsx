import { PortalTab } from '../../lib/types';

interface PortalLayoutProps {
  children: React.ReactNode;
  title?: string;
  activeTab?: PortalTab;
  onTabChange?: (tab: PortalTab) => void;
}

export function PortalLayout({ children, title, activeTab, onTabChange }: PortalLayoutProps) {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {title && (
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">{title}</h1>
        </div>
      )}

      {activeTab && onTabChange && (
        <div className="mb-8 border-b border-gray-700">
          <nav className="flex space-x-8">
            <button
              onClick={() => onTabChange('invoices')}
              className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                activeTab === 'invoices'
                  ? 'border-neon text-neon-400'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              Invoices
            </button>
            <button
              onClick={() => onTabChange('payment-methods')}
              className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                activeTab === 'payment-methods'
                  ? 'border-neon text-neon-400'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              Payment Methods
            </button>
            <button
              onClick={() => onTabChange('billing-settings')}
              className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                activeTab === 'billing-settings'
                  ? 'border-neon text-neon-400'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              Billing Settings
            </button>
          </nav>
        </div>
      )}

      <div className="grid grid-cols-1 gap-8">
        {children}
      </div>
    </div>
  );
}

export type { PortalTab };
