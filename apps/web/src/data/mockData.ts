import type { Conversation, Message, Participant } from '@/stores/chatStore'
import type { User } from '@/stores/authStore'

// ============================================
// MOCK CURRENT USER
// ============================================
export const mockCurrentUser: User = {
    id: 'user-me',
    email: 'truong.tx@gmail.com',
    phone: '0901234567',
    fullName: 'Trần Xuân Trường',
    avatarUrl: 'https://ui-avatars.com/api/?name=Trần+Xuân+Trường&background=0068ff&color=fff&size=128',
    bio: 'Đang học CNTT tại UIT',
    status: 'online',
    lastSeen: null,
    birthday: '2000-01-01',
    gender: 'male',
    createdAt: '2025-09-01T08:00:00.000Z'
}

// ============================================
// MOCK USERS
// ============================================
export const mockUsers: User[] = [
    {
        id: 'user-1',
        email: 'hoa.nt@gmail.com',
        phone: '0912345678',
        fullName: 'Nguyễn Thị Hoa',
        avatarUrl: 'https://ui-avatars.com/api/?name=Nguyễn+Thị+Hoa&background=e91e63&color=fff&size=128',
        bio: 'Yêu thương là sức mạnh',
        status: 'online',
        lastSeen: null,
        birthday: '2001-05-15',
        gender: 'female',
        createdAt: '2025-08-15T10:00:00.000Z'
    },
    {
        id: 'user-2',
        email: 'minh.pv@gmail.com',
        phone: '0923456789',
        fullName: 'Phạm Văn Minh',
        avatarUrl: 'https://ui-avatars.com/api/?name=Phạm+Văn+Minh&background=4caf50&color=fff&size=128',
        bio: 'Backend developer',
        status: 'offline',
        lastSeen: '2026-03-06T08:30:00.000Z',
        birthday: '1999-11-20',
        gender: 'male',
        createdAt: '2025-09-10T14:00:00.000Z'
    },
    {
        id: 'user-3',
        email: 'linh.tn@gmail.com',
        phone: '0934567890',
        fullName: 'Trần Ngọc Linh',
        avatarUrl: 'https://ui-avatars.com/api/?name=Trần+Ngọc+Linh&background=9c27b0&color=fff&size=128',
        bio: 'UI/UX Designer',
        status: 'online',
        lastSeen: null,
        birthday: '2002-02-14',
        gender: 'female',
        createdAt: '2025-07-20T09:00:00.000Z'
    },
    {
        id: 'user-4',
        email: 'hung.ld@gmail.com',
        phone: '0945678901',
        fullName: 'Lê Đức Hùng',
        avatarUrl: 'https://ui-avatars.com/api/?name=Lê+Đức+Hùng&background=ff9800&color=fff&size=128',
        bio: 'Full-stack developer',
        status: 'offline',
        lastSeen: '2026-03-05T22:15:00.000Z',
        birthday: '1998-08-08',
        gender: 'male',
        createdAt: '2025-10-01T11:00:00.000Z'
    },
    {
        id: 'user-5',
        email: 'mai.ntt@gmail.com',
        phone: '0956789012',
        fullName: 'Nguyễn Thị Thu Mai',
        avatarUrl: 'https://ui-avatars.com/api/?name=Nguyễn+Thu+Mai&background=00bcd4&color=fff&size=128',
        bio: 'Quản trị kinh doanh',
        status: 'online',
        lastSeen: null,
        birthday: '2000-12-25',
        gender: 'female',
        createdAt: '2025-11-05T16:00:00.000Z'
    },
    {
        id: 'user-6',
        email: 'tuan.vh@gmail.com',
        phone: '0967890123',
        fullName: 'Võ Hoàng Tuấn',
        avatarUrl: 'https://ui-avatars.com/api/?name=Võ+Hoàng+Tuấn&background=607d8b&color=fff&size=128',
        bio: 'Mobile developer',
        status: 'offline',
        lastSeen: '2026-03-04T18:00:00.000Z',
        birthday: '1997-03-30',
        gender: 'male',
        createdAt: '2025-08-25T13:00:00.000Z'
    },
    {
        id: 'user-7',
        email: 'thao.dp@gmail.com',
        phone: '0978901234',
        fullName: 'Đặng Phương Thảo',
        avatarUrl: 'https://ui-avatars.com/api/?name=Đặng+Phương+Thảo&background=795548&color=fff&size=128',
        bio: 'Data Scientist',
        status: 'online',
        lastSeen: null,
        birthday: '2001-09-09',
        gender: 'female',
        createdAt: '2025-12-10T07:00:00.000Z'
    },
    {
        id: 'user-8',
        email: 'nam.bt@gmail.com',
        phone: '0989012345',
        fullName: 'Bùi Thanh Nam',
        avatarUrl: 'https://ui-avatars.com/api/?name=Bùi+Thanh+Nam&background=f44336&color=fff&size=128',
        bio: 'DevOps Engineer',
        status: 'offline',
        lastSeen: '2026-03-03T20:00:00.000Z',
        birthday: '1996-10-10',
        gender: 'male',
        createdAt: '2025-06-15T12:00:00.000Z'
    },
]

