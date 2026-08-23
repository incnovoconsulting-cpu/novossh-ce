import { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { SearchAddon } from '@xterm/addon-search';
import { useStore } from '../lib/store';
import type { TerminalTab } from '../lib/types';
import { terminalThemes } from '../lib/themes';
import { validateWebConnectionMode } from '../lib/networkValidation';
import { electronSSHAdapter } from '../services/ElectronSSHAdapter';
import { ConnectionStatusBadge, type ConnectionType } from './ConnectionStatusBadge';
import { AutocompletePopup } from './Terminal/AutocompletePopup';
import { useAutocomplete } from '../hooks/useAutocomplete';
import { ServerCog, Wifi, WifiOff, Search } from '@/lib/icons';

const API_BASE = import.meta.env.VITE_API_URL || '';

interface Props {
  tab: TerminalTab;
}

export function TerminalPane({ tab }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const searchRef = useRef<SearchAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const electronSessionRef = useRef<string | null>(null);
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const connectStartTimeRef = useRef<number>(0);

  const host = useStore((s) => (tab.hostId ? s.hosts.find((h) => h.id === tab.hostId) : undefined));
  const keys = useStore((s) => s.keys);
  const snippets = useStore((s) => s.snippets);
  const settings = useStore((s) => s.settings);
  const setTabStatus = useStore((s) => s.setTabStatus);
  const touchHost = useStore((s) => s.touchHost);
  const tailscaleServerAddress = useStore((s) => s.settings.tailscaleServerAddress);
  const accessToken = useStore((s) => s.auth.accessToken);

  const [statusMsg, setStatusMsg] = useState<string>('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [connectionType, setConnectionType] = useState<ConnectionType>('unknown');

  const autocomplete = useAutocomplete();
  const lineBufferRef = useRef('');
  const autocompleteVisibleRef = useRef(false);
  const popupPositionRef = useRef({ x: 0, y: 0 });
  const [popupPos, setPopupPos] = useState({ x: 0, y: 0 });

  function getPopupPosition(): { x: number; y: number } {
    const term = termRef.current;
    const container = containerRef.current;
    if (!term || !container) return { x: 0, y: 0 };

    const buffer = term.buffer.active;
    const cursorX = buffer.cursorX;
    const cursorY = buffer.cursorY;

    const containerRect = container.getBoundingClientRect();
    const termElement = container.querySelector('.xterm') as HTMLElement | null;
    if (!termElement) return { x: containerRect.left, y: containerRect.top };

    const termRect = termElement.getBoundingClientRect();
    const cellWidth = termRect.width / term.cols;
    const cellHeight = termRect.height / term.rows;

    const statusBarHeight = 36;
    const searchHeight = searchOpen ? 36 : 0;

    const x = termRect.left + cursorX * cellWidth;
    const y = termRect.top + statusBarHeight + searchHeight + (cursorY + 1) * cellHeight + 4;

    const popupWidth = 420;
    const maxX = window.innerWidth - popupWidth - 8;
    const maxY = window.innerHeight - 364;

    return {
      x: Math.min(x, maxX),
      y: Math.min(y, maxY),
    };
  }

  const sendToTerminal = useCallback((data: string) => {
    const sessionId = electronSessionRef.current;
    if (sessionId) {
      electronSSHAdapter.send(sessionId, data).catch(() => {});
    } else {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'data', data }));
      }
    }
  }, []);

  const sendBackspace = useCallback((count: number) => {
    const term = termRef.current;
    if (!term) return;
    const backspaceChar = '\x7f';
    for (let i = 0; i < count; i++) {
      sendToTerminal(backspaceChar);
    }
  }, [sendToTerminal]);

  const sendChars = useCallback((text: string) => {
    sendToTerminal(text);
  }, [sendToTerminal]);

  const handleAutocompleteComplete = useCallback(
    (command: string) => {
      const currentBuffer = lineBufferRef.current;
      const charsToRemove = currentBuffer.length;
      sendBackspace(charsToRemove);
      sendChars(command);
      lineBufferRef.current = command;
      autocomplete.recordUsage(command);
      autocomplete.hide();
      autocompleteVisibleRef.current = false;
    },
    [sendBackspace, sendChars, autocomplete]
  );

  const handleAutocompleteSelect = useCallback(
    (command: string) => {
      handleAutocompleteComplete(command);
    },
    [handleAutocompleteComplete]
  );

  const handleAutocompleteDismiss = useCallback(() => {
    autocomplete.hide();
    autocompleteVisibleRef.current = false;
  }, [autocomplete]);

  const handleAutocompleteExecute = useCallback(() => {
    const selected = autocomplete.getSelected();
    if (selected) {
      handleAutocompleteComplete(selected.command);
    } else {
      autocomplete.hide();
      autocompleteVisibleRef.current = false;
      sendChars('\n');
    }
  }, [autocomplete, handleAutocompleteComplete, sendChars]);

  async function recordConnectionAttempt(
    connectionType: string,
    success: boolean,
    errorMessage?: string,
    fallbackUsed?: boolean,
    fallbackType?: string,
  ) {
    if (!host) return;
    try {
      const durationMs = Date.now() - connectStartTimeRef.current;
      await fetch(`${API_BASE}/api/connections/${host.id}/attempt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionType,
          targetHost: host.address,
          targetPort: host.port,
          success,
          errorMessage,
          fallbackUsed,
          fallbackType,
          durationMs,
        }),
      });
    } catch {
      // best effort
    }
  }

  useEffect(() => {
    if (!containerRef.current || termRef.current) return;

    const theme = terminalThemes[settings.theme] ?? terminalThemes['novo-dark'];
    const term = new Terminal({
      fontFamily: settings.fontFamily,
      fontSize: settings.fontSize,
      cursorBlink: settings.cursorBlink,
      cursorStyle: settings.cursorStyle,
      scrollback: settings.scrollback,
      allowProposedApi: true,
      theme,
      macOptionIsMeta: true,
      letterSpacing: 0,
    });
    const fit = new FitAddon();
    const links = new WebLinksAddon();
    const search = new SearchAddon();
    term.loadAddon(fit);
    term.loadAddon(links);
    term.loadAddon(search);

    term.open(containerRef.current);
    fit.fit();

    termRef.current = term;
    fitRef.current = fit;
    searchRef.current = search;

    if (settings.copyOnSelect) {
      term.onSelectionChange(() => {
        const sel = term.getSelection();
        if (sel) navigator.clipboard?.writeText(sel).catch(() => {});
      });
    }

    const onResize = () => fit.fit();
    window.addEventListener('resize', onResize);

    const ro = new ResizeObserver(() => fit.fit());
    ro.observe(containerRef.current);

    term.onData((data) => {
      if (autocompleteVisibleRef.current) {
        if (data === '\x1b[A') {
          autocomplete.selectPrev();
          return;
        }
        if (data === '\x1b[B') {
          autocomplete.selectNext();
          return;
        }
        if (data === '\t') {
          const selected = autocomplete.getSelected();
          if (selected) {
            const currentBuffer = lineBufferRef.current;
            const charsToRemove = currentBuffer.length;
            for (let i = 0; i < charsToRemove; i++) {
              const sessionId = electronSessionRef.current;
              if (sessionId) {
                electronSSHAdapter.send(sessionId, '\x7f').catch(() => {});
              } else {
                const ws = wsRef.current;
                if (ws && ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify({ type: 'data', data: '\x7f' }));
                }
              }
            }
            const sessionId = electronSessionRef.current;
            if (sessionId) {
              electronSSHAdapter.send(sessionId, selected.command).catch(() => {});
            } else {
              const ws = wsRef.current;
              if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'data', data: selected.command }));
              }
            }
            lineBufferRef.current = selected.command;
            autocomplete.recordUsage(selected.command);
            autocomplete.hide();
            autocompleteVisibleRef.current = false;
          }
          return;
        }
        if (data === '\r' || data === '\n') {
          const selected = autocomplete.getSelected();
          if (selected) {
            const currentBuffer = lineBufferRef.current;
            const charsToRemove = currentBuffer.length;
            for (let i = 0; i < charsToRemove; i++) {
              const sessionId = electronSessionRef.current;
              if (sessionId) {
                electronSSHAdapter.send(sessionId, '\x7f').catch(() => {});
              } else {
                const ws = wsRef.current;
                if (ws && ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify({ type: 'data', data: '\x7f' }));
                }
              }
            }
            const sessionId = electronSessionRef.current;
            if (sessionId) {
              electronSSHAdapter.send(sessionId, selected.command + '\n').catch(() => {});
            } else {
              const ws = wsRef.current;
              if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'data', data: selected.command + '\n' }));
              }
            }
            autocomplete.recordUsage(selected.command);
            autocomplete.hide();
            autocompleteVisibleRef.current = false;
            lineBufferRef.current = '';
          } else {
            autocomplete.hide();
            autocompleteVisibleRef.current = false;
            lineBufferRef.current = '';
            const sessionId = electronSessionRef.current;
            if (sessionId) {
              electronSSHAdapter.send(sessionId, '\r').catch(() => {});
            } else {
              const ws = wsRef.current;
              if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'data', data: '\r' }));
              }
            }
          }
          return;
        }
        if (data === '\x1b') {
          autocomplete.hide();
          autocompleteVisibleRef.current = false;
          const sessionId = electronSessionRef.current;
          if (sessionId) {
            electronSSHAdapter.send(sessionId, data).catch(() => {});
          } else {
            const ws = wsRef.current;
            if (ws && ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'data', data }));
            }
          }
          return;
        }
        if (data === '\x7f') {
          lineBufferRef.current = lineBufferRef.current.slice(0, -1);
          const sessionId = electronSessionRef.current;
          if (sessionId) {
            electronSSHAdapter.send(sessionId, data).catch(() => {});
          } else {
            const ws = wsRef.current;
            if (ws && ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'data', data }));
            }
          }
          if (lineBufferRef.current.length >= 2) {
            autocomplete.getSuggestions(lineBufferRef.current);
            const pos = getPopupPosition();
            popupPositionRef.current = pos;
            setPopupPos(pos);
          } else {
            autocomplete.hide();
            autocompleteVisibleRef.current = false;
          }
          return;
        }
      }

      const sessionId = electronSessionRef.current;
      if (sessionId) {
        electronSSHAdapter.send(sessionId, data).catch(() => {});
      } else {
        const ws = wsRef.current;
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'data', data }));
        }
      }

      const isPrintable = data.length === 1 && data >= ' ' && data <= '~';
      const isSpace = data === ' ';

      if (isPrintable) {
        if (isSpace) {
          if (lineBufferRef.current.length >= 2) {
            autocomplete.hide();
            autocompleteVisibleRef.current = false;
          }
          lineBufferRef.current = '';
        } else {
          lineBufferRef.current += data;
          if (lineBufferRef.current.length >= 2) {
            autocomplete.getSuggestions(lineBufferRef.current);
            autocompleteVisibleRef.current = true;
            const pos = getPopupPosition();
            popupPositionRef.current = pos;
            setPopupPos(pos);
          }
        }
      } else if (data === '\x7f') {
        lineBufferRef.current = lineBufferRef.current.slice(0, -1);
        if (lineBufferRef.current.length >= 2) {
          autocomplete.getSuggestions(lineBufferRef.current);
          autocompleteVisibleRef.current = true;
          const pos = getPopupPosition();
          popupPositionRef.current = pos;
          setPopupPos(pos);
        } else {
          autocomplete.hide();
          autocompleteVisibleRef.current = false;
        }
      } else if (data === '\r' || data === '\n') {
        if (lineBufferRef.current) {
          autocomplete.recordUsage(lineBufferRef.current);
        }
        lineBufferRef.current = '';
        autocomplete.hide();
        autocompleteVisibleRef.current = false;
      } else if (data === '\x1b[A' || data === '\x1b[B' || data === '\x1b[C' || data === '\x1b[D') {
        // arrow keys - let terminal handle
      } else if (data === '\t') {
        // tab - let terminal handle
      } else {
        lineBufferRef.current = '';
        autocomplete.hide();
        autocompleteVisibleRef.current = false;
      }
    });

    term.onResize(({ cols, rows }) => {
      const sessionId = electronSessionRef.current;
      if (sessionId) {
        electronSSHAdapter.resize(sessionId, cols, rows).catch(() => {});
      } else {
        const ws = wsRef.current;
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'resize', cols, rows }));
        }
      }
    });

    if (host || tab.vaultConnect) {
      connect();
    } else {
      term.writeln('\x1b[1;36mNovoSSH local pane\x1b[0m');
      term.writeln('No host attached. Open a host from the sidebar, or press \x1b[33m⌘K\x1b[0m for the palette.');
    }

    return () => {
      window.removeEventListener('resize', onResize);
      ro.disconnect();
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
      if (electronSessionRef.current) {
        electronSSHAdapter.disconnect(electronSessionRef.current).catch(() => {});
        electronSessionRef.current = null;
      }
      try { wsRef.current?.close(); } catch { /* WebSocket already closed or invalid */ }
      term.dispose();
      termRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const term = termRef.current;
    if (!term) return;
    term.options.theme = terminalThemes[settings.theme];
    term.options.fontFamily = settings.fontFamily;
    term.options.fontSize = settings.fontSize;
    term.options.cursorBlink = settings.cursorBlink;
    term.options.cursorStyle = settings.cursorStyle;
    fitRef.current?.fit();
  }, [settings]);

  async function connectElectron() {
    if (!host) return false;

    const term = termRef.current;
    if (!term) return false;

    connectStartTimeRef.current = Date.now();

    try {
      const connectionType = electronSSHAdapter.determineConnectionType(
        host.address,
        host.connectionMode,
      );

      if (connectionType === 'relay') return false;

      let privateKey: string | undefined;
      let passphrase: string | undefined;
      let certificate: string | undefined;
      if ((host.authMethod === 'key' || host.authMethod === 'cert') && host.keyId) {
        const k = keys.find((k) => k.id === host.keyId);
        privateKey = k?.privateKey;
        passphrase = host.passphrase;
        if (host.authMethod === 'cert') {
          certificate = host.certificate;
        }
      }

      const session = await electronSSHAdapter.connect(
        {
          host: host.address,
          port: host.port,
          username: host.username,
          password: host.authMethod === 'password' ? host.password : undefined,
          privateKey,
          passphrase,
          certificate,
          cols: term.cols,
          rows: term.rows,
          term: 'xterm-256color',
        },
        host.connectionMode,
        (data) => term.write(data),
        (status) => {
          if (connectTimeoutRef.current) {
            clearTimeout(connectTimeoutRef.current);
            connectTimeoutRef.current = null;
          }
          if (status === 'connected') {
            setTabStatus(tab.id, 'connected');
            setStatusMsg('Connected (Direct SSH)');
            touchHost(host.id);
            recordConnectionAttempt(connectionType, true);
          } else if (status === 'disconnected') {
            setTabStatus(tab.id, 'disconnected');
            setStatusMsg('Disconnected');
            term.writeln('\r\n\x1b[33m✗ Session ended.\x1b[0m');
          } else if (status === 'error') {
            setTabStatus(tab.id, 'error');
            setStatusMsg('Error');
            recordConnectionAttempt(connectionType, false, 'Connection error');
          } else {
            setTabStatus(tab.id, 'connecting');
            setStatusMsg('Connecting…');
          }
        },
      );

      electronSessionRef.current = session.sessionId;
      setConnectionType(session.connectionType as ConnectionType);
      retryCountRef.current = 0;
      return true;
    } catch (err) {
      recordConnectionAttempt('direct', false, err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }

  function connect() {
    // Vault-driven connection: bypass the saved-host lookup.
    if (tab.vaultConnect) {
      const term = termRef.current!;
      setTabStatus(tab.id, 'connecting');
      setStatusMsg('Connecting…');
      term.writeln(`\x1b[36m→ Connecting to ${tab.vaultConnect.username}@${tab.vaultConnect.host}:${tab.vaultConnect.port}\x1b[0m`);
      connectVaultWebSocket();
      return;
    }

    if (!host) return;
    if (!host.address?.trim()) {
      setTabStatus(tab.id, 'error');
      setStatusMsg('No address configured');
      const term = termRef.current;
      if (term) term.writeln('\x1b[31m✗ No address configured for this host.\x1b[0m');
      return;
    }

    const connectionValidation = validateWebConnectionMode(
      host.address,
      host.connectionMode || 'tailscale',
    );
    if (!connectionValidation.valid) {
      setTabStatus(tab.id, 'error');
      setStatusMsg('Connection not allowed');
      const term = termRef.current;
      if (term) {
        term.writeln('\x1b[31m✗ Connection blocked\x1b[0m');
        term.writeln(`\x1b[31m  ${connectionValidation.reason}\x1b[0m`);
      }
      return;
    }

    const term = termRef.current!;
    setTabStatus(tab.id, 'connecting');
    setStatusMsg('Connecting…');
    term.writeln(`\x1b[36m→ Connecting to ${host.username}@${host.address}:${host.port}\x1b[0m`);

    // Try Electron SSH first if available
    if (electronSSHAdapter.isAvailable()) {
      connectElectron().then((success) => {
        if (success) return;
        recordConnectionAttempt('direct', false, 'Electron direct failed', true, 'relay');
        connectWebSocket();
      });
      return;
    }

    connectWebSocket();
  }

  function connectVaultWebSocket() {
    const vc = tab.vaultConnect!;
    const term = termRef.current!;
    connectStartTimeRef.current = Date.now();

    const wsProto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    let wsUrl: string;
    if (import.meta.env.VITE_API_URL) {
      wsUrl = import.meta.env.VITE_API_URL
        .replace(/^https?:\/\//, wsProto + '://')
        .replace(/\/$/, '') + '/ws/ssh';
    } else {
      wsUrl = `${wsProto}://${window.location.hostname}:8787/ws/ssh`;
    }
    if (accessToken) wsUrl += `?token=${encodeURIComponent(accessToken)}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    const cols = term.cols;
    const rows = term.rows;

    ws.onopen = () => {
      retryCountRef.current = 0;
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' }));
      }, 30_000);
      setConnectionType('relay');

      const connectMsg: Record<string, unknown> = {
        type: 'connect',
        host: vc.host,
        port: vc.port,
        username: vc.username,
        password: vc.password,
        privateKey: vc.privateKey,
        passphrase: vc.passphrase,
        cols,
        rows,
        term: 'xterm-256color',
        sessionId: vc.sessionId,
      };
      ws.send(JSON.stringify(connectMsg));
    };

    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.type === 'data') {
        term.write(msg.data);
      } else if (msg.type === 'status') {
        if (msg.status === 'connected') {
          setTabStatus(tab.id, 'connected');
          setStatusMsg('');
        } else if (msg.status === 'disconnected') {
          setTabStatus(tab.id, 'idle');
          setStatusMsg('Disconnected');
          term.writeln('\r\n\x1b[33m• Disconnected\x1b[0m');
        }
      } else if (msg.type === 'error') {
        setTabStatus(tab.id, 'error');
        setStatusMsg(msg.message);
        term.writeln(`\r\n\x1b[31m✗ ${msg.message}\x1b[0m`);
      }
    };

    ws.onerror = () => {
      setTabStatus(tab.id, 'error');
      setStatusMsg('Connection error');
      term.writeln('\r\n\x1b[31m✗ WebSocket error\x1b[0m');
    };

    ws.onclose = () => {
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
    };
  }

  function connectWebSocket() {
    if (!host) return;

    const term = termRef.current!;
    connectStartTimeRef.current = Date.now();

    const wsProto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    let wsUrl: string;
    if (host.connectionMode === 'tailscale' && tailscaleServerAddress && wsProto === 'ws') {
      wsUrl = `ws://${tailscaleServerAddress}:8787/ws/ssh`;
    } else {
        if (import.meta.env.VITE_API_URL) {
        wsUrl = import.meta.env.VITE_API_URL
          .replace(/^https?:\/\//, wsProto + '://')
          .replace(/\/$/, '') + '/ws/ssh';
      } else {
        wsUrl = `${wsProto}://${window.location.hostname}:8787/ws/ssh`;
      }
    }

    // NOTE: WebSocket API doesn't support custom headers. Token in query string is
    // the standard approach. Mitigated by: short-lived tokens, WSS encryption, and
    // server-side token validation on connection.
    if (accessToken) {
      wsUrl += `?token=${encodeURIComponent(accessToken)}`;
    }

    let connectionFailed = false;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    const cols = term.cols;
    const rows = term.rows;

    ws.onopen = () => {
      retryCountRef.current = 0;
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 30_000);
      setConnectionType(host.connectionMode === 'tailscale' ? 'tailscale' : 'relay');
      let privateKey: string | undefined;
      let passphrase: string | undefined;
      let certificate: string | undefined;
      if ((host.authMethod === 'key' || host.authMethod === 'cert') && host.keyId) {
        const k = keys.find((k) => k.id === host.keyId);
        privateKey = k?.privateKey;
        passphrase = host.passphrase;
        if (host.authMethod === 'cert') {
          certificate = host.certificate;
        }
      }

      const connectMsg: Record<string, unknown> = {
        type: 'connect',
        host: host.address,
        port: host.port,
        username: host.username,
        password: host.authMethod === 'password' ? host.password : undefined,
        privateKey,
        passphrase,
        certificate,
        cols,
        rows,
        term: 'xterm-256color',
      };

      if (host.connectionMode === 'tailscale') {
        connectMsg.via = { host: '127.0.0.1', port: 2222 };
      }

      ws.send(JSON.stringify(connectMsg));

      connectTimeoutRef.current = setTimeout(() => {
        if (ws.readyState === ws.OPEN) {
          connectionFailed = true;
          setTabStatus(tab.id, 'error');
          setStatusMsg('Connection timed out');
          term.writeln('\r\n\x1b[31m✗ Connection timed out after 15s\x1b[0m');
          term.writeln('\x1b[31m  The host may be unreachable or the address may be incorrect.\x1b[0m');
          recordConnectionAttempt('relay', false, 'Connection timed out');
          try { ws.close(); } catch { /* Intentionally ignored */ }
        }
      }, 15_000);
    };

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === 'data') {
          term.write(msg.data);
        } else if (msg.type === 'status') {
          if (connectTimeoutRef.current) {
            clearTimeout(connectTimeoutRef.current);
            connectTimeoutRef.current = null;
          }
          if (msg.status === 'connected') {
            setTabStatus(tab.id, 'connected');
            setStatusMsg('Connected');
            touchHost(host.id);
            recordConnectionAttempt('relay', true);

            // Auto-attach tmux session if enabled
            if (host.autoAttachTmux !== false) {
              const tmuxCmd = 'tmux attach -t novossh 2>/dev/null || tmux new -s novossh\n';
              setTimeout(() => {
                const ws2 = wsRef.current;
                if (ws2 && ws2.readyState === WebSocket.OPEN) {
                  ws2.send(JSON.stringify({ type: 'data', data: tmuxCmd }));
                }
              }, 300);
            }

            if (host.startupSnippetId) {
              const snippet = snippets.find((s) => s.id === host.startupSnippetId);
              if (snippet) {
                setTimeout(() => {
                  const ws2 = wsRef.current;
                  if (ws2 && ws2.readyState === WebSocket.OPEN) {
                    ws2.send(JSON.stringify({ type: 'data', data: snippet.command + '\n' }));
                  }
                }, 500);
              }
            }
          } else if (msg.status === 'disconnected') {
            setTabStatus(tab.id, 'disconnected');
            setStatusMsg('Disconnected');
            term.writeln('\r\n\x1b[33m✗ Session ended.\x1b[0m');
          }
        } else if (msg.type === 'error') {
          if (connectTimeoutRef.current) {
            clearTimeout(connectTimeoutRef.current);
            connectTimeoutRef.current = null;
          }
          setTabStatus(tab.id, 'error');
          setStatusMsg(`Error: ${msg.message}`);
          term.writeln(`\r\n\x1b[31m✗ ${msg.message}\x1b[0m`);
          recordConnectionAttempt('relay', false, msg.message);
        }
      } catch {
        // ignore
      }
    };

    ws.onclose = (ev) => {
      if (connectTimeoutRef.current) {
        clearTimeout(connectTimeoutRef.current);
        connectTimeoutRef.current = null;
      }
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
      setTabStatus(tab.id, 'disconnected');
      if (!connectionFailed && ev && ev.code !== 1000 && ev.code !== 1001) {
        const reason = ev.reason || `code ${ev.code}`;
        term.writeln(`\r\n\x1b[33m✗ Connection closed (${reason})\x1b[0m`);
        const maxRetries = 5;
        if (retryCountRef.current < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 30000);
          retryCountRef.current++;
          setStatusMsg(`Reconnecting (${retryCountRef.current}/${maxRetries})…`);
          term.writeln(`\x1b[33m↻ Reconnecting in ${Math.round(delay / 1000)}s (${retryCountRef.current}/${maxRetries})…\x1b[0m`);
          retryTimeoutRef.current = setTimeout(() => connect(), delay);
        } else {
          setStatusMsg(`Disconnected: ${reason}`);
          term.writeln(`\x1b[31m✗ Failed after ${maxRetries} reconnect attempts\x1b[0m`);
        }
      }
    };
    ws.onerror = (ev) => {
      if (connectTimeoutRef.current) {
        clearTimeout(connectTimeoutRef.current);
        connectTimeoutRef.current = null;
      }
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
      connectionFailed = true;
      setTabStatus(tab.id, 'error');
      console.error('[NovoSSH] WebSocket connection failed', { url: wsUrl, event: ev });
      term.writeln(`\r\n\x1b[31m✗ WebSocket connection failed\x1b[0m`);
      term.writeln(`\x1b[31m  URL: ${wsUrl}\x1b[0m`);
      term.writeln(`\x1b[31m  Check that the bridge server is running and reachable on port 8787.\x1b[0m`);

      const maxRetries = 5;
      if (retryCountRef.current < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 30000);
        retryCountRef.current++;
        setStatusMsg(`Reconnecting (${retryCountRef.current}/${maxRetries})…`);
        term.writeln(`\r\n\x1b[33m↻ Reconnecting in ${Math.round(delay / 1000)}s (${retryCountRef.current}/${maxRetries})…\x1b[0m`);
        retryTimeoutRef.current = setTimeout(() => connect(), delay);
      } else {
        setStatusMsg('Connection failed – click Reconnect to try again');
        term.writeln(`\r\n\x1b[31m✗ Failed after ${maxRetries} attempts\x1b[0m`);
      }
    };
  }

  function disconnect() {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    if (connectTimeoutRef.current) {
      clearTimeout(connectTimeoutRef.current);
      connectTimeoutRef.current = null;
    }
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    retryCountRef.current = 0;

    const sessionId = electronSessionRef.current;
    if (sessionId) {
      electronSSHAdapter.disconnect(sessionId).catch(() => {});
      electronSessionRef.current = null;
    } else {
      try {
        wsRef.current?.send(JSON.stringify({ type: 'disconnect' }));
        wsRef.current?.close();
      } catch { /* Intentionally ignored */ }
    }
  }

  function reconnect() {
    disconnect();
    setTimeout(() => connect(), 200);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
        const term = termRef.current;
        if (term && containerRef.current?.contains(document.activeElement)) {
          e.preventDefault();
          setSearchOpen((v) => !v);
        }
      }
      if (e.key === 'Escape') {
        setSearchOpen(false);
        handleAutocompleteDismiss();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleAutocompleteDismiss]);

  useEffect(() => {
    const handler = (e: CustomEvent<{ input: string; excludeTabId?: string }>) => {
      if (e.detail.excludeTabId === tab.id) return;
      const sessionId = electronSessionRef.current;
      if (sessionId) {
        electronSSHAdapter.send(sessionId, e.detail.input).catch(() => {});
      } else {
        const ws = wsRef.current;
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'data', data: e.detail.input }));
        }
      }
    };
    window.addEventListener('broadcast-input', handler as EventListener);
    return () => window.removeEventListener('broadcast-input', handler as EventListener);
  }, [tab.id]);

  // Wake detection: auto-reconnect when network comes back or tab becomes visible
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && tab.status === 'disconnected') {
        reconnect();
      }
    };

    const handleOnline = () => {
      if (tab.status === 'disconnected') {
        reconnect();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('online', handleOnline);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('online', handleOnline);
    };
  }, [tab.status, reconnect]);

  return (
    <div className="flex h-full flex-col" style={{ background: terminalThemes[settings.theme].background }}>
      <div className="flex h-9 items-center gap-2 border-b border-white/[0.04] bg-ink-900/80 px-3 backdrop-blur">
        {host ? (
          <>
            <ServerCog className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-xs text-slate-300">
              {host.username}@{host.address}:{host.port}
            </span>
            <span className="text-xs text-slate-600">·</span>
            <span className="text-xs text-slate-500">{statusMsg || tab.status}</span>
            {tab.status === 'connected' && (
              <>
                <span className="text-xs text-slate-600">·</span>
                <ConnectionStatusBadge connectionType={connectionType} />
              </>
            )}
            <div className="ml-auto flex items-center gap-1">
              <button
                onClick={() => setSearchOpen((v) => !v)}
                className="rounded p-1 text-slate-400 hover:bg-white/10 hover:text-slate-200"
                title="Find (⌘F)"
              >
                <Search className="h-3.5 w-3.5" />
              </button>
              {tab.status === 'connected' ? (
                <button
                  onClick={disconnect}
                  className="inline-flex items-center gap-1 rounded bg-white/5 px-2 py-0.5 text-[11px] text-slate-300 hover:bg-white/10"
                >
                  <WifiOff className="h-3 w-3" /> Disconnect
                </button>
              ) : (
                <button
                  onClick={reconnect}
                  className="inline-flex items-center gap-1 rounded bg-accent/15 px-2 py-0.5 text-[11px] text-accent-400 hover:bg-accent/25"
                >
                  <Wifi className="h-3 w-3" /> Reconnect
                </button>
              )}
            </div>
          </>
        ) : (
          <span className="text-xs text-slate-500">Local pane</span>
        )}
      </div>

      {searchOpen && (
        <div className="flex h-9 items-center gap-2 border-b border-white/[0.04] bg-ink-900 px-3">
          <Search className="h-3.5 w-3.5 text-slate-400" />
          <input
            autoFocus
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              searchRef.current?.findNext(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (e.shiftKey) searchRef.current?.findPrevious(searchTerm);
                else searchRef.current?.findNext(searchTerm);
              }
            }}
            placeholder="Find in terminal"
            className="h-7 flex-1 rounded bg-ink-700 px-2 text-xs outline-none placeholder:text-slate-500"
          />
          <button
            onClick={() => setSearchOpen(false)}
            className="rounded p-1 text-slate-400 hover:bg-white/10"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      <div ref={containerRef} className="min-h-0 flex-1" />

      <AutocompletePopup
        suggestions={autocomplete.suggestions}
        selectedIndex={autocomplete.selectedIndex}
        visible={autocomplete.visible}
        position={popupPos}
        onSelect={handleAutocompleteSelect}
        onSelectIndex={autocomplete.selectIndex}
      />
    </div>
  );
}

function X({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
