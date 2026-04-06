import { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { MoreHorizontal, Heart, MessageCircle, Share2, Trash2 } from 'lucide-react';
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

export default function MomentCard({ moment, onReact, onDelete, onShare }: MomentCardProps) {
  const { user } = useAuthStore();
  const [showReactions, setShowReactions] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const activeReaction = REACTION_OPTIONS.find(r => r.key === moment.currentUserReaction);

  return (
    <div className="bg-white dark:bg-dark-200 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 mb-4 overflow-hidden">
      {/* Header */}
      <div className="p-4 flex justify-between items-start">
        <div className="flex gap-3">
          {moment.author?.avartarUrl || moment.isOwner && user?.avatarUrl ? (
            <img 
              src={(moment.isOwner ? user?.avatarUrl : moment.author?.avartarUrl) || ''} 
              alt={moment.author?.userName || 'User'} 
              className="w-10 h-10 rounded-full object-cover shrink-0" 
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center shrink-0">
              <span className="text-sm font-medium text-primary-600 dark:text-primary-400">
                {(moment.author?.userName || user?.fullName || 'U').charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white text-sm">
              {moment.author?.userName || (moment.isOwner ? user?.fullName : 'Người dùng')}
            </h4>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {formatDistanceToNow(new Date(moment.createdAt), { addSuffix: true, locale: vi })}
            </span>
          </div>
        </div>

        {moment.isOwner && (
          <div className="relative">
            <button 
              onClick={() => setShowMenu(!showMenu)} 
              className="p-1 hover:bg-gray-100 dark:hover:bg-dark-300 rounded-full text-gray-500 transition-colors"
            >
              <MoreHorizontal className="w-5 h-5" />
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 mt-1 w-36 bg-white dark:bg-dark-300 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-20 py-1">
                  <button
                    onClick={() => { setShowMenu(false); onDelete(moment.momentId); }}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 dark:hover:bg-dark-400 flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Xoá bài viết
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="px-4 pb-2">
        {moment.content ? (
          <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">
            {moment.content}
          </p>
        ) : null}
      </div>

      {/* Media */}
      {moment.mediaUrls.length > 0 && (
        <div className={`mt-2 ${moment.mediaUrls.length > 1 ? 'grid grid-cols-2 gap-1' : ''}`}>
          {moment.mediaUrls.map((url, idx) => (
            <img 
              key={idx} 
              src={url} 
              alt="Moment media" 
              className={`w-full object-cover bg-gray-100 dark:bg-dark-300 ${moment.mediaUrls.length === 1 ? 'max-h-[500px]' : 'h-48'}`}
            />
          ))}
        </div>
      )}

      {/* Shared Original Moment */}
      {moment.type === 'share' && moment.originalMomentSnapshot && (
        <div className="m-4 p-4 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-dark-300">
           <div className="flex items-center gap-2 mb-2">
             <span className="text-xs font-semibold text-primary-500">
               Chia sẻ bài viết từ {moment.originalMomentSnapshot.author?.userName || 'người dùng'}
             </span>
           </div>
           {moment.originalMomentSnapshot.content && (
             <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
               {moment.originalMomentSnapshot.content}
             </p>
           )}
           {moment.originalMomentSnapshot.mediaUrls?.[0] && (
             <img src={moment.originalMomentSnapshot.mediaUrls[0]} alt="" className="w-full rounded-lg max-h-64 object-cover" />
           )}
        </div>
      )}

      {/* Stats */}
      <div className="px-4 py-3 flex justify-between items-center text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800">
        <div className="flex gap-1 items-center">
          {moment.reactionCount > 0 && (
             <>
               <span className="bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-full w-4 h-4 flex items-center justify-center text-[10px]">❤️</span>
               <span>{moment.reactionCount}</span>
             </>
          )}
        </div>
        <div className="flex gap-3">
          {moment.commentCount > 0 && <span>{moment.commentCount} bình luận</span>}
          {moment.shareCount > 0 && <span>{moment.shareCount} lượt chia sẻ</span>}
        </div>
      </div>

      {/* Actions */}
      <div className="px-2 py-1 flex justify-between relative">
        {/* Actions row */}
        <div 
          className="flex-1 relative" 
          onMouseEnter={() => setShowReactions(true)} 
          onMouseLeave={() => setShowReactions(false)}
        >
           {showReactions && (
             <div className="absolute bottom-full left-0 mb-2 bg-white dark:bg-dark-300 rounded-full shadow-lg border border-gray-100 dark:border-gray-700 p-1 flex gap-1 z-10 animate-fade-in">
               {REACTION_OPTIONS.map(reaction => (
                 <button
                   key={reaction.key}
                   onClick={() => { setShowReactions(false); onReact(moment.momentId, reaction.key); }}
                   className="text-2xl hover:scale-125 transition-transform"
                   title={reaction.key}
                 >
                   {reaction.icon}
                 </button>
               ))}
             </div>
           )}
           <button 
             onClick={() => onReact(moment.momentId, activeReaction ? 'like' : 'like')} // Toggle if needed, actually just calls react
             className={`w-full py-2 flex gap-2 items-center justify-center rounded-lg hover:bg-gray-50 dark:hover:bg-dark-300 transition-colors text-sm font-medium ${
                 activeReaction ? 'text-primary-500' : 'text-gray-600 dark:text-gray-400'
             }`}
           >
             {activeReaction ? <span className="text-base">{activeReaction.icon}</span> : <Heart className="w-5 h-5" />}
             Thích
           </button>
        </div>

        <button 
          onClick={() => setShowComments(!showComments)}
          className="flex-1 py-2 flex gap-2 items-center justify-center rounded-lg hover:bg-gray-50 dark:hover:bg-dark-300 transition-colors text-sm font-medium text-gray-600 dark:text-gray-400"
        >
          <MessageCircle className="w-5 h-5" />
          Bình luận
        </button>
        
        <button 
          onClick={() => onShare(moment.momentId)}
          className="flex-1 py-2 flex gap-2 items-center justify-center rounded-lg hover:bg-gray-50 dark:hover:bg-dark-300 transition-colors text-sm font-medium text-gray-600 dark:text-gray-400"
        >
          <Share2 className="w-5 h-5" />
          Chia sẻ
        </button>
      </div>

      {/* Inline Comments */}
      {showComments && (
        <div className="border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-dark-100/30">
          <MomentComments momentId={moment.momentId} />
        </div>
      )}
    </div>
  );
}
