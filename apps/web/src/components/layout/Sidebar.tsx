import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { useChatStore, Conversation } from "@/stores/chatStore";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import {
  Search,
  Plus,
  Users,
  MessageCircle,
  User as UserIcon,
  Bot,
  Pin,
  BellOff,
  Tag,
  Link2,
  Clock,
  UserPlus,
  ShieldBan,
  EyeOff,
  Eye,
  Lock,
} from "lucide-react";
import CreateGroupModal from "@/components/chat/CreateGroupModal";
import LabelManagerModal from "@/components/chat/LabelManagerModal";
import LabelPickerModal from "@/components/chat/LabelPickerModal";
import HiddenPinModal from "@/components/chat/HiddenPinModal";
import {
  updateParticipantSetting,
  getLabels,
  joinGroupByInviteCode,
} from "@/services/api";
import authService from "@/services/auth";
import { getMessagePreviewText } from "@/lib/messagePreview";
import AddFriendModal from "@/components/friends/AddFriendModal";
import PromptModal from "@/components/common/PromptModal";

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();
  const {
    conversations,
    activeConversation,
    setActiveConversation,
    addConversation,
  } = useChatStore();

  const isContactsView = location.pathname.startsWith("/chat/contacts");
  const contactsTab =
    new URLSearchParams(location.search).get("tab") || "friends";
  const isAIView = location.pathname.startsWith("/chat/ai");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "unread" | "groups">(
    "all",
  );
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [showLabelManager, setShowLabelManager] = useState(false);
  const [showHiddenPin, setShowHiddenPin] = useState(false);
  const [showJoinGroup, setShowJoinGroup] = useState(false);
  const [labelPickerConv, setLabelPickerConv] = useState<Conversation | null>(
    null,
  );
  const [activeLabelId, setActiveLabelId] = useState<string | null>(null);
  const [unlockedHiddenChats, setUnlockedHiddenChats] = useState(false);
  const [verifyingHiddenPin, setVerifyingHiddenPin] = useState(false);
  const { labels, setLabels } = useChatStore();

  useEffect(() => {
    if (user) {
      getLabels().then(setLabels).catch(console.error);
    }
  }, [user, setLabels]);

  const hasLockedHiddenChats = conversations.some((conv) => {
    const currentP = (conv.participants || []).find(
      (p) => String(p.userId) === String(user?.id),
    );
    return Boolean(currentP?.isHidden) && !unlockedHiddenChats;
  });

  const handleSearchChange = async (value: string) => {
    setSearchQuery(value);

    if (
      !user?.id ||
      value.length !== 6 ||
      !/^\d{6}$/.test(value) ||
      !hasLockedHiddenChats ||
      verifyingHiddenPin
    ) {
      return;
    }

    try {
      setVerifyingHiddenPin(true);
      const result = await authService.verifyHiddenPin(user.id, value);
      if (result?.success) {
        setUnlockedHiddenChats(true);
        setSearchQuery("");
      }
    } catch {
      // Wrong PIN is treated as normal search input.
    } finally {
      setVerifyingHiddenPin(false);
    }
  };

  const filteredConversations = conversations.filter((conv) => {
    const participants = conv.participants || [];
    const currentP = participants.find(
      (p) => String(p.userId) === String(user?.id),
    );
    if (!currentP) return false;

    if (unlockedHiddenChats) {
      if (!currentP.isHidden) return false;
    } else if (currentP.isHidden) {
      return false;
    }

    // Search filter
    if (searchQuery) {
      const other = participants.find(
        (p) => String(p.userId) !== String(user?.id),
      );
      const name =
        conv.type === "group" ? conv.name : other?.nickname || other?.fullName;
      if (!name?.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
    }

    // Tab filter
    if (activeTab === "unread" && conv.unreadCount === 0) return false;
    if (activeTab === "groups" && conv.type !== "group") return false;

    // Label filter
    if (activeLabelId) {
      if (!currentP?.labelIds?.includes(activeLabelId)) return false;
    }

    return true;
  });

  const getConversationName = (conv: Conversation) => {
    const participants = conv.participants || [];
    const currentP = participants.find(
      (p) => String(p.userId) === String(user?.id),
    );
    if (currentP?.nickname) return currentP.nickname;

    if (conv.type === "group") return conv.name || "Nhóm chat";
    const other = participants.find(
      (p) => String(p.userId) !== String(user?.id),
    );
    return other?.fullName || "Người dùng";
  };

  const getConversationAvatar = (conv: Conversation) => {
    const participants = conv.participants || [];
    if (conv.type === "group") return conv.avatar;
    const other = participants.find(
      (p) => String(p.userId) !== String(user?.id),
    );
    return other?.avatarUrl;
  };

  const getOnlineStatus = (conv: Conversation) => {
    const participants = conv.participants || [];
    if (conv.type === "group") return false;
    const other = participants.find(
      (p) => String(p.userId) !== String(user?.id),
    );
    return other?.status === "online";
  };

  const handleConversationClick = (conv: Conversation) => {
    setActiveConversation(conv);
    navigate(`/chat/${conv.id}`);
  };

  const handleJoinByInvite = async (code: string) => {
    if (!code?.trim() || !user) return;

    try {
      const result = await joinGroupByInviteCode(code.trim());

      if (result.status === "joined" && result.group) {
        const joinedGroup = { ...result.group, id: result.group._id };
        addConversation(joinedGroup);
        setActiveConversation(joinedGroup);
        navigate(`/chat/${joinedGroup.id}`);
        return;
      }

      if (result.status === "requested" || result.status === "pending") {
        alert("Đã gửi yêu cầu tham gia nhóm. Vui lòng chờ duyệt.");
        return;
      }

      alert(result.message || "Đã xử lý yêu cầu.");
    } catch (error: any) {
      alert(error.message || "Không thể tham gia nhóm bằng mã mời.");
    }
  };

  const handleTogglePin = async (e: React.MouseEvent, conv: Conversation) => {
    e.stopPropagation();
    if (!user) return;
    const participants = conv.participants || [];
    const p = participants.find((p) => p.userId === user.id);
    const isPinned = !p?.isPinned;
    try {
      await updateParticipantSetting(conv.id, user.id, { isPinned });
      useChatStore.getState().updateConversation(conv.id, {
        participants: participants.map((part) =>
          String(part.userId) === String(user.id)
            ? { ...part, isPinned }
            : part,
        ),
      });
    } catch (err) {
      console.error("Error toggling pin:", err);
    }
  };

  const handleToggleMute = async (e: React.MouseEvent, conv: Conversation) => {
    e.stopPropagation();
    if (!user) return;
    const participants = conv.participants || [];
    const p = participants.find((p) => p.userId === user.id);
    const isMuted = !p?.isMuted;
    try {
      await updateParticipantSetting(conv.id, user.id, { isMuted });
      useChatStore.getState().updateConversation(conv.id, {
        participants: participants.map((part) =>
          String(part.userId) === String(user.id) ? { ...part, isMuted } : part,
        ),
      });
    } catch (err) {
      console.error("Error toggling mute:", err);
    }
  };

  const handleToggleHide = async (e: React.MouseEvent, conv: Conversation) => {
    e.stopPropagation();
    if (!user) return;

    const participants = conv.participants || [];
    const currentP = participants.find(
      (p) => String(p.userId) === String(user.id),
    );
    if (!currentP) return;

    const nextHidden = !currentP.isHidden;

    try {
      if (nextHidden && !user.hasHiddenPin) {
        setShowHiddenPin(true);
        return;
      }

      await updateParticipantSetting(conv.id, user.id, { isHidden: nextHidden });
      useChatStore.getState().updateConversation(conv.id, {
        participants: participants.map((part) =>
          String(part.userId) === String(user.id)
            ? { ...part, isHidden: nextHidden }
            : part,
        ),
      });

      if (!nextHidden && unlockedHiddenChats) {
        const stillHasHidden = useChatStore
          .getState()
          .conversations.some((conversation) => {
            const me = (conversation.participants || []).find(
              (p) => String(p.userId) === String(user.id),
            );
            return Boolean(me?.isHidden);
          });
        if (!stillHasHidden) {
          setUnlockedHiddenChats(false);
        }
      }
    } catch (err) {
      console.error("Error toggling hidden conversation:", err);
    }
  };

  const sortedConversations = [...filteredConversations].sort((a, b) => {
    const pA = (a.participants || []).find(
      (p) => String(p.userId) === String(user?.id),
    );
    const pB = (b.participants || []).find(
      (p) => String(p.userId) === String(user?.id),
    );

    if (pA?.isPinned && !pB?.isPinned) return -1;
    if (!pA?.isPinned && pB?.isPinned) return 1;

    const timeA = a.updatedAt || a.lastMessage?.timestamp || 0;
    const timeB = b.updatedAt || b.lastMessage?.timestamp || 0;
    return new Date(timeB).getTime() - new Date(timeA).getTime();
  });

  return (
    <div className="sidebar flex flex-col h-full bg-white dark:bg-dark-100 border-r border-gray-200 dark:border-gray-800">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            {isContactsView ? "Danh bạ" : "Tin nhắn"}
          </h1>
          {!isContactsView && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowHiddenPin(true)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-600 dark:text-gray-400"
                title="Mã PIN trò chuyện ẩn"
              >
                <Lock className="w-5 h-5" />
              </button>
              <button
                onClick={() => setShowAddFriend(true)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-600 dark:text-gray-400"
                title="Thêm bạn"
              >
                <UserPlus className="w-5 h-5" />
              </button>
              <button
                onClick={() => setShowJoinGroup(true)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-600 dark:text-gray-400"
                title="Tham gia nhóm bằng mã mời"
              >
                <Link2 className="w-5 h-5" />
              </button>
              <button
                onClick={() => setShowCreateGroup(true)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-600 dark:text-gray-400"
                title="Tạo nhóm"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          )}
          {isContactsView && (
            <button
              onClick={() => setShowAddFriend(true)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-600 dark:text-gray-400"
              title="Thêm bạn"
            >
              <UserPlus className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              void handleSearchChange(e.target.value);
            }}
            placeholder="Tìm kiếm"
            className={`w-full pl-10 py-2 bg-gray-100 dark:bg-dark-300 rounded-lg
                       text-gray-900 dark:text-white placeholder-gray-500
                       focus:outline-none focus:ring-2 focus:ring-primary-500 ${unlockedHiddenChats ? "pr-24" : "pr-4"} ${hasLockedHiddenChats && !unlockedHiddenChats ? "ring-1 ring-red-300 dark:ring-red-700" : ""}`}
          />
          {unlockedHiddenChats && (
            <button
              type="button"
              onClick={() => {
                setUnlockedHiddenChats(false);
                setSearchQuery("");
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 rounded-full border border-primary-300 bg-primary-50 px-2 py-1 text-[11px] font-semibold text-primary-600 hover:bg-primary-100"
              title="Khoa lai tro chuyen an"
            >
              <Lock className="w-3 h-3" />
              Dong
            </button>
          )}
        </div>

        {/* Tabs & Labels (Only show in Chat view) */}
        {!isContactsView && (
          <>
            <div className="flex gap-1 mt-3">
              {[
                { id: "all", label: "Tất cả" },
                { id: "unread", label: "Chưa đọc" },
                { id: "groups", label: "Nhóm" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                    activeTab === tab.id
                      ? "bg-primary-500 text-white"
                      : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex gap-2 mt-3 overflow-x-auto pb-1 scrollbar-hide items-center">
              <button
                onClick={() => setShowLabelManager(true)}
                className="px-2 py-1 flex-shrink-0 text-xs rounded-full border border-dashed border-gray-300 dark:border-gray-600 text-gray-500 hover:bg-gray-50 dark:hover:bg-dark-300 whitespace-nowrap"
              >
                + Quản lý nhãn
              </button>
              {labels.map((lbl) => (
                <button
                  key={lbl._id}
                  onClick={() =>
                    setActiveLabelId(activeLabelId === lbl._id ? null : lbl._id)
                  }
                  className="px-3 py-1 flex-shrink-0 text-xs rounded-full border whitespace-nowrap transition-colors"
                  style={{
                    borderColor: lbl.color,
                    backgroundColor:
                      activeLabelId === lbl._id ? lbl.color : "transparent",
                    color: activeLabelId === lbl._id ? "#fff" : lbl.color,
                  }}
                >
                  {lbl.name}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* List Content */}
      <div className="flex-1 overflow-y-auto p-2">
        {isContactsView ? (
          /* Contacts Menu Items */
          <div className="space-y-1">
            <Link
              to="/chat/contacts?tab=requests"
              className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${isContactsView && contactsTab === "requests" ? "bg-primary-50 dark:bg-primary-900/20 text-primary-600" : "hover:bg-gray-50 dark:hover:bg-dark-200 text-gray-700 dark:text-gray-300"}`}
            >
              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
                <UserPlus className="w-5 h-5" />
              </div>
              <span className="font-medium">Lời mời kết bạn</span>
            </Link>
            <Link
              to="/chat/contacts?tab=groups"
              className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${isContactsView && contactsTab === "groups" ? "bg-primary-50 dark:bg-primary-900/20 text-primary-600" : "hover:bg-gray-50 dark:hover:bg-dark-200 text-gray-700 dark:text-gray-300"}`}
            >
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                <Users className="w-5 h-5" />
              </div>
              <span className="font-medium">Danh sách nhóm</span>
            </Link>
            <Link
              to="/chat/contacts?tab=friends"
              className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${isContactsView && contactsTab === "friends" ? "bg-primary-50 dark:bg-primary-900/20 text-primary-600" : "hover:bg-gray-50 dark:hover:bg-dark-200 text-gray-700 dark:text-gray-300"}`}
            >
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                <UserIcon className="w-5 h-5" />
              </div>
              <span className="font-medium">Danh sách bạn bè</span>
            </Link>
            <Link
              to="/chat/contacts?tab=blocked"
              className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${isContactsView && contactsTab === "blocked" ? "bg-primary-50 dark:bg-primary-900/20 text-primary-600" : "hover:bg-gray-50 dark:hover:bg-dark-200 text-gray-700 dark:text-gray-300"}`}
            >
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600">
                <ShieldBan className="w-5 h-5" />
              </div>
              <span className="font-medium">Đã chặn</span>
            </Link>
          </div>
        ) : (
          /* Chat/Conversation List */
          <>
            <button
              onClick={() => {
                setActiveConversation(null);
                navigate("/chat/ai");
              }}
              className={`w-full flex items-center gap-3 p-3 mb-2 border rounded-xl transition-all text-left ${
                isAIView
                  ? "bg-primary-100 dark:bg-primary-900/35 border-primary-300 dark:border-primary-700"
                  : "bg-gradient-to-r from-primary-500/10 to-purple-500/10 border-primary-200 dark:border-primary-800 hover:from-primary-500/20 hover:to-purple-500/20"
              }`}
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-purple-500 flex items-center justify-center shadow-sm">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  AI Trợ lý
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Hỏi bất cứ điều gì
                </p>
              </div>
            </button>

            {sortedConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
                <MessageCircle className="w-12 h-12 mb-3 opacity-50" />
                <p className="text-sm">Chưa có cuộc trò chuyện</p>
              </div>
            ) : (
              sortedConversations.map((conv) => {
                const participants = conv.participants || [];
                const currentP = participants.find(
                  (p) => String(p.userId) === String(user?.id),
                );
                const isPinned = currentP?.isPinned;
                const isMuted = currentP?.isMuted;

                return (
                  <div
                    key={conv.id}
                    onClick={() => handleConversationClick(conv)}
                    className={`chat-item w-full flex items-center gap-3 relative group cursor-pointer ${
                      activeConversation?.id === conv.id ? "active" : ""
                    }`}
                  >
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      {getConversationAvatar(conv) ? (
                        <img
                          src={getConversationAvatar(conv)!}
                          alt={getConversationName(conv)}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                          {conv.type === "group" ? (
                            <Users className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                          ) : (
                            <span className="text-lg font-medium text-primary-600 dark:text-primary-400">
                              {getConversationName(conv)
                                .charAt(0)
                                .toUpperCase()}
                            </span>
                          )}
                        </div>
                      )}
                      {getOnlineStatus(conv) && (
                        <span className="online-indicator" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium text-gray-900 dark:text-white truncate flex items-center gap-1">
                          {getConversationName(conv)}
                          {isMuted && (
                            <BellOff className="w-3 h-3 text-gray-400" />
                          )}
                          {currentP?.labelIds
                            ?.slice(0, 2)
                            .map((lid: string) => {
                              const label = labels.find(
                                (l: any) => l._id === lid,
                              );
                              if (!label) return null;
                              return (
                                <div
                                  key={lid}
                                  className="w-2 h-2 rounded-full flex-shrink-0"
                                  title={label.name}
                                  style={{ backgroundColor: label.color }}
                                />
                              );
                            })}
                        </h3>
                        <div className="flex items-center gap-1">
                          {isPinned && (
                            <Pin className="w-3 h-3 text-primary-500" />
                          )}
                          {conv.lastMessage && (
                            <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                              {formatDistanceToNow(
                                new Date(conv.lastMessage.timestamp),
                                {
                                  addSuffix: false,
                                  locale: vi,
                                },
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                          {conv.lastMessage
                            ? getMessagePreviewText({
                                type: conv.lastMessage.type,
                                content: conv.lastMessage.content,
                                metadata: conv.lastMessage.metadata,
                              })
                            : "Bắt đầu cuộc trò chuyện"}
                        </p>
                        {conv.unreadCount > 0 && !isMuted && (
                          <span className="badge flex-shrink-0 ml-2">
                            {conv.unreadCount > 99 ? "99+" : conv.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Hover Actions */}
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-white dark:bg-dark-300 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 flex items-center p-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setLabelPickerConv(conv);
                        }}
                        className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-md transition-colors text-gray-500"
                        title="Phân loại"
                      >
                        <Tag className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => handleTogglePin(e, conv)}
                        className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-md transition-colors text-gray-500"
                        title={isPinned ? "Bỏ ghim" : "Ghim"}
                      >
                        <Pin
                          className={`w-4 h-4 ${isPinned ? "fill-primary-500 text-primary-500" : ""}`}
                        />
                      </button>
                      <button
                        onClick={(e) => handleToggleMute(e, conv)}
                        className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-md transition-colors text-gray-500"
                        title={isMuted ? "Bật thông báo" : "Tắt thông báo"}
                      >
                        <BellOff
                          className={`w-4 h-4 ${isMuted ? "text-red-500" : ""}`}
                        />
                      </button>
                      <button
                        onClick={(e) => handleToggleHide(e, conv)}
                        className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-md transition-colors text-gray-500"
                        title={currentP?.isHidden ? "Bo an" : "An tro chuyen"}
                      >
                        {currentP?.isHidden ? (
                          <Eye className="w-4 h-4 text-primary-500" />
                        ) : (
                          <EyeOff className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </>
        )}
      </div>

      {/* Bottom navigation */}
      <div className="border-t border-gray-200 dark:border-gray-800 p-2 flex-shrink-0">
        <div className="flex items-center justify-around">
          <Link
            to="/chat"
            className={`flex flex-col items-center gap-1 p-2 transition-colors ${!isContactsView && location.pathname !== "/chat/moments" ? "text-primary-500" : "text-gray-500 dark:text-gray-400 hover:text-primary-500"}`}
          >
            <MessageCircle className="w-5 h-5" />
            <span className="text-xs">Tin nhắn</span>
          </Link>
          <Link
            to="/chat/contacts"
            className={`flex flex-col items-center gap-1 p-2 transition-colors ${isContactsView ? "text-primary-500" : "text-gray-500 dark:text-gray-400 hover:text-primary-500"}`}
          >
            <Users className="w-5 h-5" />
            <span className="text-xs">Danh bạ</span>
          </Link>
          <Link
            to="/chat/moments"
            className={`flex flex-col items-center gap-1 p-2 transition-colors ${location.pathname === "/chat/moments" ? "text-primary-500" : "text-gray-500 dark:text-gray-400 hover:text-primary-500"}`}
          >
            <Clock className="w-5 h-5" />
            <span className="text-xs">Khoảnh khắc</span>
          </Link>
          <Link
            to="/profile"
            className="flex flex-col items-center gap-1 p-2 text-gray-500 dark:text-gray-400 hover:text-primary-500"
          >
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt=""
                className="w-5 h-5 rounded-full"
              />
            ) : (
              <UserIcon className="w-5 h-5" />
            )}
            <span className="text-xs">Cá nhân</span>
          </Link>
        </div>
      </div>

      {/* Modals */}
      <CreateGroupModal
        isOpen={showCreateGroup}
        onClose={() => setShowCreateGroup(false)}
      />
      <LabelManagerModal
        isOpen={showLabelManager}
        onClose={() => setShowLabelManager(false)}
      />
      {labelPickerConv && (
        <LabelPickerModal
          conversation={labelPickerConv}
          isOpen={!!labelPickerConv}
          onClose={() => setLabelPickerConv(null)}
        />
      )}
      <AddFriendModal
        isOpen={showAddFriend}
        onClose={() => setShowAddFriend(false)}
      />
      <HiddenPinModal
        isOpen={showHiddenPin}
        onClose={() => setShowHiddenPin(false)}
      />
      <PromptModal
        isOpen={showJoinGroup}
        onClose={() => setShowJoinGroup(false)}
        title="Tham gia nhóm"
        message="Nhập mã mời hoặc liên kết để tham gia nhóm chat."
        placeholder="Nhập mã mời nhóm..."
        confirmText="Tham gia"
        onConfirm={handleJoinByInvite}
      />
    </div>
  );
}

