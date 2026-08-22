const fs = require('fs');
const path = require('path');

const LTM_FILE_PATH = path.join(__dirname, 'memory_ltm.json');

// ===============================
// Long-Term Memory Storage
// ===============================

if (!fs.existsSync(LTM_FILE_PATH)) {
  fs.writeFileSync(
    LTM_FILE_PATH,
    JSON.stringify([], null, 2),
    'utf-8'
  );
}

// ===============================
// Short-Term Memory
// ===============================

class ShortTermMemory {
  constructor(maxDialogItems = 10, windowMinutes = 15) {
    this.maxDialogItems = maxDialogItems;
    this.windowMs = windowMinutes * 60 * 1000;

    this.recentAlerts = [];
    this.dialogContext = [];
  }

  // Add intercepted SMS / security activity
  addAlert(alertData) {
    const record = {
      ...alertData,
      memory_timestamp: Date.now(),
    };

    this.recentAlerts.unshift(record);

    this.cleanupExpiredAlerts();
  }

  // Remove alerts older than the STM time window
  cleanupExpiredAlerts() {
    const now = Date.now();

    this.recentAlerts = this.recentAlerts.filter(
      (alert) =>
        now - alert.memory_timestamp <= this.windowMs
    );
  }

  // Get recent SMS/security activity
  getRecentSummary() {
    this.cleanupExpiredAlerts();

    if (this.recentAlerts.length === 0) {
      return 'No recent SMS or security activity.';
    }

    return this.recentAlerts
      .map(
        (a, i) =>
          `[Recent ${i + 1}]
Time: ${a.timestamp}
Sender: ${a.sender}
Account: ${a.detected_account}
Reason: ${a.reason}
Message: ${a.text}`
      )
      .join('\n\n');
  }

  getRecentScamAlerts() {
  this.cleanupExpiredAlerts();

  return this.recentAlerts.filter(
    (alert) => alert.is_scam === true
  );
}

  // Add conversation message
  addDialog(role, text) {
    this.dialogContext.push({
      role,
      text,
      timestamp: new Date().toISOString(),
    });

    if (this.dialogContext.length > this.maxDialogItems) {
      this.dialogContext.shift();
    }
  }

  // Get recent conversation context
  getDialogContext() {
    if (this.dialogContext.length === 0) {
      return 'No previous conversation.';
    }

    return this.dialogContext
      .map(
        (message) =>
          `${message.role}: ${message.text}`
      )
      .join('\n');
  }
}

// ===============================
// Long-Term Memory
// ===============================

class LongTermMemory {

  static saveIncident(incident) {
    try {
      const data = JSON.parse(
        fs.readFileSync(LTM_FILE_PATH, 'utf-8') || '[]'
      );

      const newRecord = {
        id: `INC-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}`,
        saved_at: new Date().toISOString(),
        ...incident,
      };

      data.unshift(newRecord);

      fs.writeFileSync(
        LTM_FILE_PATH,
        JSON.stringify(data, null, 2),
        'utf-8'
      );

      console.log(
        `💾 [LTM] Incident archived: ${newRecord.id}`
      );

      return newRecord;

    } catch (err) {
      console.error('🔥 Error saving to LTM:', err);
      return null;
    }
  }

  static getAllIncidents() {
    try {
      return JSON.parse(
        fs.readFileSync(LTM_FILE_PATH, 'utf-8') || '[]'
      );
    } catch (err) {
      console.error('🔥 Error reading LTM:', err);
      return [];
    }
  }

static getRecentScamHistory(limit = 10) {
  const all = this.getAllIncidents();

  return all
    .sort(
      (a, b) =>
        new Date(b.saved_at) - new Date(a.saved_at)
    )
    .slice(0, limit);
}

  static searchIncidents(keyword) {
    const all = this.getAllIncidents();

    if (!keyword) {
      return all;
    }

    const lower = keyword.toLowerCase();

    return all.filter((item) =>
      (item.text &&
        item.text.toLowerCase().includes(lower)) ||

      (item.detected_account &&
        item.detected_account
          .toLowerCase()
          .includes(lower)) ||

      (item.sender &&
        item.sender
          .toLowerCase()
          .includes(lower)) ||

      (item.reason &&
        item.reason
          .toLowerCase()
          .includes(lower))
    );
  }
}

// ===============================
// Export Singleton Instances
// ===============================

const stmInstance = new ShortTermMemory(
  10, // maximum 10 conversation messages
  15  // 15-minute SMS memory window
);

module.exports = {
  STM: stmInstance,
  LTM: LongTermMemory,
};