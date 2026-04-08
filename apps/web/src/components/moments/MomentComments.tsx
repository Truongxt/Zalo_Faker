import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Loader2, Send, Trash2 } from 'lucide-react';
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

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

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
      <div className="flex justify-center p-4">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-4 p-4">
        <div className="custom-scrollbar flex max-h-[28rem] flex-col gap-3 overflow-y-auto pr-2">
          {comments.length === 0 ? (
            <div className="rounded-3xl bg-white px-6 py-10 text-center shadow-sm dark:bg-dark-200">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Chưa có bình luận nào.
              </p>
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
                  className={`rounded-[1.25rem] bg-white px-4 py-3 shadow-sm dark:bg-dark-200 ${
                    comment.replyTo ? 'ml-6 border border-primary-100 dark:border-primary-900/40' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-primary-100 dark:bg-primary-900/30">
                      {comment.author?.avartarUrl ? (
                        <img
                          src={comment.author.avartarUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-sm font-medium text-primary-600">
                          {getDisplayName(comment.author?.userName).charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <h5 className="truncate text-sm font-bold text-gray-900 dark:text-white">
                            {getDisplayName(comment.author?.userName)}
                          </h5>
                          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                            {formatDistanceToNow(new Date(comment.createdAt), {
                              addSuffix: true,
                              locale: vi,
                            })}
                          </p>
                        </div>

                        {canDeleteComment ? (
                          <button
                            type="button"
                            disabled={isDeleting}
                            onClick={() => void handleDeleteComment(comment)}
                            className="rounded-full bg-rose-50 p-2 text-rose-600 transition hover:bg-rose-100 disabled:opacity-60"
                            title="Xóa bình luận"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        ) : null}
                      </div>

                      {comment.replyTo ? (
                        <div className="mt-3 rounded-2xl border border-primary-100 bg-primary-50/60 px-3 py-2 dark:border-primary-900/40 dark:bg-primary-900/10">
                          <div className="text-xs font-semibold text-primary-600 dark:text-primary-300">
                            Trả lời {getDisplayName(comment.replyTo.author?.userName)}
                          </div>
                          <div className="mt-1 line-clamp-2 text-sm text-gray-600 dark:text-gray-300">
                            {comment.replyTo.content}
                          </div>
                        </div>
                      ) : null}

                      <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-gray-700 dark:text-gray-200">
                        {comment.content}
                      </p>

                      {reactionSummary.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {reactionSummary.map((reaction) => (
                            <div
                              key={`${comment.commentId}-${reaction.emoji}`}
                              className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 dark:bg-dark-300 dark:text-gray-200"
                            >
                              {reaction.emoji} {reaction.count}
                            </div>
                          ))}
                        </div>
                      ) : null}

                      <div className="mt-3 flex items-center gap-4 text-xs font-semibold">
                        <button
                          type="button"
                          disabled={isReacting}
                          onClick={() => setReactionTarget(comment)}
                          className={`transition hover:text-primary-600 ${
                            activeReaction
                              ? 'text-primary-600 dark:text-primary-300'
                              : 'text-gray-500 dark:text-gray-400'
                          } disabled:opacity-60`}
                        >
                          {activeReaction?.icon || '♡'} {activeReaction?.label || 'Cảm xúc'}
                        </button>

                        <button
                          type="button"
                          onClick={() => setReplyTo(comment)}
                          className="text-gray-500 transition hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        >
                          Trả lời
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div>
          {replyTo ? (
            <div className="mb-3 rounded-[1.25rem] border border-primary-100 bg-primary-50/60 px-3 py-3 text-sm dark:border-primary-900/40 dark:bg-primary-900/10">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-primary-600 dark:text-primary-300">
                    Đang trả lời {getDisplayName(replyTo.author?.userName)}
                  </div>
                  <div className="mt-1 line-clamp-2 text-gray-600 dark:text-gray-300">
                    {replyTo.content}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setReplyTo(null)}
                  className="text-lg leading-none text-gray-500 transition hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  &times;
                </button>
              </div>
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="flex gap-2">
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt=""
                className="h-9 w-9 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/30">
                <span className="text-xs font-medium text-primary-600">
                  {user?.fullName?.charAt(0).toUpperCase() || 'U'}
                </span>
              </div>
            )}

            <div className="relative flex-1">
              <textarea
                value={content}
                onChange={(event) => setContent(event.target.value)}
                placeholder={
                  replyTo
                    ? `Trả lời ${getDisplayName(replyTo.author?.userName)}...`
                    : 'Viết bình luận...'
                }
                rows={1}
                className="max-h-28 min-h-[44px] w-full resize-y rounded-[1.5rem] border border-gray-200 bg-white py-2.5 pl-4 pr-12 text-sm text-gray-900 outline-none transition focus:border-primary-500 dark:border-gray-700 dark:bg-dark-200 dark:text-white"
              />
              <button
                type="submit"
                disabled={!content.trim() || isSubmitting}
                className="absolute bottom-2 right-2 rounded-full bg-primary-500 p-2 text-white transition hover:bg-primary-600 disabled:cursor-not-allowed disabled:bg-primary-300"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      <MomentReactionPicker
        open={Boolean(reactionTarget)}
        title="Thả cảm xúc"
        description="Chọn 1 biểu tượng để react nhanh cho bình luận này."
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
