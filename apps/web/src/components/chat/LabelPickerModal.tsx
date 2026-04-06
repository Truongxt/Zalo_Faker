import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useChatStore, Conversation } from '@/stores/chatStore';
import { updateParticipantSetting } from '@/services/api';
import { X, Check } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';

interface Props {
    conversation: Conversation;
    isOpen: boolean;
    onClose: () => void;
}

export default function LabelPickerModal({ conversation, isOpen, onClose }: Props) {
    const { user } = useAuthStore();
    const { labels, updateConversation } = useChatStore();
    const { addToast } = useToast();

    const currentP = conversation.participants.find(p => p.userId === user?.id);
    const [selectedIds, setSelectedIds] = useState<string[]>(currentP?.labelIds || []);

    // Cập nhật selectedIds khi mở modal hoặc thay đổi conversation
    useEffect(() => {
        setSelectedIds(currentP?.labelIds || []);
    }, [conversation.id, isOpen, currentP?.labelIds]);

    if (!isOpen) return null;

    const toggleLabel = (id: string) => {
        setSelectedIds(prev => 
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const handleSave = async () => {
        if (!user) return;
        try {
            await updateParticipantSetting(conversation.id, user.id, { labelIds: selectedIds });
            
            // Update local state
            updateConversation(conversation.id, {
                participants: conversation.participants.map(p => 
                    p.userId === user.id ? { ...p, labelIds: selectedIds } : p
                )
            });
            
            addToast('Đã cập nhật nhãn', 'success');
            onClose();
        } catch (err) {
            addToast('Lỗi khi cập nhật nhãn', 'error');
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white dark:bg-dark-200 w-full max-w-sm rounded-2xl shadow-xl overflow-hidden">
                <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                        Gán nhãn phân loại
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-dark-300 rounded-full">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-4 space-y-2 max-h-[50vh] overflow-y-auto">
                    {labels.length === 0 ? (
                        <p className="text-gray-500 text-center py-4">Bạn chưa tạo thẻ phân loại nào.</p>
                    ) : (
                        labels.map(lbl => {
                            const isSelected = selectedIds.includes(lbl._id);
                            return (
                                <button
                                    key={lbl._id}
                                    onClick={() => toggleLabel(lbl._id)}
                                    className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors ${
                                        isSelected ? 'bg-gray-50 dark:bg-dark-300 border-primary-500' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-dark-300'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: lbl.color }}></div>
                                        <span className="font-medium">{lbl.name}</span>
                                    </div>
                                    {isSelected && <Check className="w-5 h-5 text-primary-500" />}
                                </button>
                            );
                        })
                    )}
                </div>
                <div className="p-4 border-t border-gray-200 dark:border-gray-800">
                    <button 
                        onClick={handleSave}
                        className="w-full py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 font-medium"
                    >
                        Xong
                    </button>
                </div>
            </div>
        </div>
    );
}
