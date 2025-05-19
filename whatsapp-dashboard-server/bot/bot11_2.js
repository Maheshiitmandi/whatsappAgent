const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const chokidar = require('chokidar');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const { createObjectCsvWriter } = require('csv-writer');
// const qrcode = require('qrcode-terminal');
const qrcode = require('qrcode'); // Important to import this


const uploadsDir = path.join(__dirname, '../uploads');
const RECIPIENTS_FILE = path.join(uploadsDir, 'recipients.csv');
const RESPONSES_FILE = path.join(uploadsDir, 'responses.csv');
const MESSAGE_FILE = path.join(uploadsDir, 'message.txt');
const MEDIA_DIR = uploadsDir;
const DEBOUNCE_MS = 3000;

let MESSAGE_TEXT = '';
let mediaToSend = null;
let recipients = [];
let debounceTimer = null;

const qrStatusPath = path.join(__dirname, '../uploads/qr_status.json');



try {
  MESSAGE_TEXT = fs.readFileSync(MESSAGE_FILE, 'utf-8').trim();
  console.log("💬 Loaded message text");
} catch {
  console.error(`❌ Could not load message from ${MESSAGE_FILE}`);
  process.exit(1);
}

const mediaFile = fs.readdirSync(MEDIA_DIR).find(file =>
  file.startsWith('media') && ['.png', '.jpg', '.jpeg', '.pdf', '.mp4'].includes(path.extname(file))
);
if (mediaFile) {
  try {
    mediaToSend = MessageMedia.fromFilePath(path.join(MEDIA_DIR, mediaFile));
    console.log(`🖼 Loaded media from ${mediaFile}`);
  } catch (e) {
    console.warn(`⚠️ Failed to load media: ${e.message}`);
  }
}

function loadRecipients() {
  return new Promise((resolve, reject) => {
    const rows = [];
    fs.createReadStream(RECIPIENTS_FILE)
      .pipe(csv())
      .on('data', row => {
        console.log('📥 Raw row:', row);
        if (!row.phone || row.phone.trim() === '') return;
        rows.push({
          name: row.name?.trim() || '',
          phone: row.phone.replace(/[^0-9+]/g, ''),
          sent: (row.sent || '').trim().toLowerCase() === 'yes'
        });
      })
      .on('end', () => {
        console.log(`✅ Loaded ${rows.length} recipients`);
        resolve(rows);
      })
      .on('error', reject);
  });
}

function updateRecipientsCSV(updatedRows) {
  const writer = createObjectCsvWriter({
    path: RECIPIENTS_FILE,
    header: [
      { id: 'name', title: 'name' },
      { id: 'phone', title: 'phone' },
      { id: 'sent', title: 'sent' }
    ]
  });
  return writer.writeRecords(updatedRows.map(r => ({
    name: r.name,
    phone: r.phone,
    sent: r.sent ? 'Yes' : ''
  })));
}

const headers = [
  { id: 'name', title: 'Name' },
  { id: 'phone', title: 'Phone' },
  { id: 'response', title: 'Response' },
  { id: 'timestamp', title: 'Timestamp' }
];

const needsHeader = () => {
  if (!fs.existsSync(RESPONSES_FILE)) return true;
  const firstLine = fs.readFileSync(RESPONSES_FILE, 'utf8').split('\n')[0];
  return !headers.every(h => firstLine.includes(h.title));
};

async function saveResponse(entry) {
  const writer = createObjectCsvWriter({
    path: RESPONSES_FILE,
    header: headers,
    append: !needsHeader()
  });
  await writer.writeRecords([{
    ...entry,
    timestamp: new Date().toISOString()
  }]);
  console.log(`✅ Saved response from ${entry.phone}: ${entry.response}`);
}

