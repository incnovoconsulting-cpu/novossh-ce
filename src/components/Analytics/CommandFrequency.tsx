import { useMemo, FC } from 'react';

interface CommandAnalyticsData {
  topCommands: Array<{
    commandPattern: string;
    commandCategory?: string;
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    successRate?: number;
    avgExecutionMs?: number;
  }>;
  successAnalysis: {
    totalCommands: number;
    successfulCommands: number;
    failedCommands: number;
    successRate: number;
  };
  executionDistribution: {
    fast: number;
    normal: number;
    slow: number;
    verySlowCount: number;
    avgMs: number;
  };
  byCategory?: Array<{
    category: string;
    totalCommands: number;
    successRate: number;
    avgExecutionMs: number;
  }>;
}

interface Props {
  data: CommandAnalyticsData;
}

/**
 * Command Frequency Component
 * Displays top commands, success rates, and execution time distribution
 */
export const CommandFrequency: FC<Props> = ({ data }) => {
  const topFiveCommands = useMemo(() => {
    return (data.topCommands || []).slice(0, 5);
  }, [data.topCommands]);

  const getSuccessColor = (rate: number): string => {
    if (rate >= 95) return 'text-green-400';
    if (rate >= 80) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getCommandName = (pattern: string): string => {
    return pattern.split(' ')[0].substring(0, 15);
  };

  return (
    <div className="w-full">
      <h2 className="text-xl font-semibold mb-4">Command Analytics</h2>

      {/* Overall Success Rate */}
      <div className="mb-6 p-4 bg-gray-700 rounded-lg">
        <div className="text-sm text-gray-400 mb-2">Overall Success Rate</div>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl font-bold text-green-400">
                {(data.successAnalysis.successRate || 0).toFixed(1)}%
              </span>
              <span className="text-xs text-gray-500">
                {data.successAnalysis.successfulCommands} / {data.successAnalysis.totalCommands}
              </span>
            </div>
            <div className="w-full bg-gray-600 rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all"
                style={{ width: `${Math.min(data.successAnalysis.successRate || 0, 100)}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Execution Time Distribution */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold mb-3 text-gray-300">Execution Time Distribution</h3>
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="text-xs w-20 text-gray-400">Fast (&lt;100ms)</span>
            <div className="flex-1 bg-gray-700 rounded h-2">
              <div
                className="bg-green-500 h-2 rounded transition-all"
                style={{
                  width: `${(data.executionDistribution.fast / Math.max(
                    data.executionDistribution.fast +
                    data.executionDistribution.normal +
                    data.executionDistribution.slow +
                    data.executionDistribution.verySlowCount,
                    1
                  )) * 100}%`,
                }}
              ></div>
            </div>
            <span className="text-xs w-12 text-right text-gray-400">{data.executionDistribution.fast}</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs w-20 text-gray-400">Normal (100-500ms)</span>
            <div className="flex-1 bg-gray-700 rounded h-2">
              <div
                className="bg-blue-500 h-2 rounded transition-all"
                style={{
                  width: `${(data.executionDistribution.normal / Math.max(
                    data.executionDistribution.fast +
                    data.executionDistribution.normal +
                    data.executionDistribution.slow +
                    data.executionDistribution.verySlowCount,
                    1
                  )) * 100}%`,
                }}
              ></div>
            </div>
            <span className="text-xs w-12 text-right text-gray-400">{data.executionDistribution.normal}</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs w-20 text-gray-400">Slow (500ms-2s)</span>
            <div className="flex-1 bg-gray-700 rounded h-2">
              <div
                className="bg-yellow-500 h-2 rounded transition-all"
                style={{
                  width: `${(data.executionDistribution.slow / Math.max(
                    data.executionDistribution.fast +
                    data.executionDistribution.normal +
                    data.executionDistribution.slow +
                    data.executionDistribution.verySlowCount,
                    1
                  )) * 100}%`,
                }}
              ></div>
            </div>
            <span className="text-xs w-12 text-right text-gray-400">{data.executionDistribution.slow}</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs w-20 text-gray-400">Very Slow (&gt;2s)</span>
            <div className="flex-1 bg-gray-700 rounded h-2">
              <div
                className="bg-red-500 h-2 rounded transition-all"
                style={{
                  width: `${(data.executionDistribution.verySlowCount / Math.max(
                    data.executionDistribution.fast +
                    data.executionDistribution.normal +
                    data.executionDistribution.slow +
                    data.executionDistribution.verySlowCount,
                    1
                  )) * 100}%`,
                }}
              ></div>
            </div>
            <span className="text-xs w-12 text-right text-gray-400">{data.executionDistribution.verySlowCount}</span>
          </div>

          <div className="text-xs text-gray-500 mt-2">Avg: {data.executionDistribution.avgMs.toFixed(0)}ms</div>
        </div>
      </div>

      {/* Top Commands */}
      <div>
        <h3 className="text-sm font-semibold mb-3 text-gray-300">Top Commands</h3>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {topFiveCommands.length > 0 ? (
            topFiveCommands.map((cmd, idx) => (
              <div key={idx} className="p-3 bg-gray-700 rounded-lg border border-gray-600">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{getCommandName(cmd.commandPattern)}</p>
                    <p className="text-xs text-gray-400 truncate">{cmd.commandPattern}</p>
                  </div>
                  <span className={`text-sm font-bold ml-2 whitespace-nowrap ${getSuccessColor(cmd.successRate || 0)}`}>
                    {(cmd.successRate || 0).toFixed(0)}%
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-gray-400">Executions: {cmd.totalExecutions}</span>
                  <span className="text-gray-400">Avg: {(cmd.avgExecutionMs || 0).toFixed(0)}ms</span>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-400">No command data available</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default CommandFrequency;
