import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface TauriLayoutProps {
  children: React.ReactNode;
}

export function TauriLayout({ children }: TauriLayoutProps) {
  const [isMaximized, setIsMaximized] = useState(false);

  return (
    <div className="flex h-screen bg-[#0a0a0f] text-white overflow-hidden">
      {/* Custom titlebar */}
      <div
        data-tauri-drag-region
        className="fixed top-0 left-0 right-0 h-10 z-50 flex items-center justify-between px-4 bg-[#0f0f17]/80 backdrop-blur-xl border-b border-white/[0.06]"
      >
        <div className="flex items-center gap-3" data-tauri-drag-region>
          <div className="flex h-5 w-5 items-center justify-center rounded bg-[#00e5ff]/15 text-[#00e5ff]">
            <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20 19V7H4v12h16m0-16a2 2 0 012 2v14a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h16M7 12h2v2H7v-2zm4 0h2v2h-2v-2zm4 0h2v2h-2v-2z" />
            </svg>
          </div>
          <span className="text-[13px] font-semibold tracking-tight text-white/90">NovoSSH</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            className="h-7 w-10 flex items-center justify-center rounded hover:bg-white/10 transition-colors"
            onClick={async () => {
              const { getCurrentWindow } = await import('@tauri-apps/api/window');
              getCurrentWindow().minimize();
            }}
          >
            <svg className="h-3 w-3 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
          <button
            className="h-7 w-10 flex items-center justify-center rounded hover:bg-white/10 transition-colors"
            onClick={async () => {
              const { getCurrentWindow } = await import('@tauri-apps/api/window');
              getCurrentWindow().toggleMaximize();
            }}
          >
            <svg className="h-3 w-3 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {isMaximized ? (
                <path strokeLinecap="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              ) : (
                <path strokeLinecap="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              )}
            </svg>
          </button>
          <button
            className="h-7 w-10 flex items-center justify-center rounded hover:bg-red-500/80 transition-colors"
            onClick={async () => {
              const { getCurrentWindow } = await import('@tauri-apps/api/window');
              getCurrentWindow().close();
            }}
          >
            <svg className="h-3 w-3 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 pt-10">
        {children}
      </div>
    </div>
  );
}

export default TauriLayout;
