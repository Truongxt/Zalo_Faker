export default function TypingIndicator() {
    return (
        <div className="flex items-end gap-2">
            <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700" />
            <div className="message-bubble message-received flex items-center gap-1 py-3 px-4">
                <div className="typing-dot" />
                <div className="typing-dot" />
                <div className="typing-dot" />
            </div>
        </div>
    )
}
