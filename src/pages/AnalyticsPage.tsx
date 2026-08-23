import { useAnalytics } from '../hooks/useAnalytics';
import AnalyticsDashboard from '../components/Analytics/AnalyticsDashboard';

export function AnalyticsPage() {
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
    <div className="min-h-screen bg-gray-50 p-6">
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
  );
}
