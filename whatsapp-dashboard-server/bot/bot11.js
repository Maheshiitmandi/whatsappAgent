// server/bot/bot11.js
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const puppeteer = require('puppeteer');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const { createObjectCsvWriter } = require('csv-writer');

// Global error handlers
process.on('unhandledRejection', (reason) => {
  console.error('🔴 Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('🔴 Uncaught Exception:', err);
});

// Paths
const uploadsDir = path.join(__dirname, '../uploads');
const RECIPIENTS_FILE = path.join(uploadsDir, 'recipients.csv');
const RESPONSES_FILE = path.join(uploadsDir, 'responses.csv');
const MESSAGE_FILE = path.join(uploadsDir, 'message.txt');

let MESSAGE_TEXT = '';
let mediaToSend = null;
let recipients = [];

// Load message
function readMessage(){
  try {
    MESSAGE_TEXT = fs.readFileSync(MESSAGE_FILE, 'utf-8').trim();
    console.log("💬 Loaded message text");
  } catch {
    console.error(`❌ Could not load message from ${MESSAGE_FILE}`);
  }
}

function readMedia() {
  try {
    const mediaFile = fs.readdirSync(uploadsDir).find(file =>
      file.startsWith('media') && ['.png', '.jpg', '.jpeg', '.pdf', '.mp4'].includes(path.extname(file))
    );
    if (mediaFile) {
      mediaToSend = MessageMedia.fromFilePath(path.join(uploadsDir, mediaFile));
      console.log(`🖼 Loaded media: ${mediaFile}`);
    }
  } catch (e) {
    console.warn(`⚠️ Failed to load media: ${e.message}`);
  }
}



async function dataLoad(client) {
  try {
    readMessage();
    readMedia();

    recipients = await loadRecipients();
    let tokenCounter = 1;

    for (const recipient of recipients) {
      console.log('🔎 Checking recipient:', recipient.phone, 'Sent:', recipient.sent, 'Cancelled:', recipient.cancelled);

      if (recipient.sent || recipient.cancelled) continue;

      const chatId = recipient.phone.replace('+', '') + '@c.us';
      console.log('🔗 Checking if registered:', chatId);

      try {
        const isRegistered = await client.isRegisteredUser(chatId);
        if (!isRegistered) {
          console.log(`❌ ${recipient.phone} not registered`);
          continue;
        }

        // Assign token
        recipient.token = tokenCounter++;

        const fullMessage = `Hi ${recipient.name},\n${MESSAGE_TEXT}\n\n🪪 Your appointment token is: ${recipient.token}\n\nPlease reply with:\n1️⃣ Yes\n2️⃣ No`;

        if (mediaToSend) {
          await client.sendMessage(chatId, mediaToSend, { caption: fullMessage });
        } else {
          await client.sendMessage(chatId, fullMessage);
        }

        console.log(`📨 Sent to ${recipient.phone}`);
        recipient.sent = true;

        await new Promise(resolve => setTimeout(resolve, 2000)); // Optional delay
      } catch (err) {
        console.error(`❌ Error sending to ${recipient.phone}: ${err.message}`);
      }
    }

    await updateRecipientsCSV(recipients);
    console.log('✅ Campaign completed. Closing bot...');
    // process.exit(0);
  } catch (error) {
    console.error('❌ Error during campaign execution:', error);
    process.exit(1);
  }
}



// Load recipients
async function loadRecipients() {
  return new Promise((resolve, reject) => {
    const rows = [];
    fs.createReadStream(RECIPIENTS_FILE)
      .pipe(csv())
      .on('data', row => {
        if (!row.phone || row.phone.trim() === '') return;
        rows.push({
          name: row.name?.trim() || '',
          phone: row.phone.replace(/[^0-9+]/g, ''),
          sent: (row.sent || '').trim().toLowerCase() === 'yes',
          token: parseInt(row.token || 0, 10),
          cancelled: (row.cancelled || '').trim().toLowerCase() === 'yes'
        });
      })
      .on('end', () => {
        console.log(`📦 Loaded ${rows.length} recipients`);
        resolve(rows);
      })
      .on('error', reject);
  });
}

// Update recipients
function updateRecipientsCSV(updatedRows) {
  const writer = createObjectCsvWriter({
    path: RECIPIENTS_FILE,
    header: [
      { id: 'name', title: 'name' },
      { id: 'phone', title: 'phone' },
      { id: 'sent', title: 'sent' },
      { id: 'token', title: 'token' },
      { id: 'cancelled', title: 'cancelled' }
    ]
  });
  return writer.writeRecords(updatedRows.map(r => ({
    name: r.name,
    phone: r.phone,
    sent: r.sent ? 'Yes' : ''
  })));
}

// Save response (if needed later)
async function saveResponse(entry) {
  const writer = createObjectCsvWriter({
    path: RESPONSES_FILE,
    header: [
      { id: 'name', title: 'Name' },
      { id: 'phone', title: 'Phone' },
      { id: 'response', title: 'Response' },
      { id: 'timestamp', title: 'Timestamp' }
    ],
    append: fs.existsSync(RESPONSES_FILE)
  });

  await writer.writeRecords([{ ...entry, timestamp: new Date().toISOString() }]);
  console.log(`✅ Saved response from ${entry.phone}: ${entry.response}`);
}



module.exports = {
  dataLoad
}