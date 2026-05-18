/**
 * WebRTCMeshManager — Manages multiple RTCPeerConnections for MESH topology.
 *
 * Each user creates (n-1) peer connections to every other participant.
 * The "polite peer" pattern is used to handle offer collisions:
 *   - The user with the lexicographically SMALLER userId is the "polite" peer.
 *   - When both sides send offers simultaneously, the polite peer rolls back.
 */

import { socketService } from '@/lib/socket';
import { useCallStore } from '@/stores/callStore';

// ─────────────────────────────────────────────────
// ICE Servers
// ─────────────────────────────────────────────────

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

const RTC_CONFIG: RTCConfiguration = {
  iceServers: ICE_SERVERS,
  iceCandidatePoolSize: 4,
};

// ─────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────

interface PeerState {
  pc: RTCPeerConnection;
  makingOffer: boolean;
  ignoreOffer: boolean;
  pendingCandidates: RTCIceCandidateInit[];
}

type SpeakerCallback = (userId: string | null) => void;

// ─────────────────────────────────────────────────
// Manager
// ─────────────────────────────────────────────────

export class WebRTCMeshManager {
  private peers = new Map<string, PeerState>();
  private localStream: MediaStream | null = null;
  private localUserId: string;
  private roomId: string;
  private speakerDetectionInterval: ReturnType<typeof setInterval> | null = null;
  private audioAnalysers = new Map<string, { analyser: AnalyserNode; ctx: AudioContext }>();

  constructor(localUserId: string, roomId: string) {
    this.localUserId = localUserId;
    this.roomId = roomId;
  }

  // ───────────── Local Stream ─────────────

