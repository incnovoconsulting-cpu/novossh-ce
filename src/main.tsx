import { StrictMode, lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import './styles/globals.css';
import './lib/posthog';

const AuthGuard = lazy(() => import('./components/AuthGuard'));

ReactDOM.createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={
      <div className="flex h-full items-center justify-center bg-ink-950">
        <div className="h-8 w-8 border-2 border-neon border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <AuthGuard />
    </Suspense>
  </StrictMode>,
);
