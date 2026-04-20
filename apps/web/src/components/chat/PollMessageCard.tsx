import { useEffect, useMemo, useState } from "react";
import type { PollContent } from "@/stores/chatStore";

type PollParticipant = {
  userId: string;
  fullName?: string;
};

type PollMessageCardProps = {
  messageId: string;
  poll: PollContent;
  currentUserId?: string | null;
  participants?: PollParticipant[];
  isSent: boolean;
  onVote: (messageId: string, optionIds: string[]) => Promise<void>;
  onAddOption: (messageId: string, text: string) => Promise<void>;
  onRemoveOption: (messageId: string, optionId: string) => Promise<void>;
};

const formatDeadline = (value: string | null) => {
  if (!value) return "Không có thời hạn";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Không có thời hạn";
  return date.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

export default function PollMessageCard({
  messageId,
  poll,
  currentUserId,
  participants = [],
  isSent,
  onVote,
  onAddOption,
  onRemoveOption,
}: PollMessageCardProps) {
  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>([]);
  const [newOptionText, setNewOptionText] = useState("");
  const [showAddOption, setShowAddOption] = useState(false);
  const [isSubmittingVote, setIsSubmittingVote] = useState(false);
  const [isSubmittingOption, setIsSubmittingOption] = useState(false);
  const [removingOptionId, setRemovingOptionId] = useState<string | null>(null);

  const currentVote = useMemo(
    () =>
      poll.votes.find((vote) => String(vote.userId) === String(currentUserId || "")) ||
      null,
    [currentUserId, poll.votes],
  );

  useEffect(() => {
    setSelectedOptionIds(currentVote?.optionIds || []);
  }, [currentVote?.optionIds]);

  const isExpired = Boolean(
    poll.settings.expiresAt &&
    new Date(poll.settings.expiresAt).getTime() <= Date.now(),
  );
  const canViewResults =
    !poll.settings.hideResultsUntilVote || Boolean(currentVote) || isExpired;
  const isCreator = String(poll.createdBy || "") === String(currentUserId || "");
  const totalVoters = poll.votes.length;
  const participantNameMap = useMemo(() => {
    const map = new Map<string, string>();
    participants.forEach((participant) => {
      map.set(String(participant.userId), participant.fullName || `User ${participant.userId}`);
    });
    return map;
  }, [participants]);

  const hasSelectionChanged =
    JSON.stringify([...(selectedOptionIds || [])].sort()) !==
    JSON.stringify([...(currentVote?.optionIds || [])].sort());

  const toggleOption = (optionId: string) => {
    if (isExpired) return;
    if (poll.settings.allowMultipleChoices) {
      setSelectedOptionIds((prev) =>
        prev.includes(optionId)
          ? prev.filter((id) => id !== optionId)
          : [...prev, optionId],
      );
      return;
    }
    setSelectedOptionIds([optionId]);
  };

  const handleVote = async () => {
    if (isSubmittingVote || selectedOptionIds.length === 0 || isExpired) return;
    setIsSubmittingVote(true);
    try {
      await onVote(messageId, selectedOptionIds);
    } finally {
      setIsSubmittingVote(false);
    }
  };

  const handleAddOption = async () => {
    const trimmed = newOptionText.trim();
    if (!trimmed || isSubmittingOption || isExpired) return;
    setIsSubmittingOption(true);
    try {
      await onAddOption(messageId, trimmed);
      setNewOptionText("");
      setShowAddOption(false);
    } finally {
      setIsSubmittingOption(false);
    }
  };

  const handleRemoveOption = async (optionId: string) => {
    if (
      isExpired ||
      !isCreator ||
      poll.options.length <= 2 ||
      removingOptionId === optionId
    ) {
      return;
    }
    setRemovingOptionId(optionId);
    try {
      await onRemoveOption(messageId, optionId);
    } finally {
      setRemovingOptionId(null);
    }
  };

  return (
    <div className="min-w-[260px] space-y-3">
      <div>
        <p className="text-[25px] mt-5 font-bold leading-5 whitespace-pre-wrap [overflow-wrap:anywhere] [word-break:break-word]">
          {poll.question}
        </p>
        <p className={`mt-3 text-[12px] ${isSent ? "text-white/75" : "text-slate-500"}`}>
          Hạn bình chọn: {formatDeadline(poll.settings.expiresAt)}
        </p>
      </div>

      <div className="space-y-2">
        {poll.options.map((option) => {
          const voters = poll.votes.filter((vote) => vote.optionIds.includes(option.id));
          const voteCount = voters.length;
          const percent =
            totalVoters > 0 ? Math.round((voteCount / totalVoters) * 100) : 0;
          const isSelected = selectedOptionIds.includes(option.id);
          const voterNames = voters.map(
            (vote) =>
              participantNameMap.get(String(vote.userId)) || `User ${vote.userId}`,
          );

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => toggleOption(option.id)}
              disabled={isExpired}
              className={`w-full rounded-2xl border px-3 py-3 text-left text-slate-900 transition-colors ${isSelected
                ? "border-primary-400 bg-sky-50"
                : "border-slate-200 bg-white"
                } ${isExpired ? "cursor-not-allowed opacity-80" : ""}`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border text-[11px] font-bold ${poll.settings.allowMultipleChoices ? "rounded-md" : "rounded-full"
                    } ${isSelected
                      ? "border-primary-500 bg-primary-500 text-white"
                      : "border-slate-400 text-transparent"
                    }`}
                >
                  {isSelected ? "✓" : "•"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-2">
                    <p className="flex-1 font-semibold text-slate-900 whitespace-pre-wrap [overflow-wrap:anywhere] [word-break:break-word]">
                      {option.text}
                    </p>
                    {isCreator && (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleRemoveOption(option.id);
                        }}
                        disabled={isExpired || poll.options.length <= 2 || removingOptionId === option.id}
                        className={`h-6 w-6 shrink-0 rounded-full text-sm font-bold transition-colors ${
                          isExpired || poll.options.length <= 2 || removingOptionId === option.id
                            ? "cursor-not-allowed bg-slate-100 text-slate-300"
                            : "bg-slate-100 text-slate-500 hover:bg-red-100 hover:text-red-500"
                        }`}
                        title="Xoa phuong an"
                      >
                        ×
                      </button>
                    )}
                  </div>
                  {canViewResults ? (
                    <div className="mt-2 space-y-1.5">
                      <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                        <div
                          className="h-full rounded-full bg-primary-500"
                          style={{ width: `${Math.max(percent, voteCount > 0 ? 8 : 0)}%` }}
                        />
                      </div>
                      <p className="text-[12px] text-slate-600">
                        {voteCount} lựa chọn • {percent}%
                      </p>
                      {!poll.settings.anonymousVoters && voterNames.length > 0 && (
                        <p className="text-[12px] text-slate-600">
                          {voterNames.join(", ")}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="mt-2 text-[12px] text-slate-600">
                      Kết quả sẽ hiển thị sau khi bạn bình chọn.
                    </p>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        <span className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${isSent ? "bg-white/15 text-white/90" : "bg-slate-200 text-slate-600"}`}>
          {poll.settings.allowMultipleChoices ? "Nhiều lựa chọn" : "Một lựa chọn"}
        </span>
        {poll.settings.anonymousVoters && (
          <span className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${isSent ? "bg-white/15 text-white/90" : "bg-slate-200 text-slate-600"}`}>
            Ẩn người bình chọn
          </span>
        )}
      </div>

      {!isExpired && (
        <button
          type="button"
          onClick={handleVote}
          disabled={isSubmittingVote || selectedOptionIds.length === 0 || !hasSelectionChanged}
          className={`w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-black transition-colors ${isSubmittingVote || selectedOptionIds.length === 0 || !hasSelectionChanged
            ? "cursor-not-allowed bg-slate-300"
            : "bg-primary-200 hover:bg-primary-300"
            }`}
        >
          {isSubmittingVote
            ? "Đang cập nhật..."
            : currentVote
              ? "Cập nhật bình chọn"
              : "Gửi bình chọn"}
        </button>
      )}

      {poll.settings.allowAddOptions && !isExpired && (
        <div className="space-y-2">
          {!showAddOption ? (
            <button
              type="button"
              onClick={() => setShowAddOption(true)}
              className="text-sm font-semibold text-primary-500 hover:text-primary-600"
            >
              Thêm phương án
            </button>
          ) : (
            <div className="space-y-2">
              <input
                value={newOptionText}
                onChange={(event) => setNewOptionText(event.target.value)}
                placeholder="Nhập phương án mới"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-primary-400"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddOption(false);
                    setNewOptionText("");
                  }}
                  className="flex-1 rounded-xl bg-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-300"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleAddOption}
                  disabled={isSubmittingOption || !newOptionText.trim()}
                  className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold text-white ${isSubmittingOption || !newOptionText.trim()
                    ? "cursor-not-allowed bg-sky-300"
                    : "bg-primary-500 hover:bg-primary-600"
                    }`}
                >
                  {isSubmittingOption ? "Đang thêm..." : "Thêm"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
