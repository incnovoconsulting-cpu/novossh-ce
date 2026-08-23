import { useEffect, useState, FC } from 'react';
import { getAnalyticsApi } from '../../lib/analyticsApi';

interface HeatmapData {
  hourOfDay: number;
  dayOfWeek: number;
  sessionCount: number;
  commandCount: number;
  totalDurationSeconds: number;
}

interface Props {
  teamId: string;
  userId?: string;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * User Activity Heatmap Component
 * Displays 24-hour activity patterns across days of week
 */
export const UserActivityHeatmap: FC<Props> = ({ teamId, userId }) => {
  const [data, setData] = useState<HeatmapData[]>([]);
  const [loading, setLoading] = useState(true);
  const [maxValue, setMaxValue] = useState(0);

  useEffect(() => {
    const fetchHeatmap = async () => {
      try {
        setLoading(true);
        const analyticsApi = getAnalyticsApi();
        const heatmapData = await analyticsApi.getUserActivityHeatmap(teamId, userId);
        setData(heatmapData);

        // Calculate max value for color scaling
        const max = Math.max(...heatmapData.map(d => d.sessionCount), 1);
        setMaxValue(max);
      } catch (err) {
        console.error('Failed to fetch heatmap:', err);
      } finally {
        setLoading(false);
      }
    };

    if (teamId) {
      fetchHeatmap();
    }
  }, [teamId, userId]);

  const getIntensity = (count: number): number => {
    if (maxValue === 0) return 0;
    return count / maxValue;
  };

  const getColor = (intensity: number): string => {
    if (intensity === 0) return 'bg-gray-700';
    if (intensity < 0.25) return 'bg-blue-900';
    if (intensity < 0.5) return 'bg-blue-700';
    if (intensity < 0.75) return 'bg-blue-500';
    return 'bg-blue-400';
  };

  const cellData: Record<number, Record<number, HeatmapData | null>> = {};
  for (let day = 0; day < 7; day++) {
    cellData[day] = {};
    for (let hour = 0; hour < 24; hour++) {
      cellData[day][hour] = null;
    }
  }

  data.forEach(d => {
    cellData[d.dayOfWeek][d.hourOfDay] = d;
  });

  return (
    <div className="w-full">
      <h2 className="text-xl font-semibold mb-4">24-Hour Activity Heatmap</h2>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          {/* Hour labels */}
          <div className="flex">
            <div className="w-16"></div>
            <div className="flex gap-0.5">
              {Array.from({ length: 24 }).map((_, hour) => (
                <div
                  key={`hour-${hour}`}
                  className="w-8 text-xs text-center text-gray-400"
                  title={`${hour}:00`}
                >
                  {hour % 6 === 0 ? hour : ''}
                </div>
              ))}
            </div>
          </div>

          {/* Heatmap grid */}
          <div className="space-y-1">
            {DAYS.map((day, dayIdx) => (
              <div key={`day-${dayIdx}`} className="flex items-center gap-2">
                <div className="w-16 text-sm font-medium text-gray-300">{day}</div>
                <div className="flex gap-0.5">
                  {Array.from({ length: 24 }).map((_, hour) => {
                    const cell = cellData[dayIdx]?.[hour];
                    const intensity = cell ? getIntensity(cell.sessionCount) : 0;
                    const color = getColor(intensity);

                    return (
                      <div
                        key={`${dayIdx}-${hour}`}
                        className={`w-8 h-8 rounded ${color} transition-colors hover:ring-2 hover:ring-blue-300 cursor-pointer`}
                        title={
                          cell
                            ? `${day} ${hour}:00 - ${cell.sessionCount} sessions, ${cell.commandCount} commands`
                            : `${day} ${hour}:00 - No activity`
                        }
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="mt-4 flex items-center gap-4 text-xs text-gray-400">
            <span>Less</span>
            <div className="flex gap-1">
              {['bg-gray-700', 'bg-blue-900', 'bg-blue-700', 'bg-blue-500', 'bg-blue-400'].map((color) => (
                <div key={color} className={`w-4 h-4 rounded ${color}`}></div>
              ))}
            </div>
            <span>More</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserActivityHeatmap;
