const baseAPI = "http://localhost:3000/api";

const getConversation = async () => {
    const response = await fetch(`${baseAPI}/conversations`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json();
    // DynamoDB trả về _id, frontend dùng id → cần map
    return data.map((conv: any) => ({ ...conv, id: conv._id }));
}


const getMessages = async (conversationId: string) => {
    const response = await fetch(`${baseAPI}/messages/conversation/${conversationId}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json();
    // DynamoDB trả về _id, frontend dùng id → cần map
    return data.map((msg: any) => ({ ...msg, id: msg._id }));
}

const sendMessage = async (message: any) => {
    const response = await fetch(`${baseAPI}/messages`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(message),
    });
    return response.json();
}


const getUsers = async () => {
    const response = await fetch(`${baseAPI}/users`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return response.json();
}

const deleteChatHistory = async (roomId: string) => {
    const response = await fetch(`${baseAPI}/messages/room/${roomId}`, {
        method: 'DELETE'
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return response.json();
}

const createGroup = async (groupData: { name: string, memberIds: string[], createdBy: string }) => {
    const response = await fetch(`${baseAPI}/groups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(groupData)
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json();
    return { ...data, id: data._id };
}

const updateParticipantSetting = async (
    conversationId: string, 
    userId: string, 
    data: { isPinned?: boolean, isMuted?: boolean, nickname?: string }
) => {
    const response = await fetch(`${baseAPI}/conversations/${conversationId}/setting`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, ...data })
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const json = await response.json();
    return { ...json, id: json._id };
}

export {
    getConversation,
    getMessages,
    sendMessage,
    getUsers,
    deleteChatHistory,
    createGroup,
    updateParticipantSetting
}