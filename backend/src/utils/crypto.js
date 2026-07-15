const crypto = require('crypto');

const ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'manar-schedule-system-super-secret-key-32'; // Fallback key (needs to be 32 bytes)
const IV_LENGTH = 16;

/**
 * Encrypts cleartext using AES-256-CBC.
 * @param {string} text 
 * @returns {string} Encrypted text in "iv:encrypted" hex format
 */
function encrypt(text) {
  if (!text) return '';
  const keyBuffer = Buffer.from(ENCRYPTION_KEY.padEnd(32).substring(0, 32));
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

/**
 * Decrypts encrypted text in "iv:encrypted" hex format.
 * @param {string} text 
 * @returns {string} Decrypted cleartext
 */
function decrypt(text) {
  if (!text) return '';
  try {
    const keyBuffer = Buffer.from(ENCRYPTION_KEY.padEnd(32).substring(0, 32));
    const textParts = text.split(':');
    if (textParts.length < 2) return '';
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, keyBuffer, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('[CRYPTO] Decryption failed:', err.message);
    return '';
  }
}

module.exports = {
  encrypt,
  decrypt
};
