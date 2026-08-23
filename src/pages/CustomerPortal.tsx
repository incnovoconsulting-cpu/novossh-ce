import { useState } from 'react';
import { PortalLayout, type PortalTab } from '../components/Portal/PortalLayout';
import { InvoicesPage } from './InvoicesPage';
import { PaymentMethodsPage } from './PaymentMethodsPage';
import { BillingSettings } from '../components/BillingSettings';

export function CustomerPortal() {
  const [activeTab, setActiveTab] = useState<PortalTab>('invoices');

  const renderTabContent = () => {
    switch (activeTab) {
      case 'invoices':
        return <InvoicesPage />;
      case 'payment-methods':
        return <PaymentMethodsPage />;
      case 'billing-settings':
        return <BillingSettings />;
      default:
        return null;
    }
  };

  return (
    <PortalLayout activeTab={activeTab} onTabChange={setActiveTab}>
      {renderTabContent()}
    </PortalLayout>
  );
}
