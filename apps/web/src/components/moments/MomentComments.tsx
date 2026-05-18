import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Loader2, Send, Reply, Smile, X, MessageCircle } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { momentService } from '@/services/momentService';
import { useAuthStore } from '@/stores/authStore';
import { MomentComment } from '@/types/moment';
import MomentReactionPicker from './MomentReactionPicker';
import { getReactionOption, summarizeCommentReactions } from './momentHelpers';

interface MomentCommentsProps {
  momentId: string;
  onCountChange?: (delta: number) => void;
  canManageComments?: boolean;
}

const getDisplayName = (
  userName?: string | null,
  fallback = 'Người dùng',
) => userName || fallback;

export default function MomentComments({
  momentId,
  onCountChange,
  canManageComments = false,
}: MomentCommentsProps) {
  const { user } = useAuthStore();
  const currentUserId = String(user?.userId || user?.id || '');
  const { addToast } = useToast();
  const [comments, setComments] = useState<MomentComment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reactionTarget, setReactionTarget] = useState<MomentComment | null>(null);
  const [reactingCommentId, setReactingCommentId] = useState<string | null>(null);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [replyTo, setReplyTo] = useState<MomentComment | null>(null);

  useEffect(() => {
    let mounted = true;

    setComments([]);
    setIsLoading(true);
    setReplyTo(null);
    setContent('');
    setReactionTarget(null);

    const fetchComments = async () => {
      try {
        const data = await momentService.getMomentComments(momentId);
        if (mounted) {
          setComments(data);
        }
      } catch (error) {
        console.error('Failed to load moment comments', error);
        if (mounted) {
          addToast('Không thể tải bình luận', 'error');
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    void fetchComments();

    return () => {
      mounted = false;
    };
  }, [addToast, momentId]);

  const handleSubmit = async (event?: React.FormEvent<HTMLFormElement>) => {
    event?.preventDefault();

    if (!content.trim() || isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    try {
      const newComment = await momentService.replyToComment(
        momentId,
        content.trim(),
        replyTo?.commentId || null,
      );

      setComments((prev) => [...prev, newComment]);
      setContent('');
      setReplyTo(null);
      onCountChange?.(1);
    } catch (error) {
      console.error('Failed to submit moment comment', error);
      addToast('Không thể gửi bình luận', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit();
    }
  };

  const handleCommentReaction = async (
    comment: MomentComment,
    reactionKey: string,
  ) => {
    try {
      setReactingCommentId(comment.commentId);
      const updated = await momentService.reactToComment(
        momentId,
        comment.commentId,
        reactionKey,
      );

      setComments((prev) =>
        prev.map((item) =>
          item.commentId === updated.commentId ? updated : item,
        ),
      );
      setReactionTarget(null);
    } catch (error) {
      console.error('Failed to react to comment', error);
      addToast('Không thể thả cảm xúc', 'error');
    } finally {
      setReactingCommentId(null);
    }
  };

  const handleDeleteComment = async (comment: MomentComment) => {
    if (!comment.canDelete || deletingCommentId) {
      return;
    }

    if (!window.confirm('Bình luận này sẽ bị xóa khỏi bài viết.')) {
      return;
    }

    try {
      setDeletingCommentId(comment.commentId);
      await momentService.deleteComment(momentId, comment.commentId);

      setComments((prev) =>
        prev.filter((item) => item.commentId !== comment.commentId),
      );

      if (replyTo?.commentId === comment.commentId) {
        setReplyTo(null);
      }

      onCountChange?.(-1);
      addToast('Đã xóa bình luận', 'success');
    } catch (error) {
      console.error('Failed to delete moment comment', error);
      addToast('Không thể xóa bình luận', 'error');
    } finally {
      setDeletingCommentId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-4 p-4">
        {/* Comments List */}
        <div className="custom-scrollbar flex max-h-[32rem] flex-col gap-4 overflow-y-auto pr-1">
          {comments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-gray-400">
              <MessageCircle className="h-10 w-10 opacity-20" />
              <p className="mt-2 text-sm">Chưa có bình luận nào.</p>
            </div>
          ) : (
            comments.map((comment) => {
              const activeReaction = getReactionOption(comment.currentUserReaction);
              const reactionSummary = summarizeCommentReactions(comment.reactions);
              const isDeleting = deletingCommentId === comment.commentId;
              const isReacting = reactingCommentId === comment.commentId;
              const canDeleteComment = Boolean(
                comment.canDelete ||
                  canManageComments ||
                  String(comment.userId) === currentUserId,
              );

              return (
                <div
                  key={comment.commentId}
                  className={`flex flex-col gap-1 ${
                    comment.replyTo ? 'ml-10' : ''
                  } animate-in fade-in slide-in-from-bottom-2`}
                >
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full ring-1 ring-gray-100 dark:ring-gray-800">
                      {comment.author?.avartarUrl ? (
                        <img
                          src={comment.author.avartarUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-primary-100 text-[10px] font-bold text-primary-600 dark:bg-primary-900/30">
                          {getDisplayName(comment.author?.userName).charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>

                    {/* Content Bubble */}
                    <div className="group relative flex-1 min-w-0">
                      <div className="inline-block max-w-full rounded-2xl bg-white px-3.5 py-2 shadow-sm ring-1 ring-gray-100 dark:bg-dark-300 dark:ring-gray-800">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-bold text-gray-900 dark:text-white">
                            {getDisplayName(comment.author?.userName)}
                          </span>
                        </div>
                        
                        <p className="mt-0.5 whitespace-pre-wrap break-words text-[14px] leading-relaxed text-gray-800 dark:text-gray-200">
                          {comment.content}
                        </p>

                        {/* Reaction Badges on Bubble */}
                        {reactionSummary.length > 0 && (
                          <div className="absolute -bottom-2 -right-2 flex items-center gap-0.5 rounded-full bg-white p-0.5 shadow-sm ring-1 ring-gray-100 dark:bg-dark-300 dark:ring-gray-800">
                            <div className="flex -space-x-1">
                              {reactionSummary.slice(0, 3).map((r) => (
                                <span key={r.emoji} className="text-[10px]">{r.emoji}</span>
                              ))}
                            </div>
                            <span className="px-1 text-[10px] font-medium text-gray-500">
                              {comment.reactions.length}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Comment Actions */}
                      <div className="mt-1 flex items-center gap-4 px-1">
                        <span className="text-[11px] text-gray-500 dark:text-gray-400">
                          {formatDistanceToNow(new Date(comment.createdAt), {
                            addSuffix: true,
                            locale: vi,
                          })}
                        </span>
                        
                        <button
                          type="button"
                          disabled={isReacting}
                          onClick={() => setReactionTarget(comment)}
                          className={`text-[11px] font-bold transition hover:opacity-80 ${
                            activeReaction ? 'text-primary-500' : 'text-gray-500 dark:text-gray-400'
                          }`}
                        >
                          {activeReaction?.label || 'Thích'}
                        </button>

                        <button
                          type="button"
                          onClick={() => setReplyTo(comment)}
                          className="flex items-center gap-1 text-[11px] font-bold text-gray-500 transition hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        >
                          Trả lời
                        </button>

                        {canDeleteComment && (
                          <button
                            type="button"
                            disabled={isDeleting}
                            onClick={() => void handleDeleteComment(comment)}
                            className="text-[11px] font-bold text-gray-400 transition hover:text-rose-500"
                          >
                            Xóa
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Input Section */}
        <div className="mt-2 border-t border-gray-100 pt-4 dark:border-gray-800">
          {replyTo && (
            <div className="mb-3 flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2 text-xs dark:bg-dark-300">
              <div className="flex items-center gap-2 truncate text-gray-600 dark:text-gray-400">
                <Reply className="h-3 w-3" />
                <span className="truncate">
                  Đang trả lời <span className="font-bold">{getDisplayName(replyTo.author?.userName)}</span>: {replyTo.content}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setReplyTo(null)}
                className="ml-2 rounded-full p-1 text-gray-400 hover:bg-gray-200 dark:hover:bg-dark-400"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex items-end gap-2">
            <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full ring-1 ring-gray-100 dark:ring-gray-800">
              {user?.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-primary-100 text-[10px] font-bold text-primary-600 dark:bg-primary-900/30">
                  {user?.fullName?.charAt(0).toUpperCase() || 'U'}
                </div>
              )}
            </div>

            <div className="relative flex-1">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  replyTo
                    ? `Trả lời ${getDisplayName(replyTo.author?.userName)}...`
                    : 'Viết bình luận...'
                }
                rows={1}
                className="max-h-32 min-h-[40px] w-full resize-none rounded-2xl border-none bg-gray-100 py-2.5 pl-4 pr-20 text-[14px] text-gray-900 focus:bg-white focus:ring-2 focus:ring-primary-500/20 dark:bg-dark-300 dark:text-white dark:focus:bg-dark-200"
                style={{ height: 'auto' }}
              />
              <div className="absolute bottom-1 right-1 flex items-center gap-1 p-1">
                <button
                  type="button"
                  className="rounded-full p-1.5 text-gray-400 transition hover:bg-gray-200 hover:text-gray-600 dark:hover:bg-dark-400"
                >
                  <Smile className="h-5 w-5" />
                </button>
                <button
                  type="submit"
                  disabled={!content.trim() || isSubmitting}
                  className={`rounded-full p-1.5 transition ${
                    content.trim() && !isSubmitting
                      ? 'bg-primary-500 text-white shadow-sm'
                      : 'text-gray-300'
                  }`}
                >
                  {isSubmitting ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Send className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      <MomentReactionPicker
        open={Boolean(reactionTarget)}
        title="Thả cảm xúc"
        description="Chọn 1 biểu tượng để react cho bình luận này."
        activeReactionKey={reactionTarget?.currentUserReaction}
        isSubmitting={Boolean(reactingCommentId)}
        onClose={() => setReactionTarget(null)}
        onSelect={(reactionKey) =>
          reactionTarget && void handleCommentReaction(reactionTarget, reactionKey)
        }
        onRemove={
          reactionTarget?.currentUserReaction
            ? () =>
                reactionTarget &&
                void handleCommentReaction(
                  reactionTarget,
                  reactionTarget.currentUserReaction as string,
                )
            : undefined
        }
      />
    </>
  );
}
