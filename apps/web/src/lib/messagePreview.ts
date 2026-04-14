type PreviewContent = {
    text?: string
    fileName?: string
    mediaUrl?: string
}

type PreviewMetadata = {
    isAnnouncement?: boolean
    isImportant?: boolean
} | null | undefined

type PreviewType = 'text' | 'image' | 'video' | 'file' | 'sticker' | 'voice' | string

export const getMessagePreviewText = ({
    type,
    content,
    metadata,
}: {
    type: PreviewType
    content?: PreviewContent | string | null
    metadata?: PreviewMetadata
}) => {
    const text =
        typeof content === 'string'
            ? content
            : typeof content?.text === 'string'
                ? content.text
                : ''

    const baseText = text || (
        type === 'image' ? '[Hình ảnh]'
            : type === 'video' ? '[Video]'
                : type === 'voice' ? '[Tin nhắn thoại]'
                    : type === 'sticker' ? '[Nhãn dán]'
                        : type === 'file' ? `[File] ${typeof content === 'object' && content ? content.fileName || '' : ''}`.trim()
                            : '[Tin nhắn]'
    )

    const prefixes = [
        metadata?.isImportant ? '[Quan trọng]' : '',
        metadata?.isAnnouncement ? '[Thông báo]' : '',
    ].filter(Boolean)

    return [...prefixes, baseText].join(' ').trim()
}
