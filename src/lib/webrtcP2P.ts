import { apiFetch } from './apiFetch';

export type P2PConnectionState = 'idle' | 'offering' | 'waitingForAnswer' | 'connected' | 'failed';

export interface P2PSignalMessage {
  id: string;
  from: string;
  type: 'offer' | 'answer' | 'ice-candidate';
  data: {
    sdp?: string;
    candidate?: string;
    sdpMid?: string | null;
    sdpMLineIndex?: number | null;
    sessionName?: string;
  };
  createdAt: string;
}

const STUN_SERVERS: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];
const POLL_INTERVAL_MS = 4000;

export class WebRTCP2PSession {
  private accessToken: string;
  private pc: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private peerId: string | null = null;
  private seenMessageIds = new Set<string>();

  state: P2PConnectionState = 'idle';
  pendingOffers: P2PSignalMessage[] = [];

  onStateChange: (state: P2PConnectionState) => void = () => {};
  onPendingOffersChange: (offers: P2PSignalMessage[]) => void = () => {};
  onData: (text: string) => void = () => {};
  onError: (message: string) => void = () => {};

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  updateToken(accessToken: string) {
    this.accessToken = accessToken;
  }

  private setState(state: P2PConnectionState) {
    this.state = state;
    this.onStateChange(state);
  }

  private async signal(to: string, type: P2PSignalMessage['type'], data: P2PSignalMessage['data']) {
    const res = await apiFetch('/api/p2p/signal', this.accessToken, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, type, data }),
    });
    if (!res.ok) throw new Error(`Signal failed: ${res.status}`);
    return res.json() as Promise<{ messageId: string; expiresAt: string }>;
  }

  private createPeerConnection(remotePeerId: string): RTCPeerConnection {
    const pc = new RTCPeerConnection({ iceServers: STUN_SERVERS });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.signal(remotePeerId, 'ice-candidate', {
          candidate: event.candidate.candidate,
          sdpMid: event.candidate.sdpMid,
          sdpMLineIndex: event.candidate.sdpMLineIndex,
        }).catch((err) => this.onError(err instanceof Error ? err.message : 'ICE signal failed'));
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        this.setState('connected');
      } else if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        this.setState('failed');
      }
    };

    pc.ondatachannel = (event) => {
      this.wireDataChannel(event.channel);
    };

    this.pc = pc;
    this.peerId = remotePeerId;
    return pc;
  }

  private wireDataChannel(channel: RTCDataChannel) {
    this.dataChannel = channel;
    channel.onmessage = (event) => this.onData(event.data);
    channel.onopen = () => this.setState('connected');
  }

  async sendOffer(toPeerId: string, sessionName: string) {
    this.setState('offering');
    try {
      const pc = this.createPeerConnection(toPeerId);
      const channel = pc.createDataChannel('terminal');
      this.wireDataChannel(channel);

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      await this.signal(toPeerId, 'offer', { sdp: offer.sdp, sessionName });
      this.setState('waitingForAnswer');
    } catch (err) {
      this.onError(err instanceof Error ? err.message : 'Failed to send offer');
      this.setState('failed');
    }
  }

  async acceptOffer(message: P2PSignalMessage) {
    try {
      const pc = this.createPeerConnection(message.from);
      await pc.setRemoteDescription({ type: 'offer', sdp: message.data.sdp });

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      await this.signal(message.from, 'answer', { sdp: answer.sdp });
      this.removePendingOffer(message.id);
      this.setState('connected');
    } catch (err) {
      this.onError(err instanceof Error ? err.message : 'Failed to accept offer');
      this.setState('failed');
    }
  }

  async declineOffer(messageId: string) {
    try {
      await apiFetch(`/api/p2p/signal/${messageId}`, this.accessToken, { method: 'DELETE' });
    } catch {
      // best-effort
    }
    this.removePendingOffer(messageId);
  }

  private removePendingOffer(messageId: string) {
    this.pendingOffers = this.pendingOffers.filter((m) => m.id !== messageId);
    this.onPendingOffersChange(this.pendingOffers);
  }

  send(text: string) {
    if (this.dataChannel?.readyState === 'open') {
      this.dataChannel.send(text);
    }
  }

  disconnect() {
    this.dataChannel?.close();
    this.pc?.close();
    this.dataChannel = null;
    this.pc = null;
    this.peerId = null;
    this.setState('idle');
  }

  startPolling() {
    if (this.pollTimer) return;
    this.pollOnce();
    this.pollTimer = setInterval(() => this.pollOnce(), POLL_INTERVAL_MS);
  }

  stopPolling() {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = null;
  }

  private async pollOnce() {
    try {
      const res = await apiFetch('/api/p2p/messages', this.accessToken);
      if (!res.ok) return;
      const data = (await res.json()) as { messages: P2PSignalMessage[] };

      for (const msg of data.messages) {
        if (this.seenMessageIds.has(msg.id)) continue;
        this.seenMessageIds.add(msg.id);

        if (msg.type === 'offer') {
          this.pendingOffers = [...this.pendingOffers, msg];
          this.onPendingOffersChange(this.pendingOffers);
        } else if (msg.type === 'answer' && this.pc && this.state === 'waitingForAnswer') {
          await this.pc.setRemoteDescription({ type: 'answer', sdp: msg.data.sdp });
        } else if (msg.type === 'ice-candidate' && this.pc && msg.from === this.peerId) {
          await this.pc.addIceCandidate({
            candidate: msg.data.candidate,
            sdpMid: msg.data.sdpMid ?? undefined,
            sdpMLineIndex: msg.data.sdpMLineIndex ?? undefined,
          });
        }
      }
    } catch {
      // transient network error; next poll will retry
    }
  }
}
