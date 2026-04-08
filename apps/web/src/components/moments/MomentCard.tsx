import { useEffect, useRef, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import {
  MoreHorizontal,
  Heart,
  MessageCircle,
  Share2,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  X,
  Expand,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { Moment } from '@/types/moment';
import MomentComments from './MomentComments';

interface MomentCardProps {
  moment: Moment;
  onReact: (momentId: string, emoji: string) => Promise<void>;
  onDelete: (momentId: string) => Promise<void>;
  onShare: (momentId: string) => Promise<void>;
  onEdit: (moment: Moment) => void;
}

const REACTION_OPTIONS = [
  { key: 'like', label: 'Thích', icon: '👍' },
  { key: 'love', label: 'Yêu thích', icon: '❤️' },
  { key: 'haha', label: 'Haha', icon: '😂' },
  { key: 'wow', label: 'Wow', icon: '😮' },
  { key: 'sad', label: 'Buồn', icon: '😢' },
  { key: 'angry', label: 'Giận dữ', icon: '😡' },
];

const isVideoUrl = (url?: string | null) => {
  const normalizedUrl = String(url || '').split('?')[0].toLowerCase();
  return ['.mp4', '.mov', '.webm', '.m4v'].some((extension) =>
    normalizedUrl.endsWith(extension),
  );
};

function AutoplayVideo({
  url,
  className,
}: {
  url: string;
  className: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const target = containerRef.current;
    if (!target || typeof IntersectionObserver === 'undefined') {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting && entry.intersectionRatio >= 0.65);
      },
      {
        threshold: [0.35, 0.65, 0.85],
      },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    if (isVisible) {
      const playPromise = video.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {});
      }
      return;
    }

    video.pause();
  }, [isVisible, url]);

  return (
    <div ref={containerRef}>
      <video
        ref={videoRef}
        src={url}
        className={className}
        controls
        playsInline
        muted
        loop
        preload="metadata"
      />
    </div>
  );
}

