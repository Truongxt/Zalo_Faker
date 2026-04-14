import os

file_path = r'd:\Zalo_Faker\apps\web\src\pages\ChatRoom.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Replace normalizeIncomingMessage with normalizeMessage
content = content.replace('normalizeIncomingMessage', 'normalizeMessage')

# 2. Fix imports to include normalizeMessage
if 'normalizeMessage' not in content:
    content = content.replace(
        "import { useChatStore, type Message, type GroupPermissionScope } from '@/stores/chatStore'",
        "import { useChatStore, type Message, type GroupPermissionScope, normalizeMessage } from '@/stores/chatStore'"
    )

# 3. Use regex-like replacement for the messy useEffect
# Find the start of the useEffect block
start_marker = "    // ✅ Vào phòng socket + lắng nghe tin nhắn realtime"
end_marker = "    // Sau khi messages được load vào phòng hiện tại"

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

if start_idx != -1 and end_idx != -1:
    new_effect = """    // ✅ Vào phòng socket + lắng nghe tin nhắn realtime
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

"""
    content = content[:start_idx] + new_effect + content[end_idx:]

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("ChatRoom.tsx cleanup finished successfully.")
