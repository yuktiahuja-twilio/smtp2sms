// src/server.js
require('dotenv').config();
const { SMTPServer } = require('smtp-server');
const { simpleParser } = require('mailparser');
const twilio = require('twilio');
const { parsePhoneNumber } = require('libphonenumber-js');
const winston = require('winston');

// Logger setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => `${timestamp} [${level}] ${message}`)
  ),
  transports: [new winston.transports.Console()],
});

// Config
const PORT = process.env.SMTP_PORT || 8025;
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;
const DEFAULT_REGION = process.env.DEFAULT_REGION || 'US';

if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
  logger.error('Twilio credentials or phone number missing in environment variables.');
  process.exit(1);
}

const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

// Helper: Normalize phone number to E.164
function normalizePhoneNumber(raw, region = DEFAULT_REGION) {
  try {
    const phone = parsePhoneNumber(raw, region);
    if (phone && phone.isValid()) {
      return phone.number;
    }
    throw new Error('Invalid phone number');
  } catch (e) {
    logger.error(`Phone normalization failed for "${raw}": ${e.message}`);
    return null;
  }
}

// SMTP Server
const smtpServer = new SMTPServer({
  onData(stream, session, callback) {
    simpleParser(stream)
      .then(async (parsed) => {
        // Extract recipient
        const to = parsed.to && parsed.to.value && parsed.to.value[0];
        if (!to) {
          logger.error('No recipient found in email.');
          return callback(new Error('No recipient found.'));
        }
        const userPart = to.address.split('@')[0];
        const phoneNumber = normalizePhoneNumber(userPart);
        if (!phoneNumber) {
          return callback(new Error('Invalid phone number in recipient.'));
        }

        // SMS body
        const smsBody = parsed.text || parsed.html || '';
        if (!smsBody.trim()) {
          logger.error('Empty SMS body.');
          return callback(new Error('Empty SMS body.'));
        }

        // Send SMS
        try {
          const message = await client.messages.create({
            body: smsBody,
            from: TWILIO_PHONE_NUMBER,
            to: phoneNumber,
          });
          logger.info(`SMS sent to ${phoneNumber} (SID: ${message.sid})`);
          callback();
        } catch (err) {
          logger.error(`Twilio send failed: ${err.message}`);
          callback(new Error('Failed to send SMS via Twilio.'));
        }
      })
      .catch((err) => {
        logger.error(`Mail parsing failed: ${err.message}`);
        callback(new Error('Failed to parse email.'));
      });
  },
  disabledCommands: ['AUTH'], // For demo; add auth in production
  logger: false,
  authOptional: true,
});

smtpServer.listen(PORT, () => {
  logger.info(`SMTP-to-Twilio SMS gateway running on port ${PORT}`);
});
