// client/src/App.jsx
import React, { useEffect, useState } from 'react';
import axios from 'axios';

axios.defaults.baseURL = 'http://localhost:5000';

function App() {
//   const [tab, setTab] = useState('dashboard');
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

  useEffect(() => {
    fetchMessage();
    fetchRecipients();
    fetchResponses();

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

  const handleSaveMessage = async () => {
    await axios.post('/api/message', { message });
    setStatus('✅ Message saved successfully');
  };

  const handleUploadFile = async (file, endpoint, label) => {
    if (!file) {
      setStatus(`❌ No ${label} selected`);
      return;
    }
    const formData = new FormData();
    formData.append('file', file);
    await axios.post(endpoint, formData);
    setStatus(`✅ ${label} uploaded successfully`);
    if (endpoint.includes('recipients')) fetchRecipients();
  };

  // const handleStartCampaign = async () => {
  //   if (!connected) {
  //     alert('❌ WhatsApp is not authorized yet. Please scan QR code first.');
  //     return;
  //   }
  //   await axios.post('/api/start-campaign');
  //   setStatus('🚀 Campaign started successfully');
  // };

  const handleStartCampaign = async () => {
    if (window.confirm('⚠️ Are you sure you want to start the campaign?')) {
      if (!connected) {
        alert('❌ WhatsApp is not authorized yet. Please scan QR code first.');
        return;
      } 
      await axios.post('/api/start-campaign');
      setStatus('🚀 Campaign started successfully');
    }
  };

  const handleLogoutWhatsapp = async () => {
    if (window.confirm('⚠️ Are you sure you want to logout WhatsApp session?')) {
      await axios.post('/api/logout-whatsapp');
      setQrCode(null);
      setConnected(false);
      setStatus('🧹 WhatsApp session cleared. Scan QR again to login.');
    }
  };

  const handleStopCampaign = async () => {
    if (window.confirm('⚠️ Are you sure you want to stop the campaign?')) {
      try {
        await axios.post('/api/stop-campaign');
        setStatus('🛑 Campaign stopped successfully');
      } catch (err) {
        console.error('❌ Error stopping campaign:', err);
        setStatus('❌ Failed to stop campaign');
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
  };

  return (
    <div className="max-w-6xl mx-auto p-4">
      <h1 className="text-3xl font-bold mb-4">📢 WhatsApp Campaign Manager</h1>

      {/* Tabs */}
      <div className="flex space-x-4 mb-4">
        <button onClick={() => switchTab('dashboard')} className="px-4 py-2 bg-blue-500 text-white rounded">Dashboard</button>
        <button onClick={() => switchTab('recipients')} className="px-4 py-2 bg-green-500 text-white rounded">Recipients</button>
        <button onClick={() => switchTab('responses')} className="px-4 py-2 bg-purple-500 text-white rounded">Responses</button>
        <button onClick={() => switchTab('whatsapp')} className="px-4 py-2 bg-yellow-500 text-white rounded">WhatsApp</button>
      </div>

      {/* Dashboard */}
      {tab === 'dashboard' && (
        <div>
          <div className="mb-6">
            <label className="font-semibold">📝 Message</label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              className="w-full border rounded p-2 mt-1"
              rows={4}
            />
            <button onClick={handleSaveMessage} className="mt-2 px-4 py-2 bg-blue-600 text-white rounded">Save Message</button>
          </div>

          <div className="mb-6">
            <label className="font-semibold">📁 Upload Recipients (.csv)</label>
            <input type="file" accept=".csv" onChange={e => setCsv(e.target.files[0])} className="block mt-1" />
            <button onClick={() => handleUploadFile(csv, '/api/upload-recipients', 'Recipients CSV')} className="mt-2 px-4 py-2 bg-green-600 text-white rounded">Upload CSV</button>
          </div>

          <div className="mb-6">
            <label className="font-semibold">🖼 Upload Media</label>
            <input type="file" onChange={e => setMedia(e.target.files[0])} className="block mt-1" />
            <button onClick={() => handleUploadFile(media, '/api/upload-media', 'Media')} className="mt-2 px-4 py-2 bg-purple-600 text-white rounded">Upload Media</button>
          </div>

          <div className="mb-6">
            <button onClick={handleStartCampaign} className="px-4 py-2 bg-black text-white rounded">Start Campaign</button>
          </div>

          {/* <div className="mb-6">
            <button onClick={handleStopCampaign} className="px-4 py-2 bg-red-600 text-white rounded"> 🛑 Stop Campaign</button>
          </div> */}
          {status && <div className="mt-4 text-green-600 font-semibold">{status}</div>}
        </div>
      )}

      {/* Recipients */}
      {tab === 'recipients' && (
        <div>
          <h2 className="text-xl font-bold mb-2">📋 Recipients</h2>

          <div className="flex gap-2 mb-4">
            <input
              className="border p-2 rounded w-1/3"
              placeholder="Name"
              value={newRecipient.name}
              onChange={e => setNewRecipient({ ...newRecipient, name: e.target.value })}
            />
            <input
              className="border p-2 rounded w-1/3"
              placeholder="Phone"
              value={newRecipient.phone}
              onChange={e => setNewRecipient({ ...newRecipient, phone: e.target.value })}
            />
            <button
              onClick={handleAddRecipient}
              className="px-4 py-2 bg-indigo-600 text-white rounded"
            >
              ➕ Add Recipient
            </button>
          </div>

          <table className="w-full text-sm table-auto border">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-2 border">Name</th>
                <th className="p-2 border">Phone</th>
                <th className="p-2 border">Sent</th>
              </tr>
            </thead>
            <tbody>
              {recipients.map((r, i) => (
                <tr key={i} className="border-b">
                  <td className="p-2 border">{r.name}</td>
                  <td className="p-2 border">{r.phone}</td>
                  <td className="p-2 border">{r.sent ? r.sent : '❓'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Responses */}
      {tab === 'responses' && (
        <div>
          <h2 className="text-xl font-bold mb-2">📊 Responses</h2>
          <table className="w-full text-sm table-auto border">
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

      {/* WhatsApp Authorization */}
      {tab === 'whatsapp' && (
        <div>
          <h2 className="text-xl font-bold mb-4">📱 WhatsApp Authorization</h2>

          {qrCode && typeof qrCode === 'string' && qrCode.startsWith('data:image') && !connected ? (
            <img src={qrCode} alt="Scan QR" className="w-60 h-60 border rounded shadow mx-auto" />
          ) : connected ? (
            <p className="text-green-600 text-center text-lg">✅ You are already logged in!</p>
          ) : (
            <p className="text-gray-600 text-center">⏳ Waiting for QR...</p>
          )}

          <div className="flex justify-center mt-6">
            <button
              onClick={handleLogoutWhatsapp}
              className="px-4 py-2 bg-red-600 text-white rounded"
            >
              🔴 Logout WhatsApp
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