function hasAlreadyResponded(phone) {
  if (!fs.existsSync(RESPONSES_FILE)) return false;
  const content = fs.readFileSync(RESPONSES_FILE, 'utf-8');
  return content.includes(phone.replace(/[^0-9]/g, ''));
}

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: { headless: true, args: ['--no-sandbox'], timeout: 60000 }
});

// client.on('qr', qr => {
//   console.log("📱 Scan the QR code to log in:");
//   qrcode.generate(qr, { small: true });
// });

let currentQR = null;
let isConnected = false;

function updateQRStatus(data) {
  fs.writeFileSync(qrStatusPath, JSON.stringify(data));
}



client.on('qr', qr => {
  console.log("📱 QR generated");

  qrcode.toDataURL(qr, (err, url) => {
    if (!err) {
      updateQRStatus({
        qr: url,
        connected: false
      });
      console.log('📝 QR code updated in qr_status.json');
    } else {
      console.error('❌ Error converting QR to base64:', err);
    }
  });
});


client.on('ready', async () => {
  console.log("✅ WhatsApp bot is ready!");
  updateQRStatus({ qr: null, connected: true });
  currentQR = null;
  isConnected = true;
  await processRecipients();

  chokidar.watch(RECIPIENTS_FILE).on('change', () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      console.log("🔄 recipients.csv updated, checking for new entries...");
      processRecipients();
    }, DEBOUNCE_MS);
  });
});

async function processRecipients() {
  recipients = await loadRecipients();
  console.log("📦 Recipients fetched:", recipients.length);

  for (let recipient of recipients) {
    console.log(`🔍 Checking: ${recipient.phone} | Sent: ${recipient.sent}`);
    if (recipient.sent) {
      console.log(`⏭ Skipping ${recipient.phone}`);
      continue;
    }

    const chatId = recipient.phone.replace('+', '') + "@c.us";
    try {
      const isRegistered = await client.isRegisteredUser(chatId);
      if (!isRegistered) {
        console.log(`❌ ${recipient.phone} is not on WhatsApp`);
        continue;
      }

      const fullMessage = `Hi ${recipient.name},\n${MESSAGE_TEXT}\n\nPlease reply with:\n1️⃣ Yes\n2️⃣ No`;

      if (mediaToSend) {
        await client.sendMessage(chatId, mediaToSend, { caption: fullMessage });
      } else {
        await client.sendMessage(chatId, fullMessage);
      }

      console.log(`📨 Sent to ${recipient.phone}`);
      recipient.sent = true;

    } catch (err) {
      console.error(`❌ Error sending to ${recipient.phone}: ${err.message}`);
    }
  }
  await updateRecipientsCSV(recipients);
}

client.on('message', async message => {
  const from = message.from;
  const body = message.body.trim().toLowerCase();
  const normalizedFrom = from.replace(/[^0-9]/g, '');

  console.log(`📩 Message from ${from}: ${body}`);

  const matched = recipients.find(r =>
    normalizedFrom.endsWith(r.phone.replace('+', '').replace(/\D/g, ''))
  );

  if (!matched) {
    console.log("❌ Ignoring unknown sender:", from);
    return;
  }

  if (["1", "yes"].includes(body)) {
    if (hasAlreadyResponded(matched.phone)) {
      await client.sendMessage(from, "🔁 You've already submitted your response. Thank you!");
      return;
    }
    await saveResponse({ name: matched.name, phone: matched.phone, response: 'YES' });
    await client.sendMessage(from, "✅ Thank you! Your response has been recorded.");

  } else if (["2", "no"].includes(body)) {
    if (hasAlreadyResponded(matched.phone)) {
      await client.sendMessage(from, "🔁 You've already submitted your response. Thank you!");
      return;
    }
    await saveResponse({ name: matched.name, phone: matched.phone, response: 'NO' });
    await client.sendMessage(from, "✅ Thank you! Your response has been recorded.");

  } else {
    await client.sendMessage(from, "❗Please reply with:\n1️⃣ for Yes\n2️⃣ for No");
  }
});

client.initialize();

