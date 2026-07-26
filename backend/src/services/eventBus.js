const EventEmitter = require('events');

class ERPEventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50);
  }

  /**
   * Publishes an ERP event asynchronously.
   * @param {string} eventName - e.g. 'SCHEDULE_UPDATED', 'ATTENDANCE_RECORDED'
   * @param {object} payload - Event context metadata
   */
  publish(eventName, payload = {}) {
    const event = {
      event: eventName,
      timestamp: new Date().toISOString(),
      payload
    };

    console.log(`[EVENT_BUS] 📡 Event Published: [${eventName}]`, {
      entity: payload.entity || 'UNKNOWN',
      entityId: payload.entityId || null,
      userEmail: payload.userEmail || 'SYSTEM'
    });

    setImmediate(() => {
      try {
        this.emit(eventName, event);
        this.emit('*', event); // Wildcard listener for system logging
      } catch (err) {
        console.error(`[EVENT_BUS] Error handling event [${eventName}]:`, err.message);
      }
    });
  }

  /**
   * Subscribes a handler function to an ERP event.
   * @param {string} eventName
   * @param {function} handler
   */
  subscribe(eventName, handler) {
    this.on(eventName, handler);
  }
}

// Global Event Bus Singleton Instance
const eventBus = new ERPEventBus();

/**
 * Initializes default system listeners for Audit, Notification, and Analytics decoupling.
 */
function initializeDefaultListeners() {
  console.log('[EVENT_BUS] Initializing default system listeners...');
  const { sendNotification } = require('./notificationEngine');

  // 1. Audit Listener: Capture high-level system events
  eventBus.subscribe('SCHEDULE_UPDATED', (evt) => {
    console.log(`[EVENT_BUS -> AUDIT] Schedule ${evt.payload.entityId || ''} updated.`);
    if (evt.payload.groupId) {
      sendNotification({
        templateKey: 'SCHEDULE_CHANGED',
        templateData: evt.payload,
        groupId: evt.payload.groupId,
        channels: ['PUSH', 'INTERNAL']
      }).catch(e => console.warn('[EVENT_BUS] Schedule notification failed:', e.message));
    }
  });

  eventBus.subscribe('ATTENDANCE_RECORDED', (evt) => {
    console.log(`[EVENT_BUS -> ANALYTICS] Attendance recorded for Schedule ${evt.payload.scheduleId || ''}.`);
  });

  eventBus.subscribe('RESCHEDULE_REQUESTED', (evt) => {
    console.log(`[EVENT_BUS -> NOTIFICATION] Reschedule request submitted by Lecturer ${evt.payload.lecturerId || ''}.`);
  });
}

module.exports = {
  eventBus,
  initializeDefaultListeners
};
