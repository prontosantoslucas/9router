const notificationsQueue = [];

/**
 * Notificador de eventos autônomos no background.
 */
function sendProactiveNotification(title, message, channel = "web") {
  const notification = {
    id: Date.now().toString(),
    title,
    message,
    channel,
    timestamp: Date.now(),
    read: false,
  };

  notificationsQueue.push(notification);
  console.log(`[ProactiveNotifier] Notificação emitida (${channel}): ${title} - ${message}`);
  return notification;
}

function getUnreadNotifications() {
  return notificationsQueue.filter((n) => !n.read);
}

module.exports = {
  sendProactiveNotification,
  getUnreadNotifications,
};
