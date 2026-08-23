import { FC } from 'react';
import { useAnalytics } from '../../hooks/useAnalytics';
import AnalyticsDashboard from '../Analytics/AnalyticsDashboard';
import { PaywallGate } from '../PaywallGate';

const AnalyticsView: FC = () => {
  const {
    overview,
    hostUsage,
    loading,
    error,
    period,
    setPeriod,
    refresh,
    exportCsv,
  } = useAnalytics(30);

  return (
    <PaywallGate feature="analytics">
      <div className="flex flex-col h-full bg-ink-950 text-slate-100 p-6 overflow-auto">
        <AnalyticsDashboard
          overview={overview}
          hostUsage={hostUsage}
          period={period}
          onPeriodChange={setPeriod}
          onRefresh={refresh}
          onExport={exportCsv}
          loading={loading}
          error={error}
        />
      </div>
    </PaywallGate>
  );
};

export default AnalyticsView;
