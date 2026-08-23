import { useEffect, useRef, useCallback, useState } from 'react';
import type { Suggestion } from '../../services/AutocompleteService';
import { CATEGORY_COLORS, CATEGORY_ICONS } from '../../lib/autocompleteData';
import { highlightMatchesHtml } from '../../lib/fuzzyMatch';

interface Props {
  suggestions: Suggestion[];
  selectedIndex: number;
  visible: boolean;
  position: { x: number; y: number };
  onSelect: (command: string) => void;
  onSelectIndex: (idx: number) => void;
}

export function AutocompletePopup({
  suggestions,
  selectedIndex,
  visible,
  position,
  onSelect,
  onSelectIndex,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollIntoView, setScrollIntoView] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    const selectedEl = containerRef.current.querySelector('[data-selected="true"]');
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex, suggestions.length]);

  const handleMouseEnter = useCallback(
    (idx: number) => {
      onSelectIndex(idx);
    },
    [onSelectIndex]
  );

  if (!visible || suggestions.length === 0) return null;

  const grouped = suggestions.reduce<Record<string, Suggestion[]>>((acc, s) => {
    if (!acc[s.category]) acc[s.category] = [];
    acc[s.category].push(s);
    return acc;
  }, {});

  return (
    <div
      ref={containerRef}
      className="fixed z-[9999] max-h-[360px] w-[420px] overflow-y-auto rounded-lg border border-white/10 bg-[#1a1d27] shadow-2xl shadow-black/60 backdrop-blur-sm"
      style={{
        left: position.x,
        top: position.y,
      }}
    >
      <div className="px-2 py-1.5">
        <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-slate-500">
          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          Autocomplete
          <span className="ml-auto text-slate-600">
            {suggestions.length} matches
          </span>
        </div>
      </div>

      <div className="border-t border-white/5" />

      {Object.entries(grouped).map(([category, cmds]) => (
        <div key={category}>
          <div className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            <span>{CATEGORY_ICONS[category as keyof typeof CATEGORY_ICONS] ?? '📁'}</span>
            {category}
          </div>

          {cmds.map((suggestion) => {
            const globalIdx = suggestions.indexOf(suggestion);
            const isSelected = globalIdx === selectedIndex;
            const color = CATEGORY_COLORS[suggestion.category] ?? '#94a3b8';

            return (
              <button
                key={`${suggestion.command}-${globalIdx}`}
                data-selected={isSelected}
                className={`flex w-full items-start gap-3 px-3 py-2 text-left transition-colors ${
                  isSelected
                    ? 'bg-white/10 text-white'
                    : 'text-slate-300 hover:bg-white/5'
                }`}
                onClick={() => onSelect(suggestion.command)}
                onMouseEnter={() => handleMouseEnter(globalIdx)}
              >
                <div
                  className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px]"
                  style={{
                    backgroundColor: `${color}15`,
                    color,
                  }}
                >
                  {suggestion.command.charAt(0).toUpperCase()}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <code
                      className="text-[13px] font-medium text-slate-200"
                      dangerouslySetInnerHTML={{
                        __html: highlightMatchesHtml(
                          suggestion.command,
                          suggestion.matchIndices
                        ),
                      }}
                    />
                    {suggestion.frequency > 2 && (
                      <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-amber-400">
                        {suggestion.frequency}x
                      </span>
                    )}
                    {suggestion.isCustom && (
                      <span className="rounded bg-purple-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-purple-400">
                        custom
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-slate-500">
                    {suggestion.description}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  <kbd className="hidden rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-500 group-hover:inline">
                    {isSelected ? '↵' : ''}
                  </kbd>
                </div>
              </button>
            );
          })}
        </div>
      ))}

      <div className="border-t border-white/5" />
      <div className="flex items-center gap-3 px-3 py-1.5 text-[10px] text-slate-600">
        <span>
          <kbd className="rounded border border-white/10 bg-white/5 px-1 py-0.5 text-[9px]">↑↓</kbd>{' '}
          navigate
        </span>
        <span>
          <kbd className="rounded border border-white/10 bg-white/5 px-1 py-0.5 text-[9px]">Tab</kbd>{' '}
          complete
        </span>
        <span>
          <kbd className="rounded border border-white/10 bg-white/5 px-1 py-0.5 text-[9px]">Esc</kbd>{' '}
          dismiss
        </span>
        <span className="ml-auto">
          <kbd className="rounded border border-white/10 bg-white/5 px-1 py-0.5 text-[9px]">Enter</kbd>{' '}
          execute
        </span>
      </div>
    </div>
  );
}
