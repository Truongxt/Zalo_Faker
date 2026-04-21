export const notificationService = {
  async requestPermission() {
    if (!("Notification" in window)) {
      console.warn("This browser does not support desktop notification");
      return false;
    }

    if (Notification.permission === "granted") {
      return true;
    }

    if (Notification.permission !== "denied") {
      const permission = await Notification.requestPermission();
      return permission === "granted";
    }

    return false;
  },

  async showNotification(title: string, body: string, icon?: string) {
    const hasPermission = await this.requestPermission();
    if (!hasPermission) return;

    return new Notification(title, {
      body,
      icon: icon || "/favicon.ico",
    });
  },
};
