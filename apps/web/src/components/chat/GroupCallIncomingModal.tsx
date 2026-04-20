import { useCallStore } from '@/stores/callStore';
import { Phone, PhoneOff, Users, Video } from 'lucide-react';

export default function GroupCallIncomingModal() {
  const { incomingGroupCall, clearIncomingGroupCall, startGroupCall } = useCallStore();

  if (!incomingGroupCall) return null;

  const {
    roomId,
    conversationId,
    callType,
    callerName,
    callerAvatar,
    hostUserId,
    participantCount,
  } = incomingGroupCall;

  const handleAccept = () => {
    // Start the group call — GroupCallModal will handle join + WebRTC
    startGroupCall(roomId, conversationId, callType, false, hostUserId);
    clearIncomingGroupCall();
  };

  const handleReject = () => {
    clearIncomingGroupCall();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-dark-200 p-8 rounded-3xl w-[340px] text-center shadow-2xl animate-in zoom-in-95 duration-300">
        {/* Group Avatar / Caller Avatar */}
        <div className="relative w-28 h-28 mx-auto mb-6">
          {callerAvatar ? (
            <img
              src={callerAvatar}
              alt="avatar"
              className="w-full h-full rounded-full object-cover shadow-lg border-4 border-white dark:border-dark-200"
            />
          ) : (
            <div className="w-full h-full rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center border-4 border-white dark:border-dark-200">
              <Users className="w-12 h-12 text-primary-600" />
            </div>
          )}
          {/* Ping animation */}
          <div className="absolute inset-0 rounded-full border-4 border-primary-500 animate-ping opacity-75" />

          {/* Call type badge */}
          <div className="absolute -bottom-1 -right-1 w-10 h-10 rounded-full bg-green-500 flex items-center justify-center shadow-lg border-2 border-white dark:border-dark-200">
            {callType === 'video' ? (
              <Video className="w-5 h-5 text-white" />
            ) : (
              <Phone className="w-5 h-5 text-white" />
            )}
          </div>
        </div>

        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
          {callerName || 'Cuộc gọi nhóm'}
        </h3>

        <p className="text-gray-500 dark:text-gray-400 mb-2 font-medium">
          {callType === 'video' ? 'Cuộc gọi video nhóm đến' : 'Cuộc gọi thoại nhóm đến'}
        </p>

        <p className="text-primary-500 dark:text-primary-400 text-sm mb-8">
          {participantCount > 0
            ? `${participantCount} người đang trong cuộc gọi`
            : 'Đang chờ người tham gia...'}
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
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Tham gia</span>
          </button>
        </div>
      </div>
    </div>
  );
}