  async initLocalStream(callType: 'audio' | 'video'): Promise<MediaStream> {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: callType === 'video',
    });
    this.localStream = stream;
    useCallStore.getState().setGroupLocalStream(stream);
    return stream;
  }

  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  // ───────────── Peer Connection ─────────────

  /**
   * Create a new peer connection for a specific remote user.
   * If `createOffer` is true, we initiate the offer (we are the new joiner or caller).
   */
  async createPeerConnection(remoteUserId: string, createOffer: boolean): Promise<RTCPeerConnection> {
    // Close existing connection if any (prevent duplicates)
    if (this.peers.has(remoteUserId)) {
      this.closePeer(remoteUserId);
    }

    const pc = new RTCPeerConnection(RTC_CONFIG);
    const peerState: PeerState = {
      pc,
      makingOffer: false,
      ignoreOffer: false,
      pendingCandidates: [],
    };
    this.peers.set(remoteUserId, peerState);

    // Add local tracks to peer connection
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        pc.addTrack(track, this.localStream!);
      });
    }

    // Handle remote tracks
    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      if (remoteStream) {
        useCallStore.getState().addGroupRemoteStream(remoteUserId, remoteStream);
      }
    };

    // ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketService.getSocket()?.emit('webrtc:ice-candidate', {
          toUserId: remoteUserId,
          candidate: event.candidate.toJSON(),
          roomId: this.roomId,
        });
      }
    };

    // Offers are created explicitly by the joining peer. Letting this handler
    // auto-send offers can make both sides send offers at the same time.
    pc.onnegotiationneeded = null;

    // Connection state monitoring
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      console.log(`[WebRTC] Connection state with ${remoteUserId}: ${state}`);
      
      if (state === 'connected') {
        useCallStore.getState().setGroupCallStatus('in-call');
      } else if (state === 'failed' || state === 'closed') {
        // Peer disconnected — cleanup will be triggered by server event
        console.warn(`[WebRTC] Connection ${state} with ${remoteUserId}`);
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`[WebRTC] ICE state with ${remoteUserId}: ${pc.iceConnectionState}`);
    };

    // Create and send offer if we're the initiator
    if (createOffer) {
      try {
        peerState.makingOffer = true;
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socketService.getSocket()?.emit('webrtc:offer', {
          toUserId: remoteUserId,
          offer: pc.localDescription,
          roomId: this.roomId,
        });
      } catch (err) {
        console.error(`[WebRTC] Create offer error for ${remoteUserId}:`, err);
      } finally {
        peerState.makingOffer = false;
      }
    }

    return pc;
  }

  // ───────────── Signaling Handlers ─────────────

  /**
   * Handle incoming offer — polite peer pattern
   */
  async handleOffer(fromUserId: string, offer: RTCSessionDescriptionInit): Promise<void> {
    let peerState = this.peers.get(fromUserId);

    // If no peer exists yet, create one (we didn't initiate)
    if (!peerState) {
      await this.createPeerConnection(fromUserId, false);
      peerState = this.peers.get(fromUserId);
    }

    if (!peerState) return;

    const { pc } = peerState;

    // Polite peer pattern: the user with smaller userId is "polite"
    const isPolite = this.localUserId < fromUserId;
    const offerCollision = peerState.makingOffer || pc.signalingState !== 'stable';

    peerState.ignoreOffer = !isPolite && offerCollision;
    if (peerState.ignoreOffer) {
      console.log(`[WebRTC] Ignoring colliding offer from ${fromUserId} (we are impolite)`);
      return;
    }

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));

      // Flush pending ICE candidates
      for (const candidate of peerState.pendingCandidates) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.warn('[WebRTC] Failed to add pending ICE candidate:', e);
        }
      }
      peerState.pendingCandidates = [];

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socketService.getSocket()?.emit('webrtc:answer', {
        toUserId: fromUserId,
        answer: pc.localDescription,
        roomId: this.roomId,
      });
    } catch (err) {
      console.error(`[WebRTC] Handle offer error from ${fromUserId}:`, err);
    }
  }

  /**
   * Handle incoming answer
   */
  async handleAnswer(fromUserId: string, answer: RTCSessionDescriptionInit): Promise<void> {
    const peerState = this.peers.get(fromUserId);
    if (!peerState) return;

    try {
      await peerState.pc.setRemoteDescription(new RTCSessionDescription(answer));

      // Flush pending ICE candidates
      for (const candidate of peerState.pendingCandidates) {
        try {
          await peerState.pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.warn('[WebRTC] Failed to add pending ICE candidate:', e);
        }
      }
      peerState.pendingCandidates = [];
    } catch (err) {
      console.error(`[WebRTC] Handle answer error from ${fromUserId}:`, err);
    }
  }

  /**
   * Handle incoming ICE candidate
   */
  async handleIceCandidate(fromUserId: string, candidate: RTCIceCandidateInit): Promise<void> {
    const peerState = this.peers.get(fromUserId);
    if (!peerState) return;

    // If remote description isn't set yet, queue the candidate
    if (!peerState.pc.remoteDescription) {
      peerState.pendingCandidates.push(candidate);
      return;
    }

    try {
      await peerState.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      if (!peerState.ignoreOffer) {
        console.warn(`[WebRTC] ICE candidate error from ${fromUserId}:`, err);
      }
    }
  }

  // ───────────── Media Controls ─────────────

  toggleMute(): boolean {
    if (!this.localStream) return false;
    const audioTrack = this.localStream.getAudioTracks()[0];
    if (!audioTrack) return false;

    const newMuted = audioTrack.enabled;
    audioTrack.enabled = !newMuted;
    useCallStore.getState().setGroupMuted(newMuted);

    // Notify server
    socketService.getSocket()?.emit('group:media-toggle', {
      roomId: this.roomId,
      isMuted: newMuted,
    });

    return newMuted;
  }

  toggleVideo(): boolean {
    if (!this.localStream) return false;
    const videoTrack = this.localStream.getVideoTracks()[0];
    if (!videoTrack) return false;

    const newVideoOff = videoTrack.enabled;
    videoTrack.enabled = !newVideoOff;
    useCallStore.getState().setGroupVideoOff(newVideoOff);

    // Notify server
    socketService.getSocket()?.emit('group:media-toggle', {
      roomId: this.roomId,
      isVideoOff: newVideoOff,
    });

    return newVideoOff;
  }

  // ───────────── Screen Sharing ─────────────

  async startScreenShare(): Promise<boolean> {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });

      const screenTrack = screenStream.getVideoTracks()[0];
      if (!screenTrack) return false;

      // Replace video track in all peer connections
      for (const [, peerState] of this.peers) {
        const sender = peerState.pc.getSenders().find((s) => s.track?.kind === 'video');
        if (sender) {
          await sender.replaceTrack(screenTrack);
        }
      }

      // Handle screen share stop (user clicks "Stop Sharing" in browser)
      screenTrack.onended = () => {
        this.stopScreenShare();
      };

      useCallStore.getState().setGroupScreenSharing(true, screenStream);
      return true;
    } catch (err) {
      console.warn('[WebRTC] Screen share failed:', err);
      return false;
    }
  }

  async stopScreenShare(): Promise<void> {
    const store = useCallStore.getState();
    const screenStream = store.groupCall.screenStream;

    if (screenStream) {
      screenStream.getTracks().forEach((t) => t.stop());
    }

    // Restore camera track
    if (this.localStream) {
      const cameraTrack = this.localStream.getVideoTracks()[0];
      if (cameraTrack) {
        for (const [, peerState] of this.peers) {
          const sender = peerState.pc.getSenders().find((s) => s.track?.kind === 'video');
          if (sender) {
            await sender.replaceTrack(cameraTrack);
          }
        }
      }
    }

    store.setGroupScreenSharing(false, null);
  }

  // ───────────── Active Speaker Detection ─────────────

  startSpeakerDetection(callback: SpeakerCallback): void {
    this.stopSpeakerDetection();

    this.speakerDetectionInterval = setInterval(() => {
      let maxVolume = 0;
      let speakerId: string | null = null;

      // Check local audio
      if (this.localStream && !useCallStore.getState().groupCall.isMuted) {
        const localVolume = this.getStreamVolume(this.localStream, '_local');
        if (localVolume > maxVolume && localVolume > 15) { // threshold
          maxVolume = localVolume;
          speakerId = this.localUserId;
        }
      }

      // Check remote audio
      const remoteStreams = useCallStore.getState().groupCall.remoteStreams;
      for (const [userId, stream] of Object.entries(remoteStreams)) {
        const volume = this.getStreamVolume(stream, userId);
        if (volume > maxVolume && volume > 15) {
          maxVolume = volume;
          speakerId = userId;
        }
      }

      callback(speakerId);
    }, 500);
  }

  private getStreamVolume(stream: MediaStream, key: string): number {
    try {
      let entry = this.audioAnalysers.get(key);

      if (!entry) {
        const ctx = new AudioContext();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        const source = ctx.createMediaStreamSource(stream);
        source.connect(analyser);
        entry = { analyser, ctx };
        this.audioAnalysers.set(key, entry);
      }

      const dataArray = new Uint8Array(entry.analyser.frequencyBinCount);
      entry.analyser.getByteFrequencyData(dataArray);

      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }

      return sum / dataArray.length;
    } catch {
      return 0;
    }
  }

  stopSpeakerDetection(): void {
    if (this.speakerDetectionInterval) {
      clearInterval(this.speakerDetectionInterval);
      this.speakerDetectionInterval = null;
    }

    for (const [, entry] of this.audioAnalysers) {
      try {
        entry.ctx.close();
      } catch {
        // noop
      }
    }
    this.audioAnalysers.clear();
  }

  // ───────────── Cleanup ─────────────

  closePeer(userId: string): void {
    const peerState = this.peers.get(userId);
    if (!peerState) return;

    try {
      peerState.pc.close();
    } catch {
      // noop
    }

    this.peers.delete(userId);
    useCallStore.getState().removeGroupRemoteStream(userId);

    // Cleanup analyser
    const analyserEntry = this.audioAnalysers.get(userId);
    if (analyserEntry) {
      try {
        analyserEntry.ctx.close();
      } catch {
        // noop
      }
      this.audioAnalysers.delete(userId);
    }
  }

  closeAll(): void {
    this.stopSpeakerDetection();

    for (const [userId] of this.peers) {
      this.closePeer(userId);
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
    }

    // Cleanup local analyser
    const localEntry = this.audioAnalysers.get('_local');
    if (localEntry) {
      try {
        localEntry.ctx.close();
      } catch {
        // noop
      }
      this.audioAnalysers.delete('_local');
    }
  }

  // ───────────── Getters ─────────────

  getPeer(userId: string): RTCPeerConnection | undefined {
    return this.peers.get(userId)?.pc;
  }

  getPeerCount(): number {
    return this.peers.size;
  }

  getRoomId(): string {
    return this.roomId;
  }
}
