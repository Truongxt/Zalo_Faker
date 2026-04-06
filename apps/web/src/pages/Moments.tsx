import { useState, useEffect } from 'react';
import { momentService } from '@/services/momentService';
import { MomentAction, Moment } from '@/types/moment';
import MomentComposer from '@/components/moments/MomentComposer';
import MomentCard from '@/components/moments/MomentCard';
import { Sparkles, Users, User as UserIcon, Heart, Loader2 } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';

type FeedMode = 'friends' | 'me' | 'reacted';

export default function Moments() {
  const { addToast } = useToast();
  const [activeFeed, setActiveFeed] = useState<FeedMode>('friends');
  const [moments, setMoments] = useState<Moment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPosting, setIsPosting] = useState(false);

  const loadFeed = async (mode: FeedMode) => {
    setIsLoading(true);
    try {
      let data: Moment[] = [];
      if (mode === 'friends') {
        data = await momentService.getFriendMoments();
      } else if (mode === 'me') {
        const profile = await momentService.getMyProfile();
        data = profile.moments;
      } else if (mode === 'reacted') {
        data = await momentService.getReactedMoments();
      }
      setMoments(data);
    } catch (error: any) {
      addToast(error.message || 'Không thể tải nhật ký', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadFeed(activeFeed);
  }, [activeFeed]);

  const handlePost = async (content: string, imageFile: any) => {
    try {
      setIsPosting(true);
      await momentService.createMoment({ content, imageFile });
      addToast('Đăng khoảnh khắc thành công!', 'success');
      if (activeFeed !== 'me') {
        setActiveFeed('me'); // Chuyển qua xem bài của mình
      } else {
        loadFeed('me');
      }
    } catch (error: any) {
      addToast(error.message || 'Không thể đăng', 'error');
    } finally {
      setIsPosting(false);
    }
  };

  const handleReact = async (momentId: string, emoji: string) => {
    try {
      await momentService.reactToMoment(momentId, emoji);
      // Thay vì load lại toàn bộ, mình load lại feed hiện tại ẩn đi hoặc chỉnh sửa state
      loadFeed(activeFeed); // Reload tạm thời để đơn giản
    } catch (error: any) {
      addToast(error.message || 'Không thể thả cảm xúc', 'error');
    }
  };

  const handleDelete = async (momentId: string) => {
    if (!window.confirm('Bạn có chắc xoá khoảnh khắc này?')) return;
    try {
      await momentService.deleteMoment(momentId);
      addToast('Xoá thành công', 'success');
      setMoments(prev => prev.filter(m => m.momentId !== momentId));
    } catch (error: any) {
      addToast(error.message || 'Không thể xoá', 'error');
    }
  };

  const handleShare = async (momentId: string) => {
    if (!window.confirm('Đăng chia sẻ bài viết này lên nhật ký của bạn?')) return;
    try {
      await momentService.shareMoment(momentId);
      addToast('Chia sẻ thành công', 'success');
      if (activeFeed === 'me') loadFeed('me');
    } catch (error: any) {
      addToast(error.message || 'Không thể chia sẻ', 'error');
    }
  };

  return (
    <div className="flex-1 flex flex-col h-screen bg-gray-50 dark:bg-dark-100 overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 h-16 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-dark-200 flex items-center px-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Nhật ký</h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto py-6 px-4">
          
          {/* Composer */}
          <MomentComposer onPost={handlePost} isPosting={isPosting} />

          {/* Feed Switcher */}
          <div className="mt-6 mb-4 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            <button
               onClick={() => setActiveFeed('friends')}
               className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium text-sm transition-colors whitespace-nowrap ${
                 activeFeed === 'friends' 
                   ? 'bg-primary-500 text-white' 
                   : 'bg-white dark:bg-dark-200 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-dark-300'
               }`}
            >
              <Users className="w-4 h-4" /> Bạn bè
            </button>
            <button
               onClick={() => setActiveFeed('me')}
               className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium text-sm transition-colors whitespace-nowrap ${
                 activeFeed === 'me' 
                   ? 'bg-primary-500 text-white' 
                   : 'bg-white dark:bg-dark-200 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-dark-300'
               }`}
            >
              <UserIcon className="w-4 h-4" /> Của tôi
            </button>
            <button
               onClick={() => setActiveFeed('reacted')}
               className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium text-sm transition-colors whitespace-nowrap ${
                 activeFeed === 'reacted' 
                   ? 'bg-primary-500 text-white' 
                   : 'bg-white dark:bg-dark-200 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-dark-300'
               }`}
            >
              <Heart className="w-4 h-4" /> Đã thả cảm xúc
            </button>
          </div>

          {/* Feed List */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-primary-500 animate-spin mb-4" />
              <p className="text-gray-500 dark:text-gray-400">Đang tải nhật ký...</p>
            </div>
          ) : moments.length === 0 ? (
            <div className="bg-white dark:bg-dark-200 rounded-[28px] p-12 flex flex-col items-center mt-4 border border-gray-100 dark:border-gray-800 shadow-sm">
              <div className="w-16 h-16 bg-primary-50 dark:bg-primary-900/20 rounded-full flex items-center justify-center mb-4">
                 <Sparkles className="w-8 h-8 text-primary-500" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                {activeFeed === 'friends' ? 'Chưa có khoảnh khắc từ bạn bè' :
                 activeFeed === 'me' ? 'Trang cá nhân của bạn đang trống' :
                 'Tương tác trống'}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-sm">
                {activeFeed === 'friends' ? 'Bảng tin sẽ hiển thị khi có bài mới.' :
                 activeFeed === 'me' ? 'Hãy đăng khoảnh khắc đầu tiên của bạn.' :
                 'Những khoảnh khắc bạn thả cảm xúc sẽ xuất hiện ở đây.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {moments.map(moment => (
                <MomentCard 
                  key={moment.momentId} 
                  moment={moment} 
                  onReact={handleReact}
                  onDelete={handleDelete}
                  onShare={handleShare}
                />
              ))}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
