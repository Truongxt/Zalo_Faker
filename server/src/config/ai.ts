import { config } from './env.js'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(config.geminiApiKey)

export const geminiModel = genAI.getGenerativeModel({ model: 'gemini-pro' })

export default genAI
