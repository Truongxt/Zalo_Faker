const messageModel = require("../models/message")
const userRepository = require("../repository/userRepository")
const { enrichVoiceMessageWithTranscript } = require("./voiceTranscriptService")

const populateReactionNames = async (messages) => {
    if (!Array.isArray(messages)) return messages;
    
    // Collect all unique userIds from all reactions in all messages
    const userIds = new Set();
    messages.forEach(msg => {
        if (Array.isArray(msg.reactions)) {
            msg.reactions.forEach(r => {
                if (r.userId && !r.userName) {
                    userIds.add(r.userId);
                }
            });
        }
    });

    if (userIds.size === 0) return messages;

    // Fetch all needed users in one go (or in parallel)
    const userMap = new Map();
    await Promise.all(Array.from(userIds).map(async (uid) => {
        const user = await userRepository.getById(uid);
        if (user) {
            userMap.set(String(uid), user.fullName || user.userName || "Người dùng");
        }
    }));

    // Update reactions in messages
    messages.forEach(msg => {
        if (Array.isArray(msg.reactions)) {
            msg.reactions.forEach(r => {
                if (r.userId && !r.userName) {
                    r.userName = userMap.get(String(r.userId)) || "Người dùng";
                }
            });
        }
    });

    return messages;
};

const populateSenderInfo = async (messages) => {
    if (!Array.isArray(messages)) return messages;
    
    const senderIds = new Set();
    messages.forEach(msg => {
        if (msg.senderId && !msg.senderName) {
            senderIds.add(msg.senderId);
        }
    });

    if (senderIds.size === 0) return messages;

    const userMap = new Map();
    await Promise.all(Array.from(senderIds).map(async (uid) => {
        const user = await userRepository.getById(uid);
        if (user) {
            userMap.set(String(uid), {
                name: user.fullName || user.userName || "Người dùng",
                avatar: user.avartarUrl || null
            });
        }
    }));

    messages.forEach(msg => {
        if (msg.senderId && !msg.senderName) {
            const info = userMap.get(String(msg.senderId));
            if (info) {
                msg.senderName = info.name;
                msg.senderAvatar = info.avatar;
            }
        }
    });

    return messages;
};

const transcriptProcessingIds = new Set()
const RETRY_FAILED_TRANSCRIPT_AFTER_MS = 60 * 1000

const isObject = (value) => Boolean(value && typeof value === "object" && !Array.isArray(value))

const getExistingTranscript = (message = {}) => {
    if (isObject(message.content) && typeof message.content.transcript === "string") {
        const trimmed = message.content.transcript.trim()
        if (trimmed) return trimmed
    }

    if (isObject(message.metadata) && typeof message.metadata.transcript === "string") {
        const trimmed = message.metadata.transcript.trim()
        if (trimmed) return trimmed
    }

    return ""
}

const isSameJson = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

const shouldRetryFailedTranscript = (message = {}) => {
    const updatedAt = message?.metadata?.transcriptUpdatedAt
    if (!updatedAt) return true

    const updatedMs = new Date(updatedAt).getTime()
    if (!Number.isFinite(updatedMs)) return true

    return Date.now() - updatedMs >= RETRY_FAILED_TRANSCRIPT_AFTER_MS
}

const shouldAttemptTranscript = (message = {}) => {
    if (!message || String(message.type) !== "voice") return false
    if (getExistingTranscript(message)) return false

    const status = String(message?.metadata?.transcriptStatus || "").toLowerCase()
    if (status === "disabled" || status === "missing_audio_url") return false
    if (status === "failed" && !shouldRetryFailedTranscript(message)) return false

    return true
}

