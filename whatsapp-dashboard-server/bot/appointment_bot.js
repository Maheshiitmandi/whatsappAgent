const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { createObjectCsvWriter } = require('csv-writer');

const uploadsDir = path.join(__dirname, '../uploads');
const RECIPIENTS_FILE = path.join(uploadsDir, 'appointment.csv');


let recipients = [];

function loadRecipients() {
  return new Promise((resolve, reject) => {
    const rows = [];
    if (!fs.existsSync(RECIPIENTS_FILE)) {
      fs.writeFileSync(RECIPIENTS_FILE, 'name,phone,date,sent,token,cancelled\n');
      return resolve(rows);
    }

    fs.createReadStream(RECIPIENTS_FILE)
      .pipe(csv())
      .on('data', row => {
        rows.push({
          name: row.name || 'User',
          phone: row.phone,
          date: row.date || '',
          sent: (row.sent || '').toLowerCase() === 'yes',
          token: parseInt(row.token || 0),
          cancelled: (row.cancelled || '').toLowerCase() === 'yes'
        });
      })
      .on('end', () => resolve(rows))
      .on('error', reject);
  });
}

function updateRecipientsCSV(updatedRows) {
  const writer = createObjectCsvWriter({
    path: RECIPIENTS_FILE,
    header: [
      { id: 'name', title: 'name' },
      { id: 'phone', title: 'phone' },
      { id: 'sent', title: 'sent' },
      { id: 'date', title: 'date' },
      { id: 'token', title: 'token' },
      { id: 'cancelled', title: 'cancelled' }
    ]
  });

  return writer.writeRecords(updatedRows.map(r => ({
    name: r.name,
    phone: r.phone,
    date: r.date,
    sent: r.sent ? 'Yes' : '',
    token: r.token || '',
    cancelled: r.cancelled ? 'Yes' : ''
  })));
}


// async function appointment(msg){
//   if (msg.isGroupMsg) {
//     return; // Don't reply in group chats
//   }

//   const chatId = msg.from;
//   const phone = '+' + chatId.replace('@c.us', '');
//   const text = msg.body.trim().toLowerCase();

//   let user = recipients.find(r => r.phone === phone);
//   // console.log('user:', user);


//   if (!user) {
//     user = {
//       name: 'User',
//       phone,
//       sent: false,
//       token: '',
//       cancelled: false
//     };
//     recipients.push(user);
//   }

//   if (!user.token && !user.cancelled && !user.sent) {
//     await msg.reply(`Hi 👋\nWould you like to book an appointment?\n\nPlease reply with:\n1️⃣ Yes\n2️⃣ No`);
//     user.sent = true;
//     await updateRecipientsCSV(recipients);
//     return;
//   }

//   if ((text === '1' || text === 'yes') && !user.token) {
//     const maxToken = recipients.reduce((max, r) => Math.max(max, r.token || 0), 0);
//     user.token = maxToken + 1;
//     user.cancelled = false;
//     await msg.reply(`✅ Your appointment is confirmed!\n\n🪪 Your token number is: ${user.token}`);
//     await updateRecipientsCSV(recipients);
//   } else if (text === '2' || text === 'no') {
//     user.cancelled = true;
//     user.token = '';
//     await msg.reply(`❌ Your appointment has been cancelled.`);
//     await updateRecipientsCSV(recipients);
//   }
// }




async function appointment(msg) {
  if (msg.isGroupMsg) return;

  const chatId = msg.from;
  const phone = '+' + chatId.replace('@c.us', '');
  const rawText = msg.body.trim();
  const text = rawText.toLowerCase();

  let user = recipients.find(r => r.phone === phone);
  if (!user) {
    user = {
      name: 'User',
      phone,
      date: '',
      token: '',
      cancelled: false,
      sent: false,
      pendingCancellation: false
    };
    recipients.push(user);
  }

  const selectedIndex = parseInt(rawText);
  const regeneratedOptions = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d.toISOString().split('T')[0];
  });

  // Step 0: Status check
  if (rawText === '3') {
    if (user.date && user.token && !user.cancelled) {
      await msg.reply(`📅 You have an appointment on ${user.date}.\n🪪 Your token number is: ${user.token}`);
    } else {
      await msg.reply(`ℹ️ You don't have any active booking yet.`);
    }
    return;
  }

  // Step 1: Confirm cancellation if pending
  if (user.pendingCancellation) {
    if (text === 'yes') {
      user.cancelled = true;
      user.token = '';
      user.date = '';
      user.sent = false;
      user.pendingCancellation = false;
      await msg.reply(`❌ Your appointment has been cancelled.`);
      await updateRecipientsCSV(recipients);
      return;
    } else if (text === 'no') {
      user.pendingCancellation = false;
      await msg.reply(`👍 Got it! Your appointment is still active.`);
      return;
    } else {
      await msg.reply(`⚠️ Please reply YES to confirm cancellation or NO to keep your appointment.`);
      return;
    }
  }

    // Step 3: Ask for a date (if no token and no date selected)
    if (!user.date && !user.token && !user.sent) {
      const formatted = regeneratedOptions.map((d, idx) => `${idx + 1}. 📅 ${d}`).join('\n');
      await msg.reply(`Hi 👋\nPlease select a date for your appointment (within 2 weeks).\nReply with the number:\n\n${formatted}`);
      user.sent = true;
      await updateRecipientsCSV(recipients);
      return;
    }
  

  // Step 2: Handle numeric date selection
  if (
    !user.token &&
    !user.date && 
    !isNaN(selectedIndex) &&
    selectedIndex >= 1 &&
    selectedIndex <= 14
  ) {
    user.date = regeneratedOptions[selectedIndex - 1];
    user.cancelled = false; // clear previous cancel
    await msg.reply(`📆 You selected ${user.date}. Now reply with:\n1️⃣ Yes to confirm booking\n2️⃣ No to cancel.`);
    await updateRecipientsCSV(recipients);
    return;
  }

  // Step 4: Confirm booking (only if a valid date is selected and no token assigned yet)
  if ((text === '1' || text === 'yes') && user.date && !user.token) {
    const sameDateTokens = recipients.filter(r => r.date === user.date);
    const maxToken = sameDateTokens.reduce((max, r) => Math.max(max, r.token || 0), 0);
    user.token = maxToken + 1;
    user.cancelled = false;
    await msg.reply(`✅ Your appointment for ${user.date} is confirmed!\n\n🪪 Your token number is: ${user.token}\nTo cancel, reply with 2`);
    await updateRecipientsCSV(recipients);
    return;
  }

  // Step 5: Ask for confirmation before cancellation
  if ((text === '2' || text === 'no') && user.date && !user.cancelled) {
    user.pendingCancellation = true;
    await msg.reply(`⚠️ Are you sure you want to cancel your appointment?\nReply YES to confirm or NO to keep your booking.`);
    return;
  }


  // Step 6: Fallback if invalid input
  const fallbackOptions = regeneratedOptions.map((d, idx) => `${idx + 1}. 📅 ${d}`).join('\n');
  await msg.reply(`⚠️ Invalid input.\nPlease reply with a number (1-14) to select your appointment date:\n\n${fallbackOptions}`);
}












module.exports = {
  appointment
}

