import { useMemo, FC } from 'react';

interface FeatureAdoptionData {
  metrics: Array<{
    featureName: string;
    featureCategory?: string;
    firstUsedAt: Date;
    lastUsedAt?: Date;
    usageCount: number;
    isActive: boolean;
    adoptionStage: 'discovery' | 'onboarding' | 'regular' | 'power_user';
  }>;
  timeline: Array<{
    date: Date;
    newAdoptions: number;
    activeFeatures: number;
    cumulativeAdoptions: number;
  }>;
  byStage: Record<string, number>;
}

interface Props {
  data: FeatureAdoptionData;
}

/**
 * Feature Adoption Component
 * Displays feature adoption timeline and adoption stages
 */
export const FeatureAdoption: FC<Props> = ({ data }) => {
  const topFeatures = useMemo(() => {
    return (data.metrics || []).slice(0, 8);
  }, [data.metrics]);

  const stages = [
    { key: 'discovery', label: 'Discovery', color: 'bg-blue-500' },
    { key: 'onboarding', label: 'Onboarding', color: 'bg-purple-500' },
    { key: 'regular', label: 'Regular', color: 'bg-green-500' },
    { key: 'power_user', label: 'Power User', color: 'bg-orange-500' },
  ];

  const getAdoptionStageIcon = (stage: string): string => {
    switch (stage) {
      case 'discovery':
        return '🔍';
      case 'onboarding':
        return '📚';
      case 'regular':
        return '✓';
      case 'power_user':
        return '⚡';
      default:
        return '•';
    }
  };

  const getTrendlinePoints = (): Array<{ x: number; y: number }> => {
    if (!data.timeline || data.timeline.length === 0) return [];
    return data.timeline.map((point, idx) => ({
      x: (idx / Math.max(data.timeline.length - 1, 1)) * 100,
      y: ((point.cumulativeAdoptions || 0) / Math.max(
        Math.max(...data.timeline.map(p => p.cumulativeAdoptions || 0)),
        1
      )) * 100,
    }));
  };

  const points = getTrendlinePoints();
  const svgPath = points.length > 0
    ? `M ${points.map(p => `${p.x},${100 - p.y}`).join(' L ')}`
    : '';

  return (
    <div className="w-full">
      <h2 className="text-xl font-semibold mb-4">Feature Adoption</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Adoption Timeline Chart */}
        <div>
          <h3 className="text-sm font-semibold mb-3 text-gray-300">Adoption Timeline</h3>
          {data.timeline && data.timeline.length > 0 ? (
            <div className="bg-gray-700 rounded-lg p-4 aspect-video relative">
              <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                {/* Grid lines */}
                <line x1="0" y1="25" x2="100" y2="25" stroke="rgba(107, 114, 128, 0.3)" strokeWidth="0.5" />
                <line x1="0" y1="50" x2="100" y2="50" stroke="rgba(107, 114, 128, 0.3)" strokeWidth="0.5" />
                <line x1="0" y1="75" x2="100" y2="75" stroke="rgba(107, 114, 128, 0.3)" strokeWidth="0.5" />

                {/* Trend line */}
                {svgPath && (
                  <path
                    d={svgPath}
                    stroke="rgb(59, 130, 246)"
                    strokeWidth="2"
                    fill="none"
                    vectorEffect="non-scaling-stroke"
                  />
                )}

                {/* Data points */}
                {points.map((point, idx) => (
                  <circle
                    key={idx}
                    cx={point.x}
                    cy={100 - point.y}
                    r="1.5"
                    fill="rgb(34, 197, 94)"
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
              </svg>
              <div className="absolute inset-0 flex items-end justify-between px-4 pb-2 pointer-events-none text-xs text-gray-500">
                <span>Start</span>
                <span>Present</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400">No timeline data available</p>
          )}
        </div>

        {/* Adoption Stage Distribution */}
        <div>
          <h3 className="text-sm font-semibold mb-3 text-gray-300">Adoption by Stage</h3>
          <div className="space-y-3">
            {stages.map(stage => {
              const count = data.byStage?.[stage.key] || 0;
              const total = Object.values(data.byStage || {}).reduce((a: number, b: any) => a + (b || 0), 0);
              const percentage = total > 0 ? (count / total) * 100 : 0;

              return (
                <div key={stage.key}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm text-gray-300 flex items-center gap-2">
                      <span>{getAdoptionStageIcon(stage.key)}</span>
                      {stage.label}
                    </span>
                    <span className="text-sm font-semibold text-gray-400">{count}</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div
                      className={`${stage.color} h-2 rounded-full transition-all`}
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Features */}
        <div className="lg:col-span-2">
          <h3 className="text-sm font-semibold mb-3 text-gray-300">Most Adopted Features</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-48 overflow-y-auto">
            {topFeatures.length > 0 ? (
              topFeatures.map((feature, idx) => (
                <div key={idx} className="p-3 bg-gray-700 rounded-lg border border-gray-600">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">{feature.featureName}</p>
                      <p className="text-xs text-gray-400">{feature.featureCategory || 'General'}</p>
                    </div>
                    <span className="text-xs px-2 py-1 rounded bg-gray-600 text-gray-300 ml-2 whitespace-nowrap">
                      {getAdoptionStageIcon(feature.adoptionStage)} {feature.adoptionStage}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>Used {feature.usageCount} times</span>
                    <span className={feature.isActive ? 'text-green-400' : 'text-gray-500'}>
                      {feature.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-400 col-span-2">No feature adoption data available</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeatureAdoption;
