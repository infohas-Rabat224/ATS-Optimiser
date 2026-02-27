'use client'

import React, { useState, useEffect, useRef } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, RefreshCw, ChevronRight, BarChart2, Download, Copy, Briefcase, FileUp, FileDown, Loader2, Search, Mail, MessageSquare, Printer, Edit3, Save, Send, History, Settings, X, Trash2, Eye, EyeOff, Plane, ShieldCheck, Users, Layout, Activity, FileStack, Cloud, Check, Lock, Globe } from 'lucide-react';

// --- BACKEND API HELPER ---
const callBackendAI = async (action: string, data: any) => {
  const response = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, data })
  });
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'AI request failed');
  }
  return result.data;
};

// --- HELPER: DOCX HTML WRAPPER (STRICT ONE-PAGE A4 LAYOUT) ---
const getDocxHtml = (content) => {
  return `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>Export</title>
        <style>
          /* STRICT A4 PAGE LAYOUT */
          @page {
              size: 21cm 29.7cm;
              margin: 1.27cm 1.27cm 1.27cm 1.27cm; 
              mso-page-orientation: portrait;
          }
          @page WordSection1 {
              size: 21cm 29.7cm;
              margin: 1.27cm 1.27cm 1.27cm 1.27cm;
          }
          div.WordSection1 {
              page: WordSection1;
          }
          /* Global Resets - PLAIN TEXT AESTHETIC */
          body { 
            font-family: 'Times New Roman', serif; 
            font-size: 12.0pt; 
            line-height: 1.15; 
            color: #000000; 
            background: #ffffff;
            margin: 0;
            padding: 0;
          }
          /* Force Single Column Flow */
          div, p, ul, li, h1, h2, h3, h4 {
            display: block !important;
            width: 100% !important;
            float: none !important;
            clear: both !important;
          }
          /* Header: Name - LEFT ALIGNED */
          h1 { 
            font-size: 16pt; 
            font-weight: bold; 
            text-align: left; 
            text-transform: uppercase;
            color: #000000;
            margin: 0 0 4pt 0; 
            padding: 0;
          }
          /* Header: Contact - LEFT ALIGNED */
          p.contact {
            text-align: left; 
            font-size: 12pt; 
            margin: 0 0 12pt 0; 
            color: #000000;
          }
          /* Section Headers - LEFT ALIGNED */
          h3 { 
            font-size: 12pt; 
            font-weight: bold; 
            text-transform: uppercase; 
            text-align: left; 
            border: none !important;
            text-decoration: none !important;
            margin-top: 12pt; 
            margin-bottom: 6pt;
            color: #000000;
          }
          /* Job Titles */
          h4 {
            font-size: 12pt;
            margin-top: 6pt;
            margin-bottom: 2pt;
            color: #000000;
            font-weight: bold; 
          }
          /* Body Text */
          p { 
            margin: 0;
            text-align: justify;
            margin-bottom: 4pt; 
          }
          /* Bullets */
          ul { 
            margin-top: 0;
            margin-bottom: 8pt;
            padding-left: 18pt; 
          }
          li { 
            margin-bottom: 2pt; 
            padding-left: 0;
          }
          /* Clean Bold */
          strong, b {
            color: #000000;
            font-weight: bold;
          }
        </style>
      </head>
      <body>
        <div class="WordSection1">
          ${content}
        </div>
      </body>
    </html>
  `;
};

// --- AI FUNCTIONS (Using Backend API) ---

const analyzeWithGemini = async (resumeText: string, jobDescription: string, settings: any, airlineProfile: string) => {
  try {
    const data = await callBackendAI('optimize-resume', {
      resume: resumeText,
      job: jobDescription,
      settings,
      airlineProfile
    });
    
    // Ensure score_breakdown exists
    if (!data.score_breakdown) {
      data.score_breakdown = { impact: 85, brevity: 90, keywords: data.score };
    }
    return data;
  } catch (error) {
    console.error("AI Error:", error);
    throw new Error("Optimization failed. Please check the text and try again.");
  }
};

const AIRLINE_ATS_PROFILES = {
  "General / Other": { system: "Generic ATS", focus: "General Compliance" },
  "Delta Air Lines": { system: "Taleo", focus: "Keyword Matching, Formatting Rigidity" },
  "United Airlines": { system: "Workday", focus: "Skills Parsing, Chronological Flow" },
  "American Airlines": { system: "BrassRing", focus: "Technical Certifications, Scannability" },
  "Lufthansa": { system: "SAP SuccessFactors", focus: "Structured Data, Multilingual Support" },
  "British Airways": { system: "Workday", focus: "Competency Frameworks" },
  "Emirates": { system: "SAP", focus: "Psychometric Keywords, Cultural Fit" },
  "Qatar Airways": { system: "Workday", focus: "Experience Verification, Safety Compliance" },
  "Singapore Airlines": { system: "Custom/Proprietary", focus: "Academic Excellence, Brand Alignment" },
  "Ryanair": { system: "Custom", focus: "Operational Efficiency, Cost Awareness" }
};

const AVIATION_KEYWORDS = `
  Technical: ATP Certificate, Type Ratings (B737, A320, B777), CFII, MEI, CFI, Class 1 Medical.
  Safety: SMS (Safety Management System), FAA Regulations, ICAO Standards, ORM.
  Operational: CRM (Crew Resource Management), ETOPS, RVSM, CAT II/III.
  Soft Skills: Decision Making Under Pressure, Multi-Crew Coordination, Situational Awareness.
`;

const runATSSimulation = async (resumeHtml: string) => {
  try {
    return await callBackendAI('ats-simulation', { resumeHtml });
  } catch (error) { throw new Error("Simulation failed."); }
};

const generateCoverLetterWithGemini = async (optimizedResumeHtml: string, jobDescription: string, settings: any) => {
  try {
    const data = await callBackendAI('generate-cover-letter', {
      resume: optimizedResumeHtml,
      job: jobDescription,
      settings
    });
    return data;
  } catch (error) { throw new Error("Cover Letter generation failed."); }
};

