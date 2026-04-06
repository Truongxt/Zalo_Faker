const ACCOUNT_STATUSES = ["active", "locked", "deleted"];
const PRESENCE_STATUSES = ["online", "offline"];

class userModel {
    constructor({
        userId,
        avartarUrl,
        birthday,
        createdAt,
        email,
        gender,
        password,
        phone,
        status,
        accountStatus,
        presenceStatus,
        lastActiveAt,
        userName,
    }) {
        const normalizedAccountStatus = userModel.normalizeAccountStatus(accountStatus || status);
        const normalizedPresenceStatus = userModel.normalizePresenceStatus(presenceStatus);

        this.userId = userId;
        this.avartarUrl = avartarUrl || null;
        this.birthday = birthday || null;
        this.createdAt = createdAt || new Date().toISOString();
        this.email = email;
        this.gender = gender;
        this.password = password;
        this.phone = phone;

        // Account lifecycle status: active | locked | deleted
        this.accountStatus = normalizedAccountStatus;
        // Backward-compatible alias for older clients
        this.status = normalizedAccountStatus;

        // Presence status: online | offline
        this.presenceStatus = normalizedPresenceStatus;
        this.lastActiveAt = lastActiveAt || null;

        this.userName = userName;
    }

    static normalizeAccountStatus(value) {
        return ACCOUNT_STATUSES.includes(value) ? value : "active";
    }

    static normalizePresenceStatus(value) {
        return PRESENCE_STATUSES.includes(value) ? value : "offline";
    }

    getPresenceLabel(referenceDate = new Date()) {
        if (this.presenceStatus === "online") {
            return "Dang online";
        }

        if (!this.lastActiveAt) {
            return "Dang offline";
        }

        const diffMs = Math.max(0, referenceDate.getTime() - new Date(this.lastActiveAt).getTime());
        const minutes = Math.floor(diffMs / 60000);

        if (minutes < 1) return "Vua moi online";
        if (minutes < 60) return `Offline ${minutes} phut truoc`;

        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `Offline ${hours} gio truoc`;

        const days = Math.floor(hours / 24);
        return `Offline ${days} ngay truoc`;
    }
}

module.exports = userModel;