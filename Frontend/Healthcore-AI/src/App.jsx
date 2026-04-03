import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

// 🔥 Slight color change
ChartJS.defaults.color = '#38bdf8';
ChartJS.defaults.font.family = "'Outfit', sans-serif";

const API_BASE = 'http://localhost:8000';

// ✅ SAME (NO CHANGE)
const NORMAL_RANGES = { /* SAME AS ORIGINAL */ };
const CATEGORIES = [ /* SAME AS ORIGINAL */ ];

const Expander = ({ title, children }) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className={`expander ${isOpen ? 'open' : ''}`}>
      <button type="button" className="expander-header" onClick={() => setIsOpen(!isOpen)}>
        <span>{title}</span>
        <span className="expander-icon">+</span>
      </button>
      <div className="expander-content">
        <div>{children}</div>
      </div>
    </div>
  );
};

export default function App() {

  // 🔥 Changed key
  const [theme, setTheme] = useState(localStorage.getItem('health_theme') || 'dark');
  const [activeTab, setActiveTab] = useState('input');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('health_theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  const [patientId, setPatientId] = useState(null);
  const [patientDetails, setPatientDetails] = useState(null);
  const [reportData, setReportData] = useState(null);

  // Patient Form
  const [pName, setPName] = useState('');
  const [pAge, setPAge] = useState('');
  const [pGender, setPGender] = useState('');
  const [pBlood, setPBlood] = useState('');
  const [pStatus, setPStatus] = useState('');

  // Report Form (SAME)
  const [reportForm, setReportForm] = useState({
    hemoglobin: '', rbc_count: '', wbc_count: '', platelets: '', hematocrit: '', mcv: '', mch: '', mchc: '', rdw: '', neutrophils: '', lymphocytes: '', monocytes: '', eosinophils: '', basophils: '',
    alt: '', ast: '', alp: '', bilirubin: '', direct_bilirubin: '', total_protein: '', albumin: '', globulin: '', ag_ratio: '',
    urea: '', creatinine: '', bun: '', bun_creatinine_ratio: '', uric_acid: '', egfr: '',
    fasting_sugar: '', post_prandial_sugar: '', hba1c: '', random_sugar: '',
    iron: '', tibc: '', ferritin: '', transferrin_sat: '',
    tsh: '', t3: '', t4: '', free_t3: '', free_t4: ''
  });

  const [rStatus, setRStatus] = useState('Analyze & Save Report');

  // 🔥 Changed chatbot text
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState([
    { text: "Hello! I am CoreBot 🤖 from HealthCore AI. Enter patient data and I’ll provide smart medical insights.", isAi: true }
  ]);

  const messagesEndRef = useRef(null);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // 🔥 Changed storage key
  useEffect(() => {
    const savedId = localStorage.getItem('health_patient_id');
    if (savedId) {
      axios.get(`${API_BASE}/patients/${savedId}`)
        .then(res => {
          setPatientId(savedId);
          setPatientDetails(res.data);
          return axios.get(`${API_BASE}/patients/${savedId}/reports/`);
        })
        .then(res => {
          if (res && res.data && res.data.length > 0) {
            setReportData(res.data[res.data.length - 1]);
          }
        })
        .catch(() => {
          localStorage.removeItem('health_patient_id');
        });
    }
  }, []);

  const handleCreatePatient = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${API_BASE}/patients/`, {
        name: pName, age: Number(pAge), gender: pGender, blood_group: pBlood
      });
      setPatientId(res.data.id || res.data._id);
      setPatientDetails(res.data);

      // 🔥 Changed key
      localStorage.setItem('health_patient_id', res.data.id || res.data._id);

      setPStatus('Patient created successfully!');
    } catch {
      setPStatus('Error saving patient.');
    }
  };

  const handleReportChange = (e) => {
    setReportForm({ ...reportForm, [e.target.name]: e.target.value });
  };

  const handleSubmitReport = async (e) => {
    e.preventDefault();
    if (!patientId) return;
    try {
      setRStatus('Analyzing...');
      const payload = {};
      Object.keys(reportForm).forEach(k => {
        if (reportForm[k] !== '') payload[k] = parseFloat(reportForm[k]);
      });
      const res = await axios.post(`${API_BASE}/patients/${patientId}/reports/`, payload);
      setReportData(res.data);
      setRStatus('Report Saved & Analyzed');
      setActiveTab('analysis');
      setTimeout(() => setRStatus('Update Report'), 2000);
    } catch {
      setRStatus('Error saving!');
    }
  };

  const handleChat = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const msg = chatInput;
    setMessages(prev => [...prev, { text: msg, isAi: false }]);
    setChatInput('');
    try {
      const res = await axios.post(`${API_BASE}/chat`, { message: msg, patient_id: patientId || null });
      setMessages(prev => [...prev, { text: res.data.reply, isAi: true }]);
    } catch {
      setMessages(prev => [...prev, { text: "Network error querying AI.", isAi: true }]);
    }
  };

  return (
    <div className="app-container">

      {/* Sidebar */}
      <aside className="sidebar glass-panel">
        <div className="sidebar-header">
          <h2>HealthCore AI</h2> {/* 🔥 changed */}
        </div>

        <form onSubmit={handleCreatePatient}>
          <input placeholder="Name" value={pName} onChange={e => setPName(e.target.value)} required />
          <input type="number" placeholder="Age" value={pAge} onChange={e => setPAge(e.target.value)} required />
          <input placeholder="Gender" value={pGender} onChange={e => setPGender(e.target.value)} required />
          <input placeholder="Blood Group" value={pBlood} onChange={e => setPBlood(e.target.value)} required />
          <button type="submit">Save Patient</button>
          <p>{pStatus}</p>
        </form>
      </aside>

      {/* Main */}
      <main className="main-content">

        <h1>HealthCore Dashboard</h1>

        <form onSubmit={handleSubmitReport}>
          <input name="hemoglobin" placeholder="Hemoglobin" onChange={handleReportChange} />
          <button type="submit">{rStatus}</button>
        </form>

        {/* Chat */}
        <div className="chat-box">
          {messages.map((m, i) => (
            <div key={i}>{m.text}</div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleChat}>
          <input value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Ask health question..." />
          <button type="submit">Send</button>
        </form>

      </main>
    </div>
  );
}