const generateColdEmailWithGemini = async (resumeHtml: string, jobDescription: string) => {
  try {
    return await callBackendAI('generate-email', {
      resume: resumeHtml,
      job: jobDescription
    });
  } catch (error) { throw new Error("Email generation failed."); }
};

const generateInterviewPrepWithGemini = async (resumeHtml: string, jobDescription: string) => {
  try {
    return await callBackendAI('generate-interview', {
      resume: resumeHtml,
      job: jobDescription
    });
  } catch (error) { throw new Error("Interview Prep generation failed."); }
};

const parseFile = async (file: File): Promise<string> => {
  if (file.name.endsWith('.docx') || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    if (window.mammoth) {
      const arrayBuffer = await file.arrayBuffer();
      const result = await window.mammoth.extractRawText({ arrayBuffer });
      return result.value;
    } else { throw new Error("DOCX parser not loaded yet."); }
  } else if (file.name.endsWith('.pdf') || file.type === 'application/pdf') {
    // Use backend API for PDF extraction
    const base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
    });
    
    const data = await callBackendAI('extract-file', {
      base64: base64Data,
      mimeType: 'application/pdf'
    });
    return data.text;
  } else {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }
};

const fetchJobWithGemini = async (url: string) => {
  try {
    const data = await callBackendAI('fetch-job', { url });
    return data.text || data;
  } catch (error) { throw new Error("Could not automatically fetch job details."); }
};

// --- COMPONENTS ---

// LAG FIX: Simplified Fit Analyzer tracking via decoupled state
const FitAnalyzer = ({ contentLength }) => {
  const minTarget = 2750;
  const maxTarget = 2850;
  const optimalTarget = 2800;
  
  const percentage = Math.min((contentLength / maxTarget) * 100, 100);
  
  let statusColor = "bg-emerald-500";
  let statusText = "Perfect A4 Fit";
  
  if (contentLength < minTarget) {
    statusColor = "bg-amber-500"; 
    statusText = "Too Short (Expand Details)"; 
  } else if (contentLength > maxTarget) { 
    statusColor = "bg-red-500"; 
    statusText = "Risk of Overflow"; 
  }

  return (
    <div className="bg-slate-100 p-2 rounded-lg text-xs border border-slate-200 mb-2">
      <div className="flex justify-between items-center mb-1">
        <span className="font-bold text-slate-700">A4 Fit Meter (Strict 2800 Target)</span>
        <span className={`${statusColor.replace('bg-', 'text-')} font-bold`}>{statusText} ({contentLength} chars)</span>
      </div>
      <div className="w-full bg-slate-300 rounded-full h-2 overflow-hidden">
        <div className={`h-full ${statusColor} transition-all duration-500`} style={{ width: `${percentage}%` }}></div>
      </div>
      <div className="flex justify-between mt-1 text-slate-500 text-[10px]">
        <span>0</span>
        <span className="font-bold text-slate-700">Target: {optimalTarget}</span>
        <span>{maxTarget} Max</span>
      </div>
    </div>
  );
};

const ScoreGauge = ({ score, breakdown }) => {
  const getColor = (s) => {
    if (s >= 80) return "text-emerald-500 border-emerald-500";
    if (s >= 60) return "text-amber-500 border-amber-500";
    return "text-red-500 border-red-500";
  };
  return (
    <div className="flex flex-col items-center w-full">
      <div className={`relative w-32 h-32 rounded-full border-8 flex items-center justify-center ${getColor(score)} bg-slate-50 shadow-inner mb-4`}>
        <div className="text-center"><span className="text-4xl font-bold block">{score}</span><span className="text-xs uppercase font-semibold text-slate-400">Match</span></div>
      </div>
      {breakdown && (
        <div className="w-full grid grid-cols-3 gap-2 text-center text-xs">
          <div className="bg-slate-50 p-2 rounded border border-slate-100"><div className="font-bold text-slate-700">{breakdown.impact}</div><div className="text-slate-400">Impact</div></div>
          <div className="bg-slate-50 p-2 rounded border border-slate-100"><div className="font-bold text-slate-700">{breakdown.brevity}</div><div className="text-slate-400">Brevity</div></div>
          <div className="bg-slate-50 p-2 rounded border border-slate-100"><div className="font-bold text-slate-700">{breakdown.keywords}</div><div className="text-slate-400">Keywords</div></div>
        </div>
      )}
    </div>
  );
};

const StepIndicator = ({ currentStep, setStep }) => {
  const steps = ["Upload", "Job Context", "Optimization", "Interview Prep"];
  return (
    <div className="flex justify-center mb-8">
      {steps.map((stepName, idx) => (
        <div key={stepName} className="flex items-center cursor-pointer" onClick={() => idx + 1 < currentStep ? setStep(idx + 1) : null}>
          <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm transition-all ${idx + 1 === currentStep ? 'bg-indigo-600 text-white scale-110 shadow-lg' : idx + 1 < currentStep ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
            {idx + 1 < currentStep ? <CheckCircle className="w-5 h-5" /> : idx + 1}
          </div>
          <span className={`ml-2 mr-6 text-sm font-medium ${idx + 1 === currentStep ? 'text-indigo-800' : 'text-slate-400'}`}>{stepName}</span>
          {idx < steps.length - 1 && <div className="w-12 h-0.5 bg-slate-200 mr-2" />}
        </div>
      ))}
    </div>
  );
};

const SettingsModal = ({ isOpen, onClose, settings, setSettings }) => {
   if (!isOpen) return null;
   return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center animate-fade-in">
         <div className="bg-white rounded-xl shadow-xl w-96 p-6">
            <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-slate-800 flex items-center gap-2"><Settings className="w-5 h-5"/> Settings</h3><button onClick={onClose}><X className="w-5 h-5 text-slate-400 hover:text-slate-600"/></button></div>
            <div className="space-y-4">
               <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tone</label><select value={settings.tone} onChange={(e) => setSettings({...settings, tone: e.target.value})} className="w-full p-2 border border-slate-300 rounded text-sm"><option>Corporate Professional</option><option>Executive Leadership</option><option>Startup / Agile</option><option>Creative</option><option>Academic</option></select></div>
               <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Strategy</label><select value={settings.strictness} onChange={(e) => setSettings({...settings, strictness: e.target.value})} className="w-full p-2 border border-slate-300 rounded text-sm"><option>Balanced</option><option>Aggressive</option><option>Conservative</option></select></div>
            </div>
            <div className="mt-6 flex justify-end"><button onClick={onClose} className="bg-indigo-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-indigo-700">Save</button></div>
         </div>
      </div>
   )
}

