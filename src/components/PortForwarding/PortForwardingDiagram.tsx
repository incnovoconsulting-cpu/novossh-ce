import type { ForwardingType } from '../../lib/types';

interface PortForwardingDiagramProps {
  type: ForwardingType;
  bindAddress: string;
  bindPort: number;
  destinationHost?: string;
  destinationPort?: number;
  hostLabel?: string;
  active?: boolean;
}

export function PortForwardingDiagram({
  type,
  bindAddress,
  bindPort,
  destinationHost = 'localhost',
  destinationPort = 80,
  hostLabel = 'Remote Host',
  active = false,
}: PortForwardingDiagramProps) {
  const isDynamic = type === 'dynamic';
  const isRemote = type === 'remote';

  const flowColor = active ? '#34d399' : '#64748b';
  const glowOpacity = active ? 0.4 : 0;

  return (
    <svg
      viewBox="0 0 520 200"
      className="w-full rounded-lg bg-ink-900/50"
      style={{ maxHeight: 220 }}
    >
      <defs>
        <marker
          id="arrowhead"
          markerWidth="8"
          markerHeight="6"
          refX="8"
          refY="3"
          orient="auto"
        >
          <polygon points="0 0, 8 3, 0 6" fill={flowColor} />
        </marker>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id="tunnelGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={flowColor} stopOpacity="0.2" />
          <stop offset="50%" stopColor={flowColor} stopOpacity="0.05" />
          <stop offset="100%" stopColor={flowColor} stopOpacity="0.2" />
        </linearGradient>
      </defs>

      {/* Local machine */}
      <rect x="10" y="55" width="120" height="90" rx="8" fill="#1e293b" stroke="#334155" strokeWidth="1" />
      <rect x="20" y="65" width="100" height="8" rx="2" fill="#334155" />
      <rect x="20" y="80" width="70" height="6" rx="2" fill="#334155" />
      <rect x="20" y="92" width="85" height="6" rx="2" fill="#334155" />
      <rect x="20" y="104" width="60" height="6" rx="2" fill="#334155" />
      <text x="70" y="133" textAnchor="middle" className="fill-slate-400" fontSize="10">
        Local Machine
      </text>

      {/* SSH Host */}
      <rect x="390" y="55" width="120" height="90" rx="8" fill="#1e293b" stroke="#334155" strokeWidth="1" />
      <rect x="400" y="65" width="100" height="8" rx="2" fill="#334155" />
      <rect x="400" y="80" width="70" height="6" rx="2" fill="#334155" />
      <rect x="400" y="92" width="85" height="6" rx="2" fill="#334155" />
      <rect x="400" y="104" width="60" height="6" rx="2" fill="#334155" />
      <text x="450" y="133" textAnchor="middle" className="fill-slate-400" fontSize="10">
        {hostLabel}
      </text>

      {/* Tunnel path */}
      <rect x="130" y="70" width="260" height="60" rx="6" fill="url(#tunnelGrad)" stroke={flowColor} strokeWidth="1" strokeDasharray={active ? 'none' : '4 3'} opacity="0.8" />

      {/* Tunnel label */}
      <text x="260" y="92" textAnchor="middle" className="fill-slate-300" fontSize="10" fontWeight="600">
        SSH Tunnel
      </text>
      <text x="260" y="108" textAnchor="middle" className="fill-slate-500" fontSize="9">
        {type === 'dynamic' ? 'SOCKS5 Proxy' : type === 'remote' ? 'Remote Forward' : 'Local Forward'}
      </text>

      {/* Animated data flow dots */}
      {active && (
        <>
          <circle r="3" fill={flowColor} filter="url(#glow)">
            <animateMotion dur="2s" repeatCount="indefinite" path="M 130 100 L 390 100" />
          </circle>
          <circle r="2" fill={flowColor} opacity="0.6" filter="url(#glow)">
            <animateMotion dur="2s" repeatCount="indefinite" begin="0.5s" path="M 130 100 L 390 100" />
          </circle>
          {!isRemote && (
            <circle r="2.5" fill="#60a5fa" opacity="0.5" filter="url(#glow)">
              <animateMotion dur="2.5s" repeatCount="indefinite" begin="1s" path="M 390 100 L 130 100" />
            </circle>
          )}
        </>
      )}

      {/* Bind port indicator */}
      <g>
        <circle cx="130" cy="100" r="12" fill="#1e293b" stroke={flowColor} strokeWidth="1.5" />
        <text x="130" y="104" textAnchor="middle" className="fill-slate-200" fontSize="8" fontWeight="700">
          {bindPort}
        </text>
        <text x="130" y="160" textAnchor="middle" className="fill-slate-500" fontSize="8">
          {bindAddress}:{bindPort}
        </text>
      </g>

      {/* Destination port indicator */}
      {!isDynamic && (
        <g>
          <circle cx="390" cy="100" r="12" fill="#1e293b" stroke={flowColor} strokeWidth="1.5" />
          <text x="390" y="104" textAnchor="middle" className="fill-slate-200" fontSize="8" fontWeight="700">
            {destinationPort}
          </text>
          <text x="390" y="160" textAnchor="middle" className="fill-slate-500" fontSize="8">
            {destinationHost}:{destinationPort}
          </text>
        </g>
      )}

      {isDynamic && (
        <text x="390" y="160" textAnchor="middle" className="fill-slate-500" fontSize="8">
          Any destination
        </text>
      )}

      {/* Direction arrows */}
      {isRemote ? (
        <>
          <line x1="385" y1="95" x2="135" y2="95" stroke={flowColor} strokeWidth="1" markerEnd="url(#arrowhead)" opacity="0.6" />
          <text x="260" y="180" textAnchor="middle" className="fill-slate-500" fontSize="8">
            Remote → Local
          </text>
        </>
      ) : (
        <>
          <line x1="135" y1="95" x2="385" y2="95" stroke={flowColor} strokeWidth="1" markerEnd="url(#arrowhead)" opacity="0.6" />
          <text x="260" y="180" textAnchor="middle" className="fill-slate-500" fontSize="8">
            Local → Remote
          </text>
        </>
      )}
    </svg>
  );
}
