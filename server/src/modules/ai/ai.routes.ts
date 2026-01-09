import { Router } from 'express'
import { authMiddleware, AuthRequest } from '../../middleware/auth.js'
import { geminiModel } from '../../config/ai.js'

const router = Router()

// System prompt for the chatbot
const SYSTEM_PROMPT = `Bạn là trợ lý AI thông minh, thân thiện và hữu ích. 
Bạn có thể giúp người dùng với nhiều vấn đề như:
- Trả lời câu hỏi tổng quát
- Gợi ý nội dung tin nhắn
- Dịch ngôn ngữ
- Tóm tắt thông tin
- Đưa ra lời khuyên

Hãy trả lời ngắn gọn, súc tích và hữu ích. Sử dụng tiếng Việt để trả lời.
`

// Chat with AI
router.post('/chat', authMiddleware, async (req: AuthRequest, res) => {
    try {
        const { message, context = [] } = req.body

        if (!message) {
            return res.status(400).json({ message: 'Message is required' })
        }

        const chat = geminiModel.startChat({
            history: [
                { role: 'user', parts: [{ text: 'Giới thiệu bản thân' }] },
                { role: 'model', parts: [{ text: SYSTEM_PROMPT }] },
                ...context.map((msg: { role: string; content: string }) => ({
                    role: msg.role === 'user' ? 'user' : 'model',
                    parts: [{ text: msg.content }]
                }))
            ],
            generationConfig: {
                maxOutputTokens: 500,
                temperature: 0.7
            }
        })

        const result = await chat.sendMessage(message)
        const response = result.response.text()

        res.json({ response })
    } catch (error) {
        console.error('Error in AI chat:', error)
        res.status(500).json({ message: 'AI service error' })
    }
})

// Suggest replies
router.post('/suggest-replies', authMiddleware, async (req: AuthRequest, res) => {
    try {
        const { message } = req.body

        if (!message) {
            return res.status(400).json({ message: 'Message is required' })
        }

        const prompt = `Dựa vào tin nhắn sau, hãy đề xuất 3 câu trả lời ngắn gọn và phù hợp (mỗi câu dưới 50 ký tự):
    
Tin nhắn: "${message}"

Chỉ trả về 3 câu trả lời, mỗi câu một dòng, không đánh số.`

        const result = await geminiModel.generateContent(prompt)
        const suggestions = result.response.text()
            .split('\n')
            .filter(Boolean)
            .slice(0, 3)

        res.json({ suggestions })
    } catch (error) {
        console.error('Error suggesting replies:', error)
        res.status(500).json({ message: 'AI service error' })
    }
})

// Translate message
router.post('/translate', authMiddleware, async (req: AuthRequest, res) => {
    try {
        const { text, targetLanguage = 'en' } = req.body

        if (!text) {
            return res.status(400).json({ message: 'Text is required' })
        }

        const languageNames: Record<string, string> = {
            en: 'English',
            vi: 'Vietnamese',
            zh: 'Chinese',
            ja: 'Japanese',
            ko: 'Korean',
            fr: 'French',
            de: 'German',
            es: 'Spanish'
        }

        const targetLang = languageNames[targetLanguage] || 'English'
        const prompt = `Translate the following text to ${targetLang}. Only return the translated text, nothing else:

"${text}"`

        const result = await geminiModel.generateContent(prompt)
        const translation = result.response.text().trim()

        res.json({ translation })
    } catch (error) {
        console.error('Error translating:', error)
        res.status(500).json({ message: 'AI service error' })
    }
})

// Summarize conversation
router.post('/summarize', authMiddleware, async (req: AuthRequest, res) => {
    try {
        const { messages } = req.body

        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({ message: 'Messages array is required' })
        }

        const conversation = messages
            .map((m: { sender: string; content: string }) => `${m.sender}: ${m.content}`)
            .join('\n')

        const prompt = `Hãy tóm tắt cuộc hội thoại sau trong 2-3 câu ngắn gọn bằng tiếng Việt:

${conversation}`

        const result = await geminiModel.generateContent(prompt)
        const summary = result.response.text().trim()

        res.json({ summary })
    } catch (error) {
        console.error('Error summarizing:', error)
        res.status(500).json({ message: 'AI service error' })
    }
})

export default router