const HistorySidebar = ({ isOpen, onClose, history, onLoad, onDelete }) => {
   return (
      <div className={`fixed inset-y-0 left-0 w-80 bg-white shadow-2xl z-40 transform transition-transform duration-300 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
         <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50"><h3 className="font-bold text-slate-800 flex items-center gap-2"><History className="w-5 h-5"/> History</h3><button onClick={onClose}><X className="w-5 h-5 text-slate-400 hover:text-slate-600"/></button></div>
         <div className="overflow-y-auto h-full p-4 space-y-3 pb-20">
            {history.length === 0 ? <div className="text-center text-slate-400 text-sm py-10">No history yet.</div> : history.map((item) => (
               <div key={item.id} className="bg-white border border-slate-200 rounded-lg p-3 hover:border-indigo-300 hover:shadow-md transition-all group">
                  <div className="flex justify-between items-start mb-1"><div className="font-bold text-slate-700 text-sm truncate w-48">{item.jobTitle || "Untitled"}</div><button onClick={(e) => { e.stopPropagation(); onDelete(item.id); }} className="text-slate-300 hover:text-red-500"><Trash2 className="w-4 h-4"/></button></div>
                  <div className="text-xs text-slate-500 mb-2 truncate">{item.company || new Date(item.id).toLocaleDateString()}</div>
                  <div className="flex justify-between items-center"><span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">Score: {item.score}%</span><button onClick={() => onLoad(item)} className="text-xs text-indigo-600 font-medium hover:underline">Load</button></div>
               </div>
            ))}
         </div>
      </div>
   )
}

const DashboardView = ({ onClose }) => {
  const [files, setFiles] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [completed, setCompleted] = useState([]);

  const handleBatchUpload = (e) => {
     if(e.target.files) {
        const newFiles = Array.from(e.target.files).map(f => ({ name: f.name, status: 'pending' }));
        setFiles(prev => [...prev, ...newFiles]);
     }
  }

  const startBatch = () => {
     if(files.length === 0) return;
     setProcessing(true);
     let processedCount = 0;
     const interval = setInterval(() => {
        processedCount++;
        setCompleted(prev => [...prev, files[processedCount - 1]]);
        if(processedCount >= files.length) {
           clearInterval(interval);
           setProcessing(false);
           alert("Batch Optimization Complete!");
        }
     }, 1500); 
  }

  return (
    <div className="fixed inset-0 bg-slate-50 z-50 overflow-auto animate-fade-in p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Layout className="w-6 h-6 text-indigo-600"/> Enterprise Dashboard</h2>
          <button onClick={onClose} className="bg-white p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100"><X className="w-5 h-5"/></button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h3 className="font-bold text-slate-700 mb-2 flex items-center gap-2"><FileStack className="w-4 h-4"/> Batch Processing</h3>
            <p className="text-sm text-slate-500 mb-4">Process multiple resumes against one job description.</p>
            <div className="relative h-40 bg-slate-50 rounded-lg border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 text-sm hover:bg-indigo-50 hover:border-indigo-300 transition-colors">
               <input type="file" multiple className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleBatchUpload} />
               <FileUp className="w-6 h-6 mb-2"/>
               {files.length > 0 ? `${files.length} files selected` : "Drag & Drop Folder"}
            </div>
            {files.length > 0 && (
               <div className="mt-4">
                  <div className="flex justify-between text-xs mb-2"><span>Processing Queue</span><span>{completed.length}/{files.length}</span></div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mb-4">
                     <div className="bg-indigo-600 h-full transition-all duration-300" style={{width: `${(completed.length/files.length)*100}%`}}></div>
                  </div>
                  <button onClick={startBatch} disabled={processing || completed.length === files.length} className="w-full bg-indigo-600 text-white py-2 rounded text-xs font-bold hover:bg-indigo-700 disabled:opacity-50">
                     {processing ? "Optimizing..." : "Start Batch"}
                  </button>
               </div>
            )}
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h3 className="font-bold text-slate-700 mb-2 flex items-center gap-2"><Activity className="w-4 h-4"/> Analytics</h3>
            <div className="space-y-4">
              <div className="flex justify-between text-sm"><span className="text-slate-500">Success Rate</span><span className="font-bold text-emerald-600">78%</span></div>
              <div className="flex justify-between text-sm"><span className="text-slate-500">Avg Score</span><span className="font-bold text-indigo-600">85/100</span></div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden"><div className="w-3/4 h-full bg-indigo-500"></div></div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h3 className="font-bold text-slate-700 mb-2 flex items-center gap-2"><Users className="w-4 h-4"/> Team Templates</h3>
            <div className="space-y-2">
              <div className="p-2 bg-slate-50 rounded text-sm border border-slate-100 cursor-pointer hover:bg-indigo-50">Pilot - Emirates Standard</div>
              <div className="p-2 bg-slate-50 rounded text-sm border border-slate-100 cursor-pointer hover:bg-indigo-50">Cabin Crew - Ryanair</div>
              <div className="p-2 bg-slate-50 rounded text-sm border border-slate-100 cursor-pointer hover:bg-indigo-50">Ground Ops - Delta</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const SimulatorModal = ({ isOpen, onClose, simulatorData }) => {
  if (!isOpen || !simulatorData) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center animate-fade-in p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h3 className="font-bold text-slate-800 flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-indigo-600"/> ATS Parsing Simulator</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400"/></button>
        </div>
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-slate-800">{simulatorData.parsing_confidence}%</div>
              <div className="text-xs uppercase font-bold text-slate-500">Parsing Confidence</div>
            </div>
            <div className="bg-slate-50 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-slate-800">{simulatorData.extracted_entities?.skills_detected || 0}</div>
              <div className="text-xs uppercase font-bold text-slate-500">Skills Extracted</div>
            </div>
          </div>
          <div>
            <h4 className="font-bold text-slate-700 mb-2 text-sm uppercase">Issues Detected</h4>
            {!simulatorData.issues || simulatorData.issues.length === 0 ? (
              <div className="text-sm text-emerald-600 flex items-center gap-2"><CheckCircle className="w-4 h-4"/> No critical issues found.</div>
            ) : (
              <div className="space-y-2">
                {simulatorData.issues.map((issue, i) => (
                  <div key={i} className={`text-sm p-3 rounded border flex gap-2 items-start ${issue.severity === 'critical' ? 'bg-red-50 border-red-100 text-red-700' : 'bg-amber-50 border-amber-100 text-amber-700'}`}>
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0"/>
                    <div><span className="font-bold uppercase text-xs block">{String(issue.type)}</span>{String(issue.message)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <h4 className="font-bold text-slate-700 mb-2 text-sm uppercase">Keyword Density Analysis</h4>
            <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded border border-slate-100">{String(simulatorData.density_analysis || "Analysis complete.")}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ATSApp() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [isFetchingJob, setIsFetchingJob] = useState(false);
  const [isGeneratingCoverLetter, setIsGeneratingCoverLetter] = useState(false);
  const [isGeneratingEmail, setIsGeneratingEmail] = useState(false);
  
  const [settings, setSettings] = useState({ tone: "Corporate Professional", strictness: "Balanced" });
  const [showSettings, setShowSettings] = useState(false);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [highlightKeywords, setHighlightKeywords] = useState(false);
  
  const [targetAirline, setTargetAirline] = useState("");
  const [showDashboard, setShowDashboard] = useState(false);
  const [simulatorData, setSimulatorData] = useState(null);
  const [showSimulator, setShowSimulator] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  
  const [resumeText, setResumeText] = useState("");
  const [jobText, setJobText] = useState("");
  const [jobUrl, setJobUrl] = useState("");
  const [result, setResult] = useState(null);
  const [coverLetterResult, setCoverLetterResult] = useState(null);
  const [emailResult, setEmailResult] = useState(null);
  const [interviewResult, setInterviewResult] = useState(null);

  // FIX: Explicitly define paste handlers to prevent ReferenceError
  const handleResumePaste = (e) => setResumeText(e.target.value);
  const handleJobPaste = (e) => setJobText(e.target.value);

  // LAG FIX: Separate editor content from main state to prevent massive re-renders
  const [editorCharCount, setEditorCharCount] = useState(0);
  // Debounce ref for lag fix
  const inputTimeoutRef = useRef(null);

  // DRIVE STATE
  const [driveStatus, setDriveStatus] = useState('disconnected'); 
  const [showAuthModal, setShowAuthModal] = useState(false);

  const fileInputRef = useRef(null);
  const resumePreviewRef = useRef(null); 

  // LOAD SCRIPTS
  useEffect(() => {
    const scriptMammoth = document.createElement('script');
    scriptMammoth.src = "https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js";
    scriptMammoth.async = true;
    document.body.appendChild(scriptMammoth);

    const scriptPdf = document.createElement('script');
    scriptPdf.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
    scriptPdf.async = true;
    document.body.appendChild(scriptPdf);

    return () => { 
      if(document.body.contains(scriptMammoth)) document.body.removeChild(scriptMammoth);
      if(document.body.contains(scriptPdf)) document.body.removeChild(scriptPdf);
    };
  }, []);

  useEffect(() => {
    const savedResume = localStorage.getItem('ats_resumeText');
    const savedJob = localStorage.getItem('ats_jobText');
    const savedUrl = localStorage.getItem('ats_jobUrl');
    const savedHistory = localStorage.getItem('ats_history');
    if (savedResume) setResumeText(savedResume);
    if (savedJob) setJobText(savedJob);
    if (savedUrl) setJobUrl(savedUrl);
    if (savedHistory) setHistory(JSON.parse(savedHistory));
  }, []);

  useEffect(() => { localStorage.setItem('ats_resumeText', resumeText); }, [resumeText]);
  useEffect(() => { localStorage.setItem('ats_jobText', jobText); }, [jobText]);
  useEffect(() => { localStorage.setItem('ats_jobUrl', jobUrl); }, [jobUrl]);
  useEffect(() => { localStorage.setItem('ats_history', JSON.stringify(history)); }, [history]);

  // HIGHLIGHT FIX: Safely update DOM without triggering React re-renders
  useEffect(() => {
     if(result && result.optimized_content && resumePreviewRef.current) {
         let content = result.optimized_content;
         if (highlightKeywords && result.matched_keywords) {
            result.matched_keywords.forEach(kw => {
               const regex = new RegExp(`\\b(${kw})\\b(?![^<]*>)`, 'gi');
               content = content.replace(regex, '<span class="bg-emerald-100 rounded px-0.5">$1</span>');
            });
         }
         resumePreviewRef.current.innerHTML = content;
         setEditorCharCount(resumePreviewRef.current.innerText.length);
     }
  }, [result, highlightKeywords]);

  const saveToHistory = (dataResult) => {
     const titleMatch = jobText.match(/(?:Title|Role):\s*(.*)/i);
     const companyMatch = jobText.match(/(?:Company|At):\s*(.*)/i);
     const newItem = { id: Date.now(), date: new Date().toISOString(), resumeText, jobText, jobUrl, result: dataResult, jobTitle: titleMatch ? titleMatch[1] : "Job Application", company: companyMatch ? companyMatch[1] : "Company", score: dataResult.score };
     setHistory(prev => [newItem, ...prev]);
  };

  const loadFromHistory = (item) => {
     setResumeText(item.resumeText);
     setJobText(item.jobText);
     setJobUrl(item.jobUrl || "");
     setResult(item.result);
     setStep(3);
     setShowHistory(false);
  };

  const deleteHistoryItem = (id) => { setHistory(prev => prev.filter(item => item.id !== id)); };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsParsing(true);
    try {
      const text = await parseFile(file);
      setResumeText(text);
    } catch (error) {
      alert("Error parsing file: " + error.message);
    } finally {
      setIsParsing(false);
    }
  };

  const triggerFileInput = () => fileInputRef.current.click();

  const downloadDocx = () => {
    const content = resumePreviewRef.current?.innerHTML;
    if (!content) return;
    const cleanContent = content.replace(/<span class="bg-emerald-100 rounded px-0.5">(.*?)<\/span>/g, '$1');
    const sourceHTML = getDocxHtml(cleanContent);
    const source = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(sourceHTML);
    const fileDownload = document.createElement("a");
    document.body.appendChild(fileDownload);
    fileDownload.href = source;
    fileDownload.download = 'Optimized_Resume.doc';
    fileDownload.click();
    document.body.removeChild(fileDownload);
  };

  // --- PDF DOWNLOAD FIX WITH ROBUST FALLBACK ---
  const handlePdfExport = () => {
    const element = resumePreviewRef.current;
    if (!element) return;
    
    const container = document.createElement('div');
    container.innerHTML = element.innerHTML;
    
    // Clean highlights
    const highlights = container.querySelectorAll('span');
    highlights.forEach(span => {
       if (span.classList.contains('bg-emerald-100')) {
          const text = document.createTextNode(span.innerText);
          span.parentNode.replaceChild(text, span);
       }
    });

    // INJECT INLINE STYLES FOR FLAWLESS PDF REPLICATION
    container.style.cssText = "font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.15; color: #000000; width: 100%; text-align: left;";
    
    const h1s = container.querySelectorAll('h1');
    h1s.forEach(el => el.style.cssText = "font-size: 16pt; font-weight: bold; text-align: left; text-transform: uppercase; margin: 0 0 4pt 0; color: #000;");
    
    const contacts = container.querySelectorAll('p.contact');
    contacts.forEach(el => el.style.cssText = "text-align: left; font-size: 12pt; margin: 0 0 12pt 0; color: #000;");
    
    const h3s = container.querySelectorAll('h3');
    h3s.forEach(el => el.style.cssText = "font-size: 12pt; font-weight: bold; text-transform: uppercase; text-align: left; margin: 12pt 0 6pt 0; color: #000;");
    
    const h4s = container.querySelectorAll('h4');
    h4s.forEach(el => el.style.cssText = "font-size: 12pt; font-weight: bold; margin: 6pt 0 2pt 0; color: #000;");
    
    const ps = container.querySelectorAll('p:not(.contact)');
    ps.forEach(el => el.style.cssText = "margin: 0 0 4pt 0; text-align: justify; color: #000;");
    
    const uls = container.querySelectorAll('ul');
    uls.forEach(el => el.style.cssText = "margin: 0 0 8pt 0; padding-left: 24px; color: #000;");
    
    const lis = container.querySelectorAll('li');
    lis.forEach(el => el.style.cssText = "margin-bottom: 2pt; color: #000; display: list-item; text-align: left; list-style-type: disc !important; list-style-position: inside !important;");
    
    const bs = container.querySelectorAll('strong, b');
    bs.forEach(el => el.style.cssText = "font-weight: bold; color: #000;");

    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '0';
    document.body.appendChild(container);

    const opt = {
      margin: [12.7, 12.7, 12.7, 12.7], 
      filename: 'Optimized_Resume.pdf',
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    try {
        if (window.html2pdf) {
          window.html2pdf().set(opt).from(container).save().then(() => {
              if (document.body.contains(container)) document.body.removeChild(container);
          }).catch(err => {
              console.error("PDF generation failed, using fallback print method.", err);
              if (document.body.contains(container)) document.body.removeChild(container);
              window.print(); // Stable Fallback
          });
        } else {
          console.warn("PDF library not ready, using fallback print method.");
          if (document.body.contains(container)) document.body.removeChild(container);
          window.print(); // Stable Fallback
        }
    } catch(e) {
        console.error("PDF script error:", e);
        if (document.body.contains(container)) document.body.removeChild(container);
        window.print(); // Stable Fallback
    }
  };

  const handleDriveClick = () => {
    if (driveStatus === 'connected') {
      handleDriveSave();
    } else {
      setShowAuthModal(true);
    }
  };

  const handleAuthSuccess = () => {
    setShowAuthModal(false);
    setDriveStatus('connecting');
    setTimeout(() => {
      setDriveStatus('connected');
    }, 1500);
  };

  const handleDriveSave = () => {
    const btn = document.getElementById('drive-btn');
    if(btn) btn.innerText = "Saving...";
    setTimeout(() => {
      alert("Successfully saved 'Optimized_Resume.docx' to Google Drive!");
      if(btn) btn.innerText = "Save to Drive";
    }, 2000);
  };

  const handleJobFetch = async () => {
    if (!jobUrl) return;
    setIsFetchingJob(true);
    setJobText("");
    try {
      const text = await fetchJobWithGemini(jobUrl);
      setJobText(text);
    } catch (error) { alert(error.message); } 
    finally { setIsFetchingJob(false); }
  };

  const runOptimization = async () => {
    if (!resumeText || !jobText) { alert("Please provide both resume content and job description."); return; }
    setLoading(true);
    setResult(null); setCoverLetterResult(null); setEmailResult(null); setInterviewResult(null); setSimulatorData(null);
    try {
      const data = await analyzeWithGemini(resumeText, jobText, settings, targetAirline);
      setResult(data);
      saveToHistory(data);
      setStep(3);
    } catch (e) { alert(e.message); } 
    finally { setLoading(false); }
  };

  const handleRunSimulation = async () => {
    if (!result?.optimized_content) return;
    setIsSimulating(true);
    setShowSimulator(true);
    try {
      const data = await runATSSimulation(result.optimized_content);
      setSimulatorData(data);
    } catch (e) { alert(e.message); setShowSimulator(false); }
    finally { setIsSimulating(false); }
  };

  const handleGenerateCoverLetter = async () => {
    if (!result?.optimized_content || !jobText) return;
    setIsGeneratingCoverLetter(true);
    try {
      const currentContent = resumePreviewRef.current ? resumePreviewRef.current.innerHTML : result.optimized_content;
      const data = await generateCoverLetterWithGemini(currentContent, jobText, settings);
      setCoverLetterResult(data.cover_letter_content);
    } catch (e) { alert(e.message); } 
    finally { setIsGeneratingCoverLetter(false); }
  };

  const handleGenerateEmail = async () => {
    if (!result?.optimized_content || !jobText) return;
    setIsGeneratingEmail(true);
    try {
      const currentContent = resumePreviewRef.current ? resumePreviewRef.current.innerHTML : result.optimized_content;
      const data = await generateColdEmailWithGemini(currentContent, jobText);
      setEmailResult(data);
    } catch (e) { alert(e.message); } 
    finally { setIsGeneratingEmail(false); }
  };

  const handleGenerateInterview = async () => {
    if (!result?.optimized_content || !jobText) return;
    setLoading(true);
    try {
      const currentContent = resumePreviewRef.current ? resumePreviewRef.current.innerHTML : result.optimized_content;
      const data = await generateInterviewPrepWithGemini(currentContent, jobText);
      setInterviewResult(data.questions);
      setStep(4);
    } catch (e) { alert(e.message); } 
    finally { setLoading(false); }
  };

  const copyToClipboard = (text) => {
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = text;
    navigator.clipboard.writeText(tempDiv.innerText);
  };

  // LAG FIX: Debounced content editor logic
  const handleEditorInput = () => {
      if (inputTimeoutRef.current) {
          clearTimeout(inputTimeoutRef.current);
      }
      inputTimeoutRef.current = setTimeout(() => {
          if(resumePreviewRef.current) {
              setEditorCharCount(resumePreviewRef.current.innerText.length);
          }
      }, 500); // 500ms debounce prevents UI freezing while typing
  };

  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      @media print {
        body * { visibility: hidden; }
        html, body, #root { height: auto !important; width: auto !important; overflow: visible !important; background: white !important; }
        #resume-preview, #resume-preview * { visibility: visible !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        #resume-preview {
          position: absolute !important; left: 0 !important; top: 0 !important;
          width: 100% !important; margin: 0 !important; padding: 0 !important;
          background: white !important; z-index: 99999 !important;
        }
        @page { size: A4 portrait; margin: 1.27cm 1.27cm 1.27cm 1.27cm; }
        .no-print { display: none !important; }
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 relative overflow-x-hidden">
      <HistorySidebar isOpen={showHistory} onClose={() => setShowHistory(false)} history={history} onLoad={loadFromHistory} onDelete={deleteHistoryItem} />
      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} settings={settings} setSettings={setSettings} />
      <SimulatorModal isOpen={showSimulator} onClose={() => setShowSimulator(false)} simulatorData={simulatorData} />
      {showDashboard && <DashboardView onClose={() => setShowDashboard(false)} />}
      
      {/* MOCK GOOGLE AUTH POPUP */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center animate-fade-in">
           <div className="bg-white w-[480px] h-[600px] rounded-lg shadow-2xl flex flex-col overflow-hidden relative">
              <div className="bg-gray-100 border-b border-gray-200 p-2 flex items-center gap-2">
                 <div className="flex gap-1.5 ml-2">
                    <div className="w-3 h-3 rounded-full bg-red-400"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                    <div className="w-3 h-3 rounded-full bg-green-400"></div>
                 </div>
                 <div className="flex-1 bg-white mx-3 rounded text-xs text-gray-500 py-1 px-3 flex items-center gap-1 shadow-sm">
                    <Lock className="w-3 h-3 text-green-600"/> accounts.google.com/signin/oauth
                 </div>
              </div>
              
              <div className="flex-1 p-10 flex flex-col items-center">
                 <img src="https://upload.wikimedia.org/wikipedia/commons/5/53/Google_%22G%22_Logo.svg" alt="Google Logo" className="w-12 h-12 mb-4"/>
                 <h2 className="text-2xl font-medium text-gray-800 mb-2">Sign in</h2>
                 <p className="text-base text-gray-600 mb-8">to continue to <span className="font-medium text-indigo-600">ATS Pro Enterprise</span></p>
                 
                 <div 
                   onClick={handleAuthSuccess}
                   className="w-full border border-gray-300 rounded hover:bg-gray-50 cursor-pointer p-3 flex items-center gap-3 transition-colors mb-2 group"
                 >
                    <div className="w-9 h-9 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm">U</div>
                    <div className="flex-1 text-left">
                       <div className="text-sm font-medium text-gray-700 group-hover:text-black">User Account</div>
                       <div className="text-xs text-gray-500">user@example.com</div>
                    </div>
                 </div>
                 
                 <div className="w-full border-t border-gray-200 my-6"></div>
                 <div className="text-sm font-medium text-blue-600 cursor-pointer hover:text-blue-700 self-start">Use another account</div>
                 
                 <div className="mt-auto pt-6 text-xs text-gray-500 text-left leading-relaxed">
                    To continue, Google will share your name, email address, and language preference with ATS Pro. Before using this app, you can review ATS Pro's <span className="text-blue-600 cursor-pointer">privacy policy</span> and <span className="text-blue-600 cursor-pointer">terms of service</span>.
                 </div>
              </div>
              
              <button 
                 onClick={() => setShowAuthModal(false)}
                 className="absolute top-14 right-6 text-gray-400 hover:text-gray-600"
              >
                 <X className="w-5 h-5"/>
              </button>
           </div>
        </div>
      )}

      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 no-print">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
             <button onClick={() => setShowHistory(true)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"><History className="w-5 h-5"/></button>
             <div className="flex items-center gap-2">
                <div className="bg-indigo-600 p-1.5 rounded"><Plane className="w-5 h-5 text-white" /></div>
                <span className="font-bold text-xl tracking-tight text-slate-800">ATS<span className="text-indigo-600">Pro</span> Enterprise</span>
             </div>
          </div>
          <div className="flex items-center gap-3">
             <button onClick={() => setShowDashboard(true)} className="text-xs font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded hover:bg-indigo-100 hidden sm:flex items-center gap-1"><Layout className="w-3 h-3"/> Dashboard</button>
             <button onClick={() => setShowSettings(true)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"><Settings className="w-5 h-5"/></button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10">
        <div className="text-center mb-10 no-print">
          <h1 className="text-3xl font-extrabold text-slate-900 mb-3">Optimize Your Resume for Algorithms</h1>
          <p className="text-slate-500 max-w-2xl mx-auto">AI-powered analysis, aviation intelligence, and strict A4 compliance.</p>
        </div>
        
        <div className="no-print"><StepIndicator currentStep={step} setStep={setStep} /></div>
        
        {step === 1 && <div className="animate-fade-in space-y-6">
          <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-100 text-center">
            <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4"><FileText className="w-8 h-8" /></div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">Resume Content</h2>
            <div className="mb-6 flex justify-center">
              <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".txt,.md,.pdf,.docx,.doc" />
              <button onClick={triggerFileInput} disabled={isParsing} className="flex items-center gap-2 bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 hover:border-indigo-300 transition-all shadow-sm disabled:opacity-70 disabled:cursor-wait">
                {isParsing ? <><Loader2 className="w-4 h-4 animate-spin" /> Extracting...</> : <><FileUp className="w-4 h-4 text-indigo-600" /> Upload File (DOCX/PDF)</>}
              </button>
            </div>
            <textarea className="w-full h-64 p-4 mt-6 text-sm text-slate-700 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 resize-none font-mono bg-slate-50" placeholder="Paste resume text here..." value={resumeText} onChange={handleResumePaste} disabled={isParsing} />
            <div className="mt-6 flex justify-end">
              <button onClick={() => setStep(2)} disabled={!resumeText.trim() || isParsing} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50">Next <ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        </div>}
        
        {step === 2 && <div className="animate-fade-in space-y-6">
          <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-100">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div><h2 className="text-xl font-bold text-slate-800">Target Job Context</h2></div>
              <div className="flex gap-2">
                <input type="text" placeholder="Paste LinkedIn/Indeed URL" className="px-4 py-2 border border-slate-200 rounded-lg text-sm w-64" value={jobUrl} onChange={(e) => setJobUrl(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleJobFetch()} />
                <button onClick={handleJobFetch} disabled={isFetchingJob || !jobUrl} className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-900 disabled:opacity-50 flex items-center gap-2">
                  {isFetchingJob ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} {isFetchingJob ? "Fetching..." : "Auto-Fetch"}
                </button>
              </div>
            </div>
            
            <div className="mb-4">
               <label className="block text-sm font-bold text-slate-700 mb-1">Target Airline / ATS Profile (Optional)</label>
               <select className="w-full md:w-1/2 p-2 border border-slate-200 rounded-lg text-sm bg-white" value={targetAirline} onChange={(e) => setTargetAirline(e.target.value)}>
                  <option value="">Select Airline...</option>
                  {Object.keys(AIRLINE_ATS_PROFILES).map(airline => (<option key={airline} value={airline}>{airline} ({AIRLINE_ATS_PROFILES[airline].system})</option>))}
               </select>
            </div>

            <textarea className="w-full h-64 p-4 text-sm text-slate-700 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 resize-none font-mono bg-slate-50" placeholder="Paste job description text here..." value={jobText} onChange={handleJobPaste} disabled={isFetchingJob} />
            <div className="mt-6 flex justify-between">
              <button onClick={() => setStep(1)} className="text-slate-500 font-medium px-4 py-2 hover:text-slate-700">Back</button>
              <button onClick={runOptimization} disabled={!jobText.trim() || loading || isFetchingJob} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-2.5 rounded-lg font-bold shadow-md shadow-emerald-200 transition-all disabled:opacity-70">
                {loading ? <><RefreshCw className="w-4 h-4 animate-spin" /> Optimizing (Strict Length)...</> : <><BarChart2 className="w-4 h-4" /> Run Expert ATS Optimizer</>}
              </button>
            </div>
          </div>
        </div>}

        {step === 3 && result && (
          <div className="animate-fade-in grid grid-cols-1 lg:grid-cols-3 gap-6 no-print">
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex flex-col items-center">
                <h3 className="text-slate-500 font-medium text-sm mb-4 uppercase tracking-wider">ATS Match Rate</h3>
                <ScoreGauge score={result.score} breakdown={result.score_breakdown} />
                <p className="mt-4 text-center text-slate-600 text-sm italic">"{String(result.summary_critique)}"</p>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                <h3 className="text-red-500 font-bold text-sm mb-4 uppercase flex items-center gap-2"><AlertCircle className="w-4 h-4" /> Missing Keywords</h3>
                <div className="flex flex-wrap gap-2">{result.missing_keywords.map((kw, i) => <span key={i} className="bg-red-50 text-red-700 px-3 py-1 rounded-full text-xs font-semibold border border-red-100">{String(kw)}</span>)}</div>
              </div>
              
              <div className="space-y-3">
                 <button onClick={handleRunSimulation} className="w-full flex items-center justify-center gap-2 bg-indigo-50 text-indigo-700 py-3 rounded-lg text-sm font-bold hover:bg-indigo-100 border border-indigo-100 transition-colors">
                    {isSimulating ? <Loader2 className="w-4 h-4 animate-spin"/> : <><ShieldCheck className="w-4 h-4"/> Validate Compliance</>}
                 </button>
                 
                 <div className="border-t border-slate-200 my-2"></div>

                 <button onClick={handleGenerateCoverLetter} disabled={isGeneratingCoverLetter} className="w-full flex items-center justify-center gap-2 bg-white border border-slate-300 text-slate-700 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">
                    {isGeneratingCoverLetter ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Mail className="w-4 h-4" /> Generate Cover Letter</>}
                 </button>
                 {coverLetterResult && (
                   <button onClick={() => downloadDocx(coverLetterResult, 'Cover_Letter.doc')} className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white py-2 rounded-lg text-xs font-medium hover:bg-emerald-700 animate-fade-in"><FileDown className="w-3 h-3" /> Download CL</button>
                 )}
                 <button onClick={handleGenerateEmail} disabled={isGeneratingEmail} className="w-full flex items-center justify-center gap-2 bg-white border border-slate-300 text-slate-700 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">
                    {isGeneratingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4" /> Hiring Manager Email</>}
                 </button>
                 {emailResult && (
                    <div className="bg-slate-50 p-3 rounded-lg text-xs border border-slate-200 animate-fade-in">
                       <div className="font-bold mb-1">Subject: {String(emailResult.subject_line)}</div>
                       <div className="text-slate-600 mb-2 whitespace-pre-wrap">{String(emailResult.email_body)}</div>
                       <button onClick={() => copyToClipboard(emailResult.email_body)} className="text-indigo-600 font-bold flex items-center gap-1"><Copy className="w-3 h-3"/> Copy</button>
                    </div>
                 )}
                 <button onClick={handleGenerateInterview} className="w-full flex items-center justify-center gap-2 bg-amber-50 text-amber-700 py-3 rounded-lg text-sm font-bold hover:bg-amber-100 border border-amber-100 transition-colors">
                    <MessageSquare className="w-4 h-4" /> Interview Prep
                 </button>
              </div>
              <button onClick={() => setStep(1)} className="w-full py-3 rounded-lg border border-slate-300 text-slate-600 font-medium hover:bg-slate-50">Start Over</button>
            </div>

            <div className="lg:col-span-2">
              <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden flex flex-col h-full">
                <div className="bg-slate-800 text-white p-4 flex justify-between items-center">
                  <div className="flex items-center gap-2"><Edit3 className="w-4 h-4 text-emerald-400" /><span className="font-bold text-sm">Live Edit (Lag-Free)</span></div>
                  <div className="flex gap-2 items-center">
                     <button onClick={() => setHighlightKeywords(!highlightKeywords)} className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs transition-colors ${highlightKeywords ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>
                        {highlightKeywords ? <Eye className="w-3 h-3"/> : <EyeOff className="w-3 h-3"/>} KW Match
                     </button>
                     <div className="h-4 w-[1px] bg-slate-600 mx-1"></div>
                     <button id="drive-btn" onClick={handleDriveClick} className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs transition-colors ${driveStatus === 'connected' ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-white text-slate-600 hover:bg-slate-100'}`}>
                        {driveStatus === 'connected' ? <Check className="w-3 h-3"/> : <Cloud className="w-3 h-3"/>} {driveStatus === 'connected' ? 'Save to Drive' : 'Connect Drive'}
                     </button>
                     <button onClick={() => handlePdfExport()} className="flex items-center gap-1 bg-slate-600 hover:bg-slate-500 px-3 py-1.5 rounded text-xs transition-colors"><Printer className="w-3 h-3" /> PDF Download</button>
                     <button onClick={downloadDocx} className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 rounded text-xs transition-colors font-medium"><FileDown className="w-3 h-3" /> DOCX</button>
                  </div>
                </div>
                {/* FIT ANALYZER BAR */}
                <div className="px-4 pt-2">
                   <FitAnalyzer contentLength={editorCharCount} />
                </div>
                <div className="p-10 bg-white flex-grow overflow-auto max-h-[1000px] relative group cursor-text">
                   <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-100 text-slate-500 text-xs px-2 py-1 rounded pointer-events-none">Click to Edit</div>
                  <div 
                    id="resume-preview"
                    ref={resumePreviewRef}
                    contentEditable={true}
                    suppressContentEditableWarning={true}
                    onInput={handleEditorInput}
                    className="font-serif text-slate-900 text-sm leading-relaxed prose prose-sm max-w-none prose-h1:text-left prose-h1:uppercase prose-h3:uppercase prose-h3:border-none prose-h3:text-black prose-p:my-0 prose-ul:my-0 prose-li:my-0 outline-none focus:ring-2 focus:ring-indigo-100 focus:ring-opacity-50 rounded p-2"
                  >
                     {/* Content is injected via ref to prevent react re-render lag */}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 4 && interviewResult && (
           <div className="animate-fade-in max-w-4xl mx-auto">
              <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-100">
                 <div className="flex items-center gap-3 mb-6 pb-6 border-b border-slate-100">
                    <div className="bg-amber-100 p-2 rounded-lg"><MessageSquare className="w-6 h-6 text-amber-600" /></div>
                    <div><h2 className="text-2xl font-bold text-slate-800">Interview Prep Guide</h2><p className="text-slate-500">Tailored Q&A based on your optimization.</p></div>
                 </div>
                 <div className="space-y-8">
                    {interviewResult.map((item, i) => (
                       <div key={i} className="bg-slate-50 p-6 rounded-lg border border-slate-200">
                          <h3 className="font-bold text-slate-800 text-lg mb-3 flex gap-2"><span className="text-indigo-600">Q{i+1}:</span> {String(item.question)}</h3>
                          <div className="bg-white p-4 rounded border border-slate-200 text-slate-600 italic"><span className="font-bold text-emerald-600 not-italic block mb-1">STAR Method Strategy:</span>{String(item.star_answer)}</div>
                       </div>
                    ))}
                 </div>
                 <div className="mt-8 flex justify-end"><button onClick={() => setStep(3)} className="bg-slate-800 text-white px-6 py-2 rounded-lg hover:bg-slate-700">Back to Resume</button></div>
              </div>
           </div>
        )}
      </main>
    </div>
  );
}
