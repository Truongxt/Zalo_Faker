const messageModel = require("../models/message")
const { enrichVoiceMessageWithTranscript } = require("./voiceTranscriptService")

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
    const enrichedMessage = await enrichVoiceMessageWithTranscript(message)
    return await messageModel.createMessage(enrichedMessage)
}

const getMessage = async (id) => {
    const message = await messageModel.getOneMessage(id)
    if (!message) return message

    return await enrichAndPersistTranscript(message)
}

// get message of conversation
const getMessagesByConversationId = async (conversationId) => {
    const messages = await messageModel.getMessagesByConversationId(conversationId)
    return await backfillVoiceTranscripts(messages)
}

const getMessages = async () => {
    const messages = await messageModel.getMessages()
    return await backfillVoiceTranscripts(messages)
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