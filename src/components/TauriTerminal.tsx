import React, { useEffect, useRef, useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import 'xterm/css/xterm.css';
import { terminalThemes, type ThemeKey } from '../lib/themes';

interface SshConfigEntry {
  alias: string;
  hostname: string | null;
  port: number;
  user: string | null;
  identity_file: string | null;
}

interface TauriTerminalProps {
  sessionId?: string;
  onConnect?: (sessionId: string) => void;
  onDisconnect?: () => void;
}

export function TauriTerminal({ sessionId: initialSessionId, onConnect, onDisconnect }: TauriTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const [connected, setConnected] = useState(false);
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [sshConfigHosts, setSshConfigHosts] = useState<SshConfigEntry[]>([]);
  const [config, setConfig] = useState({
    host: '',
    port: '22',
    username: '',
    authType: 'password' as 'password' | 'key',
    password: '',
    keyPath: '',
  });
  const [theme, setTheme] = useState<ThemeKey>('novo-dark');

  const sessionIdRef = useRef<string | null>(null);
  const readIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    invoke<SshConfigEntry[]>('ssh_config_parse').then(setSshConfigHosts).catch(() => {});
  }, []);

  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new Terminal({
      theme: terminalThemes[theme],
      fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", Menlo, monospace',
      fontSize: 14,
      lineHeight: 1.4,
      cursorBlink: true,
      cursorStyle: 'bar',
      scrollback: 10000,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(new WebLinksAddon());

    term.open(terminalRef.current);
    fitAddon.fit();

    termRef.current = term;

    // Send keyboard input to SSH
    term.onData((data: string) => {
      if (sessionIdRef.current) {
        invoke('ssh_write_input', { sessionId: sessionIdRef.current, data }).catch(console.error);
      }
    });

    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
      if (sessionIdRef.current && termRef.current) {
        invoke('ssh_resize', {
          sessionId: sessionIdRef.current,
          cols: termRef.current.cols,
          rows: termRef.current.rows,
        }).catch(console.error);
      }
    });
    resizeObserver.observe(terminalRef.current);

    return () => {
      resizeObserver.disconnect();
      term.dispose();
    };
  }, []);

  // Poll for SSH output
  useEffect(() => {
    if (!sessionIdRef.current || !connected) return;

    const pollOutput = async () => {
      try {
        const output = await invoke<string>('ssh_read_output', { sessionId: sessionIdRef.current });
        if (output && termRef.current) {
          termRef.current.write(output);
        }
      } catch (e) {
        // Shell closed or error
      }
    };

    readIntervalRef.current = setInterval(pollOutput, 50);

    return () => {
      if (readIntervalRef.current) {
        clearInterval(readIntervalRef.current);
      }
    };
  }, [connected]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (readIntervalRef.current) {
        clearInterval(readIntervalRef.current);
      }
      if (sessionIdRef.current) {
        invoke('ssh_disconnect', { sessionId: sessionIdRef.current }).catch(() => {});
      }
    };
  }, []);

  const handleConnectFromConfig = (entry: SshConfigEntry) => {
    setConfig({
      host: entry.hostname || entry.alias,
      port: String(entry.port),
      username: entry.user || '',
      authType: entry.identity_file ? 'key' : 'password',
      password: '',
      keyPath: entry.identity_file || '',
    });
    setConnectDialogOpen(true);
  };

  const handleConnect = async () => {
    try {
      const result = await invoke<{ id: string }>('ssh_connect', {
        config: {
          host: config.host,
          port: parseInt(config.port),
          username: config.username,
          auth_type: config.authType,
          password: config.authType === 'password' ? config.password : null,
          key_path: config.authType === 'key' ? config.keyPath : null,
        },
      });

      // Open interactive shell
      await invoke('ssh_open_shell', { sessionId: result.id });

      sessionIdRef.current = result.id;
      setConnected(true);
      setConnectDialogOpen(false);
      onConnect?.(result.id);

      termRef.current?.writeln(`\x1b[32mConnected to ${config.username}@${config.host}:${config.port}\x1b[0m\r\n`);
    } catch (error) {
      termRef.current?.writeln(`\x1b[31mConnection failed: ${error}\x1b[0m\r\n`);
    }
  };

  const handleDisconnect = async () => {
    if (sessionIdRef.current) {
      try {
        await invoke('ssh_disconnect', { sessionId: sessionIdRef.current });
      } catch (error) {
        console.error('Disconnect failed:', error);
      }
      sessionIdRef.current = null;
    }
    setConnected(false);
    onDisconnect?.();
    termRef.current?.writeln('\r\n\x1b[33mDisconnected\x1b[0m\r\n');
  };

  return (
    <div className="relative h-full">
      <div ref={terminalRef} className="h-full bg-[#0a0a0f]" />

      {!connected && !connectDialogOpen && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0f]/80 backdrop-blur-sm">
          <div className="text-center">
            <div className="mb-4 text-5xl text-[#00e5ff]/20">
              <svg className="mx-auto h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="mb-4 text-sm text-slate-500">No active connections</p>
            <button
              onClick={() => setConnectDialogOpen(true)}
              className="rounded-lg bg-[#00e5ff] px-6 py-2.5 text-sm font-semibold text-[#0a0a0f] transition-all hover:bg-[#00e5ff]/90 hover:shadow-[0_0_20px_rgba(0,229,255,0.3)] active:scale-[0.98]"
            >
              New Connection
            </button>
            {sshConfigHosts.length > 0 && (
              <div className="mt-6">
                <p className="mb-2 text-[11px] text-slate-600">From ~/.ssh/config</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {sshConfigHosts.slice(0, 6).map((h) => (
                    <button
                      key={h.alias}
                      onClick={() => handleConnectFromConfig(h)}
                      className="rounded-lg border border-white/[0.08] bg-white/5 px-3 py-1.5 text-[12px] text-slate-400 transition-all hover:bg-white/10 hover:text-white"
                    >
                      {h.alias}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {connectDialogOpen && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0f]/90 backdrop-blur-md">
          <div className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#12121a] p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">New SSH Connection</h2>
              <button onClick={() => setConnectDialogOpen(false)} className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="mb-1.5 block text-[12px] font-medium text-slate-400">Host</label>
                  <input type="text" value={config.host} onChange={(e) => setConfig({ ...config, host: e.target.value })} placeholder="192.168.1.100" className="w-full rounded-lg border border-white/[0.08] bg-white/5 px-3 py-2 text-[13px] text-white placeholder-slate-600 outline-none transition-colors focus:border-[#00e5ff]/50 focus:bg-white/[0.07]" />
                </div>
                <div>
                  <label className="mb-1.5 block text-[12px] font-medium text-slate-400">Port</label>
                  <input type="text" value={config.port} onChange={(e) => setConfig({ ...config, port: e.target.value })} className="w-full rounded-lg border border-white/[0.08] bg-white/5 px-3 py-2 text-[13px] text-white placeholder-slate-600 outline-none transition-colors focus:border-[#00e5ff]/50 focus:bg-white/[0.07]" />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-slate-400">Username</label>
                <input type="text" value={config.username} onChange={(e) => setConfig({ ...config, username: e.target.value })} placeholder="root" className="w-full rounded-lg border border-white/[0.08] bg-white/5 px-3 py-2 text-[13px] text-white placeholder-slate-600 outline-none transition-colors focus:border-[#00e5ff]/50 focus:bg-white/[0.07]" />
              </div>

              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-slate-400">Authentication</label>
                <div className="flex gap-2">
                  <button onClick={() => setConfig({ ...config, authType: 'password' })} className={`flex-1 rounded-lg border px-3 py-2 text-[13px] font-medium transition-all ${config.authType === 'password' ? 'border-[#00e5ff]/30 bg-[#00e5ff]/10 text-[#00e5ff]' : 'border-white/[0.08] bg-white/5 text-slate-400 hover:bg-white/10'}`}>
                    Password
                  </button>
                  <button onClick={() => setConfig({ ...config, authType: 'key' })} className={`flex-1 rounded-lg border px-3 py-2 text-[13px] font-medium transition-all ${config.authType === 'key' ? 'border-[#00e5ff]/30 bg-[#00e5ff]/10 text-[#00e5ff]' : 'border-white/[0.08] bg-white/5 text-slate-400 hover:bg-white/10'}`}>
                    SSH Key
                  </button>
                </div>
              </div>

              {config.authType === 'password' ? (
                <div>
                  <label className="mb-1.5 block text-[12px] font-medium text-slate-400">Password</label>
                  <input type="password" value={config.password} onChange={(e) => setConfig({ ...config, password: e.target.value })} className="w-full rounded-lg border border-white/[0.08] bg-white/5 px-3 py-2 text-[13px] text-white placeholder-slate-600 outline-none transition-colors focus:border-[#00e5ff]/50 focus:bg-white/[0.07]" />
                </div>
              ) : (
                <div>
                  <label className="mb-1.5 block text-[12px] font-medium text-slate-400">Key Path</label>
                  <input type="text" value={config.keyPath} onChange={(e) => setConfig({ ...config, keyPath: e.target.value })} placeholder="~/.ssh/id_rsa" className="w-full rounded-lg border border-white/[0.08] bg-white/5 px-3 py-2 text-[13px] text-white placeholder-slate-600 outline-none transition-colors focus:border-[#00e5ff]/50 focus:bg-white/[0.07]" />
                </div>
              )}
            </div>

            <div className="mt-6 flex gap-3">
              <button onClick={() => setConnectDialogOpen(false)} className="flex-1 rounded-lg border border-white/[0.08] bg-white/5 py-2.5 text-[13px] font-medium text-slate-300 transition-all hover:bg-white/10">
                Cancel
              </button>
              <button onClick={handleConnect} disabled={!config.host || !config.username} className="flex-1 rounded-lg bg-[#00e5ff] py-2.5 text-[13px] font-semibold text-[#0a0a0f] transition-all hover:bg-[#00e5ff]/90 hover:shadow-[0_0_20px_rgba(0,229,255,0.3)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50">
                Connect
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between border-t border-white/[0.06] bg-[#0f0f17]/80 px-4 py-1.5 backdrop-blur-sm">
        <div className="flex items-center gap-3 text-[11px] text-slate-500">
          <span className={`flex items-center gap-1.5 ${connected ? 'text-[#22c55e]' : 'text-slate-500'}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-[#22c55e]' : 'bg-slate-600'}`} />
            {connected ? 'Connected' : 'Disconnected'}
          </span>
          {connected && <span className="text-slate-600">|</span>}
          {connected && <span>{config.username}@{config.host}:{config.port}</span>}
        </div>
        <div className="flex items-center gap-3 text-[11px] text-slate-500">
          <select
            value={theme}
            onChange={(e) => {
              const newTheme = e.target.value as ThemeKey;
              setTheme(newTheme);
              if (termRef.current) termRef.current.options.theme = terminalThemes[newTheme];
            }}
            className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-400 border border-white/[0.06] outline-none"
          >
            {Object.entries(terminalThemes).map(([key, t]) => (
              <option key={key} value={key}>{t.name}</option>
            ))}
          </select>
          <span>UTF-8</span>
          <span className="text-slate-600">|</span>
          <span>xterm-256color</span>
        </div>
      </div>
    </div>
  );
}

export default TauriTerminal;
