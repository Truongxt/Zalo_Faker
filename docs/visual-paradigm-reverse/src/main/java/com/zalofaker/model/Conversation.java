package com.zalofaker.model;

import java.util.List;

public class Conversation {
    public String id;
    public String type;
    public String name;
    public String createdBy;
    public String createdAt;

    public List<Participant> participants;
    public List<Message> messages;
    public List<AIChatHistory> aiChatHistories;
    public List<AIChatMessage> aiChatMessages;
}
