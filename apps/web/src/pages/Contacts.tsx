import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useChatStore } from '@/stores/chatStore';
import { friendsService } from '@/services/friendsService';
import { getFriends } from '@/services/api';
import { FriendRequest } from '@/types/friends';
import { User as UserIcon, UserPlus, Users, Check, X, Search, MessageCircle } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { useNavigate } from 'react-router-dom';
import { chatService } from '@/services/chat';

type ContactTab = 'friends' | 'groups' | 'requests';

export default function Contacts() {
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const { conversations, setActiveConversation } = useChatStore();
    const { addToast } = useToast();
    
    const [activeTab, setActiveTab] = useState<ContactTab>('friends');
    const [friends, setFriends] = useState<any[]>([]);
    const [requests, setRequests] = useState<FriendRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    const loadData = async () => {
        if (!user?.id) return;
        setIsLoading(true);
        try {
            const [friendsData, requestsData] = await Promise.all([
                getFriends(user.id),
                friendsService.getPendingRequests(user.id)
            ]);
            setFriends(friendsData);
            setRequests(requestsData);
        } catch (error) {
            console.error('Error loading contacts data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [user?.id]);

    const handleAcceptRequest = async (req: FriendRequest) => {
        try {
            await friendsService.acceptFriendRequest(req.fromUserId, req.toUserId);
            addToast('Đã chấp nhận lời mời kết bạn', 'success');
            loadData();
        } catch (error) {
            addToast('Không thể chấp nhận lời mời', 'error');
        }
    };

    const handleMessageClick = async (friendId: string) => {
        if (!friendId) return;

        console.log('Handle message click for friendId:', friendId);
        console.log('Current conversations:', conversations);

        // Tìm cuộc hội thoại riêng tư đã có
        const existingConv = conversations.find(c => 
            c.type === 'private' && 
            c.participants.some(p => String(p.userId) === String(friendId))
        );

        console.log('Existing conversation found:', existingConv);

        if (existingConv) {
            const convId = existingConv.id || (existingConv as any)._id;
            console.log('Navigating to existing conversation:', convId);
            setActiveConversation(existingConv);
            navigate(`/chat/${convId}`);
        } else {
            try {
                console.log('Creating new conversation with friendId:', friendId);
                // Tạo mới nếu chưa có
                const newConv = await chatService.createConversation([String(friendId)], 'private');
                console.log('New conversation created:', newConv);
                
                // Đảm bảo ID được map đúng
                const convToSet = { ...newConv, id: newConv.id || (newConv as any)._id };
                console.log('Navigating to new conversation:', convToSet.id);
                
                setActiveConversation(convToSet);
                navigate(`/chat/${convToSet.id}`);
            } catch (error) {
                console.error('Error creating conversation:', error);
                addToast('Không thể tạo cuộc hội thoại', 'error');
            }
        }
    };

    const groupConversations = conversations.filter(c => c.type === 'group');

    const filteredFriends = friends.filter(f => {
        const name = f.fullName || '';
        return name.toLowerCase().includes(searchQuery.toLowerCase());
    });

    const filteredGroups = groupConversations.filter(g => {
        const name = g.name || '';
        return name.toLowerCase().includes(searchQuery.toLowerCase());
    });

    return (
        <div className="flex-1 flex flex-col bg-white dark:bg-dark-100 overflow-hidden">
            {/* Header */}
            <div className="h-16 border-b border-gray-200 dark:border-gray-800 flex items-center px-6 justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                    {activeTab === 'friends' && <UserIcon className="w-6 h-6 text-primary-500" />}
                    {activeTab === 'groups' && <Users className="w-6 h-6 text-primary-500" />}
                    {activeTab === 'requests' && <UserPlus className="w-6 h-6 text-primary-500" />}
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {activeTab === 'friends' ? 'Danh sách bạn bè' : 
                         activeTab === 'groups' ? 'Danh sách nhóm' : 'Lời mời kết bạn'}
                    </h2>
                </div>
                
                <div className="flex items-center gap-4">
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
            </div>

            {/* Content area */}
            <div className="flex-1 overflow-y-auto p-6">
                {isLoading ? (
                    <div className="flex items-center justify-center h-64">
                         <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : (
                    <div className="max-w-4xl mx-auto">
                        {/* Tab Switcher (Mobile style or mini-tabs) */}
                        <div className="flex gap-4 mb-8 border-b border-gray-100 dark:border-gray-800 pb-4">
                            <button 
                                onClick={() => setActiveTab('friends')}
                                className={`pb-2 px-1 font-medium transition-colors relative ${activeTab === 'friends' ? 'text-primary-500' : 'text-gray-500'}`}
                            >
                                Bạn bè ({friends.length})
                                {activeTab === 'friends' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500" />}
                            </button>
                            <button 
                                onClick={() => setActiveTab('groups')}
                                className={`pb-2 px-1 font-medium transition-colors relative ${activeTab === 'groups' ? 'text-primary-500' : 'text-gray-500'}`}
                            >
                                Nhóm ({groupConversations.length})
                                {activeTab === 'groups' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500" />}
                            </button>
                            <button 
                                onClick={() => setActiveTab('requests')}
                                className={`pb-2 px-1 font-medium transition-colors relative ${activeTab === 'requests' ? 'text-primary-500' : 'text-gray-500'}`}
                            >
                                Lời mời ({requests.length})
                                {activeTab === 'requests' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500" />}
                            </button>
                        </div>

                        {/* Rendering content based on activeTab */}
                        {activeTab === 'friends' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {filteredFriends.length === 0 ? (
                                    <div className="col-span-full py-20 text-center text-gray-500">
                                        Không tìm thấy bạn bè nào.
                                    </div>
                                ) : (
                                    filteredFriends.map((friend, idx) => (
                                        <div key={friend.id || idx} className="flex items-center gap-4 p-4 border border-gray-100 dark:border-gray-800 rounded-xl hover:bg-gray-50 dark:hover:bg-dark-200 transition-colors group">
                                            <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 bg-primary-100 dark:bg-primary-900/30">
                                                {friend.avatarUrl ? (
                                                    <img src={friend.avatarUrl} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-primary-600 font-bold">
                                                        {friend.fullName?.charAt(0).toUpperCase() || '?'}
                                                    </div>
                                                )}
                                            </div>
                                             <div className="flex-1 min-w-0 pointer-events-none">
                                                 <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                                                     {friend.fullName || 'Người dùng'}
                                                 </h3>
                                                 <div className="flex items-center gap-1.5 mt-0.5">
                                                     <div className={`w-2 h-2 rounded-full ${['online', 'active'].includes(friend.status?.toLowerCase() || '') ? 'bg-green-500' : 'bg-gray-400'}`} />
                                                     <p className="text-[11px] text-gray-500 truncate capitalize">
                                                         {['online', 'active'].includes(friend.status?.toLowerCase() || '') ? 'Đang hoạt động' : 'Ngoại tuyến'}
                                                     </p>
                                                 </div>
                                             </div>
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (friend.id) handleMessageClick(String(friend.id));
                                                }}
                                                className="p-2 opacity-0 group-hover:opacity-100 transition-opacity text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg pointer-events-auto cursor-pointer"
                                            >
                                                <MessageCircle className="w-5 h-5" />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}

                        {activeTab === 'requests' && (
                            <div className="space-y-4">
                                {requests.length === 0 ? (
                                    <div className="py-20 text-center text-gray-500">
                                        Không có lời mời kết bạn mới.
                                    </div>
                                ) : (
                                    requests.map(req => (
                                        <div key={req.id} className="flex items-center gap-4 p-4 border border-gray-200 dark:border-gray-800 rounded-xl bg-primary-50/30 dark:bg-primary-900/10">
                                            <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0">
                                                {req.fromUser?.avatarUrl ? (
                                                    <img src={req.fromUser.avatarUrl} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full bg-gray-200 flex items-center justify-center font-bold">
                                                        {req.fromUser?.fullName?.charAt(0).toUpperCase()}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1">
                                                <h3 className="font-semibold text-gray-900 dark:text-white">{req.fromUser?.fullName}</h3>
                                                <p className="text-sm text-gray-600 dark:text-gray-400">{req.message || 'Muốn kết bạn với bạn'}</p>
                                                <p className="text-xs text-gray-400 mt-1">{new Date(req.createdAt).toLocaleDateString('vi-VN')}</p>
                                            </div>
                                            <div className="flex gap-2">
                                                <button 
                                                    onClick={() => handleAcceptRequest(req)}
                                                    className="p-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
                                                >
                                                    <Check className="w-5 h-5" />
                                                </button>
                                                <button className="p-2 bg-gray-200 dark:bg-dark-300 text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-300 dark:hover:bg-dark-200 transition-colors">
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
                                    <div className="col-span-full py-20 text-center text-gray-500">
                                        Bạn chưa tham gia nhóm nào.
                                    </div>
                                ) : (
                                    filteredGroups.map(group => (
                                        <div key={group.id} className="flex items-center gap-4 p-4 border border-gray-100 dark:border-gray-800 rounded-xl hover:bg-gray-50 dark:hover:bg-dark-200 transition-colors">
                                            <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                                                {group.avatar ? (
                                                    <img src={group.avatar} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    <Users className="w-6 h-6 text-primary-500" />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-semibold text-gray-900 dark:text-white truncate">{group.name || 'Nhóm chat'}</h3>
                                                <p className="text-xs text-gray-500">{group.participants.length} thành viên</p>
                                            </div>
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
