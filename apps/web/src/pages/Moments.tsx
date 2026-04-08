import { useEffect, useState } from 'react';
import { Heart, Loader2, Sparkles, User as UserIcon, Users } from 'lucide-react';
import MomentCard from '@/components/moments/MomentCard';
import MomentComposer from '@/components/moments/MomentComposer';
import MomentEditModal from '@/components/moments/MomentEditModal';
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
    title: 'Ch\u01b0a c\u00f3 kho\u1ea3nh kh\u1eafc t\u1eeb b\u1ea1n b\u00e8',
    description:
      'Khi b\u1ea1n b\u00e8 \u0111\u0103ng b\u00e0i m\u1edbi, feed n\u00e0y s\u1ebd c\u1eadp nh\u1eadt ngay t\u1ea1i \u0111\u00e2y.',
  },
  me: {
    title: 'B\u1ea1n ch\u01b0a \u0111\u0103ng kho\u1ea3nh kh\u1eafc n\u00e0o',
    description:
      'H\u00e3y \u0111\u0103ng b\u00e0i \u0111\u1ea7u ti\u00ean \u0111\u1ec3 b\u1eaft \u0111\u1ea7u trang c\u00e1 nh\u00e2n c\u1ee7a b\u1ea1n.',
  },
  reacted: {
    title: 'Ch\u01b0a c\u00f3 kho\u1ea3nh kh\u1eafc \u0111\u00e3 th\u1ea3 c\u1ea3m x\u00fac',
    description:
      'Nh\u1eefng b\u00e0i b\u1ea1n \u0111\u00e3 react s\u1ebd \u0111\u01b0\u1ee3c l\u01b0u l\u1ea1i \u0111\u1ec3 xem nhanh \u1edf \u0111\u00e2y.',
  },
};

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
      addToast(error?.message || 'Kh\u00f4ng th\u1ec3 t\u1ea3i nh\u1eadt k\u00fd', 'error');
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
      await momentService.createMoment({ content, mediaFiles });
      addToast('\u0110\u0103ng kho\u1ea3nh kh\u1eafc th\u00e0nh c\u00f4ng!', 'success');

      if (activeFeed !== 'me') {
        setActiveFeed('me');
      } else {
        await loadFeed('me');
      }
    } catch (error: any) {
      addToast(error?.message || 'Kh\u00f4ng th\u1ec3 \u0111\u0103ng kho\u1ea3nh kh\u1eafc', 'error');
    } finally {
      setIsPosting(false);
    }
  };

  const handleReact = async (momentId: string, emoji: string) => {
    try {
      await momentService.reactToMoment(momentId, emoji);
      await loadFeed(activeFeed);
    } catch (error: any) {
      addToast(error?.message || 'Kh\u00f4ng th\u1ec3 th\u1ea3 c\u1ea3m x\u00fac', 'error');
    }
  };

  const handleDelete = async (momentId: string) => {
    if (!window.confirm('B\u1ea1n c\u00f3 ch\u1eafc mu\u1ed1n x\u00f3a kho\u1ea3nh kh\u1eafc n\u00e0y?')) {
      return;
    }

    try {
      await momentService.deleteMoment(momentId);
      addToast('\u0110\u00e3 x\u00f3a kho\u1ea3nh kh\u1eafc', 'success');
      setMoments((prev) => prev.filter((moment) => moment.momentId !== momentId));

      if (editingMoment?.momentId === momentId) {
        setEditingMoment(null);
      }
    } catch (error: any) {
      addToast(error?.message || 'Kh\u00f4ng th\u1ec3 x\u00f3a kho\u1ea3nh kh\u1eafc', 'error');
    }
  };

  const handleShare = async (momentId: string) => {
    if (
      !window.confirm(
        '\u0110\u0103ng chia s\u1ebb kho\u1ea3nh kh\u1eafc n\u00e0y l\u00ean nh\u1eadt k\u00fd c\u1ee7a b\u1ea1n?',
      )
    ) {
      return;
    }

    try {
      await momentService.shareMoment(momentId);
      addToast('\u0110\u00e3 chia s\u1ebb kho\u1ea3nh kh\u1eafc', 'success');
      await loadFeed(activeFeed === 'reacted' ? 'me' : activeFeed);
    } catch (error: any) {
      addToast(error?.message || 'Kh\u00f4ng th\u1ec3 chia s\u1ebb kho\u1ea3nh kh\u1eafc', 'error');
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

      setMoments((prev) =>
        prev.map((moment) =>
          moment.momentId === updatedMoment.momentId ? updatedMoment : moment,
        ),
      );

      addToast('\u0110\u00e3 c\u1eadp nh\u1eadt kho\u1ea3nh kh\u1eafc', 'success');
      setEditingMoment(null);
    } catch (error: any) {
      addToast(error?.message || 'Kh\u00f4ng th\u1ec3 c\u1eadp nh\u1eadt kho\u1ea3nh kh\u1eafc', 'error');
    } finally {
      setIsEditSaving(false);
    }
  };

  return (
    <div className="flex h-screen flex-1 flex-col overflow-hidden bg-gray-50 dark:bg-dark-100">
      <div className="flex h-16 flex-shrink-0 items-center border-b border-gray-200 bg-white px-6 dark:border-gray-800 dark:bg-dark-200">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          Nh\u1eadt k\u00fd
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[50rem] px-4 py-6">
          <MomentComposer onPost={handlePost} isPosting={isPosting} />

          <div className="mb-4 mt-6 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            <button
              onClick={() => setActiveFeed('friends')}
              className={`flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                activeFeed === 'friends'
                  ? 'bg-primary-500 text-white'
                  : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-800 dark:bg-dark-200 dark:text-gray-300 dark:hover:bg-dark-300'
              }`}
            >
              <Users className="h-4 w-4" />
              B\u1ea1n b\u00e8
            </button>

            <button
              onClick={() => setActiveFeed('me')}
              className={`flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                activeFeed === 'me'
                  ? 'bg-primary-500 text-white'
                  : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-800 dark:bg-dark-200 dark:text-gray-300 dark:hover:bg-dark-300'
              }`}
            >
              <UserIcon className="h-4 w-4" />
              C\u1ee7a t\u00f4i
            </button>

            <button
              onClick={() => setActiveFeed('reacted')}
              className={`flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                activeFeed === 'reacted'
                  ? 'bg-primary-500 text-white'
                  : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-800 dark:bg-dark-200 dark:text-gray-300 dark:hover:bg-dark-300'
              }`}
            >
              <Heart className="h-4 w-4" />
              \u0110\u00e3 th\u1ea3 c\u1ea3m x\u00fac
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
                    {moments.length} kho\u1ea3nh kh\u1eafc \u0111\u00e3 \u0111\u0103ng
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="mb-4 h-8 w-8 animate-spin text-primary-500" />
              <p className="text-gray-500 dark:text-gray-400">
                \u0110ang t\u1ea3i nh\u1eadt k\u00fd...
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
