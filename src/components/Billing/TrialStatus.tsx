import { useTrialStatus } from '../../hooks/useTrialStatus';
import { useSubscription } from '../../hooks/useSubscription';

export function TrialStatus() {
  const trial = useTrialStatus();
  const subscription = useSubscription();

  if (trial.loading || !trial.isTrialing) {
    return null;
  }

  const isUrgent = trial.daysRemaining <= 1;
  const isWarning = trial.daysRemaining <= 3;

  return (
    <div className={`rounded-lg p-4 ${
      isUrgent
        ? 'bg-red-500/10 border border-red-500/30'
        : isWarning
        ? 'bg-amber-500/10 border border-amber-500/30'
        : 'bg-blue-500/10 border border-blue-500/30'
    }`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className={`text-sm font-semibold ${
            isUrgent ? 'text-red-400' : isWarning ? 'text-amber-400' : 'text-blue-400'
          }`}>
            {isUrgent
              ? 'Trial Expires Tomorrow'
              : trial.daysRemaining === 0
              ? 'Trial Expired'
              : `Trial Expires in ${trial.daysRemaining} Days`}
          </h3>
          <p className="text-xs text-zinc-400 mt-1">
            {trial.trialEnd && (
              <>
                Ends {trial.trialEnd.toLocaleDateString()} at{' '}
                {trial.trialEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </>
            )}
          </p>
        </div>
        <a
          href="/settings"
          className={`ml-4 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
            isUrgent
              ? 'bg-red-500 hover:bg-red-600 text-white'
              : isWarning
              ? 'bg-amber-500 hover:bg-amber-600 text-white'
              : 'bg-blue-500 hover:bg-blue-600 text-white'
          }`}
        >
          Upgrade Now
        </a>
      </div>

      {isWarning && (
        <p className="text-xs text-zinc-500 mt-2">
          After trial ends, your plan will be downgraded to Free. Upgrade now to keep full access.
        </p>
      )}
    </div>
  );
}
