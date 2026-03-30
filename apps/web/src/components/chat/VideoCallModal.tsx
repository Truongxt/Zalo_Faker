import { useEffect, useRef, useState } from 'react';
import { useCallStore } from '@/stores/callStore';
import { useAuthStore } from '@/stores/authStore';
import { PhoneOff, Mic, MicOff, Video, VideoOff } from 'lucide-react';
import { socketService } from '@/lib/socket';
import Peer from 'peerjs';

export default function VideoCallModal() {
    const { isCalling, callData, clearCall, localStream, setLocalStream, setRemoteStream, remoteStream } = useCallStore();
    const { user } = useAuthStore();
    
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const peerInstance = useRef<Peer | null>(null);

    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);

    useEffect(() => {
        if (!isCalling || !callData || !user) return;

        let peer: Peer;
        let socketListener: any;

        const initMediaRef = async () => {
            try {
                // Đợi cấp quyền camera trước khi tạo Peer để không lỡ sự kiện "open"
                const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                setLocalStream(stream);
                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = stream;
                }

                // Chờ đã có quyền Camera xong thì mới bắt đầu gọi cloud server P2P
                peer = new Peer();
                peerInstance.current = peer;

                peer.on('open', (peerId) => {
                    const socket = socketService.getSocket();
                    if (callData.isCaller) {
                        socket?.emit('video:call-user', {
                            fromUserId: user.id,
                            toUserId: callData.toUserId,
                            conversationId: callData.conversationId,
                            peerId: peerId,
                            callerName: user.fullName,
                            callerAvatar: user.avatarUrl
                        });
                    } else {
                        socket?.emit('video:answer-call', {
                            toUserId: callData.fromUserId,
                            peerId: peerId
                        });
                    }
                });

                peer.on('call', (call) => {
                    call.answer(stream);
                    call.on('stream', (userVideoStream) => {
                        setRemoteStream(userVideoStream);
                    });
                });

                const handleCallAnswered = (data: any) => {
                    // Họ gọi lại bằng peerId của họ
                    const call = peer.call(data.peerId, stream);
                    call.on('stream', (userVideoStream) => {
                        setRemoteStream(userVideoStream);
                    });
                };
                
                socketListener = handleCallAnswered;
                socketService.getSocket()?.on('video:call-answered', handleCallAnswered);

            } catch (err) {
                console.error("Failed to get camera:", err);
                alert("Bạn hãy cấp quyền truy cập Camera và Microphone để trò chuyện nhé!");
                endCall();
            }
        };

        initMediaRef();

        return () => {
            if (peer) peer.destroy();
            if (socketListener) {
                socketService.getSocket()?.off('video:call-answered', socketListener);
            }
        };
    }, [isCalling]);

    useEffect(() => {
        if (remoteVideoRef.current && remoteStream) {
            remoteVideoRef.current.srcObject = remoteStream;
        }
    }, [remoteStream]);


    // Socket Listeners cho việc Huỷ / Kết thúc
    useEffect(() => {
        if (!isCalling) return;

        const handleCallRejected = () => {
            alert('Người dùng đã từ chối cuộc gọi');
            endCall();
        };

        const handleCallEnded = () => {
            endCall();
        };

        socketService.getSocket()?.on('video:call-rejected', handleCallRejected);
        socketService.getSocket()?.on('video:call-ended', handleCallEnded);

        return () => {
            socketService.getSocket()?.off('video:call-rejected', handleCallRejected);
            socketService.getSocket()?.off('video:call-ended', handleCallEnded);
        };
    }, [isCalling]);

    const endCall = () => {
        const { localStream } = useCallStore.getState();
        localStream?.getTracks().forEach(track => track.stop());

        socketService.getSocket()?.emit('video:end-call', {
            toUserId: callData?.isCaller ? callData?.toUserId : callData?.fromUserId
        });

        clearCall();
    };

    const toggleMute = () => {
        if (localStream) {
            localStream.getAudioTracks()[0].enabled = isMuted;
            setIsMuted(!isMuted);
        }
    };

    const toggleVideo = () => {
        if (localStream) {
            localStream.getVideoTracks()[0].enabled = isVideoOff;
            setIsVideoOff(!isVideoOff);
        }
    };

    if (!isCalling) return null;

    return (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black animate-in fade-in duration-300">
            {/* Remote Video (Full Screen) */}
            <div className="absolute inset-0 w-full h-full">
                {remoteStream ? (
                    <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-gray-900">
                        <div className="w-24 h-24 rounded-full border-4 border-primary-500 border-t-transparent animate-spin mb-6"></div>
                        <p className="text-white text-xl animate-pulse">Đang kết nối...</p>
                    </div>
                )}
            </div>

            {/* Local Video (Floating Top Right) */}
            <div className="absolute top-6 right-6 w-32 h-48 sm:w-48 sm:h-72 bg-gray-800 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/10 z-10 transition-transform hover:scale-105">
                <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                {(isMuted || isVideoOff) && (
                    <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-2">
                        {isVideoOff && <VideoOff className="w-6 h-6 text-white" />}
                        {isMuted && <MicOff className="w-6 h-6 text-white" />}
                    </div>
                )}
            </div>

            {/* Header info */}
            <div className="absolute top-8 left-8 z-10">
                <h2 className="text-white text-2xl font-bold shadow-black drop-shadow-lg">
                    {callData?.callerName || 'Cuộc gọi Video'}
                </h2>
                <p className="text-white/80 mt-1 shadow-black drop-shadow-md">
                    {remoteStream ? 'Đang mã hóa E2E...' : 'Đang chờ máy...'}
                </p>
            </div>

            {/* Controls */}
            <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-6 px-8 py-4 bg-gray-900/80 backdrop-blur-md rounded-full border border-white/10 shadow-2xl z-20 transition-all">
                <button onClick={toggleMute} className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${isMuted ? 'bg-red-500/20 text-red-500' : 'bg-gray-700/50 hover:bg-gray-600 text-white'}`}>
                    {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                </button>
                <button onClick={endCall} className="w-16 h-16 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white transition-all transform hover:scale-110 shadow-lg shadow-red-500/50 mx-2">
                    <PhoneOff className="w-8 h-8" />
                </button>
                <button onClick={toggleVideo} className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${isVideoOff ? 'bg-red-500/20 text-red-500' : 'bg-gray-700/50 hover:bg-gray-600 text-white'}`}>
                    {isVideoOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
                </button>
            </div>
        </div>
    );
}
