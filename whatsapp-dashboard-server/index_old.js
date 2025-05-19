const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const csv = require('csv-parser');
const qrStatusPath = path.join(__dirname, './uploads/qr_status.json');
const authPath = path.join(__dirname, '../.wwebjs_auth'); // or wherever your LocalAuth saves session

const app = express();
const PORT = 5000;
// Add this route just after defining `app`
app.get('/', (req, res) => {
  res.send('✅ WhatsApp backend is running');
});

app.use(cors());
app.use(express.json());
app.use(express.static('uploads'));

const upload = multer({ dest: 'uploads/' });

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

const messagePath = path.join(uploadsDir, 'message.txt');
const recipientsPath = path.join(uploadsDir, 'recipients.csv');
const responsesPath = path.join(uploadsDir, 'responses.csv');


app.get('/api/whatsapp-status', (req, res) => {
  try {
    const data = fs.readFileSync(qrStatusPath, 'utf8');
    const status = JSON.parse(data);
    res.json(status);
  } catch {
    res.json({ qr: null, connected: false });
  }
});

app.post('/api/logout-whatsapp', async (req, res) => {
  try {
    const authPath = path.join(__dirname, '../.wwebjs_auth');
    const qrStatusPath = path.join(__dirname, './uploads/qr_status.json');

    // 1. Kill bot
    if (botProcess) {
      botProcess.kill('SIGINT');
      botProcess = null;
      console.log('🛑 Bot process killed.');
    }

    // 2. Delete old auth
    if (fs.existsSync(authPath)) {
      fs.rmSync(authPath, { recursive: true, force: true });
      console.log('🧹 Old WhatsApp session deleted.');
    }

    // 3. Reset QR status
    fs.writeFileSync(qrStatusPath, JSON.stringify({ qr: null, connected: false }));

    // 4. Spawn fresh bot
    const { spawn } = require('child_process');
    botProcess = spawn('node', ['bot11.js'], { cwd: path.join(__dirname, 'bot') });

    botProcess.stdout.on('data', data => {
      console.log(`🟢 Bot: ${data.toString().trim()}`);
    });
    botProcess.stderr.on('data', data => {
      console.error(`🔴 Bot Error: ${data.toString().trim()}`);
    });
    botProcess.on('exit', code => {
      console.log(`🛑 Bot exited with code ${code}`);
      botProcess = null;
    });

    console.log('🚀 Spawned fresh bot after logout');
    res.sendStatus(200);

  } catch (err) {
    console.error('❌ Error during logout:', err);
    res.status(500).send('Error');
  }
});




app.post('/api/authorize-new-device', async (req, res) => {
  try {
    if (botProcess) {
      botProcess.kill('SIGINT');
      botProcess = null;
      console.log('🛑 Bot stopped for reauthorization');
    }
    if (fs.existsSync(authPath)) {
      fs.rmSync(authPath, { recursive: true, force: true });
      console.log('🧹 Cleared existing session for new authorization');
    }
    fs.writeFileSync(qrStatusPath, JSON.stringify({ qr: null, connected: false }));

    // Respawn bot
    startBot();
    res.sendStatus(200);
  } catch (err) {
    console.error('❌ Error starting new device authorization:', err);
    res.status(500).send('Error');
  }
});





// Routes
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

// app.post('/api/upload-media', upload.single('file'), (req, res) => {
//   const targetPath = path.join(uploadsDir, req.file.originalname);
//   fs.renameSync(req.file.path, targetPath);
//   res.sendStatus(200);
// });
app.post('/api/upload-media', upload.single('file'), (req, res) => {
  const ext = path.extname(req.file.originalname); // get .png, .jpg, etc
  const targetPath = path.join(uploadsDir, 'media' + ext); // save as media.png, media.jpg...

  fs.renameSync(req.file.path, targetPath);
  res.sendStatus(200);
});


app.get('/api/recipients', (req, res) => {
  const results = [];
  if (!fs.existsSync(recipientsPath)) return res.json([]);
  fs.createReadStream(recipientsPath)
    .pipe(csv())
    .on('data', data => {
      console.log("📥 Row:", data);
      results.push(data);
    })
    .on('end', () => {
      res.json(results);
    });
});


// app.get('/api/responses-json', (req, res) => {
//   const results = [];
//   if (!fs.existsSync(responsesPath)) return res.json([]);
//   fs.createReadStream(responsesPath)
//     .pipe(csv())
//     .on('data', data => results.push(data))
//     .on('end', () => res.json(results));
// });

