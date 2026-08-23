import { Wifi, WifiOff, Globe } from '@/lib/icons';

export type ConnectionType = 'direct' | 'tailscale' | 'relay' | 'unknown';

interface Props {
  connectionType: ConnectionType;
  className?: string;
}

export function ConnectionStatusBadge({ connectionType, className = '' }: Props) {
  const styles = {
    direct: {
      bg: 'bg-green-500/10',
      border: 'border-green-500/30',
      text: 'text-green-400',
      icon: Wifi,
      label: 'Direct SSH',
      description: 'Direct connection to host',
    },
    tailscale: {
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/30',
      text: 'text-blue-400',
      icon: Wifi,
      label: 'Tailscale',
      description: 'Connected via Tailscale tunnel',
    },
    relay: {
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/30',
      text: 'text-amber-400',
      icon: Globe,
      label: 'Server Relay',
      description: 'Routed through NovoSSH server',
    },
    unknown: {
      bg: 'bg-slate-500/10',
      border: 'border-slate-500/30',
      text: 'text-slate-400',
      icon: WifiOff,
      label: 'Unknown',
      description: 'Connection type unknown',
    },
  };

  const style = styles[connectionType];
  const Icon = style.icon;

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded px-2 py-1 border ${style.bg} ${style.border} ${className}`}
      title={style.description}
    >
      <Icon className={`h-3 w-3 ${style.text}`} />
      <span className={`text-xs font-medium ${style.text}`}>{style.label}</span>
    </div>
  );
}
