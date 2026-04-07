const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'apps/web/src/pages/ChatRoom.tsx');

try {
    let content = fs.readFileSync(filePath, 'utf8');

    // 1. Replace normalizeIncomingMessage with normalizeMessage
    content = content.replace(/normalizeIncomingMessage/g, 'normalizeMessage');

    // 2. Fix imports to include normalizeMessage
    if (!content.includes('normalizeMessage } from \'@/stores/chatStore\'')) {
        content = content.replace(
            "import { useChatStore, type Message, type GroupPermissionScope } from '@/stores/chatStore'",
            "import { useChatStore, type Message, type GroupPermissionScope, normalizeMessage } from '@/stores/chatStore'"
        );
    }

    // 3. Selective replacement for messy useEffect
    const startMarker = "    // ✅ Vào phòng socket + lắng nghe tin nhắn realtime";
    const endMarker = "    // Sau khi messages được load vào phòng hiện tại";

    const startIdx = content.indexOf(startMarker);
    const endIdx = content.indexOf(endMarker);

    if (startIdx !== -1 && endIdx !== -1) {
        const newEffect = `    // ✅ Vào phòng socket + lắng nghe tin nhắn realtime
    useEffect(() => {
        if (!conversationId) return
        if (user?.id && !socketService.isConnected()) {
            socketService.connect(user.id)
        }

        updateConversation(conversationId, { unreadCount: 0 })
        socketService.joinRoom(conversationId)

        const handleTyping = ({ userId }: { userId: string }) => {
            if (userId !== user?.id) {
                useChatStore.getState().addTypingUser(conversationId, userId)
            }
        }

        const handleStopTyping = ({ userId }: { userId: string }) => {
            useChatStore.getState().removeTypingUser(conversationId, userId)
        }

        socketService.on('chat:typing', handleTyping)
        socketService.on('chat:stop_typing', handleStopTyping)

        return () => {
            socketService.leaveRoom(conversationId)
            socketService.off('chat:typing', handleTyping)
            socketService.off('chat:stop_typing', handleStopTyping)
        }
    }, [conversationId, user?.id, updateConversation])

`;
        content = content.slice(0, startIdx) + newEffect + content.slice(endIdx);
        console.log("Found markers and replaced useEffect block.");
    } else {
        console.log("Could not find markers correctly.");
        if (startIdx === -1) console.log("Start marker missing.");
        if (endIdx === -1) console.log("End marker missing.");
    }

    fs.writeFileSync(filePath, content, 'utf8');
    console.log("ChatRoom.tsx cleanup finished successfully.");
} catch (err) {
    console.error("Error cleaning up ChatRoom.tsx:", err);
    process.exit(1);
}
