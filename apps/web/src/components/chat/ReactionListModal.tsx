import React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { MessageReaction } from '@/types';

interface ReactionListModalProps {
  isOpen: boolean;
  onClose: () => void;
  reactions: MessageReaction[];
}

export const ReactionListModal: React.FC<ReactionListModalProps> = ({ isOpen, onClose, reactions }) => {
  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-white rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="text-lg font-semibold text-gray-900">
            Biểu cảm ({reactions.length})
          </h3>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {reactions.length > 0 ? (
            <div className="divide-y">
              {reactions.map((reaction, index) => (
                <div key={`${reaction.userId}-${index}`} className="flex items-center px-4 py-3 hover:bg-gray-50">
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-lg font-semibold text-blue-600 overflow-hidden border border-gray-100">
                      {reaction.userName?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="absolute -right-1 -bottom-1 bg-white rounded-full p-0.5 shadow-sm text-xs leading-none border">
                      {reaction.emoji}
                    </div>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-900">{reaction.userName || 'Người dùng'}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-10 text-center">
              <p className="text-gray-500 text-sm">Chưa có biểu cảm nào</p>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};
