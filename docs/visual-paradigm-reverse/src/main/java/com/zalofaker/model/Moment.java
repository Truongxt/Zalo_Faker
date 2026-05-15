package com.zalofaker.model;

import java.util.List;

public class Moment {
    public String momentId;
    public String authorId;
    public String content;
    public String createdAt;
    public String updatedAt;

    public User author;
    public List<MomentComment> comments;
    public List<MomentReaction> reactions;
}
