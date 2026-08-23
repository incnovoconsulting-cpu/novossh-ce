import { useEffect, ReactNode } from 'react';
import posthog from '../lib/posthog';
import { useStore } from '../lib/store';

interface PostHogProviderProps {
  children: ReactNode;
}

export function PostHogProvider({ children }: PostHogProviderProps) {
  const user = useStore((s) => s.auth.user);

  useEffect(() => {
    if (user && posthog) {
      posthog.identify(user.userId, {
        email: user.email,
        organizationId: user.organizationId,
      });
    } else if (!user && posthog) {
      posthog.reset();
    }
  }, [user]);

  return <>{children}</>;
}
