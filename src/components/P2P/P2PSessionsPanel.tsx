import { useState, useEffect, useRef, useCallback } from 'react';
import { AlertCircle, Wifi, WifiOff } from '@/lib/icons';
import { useStore } from '../../lib/store';
import { WebRTCP2PSession, type P2PConnectionState, type P2PSignalMessage } from '../../lib/webrtcP2P';

export function P2PSessionsPanel() {
  const accessToken = useStore((s) => s.auth.accessToken);
  const sessionRef = useRef<WebRTCP2PSession | null>(null);

  const [state, setState] = useState<P2PConnectionState>('idle');
  const [pendingOffers, setPendingOffers] = useState<P2PSignalMessage[]>([]);
  const [connectedPeerId, setConnectedPeerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showConnect, setShowConnect] = useState(false);
  const [peerIdInput, setPeerIdInput] = useState('');
  const [sessionNameInput, setSessionNameInput] = useState('Shared Terminal');
  const [messages, setMessages] = useState<Array<{ from: 'me' | 'peer'; text: string }>>([]);
  const [messageInput, setMessageInput] = useState('');

  useEffect(() => {
    if (!accessToken) return;
    const session = new WebRTCP2PSession(accessToken);
    session.onStateChange = (s) => {
      setState(s);
      if (s === 'connected') setError(null);
    };
    session.onPendingOffersChange = (offers) => setPendingOffers([...offers]);
    session.onData = (text) => setMessages((prev) => [...prev, { from: 'peer', text }]);
    session.onError = (msg) => setError(msg);
    session.startPolling();
    sessionRef.current = session;

    return () => {
      session.stopPolling();
      session.disconnect();
      sessionRef.current = null;
    };
  }, [accessToken]);

  useEffect(() => {
    sessionRef.current?.updateToken(accessToken || '');
  }, [accessToken]);

  const handleConnect = useCallback(async () => {
    if (!peerIdInput.trim() || !sessionRef.current) return;
    setConnectedPeerId(peerIdInput.trim());
    setShowConnect(false);
    await sessionRef.current.sendOffer(peerIdInput.trim(), sessionNameInput);
  }, [peerIdInput, sessionNameInput]);

  const handleAccept = useCallback(async (msg: P2PSignalMessage) => {
    setConnectedPeerId(msg.from);
    await sessionRef.current?.acceptOffer(msg);
  }, []);

  const handleDecline = useCallback(async (messageId: string) => {
    await sessionRef.current?.declineOffer(messageId);
  }, []);

  const handleDisconnect = useCallback(() => {
    sessionRef.current?.disconnect();
    setConnectedPeerId(null);
    setMessages([]);
  }, []);

  const handleSend = useCallback(() => {
    if (!messageInput.trim()) return;
    sessionRef.current?.send(messageInput);
    setMessages((prev) => [...prev, { from: 'me', text: messageInput }]);
    setMessageInput('');
  }, [messageInput]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">P2P Sessions</h3>
          <p className="text-xs text-slate-400">
            Direct encrypted WebRTC connection for live shared terminal access.
          </p>
        </div>
        {!showConnect && state === 'idle' && (
          <button onClick={() => setShowConnect(true)} className="btn-primary text-xs px-3 py-1.5">
            Connect to Peer
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-terminal-red/20 bg-terminal-red/[0.06] p-3">
          <AlertCircle className="h-4 w-4 text-terminal-red" />
          <p className="text-xs text-terminal-red/80">{error}</p>
        </div>
      )}

      {showConnect && (
        <div className="rounded-lg border border-white/[0.08] bg-ink-900/60 p-4 space-y-3">
          <div>
            <label className="label">Peer user ID or email</label>
            <input
              className="input"
              value={peerIdInput}
              onChange={(e) => setPeerIdInput(e.target.value)}
              placeholder="user-id or email"
              autoFocus
            />
          </div>
          <div>
            <label className="label">Session name</label>
            <input
              className="input"
              value={sessionNameInput}
              onChange={(e) => setSessionNameInput(e.target.value)}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowConnect(false)} className="btn-ghost text-xs px-3 py-1.5">
              Cancel
            </button>
            <button
              onClick={handleConnect}
              disabled={!peerIdInput.trim()}
              className="btn-primary text-xs px-3 py-1.5 disabled:opacity-50"
            >
              Send Request
            </button>
          </div>
        </div>
      )}

      {pendingOffers.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-400">Incoming Requests</p>
          {pendingOffers.map((msg) => (
            <div
              key={msg.id}
              className="flex items-center justify-between rounded-lg border border-neon/25 bg-neon/[0.04] p-3"
            >
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-200 truncate">From: {msg.from}</p>
                {msg.data.sessionName && (
                  <p className="text-[11px] text-neon/80">{msg.data.sessionName}</p>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => handleAccept(msg)} className="btn-primary text-xs px-3 py-1">
                  Accept
                </button>
                <button
                  onClick={() => handleDecline(msg.id)}
                  className="rounded-md border border-terminal-red/30 px-3 py-1 text-xs text-terminal-red hover:bg-terminal-red/10"
                >
                  Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {state !== 'idle' && (
        <div className="rounded-lg border border-white/[0.08] bg-ink-900/60 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {state === 'connected' ? (
                <Wifi className="h-4 w-4 text-green-400" />
              ) : state === 'failed' ? (
                <WifiOff className="h-4 w-4 text-terminal-red" />
              ) : (
                <Wifi className="h-4 w-4 text-amber-400 animate-pulse" />
              )}
              <span className="text-xs text-slate-200">
                {state === 'offering' && 'Sending offer…'}
                {state === 'waitingForAnswer' && 'Waiting for peer to accept…'}
                {state === 'connected' && `Connected to ${connectedPeerId}`}
                {state === 'failed' && 'Connection failed'}
              </span>
            </div>
            <button
              onClick={handleDisconnect}
              className="text-xs text-terminal-red hover:underline"
            >
              Disconnect
            </button>
          </div>

          {state === 'connected' && (
            <div className="mt-3 space-y-2">
              <div className="max-h-40 overflow-y-auto rounded-md border border-white/[0.06] bg-black/30 p-2 space-y-1">
                {messages.length === 0 && (
                  <p className="text-[11px] text-slate-500">
                    Data channel open — send a message to test the live connection.
                  </p>
                )}
                {messages.map((m, i) => (
                  <p key={i} className={`text-xs ${m.from === 'me' ? 'text-neon' : 'text-slate-300'}`}>
                    <span className="opacity-60">{m.from === 'me' ? 'You: ' : 'Peer: '}</span>
                    {m.text}
                  </p>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  className="input flex-1"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Type a message…"
                />
                <button onClick={handleSend} className="btn-primary text-xs px-3">
                  Send
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
