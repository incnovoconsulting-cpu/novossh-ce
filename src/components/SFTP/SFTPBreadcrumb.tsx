import { ChevronRight, Home } from '@/lib/icons';

interface SFTPBreadcrumbProps {
  path: string;
  onNavigate: (path: string) => void;
}

export default function SFTPBreadcrumb({ path, onNavigate }: SFTPBreadcrumbProps) {
  const parts = path.split('/').filter(Boolean);

  const handleClick = (index: number) => {
    const target = '/' + parts.slice(0, index + 1).join('/');
    onNavigate(target);
  };

  return (
    <div className="flex items-center gap-1 border-b border-white/[0.04] bg-ink-800/50 px-3 py-1.5 text-xs">
      <button
        onClick={() => onNavigate('/')}
        className="flex items-center gap-1 rounded px-1.5 py-0.5 text-slate-400 hover:bg-white/5 hover:text-slate-200"
      >
        <Home className="h-3 w-3" />
      </button>
      {parts.map((part, i) => (
        <div key={i} className="flex items-center gap-1">
          <ChevronRight className="h-3 w-3 text-slate-600" />
          <button
            onClick={() => handleClick(i)}
            className="rounded px-1.5 py-0.5 text-slate-400 hover:bg-white/5 hover:text-slate-200"
          >
            {part}
          </button>
        </div>
      ))}
    </div>
  );
}
