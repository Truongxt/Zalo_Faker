export const REACTION_OPTIONS = [
  { key: "like", label: "Thích", icon: "👍" },
  { key: "love", label: "Yêu thích", icon: "❤️" },
  { key: "haha", label: "Haha", icon: "😂" },
  { key: "wow", label: "Wow", icon: "😮" },
  { key: "sad", label: "Buồn", icon: "😢" },
  { key: "angry", label: "Giận dữ", icon: "😡" },
] as const;

export const getReactionOption = (reactionKey?: string | null) =>
  REACTION_OPTIONS.find((option) => option.key === reactionKey) || null;
