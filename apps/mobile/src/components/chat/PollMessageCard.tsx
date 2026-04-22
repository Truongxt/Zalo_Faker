import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import type { PollContent } from "@/types";

type PollParticipant = {
  userId: string;
  fullName?: string;
  nickname?: string;
};

type PollMessageCardProps = {
  messageId: string;
  content: PollContent;
  currentUserId?: string | null;
  participants?: PollParticipant[];
  isMe: boolean;
  textColor: string;
  onVote: (messageId: string, optionIds: string[]) => Promise<void>;
  onAddOption: (messageId: string, text: string) => Promise<void>;
  onRemoveOption: (messageId: string, optionId: string) => Promise<void>;
};

const formatDeadline = (value: string | null) => {
  if (!value) return "Không thời hạn";
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

export function PollMessageCard({
  messageId,
  content,
  currentUserId,
  participants = [],
  isMe,
  textColor,
  onVote,
  onAddOption,
  onRemoveOption,
}: PollMessageCardProps) {
  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>([]);
  const [isSubmittingVote, setIsSubmittingVote] = useState(false);
  const [isSubmittingOption, setIsSubmittingOption] = useState(false);
  const [isAddingOption, setIsAddingOption] = useState(false);
  const [newOptionText, setNewOptionText] = useState("");
  const [removingOptionId, setRemovingOptionId] = useState<string | null>(null);

  const currentVote = useMemo(
    () =>
      (content.votes || []).find(
        (vote) => String(vote.userId) === String(currentUserId || ""),
      ) || null,
    [content.votes, currentUserId],
  );

  useEffect(() => {
    setSelectedOptionIds(currentVote?.optionIds || []);
  }, [currentVote?.optionIds]);

  const isExpired = Boolean(
    content.settings?.expiresAt &&
    new Date(content.settings.expiresAt).getTime() <= Date.now(),
  );
  const canViewResults =
    !content.settings?.hideResultsUntilVote || Boolean(currentVote) || isExpired;
  const isCreator = String(content.createdBy || "") === String(currentUserId || "");
  const totalVoters = (content.votes || []).length;
  const participantNameMap = useMemo(() => {
    const map = new Map<string, string>();
    participants.forEach((participant) => {
      map.set(
        String(participant.userId),
        participant.nickname || participant.fullName || `User ${participant.userId}`,
      );
    });
    return map;
  }, [participants]);

  const hasSelectionChanged =
    JSON.stringify([...(selectedOptionIds || [])].sort()) !==
    JSON.stringify([...(currentVote?.optionIds || [])].sort());

  const toggleOption = (optionId: string) => {
    if (isExpired) return;
    if (content.settings?.allowMultipleChoices) {
      setSelectedOptionIds((prev) =>
        prev.includes(optionId)
          ? prev.filter((id) => id !== optionId)
          : [...prev, optionId],
      );
      return;
    }
    setSelectedOptionIds([optionId]);
  };

  const handleSubmitVote = async () => {
    if (selectedOptionIds.length === 0 || isSubmittingVote || isExpired) return;
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
      setIsAddingOption(false);
    } finally {
      setIsSubmittingOption(false);
    }
  };

  const handleRemoveOption = async (optionId: string) => {
    if (
      isExpired ||
      !isCreator ||
      (content.options || []).length <= 2 ||
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
    <View style={{ minWidth: 240, gap: 10 }}>
      <View style={{ gap: 4 }}>
        <Text style={{ color: textColor, fontSize: 20, fontWeight: "700" }}>
          {content.question}
        </Text>
        <Text
          style={{
            color: isMe ? "rgba(255,255,255,0.82)" : "#6B7280",
            fontSize: 12,
          }}
        >
          Hạn bình chọn: {formatDeadline(content.settings?.expiresAt)}
        </Text>
      </View>

      {(content.options || []).map((option) => {
        const voters = (content.votes || []).filter((vote) =>
          (vote.optionIds || []).includes(option.id),
        );
        const voteCount = voters.length;
        const percent =
          totalVoters > 0 ? Math.round((voteCount / totalVoters) * 100) : 0;
        const isSelected = selectedOptionIds.includes(option.id);
        const voterNames = voters.map(
          (vote) =>
            participantNameMap.get(String(vote.userId)) || `User ${vote.userId}`,
        );

        return (
          <TouchableOpacity
            key={option.id}
            activeOpacity={0.85}
            onPress={() => toggleOption(option.id)}
            disabled={isExpired}
            style={{
              borderWidth: 1,
              borderColor: isSelected ? "#3B82F6" : "rgba(148,163,184,0.35)",
              borderRadius: 16,
              paddingHorizontal: 12,
              paddingVertical: 11,
              backgroundColor: isSelected ? "#EFF6FF" : "#FFFFFF",
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: content.settings?.allowMultipleChoices ? 5 : 9,
                  borderWidth: 1.5,
                  borderColor: isSelected ? "#3B82F6" : "#94A3B8",
                  backgroundColor: isSelected ? "#3B82F6" : "transparent",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {isSelected ? (
                  <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>
                    {content.settings?.allowMultipleChoices ? "✓" : ""}
                  </Text>
                ) : null}
              </View>
              <View style={{ flex: 1, gap: 5 }}>
                <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
                  <Text style={{ flex: 1, color: "#111827", fontSize: 14, fontWeight: "600" }}>
                    {option.text}
                  </Text>
                  {isCreator && (
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => void handleRemoveOption(option.id)}
                      disabled={isExpired || (content.options || []).length <= 2 || removingOptionId === option.id}
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor:
                          isExpired || (content.options || []).length <= 2 || removingOptionId === option.id
                            ? "#E5E7EB"
                            : "#F1F5F9",
                      }}
                    >
                      <Text
                        style={{
                          color:
                            isExpired || (content.options || []).length <= 2 || removingOptionId === option.id
                              ? "#94A3B8"
                              : "#64748B",
                          fontSize: 16,
                          fontWeight: "700",
                          lineHeight: 18,
                        }}
                      >
                        ×
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
                {canViewResults ? (
                  <>
                    <View
                      style={{
                        height: 6,
                        borderRadius: 999,
                        backgroundColor: "#E5E7EB",
                        overflow: "hidden",
                      }}
                    >
                      <View
                        style={{
                          width: `${Math.max(percent, voteCount > 0 ? 8 : 0)}%`,
                          height: "100%",
                          backgroundColor: "#3B82F6",
                        }}
                      />
                    </View>
                    <Text
                      style={{
                        color: "#6B7280",
                        fontSize: 12,
                      }}
                    >
                      {voteCount} lựa chọn{voteCount !== 1 ? "" : ""} • {percent}%
                    </Text>
                    {!content.settings?.anonymousVoters && voterNames.length > 0 && (
                      <Text
                        style={{
                          color: "#64748B",
                          fontSize: 12,
                        }}
                      >
                        {voterNames.join(", ")}
                      </Text>
                    )}
                  </>
                ) : (
                  <Text
                    style={{
                      color: "#6B7280",
                      fontSize: 12,
                    }}
                  >
                    Kết quả sẽ hiển thị sau khi bạn bình chọn
                  </Text>
                )}
              </View>
            </View>
          </TouchableOpacity>
        );
      })}

      <View
        style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 }}
      >
        <View
          style={{
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 999,
            backgroundColor: isMe ? "rgba(255,255,255,0.12)" : "#E5E7EB",
          }}
        >
          <Text style={{ color: textColor, fontSize: 12, fontWeight: "600" }}>
            {content.settings?.allowMultipleChoices ? "Nhiều lựa chọn" : "Một lựa chọn"}
          </Text>
        </View>
        {content.settings?.anonymousVoters && (
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 999,
              backgroundColor: isMe ? "rgba(255,255,255,0.12)" : "#E5E7EB",
            }}
          >
            <Text style={{ color: textColor, fontSize: 12, fontWeight: "600" }}>
              Ẩn người bình chọn
            </Text>
          </View>
        )}
      </View>

      {!isExpired && (
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={handleSubmitVote}
          disabled={
            isSubmittingVote || selectedOptionIds.length === 0 || !hasSelectionChanged
          }
          style={{
            borderRadius: 14,
            paddingVertical: 11,
            alignItems: "center",
            backgroundColor:
              isSubmittingVote || selectedOptionIds.length === 0 || !hasSelectionChanged
                ? isMe
                  ? "rgba(255,255,255,0.18)"
                  : "#CBD5E1"
                : "#2563EB",
          }}
        >
          {isSubmittingVote ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>
              {currentVote ? "Cập nhật bình chọn" : "Gửi bình chọn"}
            </Text>
          )}
        </TouchableOpacity>
      )}

      {content.settings?.allowAddOptions && !isExpired && (
        <View style={{ gap: 8 }}>
          {!isAddingOption ? (
            <TouchableOpacity onPress={() => setIsAddingOption(true)}>
              <Text style={{ color: "#2563EB", fontSize: 13, fontWeight: "700" }}>
                Thêm phương án
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={{ gap: 8 }}>
              <TextInput
                value={newOptionText}
                onChangeText={setNewOptionText}
                placeholder="Nhập phương án mới"
                placeholderTextColor="#94A3B8"
                style={{
                  borderWidth: 1,
                  borderColor: "#CBD5E1",
                  borderRadius: 14,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  backgroundColor: "#fff",
                  color: "#111827",
                }}
              />
              <View style={{ flexDirection: "row", gap: 10 }}>
                <TouchableOpacity
                  onPress={() => {
                    setIsAddingOption(false);
                    setNewOptionText("");
                  }}
                  style={{
                    flex: 1,
                    borderRadius: 12,
                    paddingVertical: 10,
                    alignItems: "center",
                    backgroundColor: "#E5E7EB",
                  }}
                >
                  <Text style={{ color: "#475569", fontWeight: "700" }}>Hủy</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleAddOption}
                  disabled={isSubmittingOption || !newOptionText.trim()}
                  style={{
                    flex: 1,
                    borderRadius: 12,
                    paddingVertical: 10,
                    alignItems: "center",
                    backgroundColor:
                      isSubmittingOption || !newOptionText.trim()
                        ? "#93C5FD"
                        : "#2563EB",
                  }}
                >
                  {isSubmittingOption ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={{ color: "#fff", fontWeight: "700" }}>Thêm</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

export default PollMessageCard;
