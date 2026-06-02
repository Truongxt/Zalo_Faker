const messageModel = require("../models/message");
const messageService = require("./messageService");
const conversationModel = require("../models/conversation");

const CHECK_INTERVAL_MS = 30 * 1000;

let timer = null;
let isRunning = false;

const isDueReminder = (message, nowMs) => {
  const reminder = message?.metadata?.reminder;
  if (!reminder || message?.metadata?.action !== "reminder") return false;
  if (reminder.notifiedAt) return false;

  const dueMs = new Date(reminder.scheduledAt).getTime();
  return Number.isFinite(dueMs) && dueMs <= nowMs;
};

const buildReminderDueText = (reminder) => {
  const title = String(reminder?.title || "Nhắc hẹn").trim();
  const note = String(reminder?.note || "").trim();
  return `⏰ Đến giờ nhắc hẹn: ${title}${note ? `\n${note}` : ""}`;
};

const markReminderNotified = async (message) => {
  const metadata = {
    ...(message.metadata || {}),
    reminder: {
      ...(message.metadata?.reminder || {}),
      notifiedAt: new Date().toISOString(),
    },
  };

  await messageModel.updateMessage(message._id || message.id, { metadata });
};

const emitConversationMessage = (io, message) => {
  if (!io || !message?.conversationId) return;

  const normalized = { ...message, id: message._id || message.id };
  io.to(`conv:${message.conversationId}`).emit("chat:message", normalized);
  io.to(message.conversationId).emit("chat:message", normalized);
};

const processDueReminders = async (io) => {
  if (isRunning) return;
  isRunning = true;

  try {
    const nowMs = Date.now();
    const messages = await messageModel.getMessages();
    const dueReminders = (messages || []).filter((message) => isDueReminder(message, nowMs));

    for (const reminderMessage of dueReminders) {
      const reminder = reminderMessage.metadata.reminder;
      const conversationId = reminderMessage.conversationId;

      const dueMessage = await messageService.createMessage({
        conversationId,
        senderId: reminder.createdByUserId || reminderMessage.senderId,
        type: "system",
        content: { text: buildReminderDueText(reminder) },
        metadata: {
          action: "reminder_due",
          reminder: {
            title: reminder.title || "",
            note: reminder.note || "",
            scheduledAt: reminder.scheduledAt,
            sourceMessageId: reminderMessage._id || reminderMessage.id,
          },
        },
      });

      await markReminderNotified(reminderMessage);

      await conversationModel.updateConversation(conversationId, {
        lastMessage: {
          content: buildReminderDueText(reminder),
          type: "system",
          senderId: dueMessage.senderId,
          timestamp: dueMessage.createdAt,
        },
      });

      emitConversationMessage(io, dueMessage);
    }
  } catch (error) {
    console.error("Reminder scheduler error:", error);
  } finally {
    isRunning = false;
  }
};

const startReminderScheduler = (io) => {
  if (timer) return;

  timer = setInterval(() => {
    processDueReminders(io);
  }, CHECK_INTERVAL_MS);

  processDueReminders(io);
};

module.exports = {
  startReminderScheduler,
  processDueReminders,
};
