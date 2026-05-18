package com.zalofaker.model;

import java.util.List;

public class MomentComment {
    public String momentId;
    public String commentId;
    public String userId;
    public String content;
    public String replyToCommentId;
    public String createdAt;
    public String updatedAt;

    public Moment moment;
    public User user;
    public MomentComment replyTo;
    public List<MomentComment> replies;
}
