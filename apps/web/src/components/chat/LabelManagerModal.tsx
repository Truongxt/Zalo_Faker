import { useState } from 'react';
import { useChatStore, Label } from '@/stores/chatStore';
import { createLabel, updateLabel, deleteLabel } from '@/services/api';
import { X, Plus, Edit2, Trash2, Check } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

const PRESET_COLORS = [
    '#0068ff', '#f3a222', '#ea4335', '#26b865', '#9051cc', '#813a41', '#e8def7', '#1A1A1A'
];

export default function LabelManagerModal({ isOpen, onClose }: Props) {
    const { labels, addLabel, updateLabel: updateLabelStore, removeLabel } = useChatStore();
    const { addToast } = useToast();

    const [isCreating, setIsCreating] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [name, setName] = useState('');
    const [color, setColor] = useState(PRESET_COLORS[0]);

    if (!isOpen) return null;

    const handleSave = async () => {
        if (!name.trim()) return addToast('Tên phân loại không được để trống', 'error');

        try {
            if (editingId) {
                await updateLabel(editingId, { name, color });
                updateLabelStore(editingId, { name, color });
                addToast('Đã cập nhật phân loại', 'success');
            } else {
                const res = await createLabel({ name, color });
                addLabel(res);
                addToast('Đã tạo phân loại mới', 'success');
            }
            resetForm();
        } catch (err) {
            addToast('Có lỗi xảy ra', 'error');
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Bạn có chắc xoá phân loại này không?')) return;
        try {
            await deleteLabel(id);
            removeLabel(id);
            addToast('Đã xoá phân loại', 'success');
        } catch (err) {
            addToast('Không thể xoá phân loại', 'error');
        }
    };

    const resetForm = () => {
        setIsCreating(false);
        setEditingId(null);
        setName('');
        setColor(PRESET_COLORS[0]);
    };

    const startEdit = (lbl: Label) => {
        setEditingId(lbl._id);
        setName(lbl.name);
        setColor(lbl.color);
        setIsCreating(true);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white dark:bg-dark-200 w-full max-w-md rounded-2xl shadow-xl overflow-hidden">
                <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                        Quản lý phân loại trò chuyện
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-dark-300 rounded-full">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
                    {/* Danh sách nhãn */}
                    {!isCreating && (
                        <div className="space-y-2">
                            {labels.map(lbl => (
                                <div key={lbl._id} className="flex flex-row justify-between items-center p-3 rounded-lg border border-gray-100 dark:border-gray-800">
                                    <div className="flex items-center gap-3">
                                        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: lbl.color }}></div>
                                        <span className="font-medium">{lbl.name}</span>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => startEdit(lbl)} className="p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-dark-300 rounded-md">
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => handleDelete(lbl._id)} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {labels.length === 0 && (
                                <div className="text-center text-gray-500 py-4">Chưa có phân loại nào</div>
                            )}
                            <button
                                onClick={() => setIsCreating(true)}
                                className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-colors"
                            >
                                <Plus className="w-5 h-5" /> Thêm phân loại
                            </button>
                        </div>
                    )}

                    {/* Form tạo/sửa nhãn */}
                    {isCreating && (
                        <div className="space-y-4 pb-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Tên phân loại</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    maxLength={30}
                                    placeholder="Ví dụ: Công việc, Gia đình..."
                                    className="w-full px-4 py-2 bg-gray-50 dark:bg-dark-300 border border-gray-200 dark:border-gray-700 rounded-lg"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2">Chọn màu</label>
                                <div className="flex flex-wrap gap-2">
                                    {PRESET_COLORS.map(c => (
                                        <button
                                            key={c}
                                            onClick={() => setColor(c)}
                                            className="w-8 h-8 rounded-full flex items-center justify-center transition-transform hover:scale-110"
                                            style={{ backgroundColor: c }}
                                        >
                                            {color === c && <Check className="w-4 h-4 text-white" />}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="flex gap-2 pt-2">
                                <button onClick={resetForm} className="flex-1 py-2 bg-gray-100 dark:bg-dark-300 rounded-lg">Hủy</button>
                                <button onClick={handleSave} className="flex-1 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600">
                                    Lưu lại
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
