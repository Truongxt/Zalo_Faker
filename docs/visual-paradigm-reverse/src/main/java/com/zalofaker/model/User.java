package com.zalofaker.model;

import java.util.List;

public class User {
    public String userId;
    public String userName;
    public String email;
    public String phone;
    public String accountStatus;
    public String presenceStatus;
    public String avatarUrl;
    public String birthday;
    public String gender;
    public String hiddenChatPin;
    public String lastActiveAt;
    public String password;

    public List<Participant> participations;
    public List<Message> sentMessages;
    public List<Friendship> outgoingFriendships;
    public List<Friendship> incomingFriendships;
    public List<Moment> moments;
    public List<MomentComment> momentComments;
    public List<MomentReaction> momentReactions;
    public List<Label> labels;
    public List<RefreshToken> refreshTokens;
    public List<LoginHistory> loginHistories;
    public List<AIChatHistory> aiChatHistories;
    public List<AIChatMessage> aiChatMessages;
}
