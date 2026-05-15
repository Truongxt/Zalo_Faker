import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface PromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message?: string;
  placeholder?: string;
  initialValue?: string;
  onConfirm: (value: string) => void;
  confirmText?: string;
  cancelText?: string;
  type?: string;
}

export default function PromptModal({
  isOpen,
  onClose,
  title,
  message,
  placeholder,
  initialValue = '',
  onConfirm,
  confirmText = 'Xác nhận',
  cancelText = 'Hủy',
  type = 'text',
}: PromptModalProps) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setValue(initialValue);
      // Short delay to ensure the modal is rendered before focusing
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, initialValue]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm(value);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-all duration-300">
      <div 
        className="bg-white dark:bg-dark-200 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col transform transition-all duration-300 animate-in fade-in zoom-in slide-in-from-bottom-4"
        onKeyDown={(e) => {
            if (e.key === 'Escape') onClose();
        }}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">{title}</h2>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors group"
          >
            <X className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-200" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 flex flex-col gap-4">
          {message && (
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              {message}
            </p>
          )}
          <div className="relative">
            <input
              ref={inputRef}
              type={type}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={placeholder}
              className="w-full px-4 py-3 bg-gray-50 dark:bg-dark-300 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all shadow-inner"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleConfirm();
              }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 bg-gray-50 dark:bg-dark-300/50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-xl transition-all"
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            className="px-6 py-2.5 text-sm font-semibold text-white bg-primary-500 hover:bg-primary-600 active:scale-95 shadow-lg shadow-primary-500/20 rounded-xl transition-all"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
