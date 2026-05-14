import { useState, useCallback, useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useChatStore } from '@/stores/chatStore';
import { friendsService } from '@/services/friendsService';
import { getFriends } from '@/services/api';
import { FriendRequest } from '@/types/friends';
import {
  User as UserIcon,
  UserPlus,
  Users,
  Check,
  X,
  Search,
  MessageCircle,
  UserX,
  ShieldBan,
  ShieldCheck,
} from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { chatService } from '@/services/chat';
import { socketService } from '@/lib/socket';
import { getPresenceLabel } from '@/lib/presence';

type ContactTab = 'friends' | 'groups' | 'requests' | 'blocked';

export default function Contacts() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { conversations, setActiveConversation } = useChatStore();
  const { addToast } = useToast();

  const [searchParams, setSearchParams] = useSearchParams();
  const [friends, setFriends] = useState<any[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const tabParam = searchParams.get('tab');
  const activeTab: ContactTab =
    tabParam === 'groups' || tabParam === 'requests' || tabParam === 'blocked'
      ? tabParam
      : 'friends';

  const getFriendId = (friend: any) => String(friend?.userId || friend?.id || friend?._id || '');

  const updateFriendPresence = useCallback((
    targetUserId: string,
    status: 'online' | 'offline',
    lastSeen?: string | null,
  ) => {
    setFriends((prev) => {
      let changed = false;
      const nextFriends = prev.map((friend) => {
        if (getFriendId(friend) !== String(targetUserId)) return friend;

        const nextLastSeen = status === 'offline'
          ? lastSeen || friend.lastSeen || null
          : friend.lastSeen || null;

        if (friend.status === status && (friend.lastSeen || null) === nextLastSeen) {
          return friend;
        }

        changed = true;
        return {
          ...friend,
          status,
          presenceStatus: status,
          lastSeen: nextLastSeen,
        };
      });

      return changed ? nextFriends : prev;
    });
  }, []);

  const isFriendOnline = (friend: any) =>
    String(friend?.presenceStatus || friend?.status || '').toLowerCase() === 'online';

  const setActiveTab = (tab: ContactTab) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('tab', tab);
    setSearchParams(nextParams, { replace: true });
  };

  const loadData = async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const [friendsData, requestsData, blockedData] = await Promise.all([
        getFriends(user.id),
        friendsService.getPendingRequests(user.id),
        friendsService.getBlockedUsers(user.id),
      ]);
      const uniqueFriends = Array.from(
        new Map(friendsData.map((f: any) => [String(f.userId || f._id || f), f])).values()
      );
      setFriends(uniqueFriends);
      setRequests(requestsData);
      setBlockedUsers(blockedData);
    } catch (error) {
      console.error('Error loading contacts data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    if (!socketService.isConnected()) {
      socketService.connect(user.id);
    }

    const handleFriendRemoved = ({ friendId }: { friendId: string }) => {
      setFriends((prev) => prev.filter((f) => String(f.userId) !== String(friendId)));
    };

    const handleFriendBlocked = ({ targetUserId }: { targetUserId: string }) => {
      setFriends((prev) => prev.filter((f) => String(f.userId) !== String(targetUserId)));
      loadData();
    };

    const handleFriendUnblocked = () => {
      loadData();
    };

    const handleBlockedBy = ({ blockedByUserId }: { blockedByUserId: string }) => {
      setFriends((prev) => prev.filter((f) => String(f.userId) !== String(blockedByUserId)));
    };

    const handlePresenceOnline = ({ userId: onlineUserId }: { userId: string }) => {
      updateFriendPresence(String(onlineUserId), 'online');
    };

    const handlePresenceOffline = ({
      userId: offlineUserId,
      lastActiveAt,
    }: {
      userId: string;
      lastActiveAt?: string;
    }) => {
      updateFriendPresence(String(offlineUserId), 'offline', lastActiveAt || null);
    };

    socketService.on('friend:removed', handleFriendRemoved);
    socketService.on('friend:blocked', handleFriendBlocked);
    socketService.on('friend:unblocked', handleFriendUnblocked);
    socketService.on('friend:blocked_by', handleBlockedBy);
    socketService.on('presence:online', handlePresenceOnline);
    socketService.on('presence:offline', handlePresenceOffline);

    return () => {
      socketService.off('friend:removed', handleFriendRemoved);
      socketService.off('friend:blocked', handleFriendBlocked);
      socketService.off('friend:unblocked', handleFriendUnblocked);
      socketService.off('friend:blocked_by', handleBlockedBy);
      socketService.off('presence:online', handlePresenceOnline);
      socketService.off('presence:offline', handlePresenceOffline);
    };
  }, [user?.id, updateFriendPresence]);

  useEffect(() => {
    if (!user?.id || friends.length === 0) return;

    const socket = socketService.getSocket() || socketService.connect(user.id);
    if (!socket) return;

    const friendIds = Array.from(
      new Set(
        friends
          .map(getFriendId)
          .filter((friendId) => friendId && friendId !== String(user.id)),
      ),
    );

    if (friendIds.length === 0) return;

    const refreshFriendPresence = () => {
      socket.emit(
        'presence:get_online_users',
        friendIds,
        (response: {
          success: boolean;
          onlineStatuses?: Record<string, boolean>;
          lastSeenStatuses?: Record<string, string | null>;
        }) => {
          if (!response?.success || !response.onlineStatuses) return;

          Object.entries(response.onlineStatuses).forEach(([friendId, isOnline]) => {
            updateFriendPresence(
              friendId,
              isOnline ? 'online' : 'offline',
              response.lastSeenStatuses?.[friendId] || null,
            );
          });
        },
      );
    };

    if (socket.connected) {
      refreshFriendPresence();
    } else {
      socket.once('connect', refreshFriendPresence);
    }

    return () => {
      socket.off('connect', refreshFriendPresence);
    };
  }, [friends, user?.id, updateFriendPresence]);

  const handleAcceptRequest = async (req: FriendRequest) => {
    try {
      await friendsService.acceptFriendRequest(req.fromUserId, req.toUserId);
      addToast('Đã chấp nhận lời mời kết bạn', 'success');
      loadData();
    } catch (error) {
      addToast('Không thể chấp nhận lời mời', 'error');
    }
  };

  const handleRejectRequest = async (req: FriendRequest) => {
    try {
      await friendsService.rejectFriendRequest(req.fromUserId, req.toUserId);
      addToast('Đã từ chối lời mời kết bạn', 'success');
      loadData();
    } catch (error) {
      addToast('Không thể từ chối lời mời', 'error');
    }
  };

  const handleMessageClick = async (friendId: string) => {
    if (!friendId) return;

    const existingConv = conversations.find(
      (c) => c.type === 'private' && c.participants.some((p) => String(p.userId) === String(friendId)),
    );

    if (existingConv) {
      const convId = existingConv.id || (existingConv as any)._id;
      setActiveConversation(existingConv);
      navigate(`/chat/${convId}`);
      return;
    }

    try {
      const newConv = await chatService.createConversation([String(friendId)], 'private');
      const convToSet = { ...newConv, id: newConv.id || (newConv as any)._id };
      setActiveConversation(convToSet);
      navigate(`/chat/${convToSet.id}`);
    } catch (error) {
      console.error('Error creating conversation:', error);
      addToast('Không thể tạo cuộc hội thoại', 'error');
    }
  };

  const handleRemoveFriend = async (friendId: string, friendName?: string) => {
    if (!window.confirm(`Xóa ${friendName || 'người này'} khỏi danh sách bạn bè?`)) return;

    try {
      await friendsService.removeFriend(friendId);
      setFriends((prev) => prev.filter((f) => String(f.userId) !== String(friendId)));
      addToast('Đã xóa bạn bè', 'success');
    } catch (error) {
      addToast('Không thể xóa bạn bè', 'error');
    }
  };

  const handleBlockUser = async (friendId: string, friendName?: string) => {
    if (!window.confirm(`Chặn ${friendName || 'người này'}?`)) return;

    try {
      await friendsService.blockUser(friendId);
      setFriends((prev) => prev.filter((f) => String(f.userId) !== String(friendId)));
      addToast('Đã chặn người dùng', 'success');
      if (user?.id) {
        const blockedData = await friendsService.getBlockedUsers(user.id);
        setBlockedUsers(blockedData);
      }
    } catch (error) {
      addToast('Không thể chặn người dùng', 'error');
    }
  };

  const handleUnblockUser = async (blockedUserId: string, blockedUserName?: string) => {
    if (!window.confirm(`Bỏ chặn ${blockedUserName || 'người này'}?`)) return;

    try {
      await friendsService.unblockUser(blockedUserId);
      setBlockedUsers((prev) => prev.filter((u) => String(u.userId) !== String(blockedUserId)));
      addToast('Đã bô chặn', 'success');
    } catch (error) {
      addToast('Không thể bỏ chặn', 'error');
    }
  };

  const handleGroupClick = (group: any) => {
    if (!group) return;
    const groupId = group.id;
    if (!groupId) return;

    const groupToSet = { ...group, id: groupId };
    setActiveConversation(groupToSet);
    navigate(`/chat/${groupId}`);
  };

  const handleOpenProfile = (targetUserId?: string | number) => {
    if (!targetUserId) return;
    navigate(`/profile/${targetUserId}`);
  };

  const groupConversations = conversations.filter((c) => c.type === 'group');

  const filteredFriends = friends.filter((f) => {
    const name = f.fullName || '';
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const filteredGroups = groupConversations.filter((g) => {
    const name = g.name || '';
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const filteredBlockedUsers = blockedUsers.filter((u) => {
    const name = u.userName || '';
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="flex-1 min-w-0 flex flex-col bg-white dark:bg-dark-100 overflow-hidden">
      <div className="h-16 border-b border-gray-200 dark:border-gray-800 flex items-center px-6 justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          {activeTab === 'friends' && <UserIcon className="w-6 h-6 text-primary-500" />}
          {activeTab === 'groups' && <Users className="w-6 h-6 text-primary-500" />}
          {activeTab === 'requests' && <UserPlus className="w-6 h-6 text-primary-500" />}
          {activeTab === 'blocked' && <ShieldBan className="w-6 h-6 text-primary-500" />}
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {activeTab === 'friends'
              ? 'Danh sách bạn bè'
              : activeTab === 'groups'
                ? 'Danh sách nhóm'
                : activeTab === 'requests'
                  ? 'Lời mời kết bạn'
                  : 'Người đã chặn'}
          </h2>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Tìm kiếm..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-4 py-1.5 bg-gray-100 dark:bg-dark-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="max-w-4xl mx-auto">
            <div className="flex gap-4 mb-8 border-b border-gray-100 dark:border-gray-800 pb-4">
              <button
                onClick={() => setActiveTab('friends')}
                className={`pb-2 px-1 font-medium transition-colors relative ${activeTab === 'friends' ? 'text-primary-500' : 'text-gray-500'
                  }`}
              >
                Bạn bè ({friends.length})
                {activeTab === 'friends' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500" />}
              </button>
              <button
                onClick={() => setActiveTab('groups')}
                className={`pb-2 px-1 font-medium transition-colors relative ${activeTab === 'groups' ? 'text-primary-500' : 'text-gray-500'
                  }`}
              >
                Nhóm ({groupConversations.length})
                {activeTab === 'groups' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500" />}
              </button>
              <button
                onClick={() => setActiveTab('requests')}
                className={`pb-2 px-1 font-medium transition-colors relative ${activeTab === 'requests' ? 'text-primary-500' : 'text-gray-500'
                  }`}
              >
                Lời mời ({requests.length})
                {activeTab === 'requests' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500" />}
              </button>
              <button
                onClick={() => setActiveTab('blocked')}
                className={`pb-2 px-1 font-medium transition-colors relative ${activeTab === 'blocked' ? 'text-primary-500' : 'text-gray-500'
                  }`}
              >
                Đã chặn ({blockedUsers.length})
                {activeTab === 'blocked' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500" />}
              </button>
            </div>

            {activeTab === 'friends' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredFriends.length === 0 ? (
                  <div className="col-span-full py-20 text-center text-gray-500">Không tìm thấy bạn bè nào.</div>
                ) : (
                  filteredFriends.map((friend, idx) => (
                    <div
                      key={friend.userId || idx}
                      className="flex items-center gap-4 p-4 border border-gray-100 dark:border-gray-800 rounded-xl hover:bg-gray-50 dark:hover:bg-dark-200 transition-colors group"
                    >
                      <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 bg-primary-100 dark:bg-primary-900/30">
                        <button
                          type="button"
                          onClick={() => handleOpenProfile(friend.userId)}
                          className="w-full h-full block"
                          title="Xem trang cá nhân"
                        >
                          {friend.avatarUrl ? (
                            <img src={friend.avatarUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-primary-600 font-bold">
                              {friend.fullName?.charAt(0).toUpperCase() || '?'}
                            </div>
                          )}
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleOpenProfile(friend.userId)}
                        className="flex-1 min-w-0 pointer-events-auto text-left"
                        title="Xem trang cá nhân"
                      >
                        <h3 className="font-semibold text-gray-900 dark:text-white truncate">{friend.fullName || 'Người dùng'}</h3>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <div
                            className={`w-2 h-2 rounded-full ${isFriendOnline(friend)
                              ? 'bg-green-500'
                              : 'bg-gray-400'
                              }`}
                          />
                          <p className="text-[11px] text-gray-500 truncate">
                            {getPresenceLabel(friend.status, friend.lastSeen)}
                          </p>
                        </div>
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (friend.userId) handleMessageClick(String(friend.userId));
                        }}
                        className="p-2 opacity-0 group-hover:opacity-100 transition-opacity text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg pointer-events-auto cursor-pointer"
                        title="Nhắn tin"
                      >
                        <MessageCircle className="w-5 h-5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (friend.userId) handleRemoveFriend(String(friend.userId), friend.fullName);
                        }}
                        className="p-2 opacity-0 group-hover:opacity-100 transition-opacity text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg pointer-events-auto cursor-pointer"
                        title="Xóa bạn"
                      >
                        <UserX className="w-5 h-5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (friend.userId) handleBlockUser(String(friend.userId), friend.fullName);
                        }}
                        className="p-2 opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg pointer-events-auto cursor-pointer"
                        title="Chặn"
                      >
                        <ShieldBan className="w-5 h-5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'requests' && (
              <div className="space-y-4">
                {requests.length === 0 ? (
                  <div className="py-20 text-center text-gray-500">Không có lời mời kết bạn mới.</div>
                ) : (
                  requests.map((req) => (
                    <div
                      key={req.id}
                      className="flex items-center gap-4 p-4 border border-gray-200 dark:border-gray-800 rounded-xl bg-primary-50/30 dark:bg-primary-900/10"
                    >
                      <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => handleOpenProfile(req.fromUserId)}
                          className="w-full h-full block"
                          title="Xem trang cá nhân"
                        >
                          {req.fromUser?.avatarUrl ? (
                            <img src={req.fromUser.avatarUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-gray-200 flex items-center justify-center font-bold">
                              {req.fromUser?.fullName?.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleOpenProfile(req.fromUserId)}
                        className="flex-1 text-left"
                        title="Xem trang cá nhân"
                      >
                        <h3 className="font-semibold text-gray-900 dark:text-white">{req.fromUser?.fullName}</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{req.message || 'Muon ket ban voi ban'}</p>
                        <p className="text-xs text-gray-400 mt-1">{new Date(req.createdAt).toLocaleDateString('vi-VN')}</p>
                      </button>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAcceptRequest(req)}
                          className="p-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
                          type="button"
                        >
                          <Check className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleRejectRequest(req)}
                          className="p-2 bg-gray-200 dark:bg-dark-300 text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-300 dark:hover:bg-dark-200 transition-colors"
                          type="button"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'groups' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredGroups.length === 0 ? (
                  <div className="col-span-full py-20 text-center text-gray-500">Bạn chưa tham gia nhóm nào.</div>
                ) : (
                  filteredGroups.map((group) => (
                    <div
                      key={group.id}
                      onClick={() => handleGroupClick(group)}
                      className="flex items-center gap-4 p-4 border border-gray-100 dark:border-gray-800 rounded-xl hover:bg-gray-50 dark:hover:bg-dark-200 transition-colors cursor-pointer"
                    >
                      <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                        {group.avatar ? (
                          <img src={group.avatar} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Users className="w-6 h-6 text-primary-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 dark:text-white truncate">{group.name || 'Nhóm chat'}</h3>
                        <p className="text-xs text-gray-500">{group.participants?.length || 0} thành viên</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'blocked' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredBlockedUsers.length === 0 ? (
                  <div className="col-span-full py-20 text-center text-gray-500">Bạn chưa chặn người dùng nào.</div>
                ) : (
                  filteredBlockedUsers.map((blockedUser, idx) => (
                    <div
                      key={blockedUser.userId || idx}
                      className="flex items-center gap-4 p-4 border border-gray-100 dark:border-gray-800 rounded-xl hover:bg-gray-50 dark:hover:bg-dark-200 transition-colors"
                    >
                      <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 bg-primary-100 dark:bg-primary-900/30">
                        <button
                          type="button"
                          onClick={() => handleOpenProfile(blockedUser.userId)}
                          className="w-full h-full block"
                          title="Xem trang cá nhân"
                        >
                          {blockedUser.avartarUrl ? (
                            <img src={blockedUser.avartarUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-primary-600 font-bold">
                              {blockedUser.userName?.charAt(0).toUpperCase() || '?'}
                            </div>
                          )}
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleOpenProfile(blockedUser.userId)}
                        className="flex-1 min-w-0 text-left"
                        title="Xem trang cá nhân"
                      >
                        <h3 className="font-semibold text-gray-900 dark:text-white truncate">{blockedUser.userName || 'Nguoi dung'}</h3>
                        <p className="text-xs text-gray-500 mt-0.5">Đã chặn</p>
                      </button>
                      <button
                        onClick={() => handleUnblockUser(String(blockedUser.userId), blockedUser.userName)}
                        className="px-3 py-2 text-sm font-medium text-primary-600 bg-primary-50 hover:bg-primary-100 dark:bg-primary-900/20 dark:hover:bg-primary-900/30 rounded-lg transition-colors"
                        title="Bo chan"
                        type="button"
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <ShieldCheck className="w-4 h-4" />
                          Bỏ chặn
                        </span>
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
