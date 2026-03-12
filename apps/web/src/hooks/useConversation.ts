import { useState, useEffect } from "react";
import { getConversation } from "../services/api";

const useConversation = () => {
    const [conversations, setConversations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<any>(null);

    useEffect(() => {
        const fetchConversations = async () => {
            try {
                const data = await getConversation();
                setConversations(data);
            } catch (error) {
                setError(error);
            } finally {
                setLoading(false);
            }
        };
        fetchConversations();
    }, []);

    return { conversations, loading, error };
}

export default useConversation;