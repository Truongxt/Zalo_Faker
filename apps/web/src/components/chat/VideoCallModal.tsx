import { useEffect, useRef, useState } from 'react';
import { useCallStore } from '@/stores/callStore';
import { useAuthStore } from '@/stores/authStore';
import { PhoneOff, Mic, MicOff, Video, VideoOff } from 'lucide-react';
import { socketService } from '@/lib/socket';

const AUDIO_RECORDER_MIME_CANDIDATES = [
  'audio/mp4;codecs=mp4a.40.2',
  'audio/mp4',
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
];

const pickSupportedRecorderMimeType = (): string | undefined => {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return undefined;
  }

  return AUDIO_RECORDER_MIME_CANDIDATES.find((mimeType) => MediaRecorder.isTypeSupported(mimeType));
};

const mergeFloat32Chunks = (chunks: Float32Array[]): Float32Array => {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const merged = new Float32Array(totalLength);
  let offset = 0;
  chunks.forEach((chunk) => {
    merged.set(chunk, offset);
    offset += chunk.length;
  });
  return merged;
};

const audioBufferToWavBlob = (pcmData: Float32Array, sampleRate: number): Blob => {
  const bytesPerSample = 2;
  const blockAlign = bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = pcmData.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  let writeOffset = 44;
  for (let i = 0; i < pcmData.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, pcmData[i]));
    const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    view.setInt16(writeOffset, intSample, true);
    writeOffset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
};

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