// ============================================
// HELPER: build participants
// ============================================
function makeParticipant(user: User, role: 'admin' | 'member' = 'member'): Participant {
    return {
        userId: user.id,
        role,
        joinedAt: user.createdAt,
        lastRead: new Date().toISOString(),
        fullName: user.fullName,
        avatarUrl: user.avatarUrl ?? undefined,
        status: user.status === 'away' ? 'offline' : user.status,
    }
}

const me = makeParticipant(mockCurrentUser, 'admin')

// ============================================
// MOCK CONVERSATIONS
// ============================================
export const mockConversations: Conversation[] = [
    {
        id: 'conv-1',
        type: 'private',
        participants: [me, makeParticipant(mockUsers[0])],
        lastMessage: { content: 'Tối nay mình đi ăn nhé! 🍜', type: 'text', senderId: 'user-1', timestamp: '2026-03-06T11:45:00.000Z' },
        unreadCount: 2,
        createdAt: '2025-10-01T08:00:00.000Z',
        updatedAt: '2026-03-06T11:45:00.000Z'
    },
    {
        id: 'conv-2',
        type: 'private',
        participants: [me, makeParticipant(mockUsers[1])],
        lastMessage: { content: 'Em push code lên rồi anh ơi', type: 'text', senderId: 'user-2', timestamp: '2026-03-06T10:30:00.000Z' },
        unreadCount: 1,
        createdAt: '2025-11-15T10:00:00.000Z',
        updatedAt: '2026-03-06T10:30:00.000Z'
    },
    {
        id: 'conv-3',
        type: 'group',
        name: 'DHKTPM18A_2026',
        avatar: 'https://ui-avatars.com/api/?name=DHKTPM&background=0068ff&color=fff&size=128',
        participants: [
            me,
            makeParticipant(mockUsers[0]),
            makeParticipant(mockUsers[1]),
            makeParticipant(mockUsers[2]),
            makeParticipant(mockUsers[3]),
            makeParticipant(mockUsers[4]),
        ],
        lastMessage: { content: 'Nguyễn Tấn Minh được Trần Đình Ho...', type: 'text', senderId: 'user-3', timestamp: '2026-03-05T16:00:00.000Z' },
        unreadCount: 74,
        createdAt: '2025-09-01T07:00:00.000Z',
        updatedAt: '2026-03-05T16:00:00.000Z'
    },
    {
        id: 'conv-4',
        type: 'private',
        participants: [me, makeParticipant(mockUsers[2])],
        lastMessage: { content: 'Mình gửi file thiết kế nha', type: 'file', senderId: 'user-3', timestamp: '2026-03-05T14:20:00.000Z' },
        unreadCount: 0,
        createdAt: '2025-12-01T09:00:00.000Z',
        updatedAt: '2026-03-05T14:20:00.000Z'
    },
    {
        id: 'conv-5',
        type: 'group',
        name: 'Dự án Zalo Faker',
        avatar: 'https://ui-avatars.com/api/?name=ZF&background=4caf50&color=fff&size=128',
        participants: [
            me,
            makeParticipant(mockUsers[1]),
            makeParticipant(mockUsers[3]),
            makeParticipant(mockUsers[5]),
        ],
        lastMessage: { content: 'Bạn: bài e nát cmnr', type: 'text', senderId: 'user-me', timestamp: '2026-03-04T20:00:00.000Z' },
        unreadCount: 0,
        createdAt: '2026-01-10T08:00:00.000Z',
        updatedAt: '2026-03-04T20:00:00.000Z'
    },
    {
        id: 'conv-6',
        type: 'private',
        participants: [me, makeParticipant(mockUsers[4])],
        lastMessage: { content: 'Cảm ơn bạn nhiều nha ❤️', type: 'text', senderId: 'user-5', timestamp: '2026-03-04T15:00:00.000Z' },
        unreadCount: 0,
        createdAt: '2025-11-20T12:00:00.000Z',
        updatedAt: '2026-03-04T15:00:00.000Z'
    },
    {
        id: 'conv-7',
        type: 'private',
        participants: [me, makeParticipant(mockUsers[5])],
        lastMessage: { content: 'Bạn: Sticker', type: 'sticker', senderId: 'user-me', timestamp: '2026-03-04T10:00:00.000Z' },
        unreadCount: 0,
        createdAt: '2026-01-05T14:00:00.000Z',
        updatedAt: '2026-03-04T10:00:00.000Z'
    },
    {
        id: 'conv-8',
        type: 'private',
        participants: [me, makeParticipant(mockUsers[6])],
        lastMessage: { content: 'Máy trường thì nhập mã authenticato...', type: 'text', senderId: 'user-7', timestamp: '2026-03-04T08:30:00.000Z' },
        unreadCount: 0,
        createdAt: '2026-02-01T09:00:00.000Z',
        updatedAt: '2026-03-04T08:30:00.000Z'
    },
    {
        id: 'conv-9',
        type: 'group',
        name: 'Công nghệ mới :)))))',
        avatar: 'https://ui-avatars.com/api/?name=CN&background=ff9800&color=fff&size=128',
        participants: [
            me,
            makeParticipant(mockUsers[0]),
            makeParticipant(mockUsers[2]),
            makeParticipant(mockUsers[6]),
            makeParticipant(mockUsers[7]),
        ],
        lastMessage: { content: 'Bạn: giờ nó thành 3 cái node_module...', type: 'text', senderId: 'user-me', timestamp: '2026-03-06T11:30:00.000Z' },
        unreadCount: 0,
        createdAt: '2026-02-15T11:00:00.000Z',
        updatedAt: '2026-03-06T11:30:00.000Z'
    },
    {
        id: 'conv-10',
        type: 'private',
        participants: [me, makeParticipant(mockUsers[7])],
        lastMessage: { content: 'Đã quá', type: 'text', senderId: 'user-8', timestamp: '2026-03-03T19:00:00.000Z' },
        unreadCount: 0,
        createdAt: '2025-10-20T15:00:00.000Z',
        updatedAt: '2026-03-03T19:00:00.000Z'
    },
]

