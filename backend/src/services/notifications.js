const webpush = require('web-push');
const { prisma } = require('../db');

// Ensure VAPID keys are configured via environment variables only
// ⚠️ SECURITY: Do NOT hardcode VAPID keys here — set PUBLIC_VAPID_KEY and PRIVATE_VAPID_KEY in .env
if (!process.env.PUBLIC_VAPID_KEY || !process.env.PRIVATE_VAPID_KEY) {
  console.error('[PUSH] ⚠️  WARNING: VAPID keys are missing from environment variables.');
  console.error('[PUSH]     Set PUBLIC_VAPID_KEY and PRIVATE_VAPID_KEY in your .env file.');
  console.error('[PUSH]     Push notifications will be DISABLED until keys are configured.');
} else {
  webpush.setVapidDetails(
    'mailto:m.gh.alosimi@gmail.com',
    process.env.PUBLIC_VAPID_KEY,
    process.env.PRIVATE_VAPID_KEY
  );
}

// Active SSE client streams
let sseClients = [];

function getSseClients() {
  return sseClients;
}

function setSseClients(newClients) {
  sseClients = newClients;
}

// Helper function to broadcast update to all connected SSE clients
function broadcastSSE(type, data) {
  console.log(`[SSE] Broadcasting event of type "${type}" to ${sseClients.length} clients...`);
  sseClients.forEach(client => {
    client.res.write(`data: ${JSON.stringify({ type, data })}\n\n`);
  });
}

// Helper to send push notifications to students/admins of a specific group
async function sendPushNotification(groupId, payload) {
  console.log(`[PUSH] Dispatching push notification to group ${groupId || 'ALL'}...`);
  try {
    let subscriptions = [];
    if (groupId) {
      subscriptions = await prisma.pushSubscription.findMany({
        where: {
          student: { groupId: parseInt(groupId) }
        }
      });
    } else {
      subscriptions = await prisma.pushSubscription.findMany();
    }

    console.log(`[PUSH] Found ${subscriptions.length} active subscription(s) to notify.`);

    const sendPromises = subscriptions.map(async (sub) => {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth
        }
      };

      return webpush.sendNotification(pushSubscription, JSON.stringify(payload))
        .catch(async (err) => {
          console.warn(`[PUSH] Failed sending to endpoint ${sub.endpoint}:`, err.message);
          if (err.statusCode === 404 || err.statusCode === 410) {
            console.log(`[PUSH] Deleting expired subscription for endpoint: ${sub.endpoint}`);
            await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
          }
        });
    });

    await Promise.all(sendPromises);
    console.log('[PUSH] All notifications processed.');
  } catch (err) {
    console.error('[PUSH] Error dispatching push notifications:', err);
  }
}

// Helper to send push notifications to a single student
async function sendStudentPushNotification(studentId, payload) {
  console.log(`[PUSH] Dispatching push notification to student ${studentId}...`);
  try {
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { studentId: parseInt(studentId) }
    });

    console.log(`[PUSH] Found ${subscriptions.length} subscription(s) for student.`);

    const sendPromises = subscriptions.map(async (sub) => {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth
        }
      };

      return webpush.sendNotification(pushSubscription, JSON.stringify(payload))
        .catch(async (err) => {
          console.warn(`[PUSH] Failed sending to endpoint ${sub.endpoint}:`, err.message);
          if (err.statusCode === 404 || err.statusCode === 410) {
            console.log(`[PUSH] Deleting expired subscription for endpoint: ${sub.endpoint}`);
            await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
          }
        });
    });

    await Promise.all(sendPromises);
  } catch (err) {
    console.error('[PUSH] Error dispatching push to student:', err);
  }
}

module.exports = {
  getSseClients,
  setSseClients,
  broadcastSSE,
  sendPushNotification,
  sendStudentPushNotification
};
