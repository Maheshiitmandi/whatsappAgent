
// client/src/App.jsx
import React, { useEffect, useState } from 'react';
import axios from 'axios';

axios.defaults.baseURL = 'http://localhost:5000';
// const [loading, setLoading] = useState(false);


function App() {
//   const [tab, setTab] = useState('dashboard');
  const switchTab = (t) => {
        setTab(t);
        localStorage.setItem('tab', t);
    };
  const [tab, setTab] = useState(() => localStorage.getItem('tab') || 'dashboard');
  const [qrCode, setQrCode] = useState(null);


  const [message, setMessage] = useState('');
  const [recipients, setRecipients] = useState([]);
  const [responses, setResponses] = useState([]);
  const [csv, setCsv] = useState(null);
  const [media, setMedia] = useState(null);
  const [status, setStatus] = useState('');
  const [newRecipient, setNewRecipient] = useState({ name: '', phone: '' });
  const [connected, setConnected] = useState(false);



//   useEffect(() => {
//     fetchMessage();
//     fetchRecipients();
//     fetchResponses();
//   }, []);
useEffect(() => {
    fetchMessage();
    fetchRecipients();
    fetchResponses();
  
    // Auto-refresh responses every 10 seconds
    const interval = setInterval(() => {
      fetchResponses();
    }, 10000); // 10 seconds
  
    return () => clearInterval(interval); // Cleanup on unmount
  }, []);


  useEffect(() => {
    if (tab === 'whatsapp') {
      const interval = setInterval(async () => {
        try {
          const res = await axios.get('/api/whatsapp-status');
          setQrCode(res.data.qr);
          setConnected(res.data.connected);
        } catch (err) {
          console.error('QR polling failed:', err);
          setQrCode(null);
          setConnected(false);
        }
      }, 3000);
      return () => clearInterval(interval);
    }
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

//   const uploadFile = async (file, endpoint) => {
//     const formData = new FormData();
//     formData.append('file', file);
//     await axios.post(endpoint, formData);
//   };
  const uploadFile = async (file, endpoint, label) => {
    if (!file) {
      setStatus(`❌ No ${label} file selected`);
      return;
    }
  
    try {
      setStatus(`⏳ Uploading ${label}...`);
      const formData = new FormData();
      formData.append('file', file);
      await axios.post(endpoint, formData);
      setStatus(`✅ ${label} uploaded successfully`);
  
      // Refresh recipients if it was recipients.csv
      if (endpoint.includes('recipients')) {
        fetchRecipients();
      }
  
    } catch (error) {
      console.error(`Upload ${label} failed`, error);
      setStatus(`❌ Failed to upload ${label}`);
    }
  };
  

  const handleSaveMessage = async () => {
    await axios.post('/api/message', { message });
    setStatus('✅ Message saved');
  };
  

  const handleStartCampaign = async () => {
    await axios.post('/api/start-campaign');
    setStatus('🚀 Campaign started');
  };

  const handleStopCampaign = async () => {
    await axios.post('/api/stop-campaign');
    setStatus('🛑 Campaign stopped');
  };

  const handleClearResponses = async () => {
    const confirmClear = window.confirm("⚠️ Are you sure you want to delete all previous responses?");
    if (!confirmClear) return;
  
    try {
      await axios.post('/api/clear-responses');
      setStatus('🧹 All responses cleared');
      fetchResponses();
    } catch (err) {
      setStatus('❌ Failed to clear responses');
      console.error(err);
    }
  };

  const handleAddRecipient = async () => {
    if (!newRecipient.name || !newRecipient.phone) {
      setStatus('❌ Name and phone required');
      return;
    }
  
    try {
      await axios.post('/api/add-recipient', newRecipient);
      setStatus('✅ Recipient added');
      setNewRecipient({ name: '', phone: '' });
      fetchRecipients(); // refresh the table
    } catch (err) {
      setStatus('❌ Failed to add recipient');
      console.error(err);
    }
  };
  
  const handleLogoutWhatsapp = async () => {
    if (window.confirm("⚠️ Are you sure you want to logout WhatsApp session?")) {
      await axios.post('/api/logout-whatsapp');
      setQrCode(null);
      setConnected(false);
      setStatus('🧹 WhatsApp session cleared. Please scan again.');
    }
  };
  
  const handleAuthorizeNewDevice = async () => {
    if (window.confirm("⚡ Do you want to generate a new QR for authorization?")) {
      await axios.post('/api/authorize-new-device');
      setQrCode(null);
      setConnected(false);
      setStatus('🆕 New QR generated. Please scan.');
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4">
       <div className="mb-6">
          <img
            src="/banner.png"
            alt="Campaign Banner"
            className="w-full max-w-[1000px] h-[60px] object-cover rounded-xl shadow"
          />
       </div>
       <div className="mb-3 p-0.5 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-md">
            <h2 className="text-xl font-bold">📣 WhatsApp Campaign</h2>
            <p className="text-sm mt-1">Manage, send, and track your outreach in real-time.</p>
       </div>
      {/* <h1 className="text-3xl font-bold mb-4">📢 WhatsApp Campaign Manager</h1> */}
      <div className="flex space-x-4 mb-4">
        <button onClick={() => switchTab('whatsapp')} className="px-4 py-2 bg-pink-500 text-white rounded">WhatsApp</button>
        <button onClick={() => switchTab('dashboard')} className="px-4 py-2 bg-blue-500 text-white rounded">Dashboard</button>
        <button onClick={() => switchTab('recipients')} className="px-4 py-2 bg-green-500 text-white rounded">Recipients</button>
        <button onClick={() => switchTab('responses')} className="px-4 py-2 bg-purple-500 text-white rounded">Responses</button>
        <button onClick={() => switchTab('no-response')} className="px-4 py-2 bg-orange-500 text-white rounded">No Response</button>
      </div>

      {tab === 'whatsapp' && (
        <div>
          <h2 className="text-xl font-bold mb-4">📱 WhatsApp Authorization</h2>

          {qrCode && typeof qrCode === 'string' && qrCode.startsWith('data:image') && !connected ? (
            <img
              src={qrCode}
              alt="Scan QR to login"
              className="w-60 h-60 border rounded shadow mx-auto"
            />
          ) : connected ? (
            <p className="text-green-600 text-center text-lg">✅ You are already logged in!</p>
          ) : (
            <p className="text-gray-600 text-center">⏳ Waiting for QR...</p>
          )}

          <div className="flex justify-center gap-4 mt-6">
            <button
              onClick={handleAuthorizeNewDevice}
              className="px-4 py-2 bg-blue-600 text-white rounded"
            >
              🔵 Authorize New Device
            </button>

            <button
              onClick={handleLogoutWhatsapp}
              className="px-4 py-2 bg-red-600 text-white rounded"
            >
              🔴 Logout WhatsApp
            </button>
          </div>
        </div>
      )}




      {tab === 'dashboard' && (
        <div>
          <div className="mb-6">
            <label className="font-semibold">📝 Message</label>
            <textarea value={message} onChange={e => setMessage(e.target.value)} className="w-full border rounded p-2 mt-1" rows={4} />
            <button onClick={handleSaveMessage} className="mt-2 px-4 py-2 bg-blue-600 text-white rounded">Save Message</button>
          </div>

          <div className="mb-6">
            <label className="font-semibold">📁 Upload Recipients (.csv)</label>
            <input type="file" accept=".csv" onChange={e => setCsv(e.target.files[0])} className="block mt-1" />
            <button onClick={() => uploadFile(csv, '/api/upload-recipients', 'Recipients CSV')} className="mt-2 px-4 py-2 bg-green-600 text-white rounded">Upload CSV</button>
          </div>

          <div className="mb-6">
            <label className="font-semibold">🖼 Upload Media</label>
            <input type="file" onChange={e => setMedia(e.target.files[0])} className="block mt-1" />
            <button onClick={() => uploadFile(media, '/api/upload-media', 'Media')} className="mt-2 px-4 py-2 bg-purple-600 text-white rounded">Upload Media</button>
          </div>

          <div className="mb-6">
            <button onClick={handleClearResponses} className="px-4 py-2 bg-yellow-500 text-white rounded">Clear Responses</button>
            <button onClick={handleStartCampaign} className="px-4 py-2 bg-black text-white rounded">Start Campaign</button>
            <button onClick={handleStopCampaign} className="px-4 py-2 bg-red-600 text-white rounded">Stop Campaign</button>
          </div>
          {status && <div className="mt-2 text-green-700">{status}</div>}


        </div>
      )}

      {tab === 'recipients' && (
        <div>
          <h2 className="text-xl font-semibold mb-2">📋 Recipients</h2>
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
                  <td className="p-2 border">{r.sent ? 'Yes' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'responses' && (
        <div>
          <h2 className="text-xl font-semibold mb-2">📊 Responses</h2>
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

    {tab === 'no-response' && (
    <div>
        <h2 className="text-xl font-semibold mb-2">🙅 No Response Yet</h2>
        <table className="w-full text-sm table-auto border">
        <thead>
            <tr className="bg-gray-100">
            <th className="p-2 border">Name</th>
            <th className="p-2 border">Phone</th>
            </tr>
        </thead>
        <tbody>
            {recipients
            .filter(r => r.sent)
            .filter(r =>
                !responses.some(resp =>
                resp.Phone?.replace(/\D/g, '').endsWith(r.phone?.replace(/\D/g, ''))
                )
            )
            .map((r, i) => (
                <tr key={i} className="border-b">
                <td className="p-2 border">{r.name}</td>
                <td className="p-2 border">{r.phone}</td>
                </tr>
            ))}
        </tbody>
        </table>
    </div>
    )}

    {tab === 'recipients' && (
    <div>
        <h2 className="text-xl font-semibold mb-2">📋 Recipients</h2>
        <div className="mb-4 flex gap-2">
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
                <td className="p-2 border">{r.sent ? 'Yes' : 'No'}</td>
            </tr>
            ))}
        </tbody>
        </table>
    </div>
    )}

    </div>
  );
}

export default App;
