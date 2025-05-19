// server/bot/auth-bot.js
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');

// Paths
const uploadsDir = path.join(__dirname, '../uploads');
const qrStatusPath = path.join(uploadsDir, 'qr_status.json');

// Helper: Update QR Status JSON
function updateQRStatus(data) {
  try {
    fs.writeFileSync(qrStatusPath, JSON.stringify(data));
  } catch (err) {
    console.error('❌ Failed to update QR status file:', err);
  }
}

// Initialize WhatsApp Client
// const client = new Client({
//   authStrategy: new LocalAuth(),
//   puppeteer: { headless: true, args: ['--no-sandbox'] }
// });

function connectToWhatsapp(){
  return new Promise((resolve, reject)=>{
    const client = new Client({
      authStrategy: new LocalAuth({
        clientId: 'auth_bot',  // <--- important
        dataPath: path.join(__dirname, '.wwebjs_auth')
      }),
      puppeteer: { headless: true, args: ['--no-sandbox'] }
    });
    
    // When QR generated
    client.on('qr', qr => {
      console.log('📱 New QR code generated');
      qrcode.toDataURL(qr, (err, url) => {
        if (!err) {
          updateQRStatus({ qr: url, connected: false });
        } else {
          console.error('❌ Error converting QR to dataURL:', err);
        }
      });
    });
    
    client.on('error', (error) => {
      console.log('Error in client', error)
    })
    
    // When login ready
    client.on('ready', () => {
      console.log('✅ WhatsApp Authorization Bot Ready');
      updateQRStatus({ qr: null, connected: true });
      resolve(client)
    });
    
    // When auth fails
    client.on('auth_failure', msg => {
      console.error('❌ Authentication failure', msg);
      updateQRStatus({ qr: null, connected: false });
    });
    
    // Initialize
    client.initialize();
    
  })
 
}

module.exports = {
  connectToWhatsapp
}