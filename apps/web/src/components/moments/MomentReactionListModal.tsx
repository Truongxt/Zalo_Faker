import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { X, UserPlus, Check } from "lucide-react";
import { momentService } from "@/services/momentService";
import { friendsService as friendService } from "@/services/friendsService";
import type { MomentReaction } from "@/types/moment";
import { REACTION_OPTIONS } from "./momentHelpers";
import { useAuthStore } from "@/stores/authStore";

interface MomentReactionListModalProps {
  momentId: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function MomentReactionListModal({
  momentId,
  isOpen,
  onClose,
}: MomentReactionListModalProps) {
  const [reactions, setReactions] = useState<MomentReaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [friendsMap, setFriendsMap] = useState<Record<string, boolean>>({});
  const [pendingRequests, setPendingRequests] = useState<Record<string, boolean>>({});
  const { user } = useAuthStore();

  useEffect(() => {
    if (!isOpen) return;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const reactionsData = await momentService.getMomentReactions(momentId);
        setReactions(reactionsData);
        
        // Also load friends map
        if (user) {
          try {
            const currentUserId = String(user.userId || user.id);
            const friendsData = await friendService.getFriend(currentUserId);
            const fMap: Record<string, boolean> = {};
            friendsData.forEach((f: any) => {
               // assuming friend item has user.id
               if (f.user?.id) {
                 fMap[f.user.id] = true;
               }
            });
            setFriendsMap(fMap);
          } catch (e) {
            console.error("Failed to fetch friends", e);
          }
        }
      } catch (error) {
        console.error("Failed to fetch moment reactions:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [momentId, isOpen, user]);

  const handleAddFriend = async (targetUserId: string) => {
    if (pendingRequests[targetUserId] || !user) return;
    try {
      setPendingRequests(prev => ({ ...prev, [targetUserId]: true }));
      const currentUserId = String(user.userId || user.id);
      await friendService.sendFriendRequest(currentUserId, targetUserId, "Xin chào, mình muốn kết bạn!");
    } catch (error) {
      console.error("Failed to send friend request:", error);
      setPendingRequests(prev => ({ ...prev, [targetUserId]: false }));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div 
        className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-dark-200 flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 p-4 dark:border-gray-800">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Người đã bày tỏ cảm xúc
          </h3>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-dark-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
            </div>
          ) : reactions.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              Chưa có cảm xúc nào
            </div>
          ) : (
            reactions.map((reaction) => {
              const reactionInfo = REACTION_OPTIONS.find((r) => r.key === reaction.emoji);
              const author = reaction.user;
              const isCurrentUser = user && (String(user.userId) === String(reaction.userId) || String(user.id) === String(reaction.userId));
              const isFriend = friendsMap[reaction.userId];
              const hasSentRequest = pendingRequests[reaction.userId];

              return (
                <div key={reaction.userId} className="flex items-center justify-between">
                  <Link 
                    to={`/profile/${reaction.userId}`}
                    className="flex items-center gap-3 flex-1 min-w-0"
                    onClick={onClose}
                  >
                    <div className="relative">
                      {author?.avartarUrl ? (
                        <img
                          src={author.avartarUrl}
                          alt={author?.userName || "User"}
                          className="h-10 w-10 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/30">
                          <span className="text-sm font-medium text-primary-600 dark:text-primary-400">
                            {(author?.userName || "U").charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <span className="absolute -bottom-1 -right-1 text-lg">
                        {reactionInfo?.icon || "👍"}
                      </span>
                    </div>
                    <div className="truncate">
                      <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                        {author?.userName || "Người dùng"}
                      </p>
                    </div>
                  </Link>
                  
                  {!isCurrentUser && !isFriend && (
                    <button
                      onClick={() => handleAddFriend(reaction.userId)}
                      disabled={hasSentRequest}
                      className={`ml-4 flex items-center justify-center rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                        hasSentRequest
                          ? "bg-gray-100 text-gray-500 dark:bg-dark-300 dark:text-gray-400 cursor-default"
                          : "bg-primary-50 text-primary-600 hover:bg-primary-100 dark:bg-primary-900/30 dark:text-primary-400 dark:hover:bg-primary-900/50"
                      }`}
                    >
                      {hasSentRequest ? (
                        <>
                          <Check className="mr-1.5 h-3.5 w-3.5" />
                          Đã gửi lời mời
                        </>
                      ) : (
                        <>
                          <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                          Kết bạn
                        </>
                      )}
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