export default function VideoCallModal() {
  const {
    isCalling,
    callData,
    clearCall,
    localStream,
    setLocalStream,
  } = useCallStore();
  const { user } = useAuthStore();

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isRemoteAccepted, setIsRemoteAccepted] = useState(false);
  const isRemoteAcceptedRef = useRef(false);
  const acceptedAtRef = useRef<number | null>(null);
  const [remoteFrames, setRemoteFrames] = useState<Record<string, string>>({});
  const streamIntervalRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioCaptureCleanupRef = useRef<(() => void) | null>(null);
  const activeAudioPlayersRef = useRef<Set<HTMLAudioElement>>(new Set());
  const audioObjectUrlsRef = useRef<Set<string>>(new Set());
  const audioContextRef = useRef<AudioContext | null>(null);
  const outboundAudioChunkCountRef = useRef(0);

  const targetUserId = callData?.isCaller ? callData?.toUserId : callData?.fromUserId;

  const cleanupRemoteAudioPlayers = () => {
    activeAudioPlayersRef.current.forEach((player) => {
      try {
        player.pause();
        player.src = '';
        player.load();
      } catch {
        // noop
      }
    });
    activeAudioPlayersRef.current.clear();

    audioObjectUrlsRef.current.forEach((url) => {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // noop
      }
    });
    audioObjectUrlsRef.current.clear();

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {
        // noop
      });
      audioContextRef.current = null;
    }
  };

  const playChunkWithAudioContext = async (blob: Blob) => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    const audioContext = audioContextRef.current;
    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }

    const buffer = await blob.arrayBuffer();
    const decoded = await audioContext.decodeAudioData(buffer.slice(0));
    const source = audioContext.createBufferSource();
    source.buffer = decoded;
    source.connect(audioContext.destination);
    source.start();
  };


  const markAccepted = () => {
    if (!acceptedAtRef.current) {
      acceptedAtRef.current = Date.now();
    }
  };

  const getCallDurationSeconds = () => {
    if (!acceptedAtRef.current) return 0;
    return Math.max(0, Math.floor((Date.now() - acceptedAtRef.current) / 1000));
  };

  const endCall = (notifyRemote = true) => {
    const state = useCallStore.getState();
    state.localStream?.getTracks().forEach((track) => track.stop());

    if (streamIntervalRef.current) clearInterval(streamIntervalRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (audioCaptureCleanupRef.current) {
      audioCaptureCleanupRef.current();
      audioCaptureCleanupRef.current = null;
    }
    cleanupRemoteAudioPlayers();
    
    setLocalStream(null);

    if (notifyRemote && (callData?.isGroupCall || targetUserId)) {
      const status =
        acceptedAtRef.current
          ? 'finished'
          : callData?.isCaller
            ? 'cancelled'
            : 'finished';

      const eventName = callData?.isGroupCall && acceptedAtRef.current ? 'video:leave-call' : 'video:end-call';

      socketService.getSocket()?.emit(eventName, {
        toUserId: callData?.isGroupCall ? undefined : targetUserId,
        fromUserId: user?.id,
        conversationId: callData?.conversationId,
        callType: callData?.callType || 'audio',
        isGroupCall: callData?.isGroupCall,
        status,
        duration: getCallDurationSeconds(),
      });
    }

    acceptedAtRef.current = null;
    clearCall();
  };

  useEffect(() => {
    if (!isCalling || !callData || !user) return;

    let mounted = true;
    setIsRemoteAccepted(false);
    isRemoteAcceptedRef.current = false;
    acceptedAtRef.current = null;

    const handleCallAnswered = async (data: any) => {
      if (!mounted || !callData.isCaller) return;
      if (!callData.isGroupCall && String(data?.toUserId || '') !== String(user.id)) return;
      setIsRemoteAccepted(true);
      isRemoteAcceptedRef.current = true;
      markAccepted();
    };

    const handleCallRejected = () => {
      alert('Nguoi dung da tu choi cuoc goi');
      endCall(false);
    };

    const handleCallEnded = () => {
      endCall(false);
    };

    const handleVideoFrame = (data: any) => {
      if (!mounted) return;
      if (String(data?.conversationId || '') !== String(callData.conversationId || '')) return;
      if (!callData.isGroupCall && String(data?.fromUserId || '') !== String(targetUserId || '')) return;
      
      if (!isRemoteAcceptedRef.current) {
        setIsRemoteAccepted(true);
        isRemoteAcceptedRef.current = true;
        markAccepted();
      }
      if (data.frame) {
         setRemoteFrames(prev => ({ ...prev, [data.fromUserId]: data.frame }));
      }
    };

    const handleAudioFrame = (data: any) => {
      if (!mounted) return;
      if (String(data?.conversationId || '') !== String(callData.conversationId || '')) return;
      if (!callData.isGroupCall && String(data?.fromUserId || '') !== String(targetUserId || '')) return;

      if (data.audio) {
        if (!isRemoteAcceptedRef.current) {
          setIsRemoteAccepted(true);
          isRemoteAcceptedRef.current = true;
          markAccepted();
        }

        try {
          const payload = String(data.audio);
          let base64Data = payload;
          if (payload.startsWith('data:')) {
            const commaIndex = payload.indexOf(',');
            if (commaIndex > 0) base64Data = payload.slice(commaIndex + 1);
          }

          const mimeType = typeof data?.audioMimeType === 'string' ? data.audioMimeType : 'audio/webm';
          
          const binaryString = atob(base64Data);
          const len = binaryString.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          const blob = new Blob([bytes], { type: mimeType });
          
          const objectUrl = URL.createObjectURL(blob);
          audioObjectUrlsRef.current.add(objectUrl);

          const player = new Audio(objectUrl);
          player.autoplay = true;
          player.volume = 1;

          activeAudioPlayersRef.current.add(player);

          const cleanup = () => {
            activeAudioPlayersRef.current.delete(player);
            if (audioObjectUrlsRef.current.has(objectUrl)) {
              audioObjectUrlsRef.current.delete(objectUrl);
              URL.revokeObjectURL(objectUrl);
            }
          };

          player.onended = cleanup;
          player.onerror = () => {
            playChunkWithAudioContext(blob)
              .catch((decodeErr) => {
                console.warn('[WEB] Audio decode fallback failed:', decodeErr);
              })
              .finally(cleanup);
          };
          
          player.play().catch(e => {
            console.warn('[WEB] Playback failed for chunk:', e);
            playChunkWithAudioContext(blob)
              .catch((decodeErr) => {
                console.warn('[WEB] Audio decode fallback failed:', decodeErr);
              })
              .finally(cleanup);
          });
        } catch (err) {
          console.warn('[WEB] handleAudioFrame failed:', err);
        }
      }
    };

    const handleUserLeft = (data: any) => {
      setRemoteFrames(prev => {
        const next = { ...prev };
        delete next[data.fromUserId];
        return next;
      });
    };

    const socket = socketService.getSocket();
    // Bind listeners before any emit to avoid missing fast "answered" responses.
    socket?.on('video:call-answered', handleCallAnswered);
    socket?.on('video:call-rejected', handleCallRejected);
    socket?.on('video:call-ended', handleCallEnded);
    socket?.on('video:user-left', handleUserLeft);
    socket?.on('video:frame', handleVideoFrame);
    socket?.on('video:audio-frame', handleAudioFrame);

    const initFakeWebRtc = async () => {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: callData.callType === 'video',
          audio: true,
        });
      } catch (err: any) {
        console.error('Failed to get camera/mic:', err);
        const name = String(err?.name || '');
        if (name === 'NotAllowedError' || name === 'SecurityError') {
          alert('Trinh duyet dang chan Camera/Microphone. Hay cap quyen roi thu lai.');
        } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
          alert('Khong tim thay thiet bi Camera/Microphone phu hop.');
        } else if (name === 'NotReadableError') {
          alert('Camera/Microphone dang duoc ung dung khac su dung.');
        } else {
          alert('Khong the truy cap Camera/Microphone. Vui long thu lai.');
        }
        endCall(false);
        return;
      }

      if (!mounted) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      try {
        setLocalStream(stream);

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // 1. Send signal
        if (callData.isCaller) {
          socket?.emit('video:call-user', {
            fromUserId: user.id,
            toUserId: callData.isGroupCall ? undefined : callData.toUserId,
            conversationId: callData.conversationId,
            callerName: user.fullName,
            callerAvatar: user.avatarUrl,
            callType: callData.callType,
            isGroupCall: callData.isGroupCall,
          });
        } else {
          socket?.emit('video:answer-call', {
            toUserId: callData.isGroupCall ? undefined : callData.fromUserId,
            fromUserId: user.id,
            conversationId: callData.conversationId,
            isGroupCall: callData.isGroupCall,
          });
          setIsRemoteAccepted(true);
          isRemoteAcceptedRef.current = true;
          markAccepted();
        }

        // 2. Start fake video stream
        if (callData.callType === 'video') {
            streamIntervalRef.current = setInterval(() => {
                if (!localVideoRef.current || !canvasRef.current || !socket || (!callData.isGroupCall && !targetUserId)) return;
                const canvas = canvasRef.current;
                const video = localVideoRef.current;
                const ctx = canvas.getContext('2d');
                if (ctx && video.videoWidth > 0 && isRemoteAcceptedRef.current) {
                    canvas.width = 360; 
                    canvas.height = (video.videoHeight / video.videoWidth) * 360;
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    
                    const frame = canvas.toDataURL('image/jpeg', 0.3); // low quality 
                    socket.emit('video:frame', {
                       toUserId: callData.isGroupCall ? undefined : targetUserId,
                       fromUserId: user.id,
                       conversationId: callData.conversationId,
                       isGroupCall: callData.isGroupCall,
                       frame
                    });
                }
            }, 400); // ~2.5 FPS for stability
        }

        // 3. Start real-time audio chunking (optional, do not fail whole call if codec unsupported)
        try {
          if (audioCaptureCleanupRef.current) {
            audioCaptureCleanupRef.current();
            audioCaptureCleanupRef.current = null;
          }

          const audioTracks = stream.getAudioTracks();
          if (!audioTracks.length) {
            console.warn('[WEB] No audio track available to record');
            return;
          }

          const audioOnlyStream = new MediaStream(audioTracks);
          const preferredMimeType = pickSupportedRecorderMimeType();
          if (preferredMimeType) {
            console.log('[WEB] Audio recorder mime type:', preferredMimeType);
          } else {
            console.warn('[WEB] Browser did not report a preferred audio recorder mime type');
          }
          const forceWavForMobileCompatibility = true;
          const canUseMp4Recorder = !forceWavForMobileCompatibility
            && Boolean(preferredMimeType && preferredMimeType.includes('mp4'));

          if (canUseMp4Recorder) {
            audioCaptureCleanupRef.current = null;
            const recorder = new MediaRecorder(audioOnlyStream, { mimeType: preferredMimeType });
            mediaRecorderRef.current = recorder;

            recorder.ondataavailable = async (event) => {
              if (event.data.size > 0 && socket && (callData.isGroupCall || targetUserId) && isRemoteAcceptedRef.current) {
                const chunkMimeType = event.data.type || recorder.mimeType || preferredMimeType || 'audio/mp4';
                const reader = new FileReader();
                reader.onloadend = () => {
                  const base64Audio = reader.result as string;
                socket.emit('video:audio-frame', {
                  toUserId: callData.isGroupCall ? undefined : targetUserId,
                  fromUserId: user.id,
                  conversationId: callData.conversationId,
                  isGroupCall: callData.isGroupCall,
                  audio: base64Audio,
                  audioMimeType: chunkMimeType,
                });
                outboundAudioChunkCountRef.current += 1;
                if (outboundAudioChunkCountRef.current % 5 === 0) {
                  console.log('[WEB] Sent audio chunks:', outboundAudioChunkCountRef.current, 'mime:', chunkMimeType);
                }
              };
                reader.readAsDataURL(event.data);
              }
            };

            const runStandaloneCycle = () => {
              if (!mounted || !isRemoteAcceptedRef.current) {
                if (mounted) setTimeout(runStandaloneCycle, 1000);
                return;
              }

              try {
                if (recorder.state === 'inactive') {
                  recorder.start();
                  setTimeout(() => {
                    if (recorder.state === 'recording') {
                      recorder.stop();
                    }
                  }, 1200);
                }
              } catch (e) {
                console.warn('[WEB] Recorder cycle error:', e);
              }
            };

            recorder.onstop = () => {
              if (mounted) {
                setTimeout(runStandaloneCycle, 100);
              }
            };

            runStandaloneCycle();
          } else {
            console.warn('[WEB] Using WAV fallback audio pipeline for mobile compatibility');
            const captureContext = new AudioContext();
            if (captureContext.state === 'suspended') {
              try {
                await captureContext.resume();
              } catch (resumeErr) {
                console.warn('[WEB] Failed to resume capture AudioContext:', resumeErr);
              }
            }
            const sourceNode = captureContext.createMediaStreamSource(audioOnlyStream);
            const processorNode = captureContext.createScriptProcessor(4096, 1, 1);
            const silentGain = captureContext.createGain();
            silentGain.gain.value = 0;

            const pcmChunks: Float32Array[] = [];
            sourceNode.connect(processorNode);
            processorNode.connect(silentGain);
            silentGain.connect(captureContext.destination);

            processorNode.onaudioprocess = (event) => {
              const channelData = event.inputBuffer.getChannelData(0);
              pcmChunks.push(new Float32Array(channelData));
            };

            const intervalId = window.setInterval(async () => {
              if (!mounted) return;
              if (!socket || (!callData.isGroupCall && !targetUserId)) return;
              if (!isRemoteAcceptedRef.current) {
                pcmChunks.length = 0;
                return;
              }
              if (!pcmChunks.length) return;

              try {
                const merged = mergeFloat32Chunks(pcmChunks.splice(0, pcmChunks.length));
                const wavBlob = audioBufferToWavBlob(merged, captureContext.sampleRate);
                const base64Audio = await blobToDataUrl(wavBlob);
                socket.emit('video:audio-frame', {
                  toUserId: callData.isGroupCall ? undefined : targetUserId,
                  fromUserId: user.id,
                  conversationId: callData.conversationId,
                  isGroupCall: callData.isGroupCall,
                  audio: base64Audio,
                  audioMimeType: 'audio/wav',
                });
                outboundAudioChunkCountRef.current += 1;
                if (outboundAudioChunkCountRef.current % 5 === 0) {
                  console.log('[WEB] Sent audio chunks:', outboundAudioChunkCountRef.current, 'mime: audio/wav');
                }
              } catch (fallbackErr) {
                console.warn('[WEB] WAV fallback emit failed:', fallbackErr);
              }
            }, 1200);

            audioCaptureCleanupRef.current = () => {
              window.clearInterval(intervalId);
              processorNode.onaudioprocess = null;
              try {
                sourceNode.disconnect();
              } catch {
                // noop
              }
              try {
                processorNode.disconnect();
              } catch {
                // noop
              }
              try {
                silentGain.disconnect();
              } catch {
                // noop
              }
              captureContext.close().catch(() => {
                // noop
              });
            };
          }
        } catch (audioErr) {
          console.warn('[WEB] MediaRecorder unavailable, continue call without audio chunk relay:', audioErr);
        }

      } catch (err) {
        console.error('Failed to initialize call pipeline:', err);
        endCall(false);
      }
    };

    initFakeWebRtc();

    return () => {
      mounted = false;
      if (streamIntervalRef.current) clearInterval(streamIntervalRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (audioCaptureCleanupRef.current) {
        audioCaptureCleanupRef.current();
        audioCaptureCleanupRef.current = null;
      }
      cleanupRemoteAudioPlayers();
      socket?.off('video:call-answered', handleCallAnswered);
      socket?.off('video:call-rejected', handleCallRejected);
      socket?.off('video:call-ended', handleCallEnded);
      socket?.off('video:user-left', handleUserLeft);
      socket?.off('video:frame', handleVideoFrame);
      socket?.off('video:audio-frame', handleAudioFrame);
    };
  }, [isCalling, callData, user?.id, user?.fullName, user?.avatarUrl, clearCall, setLocalStream]);

  const toggleMute = () => {
    if (localStream) {
      const track = localStream.getAudioTracks()[0];
      if (track) {
        track.enabled = isMuted;
        setIsMuted(!isMuted);
      }
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      const track = localStream.getVideoTracks()[0];
      if (track) {
        track.enabled = isVideoOff;
        setIsVideoOff(!isVideoOff);
      }
    }
  };

  if (!isCalling || !callData) return null;

  const isAudioCall = callData.callType === 'audio';

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black animate-in fade-in duration-300">
      <canvas ref={canvasRef} className="hidden" />
      <div className="absolute inset-0 w-full h-full">
        {isAudioCall ? (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gray-900 border-none">
            <div className="relative w-40 h-40">
              {callData?.callerAvatar ? (
                <img src={callData.callerAvatar} alt="avatar" className="w-full h-full rounded-full object-cover shadow-2xl border-4 border-primary-500 z-10 relative" />
              ) : (
                <div className="w-full h-full flex items-center justify-center rounded-full bg-primary-100 text-6xl text-primary-600 font-bold border-4 border-primary-500 z-10 relative">
                  {callData?.callerName?.charAt(0).toUpperCase() || 'U'}
                </div>
              )}
            </div>
          </div>
        ) : callData.isGroupCall ? (
          <div className={`w-full h-full grid gap-1 bg-gray-900 ${Object.keys(remoteFrames).length > 0 ? 'grid-cols-2 sm:grid-cols-2' : 'grid-cols-1'} auto-rows-fr`}>
             <div className="relative w-full h-full bg-gray-800">
               <video ref={localVideoRef} autoPlay playsInline muted className={`w-full h-full object-cover ${isVideoOff ? 'hidden' : ''}`} />
               {(isMuted || isVideoOff) && (
                 <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-2">
                   {isVideoOff && <VideoOff className="w-8 h-8 text-white" />}
                   {isMuted && <MicOff className="w-8 h-8 text-white" />}
                 </div>
               )}
               <div className="absolute bottom-4 left-4 bg-black/60 px-3 py-1.5 rounded-lg text-white text-sm font-medium backdrop-blur-sm">Bạn</div>
             </div>
             {Object.entries(remoteFrames).map(([userId, frame]) => (
               <div key={userId} className="relative w-full h-full bg-gray-800">
                 <img src={frame} className="w-full h-full object-cover" alt={`Remote Video ${userId}`} />
               </div>
             ))}
          </div>
        ) : Object.keys(remoteFrames).length > 0 ? (
          <div className="w-full h-full bg-gray-900">
             {Object.entries(remoteFrames).map(([userId, frame]) => (
               <img key={userId} src={frame} className="w-full h-full object-cover" alt={`Remote Video ${userId}`} />
             ))}
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gray-900">
            <div className={`w-24 h-24 rounded-full border-4 border-primary-500 mb-6 ${isRemoteAccepted ? 'border-t-primary-500' : 'border-t-transparent animate-spin'}`}></div>
            <p className="text-white text-xl animate-pulse">
              {isRemoteAccepted ? 'Dau ben kia da nhan cuoc goi' : 'Dang ket noi...'}
            </p>
          </div>
        )}
      </div>

      {!isAudioCall && !callData.isGroupCall && (
        <div className="absolute top-6 right-6 w-32 h-48 sm:w-48 sm:h-72 bg-gray-800 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/10 z-10 transition-transform hover:scale-105">
          <video ref={localVideoRef} autoPlay playsInline muted className={`w-full h-full object-cover ${isVideoOff ? 'hidden' : ''}`} />
          {(isMuted || isVideoOff) && (
            <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-2">
              {isVideoOff && <VideoOff className="w-6 h-6 text-white" />}
              {isMuted && <MicOff className="w-6 h-6 text-white" />}
            </div>
          )}
        </div>
      )}

      <div className="absolute top-8 left-8 z-10">
        <h2 className="text-white text-2xl font-bold shadow-black drop-shadow-lg">
          {callData?.callerName || (isAudioCall ? 'Cuoc goi thoai' : 'Cuoc goi video')}
        </h2>
        <p className="text-white/80 mt-1 shadow-black drop-shadow-md">
           {callData.isGroupCall 
             ? (Object.keys(remoteFrames).length > 0 ? `${Object.keys(remoteFrames).length + 1} nguoi tham gia` : 'Dang cho moi nguoi tham gia...')
             : (isRemoteAccepted ? 'Dau ben kia da nhan cuoc goi (Fake Video Call)' : 'Dang cho may...')}
        </p>
      </div>

      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-6 px-8 py-4 bg-gray-900/80 backdrop-blur-md rounded-full border border-white/10 shadow-2xl z-20 transition-all">
        <button onClick={toggleMute} className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${isMuted ? 'bg-red-500/20 text-red-500' : 'bg-gray-700/50 hover:bg-gray-600 text-white'}`}>
          {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
        </button>
        <button onClick={() => endCall(true)} className="w-16 h-16 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white transition-all transform hover:scale-110 shadow-lg shadow-red-500/50 mx-2">
          <PhoneOff className="w-8 h-8" />
        </button>
        {!isAudioCall && (
          <button onClick={toggleVideo} className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${isVideoOff ? 'bg-red-500/20 text-red-500' : 'bg-gray-700/50 hover:bg-gray-600 text-white'}`}>
            {isVideoOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
          </button>
        )}
      </div>
    </div>
  );
}
