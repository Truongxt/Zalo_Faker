import { useCallStore } from '@/stores/callStore';
import { Phone, PhoneOff } from 'lucide-react';
import { socketService } from '@/lib/socket';

export default function IncomingCallModal() {
    const { isReceivingCall, callData, clearCall, setOutgoingCall } = useCallStore();

    if (!isReceivingCall || !callData) return null;

    const handleAccept = () => {
        // Chuyển sang chế độ đang gọi => Mở VideoCallModal để lấy camera và kết nối
        setOutgoingCall(callData); 
    };

    const handleReject = () => {
        // Báo cho người gọi biết
        const socket = socketService.getSocket();
        socket?.emit('video:reject-call', {
            toUserId: callData.fromUserId,
        });
        clearCall();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-dark-200 p-8 rounded-3xl w-[320px] text-center shadow-2xl animate-in zoom-in-95 duration-300">
                <div className="relative w-28 h-28 mx-auto mb-6">
                    {callData.callerAvatar ? (
                        <img src={callData.callerAvatar} alt="avatar" className="w-full h-full rounded-full object-cover shadow-lg border-4 border-white dark:border-dark-200" />
                    ) : (
                        <div className="w-full h-full rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-4xl font-bold text-primary-600 border-4 border-white dark:border-dark-200">
                            {callData.callerName?.charAt(0).toUpperCase() || 'U'}
                        </div>
                    )}
                    <div className="absolute inset-0 rounded-full border-4 border-primary-500 animate-ping opacity-75"></div>
                </div>
                
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    {callData.callerName || 'Ai đó'}
                </h3>
                <p className="text-gray-500 dark:text-gray-400 mb-8 font-medium">
                    Đang gọi video cho bạn...
                </p>

                <div className="flex justify-center gap-8">
                    <button onClick={handleReject} className="group relative flex flex-col items-center">
                        <div className="w-16 h-16 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white transition-all transform hover:scale-110 shadow-lg shadow-red-500/30 mb-2">
                            <PhoneOff className="w-7 h-7" />
                        </div>
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Từ chối</span>
                    </button>
                    <button onClick={handleAccept} className="group relative flex flex-col items-center">
                        <div className="w-16 h-16 bg-green-500 hover:bg-green-600 rounded-full flex items-center justify-center text-white transition-all transform hover:scale-110 shadow-lg shadow-green-500/30 animate-pulse mb-2">
                            <Phone className="w-7 h-7" />
                        </div>
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Ghi nhận</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
