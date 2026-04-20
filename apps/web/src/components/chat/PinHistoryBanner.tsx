import { Pin } from "lucide-react";
import type { Message } from "@/stores/chatStore";

type PinHistoryBannerProps = {
  message: Message;
};

export default function PinHistoryBanner({
  message,
}: PinHistoryBannerProps) {
  const action = (message as any)?.metadata?.action === "unpin" ? "unpin" : "pin";
  const actorName = String(
    (message as any)?.metadata?.actorName || "User",
  ).trim();
  const previewText = String(
    (message as any)?.metadata?.previewText || "",
  ).trim();
  const actionText =
    action === "pin"
      ? "\u0111\u00e3 ghim 1 tin nh\u1eafn"
      : "\u0111\u00e3 b\u1ecf ghim 1 tin nh\u1eafn";

  return (
    <div className="flex justify-center my-2">
      <div className="max-w-[92%] flex items-center gap-2 px-3 py-2 rounded-full border border-slate-200 bg-white shadow-sm">
        <span className="w-6 h-6 rounded-full bg-orange-50 text-orange-500 flex items-center justify-center flex-shrink-0">
          <Pin className="w-3.5 h-3.5" />
        </span>
        <p className="text-sm text-slate-500 truncate">
          <span className="font-medium text-slate-600">{actorName}</span>
          {` ${actionText}`}
          {previewText ? ` ${previewText}` : ""}
        </p>
      </div>
    </div>
  );
}
