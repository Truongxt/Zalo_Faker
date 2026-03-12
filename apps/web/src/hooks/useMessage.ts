import { useState, useEffect } from "react";
import { getMessages } from "../services/api";

const useMessage = (conversationId: string) => {
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<any>(null);

    useEffect(() => {
        if (!conversationId) return
        const fetchMessages = async () => {
            try {
                const data = await getMessages(conversationId);
                setMessages(data);
            } catch (error) {
                setError(error);
            } finally {
                setLoading(false);
            }
        };
        fetchMessages();
    }, [conversationId]);

    return { messages, loading, error };
}

export default useMessage;