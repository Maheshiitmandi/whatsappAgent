import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './App.css';

axios.defaults.baseURL = 'http://localhost:5000';

function App() {
  const switchTab = (t) => {
    setTab(t);
    localStorage.setItem('tab', t);
  };

  const [tab, setTab] = useState(() => localStorage.getItem('tab') || 'dashboard');
  const [message, setMessage] = useState('');
  const [recipients, setRecipients] = useState([]);
  const [responses, setResponses] = useState([]);
  const [csv, setCsv] = useState(null);
  const [media, setMedia] = useState(null);
  const [status, setStatus] = useState('');
  const [qrCode, setQrCode] = useState(null);
  const [connected, setConnected] = useState(false);
  const [newRecipient, setNewRecipient] = useState({ name: '', phone: '' });
  const [appointments, setAppointments] = useState([]);
  const [selectedRecipients, setSelectedRecipients] = useState([]);
  const [selectAll, setSelectAll] = useState(false);


  // AI Chatbot states
  const [chat, setChat] = useState([]);
  const [userPrompt, setUserPrompt] = useState('');

  useEffect(() => {
    fetchMessage();
    fetchRecipients();
    fetchResponses();
    fetchAppointments();

    const interval = setInterval(async () => {
      try {
        const res = await axios.get('/api/whatsapp-status');
        setQrCode(res.data.qr);
        setConnected(res.data.connected);
      } catch (err) {
        console.error('QR polling error:', err);
        setQrCode(null);
        setConnected(false);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [tab]);

  const fetchMessage = async () => {
    const res = await axios.get('/api/message');
    setMessage(res.data);
  };

  const fetchRecipients = async () => {
    const res = await axios.get('/api/recipients');
    setRecipients(res.data);
  };

  const fetchResponses = async () => {
    const res = await axios.get('/api/responses-json');
    setResponses(res.data);
  };

  const fetchAppointments = async () => {
    const res = await axios.get('/api/appointments');
    setAppointments(res.data);
  };

  const handleSaveMessage = async () => {
    await axios.post('/api/message', { message });
    setStatus('✅ Message saved successfully');
    setTimeout(() => setStatus(''), 3000);

  };

  const handleUploadFile = async (file, endpoint, label) => {
    if (!file) {
      setStatus(`❌ No ${label} selected`);
      setTimeout(() => setStatus(''), 3000);
      return;
    }
    const formData = new FormData();
    formData.append('file', file);
    await axios.post(endpoint, formData);
    setStatus(`✅ ${label} uploaded successfully`);
    setTimeout(() => setStatus(''), 3000);
    if (endpoint.includes('recipients')) fetchRecipients();
  };

  const handleStartCampaign = async () => {
    if (window.confirm('⚠️ Are you sure you want to start the campaign?')) {
      if (!connected) {
        alert('❌ WhatsApp is not authorized yet. Please scan QR code first.');
        return;
      }
      await axios.post('/api/start-campaign');
      setStatus('🚀 Campaign started successfully');
      setTimeout(() => setStatus(''), 3000);

    }
  };

  const handleLogoutWhatsapp = async () => {
    if (window.confirm('⚠️ Are you sure you want to logout WhatsApp session?')) {
      await axios.post('/api/logout-whatsapp');
      setQrCode(null);
      setConnected(false);
      setStatus('🧹 WhatsApp session cleared. Scan QR again to login.');
      setTimeout(() => setStatus(''), 3000);

    }
  };

  const handleStopCampaign = async () => {
    if (window.confirm('⚠️ Are you sure you want to stop the campaign?')) {
      try {
        await axios.post('/api/stop-campaign');
        setStatus('🛑 Campaign stopped successfully');
        setTimeout(() => setStatus(''), 3000);

      } catch (err) {
        console.error('❌ Error stopping campaign:', err);
        setStatus('❌ Failed to stop campaign');
      setTimeout(() => setStatus(''), 3000);
        
      }
    }
  };

  const handleAddRecipient = async () => {
    if (!newRecipient.name || !newRecipient.phone) {
      alert('Name and Phone are required!');
      return;
    }
    await axios.post('/api/add-recipient', newRecipient);
    setNewRecipient({ name: '', phone: '' });
    fetchRecipients();
    setStatus('✅ New recipient added');
    setTimeout(() => setStatus(''), 3000);

  };

  const handleClearChat = () => {
    setChat([]);
  };

  const sendToAI = async () => {
    if (!userPrompt.trim()) return;
  
    const prompt = userPrompt;
    setChat([...chat, { from: 'user', text: prompt }]);  // Add user's message once
    setUserPrompt('');
  
    try {
      const res = await axios.post('/api/meta-ai-chat', { prompt });
      const aiReply = res.data.reply;
      setChat(prev => [...prev, { from: 'bot', text: aiReply }]);  // Add only bot's reply
    } catch (err) {
      console.error('AI error:', err);
      setChat(prev => [...prev, { from: 'bot', text: '❌ Failed to get response' }]);
    }
  };


  const cancelToken = async (phone) => {
    if (!window.confirm('Cancel this booking?')) return;
    await axios.post('/api/cancel-token', { phone });
    fetchRecipients();
    setStatus('🛑 Token cancelled');
    setTimeout(() => setStatus(''), 3000);

  };

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedRecipients([]);
    } else {
      setSelectedRecipients(recipients.map(r => r.phone));
    }
    setSelectAll(!selectAll);
  };
  
  const toggleRecipientSelect = (phone) => {
    setSelectedRecipients(prev =>
      prev.includes(phone) ? prev.filter(p => p !== phone) : [...prev, phone]
    );
  };

  const clearSentStatus = async () => {
    if (selectedRecipients.length === 0) {
      alert('❌ No recipients selected');
      return;
    }
  
    const confirmClear = window.confirm('⚠️ Are you sure you want to clear "sent" status for selected recipients?');
    if (!confirmClear) return;
  
    await axios.post('/api/clear-sent', { phones: selectedRecipients });
    fetchRecipients();
    setStatus('🧹 Cleared "sent" status');
    setTimeout(() => setStatus(''), 3000);
    setSelectedRecipients([]);
    setSelectAll(false);
  };
  
  

  return (
    <div className="min-h-screen bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 p-8 animate-fadeIn">
      <div className="max-w-6xl mx-auto p-6 bg-white bg-opacity-20 backdrop-blur-md rounded-lg shadow-xl">
        <h1 className="text-4xl font-extrabold text-center text-white mb-8 animate-slideIn">📢 WhatsApp Campaign Manager</h1>

        <div className="flex space-x-4 justify-center mb-8">
          <button onClick={() => switchTab('dashboard')} className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded shadow">Dashboard</button>
          <button onClick={() => switchTab('recipients')} className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-bold rounded shadow">Recipients</button>
          <button onClick={() => switchTab('responses')} className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white font-bold rounded shadow">Responses</button>
          <button onClick={() => switchTab('whatsapp')} className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white font-bold rounded shadow">WhatsApp</button>
          <button onClick={() => switchTab('appointments')} className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded shadow">Appointments</button>
        </div>

        {tab === 'dashboard' && (
          <div className="animate-fadeIn">
            <div className="mb-6">
              <label className="font-semibold text-white">📝 Message</label>
              <textarea value={message} onChange={e => setMessage(e.target.value)} className="w-full border rounded p-2 mt-1" rows={4} />
              <button onClick={handleSaveMessage} className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded">Save Message</button>
            </div>

            <div className="mb-6">
              <label className="font-semibold text-white">📁 Upload Recipients (.csv)</label>
              <input type="file" accept=".csv" onChange={e => setCsv(e.target.files[0])} className="block mt-1" />
              <button onClick={() => handleUploadFile(csv, '/api/upload-recipients', 'Recipients CSV')} className="mt-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded">Upload CSV</button>
            </div>

            <div className="mb-6">
              <label className="font-semibold text-white">🖼 Upload Media</label>
              <input type="file" onChange={e => setMedia(e.target.files[0])} className="block mt-1" />
              <button onClick={() => handleUploadFile(media, '/api/upload-media', 'Media')} className="mt-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded">Upload Media</button>
            </div>

            <div className="flex space-x-4">
              <button onClick={handleStartCampaign} className="px-4 py-2 bg-black hover:bg-gray-800 text-white rounded">Start Campaign</button>
              <button onClick={handleStopCampaign} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded">🛑 Stop Campaign</button>
            </div>
            {status && <div className="mt-4 text-white font-semibold animate-pulse">{status}</div>}

            <hr className="my-6 border-white border-opacity-40" />
            <h2 className="text-2xl font-bold mb-4 text-white">🧠 Chat with AI</h2>
            <div className="mb-4">
                <button onClick={handleClearChat} className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded shadow">
                    🗑️ Clear Chat
                </button>
            </div>

            <div id="chat-box">
                {chat.map((msg, i) => (
                    <div key={i} className={`chat-message ${msg.from === 'user' ? 'user-message' : 'bot-message'}`}>
                    {msg.text}
                    </div>
                ))}
            </div>

            <div id="chat-input">
                <input
                    placeholder="Type your question..."
                    value={userPrompt}
                    onChange={e => setUserPrompt(e.target.value)}
                />
                <button onClick={sendToAI}>Send</button>
            </div>

          </div>

          
        )}

        {tab === 'recipients' && (
          <div className="animate-fadeIn">
            <h2 className="text-2xl font-bold mb-4 text-white">📋 Recipients</h2>
            <div className="flex gap-2 mb-4">
              <input className="border p-2 rounded w-1/3" placeholder="Name" value={newRecipient.name} onChange={e => setNewRecipient({ ...newRecipient, name: e.target.value })} />
              <input className="border p-2 rounded w-1/3" placeholder="Phone" value={newRecipient.phone} onChange={e => setNewRecipient({ ...newRecipient, phone: e.target.value })} />
              <button onClick={handleAddRecipient} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded">➕ Add</button>
              {/* <button onClick={clearSelectedSentStatus} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded ml-2">🧹 Clear</button> */}
              <button onClick={clearSentStatus} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded ml-2">🧹 Clear</button>
            </div>
            <table className="w-full text-sm table-auto border bg-white bg-opacity-30">
              <thead> 
                <tr className="bg-gray-100">
                  <th className="p-2 border"> <input type="checkbox" checked={selectAll} onChange={toggleSelectAll} /> </th>
                  <th className="p-2 border">Name</th>
                  <th className="p-2 border">Phone</th>
                  <th className="p-2 border">Sent</th>
                </tr>
              </thead>
            <tbody>
              {recipients.map((r, i) => (
                <tr key={i} className="border-b">
                  <td className="p-2 border text-center">
                    <input
                      type="checkbox"
                      checked={selectedRecipients.includes(r.phone)}
                      onChange={() => toggleRecipientSelect(r.phone)}
                    />
                  </td>
                  <td className="p-2 border">{r.name}</td>
                  <td className="p-2 border">{r.phone}</td>
                  <td className="p-2 border">{r.sent ? r.sent : '❓'}</td>
                </tr>
              ))}
            </tbody>

            </table>
            {status && (
              <div className="mb-4 text-white font-semibold animate-pulse">
                {status}
              </div>
            )}
          </div>
        )}

        {tab === 'appointments' && (
          <div className="animate-fadeIn">
            <h2 className="text-2xl font-bold mb-4 text-white">📅 Appointments</h2>
            <table className="w-full text-sm table-auto border bg-white bg-opacity-30">
              <thead>
                <tr className="bg-gray-100">
                  {appointments.length > 0 &&
                    Object.keys(appointments[0]).map((col, idx) => (
                      <th key={idx} className="p-2 border">{col}</th>
                    ))
                  }
                </tr>
              </thead>
              <tbody>
                {appointments.map((row, i) => (
                  <tr key={i} className="border-b">
                    {Object.values(row).map((val, j) => (
                      <td key={j} className="p-2 border">{val}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'responses' && (
          <div className="animate-fadeIn">
            <h2 className="text-2xl font-bold mb-4 text-white">📊 Responses</h2>
            <table className="w-full text-sm table-auto border bg-white bg-opacity-30">
              <thead>
                <tr className="bg-gray-100">
                  <th className="p-2 border">Name</th>
                  <th className="p-2 border">Phone</th>
                  <th className="p-2 border">Response</th>
                  <th className="p-2 border">Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {responses.map((r, i) => (
                  <tr key={i} className="border-b">
                    <td className="p-2 border">{r.Name}</td>
                    <td className="p-2 border">{r.Phone}</td>
                    <td className="p-2 border">{r.Response}</td>
                    <td className="p-2 border">{r.Timestamp}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'whatsapp' && (
          <div className="animate-fadeIn">
            <h2 className="text-2xl font-bold mb-4 text-white">📱 WhatsApp Authorization</h2>
            {qrCode && typeof qrCode === 'string' && qrCode.startsWith('data:image') && !connected ? (
              <img src={qrCode} alt="Scan QR" className="w-60 h-60 border rounded shadow mx-auto animate-zoomIn" />
            ) : connected ? (
              <p className="text-green-300 text-center text-lg">✅ You are already logged in!</p>
            ) : (
              <p className="text-white text-center">⏳ Waiting for QR...</p>
            )}

            <div className="flex justify-center mt-6">
              <button onClick={handleLogoutWhatsapp} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded">🔴 Logout WhatsApp</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
