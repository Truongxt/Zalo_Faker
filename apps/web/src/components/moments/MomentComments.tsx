import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { momentService } from '@/services/momentService';
import { MomentComment } from '@/types/moment';
import { Send, Loader2, Heart } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';

interface MomentCommentsProps {
  momentId: string;
}

export default function MomentComments({ momentId }: MomentCommentsProps) {
  const { user } = useAuthStore();
  const [comments, setComments] = useState<MomentComment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [content, setContent] = useState('');
  const [replyTo, setReplyTo] = useState<MomentComment | null>(null);

  useEffect(() => {
    let mounted = true;
    const fetchComments = async () => {
      try {
        const data = await momentService.getMomentComments(momentId);
        if (mounted) setComments(data);
      } catch (error) {
        console.error('Lỗi tải comment', error);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };
    fetchComments();
    return () => { mounted = false; };
  }, [momentId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const newComment = await momentService.replyToComment(momentId, content.trim(), replyTo?.commentId || null);
      setComments(prev => [...prev, newComment]);
      setContent('');
      setReplyTo(null);
    } catch (error) {
      console.error('Lỗi gửi comment', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReact = async (commentId: string) => {
    try {
      const updated = await momentService.reactToComment(momentId, commentId, 'like');
      setComments(prev => prev.map(c => c.commentId === commentId ? updated : c));
    } catch (error) {
      console.error('Lỗi react', error);
    }
  };

  if (isLoading) {
    return <div className="p-4 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>;
  }

  return (
    <div className="p-4 flex flex-col gap-4">
      {/* List */}
      <div className="flex flex-col gap-3 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
        {comments.length === 0 ? (
          <p className="text-sm text-center text-gray-500 py-4">Chưa có bình luận nào. Hãy là người đầu tiên!</p>
        ) : (
          comments.map(c => (
            <div key={c.commentId} className="flex gap-2">
              <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 shrink-0 overflow-hidden">
                {c.author?.avartarUrl ? (
                   <img src={c.author.avartarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                   <span className="flex items-center justify-center w-full h-full text-primary-600 font-medium text-sm">
                     {c.author?.userName?.charAt(0).toUpperCase() || 'U'}
                   </span>
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="bg-white dark:bg-dark-300 rounded-2xl p-2 px-3 inline-block shadow-sm">
                  <h5 className="font-semibold text-xs text-gray-900 dark:text-white">
                    {c.author?.userName || 'Người dùng'}
                  </h5>
                  
                  {c.replyTo && (
                    <div className="flex items-center gap-1 text-[10px] text-gray-500 my-0.5">
                       <span>Trả lời </span>
                       <span className="font-medium text-primary-500">@{c.replyTo.author?.userName}</span>
                    </div>
                  )}

                  <p className="text-sm text-gray-800 dark:text-gray-200 break-words mt-0.5">
                    {c.content}
                  </p>
                </div>
                
                <div className="flex items-center gap-3 text-[11px] font-medium text-gray-500 mt-1 ml-2">
                  <span>{formatDistanceToNow(new Date(c.createdAt), { addSuffix: true, locale: vi })}</span>
                  <button onClick={() => handleReact(c.commentId)} className={`hover:text-gray-700 dark:hover:text-gray-300 ${c.currentUserReaction ? 'text-primary-500 font-bold' : ''}`}>
                    Thích {c.reactionCount > 0 && `(${c.reactionCount})`}
                  </button>
                  <button onClick={() => setReplyTo(c)} className="hover:text-gray-700 dark:hover:text-gray-300">
                    Phản hồi
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Input */}
      <div>
        {replyTo && (
          <div className="text-xs text-gray-500 mb-2 flex items-center justify-between bg-gray-100 dark:bg-dark-300 p-2 rounded-lg">
            <span>Đang phản hồi <b>{replyTo.author?.userName}</b></span>
            <button onClick={() => setReplyTo(null)} className="hover:text-gray-700 text-lg leading-none">&times;</button>
          </div>
        )}
        <form onSubmit={handleSubmit} className="flex gap-2">
          {user?.avatarUrl ? (
            <img src={user.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
              <span className="text-xs font-medium text-primary-600">{user?.fullName?.charAt(0) || 'U'}</span>
            </div>
          )}
          <div className="flex-1 relative">
             <input
               value={content}
               onChange={e => setContent(e.target.value)}
               placeholder="Viết bình luận..."
               className="w-full bg-white dark:bg-dark-300 rounded-full pl-4 pr-10 py-1.5 text-sm outline-none border border-gray-200 dark:border-gray-700 focus:border-primary-500"
             />
             <button
               type="submit"
               disabled={!content.trim() || isSubmitting}
               className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-primary-500 hover:text-primary-600 disabled:opacity-50"
             >
               {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
             </button>
          </div>
        </form>
      </div>
    </div>
  );
}
