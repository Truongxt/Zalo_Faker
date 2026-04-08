import { X } from 'lucide-react';
import { REACTION_OPTIONS, getReactionOption } from './momentHelpers';

interface MomentReactionPickerProps {
  open: boolean;
  title: string;
  description: string;
  activeReactionKey?: string | null;
  isSubmitting?: boolean;
  onClose: () => void;
  onSelect: (reactionKey: string) => void;
  onRemove?: () => void;
}

export default function MomentReactionPicker({
  open,
  title,
  description,
  activeReactionKey,
  isSubmitting = false,
  onClose,
  onSelect,
  onRemove,
}: MomentReactionPickerProps) {
  if (!open) {
    return null;
  }

  const activeReaction = getReactionOption(activeReactionKey);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/35 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-[2rem] bg-white px-5 pb-6 pt-4 shadow-2xl dark:bg-dark-200"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="w-10" />
          <div className="h-1.5 w-12 rounded-full bg-gray-200 dark:bg-gray-700 sm:hidden" />
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-gray-500 transition hover:bg-gray-100 dark:hover:bg-dark-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <h3 className="text-center text-lg font-bold text-gray-900 dark:text-white">
          {title}
        </h3>
        <p className="mt-2 text-center text-sm leading-6 text-gray-500 dark:text-gray-400">
          {description}
        </p>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {REACTION_OPTIONS.map((option) => {
            const isActive = activeReactionKey === option.key;

            return (
              <button
                key={option.key}
                type="button"
                disabled={isSubmitting}
                onClick={() => onSelect(option.key)}
                className={`rounded-[1.5rem] px-3 py-4 transition ${
                  isActive
                    ? 'border-[1.5px] border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : 'border border-gray-200 bg-gray-50 hover:bg-gray-100 dark:border-gray-700 dark:bg-dark-300 dark:hover:bg-dark-400'
                }`}
              >
                <div className="text-[1.875rem]">{option.icon}</div>
                <div
                  className={`mt-2 text-sm font-semibold ${
                    isActive
                      ? 'text-primary-600 dark:text-primary-300'
                      : 'text-gray-700 dark:text-gray-200'
                  }`}
                >
                  {option.label}
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          {activeReaction && onRemove ? (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onRemove}
              className="flex-1 rounded-full bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600 transition hover:bg-rose-100 disabled:opacity-60"
            >
              Bỏ cảm xúc
            </button>
          ) : null}

          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className={`rounded-full bg-gray-100 px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-200 dark:bg-dark-300 dark:text-gray-200 dark:hover:bg-dark-400 ${
              activeReaction && onRemove ? 'flex-1' : 'w-full'
            }`}
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
