package com.zalofaker.model;

import java.util.List;

public class Message {
    public String id;
    public String conversationId;
    public String senderId;
    public String type;
    public String content;
    public String createdAt;
    public String replyToMessageId;

    public Conversation conversation;
    public User sender;
    public Message replyTo;
    public List<Message> replies;
    public List<Reaction> reactions;
    public List<ReadReceipt> readReceipts;
}
