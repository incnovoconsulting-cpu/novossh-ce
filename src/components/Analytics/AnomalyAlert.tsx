import { FC } from 'react';
interface Anomaly {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  context?: string;
  affectedUsers?: number;
  suggestedAction?: string;
}

interface Props {
  anomaly: Anomaly;
  onResolve?: (anomalyId: string) => void;
}

/**
 * Anomaly Alert Component
 * Real-time anomaly notification with severity levels
 */
export const AnomalyAlert: FC<Props> = ({ anomaly, onResolve }) => {
  const getSeverityStyles = (
    severity: string
  ): { bgColor: string; borderColor: string; textColor: string; iconColor: string } => {
    switch (severity) {
      case 'critical':
        return {
          bgColor: 'bg-red-900/20',
          borderColor: 'border-red-600',
          textColor: 'text-red-400',
          iconColor: '🔴',
        };
      case 'high':
        return {
          bgColor: 'bg-orange-900/20',
          borderColor: 'border-orange-600',
          textColor: 'text-orange-400',
          iconColor: '🟠',
        };
      case 'medium':
        return {
          bgColor: 'bg-yellow-900/20',
          borderColor: 'border-yellow-600',
          textColor: 'text-yellow-400',
          iconColor: '🟡',
        };
      case 'low':
      default:
        return {
          bgColor: 'bg-blue-900/20',
          borderColor: 'border-blue-600',
          textColor: 'text-blue-400',
          iconColor: '🔵',
        };
    }
  };

  const styles = getSeverityStyles(anomaly.severity);

  return (
    <div className={`${styles.bgColor} border ${styles.borderColor} rounded-lg p-4 transition-all hover:shadow-lg`}>
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="text-lg mt-0.5">{styles.iconColor}</div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className={`font-semibold text-sm ${styles.textColor} capitalize`}>{anomaly.type}</h3>
              <p className="text-xs text-gray-400 mt-1">{anomaly.description}</p>
            </div>
            <span className={`${styles.textColor} text-xs font-semibold whitespace-nowrap ml-2 capitalize`}>
              {anomaly.severity}
            </span>
          </div>

          {/* Details */}
          {(anomaly.context || anomaly.affectedUsers) && (
            <div className="mt-2 space-y-1 text-xs text-gray-400">
              {anomaly.context && (
                <p>
                  <span className="text-gray-500">Context:</span> {anomaly.context}
                </p>
              )}
              {anomaly.affectedUsers && (
                <p>
                  <span className="text-gray-500">Affected Users:</span> {anomaly.affectedUsers}
                </p>
              )}
            </div>
          )}

          {/* Suggested Action */}
          {anomaly.suggestedAction && (
            <div className="mt-3 p-2 bg-gray-700/50 rounded border border-gray-600">
              <p className="text-xs">
                <span className="font-semibold text-gray-300">Action:</span>{' '}
                <span className="text-gray-400">{anomaly.suggestedAction}</span>
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        {onResolve && (
          <button
            onClick={() => onResolve(anomaly.id)}
            className="mt-1 px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded transition-colors text-gray-300 whitespace-nowrap"
          >
            Resolve
          </button>
        )}
      </div>
    </div>
  );
};

export default AnomalyAlert;
