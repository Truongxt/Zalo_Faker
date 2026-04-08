import { useEffect, useState } from 'react';
import { Heart, Loader2, Sparkles, User as UserIcon, Users } from 'lucide-react';
import MomentCard from '@/components/moments/MomentCard';
import MomentComposer from '@/components/moments/MomentComposer';
import MomentEditModal from '@/components/moments/MomentEditModal';
import { applyMomentReactionLocally } from '@/components/moments/momentHelpers';
import { useToast } from '@/contexts/ToastContext';
import { momentService } from '@/services/momentService';
import type {
  MomentMediaFile,
  UpdateMomentPayload,
} from '@/services/momentService';
import type { Moment, MomentProfile } from '@/types/moment';

type FeedMode = 'friends' | 'me' | 'reacted';

const EMPTY_MESSAGES: Record<FeedMode, { title: string; description: string }> = {
  friends: {
    title: 'Chưa có khoảnh khắc từ bạn bè',
    description:
      'Khi bạn bè đăng bài mới, feed này sẽ cập nhật ngay tại đây.',
  },
  me: {
    title: 'Bạn chưa đăng khoảnh khắc nào',
    description:
      'Hãy đăng bài đầu tiên để bắt đầu trang cá nhân của bạn.',
  },
  reacted: {
    title: 'Chưa có khoảnh khắc đã thả cảm xúc',
    description:
      'Những bài bạn đã react sẽ được lưu lại để xem nhanh ở đây.',
  },
};

const replaceMomentInList = (moments: Moment[], updatedMoment: Moment) =>
  moments.map((moment) =>
    moment.momentId === updatedMoment.momentId ? updatedMoment : moment,
  );

const removeMomentFromList = (moments: Moment[], momentId: string) =>
  moments.filter((moment) => moment.momentId !== momentId);

const updateMomentCommentCount = (
  moments: Moment[],
  momentId: string,
  delta: number,
) =>
  moments.map((moment) =>
    moment.momentId === momentId
      ? {
          ...moment,
          commentCount: Math.max(0, moment.commentCount + delta),
        }
      : moment,
  );

