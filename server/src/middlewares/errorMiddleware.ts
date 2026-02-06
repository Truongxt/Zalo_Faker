import { Request, Response, NextFunction } from 'express'

// ==================== ERROR MIDDLEWARE ====================
// Xử lý lỗi tập trung

export const errorMiddleware = (
    err: any,
    req: Request,
    res: Response,
    next: NextFunction
) => {
    console.error('Error:', err)

    // Mongoose validation error
    if (err.name === 'ValidationError') {
        return res.status(400).json({
            success: false,
            message: 'Dữ liệu không hợp lệ',
            errors: Object.values(err.errors).map((e: any) => e.message)
        })
    }

    // Mongoose duplicate key error
    if (err.code === 11000) {
        return res.status(400).json({
            success: false,
            message: 'Dữ liệu đã tồn tại'
        })
    }

    // Mongoose cast error (invalid ObjectId)
    if (err.name === 'CastError') {
        return res.status(400).json({
            success: false,
            message: 'ID không hợp lệ'
        })
    }

    // Default error
    const statusCode = err.statusCode || 500
    const message = err.message || 'Lỗi server'

    return res.status(statusCode).json({
        success: false,
        message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    })
}
