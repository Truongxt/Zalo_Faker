class friendsModel {

    constructor({userId, friendId, status, createdAt}) {
        this.userId = userId;
        this.friendId = friendId;
        this.status = status || "pending";
        this.createdAt = createdAt || new Date().toISOString();
    }
}