// app.get('/api/responses-json', (req, res) => {
//   const results = [];
//   if (!fs.existsSync(responsesPath)) return res.json([]);
//   fs.createReadStream(responsesPath)
//     .pipe(csv())
//     .on('data', data => results.push(data))
//     .on('end', () => res.json(results));
// });

app.get('/api/responses-json', (req, res) => {
  const results = [];
  if (!fs.existsSync(responsesPath)) return res.json([]);
  fs.createReadStream(responsesPath)
    .pipe(csv())
    .on('data', data => results.push(data))
    .on('end', () => res.json(results));
});


// app.post('/api/start-campaign', (req, res) => {
//   const { exec } = require('child_process');
//   exec('node bot11.js', { cwd: path.join(__dirname, 'bot') });
//   res.sendStatus(200);
// });
// app.post('/api/start-campaign', (req, res) => {
//   const { exec } = require('child_process');
//   const botDir = path.join(__dirname, 'bot');

//   console.log("🚀 Running: node bot11.js from", botDir);

//   exec('node bot11.js', { cwd: botDir }, (err, stdout, stderr) => {
//     if (err) {
//       console.error("❌ Bot error:", err.message);
//       return res.status(500).send("Bot failed to run");
//     }
//     console.log("✅ Bot output:", stdout);
//     if (stderr) console.error("⚠️ stderr:", stderr);
//     res.sendStatus(200);
//   });
// });

app.post('/api/clear-responses', (req, res) => {
  if (fs.existsSync(responsesPath)) {
    fs.unlinkSync(responsesPath);
    console.log("🧹 responses.csv cleared");
  }
  res.sendStatus(200);
});

app.post('/api/add-recipient', (req, res) => {
  const { name, phone } = req.body;
  if (!name || !phone) return res.status(400).send("Name and phone required");

  const line = `${name},${phone},\n`;

  const hasHeader = fs.existsSync(recipientsPath) &&
    fs.readFileSync(recipientsPath, 'utf8').startsWith('name,phone');

  if (!fs.existsSync(recipientsPath) || !hasHeader) {
    fs.writeFileSync(recipientsPath, 'name,phone,sent\n');
  }

  fs.appendFileSync(recipientsPath, line);
  res.sendStatus(200);
});


let botProcess = null;

// app.post('/api/start-campaign', (req, res) => {
//   if (botProcess) {
//     return res.status(400).send("⚠️ Bot already running");
//   }

//   const { spawn } = require('child_process');
//   const botPath = path.join(__dirname, 'bot');
//   const botFile = 'bot11.js';
  
//   if (botProcess) {
//     return res.status(400).send("⚠️ Bot already running");
//   }
  
//   console.log("🚀 Spawning bot11.js from", botPath);
  
//   botProcess = spawn('node', [botFile], { cwd: botPath });
  
//   botProcess.stdout.on('data', data => {
//     console.log(`🟢 Bot: ${data.toString().trim()}`);
//   });
  
//   botProcess.stderr.on('data', data => {
//     console.error(`🔴 Bot Error: ${data.toString().trim()}`);
//   });
  
//   botProcess.on('exit', (code) => {
//     console.log(`🛑 Bot exited with code ${code}`);
//     botProcess = null;
//   });
  
//   res.send("✅ Bot launched successfully");
  
// });


app.post('/api/start-campaign', (req, res) => {
  try {
    const qrStatusPath = path.join(__dirname, './uploads/qr_status.json');

    if (!fs.existsSync(qrStatusPath)) {
      return res.status(400).send("❌ No QR status file found.");
    }

    const status = JSON.parse(fs.readFileSync(qrStatusPath, 'utf-8'));

    if (!status.connected) {
      return res.status(400).send("❌ WhatsApp is not authorized yet. Please scan QR.");
    }

    if (!botProcess) {
      return res.status(400).send("❌ Bot not running. Please authorize again.");
    }

    console.log('🚀 Starting campaign on connected WhatsApp session');
    res.send("✅ Campaign messaging started!");

  } catch (err) {
    console.error('❌ Error starting campaign:', err);
    res.status(500).send('Error');
  }
});



app.post('/api/stop-campaign', (req, res) => {
  if (!botProcess) {
    return res.status(400).send("⚠️ No campaign is currently running");
  }

  botProcess.kill('SIGINT');
  botProcess = null;
  console.log("🛑 Campaign stopped manually");
  res.send("🛑 Campaign stopped");
});

app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
