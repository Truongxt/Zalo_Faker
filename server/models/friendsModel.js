class friendsModel {

    constructor({fromUserId, toUserId, status, createdAt}) {
        this.fromUserId = fromUserId;
        this.toUserId = toUserId;
        this.status = status || "pending";
        this.createdAt = createdAt || new Date().toISOString();
    }
}
