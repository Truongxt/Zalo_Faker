import { useMemo, useState } from "react";
import { X } from "lucide-react";

type PollComposerValues = {
  question: string;
  options: string[];
  pinToConversation: boolean;
  anonymousVoters: boolean;
  hideResultsUntilVote: boolean;
  allowMultipleChoices: boolean;
  allowAddOptions: boolean;
  expiresAt: string | null;
};

type PollComposerModalProps = {
  open: boolean;
  conversationName?: string;
  canPinInConversation: boolean;
  onClose: () => void;
  onSubmit: (values: PollComposerValues) => Promise<void>;
};

const toLocalDateTimeValue = (value: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60000);
  return localDate.toISOString().slice(0, 16);
};

export default function PollComposerModal({
  open,
  conversationName,
  canPinInConversation,
  onClose,
  onSubmit,
}: PollComposerModalProps) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [pinToConversation, setPinToConversation] = useState(false);
  const [anonymousVoters, setAnonymousVoters] = useState(false);
  const [hideResultsUntilVote, setHideResultsUntilVote] = useState(false);
  const [allowMultipleChoices, setAllowMultipleChoices] = useState(true);
  const [allowAddOptions, setAllowAddOptions] = useState(true);
  const [expiresAtInput, setExpiresAtInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const normalizedOptions = useMemo(
    () => Array.from(new Set(options.map((option) => option.trim()).filter(Boolean))),
    [options],
  );

  const canSubmit =
    question.trim().length > 0 && normalizedOptions.length >= 2 && !isSubmitting;

  if (!open) return null;

  const updateOption = (index: number, value: string) => {
    setOptions((prev) => prev.map((option, optionIndex) => (optionIndex === index ? value : option)));
  };

  const removeOption = (index: number) => {
    setOptions((prev) => (prev.length <= 2 ? prev : prev.filter((_, optionIndex) => optionIndex !== index)));
  };

  const resetAndClose = (force = false) => {
    if (isSubmitting && !force) return;
    setQuestion("");
    setOptions(["", ""]);
    setPinToConversation(false);
    setAnonymousVoters(false);
    setHideResultsUntilVote(false);
    setAllowMultipleChoices(true);
    setAllowAddOptions(true);
    setExpiresAtInput("");
    onClose();
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    try {
      const expiresAt = expiresAtInput ? new Date(expiresAtInput).toISOString() : null;
      await onSubmit({
        question: question.trim(),
        options: normalizedOptions,
        pinToConversation: canPinInConversation ? pinToConversation : false,
        anonymousVoters,
        hideResultsUntilVote,
        allowMultipleChoices,
        allowAddOptions,
        expiresAt,
      });
      resetAndClose(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/50 px-4">
      <div className="w-full max-w-2xl overflow-hidden rounded-[28px] bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <p className="text-xl font-bold text-slate-900">Tạo bình chọn mới</p>
            <p className="mt-1 text-sm text-slate-500">{conversationName || "Nhóm chat"}</p>
          </div>
          <button
            type="button"
            onClick={() => resetAndClose()}
            className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[78vh] overflow-y-auto px-6 py-5">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <label className="flex items-center justify-between gap-4">
              <span className="text-sm font-semibold text-slate-800">Ghim lên đầu trò chuyện</span>
              <input
                type="checkbox"
                checked={pinToConversation}
                onChange={(event) => setPinToConversation(event.target.checked)}
                disabled={!canPinInConversation}
                className="h-5 w-5"
              />
            </label>
            {!canPinInConversation && (
              <p className="mt-2 text-xs text-slate-500">
                Bạn vẫn có thể tạo bình chọn nhưng không thể ghim bình chọn này.
              </p>
            )}
          </div>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-white px-5 py-5">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary-500">
              Đặt câu hỏi bình chọn
            </p>
            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Nhập câu hỏi"
              className="mt-4 min-h-[100px] w-full resize-none border-b border-slate-200 pb-4 text-[28px] leading-9 text-slate-900 outline-none placeholder:text-slate-400"
            />

            <div className="mt-5 space-y-4">
              {options.map((option, index) => (
                <div
                  key={`poll-option-${index}`}
                  className="flex items-center gap-3 border-b border-slate-200 pb-3"
                >
                  <input
                    value={option}
                    onChange={(event) => updateOption(index, event.target.value)}
                    placeholder={`Phương án ${index + 1}`}
                    className="w-full bg-transparent text-lg text-slate-900 outline-none placeholder:text-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => removeOption(index)}
                    disabled={options.length <= 2}
                    className="rounded-full p-1 text-slate-400 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setOptions((prev) => [...prev, ""])}
              className="mt-4 text-lg font-medium text-primary-500 hover:text-primary-600"
            >
              Thêm phương án
            </button>
          </div>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-white px-5 py-5">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary-500">
              Tùy chọn
            </p>

            <div className="mt-4 border-b border-slate-200 pb-4">
              <label className="block">
                <span className="text-base font-semibold text-slate-900">Đặt thời hạn</span>
                <input
                  type="datetime-local"
                  min={toLocalDateTimeValue(new Date().toISOString())}
                  value={expiresAtInput}
                  onChange={(event) => setExpiresAtInput(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-primary-400"
                />
              </label>
              {expiresAtInput && (
                <button
                  type="button"
                  onClick={() => setExpiresAtInput("")}
                  className="mt-2 text-sm font-semibold text-primary-500 hover:text-primary-600"
                >
                  Xóa thời hạn
                </button>
              )}
            </div>

            {[
              {
                label: "Ẩn người bình chọn",
                value: anonymousVoters,
                onChange: setAnonymousVoters,
              },
              {
                label: "Ẩn kết quả khi chưa bình chọn",
                value: hideResultsUntilVote,
                onChange: setHideResultsUntilVote,
              },
              {
                label: "Chọn nhiều phương án",
                value: allowMultipleChoices,
                onChange: setAllowMultipleChoices,
              },
              {
                label: "Có thể thêm phương án",
                value: allowAddOptions,
                onChange: setAllowAddOptions,
              },
            ].map((item) => (
              <label
                key={item.label}
                className="flex items-center justify-between gap-4 border-b border-slate-200 py-4 last:border-b-0"
              >
                <span className="text-base text-slate-900">{item.label}</span>
                <input
                  type="checkbox"
                  checked={item.value}
                  onChange={(event) => item.onChange(event.target.checked)}
                  className="h-5 w-5"
                />
              </label>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            onClick={() => resetAndClose()}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={`rounded-xl px-4 py-2 text-sm font-semibold text-white ${canSubmit ? "bg-primary-500 hover:bg-primary-600" : "cursor-not-allowed bg-sky-300"
              }`}
          >
            {isSubmitting ? "Đang tạo..." : "Tạo bình chọn"}
          </button>
        </div>
      </div>
    </div>
  );
}
