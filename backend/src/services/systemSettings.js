const fs = require('fs');
const path = require('path');

const SETTINGS_FILE = path.join(__dirname, '../../system_settings.json');

const defaultSettings = {
  debugMode: false,
  maintenanceMode: false,
  verboseLogging: false,
  disableAttendance: false,
  disableExams: false,
  disableLibrary: false,
  disableMap: false,
  disableSchedules: false,
  deactivatedColleges: []
};

let settings = { ...defaultSettings };

// Load settings from file on startup
try {
  if (fs.existsSync(SETTINGS_FILE)) {
    const data = fs.readFileSync(SETTINGS_FILE, 'utf8');
    settings = { ...defaultSettings, ...JSON.parse(data) };
    console.log('[SYSTEM SETTINGS] Loaded configuration from file:', settings);
  } else {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8');
    console.log('[SYSTEM SETTINGS] Created default configuration file.');
  }
} catch (err) {
  console.warn('[SYSTEM SETTINGS] Failed to load/save settings file:', err.message);
}

function get(key) {
  return settings[key];
}

function getAll() {
  return { ...settings };
}

function set(key, value) {
  settings[key] = value;
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8');
    console.log(`[SYSTEM SETTINGS] Updated settings: ${key} = ${value}`);
  } catch (err) {
    console.warn('[SYSTEM SETTINGS] Failed to write settings file:', err.message);
  }
}

module.exports = {
  get,
  getAll,
  set
};
