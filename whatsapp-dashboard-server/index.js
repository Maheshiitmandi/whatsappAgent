// server/index.js
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const csv = require('csv-parser');
const { spawn } = require('child_process');
const { connectToWhatsapp } = require('./bot/auth_bot.js')
const { dataLoad } = require('./bot/bot11.js')
const { appointment } = require('./bot/appointment_bot.js')

require('dotenv').config(); // if using .env
const axios = require('axios');

const app = express();
const PORT = 5000;

// Paths
const uploadsDir = path.join(__dirname, 'uploads');
const qrStatusPath = path.join(uploadsDir, 'qr_status.json');
const messagePath = path.join(uploadsDir, 'message.txt');
const recipientsPath = path.join(uploadsDir, 'recipients.csv');
const responsesPath = path.join(uploadsDir, 'responses.csv');
const authPath = path.join(__dirname, 'bot', '.wwebjs_auth');
// Process handles
let authBotProcess = null;
let campaignBotProcess = null;
let appointmentBotProcess = null;


// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static('uploads'));
const upload = multer({ dest: 'uploads/' });

// Ensure uploads directory
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
let client
// ---------------------------------------------
// 🔵 AUTH BOT Management
// ---------------------------------------------
async function startAuthBot() {
  if (authBotProcess || client) return;
  client = await connectToWhatsapp();

  client.on('message', async msg => {
    appointment(msg)
  });
}

startAuthBot(); // Start auth bot immediately on server start

// ---------------------------------------------
// 📲 WhatsApp Status
// ---------------------------------------------
app.get('/api/whatsapp-status', (req, res) => {
  try {
    const data = fs.readFileSync(qrStatusPath, 'utf8');
    res.json(JSON.parse(data));
  } catch {
    res.json({ qr: null, connected: false });
  }
});

// ---------------------------------------------
// 🔴 Logout WhatsApp Session
// ---------------------------------------------
app.post('/api/logout-whatsapp', async (req, res) => {
  try {
    if (authBotProcess) {
      authBotProcess.kill('SIGINT');
      console.log('🛑 AuthBot process killed');
      await new Promise(resolve => setTimeout(resolve, 1500));
      authBotProcess = null;
    }

    if (fs.existsSync(authPath)) {
      fs.rmSync(authPath, { recursive: true, force: true });
      console.log('🧹 Auth folder deleted');
    } else {
      console.log('⚠️ No auth folder found');
    }

    fs.writeFileSync(qrStatusPath, JSON.stringify({ qr: null, connected: false }));

    startAuthBot();

    res.sendStatus(200);
  } catch (err) {
    console.error('❌ Error during logout:', err);
    res.status(500).send('Error');
  }
});

// ---------------------------------------------
// 🚀 Start Campaign
// ---------------------------------------------

async function startCampaignBot() {

  if (!client) return
  await dataLoad(client);

}


app.post('/api/start-campaign',async (req, res) => {
  try {
    const status = fs.existsSync(qrStatusPath) ? JSON.parse(fs.readFileSync(qrStatusPath, 'utf8')) : null;
    if (!status || !status.connected) {
      return res.status(400).send('❌ WhatsApp not authorized. Please scan QR.');
    }

    // NEW: Validate recipients
    if (!fs.existsSync(recipientsPath)) {
      return res.status(400).send('❌ Recipients file not found.');
    }
    const recipientFile = fs.readFileSync(recipientsPath, 'utf-8').trim();
    if (!recipientFile || recipientFile.split('\n').length <= 1) {
      return res.status(400).send('❌ Recipients file is empty or incomplete.');
    }

    // NEW: Validate message
    if (!fs.existsSync(messagePath)) {
      return res.status(400).send('❌ Message file not found.');
    }

    await startCampaignBot();

    res.send('✅ Campaign started successfully!');

  } catch (err) {
    console.error('❌ Error starting campaign:', err);
    res.status(500).send('Error');
  }
});


// ---------------------------------------------
// 🛑 Stop Campaign
// ---------------------------------------------
app.post('/api/stop-campaign', (req, res) => {
  if (!campaignBotProcess) {
    return res.status(400).send('⚠️ No campaign currently running');
  }

  campaignBotProcess.kill('SIGINT');
  campaignBotProcess = null;
  console.log('🛑 Campaign manually stopped');
  res.send('🛑 Campaign stopped successfully');
});

// ---------------------------------------------
// 🧹 Clear Responses
// ---------------------------------------------
app.post('/api/clear-responses', (req, res) => {
  if (fs.existsSync(responsesPath)) {
    fs.unlinkSync(responsesPath);
    console.log('🧹 responses.csv cleared');
  }
  res.sendStatus(200);
});

// ---------------------------------------------
// 📥 Uploads / Downloads
// ---------------------------------------------
app.get('/api/message', (req, res) => {
  const msg = fs.existsSync(messagePath) ? fs.readFileSync(messagePath, 'utf-8') : '';
  res.send(msg);
});

app.post('/api/message', (req, res) => {
  fs.writeFileSync(messagePath, req.body.message || '');
  res.sendStatus(200);
});

app.post('/api/upload-recipients', upload.single('file'), (req, res) => {
  fs.renameSync(req.file.path, recipientsPath);
  res.sendStatus(200);
});