// ============================================
// MOCK MESSAGES — keyed by conversationId
// ============================================

function makeMessage(
    id: string,
    conversationId: string,
    senderId: string,
    text: string,
    createdAt: string,
    extra?: Partial<Message>
): Message {
    return {
        id,
        conversationId,
        senderId,
        type: 'text',
        content: { text },
        reactions: [],
        readBy: senderId !== 'user-me'
            ? [{ userId: 'user-me', readAt: createdAt }]
            : [{ userId: conversationId === 'conv-1' ? 'user-1' : 'user-2', readAt: createdAt }],
        isDeleted: false,
        createdAt,
        ...extra,
    }
}

export const mockMessages: Record<string, Message[]> = {
    // ====== conv-1: Chat with Nguyễn Thị Hoa ======
    'conv-1': [
        makeMessage('m1-1', 'conv-1', 'user-1', 'Trường ơi, cuối tuần này rảnh không?', '2026-03-06T09:00:00.000Z'),
        makeMessage('m1-2', 'conv-1', 'user-me', 'Rảnh nha, có gì không Hoa?', '2026-03-06T09:05:00.000Z'),
        makeMessage('m1-3', 'conv-1', 'user-1', 'Mình muốn nhờ bạn review lại bài tập nhóm', '2026-03-06T09:06:00.000Z'),
        makeMessage('m1-4', 'conv-1', 'user-me', 'OK mình xem được, gửi link drive đi', '2026-03-06T09:10:00.000Z'),
        makeMessage('m1-5', 'conv-1', 'user-1', 'https://drive.google.com/shared/abc123', '2026-03-06T09:12:00.000Z'),
        makeMessage('m1-6', 'conv-1', 'user-me', 'Đã nhận, mình sẽ xem tối nay nhé', '2026-03-06T09:15:00.000Z'),
        makeMessage('m1-7', 'conv-1', 'user-1', 'Cảm ơn Trường nhiều nha! 🙏', '2026-03-06T09:16:00.000Z', {
            reactions: [{ userId: 'user-me', emoji: '❤️' }],
        }),
        makeMessage('m1-8', 'conv-1', 'user-me', 'Không có gì đâu 😄', '2026-03-06T09:20:00.000Z'),
        makeMessage('m1-9', 'conv-1', 'user-1', 'À mà tối nay mình có đi ăn với mấy bạn trong lớp', '2026-03-06T11:40:00.000Z'),
        makeMessage('m1-10', 'conv-1', 'user-1', 'Trường đi cùng không?', '2026-03-06T11:41:00.000Z'),
        makeMessage('m1-11', 'conv-1', 'user-1', 'Tối nay mình đi ăn nhé! 🍜', '2026-03-06T11:45:00.000Z'),
    ],

    // ====== conv-2: Chat with Phạm Văn Minh ======
    'conv-2': [
        makeMessage('m2-1', 'conv-2', 'user-me', 'Minh ơi, phần API Login xong chưa?', '2026-03-06T08:00:00.000Z'),
        makeMessage('m2-2', 'conv-2', 'user-2', 'Xong rồi anh, đang viết unit test', '2026-03-06T08:15:00.000Z'),
        makeMessage('m2-3', 'conv-2', 'user-me', 'Nice! Nhớ handle edge case refresh token nha', '2026-03-06T08:20:00.000Z'),
        makeMessage('m2-4', 'conv-2', 'user-2', 'Dạ em đã xử lý rồi anh', '2026-03-06T08:25:00.000Z'),
        makeMessage('m2-5', 'conv-2', 'user-2', 'Cả phần middleware auth em cũng sửa lại rồi', '2026-03-06T08:26:00.000Z'),
        makeMessage('m2-6', 'conv-2', 'user-me', 'Tốt lắm 👍', '2026-03-06T08:30:00.000Z', {
            reactions: [{ userId: 'user-2', emoji: '😊' }],
        }),
        {
            id: 'm2-7',
            conversationId: 'conv-2',
            senderId: 'user-2',
            type: 'file',
            content: {
                text: 'Em gửi file postman collection luôn nha',
                fileName: 'ZaloFaker_API.postman_collection.json',
                fileSize: 45056,
                mediaUrl: '#',
            },
            reactions: [],
            readBy: [{ userId: 'user-me', readAt: '2026-03-06T09:00:00.000Z' }],
            isDeleted: false,
            createdAt: '2026-03-06T09:00:00.000Z',
        },
        makeMessage('m2-8', 'conv-2', 'user-me', 'OK em, anh import thử nha', '2026-03-06T09:05:00.000Z'),
        makeMessage('m2-9', 'conv-2', 'user-2', 'Em push code lên rồi anh ơi', '2026-03-06T10:30:00.000Z'),
    ],

    // ====== conv-3: Group DHKTPM18A_2026 ======
    'conv-3': [
        makeMessage('m3-1', 'conv-3', 'user-3', 'Mọi người ơi, deadline bài tập nhóm là thứ 6 nha', '2026-03-05T10:00:00.000Z'),
        makeMessage('m3-2', 'conv-3', 'user-4', 'Nhận, mình sẽ xong phần backend trước thứ 5', '2026-03-05T10:15:00.000Z'),
        makeMessage('m3-3', 'conv-3', 'user-me', 'Mình lo phần frontend, có gì sync lại nhé', '2026-03-05T10:20:00.000Z'),
        makeMessage('m3-4', 'conv-3', 'user-1', 'OK, mình viết doc luôn', '2026-03-05T10:25:00.000Z'),
        makeMessage('m3-5', 'conv-3', 'user-5', 'Mình test và review code nha mọi người', '2026-03-05T10:30:00.000Z'),
        makeMessage('m3-6', 'conv-3', 'user-3', 'Perfect! Mỗi người một việc 💪', '2026-03-05T10:35:00.000Z', {
            reactions: [
                { userId: 'user-me', emoji: '🔥' },
                { userId: 'user-1', emoji: '💪' },
                { userId: 'user-4', emoji: '👍' },
            ],
        }),
        makeMessage('m3-7', 'conv-3', 'user-me', 'Let\'s go team! 🚀', '2026-03-05T10:40:00.000Z'),
        makeMessage('m3-8', 'conv-3', 'user-2', 'Thầy mới đăng thêm requirement mới trên moodle', '2026-03-05T14:00:00.000Z'),
        makeMessage('m3-9', 'conv-3', 'user-3', 'Mình check rồi, thêm phần real-time chat', '2026-03-05T14:10:00.000Z'),
        makeMessage('m3-10', 'conv-3', 'user-me', 'Socket.io là ngon nhất rồi', '2026-03-05T14:15:00.000Z'),
        makeMessage('m3-11', 'conv-3', 'user-3', 'Nguyễn Tấn Minh được Trần Đình Ho...', '2026-03-05T16:00:00.000Z'),
    ],

    // ====== conv-4: Chat with Trần Ngọc Linh ======
    'conv-4': [
        makeMessage('m4-1', 'conv-4', 'user-me', 'Linh ơi, mình cần mockup cho trang chat', '2026-03-05T10:00:00.000Z'),
        makeMessage('m4-2', 'conv-4', 'user-3', 'OK Trường, mình làm giống UI Zalo luôn nhé?', '2026-03-05T10:10:00.000Z'),
        makeMessage('m4-3', 'conv-4', 'user-me', 'Ừ, giống Zalo PC ấy, sidebar bên trái + chat bên phải', '2026-03-05T10:15:00.000Z'),
        makeMessage('m4-4', 'conv-4', 'user-3', 'Hiểu rồi, mình dùng Figma làm nha', '2026-03-05T10:20:00.000Z'),
        {
            id: 'm4-5',
            conversationId: 'conv-4',
            senderId: 'user-3',
            type: 'image',
            content: {
                text: 'Đây, mình gửi preview nè',
                mediaUrl: 'https://placehold.co/600x400/0068ff/white?text=Zalo+Faker+Mockup',
                thumbnail: 'https://placehold.co/300x200/0068ff/white?text=Zalo+Faker+Mockup',
            },
            reactions: [{ userId: 'user-me', emoji: '😍' }],
            readBy: [{ userId: 'user-me', readAt: '2026-03-05T13:00:00.000Z' }],
            isDeleted: false,
            createdAt: '2026-03-05T13:00:00.000Z',
        },
        makeMessage('m4-6', 'conv-4', 'user-me', 'Đẹp quá Linh ơi! 🔥', '2026-03-05T13:05:00.000Z'),
        {
            id: 'm4-7',
            conversationId: 'conv-4',
            senderId: 'user-3',
            type: 'file',
            content: {
                text: 'Mình gửi file thiết kế nha',
                fileName: 'ZaloFaker_UI_Design.fig',
                fileSize: 2048000,
                mediaUrl: '#',
            },
            reactions: [],
            readBy: [{ userId: 'user-me', readAt: '2026-03-05T14:20:00.000Z' }],
            isDeleted: false,
            createdAt: '2026-03-05T14:20:00.000Z',
        },
    ],

    // ====== conv-5: Group Dự án Zalo Faker ======
    'conv-5': [
        makeMessage('m5-1', 'conv-5', 'user-4', 'Mọi người ơi, sprint review chiều nay nhé', '2026-03-04T09:00:00.000Z'),
        makeMessage('m5-2', 'conv-5', 'user-6', 'OK anh, em đang fix bug phần mobile', '2026-03-04T09:15:00.000Z'),
        makeMessage('m5-3', 'conv-5', 'user-2', 'Em xong API conversation rồi', '2026-03-04T10:00:00.000Z'),
        makeMessage('m5-4', 'conv-5', 'user-me', 'Mình deploy staging được chưa nhỉ?', '2026-03-04T14:00:00.000Z'),
        makeMessage('m5-5', 'conv-5', 'user-4', 'Để mình setup CI/CD đã, tối nay xong', '2026-03-04T14:30:00.000Z'),
        makeMessage('m5-6', 'conv-5', 'user-me', 'bài e nát cmnr', '2026-03-04T20:00:00.000Z'),
    ],

    // ====== conv-6: Chat with Nguyễn Thị Thu Mai ======
    'conv-6': [
        makeMessage('m6-1', 'conv-6', 'user-me', 'Mai ơi, bạn có tài liệu môn QTDA không?', '2026-03-04T13:00:00.000Z'),
        makeMessage('m6-2', 'conv-6', 'user-5', 'Có nè, mình share drive nhé', '2026-03-04T13:10:00.000Z'),
        makeMessage('m6-3', 'conv-6', 'user-5', 'https://drive.google.com/shared/qtda2026', '2026-03-04T13:12:00.000Z'),
        makeMessage('m6-4', 'conv-6', 'user-me', 'Cảm ơn Mai nhiều lắm! 🙏', '2026-03-04T13:15:00.000Z'),
        makeMessage('m6-5', 'conv-6', 'user-5', 'Cảm ơn bạn nhiều nha ❤️', '2026-03-04T15:00:00.000Z'),
    ],

    // ====== conv-9: Group Công nghệ mới ======
    'conv-9': [
        makeMessage('m9-1', 'conv-9', 'user-7', 'Mọi người thấy Bun v2 thế nào?', '2026-03-06T09:00:00.000Z'),
        makeMessage('m9-2', 'conv-9', 'user-8', 'Nhanh kinh khủng, benchmark gấp 3 lần Node', '2026-03-06T09:10:00.000Z'),
        makeMessage('m9-3', 'conv-9', 'user-1', 'Nhưng ecosystem còn thiếu nhiều package', '2026-03-06T09:20:00.000Z'),
        makeMessage('m9-4', 'conv-9', 'user-me', 'Mình thấy dùng cho side project OK, production thì chưa', '2026-03-06T09:30:00.000Z'),
        makeMessage('m9-5', 'conv-9', 'user-3', 'Giờ Deno cũng ra v2 rồi nè, support npm packages', '2026-03-06T10:00:00.000Z'),
        makeMessage('m9-6', 'conv-9', 'user-7', 'JavaScript runtime war 😂', '2026-03-06T10:10:00.000Z', {
            reactions: [
                { userId: 'user-me', emoji: '😂' },
                { userId: 'user-8', emoji: '😂' },
                { userId: 'user-1', emoji: '🔥' },
            ],
        }),
        makeMessage('m9-7', 'conv-9', 'user-me', 'giờ nó thành 3 cái node_module...', '2026-03-06T11:30:00.000Z'),
    ],
}

// Provide empty arrays for conversations without specific messages
for (const conv of mockConversations) {
    if (!mockMessages[conv.id]) {
        mockMessages[conv.id] = []
    }
}

// ============================================
// Helper: lookup user info by ID
// ============================================
const allUsers = [mockCurrentUser, ...mockUsers]
export function getUserById(userId: string): User | undefined {
    return allUsers.find(u => u.id === userId)
}