export default function Moments() {
  const { addToast } = useToast();
  const [activeFeed, setActiveFeed] = useState<FeedMode>('friends');
  const [moments, setMoments] = useState<Moment[]>([]);
  const [profile, setProfile] = useState<MomentProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPosting, setIsPosting] = useState(false);
  const [editingMoment, setEditingMoment] = useState<Moment | null>(null);
  const [isEditSaving, setIsEditSaving] = useState(false);

  const loadFeed = async (mode: FeedMode) => {
    setIsLoading(true);

    try {
      if (mode === 'friends') {
        const data = await momentService.getFriendMoments();
        setMoments(data);
        setProfile(null);
        return;
      }

      if (mode === 'me') {
        const data = await momentService.getMyProfile();
        setProfile(data);
        setMoments(data.moments);
        return;
      }

      const data = await momentService.getReactedMoments();
      setMoments(data);
      setProfile(null);
    } catch (error: any) {
      addToast(error?.message || 'Không thể tải nhật ký', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadFeed(activeFeed);
  }, [activeFeed]);

  const handlePost = async (content: string, mediaFiles: MomentMediaFile[]) => {
    try {
      setIsPosting(true);
      const createdMoment = await momentService.createMoment({ content, mediaFiles });
      addToast('Đăng khoảnh khắc thành công!', 'success');

      if (activeFeed === 'me') {
        setMoments((prev) => [createdMoment, ...prev]);
        return;
      }

      setActiveFeed('me');
    } catch (error: any) {
      addToast(error?.message || 'Không thể đăng khoảnh khắc', 'error');
    } finally {
      setIsPosting(false);
    }
  };

  const handleReact = async (momentId: string, emoji: string) => {
    const previousMoments = moments;

    setMoments((prev) =>
      prev.map((moment) =>
        moment.momentId === momentId
          ? applyMomentReactionLocally(moment, emoji)
          : moment,
      ),
    );

    try {
      await momentService.reactToMoment(momentId, emoji);
    } catch (error: any) {
      setMoments(previousMoments);
      addToast(error?.message || 'Không thể thả cảm xúc', 'error');
    }
  };

  const handleDelete = async (momentId: string) => {
    if (!window.confirm('Bạn có chắc muốn xóa khoảnh khắc này?')) {
      return;
    }

    const previousMoments = moments;
    setMoments((prev) => removeMomentFromList(prev, momentId));

    try {
      await momentService.deleteMoment(momentId);
      addToast('Đã xóa khoảnh khắc', 'success');

      if (editingMoment?.momentId === momentId) {
        setEditingMoment(null);
      }
    } catch (error: any) {
      setMoments(previousMoments);
      addToast(error?.message || 'Không thể xóa khoảnh khắc', 'error');
    }
  };

  const handleShare = async (momentId: string) => {
    if (
      !window.confirm(
        'Đăng chia sẻ khoảnh khắc này lên nhật ký của bạn?',
      )
    ) {
      return;
    }

    try {
      const sharedMoment = await momentService.shareMoment(momentId);
      addToast('Đã chia sẻ khoảnh khắc', 'success');

      if (activeFeed === 'me') {
        setMoments((prev) => [sharedMoment, ...prev]);
        return;
      }

      if (activeFeed === 'reacted') {
        await loadFeed('reacted');
      }
    } catch (error: any) {
      addToast(error?.message || 'Không thể chia sẻ khoảnh khắc', 'error');
    }
  };

  const handleSaveEdit = async (payload: UpdateMomentPayload) => {
    if (!editingMoment) {
      return;
    }

    try {
      setIsEditSaving(true);
      const updatedMoment = await momentService.updateMoment(
        editingMoment.momentId,
        payload,
      );

      setMoments((prev) => replaceMomentInList(prev, updatedMoment));
      addToast('Đã cập nhật khoảnh khắc', 'success');
      setEditingMoment(null);
    } catch (error: any) {
      addToast(error?.message || 'Không thể cập nhật khoảnh khắc', 'error');
    } finally {
      setIsEditSaving(false);
    }
  };

  const handleCommentCountChange = (momentId: string, delta: number) => {
    setMoments((prev) => updateMomentCommentCount(prev, momentId, delta));
  };

  return (
    <div className="flex h-screen flex-1 flex-col overflow-hidden bg-gray-50 dark:bg-dark-100">
      <div className="flex h-16 flex-shrink-0 items-center border-b border-gray-200 bg-white px-6 dark:border-gray-800 dark:bg-dark-200">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          Nhật ký
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[50rem] px-4 py-6">
          <MomentComposer onPost={handlePost} isPosting={isPosting} />

          <div className="mb-4 mt-6 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            <button
              type="button"
              onClick={() => setActiveFeed('friends')}
              className={`flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                activeFeed === 'friends'
                  ? 'bg-primary-500 text-white'
                  : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-800 dark:bg-dark-200 dark:text-gray-300 dark:hover:bg-dark-300'
              }`}
            >
              <Users className="h-4 w-4" />
              Bạn bè
            </button>

            <button
              type="button"
              onClick={() => setActiveFeed('me')}
              className={`flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                activeFeed === 'me'
                  ? 'bg-primary-500 text-white'
                  : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-800 dark:bg-dark-200 dark:text-gray-300 dark:hover:bg-dark-300'
              }`}
            >
              <UserIcon className="h-4 w-4" />
              Của tôi
            </button>

            <button
              type="button"
              onClick={() => setActiveFeed('reacted')}
              className={`flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                activeFeed === 'reacted'
                  ? 'bg-primary-500 text-white'
                  : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-800 dark:bg-dark-200 dark:text-gray-300 dark:hover:bg-dark-300'
              }`}
            >
              <Heart className="h-4 w-4" />
              Đã thả cảm xúc
            </button>
          </div>

          {activeFeed === 'me' && profile?.user ? (
            <div className="mb-4 rounded-[28px] bg-primary-500 px-5 py-5 text-white shadow-sm">
              <div className="flex items-center gap-4">
                {profile.user.avartarUrl ? (
                  <img
                    src={profile.user.avartarUrl}
                    alt={profile.user.userName}
                    className="h-14 w-14 rounded-full object-cover ring-2 ring-white/30"
                  />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/20 text-lg font-bold">
                    {profile.user.userName.charAt(0).toUpperCase()}
                  </div>
                )}

                <div>
                  <h3 className="text-lg font-bold">{profile.user.userName}</h3>
                  <p className="mt-1 text-sm text-white/80">
                    {moments.length} khoảnh khắc đã đăng
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="mb-4 h-8 w-8 animate-spin text-primary-500" />
              <p className="text-gray-500 dark:text-gray-400">
                Đang tải nhật ký...
              </p>
            </div>
          ) : moments.length === 0 ? (
            <div className="mt-4 flex flex-col items-center rounded-[28px] border border-gray-100 bg-white p-12 shadow-sm dark:border-gray-800 dark:bg-dark-200">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary-50 dark:bg-primary-900/20">
                <Sparkles className="h-8 w-8 text-primary-500" />
              </div>
              <h3 className="mb-2 text-lg font-bold text-gray-900 dark:text-white">
                {EMPTY_MESSAGES[activeFeed].title}
              </h3>
              <p className="max-w-sm text-center text-sm text-gray-500 dark:text-gray-400">
                {EMPTY_MESSAGES[activeFeed].description}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {moments.map((moment) => (
                <MomentCard
                  key={moment.momentId}
                  moment={moment}
                  onReact={handleReact}
                  onDelete={handleDelete}
                  onShare={handleShare}
                  onEdit={setEditingMoment}
                  onCommentCountChange={handleCommentCountChange}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <MomentEditModal
        moment={editingMoment}
        isSaving={isEditSaving}
        onClose={() => setEditingMoment(null)}
        onSave={handleSaveEdit}
      />
    </div>
  );
}
