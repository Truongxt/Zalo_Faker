package com.zalofaker.model;

public class AIChatMessage {
    public String conversationId;
    public String chatId;
    public String userId;
    public String question;
    public String answer;
    public String askedAt;

    public Conversation conversation;
    public User user;
}