function MomentMedia({
  url,
  alt,
  className,
  onOpen,
}: {
  url: string;
  alt: string;
  className: string;
  onOpen: () => void;
}) {
  if (isVideoUrl(url)) {
    return (
      <div className="relative overflow-hidden">
        <AutoplayVideo url={url} className={className} />
        <button
          type="button"
          onClick={onOpen}
          className="absolute right-3 top-3 rounded-full bg-black/60 p-2 text-white transition hover:bg-black/80"
          title="Xem lớn"
        >
          <Expand className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      className="block h-full w-full cursor-zoom-in overflow-hidden"
    >
      <img src={url} alt={alt} className={className} />
    </button>
  );
}

export default function MomentCard({
  moment,
  onReact,
  onDelete,
  onShare,
  onEdit,
}: MomentCardProps) {
  const { user } = useAuthStore();
  const [showReactions, setShowReactions] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [commentCount, setCommentCount] = useState(moment.commentCount);
  const [viewerMediaUrls, setViewerMediaUrls] = useState<string[] | null>(null);
  const [viewerIndex, setViewerIndex] = useState(0);

  useEffect(() => {
    setCommentCount(moment.commentCount);
  }, [moment.commentCount]);

  useEffect(() => {
    if (!viewerMediaUrls) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setViewerMediaUrls(null);
        setViewerIndex(0);
      }

      if (event.key === 'ArrowLeft' && viewerMediaUrls.length > 1) {
        setViewerIndex(
          (prev) => (prev - 1 + viewerMediaUrls.length) % viewerMediaUrls.length,
        );
      }

      if (event.key === 'ArrowRight' && viewerMediaUrls.length > 1) {
        setViewerIndex((prev) => (prev + 1) % viewerMediaUrls.length);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewerMediaUrls]);

  const activeReaction = REACTION_OPTIONS.find(
    (reaction) => reaction.key === moment.currentUserReaction,
  );

  const openViewer = (mediaUrls: string[], index: number) => {
    if (!mediaUrls.length) {
      return;
    }

    setViewerMediaUrls(mediaUrls);
    setViewerIndex(index);
  };

  const closeViewer = () => {
    setViewerMediaUrls(null);
    setViewerIndex(0);
  };

  const showPrevMedia = () => {
    setViewerIndex((prev) =>
      viewerMediaUrls ? (prev - 1 + viewerMediaUrls.length) % viewerMediaUrls.length : prev,
    );
  };

  const showNextMedia = () => {
    setViewerIndex((prev) =>
      viewerMediaUrls ? (prev + 1) % viewerMediaUrls.length : prev,
    );
  };

  const activeViewerUrl =
    viewerMediaUrls && viewerMediaUrls.length > 0
      ? viewerMediaUrls[viewerIndex]
      : null;
  const viewerMediaCount = viewerMediaUrls?.length || 0;

  return (
    <div className="mb-4 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-dark-200">
      <div className="flex items-start justify-between p-4">
        <div className="flex gap-3">
          {moment.author?.avartarUrl || (moment.isOwner && user?.avatarUrl) ? (
            <img
              src={
                (moment.isOwner ? user?.avatarUrl : moment.author?.avartarUrl) ||
                ''
              }
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

        {moment.isOwner ? (
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="rounded-full p-1 text-gray-500 transition-colors hover:bg-gray-100 dark:hover:bg-dark-300"
            >
              <MoreHorizontal className="h-5 w-5" />
            </button>
            {showMenu ? (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute right-0 z-20 mt-1 w-40 rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-dark-300">
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onEdit(moment);
                    }}
                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-dark-400"
                  >
                    <Pencil className="h-4 w-4" />
                    Chỉnh sửa
                  </button>
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
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="px-4 pb-2">
        {moment.content ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800 dark:text-gray-200">
            {moment.content}
          </p>
        ) : null}
      </div>

      {moment.mediaUrls.length > 0 ? (
        <div
          className={`mt-2 ${
            moment.mediaUrls.length > 1 ? 'grid grid-cols-2 gap-1' : ''
          }`}
        >
          {moment.mediaUrls.map((url, index) => (
            <MomentMedia
              key={`${url}-${index}`}
              url={url}
              alt="Moment media"
              className={`w-full bg-gray-100 object-cover dark:bg-dark-300 ${
                moment.mediaUrls.length === 1 ? 'max-h-[1000px]' : 'h-96'
              }`}
              onOpen={() => openViewer(moment.mediaUrls, index)}
            />
          ))}
        </div>
      ) : null}

      {moment.type === 'share' && moment.originalMomentSnapshot ? (
        <div className="m-4 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-dark-300">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-xs font-semibold text-primary-500">
              Chia sẻ bài viết từ{' '}
              {moment.originalMomentSnapshot.author?.userName || 'người dùng'}
            </span>
          </div>
          {moment.originalMomentSnapshot.content ? (
            <p className="mb-2 text-sm text-gray-700 dark:text-gray-300">
              {moment.originalMomentSnapshot.content}
            </p>
          ) : null}
          {moment.originalMomentSnapshot.mediaUrls?.[0] ? (
            <MomentMedia
              url={moment.originalMomentSnapshot.mediaUrls[0]}
              alt="Shared moment media"
              className="max-h-[32rem] w-full rounded-lg object-cover"
              onOpen={() =>
                openViewer(moment.originalMomentSnapshot?.mediaUrls || [], 0)
              }
            />
          ) : null}
        </div>
      ) : null}

      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
        <div className="flex items-center gap-1">
          {moment.reactionCount > 0 ? (
            <>
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary-100 text-[10px] text-primary-600 dark:bg-primary-900/30 dark:text-primary-400">
                ❤️
              </span>
              <span>{moment.reactionCount}</span>
            </>
          ) : null}
        </div>
        <div className="flex gap-3">
          {commentCount > 0 ? <span>{commentCount} bình luận</span> : null}
          {moment.shareCount > 0 ? <span>{moment.shareCount} lượt chia sẻ</span> : null}
        </div>
      </div>

      <div className="relative flex justify-between px-2 py-1">
        <div
          className="relative flex-1"
          onMouseEnter={() => setShowReactions(true)}
          onMouseLeave={() => setShowReactions(false)}
        >
          {showReactions ? (
            <div className="animate-fade-in absolute bottom-full left-0 z-10 mb-2 flex gap-1 rounded-full border border-gray-100 bg-white p-1 shadow-lg dark:border-gray-700 dark:bg-dark-300">
              {REACTION_OPTIONS.map((reaction) => (
                <button
                  key={reaction.key}
                  onClick={() => {
                    setShowReactions(false);
                    onReact(moment.momentId, reaction.key);
                  }}
                  className="text-2xl transition-transform hover:scale-125"
                  title={reaction.label}
                >
                  {reaction.icon}
                </button>
              ))}
            </div>
          ) : null}
          <button
            onClick={() =>
              onReact(
                moment.momentId,
                activeReaction ? activeReaction.key : 'like',
              )
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
            {activeReaction?.label || 'Cảm xúc'}
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

      {showComments ? (
        <div className="border-t border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-dark-100/30">
          <MomentComments
            momentId={moment.momentId}
            onCountChange={(delta) =>
              setCommentCount((prev) => Math.max(0, prev + delta))
            }
          />
        </div>
      ) : null}

      {activeViewerUrl ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4">
          <button
            type="button"
            onClick={closeViewer}
            className="absolute right-4 top-4 rounded-full bg-white/10 p-3 text-white transition hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>

          {viewerMediaCount > 1 ? (
            <>
              <button
                type="button"
                onClick={showPrevMedia}
                className="absolute left-4 rounded-full bg-white/10 p-3 text-white transition hover:bg-white/20"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                type="button"
                onClick={showNextMedia}
                className="absolute right-4 rounded-full bg-white/10 p-3 text-white transition hover:bg-white/20"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          ) : null}

          <div className="absolute top-4 text-sm font-semibold text-white">
            {viewerIndex + 1}/{viewerMediaCount}
          </div>

          <div className="max-h-[88vh] max-w-[88vw] overflow-hidden rounded-3xl bg-black">
            {isVideoUrl(activeViewerUrl) ? (
              <video
                src={activeViewerUrl}
                className="max-h-[88vh] max-w-[88vw]"
                controls
                playsInline
                autoPlay
              />
            ) : (
              <img
                src={activeViewerUrl}
                alt="Moment media preview"
                className="max-h-[88vh] max-w-[88vw] object-contain"
              />
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