const enrichAndPersistTranscript = async (message) => {
    if (!message?._id || !shouldAttemptTranscript(message)) {
        return message
    }

    const messageId = String(message._id)
    if (transcriptProcessingIds.has(messageId)) {
        return message
    }

    transcriptProcessingIds.add(messageId)

    try {
        const enriched = await enrichVoiceMessageWithTranscript(message)

        const changedContent = !isSameJson(enriched?.content, message.content)
        const changedMetadata = !isSameJson(enriched?.metadata, message.metadata)

        if (changedContent || changedMetadata) {
            const updated = await messageModel.updateMessage(messageId, {
                content: enriched?.content,
                metadata: enriched?.metadata,
            })
            return updated || {
                ...message,
                content: enriched?.content,
                metadata: enriched?.metadata,
            }
        }

        return enriched || message
    } catch (error) {
        console.warn("Transcript backfill failed:", error?.message || error)
        return message
    } finally {
        transcriptProcessingIds.delete(messageId)
    }
}

const backfillVoiceTranscripts = async (messages = []) => {
    if (!Array.isArray(messages) || messages.length === 0) return messages

    const candidates = messages
        .filter(shouldAttemptTranscript)
        .slice(-5)

    if (candidates.length === 0) return messages

    const enrichedList = await Promise.all(candidates.map(enrichAndPersistTranscript))
    const enrichedById = new Map(enrichedList.map((item) => [String(item?._id || ""), item]))

    return messages.map((message) => {
        const key = String(message?._id || "")
        return enrichedById.get(key) || message
    })
}

const createMessage = async (message) => {
    let messageToSave = message;
    if (String(message.type) === "voice") {
        messageToSave = {
            ...messageToSave,
            metadata: {
                ...(isObject(message.metadata) ? message.metadata : {}),
                transcriptStatus: "processing"
            }
        };
    }
    const saved = await messageModel.createMessage(messageToSave);
    
    if (String(saved.type) === "voice") {
        // Fire and forget transcript in background so we don't block socket/HTTP responses
        enrichAndPersistTranscript(saved).catch(err => {
            console.warn("Background transcript failed:", err?.message || err);
        });
    }

    const populated = await populateSenderInfo([saved]);
    return populated[0];
}

const getMessage = async (id) => {
    const message = await messageModel.getOneMessage(id)
    if (!message) return message

    const enriched = await enrichAndPersistTranscript(message)
    const populatedReactions = await populateReactionNames([enriched])
    const populatedSender = await populateSenderInfo(populatedReactions)
    return populatedSender[0]
}

// get message of conversation
const getMessagesByConversationId = async (conversationId) => {
    const messages = await messageModel.getMessagesByConversationId(conversationId)
    const enriched = await backfillVoiceTranscripts(messages)
    const populatedReactions = await populateReactionNames(enriched)
    return await populateSenderInfo(populatedReactions)
}

const getMessages = async () => {
    const messages = await messageModel.getMessages()
    const enriched = await backfillVoiceTranscripts(messages)
    const populatedReactions = await populateReactionNames(enriched)
    return await populateSenderInfo(populatedReactions)
}

const updateMessage = async (id, message) => {
    return await messageModel.updateMessage(id, message, { new: true })
}

const deleteMessage = async (id) => {
    return await messageModel.deleteMessage(id)
}

const deleteMessagesByConversationId = async (conversationId) => {
    return await messageModel.deleteMessagesByConversationId(conversationId)
}

const getStickers = async () => {
    return [
        'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Smilies/Cat%20with%20Tears%20of%20Joy.png',
        'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Smilies/Cat%20with%20Wry%20Smile.png',
        'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Smilies/Ghost.png',
        'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Smilies/Heart%20on%20Fire.png',
        'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Smilies/Hundred%20Points.png',
        'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Smilies/Pleading%20Face.png',
        'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Smilies/Partying%20Face.png',
        'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Smilies/Smiling%20Face%20with%20Hearts.png',
        'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Activities/Party%20Popper.png',
        'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Animals/Dog%20Face.png',
        'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Animals/Fox.png',
        'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Animals/Panda.png',
        'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Animals/Penguin.png',
        'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Animals/Hamster.png',
        'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Animals/Hatching%20Chick.png',
        'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Animals/Monkey%20Face.png'
    ]
}

module.exports = {
    createMessage,
    getMessage,
    getMessages,
    updateMessage,
    deleteMessage,
    getMessagesByConversationId,
    deleteMessagesByConversationId,
    getStickers
}