app.post('/api/upload-media', upload.single('file'), (req, res) => {
  const ext = path.extname(req.file.originalname);
  const targetPath = path.join(uploadsDir, 'media' + ext);
  fs.renameSync(req.file.path, targetPath);
  res.sendStatus(200);
});

app.get('/api/recipients', (req, res) => {
  const results = [];
  if (!fs.existsSync(recipientsPath)) return res.json([]);
  fs.createReadStream(recipientsPath)
    .pipe(csv())
    .on('data', data => results.push(data))
    .on('end', () => res.json(results));
});

app.get('/api/responses-json', (req, res) => {
  const results = [];
  if (!fs.existsSync(responsesPath)) return res.json([]);
  fs.createReadStream(responsesPath)
    .pipe(csv())
    .on('data', data => results.push(data))
    .on('end', () => res.json(results));
});

app.post('/api/add-recipient', (req, res) => {
  const { name, phone } = req.body;
  if (!name || !phone) return res.status(400).send('Name and phone required');

  const line = `${name},${phone},\n`;
  const hasHeader = fs.existsSync(recipientsPath) && fs.readFileSync(recipientsPath, 'utf8').startsWith('name,phone');

  if (!fs.existsSync(recipientsPath) || !hasHeader) {
    fs.writeFileSync(recipientsPath, 'name,phone,sent\n');
  }

  fs.appendFileSync(recipientsPath, line);
  res.sendStatus(200);
});


app.post('/api/cancel-token', (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).send('Phone required');

  const lines = fs.readFileSync(recipientsPath, 'utf-8').split('\n');
  const headers = lines[0].split(',');
  const idx = headers.reduce((a, k, i) => (a[k] = i, a), {});
  
  const updated = lines.map((line, i) => {
    if (i === 0 || !line) return line;
    const cols = line.split(',');
    if (cols[idx['phone']] === phone) {
      cols[idx['cancelled']] = 'Yes';
    }
    return cols.join(',');
  });

  fs.writeFileSync(recipientsPath, updated.join('\n'));
  res.sendStatus(200);
});

app.post('/api/start-appointment-bot', (req, res) => {
  try {
    res.send('✅ Appointment bot started');
  } catch (err) {
    console.error('❌ Failed to start appointment bot:', err);
    res.status(500).send('Failed to start appointment bot');
  }
});


const cron = require('node-cron');

cron.schedule('0 0 * * *', () => {
  console.log('🔁 Resetting token and cancellation status at midnight');
  const lines = fs.readFileSync(recipientsPath, 'utf-8').split('\n');
  const headers = lines[0].split(',');
  const idx = headers.reduce((a, k, i) => (a[k] = i, a), {});
  
  const updated = lines.map((line, i) => {
    if (i === 0 || !line) return line;
    const cols = line.split(',');
    cols[idx['token']] = '';
    cols[idx['cancelled']] = '';
    cols[idx['sent']] = '';
    return cols.join(',');
  });

  fs.writeFileSync(recipientsPath, updated.join('\n'));
});

// ---------------------------------------------
app.post('/api/meta-ai-chat', express.json(), async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).send({ reply: '❌ Empty prompt' });

  try {
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'mistralai/mistral-7b-instruct', // or meta-llama/llama-3-8b-instruct
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: prompt }
        ],
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:5000', // required by OpenRouter
          'X-Title': 'Rooter Dashboard AI'
        }
      }
    );

    const reply = response.data.choices[0].message.content;
    res.send({ reply });
  } catch (err) {
    console.error('❌ OpenRouter API error:', err.response?.data || err.message);
    res.status(500).send({ reply: '❌ Failed to get response from OpenRouter' });
  }
});
// ---------------------------------------------

app.get('/api/appointments', (req, res) => {
  const results = [];
  const filePath = path.join(__dirname, 'uploads', 'appointment.csv');
  if (!fs.existsSync(filePath)) return res.json([]);
  fs.createReadStream(filePath)
    .pipe(csv())
    .on('data', data => results.push(data))
    .on('end', () => res.json(results));
});
// ---------------------------------------------

const loadRecipients = () => {
  return new Promise((resolve, reject) => {
    const rows = [];
    if (!fs.existsSync(recipientsPath)) {
      fs.writeFileSync(recipientsPath, 'name,phone,sent\n');
      return resolve(rows);
    }

    fs.createReadStream(recipientsPath)
      .pipe(csv())
      .on('data', row => {
        rows.push({
          name: row.name || 'User',
          phone: row.phone,
          sent: (row.sent || '').toLowerCase() === 'yes'
        });
      })
      .on('end', () => resolve(rows))
      .on('error', reject);
  });
};

const updateRecipientsCSV = (updatedRows) => {
  const headers = ['name', 'phone', 'sent'];
  const csvLines = [headers.join(',')];
  updatedRows.forEach(r => {
    csvLines.push([
      r.name,
      r.phone,
      r.sent ? 'Yes' : ''
    ].join(','));
  });
  fs.writeFileSync(recipientsPath, csvLines.join('\n'));
};


app.post('/api/clear-sent', async (req, res) => {
  const { phones } = req.body;
  let recipients = await loadRecipients();  // ← This will fail if undefined
  recipients.forEach(r => {
    if (phones.includes(r.phone)) {
      r.sent = false;
    }
  });
  await updateRecipientsCSV(recipients);    // ← This will also fail
  res.sendStatus(200);
});
// ---------------------------------------------


app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));