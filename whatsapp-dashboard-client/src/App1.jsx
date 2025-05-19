
// client/src/App.jsx
import React, { useEffect, useState } from 'react';
import axios from 'axios';

axios.defaults.baseURL = 'http://localhost:5000';
// const [loading, setLoading] = useState(false);


function App() {
  const [tab, setTab] = useState('dashboard');
  const [message, setMessage] = useState('');
  const [recipients, setRecipients] = useState([]);
  const [responses, setResponses] = useState([]);
  const [csv, setCsv] = useState(null);
  const [media, setMedia] = useState(null);
  const [status, setStatus] = useState('');

  useEffect(() => {
    fetchMessage();
    fetchRecipients();
    fetchResponses();
  }, []);

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

  const uploadFile = async (file, endpoint) => {
    const formData = new FormData();
    formData.append('file', file);
    await axios.post(endpoint, formData);
  };

  const handleSaveMessage = async () => {
    await axios.post('/api/message', { message });
    setStatus('✅ Message saved');
  };
  

  const handleStartCampaign = async () => {
    await axios.post('/api/start-campaign');
    setStatus('🚀 Campaign started');
  };

  return (
    <div className="max-w-6xl mx-auto p-4">
      <h1 className="text-3xl font-bold mb-4">📢 WhatsApp Campaign Manager</h1>
      <div className="flex space-x-4 mb-4">
        <button onClick={() => setTab('dashboard')} className="px-4 py-2 bg-blue-500 text-white rounded">Dashboard</button>
        <button onClick={() => setTab('recipients')} className="px-4 py-2 bg-green-500 text-white rounded">Recipients</button>
        <button onClick={() => setTab('responses')} className="px-4 py-2 bg-purple-500 text-white rounded">Responses</button>
      </div>

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
            <button onClick={() => uploadFile(csv, '/api/upload-recipients')} className="mt-2 px-4 py-2 bg-green-600 text-white rounded">Upload CSV</button>
          </div>

          <div className="mb-6">
            <label className="font-semibold">🖼 Upload Media</label>
            <input type="file" onChange={e => setMedia(e.target.files[0])} className="block mt-1" />
            <button onClick={() => uploadFile(media, '/api/upload-media')} className="mt-2 px-4 py-2 bg-purple-600 text-white rounded">Upload Media</button>
          </div>

          <div className="mb-6">
            <button onClick={handleStartCampaign} className="px-4 py-2 bg-black text-white rounded">Start Campaign</button>
            {status && <div className="mt-2 text-green-700">{status}</div>}
          </div>
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
                  <td className="p-2 border">{r.name}</td>
                  <td className="p-2 border">{r.phone}</td>
                  <td className="p-2 border">{r.response}</td>
                  <td className="p-2 border">{r.timestamp}</td>
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
