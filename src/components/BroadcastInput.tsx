import { useState } from 'react';
import { Send } from '@/lib/icons';
import { useStore } from '../lib/store';

export function BroadcastInput() {
  const [input, setInput] = useState('');
  const tabs = useStore((s) => s.tabs);
  const activeTabId = useStore((s) => s.activeTabId);

  const handleSend = () => {
    if (!input.trim()) return;
    const activeTab = tabs.find((t) => t.id === activeTabId);
    if (activeTab) {
      const event = new CustomEvent('broadcast-input', { detail: { input: input + '\n', excludeTabId: activeTab.id } });
      window.dispatchEvent(event);
    }
    setInput('');
  };

  return (
    <div className="flex h-10 items-center gap-2 border-t border-white/[0.04] bg-ink-900 px-3">
      <span className="text-[10px] font-medium uppercase tracking-wider text-amber-400/80">Broadcast</span>
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
        placeholder="Type command to broadcast to all sessions…"
        className="flex-1 bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-500"
      />
      <button
        onClick={handleSend}
        disabled={!input.trim()}
        className="rounded p-1 text-slate-400 hover:bg-amber-400/10 hover:text-amber-400 disabled:opacity-30"
      >
        <Send className="h-4 w-4" />
      </button>
    </div>
  );
}
