import { OfflineChange } from './OfflineSyncService.js';

export interface PeerInfo {
  id: string;
  name: string;
  lastSeen: number;
  isConnected: boolean;
}

export interface P2PSyncMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'changes' | 'sync-request' | 'sync-response';
  from: string;
  to?: string;
  data: Record<string, unknown>;
  timestamp: number;
}

export interface SyncVector {
  deviceId: string;
  timestamp: number;
  changeCount: number;
}

export class P2PSyncService {
  private peers: Map<string, RTCPeerConnection> = new Map();
  private dataChannels: Map<string, RTCDataChannel> = new Map();
  private peerInfo: Map<string, PeerInfo> = new Map();
  private syncVectors: Map<string, SyncVector> = new Map();
  private deviceId: string;
  private eventListeners: Map<string, Set<(data: any) => void>> = new Map();

  constructor(deviceId: string, _signalServer: string = 'ws://localhost:8787/ws/p2p') {
    this.deviceId = deviceId;
  }

  async initialize(): Promise<void> {
    this.eventListeners.set('peer-connected', new Set());
    this.eventListeners.set('peer-disconnected', new Set());
    this.eventListeners.set('changes-received', new Set());
    this.eventListeners.set('sync-request', new Set());
  }

  async connectToPeer(peerId: string): Promise<void> {
    if (this.peers.has(peerId)) {
      return;
    }

    const peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: ['stun:stun.l.google.com:19302'] }],
    });

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignalingMessage({
          type: 'ice-candidate',
          from: this.deviceId,
          to: peerId,
          data: { candidate: event.candidate },
          timestamp: Date.now(),
        });
      }
    };

    peerConnection.onconnectionstatechange = () => {
      if (peerConnection.connectionState === 'connected') {
        this.emitEvent('peer-connected', { peerId, isInitiator: true });
      } else if (peerConnection.connectionState === 'failed' || peerConnection.connectionState === 'disconnected') {
        this.disconnectFromPeer(peerId);
        this.emitEvent('peer-disconnected', { peerId });
      }
    };

    const dataChannel = peerConnection.createDataChannel('sync', { ordered: true });
    this.setupDataChannel(peerId, dataChannel);

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    this.peers.set(peerId, peerConnection);

    this.sendSignalingMessage({
      type: 'offer',
      from: this.deviceId,
      to: peerId,
      data: { sdp: peerConnection.localDescription },
      timestamp: Date.now(),
    });
  }

  async handleSignalingMessage(message: P2PSyncMessage): Promise<void> {
    const { type, from, data } = message;

    switch (type) {
      case 'offer':
        await this.handleOffer(from, data as { sdp: RTCSessionDescription });
        break;
      case 'answer':
        await this.handleAnswer(from, data as { sdp: RTCSessionDescription });
        break;
      case 'ice-candidate':
        await this.handleIceCandidate(from, data as { candidate: RTCIceCandidate });
        break;
      case 'changes':
        this.handleRemoteChanges(from, data as { changes: OfflineChange[] });
        break;
      case 'sync-request':
        this.emitEvent('sync-request', { peerId: from, data });
        break;
    }
  }

  async sendChangesToPeer(peerId: string, changes: OfflineChange[]): Promise<void> {
    const channel = this.dataChannels.get(peerId);
    if (!channel || channel.readyState !== 'open') {
      throw new Error(`Data channel not open for peer ${peerId}`);
    }

    const message: P2PSyncMessage = {
      type: 'changes',
      from: this.deviceId,
      to: peerId,
      data: { changes },
      timestamp: Date.now(),
    };

    const serialized = JSON.stringify(message);
    if (serialized.length > 16384) {
      const chunks = this.splitMessage(serialized, 16384);
      for (let i = 0; i < chunks.length; i++) {
        channel.send(JSON.stringify({ chunk: i, total: chunks.length, data: chunks[i] }));
      }
    } else {
      channel.send(serialized);
    }

    this.updateSyncVector(peerId, changes.length);
  }

  async requestSyncFromPeer(peerId: string): Promise<void> {
    const channel = this.dataChannels.get(peerId);
    if (!channel || channel.readyState !== 'open') {
      throw new Error(`Data channel not open for peer ${peerId}`);
    }

    const message: P2PSyncMessage = {
      type: 'sync-request',
      from: this.deviceId,
      to: peerId,
      data: { lastSync: await this.getLastSyncTime(peerId) },
      timestamp: Date.now(),
    };

    channel.send(JSON.stringify(message));
  }

  getConnectedPeers(): PeerInfo[] {
    return Array.from(this.peerInfo.values()).filter((p) => p.isConnected);
  }

  on(event: string, listener: (data: any) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(listener);
  }

  off(event: string, listener: (data: any) => void): void {
    this.eventListeners.get(event)?.delete(listener);
  }

  private async handleOffer(peerId: string, data: { sdp: RTCSessionDescription }): Promise<void> {
    let peerConnection = this.peers.get(peerId);

    if (!peerConnection) {
      peerConnection = new RTCPeerConnection({
        iceServers: [{ urls: ['stun:stun.l.google.com:19302'] }],
      });

      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          this.sendSignalingMessage({
            type: 'ice-candidate',
            from: this.deviceId,
            to: peerId,
            data: { candidate: event.candidate },
            timestamp: Date.now(),
          });
        }
      };

      peerConnection.ondatachannel = (event) => {
        this.setupDataChannel(peerId, event.channel);
      };

      peerConnection.onconnectionstatechange = () => {
        if (peerConnection!.connectionState === 'connected') {
          this.emitEvent('peer-connected', { peerId, isInitiator: false });
        } else if (peerConnection!.connectionState === 'failed' || peerConnection!.connectionState === 'disconnected') {
          this.disconnectFromPeer(peerId);
          this.emitEvent('peer-disconnected', { peerId });
        }
      };

      this.peers.set(peerId, peerConnection);
    }

    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));

    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    this.sendSignalingMessage({
      type: 'answer',
      from: this.deviceId,
      to: peerId,
      data: { sdp: peerConnection.localDescription },
      timestamp: Date.now(),
    });
  }

  private async handleAnswer(peerId: string, data: { sdp: RTCSessionDescription }): Promise<void> {
    const peerConnection = this.peers.get(peerId);
    if (!peerConnection) {
      throw new Error(`No peer connection for ${peerId}`);
    }

    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
  }

  private async handleIceCandidate(peerId: string, data: { candidate: RTCIceCandidate }): Promise<void> {
    const peerConnection = this.peers.get(peerId);
    if (!peerConnection) {
      throw new Error(`No peer connection for ${peerId}`);
    }

    await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
  }

  private setupDataChannel(peerId: string, channel: RTCDataChannel): void {
    channel.binaryType = 'arraybuffer';

    channel.onopen = () => {
      const peerInfo = this.peerInfo.get(peerId) || { id: peerId, name: peerId, lastSeen: Date.now(), isConnected: false };
      peerInfo.isConnected = true;
      peerInfo.lastSeen = Date.now();
      this.peerInfo.set(peerId, peerInfo);
    };

    channel.onclose = () => {
      const peerInfo = this.peerInfo.get(peerId);
      if (peerInfo) {
        peerInfo.isConnected = false;
      }
    };

    channel.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.chunk !== undefined) {
          return;
        }
        this.handleSignalingMessage(message);
      } catch (error) {
        console.error('Failed to parse P2P message:', error);
      }
    };

    this.dataChannels.set(peerId, channel);
  }

  private handleRemoteChanges(peerId: string, data: { changes: OfflineChange[] }): void {
    this.updateSyncVector(peerId, data.changes.length);
    this.emitEvent('changes-received', { peerId, changes: data.changes });
  }

  private updateSyncVector(peerId: string, changeCount: number): void {
    const vector: SyncVector = {
      deviceId: peerId,
      timestamp: Date.now(),
      changeCount,
    };
    this.syncVectors.set(peerId, vector);
  }

  private async getLastSyncTime(peerId: string): Promise<number> {
    const vector = this.syncVectors.get(peerId);
    return vector?.timestamp || 0;
  }

  private disconnectFromPeer(peerId: string): void {
    const peerConnection = this.peers.get(peerId);
    if (peerConnection) {
      peerConnection.close();
      this.peers.delete(peerId);
    }

    const channel = this.dataChannels.get(peerId);
    if (channel) {
      channel.close();
      this.dataChannels.delete(peerId);
    }

    const peerInfo = this.peerInfo.get(peerId);
    if (peerInfo) {
      peerInfo.isConnected = false;
    }
  }

  private splitMessage(message: string, chunkSize: number): string[] {
    const chunks: string[] = [];
    for (let i = 0; i < message.length; i += chunkSize) {
      chunks.push(message.substr(i, chunkSize));
    }
    return chunks;
  }

  private sendSignalingMessage(message: P2PSyncMessage): void {
    window.dispatchEvent(
      new CustomEvent('p2p:signaling', {
        detail: message,
      })
    );
  }

  private emitEvent(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach((listener) => listener(data));
    }
  }
}
