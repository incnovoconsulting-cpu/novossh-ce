import { FC } from 'react';
interface PerformanceAnalyticsData {
  metrics: Array<{
    teamId: string;
    sessionId?: string;
    totalRequests: number;
    avgResponseTimeMs?: number;
    p95ResponseTimeMs?: number;
    p99ResponseTimeMs?: number;
    commandsPerSecond?: number;
    bytesTransferred: number;
    requestSuccessRate?: number;
    errorRate?: number;
    connectionDropCount: number;
    avgTimeToReconnectMs?: number;
    measurementPeriodSeconds?: number;
    measuredAt: Date;
  }>;
  trends: {
    latencyTrend: 'improving' | 'degrading' | 'stable';
    throughputTrend: 'improving' | 'degrading' | 'stable';
    stabilityScore: number;
    avgLatencyMs: number;
    p95LatencyMs: number;
    commandsPerSec: number;
  };
}

interface Props {
  data: PerformanceAnalyticsData;
}

/**
 * Performance Trends Component
 * Displays latency, throughput, and reliability metrics
 */
export const PerformanceTrends: FC<Props> = ({ data }) => {
  const getTrendIcon = (trend: string): string => {
    switch (trend) {
      case 'improving':
        return '📈';
      case 'degrading':
        return '📉';
      case 'stable':
        return '➡️';
      default:
        return '•';
    }
  };

  const getTrendColor = (trend: string): string => {
    switch (trend) {
      case 'improving':
        return 'text-green-400';
      case 'degrading':
        return 'text-red-400';
      case 'stable':
        return 'text-yellow-400';
      default:
        return 'text-gray-400';
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const metrics = data.metrics && data.metrics.length > 0 ? data.metrics[0] : null;

  return (
    <div className="w-full">
      <h2 className="text-xl font-semibold mb-4">Performance Metrics</h2>

      {/* Trend Indicators */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="p-4 bg-gray-700 rounded-lg">
          <div className="text-sm text-gray-400 mb-2">Latency Trend</div>
          <div className={`flex items-center gap-2 text-lg font-semibold ${getTrendColor(data.trends.latencyTrend)}`}>
            {getTrendIcon(data.trends.latencyTrend)}
            <span className="capitalize">{data.trends.latencyTrend}</span>
          </div>
        </div>

        <div className="p-4 bg-gray-700 rounded-lg">
          <div className="text-sm text-gray-400 mb-2">Throughput Trend</div>
          <div className={`flex items-center gap-2 text-lg font-semibold ${getTrendColor(data.trends.throughputTrend)}`}>
            {getTrendIcon(data.trends.throughputTrend)}
            <span className="capitalize">{data.trends.throughputTrend}</span>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="space-y-3 mb-6">
        <div className="p-4 bg-gray-700 rounded-lg">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-400">Avg Latency</span>
            <span className="text-2xl font-bold text-blue-400">{data.trends.avgLatencyMs.toFixed(0)}ms</span>
          </div>
          <div className="w-full bg-gray-600 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all"
              style={{
                width: `${Math.min((data.trends.avgLatencyMs / 1000) * 100, 100)}%`,
              }}
            ></div>
          </div>
        </div>

        <div className="p-4 bg-gray-700 rounded-lg">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-400">P95 Latency</span>
            <span className="text-2xl font-bold text-purple-400">{data.trends.p95LatencyMs.toFixed(0)}ms</span>
          </div>
          <div className="w-full bg-gray-600 rounded-full h-2">
            <div
              className="bg-purple-500 h-2 rounded-full transition-all"
              style={{
                width: `${Math.min((data.trends.p95LatencyMs / 2000) * 100, 100)}%`,
              }}
            ></div>
          </div>
        </div>

        <div className="p-4 bg-gray-700 rounded-lg">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-400">Commands/Second</span>
            <span className="text-2xl font-bold text-green-400">{data.trends.commandsPerSec.toFixed(2)}</span>
          </div>
          <div className="w-full bg-gray-600 rounded-full h-2">
            <div
              className="bg-green-500 h-2 rounded-full transition-all"
              style={{
                width: `${Math.min((data.trends.commandsPerSec / 100) * 100, 100)}%`,
              }}
            ></div>
          </div>
        </div>

        <div className="p-4 bg-gray-700 rounded-lg">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-400">Stability Score</span>
            <span className="text-2xl font-bold text-orange-400">{(data.trends.stabilityScore * 100).toFixed(1)}%</span>
          </div>
          <div className="w-full bg-gray-600 rounded-full h-2 mt-2">
            <div
              className={`h-2 rounded-full transition-all ${
                data.trends.stabilityScore >= 0.95
                  ? 'bg-green-500'
                  : data.trends.stabilityScore >= 0.9
                    ? 'bg-yellow-500'
                    : 'bg-red-500'
              }`}
              style={{
                width: `${Math.min(data.trends.stabilityScore * 100, 100)}%`,
              }}
            ></div>
          </div>
        </div>
      </div>

      {/* Additional Details */}
      {metrics && (
        <div className="space-y-2 text-sm">
          <div className="flex justify-between items-center p-3 bg-gray-700 rounded-lg">
            <span className="text-gray-400">Total Requests</span>
            <span className="font-semibold">{metrics.totalRequests}</span>
          </div>
          <div className="flex justify-between items-center p-3 bg-gray-700 rounded-lg">
            <span className="text-gray-400">Data Transferred</span>
            <span className="font-semibold">{formatBytes(metrics.bytesTransferred)}</span>
          </div>
          {metrics.errorRate !== undefined && (
            <div className="flex justify-between items-center p-3 bg-gray-700 rounded-lg">
              <span className="text-gray-400">Error Rate</span>
              <span className={`font-semibold ${metrics.errorRate > 5 ? 'text-red-400' : 'text-green-400'}`}>
                {(metrics.errorRate * 100).toFixed(2)}%
              </span>
            </div>
          )}
          {metrics.requestSuccessRate !== undefined && (
            <div className="flex justify-between items-center p-3 bg-gray-700 rounded-lg">
              <span className="text-gray-400">Success Rate</span>
              <span className="font-semibold text-green-400">
                {(metrics.requestSuccessRate * 100).toFixed(1)}%
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PerformanceTrends;
