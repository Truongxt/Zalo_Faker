import { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import {
  MoreHorizontal,
  Heart,
  MessageCircle,
  Share2,
  Trash2,
} from 'lucide-react';
import { Moment } from '@/types/moment';
import MomentComments from './MomentComments';

interface MomentCardProps {
  moment: Moment;
  onReact: (momentId: string, emoji: string) => Promise<void>;
  onDelete: (momentId: string) => Promise<void>;
  onShare: (momentId: string) => Promise<void>;
}

const REACTION_OPTIONS = [
  { key: 'like', icon: '👍' },
  { key: 'love', icon: '❤️' },
  { key: 'haha', icon: '😂' },
  { key: 'wow', icon: '😮' },
  { key: 'sad', icon: '😢' },
  { key: 'angry', icon: '😡' },
];

const isVideoUrl = (url?: string | null) => {
  if (!url) return false;
  // Handle URLs with query parameters or fragments
  const cleanUrl = url.split(/[?#]/)[0].toLowerCase();
  return ['.mp4', '.mov', '.webm', '.m4v', '.ogv'].some((extension) =>
    cleanUrl.endsWith(extension),
  );
};

function MomentMedia({
  url,
  alt,
  className,
}: {
  url: string;
  alt: string;
  className: string;
}) {
  if (isVideoUrl(url)) {
    // Append #t=0.001 to force browser to load the first frame as the poster/thumbnail
    const videoUrl = url.includes('#t=') ? url : `${url}#t=0.001`;
    
    return (
      <video
        src={videoUrl}
        className={className}
        controls
        playsInline
        preload="metadata"
      />
    );
  }

  return <img src={url} alt={alt} className={className} />;
}

export default function MomentCard({
  moment,
  onReact,
  onDelete,
  onShare,
}: MomentCardProps) {
  const { user } = useAuthStore();
  const [showReactions, setShowReactions] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const activeReaction = REACTION_OPTIONS.find(
    (reaction) => reaction.key === moment.currentUserReaction,
  );

  return (
    <div className="mb-4 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-dark-200">
      <div className="flex items-start justify-between p-4">
        <div className="flex gap-3">
          {moment.author?.avartarUrl || (moment.isOwner && user?.avatarUrl) ? (
            <img
              src={(moment.isOwner ? user?.avatarUrl : moment.author?.avartarUrl) || ''}
              alt={moment.author?.userName || 'User'}
              className="h-10 w-10 shrink-0 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/30">
              <span className="text-sm font-medium text-primary-600 dark:text-primary-400">
                {(moment.author?.userName || user?.fullName || 'U')
                  .charAt(0)
                  .toUpperCase()}
              </span>
            </div>
          )}

          <div>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
              {moment.author?.userName ||
                (moment.isOwner ? user?.fullName : 'Người dùng')}
            </h4>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {formatDistanceToNow(new Date(moment.createdAt), {
                addSuffix: true,
                locale: vi,
              })}
            </span>
          </div>
        </div>

        {moment.isOwner && (
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="rounded-full p-1 text-gray-500 transition-colors hover:bg-gray-100 dark:hover:bg-dark-300"
            >
              <MoreHorizontal className="h-5 w-5" />
            </button>
            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute right-0 z-20 mt-1 w-36 rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-dark-300">
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onDelete(moment.momentId);
                    }}
                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-600 hover:bg-gray-100 dark:hover:bg-dark-400"
                  >
                    <Trash2 className="h-4 w-4" />
                    Xóa bài viết
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="px-4 pb-2">
        {moment.content ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800 dark:text-gray-200">
            {moment.content}
          </p>
        ) : null}
      </div>

      {moment.mediaUrls.length > 0 && (
        <div
          className={`mt-2 ${
            moment.mediaUrls.length > 1 ? 'grid grid-cols-2 gap-1' : ''
          }`}
        >
          {moment.mediaUrls.map((url, idx) => (
            <MomentMedia
              key={`${url}-${idx}`}
              url={url}
              alt="Moment media"
              className={`w-full bg-gray-100 object-cover dark:bg-dark-300 ${
                moment.mediaUrls.length === 1 ? 'max-h-[500px]' : 'h-48'
              }`}
            />
          ))}
        </div>
      )}

      {moment.type === 'share' && moment.originalMomentSnapshot && (
        <div className="m-4 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-dark-300">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-xs font-semibold text-primary-500">
              Chia sẻ bài viết từ{' '}
              {moment.originalMomentSnapshot.author?.userName || 'người dùng'}
            </span>
          </div>
          {moment.originalMomentSnapshot.content && (
            <p className="mb-2 text-sm text-gray-700 dark:text-gray-300">
              {moment.originalMomentSnapshot.content}
            </p>
          )}
          {moment.originalMomentSnapshot.mediaUrls?.[0] && (
            <MomentMedia
              url={moment.originalMomentSnapshot.mediaUrls[0]}
              alt="Shared moment media"
              className="max-h-64 w-full rounded-lg object-cover"
            />
          )}
        </div>
      )}

      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
        <div className="flex items-center gap-1">
          {moment.reactionCount > 0 && (
            <>
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary-100 text-[10px] text-primary-600 dark:bg-primary-900/30 dark:text-primary-400">
                ❤️
              </span>
              <span>{moment.reactionCount}</span>
            </>
          )}
        </div>
        <div className="flex gap-3">
          {moment.commentCount > 0 && <span>{moment.commentCount} bình luận</span>}
          {moment.shareCount > 0 && <span>{moment.shareCount} lượt chia sẻ</span>}
        </div>
      </div>

      <div className="relative flex justify-between px-2 py-1">
        <div
          className="relative flex-1"
          onMouseEnter={() => setShowReactions(true)}
          onMouseLeave={() => setShowReactions(false)}
        >
          {showReactions && (
            <div className="absolute bottom-full left-0 z-10 mb-2 flex gap-1 rounded-full border border-gray-100 bg-white p-1 shadow-lg animate-fade-in dark:border-gray-700 dark:bg-dark-300">
              {REACTION_OPTIONS.map((reaction) => (
                <button
                  key={reaction.key}
                  onClick={() => {
                    setShowReactions(false);
                    onReact(moment.momentId, reaction.key);
                  }}
                  className="text-2xl transition-transform hover:scale-125"
                  title={reaction.key}
                >
                  {reaction.icon}
                </button>
              ))}
            </div>
          )}
          <button
            onClick={() =>
              onReact(moment.momentId, activeReaction ? 'like' : 'like')
            }
            className={`flex w-full items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-colors hover:bg-gray-50 dark:hover:bg-dark-300 ${
              activeReaction
                ? 'text-primary-500'
                : 'text-gray-600 dark:text-gray-400'
            }`}
          >
            {activeReaction ? (
              <span className="text-base">{activeReaction.icon}</span>
            ) : (
              <Heart className="h-5 w-5" />
            )}
            Thích
          </button>
        </div>

        <button
          onClick={() => setShowComments(!showComments)}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-dark-300"
        >
          <MessageCircle className="h-5 w-5" />
          Bình luận
        </button>

        <button
          onClick={() => onShare(moment.momentId)}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-dark-300"
        >
          <Share2 className="h-5 w-5" />
          Chia sẻ
        </button>
      </div>

      {showComments && (
        <div className="border-t border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-dark-100/30">
          <MomentComments momentId={moment.momentId} />
        </div>
      )}
    </div>
  );
}
