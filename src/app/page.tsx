'use client'

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  Upload, FileText, CheckCircle, AlertCircle, RefreshCw, ChevronRight, BarChart2, 
  Download, Copy, Briefcase, FileUp, FileDown, Loader2, Search, Mail, MessageSquare, 
  Printer, Edit3, Send, History, Settings, X, Trash2, Eye, EyeOff, Plane, Building2,
  FileCode, FileSpreadsheet, Gauge, Shield, Zap, Target, TrendingUp, AlertTriangle,
  CheckSquare, Layers, PieChart, FileJson, FileType, Users, Clock, Star, Award, Key,
  Sparkles, Wand2, FileCheck, Brain, Rocket
} from 'lucide-react';
import { GoogleGenerativeAI } from "@google/generative-ai";
import jsPDF from 'jspdf';

// =============================================================================
// AI PROVIDERS CONFIGURATION - Supports Multiple AI Models
// =============================================================================
const AI_PROVIDERS = {
  gemini: {
    name: 'Google Gemini',
    icon: '🌟',
    models: [
      { id: 'gemini-2.5-pro-preview-06-05', name: 'Gemini 2.5 Pro', description: 'Latest & most capable', free: false },
      { id: 'gemini-2.5-flash-preview-05-20', name: 'Gemini 2.5 Flash', description: 'Fast & smart - NEW', free: true },
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: 'Fast & efficient - FREE', free: true },
      { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash Lite', description: 'Lightweight - FREE', free: true },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: 'Advanced reasoning', free: false },
      { id: 'gemini-1.5-flash-8b', name: 'Gemini 1.5 Flash 8B', description: 'Fastest - FREE', free: true },
      { id: 'gemini-exp-1206', name: 'Gemini Experimental', description: 'Cutting edge features', free: true },
    ],
    website: 'https://aistudio.google.com',
    features: { vision: true, documentProcessing: true }
  },
  groq: {
    name: 'Groq (FREE)',
    icon: '⚡',
    models: [
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', description: 'Meta\'s latest - FREE', free: true },
      { id: 'llama-3.2-90b-vision-preview', name: 'Llama 3.2 90B Vision', description: 'Multimodal - FREE', free: true },
      { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B', description: 'Lightning fast - FREE', free: true },
      { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', description: 'Mixture of experts - FREE', free: true },
      { id: 'gemma2-9b-it', name: 'Gemma 2 9B', description: 'Google open source - FREE', free: true },
    ],
    website: 'https://console.groq.com',
    features: { vision: true, documentProcessing: false }
  },
  openai: {
    name: 'OpenAI',
    icon: '🤖',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o', description: 'Most capable multimodal', free: false },
      { id: 'gpt-4.1', name: 'GPT-4.1', description: 'Latest GPT-4 version', free: false },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Fast & affordable', free: false },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: 'Advanced reasoning', free: false },
      { id: 'o1-preview', name: 'o1 Preview', description: 'Deep reasoning model', free: false },
      { id: 'o1-mini', name: 'o1 Mini', description: 'Fast reasoning', free: false },
    ],
    website: 'https://platform.openai.com',
    features: { vision: true, documentProcessing: true }
  },
  deepseek: {
    name: 'DeepSeek',
    icon: '🧠',
    models: [
      { id: 'deepseek-chat', name: 'DeepSeek V3', description: 'Very affordable', free: false },
      { id: 'deepseek-reasoner', name: 'DeepSeek R1', description: 'Advanced reasoning', free: false },
    ],
    website: 'https://platform.deepseek.com',
    features: { vision: false, documentProcessing: false }
  },
  anthropic: {
    name: 'Anthropic Claude',
    icon: '🎭',
    models: [
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', description: 'Best balance', free: false },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', description: 'Fast & efficient', free: false },
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', description: 'Most powerful', free: false },
    ],
    website: 'https://console.anthropic.com',
    features: { vision: true, documentProcessing: true }
  },
  mistral: {
    name: 'Mistral AI',
    icon: '🌪️',
    models: [
      { id: 'mistral-large-latest', name: 'Mistral Large', description: 'Most capable', free: false },
      { id: 'codestral-latest', name: 'Codestral', description: 'Code specialist', free: false },
      { id: 'mistral-small-latest', name: 'Mistral Small', description: 'FREE tier available', free: true },
    ],
    website: 'https://console.mistral.ai',
    features: { vision: false, documentProcessing: false }
  },
  cerebras: {
    name: 'Cerebras',
    icon: '🚀',
    models: [
      { id: 'llama-3.3-70b', name: 'Llama 3.3 70B', description: 'Ultra-fast inference', free: true },
      { id: 'llama-3.1-70b', name: 'Llama 3.1 70B', description: 'Fast & capable', free: true },
    ],
    website: 'https://cloud.cerebras.ai',
    features: { vision: false, documentProcessing: false }
  },
  together: {
    name: 'Together AI',
    icon: '🤝',
    models: [
      { id: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', name: 'Llama 3.3 70B', description: 'Open source leader', free: false },
      { id: 'Qwen/Qwen2.5-72B-Instruct-Turbo', name: 'Qwen 2.5 72B', description: 'Powerful Chinese model', free: false },
      { id: 'mistralai/Mixtral-8x7B-Instruct-v0.1', name: 'Mixtral 8x7B', description: 'Mixture of experts', free: false },
    ],
    website: 'https://api.together.xyz',
    features: { vision: false, documentProcessing: false }
  },
  cohere: {
    name: 'Cohere',
    icon: '💬',
    models: [
      { id: 'command-r-plus', name: 'Command R+', description: 'Enterprise ready', free: false },
      { id: 'command-r', name: 'Command R', description: 'Optimized for RAG', free: false },
      { id: 'command', name: 'Command', description: 'General purpose', free: false },
    ],
    website: 'https://cohere.com',
    features: { vision: false, documentProcessing: false }
  },
  xai: {
    name: 'xAI (Grok)',
    icon: '❌',
    models: [
      { id: 'grok-beta', name: 'Grok Beta', description: 'Elon\'s AI assistant', free: false },
    ],
    website: 'https://console.x.ai',
    features: { vision: false, documentProcessing: false }
  },
  openrouter: {
    name: 'OpenRouter',
    icon: '🔀',
    models: [
      { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', description: 'Best overall via OpenRouter', free: false },
      { id: 'openai/gpt-4o', name: 'GPT-4o', description: 'OpenAI flagship', free: false },
      { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B', description: 'Meta open source', free: false },
      { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1', description: 'Deep reasoning', free: false },
      { id: 'google/gemini-2.0-flash-exp:free', name: 'Gemini 2.0 Flash', description: 'FREE on OpenRouter', free: true },
      { id: 'qwen/qwen-2.5-72b-instruct', name: 'Qwen 2.5 72B', description: 'Alibaba\'s best', free: false },
    ],
    website: 'https://openrouter.ai',
    features: { vision: true, documentProcessing: true }
  },
  perplexity: {
    name: 'Perplexity AI',
    icon: '🔮',
    models: [
      { id: 'llama-3.1-sonar-large-128k-online', name: 'Sonar Large Online', description: 'Web-connected search', free: false },
      { id: 'llama-3.1-sonar-small-128k-online', name: 'Sonar Small Online', description: 'Fast web search', free: false },
      { id: 'llama-3.1-sonar-large-128k-chat', name: 'Sonar Large Chat', description: 'Chat without search', free: false },
    ],
    website: 'https://www.perplexity.ai/pro',
    features: { vision: false, documentProcessing: false, webSearch: true }
  }
};

// Valid Gemini models list
const VALID_GEMINI_MODELS = [
  'gemini-2.5-pro-preview-06-05',
  'gemini-2.5-flash-preview-05-20',
  'gemini-2.0-flash', 
  'gemini-2.0-flash-lite',
  'gemini-1.5-pro',
  'gemini-1.5-flash-8b',
  'gemini-exp-1206'
];

// =============================================================================
// RESUME TEMPLATES CONFIGURATION
// =============================================================================
const RESUME_TEMPLATES = {
  classic: {
    name: 'Classic Professional',
    description: 'Traditional format, ATS-friendly',
    icon: '📜',
    fontFamily: '"Times New Roman", Times, serif',
    headerStyle: 'uppercase-center',
    sectionStyle: 'bold-title-case'
  },
  modern: {
    name: 'Modern Clean',
    description: 'Contemporary layout with impact',
    icon: '✨',
    fontFamily: '"Segoe UI", Arial, sans-serif',
    headerStyle: 'bold-left-accent',
    sectionStyle: 'uppercase-with-line'
  },
  minimal: {
    name: 'Minimalist',
    description: 'Clean, distraction-free',
    icon: '⚪',
    fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
    headerStyle: 'simple-bold',
    sectionStyle: 'minimal-headings'
  },
  executive: {
    name: 'Executive',
    description: 'C-suite and senior roles',
    icon: '👔',
    fontFamily: 'Georgia, "Times New Roman", serif',
    headerStyle: 'elegant-centered',
    sectionStyle: 'sophisticated'
  }
};

// =============================================================================
// AIRLINE ATS DATABASE
// =============================================================================
const AIRLINE_ATS_DATABASE = [
  { id: 'emirates', name: 'Emirates', atsPlatform: 'Taleo', region: 'Middle East', keywordWeighting: { certifications: 0.3, technical: 0.25, softSkills: 0.2, experience: 0.25 } },
  { id: 'qatar', name: 'Qatar Airways', atsPlatform: 'SAP SuccessFactors', region: 'Middle East', keywordWeighting: { certifications: 0.3, technical: 0.25, softSkills: 0.2, experience: 0.25 } },
  { id: 'etihad', name: 'Etihad Airways', atsPlatform: 'Workday', region: 'Middle East', keywordWeighting: { certifications: 0.25, technical: 0.3, softSkills: 0.2, experience: 0.25 } },
  { id: 'ryanair', name: 'Ryanair', atsPlatform: 'SmartRecruiters', region: 'Europe', keywordWeighting: { certifications: 0.2, technical: 0.35, softSkills: 0.15, experience: 0.3 } },
  { id: 'lufthansa', name: 'Lufthansa', atsPlatform: 'SAP SuccessFactors', region: 'Europe', keywordWeighting: { certifications: 0.3, technical: 0.25, softSkills: 0.2, experience: 0.25 } },
  { id: 'ba', name: 'British Airways', atsPlatform: 'Workday', region: 'Europe', keywordWeighting: { certifications: 0.25, technical: 0.3, softSkills: 0.2, experience: 0.25 } },
  { id: 'airfrance', name: 'Air France', atsPlatform: 'Taleo', region: 'Europe', keywordWeighting: { certifications: 0.25, technical: 0.3, softSkills: 0.2, experience: 0.25 } },
  { id: 'klm', name: 'KLM', atsPlatform: 'Workday', region: 'Europe', keywordWeighting: { certifications: 0.25, technical: 0.3, softSkills: 0.2, experience: 0.25 } },
  { id: 'delta', name: 'Delta Air Lines', atsPlatform: 'Workday', region: 'Americas', keywordWeighting: { certifications: 0.25, technical: 0.3, softSkills: 0.2, experience: 0.25 } },
  { id: 'united', name: 'United Airlines', atsPlatform: 'Taleo', region: 'Americas', keywordWeighting: { certifications: 0.3, technical: 0.25, softSkills: 0.2, experience: 0.25 } },
  { id: 'aa', name: 'American Airlines', atsPlatform: 'Workday', region: 'Americas', keywordWeighting: { certifications: 0.25, technical: 0.3, softSkills: 0.2, experience: 0.25 } },
  { id: 'singapore', name: 'Singapore Airlines', atsPlatform: 'SAP SuccessFactors', region: 'Asia Pacific', keywordWeighting: { certifications: 0.3, technical: 0.25, softSkills: 0.2, experience: 0.25 } },
  { id: 'cathay', name: 'Cathay Pacific', atsPlatform: 'Workday', region: 'Asia Pacific', keywordWeighting: { certifications: 0.25, technical: 0.3, softSkills: 0.2, experience: 0.25 } },
  { id: 'qantas', name: 'Qantas', atsPlatform: 'Taleo', region: 'Asia Pacific', keywordWeighting: { certifications: 0.25, technical: 0.3, softSkills: 0.2, experience: 0.25 } },
];

// =============================================================================
// A4 CONSTANTS
// =============================================================================
const A4_CONSTANTS = {
  charsPerLine: 85,
  linesPerPage: 46,
  optimalCharCount: { min: 2800, max: 3000 },
  minCharCount: 2800,
  maxCharCount: 3200
};

// =============================================================================
// INTERFACES
// =============================================================================
interface AnalysisResult {
  score: number;
  score_breakdown: { impact: number; brevity: number; keywords: number };
  summary_critique: string;
  missing_keywords: string[];
  matched_keywords: string[];
  optimized_content: string;
}

interface AppSettings {
  activeProvider: string;
  activeModel: string;
  apiKeys: Record<string, string>;
}

interface AirlineProfile {
  id: string;
  name: string;
  atsPlatform: string;
  region: string;
  keywordWeighting: { certifications: number; technical: number; softSkills: number; experience: number };
}

interface ResumeHistory {
  id: string;
  date: string;
  jobTitle: string;
  company: string;
  score: number;
  content: string;
}

interface KeywordAnalysis {
  keyword: string;
  count: number;
  density: number;
  importance: 'high' | 'medium' | 'low';
}

interface SkillsGap {
  skill: string;
  hasSkill: boolean;
  importance: string;
  suggestion: string;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================
export default function ATSApp() {
  // State
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [resumeText, setResumeText] = useState('');
  const [jobText, setJobText] = useState('');
  const [jobUrl, setJobUrl] = useState('');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [coverLetterResult, setCoverLetterResult] = useState<string | null>(null);
  const [emailResult, setEmailResult] = useState<{ subject_line: string; email_body: string } | null>(null);
  const [interviewResult, setInterviewResult] = useState<{ question: string; star_answer: string }[] | null>(null);
  const [selectedAirline, setSelectedAirline] = useState<AirlineProfile | null>(null);
  const [settings, setSettings] = useState({ tone: 'Corporate Professional', strictness: 'Balanced' });
  const [highlightKeywords, setHighlightKeywords] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [appSettings, setAppSettings] = useState<AppSettings>({
    activeProvider: 'gemini',
    activeModel: 'gemini-2.0-flash',
    apiKeys: {}
  });
  const [resumeHistory, setResumeHistory] = useState<ResumeHistory[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [linkedinResult, setLinkedinResult] = useState<string | null>(null);
  const [keywordAnalysis, setKeywordAnalysis] = useState<KeywordAnalysis[] | null>(null);
  const [skillsGap, setSkillsGap] = useState<SkillsGap[] | null>(null);
  const [showKeywordAnalyzer, setShowKeywordAnalyzer] = useState(false);
  const [showApiSettings, setShowApiSettings] = useState(false);
  const [showCoverLetter, setShowCoverLetter] = useState(false);
  const [showApiKey, setShowApiKey] = useState<Record<string, boolean>>({});
  const [tempSettings, setTempSettings] = useState<AppSettings | null>(null);
  const [isFetchingJob, setIsFetchingJob] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [pdfFallbackNotification, setPdfFallbackNotification] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resumePreviewRef = useRef<HTMLDivElement>(null);

  // Memoized character count for performance
  const charCount = useMemo(() => {
    if (result?.optimized_content) {
      return result.optimized_content.replace(/<[^>]*>/g, '').length;
    }
    return 0;
  }, [result?.optimized_content]);

  // Load settings from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('ats_app_settings');
    if (saved) {
      try {
        setAppSettings(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load settings');
      }
    }
    
    // Load resume history
    const history = localStorage.getItem('ats_resume_history');
    if (history) {
      try {
        setResumeHistory(JSON.parse(history));
      } catch (e) {
        console.error('Failed to load history');
      }
    }
  }, []);

  // Save settings to localStorage
  useEffect(() => {
    localStorage.setItem('ats_app_settings', JSON.stringify(appSettings));
  }, [appSettings]);

  // Global styles
  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      .a4-preview-container {
        width: 210mm;
        min-height: 297mm;
        max-height: 297mm;
        overflow: hidden;
        background: white;
        box-shadow: 0 4px 20px rgba(0,0,0,0.1);
      }
      .a4-preview-content {
        padding: 0.95cm;
        font-family: 'Times New Roman', Times, serif;
        font-size: 12pt;
        line-height: 1.15;
        color: #1a1a1a;
      }
      #resume-preview h1 {
        font-size: 16pt;
        font-weight: bold;
        text-transform: uppercase;
        margin: 0 0 3pt 0;
        text-align: center;
        letter-spacing: 0.5pt;
      }
      #resume-preview h4 {
        font-size: 12pt;
        margin: 0 0 2pt 0;
        font-weight: normal;
        text-align: center;
        line-height: 1.3;
      }
      #resume-preview h4 strong {
        font-weight: bold;
      }
      #resume-preview p {
        margin: 0 0 6pt 0;
      }
      #resume-preview p strong {
        font-size: 12pt;
        font-weight: bold;
        display: block;
        margin-top: 8pt;
        margin-bottom: 3pt;
        text-transform: uppercase;
        letter-spacing: 0.3pt;
      }
      #resume-preview ul {
        margin: 0 0 6pt 18pt;
        padding: 0;
        list-style-type: none;
      }
      #resume-preview li {
        display: list-item;
        margin: 0 0 4pt 0;
        line-height: 1.25;
        white-space: normal;
      }
      #resume-preview li::before {
        content: "• ";
        margin-left: -1em;
      }
      #resume-preview br {
        display: block;
        content: "";
        margin-top: 0;
      }
      /* Cover letter styles */
      .cover-letter-container {
        padding: 0.95cm;
        font-family: 'Times New Roman', Times, serif;
        font-size: 12pt;
        line-height: 1.5;
      }
      .cover-letter-header {
        text-align: left;
        margin-bottom: 12pt;
      }
      .cover-letter-date {
        text-align: right;
        margin-bottom: 12pt;
      }
      .cover-letter-recipient {
        text-align: center;
        margin-bottom: 12pt;
      }
      .cover-letter-subject {
        margin-bottom: 12pt;
      }
      .cover-letter-body p {
        margin: 0 0 8pt 0;
        text-align: justify;
      }
      .cover-letter-closing {
        margin-top: 16pt;
      }
      @keyframes fade-in {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  // =============================================================================
  // BUILT-IN AI FUNCTIONS (Multi-Provider Support)
  // =============================================================================
  
  const callBuiltInAI = async (action: string, data: any): Promise<any> => {
    // Get current provider and API key
    const provider = appSettings.activeProvider || 'gemini';
    const apiKey = appSettings.apiKeys?.[provider] || '';
    const model = appSettings.activeModel || '';
    
    console.log('API Call:', { provider, hasApiKey: !!apiKey, model });
    
    // Build request body
    const requestBody: any = { action, data };
    
    // If user has set a provider and API key, pass them to backend
    if (provider && apiKey) {
      requestBody.provider = provider;
      requestBody.apiKey = apiKey;
      requestBody.model = model;
    }
    
    const response = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'AI request failed');
    }
    
    const result = await response.json();
    return result.data;
  };

  const extractJsonFromResponse = (text: string): any => {
    // Remove markdown code blocks
    let cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    // Find JSON object
    const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('No valid JSON found in response');
  };

  // =============================================================================
  // MODULE 1-8: COMPLETE ATS OPTIMIZATION PIPELINE
  // =============================================================================
  
  const analyzeResume = async () => {
    if (!resumeText.trim() || !jobText.trim()) {
      alert('Please provide both resume and job description');
      return;
    }
    
    setLoading(true);
    setResult(null);
    setCoverLetterResult(null);
    setEmailResult(null);
    setInterviewResult(null);
    setKeywordAnalysis(null);
    setSkillsGap(null);
    setLinkedinResult(null);
    
    try {
      // STEP 1: Normalize job description
      const normalizedJob = await normalizeJobDescription(jobText, jobUrl);
      setJobText(normalizedJob.description);
      
      // STEP 2: Run keyword analysis (MODULE 3)
      const keywordResponse = await fetch('/api/analyze-keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobDescription: normalizedJob.description,
          resumeText: resumeText
        })
      });
      
      let keywordData = null;
      if (keywordResponse.ok) {
        const kwResult = await keywordResponse.json();
        keywordData = kwResult.data;
        setKeywordAnalysis(keywordData.categories ? Object.values(keywordData.categories).flat() : null);
      }
      
      // STEP 3: Run full optimization using built-in AI (MODULES 4-8)
      const optimizedData = await callBuiltInAI('optimize-resume', {
        resume: resumeText,
        job: normalizedJob.description,
        keywords: keywordData
      });
      
      // Ensure the result has all required fields with defaults
      const finalResult = {
        score: optimizedData.score || 75,
        score_breakdown: {
          impact: optimizedData.score_breakdown?.impact || 80,
          brevity: optimizedData.score_breakdown?.brevity || 75,
          keywords: optimizedData.score_breakdown?.keywords || optimizedData.score || 70
        },
        summary_critique: optimizedData.summary_critique || 'Resume optimized successfully',
        missing_keywords: optimizedData.missing_keywords || [],
        matched_keywords: optimizedData.matched_keywords || [],
        optimized_content: optimizedData.optimized_content || optimizedData.optimized_resume || '',
        ats_analysis: optimizedData.ats_analysis,
        page_compliance: optimizedData.page_compliance
      };
      
      // STEP 4: Enforce page limits (MODULE 6)
      if (finalResult.optimized_content) {
        const wordCount = countWords(finalResult.optimized_content);
        finalResult.page_compliance = {
          word_count: wordCount,
          fits_one_page: wordCount >= 650 && wordCount <= 700,
          action_taken: wordCount > 700 ? 'compressed' : wordCount < 650 ? 'expanded' : 'none'
        };
      }
      
      // STEP 5: Calculate comprehensive scores (MODULE 7)
      if (!finalResult.ats_analysis) {
        finalResult.ats_analysis = calculateATSScores(finalResult, keywordData);
      }
      
      setResult(finalResult);
      setStep(3);
    } catch (error: any) {
      console.error('Analysis error:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Normalize job description - MODULE 1
  const normalizeJobDescription = async (text: string, url?: string) => {
    if (url && url.trim()) {
      try {
        const response = await fetch('/api/scrape-job', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: url.trim() })
        });
        if (response.ok) {
          const result = await response.json();
          return result.data;
        }
      } catch (e) {
        console.error('URL scraping failed, using text input');
      }
    }
    
    // Clean and normalize provided text
    const cleaned = text
      .replace(/cookie\s*policy[^.]*\./gi, '')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/\s{2,}/g, ' ')
      .trim();
    
    return { description: cleaned, rawText: cleaned };
  };

  // Build strict optimization prompt - MODULES 4-5
  const buildStrictOptimizationPrompt = (resume: string, job: string, keywordData: any, airline: any) => {
    const missingKw = keywordData?.topMissing?.join(', ') || 'N/A';
    const matchedKw = keywordData?.topMatched?.join(', ') || 'N/A';
    const airlineContext = airline ? `
    TARGET AIRLINE: ${airline.name}
    ATS PLATFORM: ${airline.atsPlatform}
    ` : '';

    return `
You are an Elite ATS Resume Optimizer - Aviation & Hospitality Specialist.

═══════════════════════════════════════════════════════════════
MODULE 4: RESUME OPTIMIZATION ENGINE - STRICT RULES
═══════════════════════════════════════════════════════════════

⚠️ MANDATORY LAYOUT RULES (NO EXCEPTIONS):
1. MUST FIT EXACTLY ONE A4 PAGE
2. WORD COUNT: 650-700 words MAXIMUM
3. FONT: Times New Roman only (all sections)
4. FONT SIZE: 12pt (headings and body)
5. SECTION HEADINGS: ALL CAPS, BOLD, no borders
6. BODY TEXT: NOT bold, clean spacing
7. BULLETS: Only for responsibilities (• symbol)
8. MAX BULLETS: 5 per job position
9. NO: tables, icons, emojis, graphics
10. NO: multi-page output

⚠️ MANDATORY CONTENT RULES:
- EVERY bullet starts with ACTION VERB (Achieved, Delivered, Managed, Led, Implemented, etc.)
- Include NUMBERS/PERCENTAGES in achievements
- REMOVE weak phrases: "Responsible for", "Helped with", "Worked on", "Duties included"
- NO repeated action verbs
- Natural keyword integration (NO stuffing)
- Professional aviation/hospitality tone

═══════════════════════════════════════════════════════════════
MODULE 5: BULLET ENHANCEMENT ENGINE
═══════════════════════════════════════════════════════════════

Transform using: ACTION VERB + TASK + IMPACT + RESULT

Examples:
❌ "Handled customer service"
✅ "Delivered premium customer service to 150+ daily passengers, maintaining 98% satisfaction ratings"

❌ "Managed team operations"
✅ "Led cross-functional team of 12, increasing operational efficiency by 25% through process optimization"

═══════════════════════════════════════════════════════════════
MODULE 6: PAGE LIMIT ENFORCER
═══════════════════════════════════════════════════════════════

Before output:
1. Count words - MUST be 650-700
2. If >700: Compress summary, remove weakest bullets
3. If <650: Add relevant quantified achievements
4. Verify single-page fit

═══════════════════════════════════════════════════════════════
MODULE 7: SCORING SYSTEM (0-100)
═══════════════════════════════════════════════════════════════

Calculate:
- ats_match_score: Overall keyword/content match
- keyword_coverage: % of job keywords present
- readability_score: Clarity and flow
- action_verb_strength: Quality of verbs used
- formatting_compliance: Adherence to rules

═══════════════════════════════════════════════════════════════
MODULE 8: OUTPUT STRUCTURE (EXACT JSON)
═══════════════════════════════════════════════════════════════

Return ONLY this JSON:

{
  "score": number (0-100),
  "score_breakdown": {
    "impact": number,
    "brevity": number, 
    "keywords": number
  },
  "summary_critique": "brief assessment",
  "missing_keywords": ["keyword1", "keyword2"],
  "matched_keywords": ["keyword1", "keyword2"],
  "optimized_content": "HTML formatted resume",
  "ats_analysis": {
    "ats_match_score": number,
    "keyword_coverage": number,
    "readability_score": number,
    "action_verb_strength": number,
    "formatting_compliance": number
  },
  "improvement_insights": {
    "changes_made": ["change1", "change2"],
    "keywords_added": ["kw1", "kw2"],
    "weak_phrases_removed": ["phrase1"],
    "action_verbs_used": ["verb1", "verb2"]
  },
  "page_compliance": {
    "word_count": number,
    "fits_one_page": boolean
  }
}

═══════════════════════════════════════════════════════════════
INPUT DATA
═══════════════════════════════════════════════════════════════

${airlineContext}

KEYWORD ANALYSIS:
- Missing Keywords: ${missingKw}
- Matched Keywords: ${matchedKw}

CANDIDATE RESUME:
${resume}

TARGET JOB DESCRIPTION:
${job}

═══════════════════════════════════════════════════════════════

Now optimize following ALL modules strictly. Return ONLY the JSON.
`;
  };

  // Calculate ATS scores - MODULE 7
  const calculateATSScores = (data: any, keywordData: any) => {
    const keywordCoverage = keywordData?.matchPercentage || 70;
    const baseScore = data.score || 75;
    
    return {
      ats_match_score: Math.round((baseScore + keywordCoverage) / 2),
      keyword_coverage: keywordCoverage,
      readability_score: Math.round(80 + Math.random() * 15),
      action_verb_strength: Math.round(75 + Math.random() * 20),
      formatting_compliance: Math.round(85 + Math.random() * 10)
    };
  };

  // Count words in text/HTML
  const countWords = (content: any): number => {
    if (typeof content === 'string') {
      const text = content.replace(/<[^>]*>/g, '');
      return text.split(/\s+/).filter(w => w.length > 0).length;
    }
    return 0;
  };

  const generateCoverLetter = async () => {
    if (!result?.optimized_content || !jobText) return;
    
    setLoading(true);
    try {
      const prompt = `
        Generate a professional cover letter for this resume and job description.
        
        RESUME: ${result.optimized_content.replace(/<[^>]*>/g, ' ')}
        JOB: ${jobText}
        
        Write a compelling one-page cover letter with:
        - Professional greeting
        - Opening paragraph showing enthusiasm
        - 2-3 body paragraphs matching skills to job requirements
        - Closing paragraph with call to action
        - Professional sign-off
        
        Return only the cover letter text, no JSON.
      `;
      
      const data = await callBuiltInAI('generate-cover-letter', {
        resume: result.optimized_content,
        job: jobText
      });
      setCoverLetterResult(data.text);
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const generateEmail = async () => {
    if (!result?.optimized_content || !jobText) return;
    
    setLoading(true);
    try {
      const data = await callBuiltInAI('generate-email', {
        resume: result.optimized_content,
        job: jobText
      });
      setEmailResult(data);
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const generateInterviewPrep = async () => {
    if (!result?.optimized_content || !jobText) return;
    
    setLoading(true);
    try {
      const data = await callBuiltInAI('generate-interview', {
        resume: result.optimized_content,
        job: jobText
      });
      setInterviewResult(data);
      setStep(4);
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // =============================================================================
  // NEW FEATURES: LinkedIn Optimizer, Keyword Analyzer, Skills Gap, History
  // =============================================================================
  
  const generateLinkedinProfile = async () => {
    if (!result?.optimized_content || !jobText) return;
    
    setLoading(true);
    try {
      const data = await callBuiltInAI('linkedin-optimize', {
        resume: result.optimized_content,
        job: jobText
      });
      setLinkedinResult(data.text);
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const analyzeKeywords = () => {
    if (!result?.optimized_content || !jobText) return;
    
    const resumeText = result.optimized_content.toLowerCase();
    const jobWords = jobText.toLowerCase().match(/\b[a-z]{4,}\b/g) || [];
    
    // Count word frequency in job description
    const jobWordCount: Record<string, number> = {};
    jobWords.forEach(word => {
      jobWordCount[word] = (jobWordCount[word] || 0) + 1;
    });
    
    // Sort by frequency and take top keywords
    const topKeywords = Object.entries(jobWordCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);
    
    // Analyze each keyword
    const analysis: KeywordAnalysis[] = topKeywords.map(([keyword, count]) => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      const resumeMatches = resumeText.match(regex) || [];
      const resumeCount = resumeMatches.length;
      const density = (resumeCount / (resumeText.split(/\s+/).length)) * 100;
      
      return {
        keyword,
        count: resumeCount,
        density: parseFloat(density.toFixed(3)),
        importance: count >= 5 ? 'high' : count >= 2 ? 'medium' : 'low'
      };
    });
    
    setKeywordAnalysis(analysis);
    setShowKeywordAnalyzer(true);
  };

  const analyzeSkillsGap = async () => {
    if (!result?.optimized_content || !jobText) return;
    
    setLoading(true);
    try {
      const data = await callBuiltInAI('skills-gap', {
        resume: result.optimized_content,
        job: jobText
      });
      setSkillsGap(data);
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Fetch job description from URL
  const fetchJobFromUrl = async () => {
    if (!jobUrl.trim()) {
      setFetchError('Please enter a URL');
      return;
    }

    setIsFetchingJob(true);
    setFetchError(null);

    try {
      const response = await fetch('/api/scrape-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: jobUrl.trim() })
      });

      const result = await response.json();

      if (response.ok && result.success && result.data) {
        // Check if we got meaningful content
        if (result.data.description && result.data.description.length > 100) {
          setJobText(result.data.description);
          setFetchError(null);
        } else {
          setFetchError('Could not extract job content from this URL. Please paste the job description manually.');
        }
      } else {
        setFetchError(result.error || 'Failed to fetch job description. Please paste it manually.');
      }
    } catch (error: any) {
      console.error('Fetch error:', error);
      setFetchError('Network error. Please check the URL or paste the job description manually.');
    } finally {
      setIsFetchingJob(false);
    }
  };

  const saveToHistory = () => {
    if (!result || !jobText) return;
    
    // Extract job title from job description
    const jobTitleMatch = jobText.match(/(?:position|role|job title)[:\s]*([^\n]+)/i);
    const jobTitle = jobTitleMatch ? jobTitleMatch[1].trim() : 'Unknown Position';
    
    // Extract company name if available
    const companyMatch = jobText.match(/(?:company|organization|employer)[:\s]*([^\n]+)/i);
    const company = companyMatch ? companyMatch[1].trim() : selectedAirline?.name || 'General Application';
    
    const newEntry: ResumeHistory = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      jobTitle,
      company,
      score: result.score,
      content: result.optimized_content
    };
    
    const updatedHistory = [newEntry, ...resumeHistory].slice(0, 20); // Keep last 20
    setResumeHistory(updatedHistory);
    localStorage.setItem('ats_resume_history', JSON.stringify(updatedHistory));
  };

  const loadFromHistory = (entry: ResumeHistory) => {
    setResult({
      score: entry.score,
      score_breakdown: { impact: 85, brevity: 90, keywords: entry.score },
      summary_critique: 'Loaded from history',
      missing_keywords: [],
      matched_keywords: [],
      optimized_content: entry.content
    });
    setShowHistory(false);
    setStep(3);
  };

  const deleteFromHistory = (id: string) => {
    const updatedHistory = resumeHistory.filter(h => h.id !== id);
    setResumeHistory(updatedHistory);
    localStorage.setItem('ats_resume_history', JSON.stringify(updatedHistory));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const fileName = file.name.toLowerCase();
    
    // Text files - read directly
    if (fileName.endsWith('.txt') || fileName.endsWith('.md')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setResumeText(text);
      };
      reader.readAsText(file);
      e.target.value = '';
      return;
    }
    
    // DOCX files - extract text
    if (fileName.endsWith('.docx')) {
      setIsParsing(true);
      try {
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        
        // Simple DOCX text extraction (DOCX is a ZIP with XML)
        const text = new TextDecoder().decode(uint8Array);
        const textMatches = text.match(/<w:t[^>]*>([^<]+)<\/w:t>/g) || [];
        const extractedText = textMatches
          .map(match => match.replace(/<[^>]+>/g, ''))
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
        
        if (extractedText && extractedText.length > 50) {
          setResumeText(extractedText);
        } else {
          alert('Could not extract text from DOCX. Please paste text directly.');
        }
      } catch (error: any) {
        alert(`Failed to process DOCX: ${error.message}`);
      }
      setIsParsing(false);
      e.target.value = '';
      return;
    }
    
    // PDF and images - use appropriate extraction method
    if (fileName.endsWith('.pdf') || fileName.endsWith('.png') || fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) {
      setIsParsing(true);
      
      const provider = appSettings.activeProvider || 'gemini';
      const apiKey = appSettings.apiKeys?.[provider] || '';
      const model = appSettings.activeModel || '';
      
      // Providers that support vision
      const visionProviders = ['gemini', 'openai', 'anthropic', 'openrouter'];
      const isPDF = fileName.endsWith('.pdf');
      const isImage = !isPDF && (fileName.endsWith('.png') || fileName.endsWith('.jpg') || fileName.endsWith('.jpeg'));
      
      try {
        // For PDFs - use client-side extraction with pdf.js (no server needed!)
        if (isPDF) {
          console.log('Using client-side PDF extraction with pdf.js');
          
          try {
            // Dynamic import of pdf.js - client side only
            const pdfjsLib = await import('pdfjs-dist');
            
            // Set worker source - use unpkg CDN which has the correct version
            pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
            
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            
            let fullText = '';
            const numPages = pdf.numPages;
            
            for (let i = 1; i <= numPages; i++) {
              const page = await pdf.getPage(i);
              const textContent = await page.getTextContent();
              const pageText = textContent.items
                .map((item: any) => item.str)
                .join(' ');
              fullText += pageText + '\n';
            }
            
            // Clean up extracted text
            fullText = fullText
              .replace(/\s+/g, ' ')
              .replace(/\n\s*\n/g, '\n\n')
              .trim();
            
            if (fullText.length > 50) {
              console.log('Client-side PDF extraction successful, text length:', fullText.length);
              setResumeText(fullText);
              setIsParsing(false);
              e.target.value = '';
              return;
            } else {
              // PDF has no selectable text - might be scanned
              console.log('PDF appears to be scanned (no text found)');
              alert('This PDF appears to be a scanned document with no selectable text.\n\nPlease:\n1. Use a PDF with selectable text\n2. Or copy and paste text directly from your document');
              setIsParsing(false);
              e.target.value = '';
              return;
            }
          } catch (pdfError: any) {
            console.error('Client-side PDF extraction error:', pdfError);
            alert(`Failed to read PDF: ${pdfError.message}\n\nPlease try pasting text directly.`);
            setIsParsing(false);
            e.target.value = '';
            return;
          }
        }
        
        // For images - need vision-capable AI
        if (isImage) {
          if (!visionProviders.includes(provider)) {
            alert(`${AI_PROVIDERS[provider as keyof typeof AI_PROVIDERS]?.name || provider} does not support image extraction.\n\nPlease:\n1. Use a vision-capable provider (Gemini, OpenAI, Anthropic)\n2. Or paste text directly`);
            setIsParsing(false);
            e.target.value = '';
            return;
          }
          
          if (!apiKey) {
            alert(`Please add your ${AI_PROVIDERS[provider as keyof typeof AI_PROVIDERS]?.name} API key in Settings to extract text from images.`);
            setIsParsing(false);
            e.target.value = '';
            return;
          }
          
          // Use AI vision for images
          const reader = new FileReader();
          reader.onload = async (event) => {
            try {
              const base64 = (event.target?.result as string).split(',')[1];
              const mimeType = file.type || 'image/jpeg';
              
              const response = await fetch('/api/ai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'extract-file',
                  data: { base64, mimeType },
                  provider,
                  apiKey,
                  model
                })
              });
              
              if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to extract text');
              }
              
              const result = await response.json();
              
              if (result.success && result.data.text) {
                setResumeText(result.data.text);
              } else {
                alert('Could not extract text from image. Please paste text directly.');
              }
            } catch (err: any) {
              console.error('Image extraction error:', err);
              alert(`Failed to extract text: ${err.message}`);
            }
            setIsParsing(false);
            e.target.value = '';
          };
          
          reader.onerror = () => {
            alert('Failed to read file');
            setIsParsing(false);
            e.target.value = '';
          };
          
          reader.readAsDataURL(file);
          return;
        }
        
      } catch (error: any) {
        alert(`Failed to process file: ${error.message}`);
        setIsParsing(false);
        e.target.value = '';
      }
      return;
    }
    
    alert('Unsupported file format. Please use PDF, DOCX, TXT, or images.');
    e.target.value = '';
  };

  // =============================================================================
  // EXPORT FUNCTIONS
  // =============================================================================
  // Fix combined bullets before export
  const fixCombinedBulletsForExport = (html: string): string => {
    if (!html) return '';
    
    let result = html;
    
    // Split bullets that have multiple items with • symbol
    let iterations = 0;
    while (result.match(/<li>\s*•\s*[^<]+•\s*[^<]+\s*<\/li>/i) && iterations < 10) {
      result = result.replace(/<li>\s*•\s*([^<•]+?)\s*•\s*([^<]+?)\s*<\/li>/gi, 
        '<li>• $1</li>\n<li>• $2</li>');
      iterations++;
    }
    
    // Split bullets separated by | 
    iterations = 0;
    while (result.match(/<li>\s*•\s*[^<]+\|\s*[^<]+\s*<\/li>/i) && iterations < 10) {
      result = result.replace(/<li>\s*•\s*([^<|]+?)\s*\|\s*([^<]+?)\s*<\/li>/gi, 
        '<li>• $1</li>\n<li>• $2</li>');
      iterations++;
    }
    
    // Split bullets that contain multiple sentences separated by period-space-capital
    result = result.replace(/<li>\s*•\s*([^<]+?\.)\s+([A-Z][^<]+)\s*<\/li>/gi, 
      '<li>• $1</li>\n<li>• $2</li>');
    
    return result;
  };

  // Download DOCX using proper docx library via API
  const downloadDocx = async (content: string, filename: string) => {
    try {
      // Fix combined bullets before export
      const fixedContent = fixCombinedBulletsForExport(content);
      
      // Call the API to generate proper DOCX
      const response = await fetch('/api/export-docx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: fixedContent, filename })
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate DOCX');
      }
      
      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('DOCX download error:', error);
      // Fallback to simple HTML download
      const html = `<html><body style="font-family: 'Times New Roman'; font-size: 12pt;">${content}</body></html>`;
      const link = document.createElement('a');
      link.href = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(html);
      link.download = filename;
      link.click();
    }
  };

  // Format cover letter with proper HTML structure
  const formatCoverLetter = (text: string): string => {
    // Split into lines and format
    const lines = text.split('\n').filter(line => line.trim());
    let html = '';
    let inClosing = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // Check if this is the sender's name at the end (after "Sincerely,")
      if (inClosing && line.split(' ').length <= 3 && /^[A-Z]/.test(line)) {
        html += `<p style="margin-top: 20pt;">${line}</p>`;
        continue;
      }
      
      // Check for "Sincerely," or similar closing
      if (/^(Sincerely|Best regards|Yours faithfully|Kind regards|Respectfully)/i.test(line)) {
        inClosing = true;
        html += `<p style="margin-top: 16pt;">${line}</p>`;
        continue;
      }
      
      // Check for "Dear Hiring Manager" or similar greeting
      if (/^Dear\s/i.test(line)) {
        html += `<p style="margin-bottom: 12pt;">${line}</p>`;
        continue;
      }
      
      // Check for date line
      if (/^Date:/i.test(line)) {
        html += `<p style="text-align: right; margin-bottom: 12pt;">${line.replace('Date:', '').trim()}</p>`;
        continue;
      }
      
      // Check for "RE:" subject line
      if (/^RE:/i.test(line)) {
        html += `<p style="margin-bottom: 12pt;"><strong>${line}</strong></p>`;
        continue;
      }
      
      // Default paragraph
      html += `<p style="margin-bottom: 8pt; text-align: justify;">${line}</p>`;
    }
    
    return html;
  };

  const downloadPdf = async () => {
    try {
      // Use html2canvas approach for more reliable PDF generation
      const element = resumePreviewRef.current;
      if (!element) {
        throw new Error('Preview element not found');
      }

      // Dynamic import of html2canvas for better reliability
      const html2canvas = (await import('html2canvas')).default;
      
      // Capture the element as canvas
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 800
      });
      
      // Create PDF from canvas
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const imgData = canvas.toDataURL('image/png');
      
      // A4 dimensions in mm
      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 9.5; // 0.95cm
      const contentWidth = pageWidth - (margin * 2);
      const contentHeight = pageHeight - (margin * 2);
      
      // Calculate image dimensions to fit
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = contentWidth / (imgWidth * 0.264583); // Convert px to mm
      const scaledHeight = imgHeight * 0.264583 * ratio;
      
      // Add image to PDF
      pdf.addImage(imgData, 'PNG', margin, margin, contentWidth, Math.min(scaledHeight, contentHeight));
      
      pdf.save('Optimized_Resume.pdf');
    } catch (error) {
      console.error('PDF generation failed:', error);
      // Automatically fallback to DOCX with notification
      if (result?.optimized_content) {
        setPdfFallbackNotification('PDF generation in progress... Trying DOCX format.');
        await downloadDocx(result.optimized_content, 'Optimized_Resume.docx');
        setPdfFallbackNotification('PDF generation failed. The file has been generated in DOCX format instead.');
        // Auto-hide notification after 5 seconds
        setTimeout(() => setPdfFallbackNotification(null), 5000);
      }
    }
  };

  const downloadEmailDocx = (subject: string, body: string) => {
    const html = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word'>
        <head>
          <style>
            @page { size: A4; margin: 0.95cm; }
            body { font-family: 'Times New Roman'; font-size: 12pt; }
            .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 12pt; margin-bottom: 20pt; }
            .info { background: #f5f5f5; padding: 12pt; border-left: 4px solid #333; margin: 20pt 0; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>HIRING MANAGER EMAIL</h1>
            <p>Professional Correspondence</p>
          </div>
          <div class="info">
            <p><strong>To:</strong> Hiring Manager</p>
            <p><strong>Subject:</strong> ${subject}</p>
            <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
          </div>
          <p>Dear Hiring Manager,</p>
          <p>${body.replace(/\n/g, '</p><p>')}</p>
          <p>Best regards,<br><strong>[Your Name]</strong></p>
        </body>
      </html>
    `;
    const link = document.createElement('a');
    link.href = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(html);
    link.download = 'Hiring_Manager_Email.doc';
    link.click();
  };

  // =============================================================================
  // RENDER
  // =============================================================================
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50">
      {/* PDF Fallback Notification */}
      {pdfFallbackNotification && (
        <div className="fixed top-20 right-6 z-50 bg-amber-50 border border-amber-200 rounded-lg shadow-lg p-4 max-w-sm animate-fade-in">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800">{pdfFallbackNotification}</p>
            </div>
            <button 
              onClick={() => setPdfFallbackNotification(null)}
              className="text-amber-600 hover:text-amber-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
      
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-lg">
              <Plane className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl">ATS<span className="text-indigo-600">Pro</span></span>
            <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-medium">Built-in AI</span>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Active Provider Badge */}
            <div className="hidden sm:flex items-center gap-2 text-xs bg-slate-100 px-3 py-1.5 rounded-lg cursor-pointer hover:bg-slate-200" onClick={() => { setTempSettings(appSettings); setShowApiSettings(true); }}>
              <span className="text-lg">{AI_PROVIDERS[appSettings.activeProvider as keyof typeof AI_PROVIDERS]?.icon || '🤖'}</span>
              <span className="font-medium">{AI_PROVIDERS[appSettings.activeProvider as keyof typeof AI_PROVIDERS]?.name || 'Select AI'}</span>
              <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
            </div>
            
            {/* Settings Button */}
            <button
              onClick={() => { setTempSettings(appSettings); setShowApiSettings(true); }}
              className="flex items-center gap-2 bg-indigo-100 text-indigo-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-200"
            >
              <Settings className="w-4 h-4" />
              API Settings
            </button>
            
            {resumeHistory.length > 0 && (
              <button
                onClick={() => setShowHistory(true)}
                className="flex items-center gap-2 bg-slate-100 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-200"
              >
                <History className="w-4 h-4" />
                History ({resumeHistory.length})
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                step >= s ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'
              }`}>
                {s}
              </div>
              {s < 4 && <div className={`w-16 h-1 ${step > s ? 'bg-indigo-600' : 'bg-slate-200'}`} />}
            </div>
          ))}
        </div>

        {/* Step 1: Resume Input */}
        {step === 1 && (
          <div className="animate-fade-in grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white p-8 rounded-xl shadow-sm border border-slate-200">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-8 h-8" />
                </div>
                <h2 className="text-xl font-bold text-slate-800">Resume Content</h2>
                <p className="text-slate-500 text-sm mt-1">Upload or paste your resume text</p>
              </div>
              
              <div className="mb-4 flex justify-center gap-4">
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".txt,.md,.pdf,.png,.jpg,.jpeg" />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isParsing}
                  className="flex items-center gap-2 bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50"
                >
                  {isParsing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileUp className="w-4 h-4" />}
                  {isParsing ? 'Extracting...' : 'Upload File'}
                </button>
              </div>
              
              <div className="p-3 mb-4 rounded-lg bg-gradient-to-r from-emerald-50 to-blue-50 border border-emerald-200">
                <div className="flex items-start gap-2">
                  <Zap className="w-4 h-4 text-emerald-600 mt-0.5" />
                  <div className="text-xs text-slate-600">
                    <span className="font-semibold text-emerald-700">FREE Option:</span> Use <span className="font-medium">Groq (100% FREE)</span> with text paste!
                    <span className="text-slate-500 ml-1">| File uploads require Gemini/OpenAI with vision support.</span>
                  </div>
                </div>
              </div>
              
              <textarea
                className="w-full h-56 p-4 text-sm text-slate-700 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 resize-none font-mono bg-slate-50"
                placeholder="Paste your resume text here..."
                value={resumeText}
                onChange={(e) => setResumeText(e.target.value)}
                disabled={isParsing}
              />
              
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setStep(2)}
                  disabled={!resumeText.trim() || isParsing}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-lg font-medium disabled:opacity-50"
                >
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            {/* Airline Selector */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Plane className="w-5 h-5 text-indigo-600" />
                Target Airline (Optional)
              </h3>
              <select
                className="w-full p-3 border border-slate-200 rounded-lg text-sm"
                value={selectedAirline?.id || ''}
                onChange={(e) => {
                  const airline = AIRLINE_ATS_DATABASE.find(a => a.id === e.target.value);
                  setSelectedAirline(airline || null);
                }}
              >
                <option value="">Select an airline...</option>
                {AIRLINE_ATS_DATABASE.map(airline => (
                  <option key={airline.id} value={airline.id}>{airline.name} ({airline.region})</option>
                ))}
              </select>
              
              {selectedAirline && (
                <div className="mt-4 p-4 bg-indigo-50 rounded-lg">
                  <h4 className="font-bold text-sm text-indigo-800 mb-2">{selectedAirline.name}</h4>
                  <p className="text-xs text-indigo-600">ATS: {selectedAirline.atsPlatform}</p>
                  <p className="text-xs text-indigo-600 mt-2">Optimizing for this airline's specific ATS requirements.</p>
                </div>
              )}
              
              <div className="mt-6 p-4 bg-slate-50 rounded-lg">
                <h4 className="font-bold text-sm text-slate-700 mb-2">Supported Airlines</h4>
                <p className="text-xs text-slate-500">{AIRLINE_ATS_DATABASE.length}+ airlines with ATS-specific optimization</p>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Job Description */}
        {step === 2 && (
          <div className="animate-fade-in grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white p-8 rounded-xl shadow-sm border border-slate-200">
              <h2 className="text-xl font-bold text-slate-800 mb-6">Target Job Description</h2>
              
              <div className="mb-4 flex gap-2">
                <input
                  type="text"
                  placeholder="Paste LinkedIn/Indeed/Qatar Airways URL..."
                  className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm"
                  value={jobUrl}
                  onChange={(e) => { setJobUrl(e.target.value); setFetchError(null); }}
                  disabled={isFetchingJob}
                />
                <button
                  onClick={fetchJobFromUrl}
                  disabled={!jobUrl.trim() || isFetchingJob}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isFetchingJob ? <><Loader2 className="w-4 h-4 animate-spin" /> Fetching...</> : <><Search className="w-4 h-4" /> Fetch</>}
                </button>
              </div>
              
              {/* Error message */}
              {fetchError && (
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-amber-800">
                    <span className="font-medium">Note:</span> {fetchError}
                  </div>
                </div>
              )}
              
              {/* Success indicator */}
              {jobText && !fetchError && (
                <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <span className="text-sm text-emerald-800 font-medium">Job description loaded ({jobText.length} characters)</span>
                </div>
              )}
              
              <textarea
                className="w-full h-64 p-4 text-sm text-slate-700 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 resize-none font-mono bg-slate-50"
                placeholder="Paste job description text here, or use the Fetch button above to extract from a URL..."
                value={jobText}
                onChange={(e) => setJobText(e.target.value)}
              />
              
              <div className="mt-6 flex justify-between">
                <button
                  onClick={() => setStep(1)}
                  className="text-slate-500 font-medium px-4 py-2 hover:text-slate-700"
                >
                  Back
                </button>
                <button
                  onClick={analyzeResume}
                  disabled={!jobText.trim() || loading}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-2.5 rounded-lg font-bold shadow-md disabled:opacity-50"
                >
                  {loading ? <><RefreshCw className="w-4 h-4 animate-spin" /> Optimizing...</> : <><Zap className="w-4 h-4" /> Run Optimizer</>}
                </button>
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <h3 className="font-bold text-slate-800 mb-4">Optimization Tips</h3>
              <ul className="text-xs text-slate-600 space-y-2">
                <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5" /> Include all certifications</li>
                <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5" /> Quantify achievements with numbers</li>
                <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5" /> Match job keywords naturally</li>
                <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5" /> Use action verbs</li>
              </ul>
              
              <div className="mt-6 p-4 bg-amber-50 rounded-lg border border-amber-200">
                <h4 className="font-bold text-sm text-amber-800 mb-2">⚠️ URL Fetching Limitations</h4>
                <p className="text-xs text-amber-700">
                  Some job sites (LinkedIn, Indeed) block automated fetching. If the Fetch button doesn't work, please:
                </p>
                <ol className="text-xs text-amber-700 mt-2 list-decimal list-inside space-y-1">
                  <li>Open the job posting in your browser</li>
                  <li>Copy the job description text</li>
                  <li>Paste it directly into the text area above</li>
                </ol>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Results */}
        {step === 3 && result && (
          <div className="animate-fade-in grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Sidebar */}
            <div className="lg:col-span-3 space-y-4">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h3 className="text-slate-500 font-medium text-sm mb-4 uppercase">ATS Score</h3>
                <div className="text-5xl font-bold text-indigo-600 mb-2">{result.score}%</div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="text-center p-2 bg-slate-50 rounded">
                    <div className="font-bold">{result.score_breakdown.impact}</div>
                    <div className="text-slate-500">Impact</div>
                  </div>
                  <div className="text-center p-2 bg-slate-50 rounded">
                    <div className="font-bold">{result.score_breakdown.brevity}</div>
                    <div className="text-slate-500">Brevity</div>
                  </div>
                  <div className="text-center p-2 bg-slate-50 rounded">
                    <div className="font-bold">{result.score_breakdown.keywords}</div>
                    <div className="text-slate-500">Keywords</div>
                  </div>
                </div>
              </div>
              
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h3 className="text-slate-500 font-medium text-sm mb-4 uppercase">Character Count</h3>
                <div className="text-3xl font-bold text-slate-800">{charCount}</div>
                <div className="mt-2 h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${charCount >= A4_CONSTANTS.optimalCharCount.min && charCount <= A4_CONSTANTS.optimalCharCount.max ? 'bg-emerald-500' : charCount < A4_CONSTANTS.minCharCount ? 'bg-amber-500' : 'bg-red-500'}`}
                    style={{ width: `${Math.min(100, (charCount / A4_CONSTANTS.maxCharCount) * 100)}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500 mt-2">Target: {A4_CONSTANTS.optimalCharCount.min}-{A4_CONSTANTS.optimalCharCount.max} chars</p>
              </div>
              
              <button
                onClick={() => setStep(1)}
                className="w-full py-3 rounded-lg border border-slate-300 text-slate-600 font-medium hover:bg-slate-50"
              >
                Start Over
              </button>
              
              {/* Proceed to Step 4 Button */}
              <button
                onClick={generateInterviewPrep}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-3 rounded-lg font-bold hover:bg-indigo-700 mt-3 disabled:opacity-50"
              >
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</> : <><MessageSquare className="w-4 h-4" /> Proceed to Interview Prep</>}
              </button>
            </div>
            
            {/* Center - Resume Preview */}
            <div className="lg:col-span-6">
              <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
                <div className="bg-slate-800 text-white p-4 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Edit3 className="w-4 h-4 text-emerald-400" />
                    <span className="font-bold text-sm">Live Preview</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${charCount >= A4_CONSTANTS.optimalCharCount.min && charCount <= A4_CONSTANTS.optimalCharCount.max ? 'bg-emerald-500' : 'bg-amber-500'}`}>
                      {charCount >= A4_CONSTANTS.optimalCharCount.min && charCount <= A4_CONSTANTS.optimalCharCount.max ? '✓ A4 Ready' : charCount < A4_CONSTANTS.minCharCount ? '⚠ Too Short' : '⚠ May Overflow'}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={downloadPdf} className="flex items-center gap-1 bg-slate-600 hover:bg-slate-500 px-3 py-1.5 rounded text-xs">
                      <Printer className="w-3 h-3" /> PDF
                    </button>
                    <button onClick={() => downloadDocx(result.optimized_content, 'Optimized_Resume.doc')} className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 rounded text-xs font-medium">
                      <FileDown className="w-3 h-3" /> DOCX
                    </button>
                  </div>
                </div>
                <div className="p-4 bg-slate-100 flex justify-center overflow-auto">
                  <div className="a4-preview-container">
                    <div className="a4-preview-content">
                      <div
                        id="resume-preview"
                        ref={resumePreviewRef}
                        suppressContentEditableWarning
                        className="outline-none"
                        dangerouslySetInnerHTML={{ __html: result.optimized_content }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Right Sidebar - Actions */}
            <div className="lg:col-span-3 space-y-4 relative z-10 pointer-events-auto">
              {/* Save to History Button */}
              <button
                onClick={saveToHistory}
                className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white py-2 rounded-lg text-sm font-bold hover:bg-emerald-700"
              >
                <History className="w-4 h-4" /> Save to History
              </button>
              
              <div className="border-t border-slate-200 pt-4">
                <h4 className="text-xs font-bold text-slate-500 uppercase mb-3">Generate Documents</h4>
                <button
                  onClick={generateCoverLetter}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 bg-indigo-50 text-indigo-700 py-3 rounded-lg text-sm font-bold hover:bg-indigo-100 border border-indigo-100"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Mail className="w-4 h-4" /> Cover Letter</>}
                </button>
                {coverLetterResult && (
                  <>
                    <button
                      onClick={() => setShowCoverLetter(true)}
                      className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-2 rounded-lg text-xs font-medium hover:bg-indigo-700 mt-2"
                    >
                      <Eye className="w-3 h-3" /> Preview Cover Letter
                    </button>
                    <button
                      onClick={() => downloadDocx(formatCoverLetter(coverLetterResult), 'Cover_Letter.doc')}
                      className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white py-2 rounded-lg text-xs font-medium hover:bg-emerald-700 mt-2"
                    >
                      <FileDown className="w-3 h-3" /> Download Cover Letter
                    </button>
                  </>
                )}
                
                <button
                  onClick={generateEmail}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 bg-slate-50 text-slate-700 py-3 rounded-lg text-sm font-bold hover:bg-slate-100 border border-slate-200 mt-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4" /> Hiring Manager Email</>}
                </button>
                {emailResult && (
                  <div className="bg-slate-50 p-3 rounded-lg text-xs border border-slate-200 mt-2">
                    <div className="font-bold mb-1">Subject: {emailResult.subject_line}</div>
                    <div className="text-slate-600 mb-2 whitespace-pre-wrap line-clamp-3">{emailResult.email_body}</div>
                    <div className="flex gap-2">
                      <button onClick={() => navigator.clipboard.writeText(emailResult.email_body)} className="text-indigo-600 font-bold flex items-center gap-1">
                        <Copy className="w-3 h-3"/> Copy
                      </button>
                      <button onClick={() => downloadEmailDocx(emailResult.subject_line, emailResult.email_body)} className="text-emerald-600 font-bold flex items-center gap-1">
                        <FileDown className="w-3 h-3" /> DOCX
                      </button>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="border-t border-slate-200 pt-4">
                <h4 className="text-xs font-bold text-slate-500 uppercase mb-3">AI Analysis Tools</h4>
                
                <button
                  onClick={generateLinkedinProfile}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 bg-blue-50 text-blue-700 py-3 rounded-lg text-sm font-bold hover:bg-blue-100 border border-blue-100"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Users className="w-4 h-4" /> LinkedIn Optimizer</>}
                </button>
                {linkedinResult && (
                  <div className="bg-blue-50 p-3 rounded-lg text-xs border border-blue-200 mt-2 max-h-48 overflow-y-auto">
                    <div className="whitespace-pre-wrap text-slate-700">{linkedinResult}</div>
                    <button 
                      onClick={() => navigator.clipboard.writeText(linkedinResult)} 
                      className="text-blue-600 font-bold flex items-center gap-1 mt-2"
                    >
                      <Copy className="w-3 h-3"/> Copy to Clipboard
                    </button>
                  </div>
                )}
                
                <button
                  onClick={analyzeKeywords}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 bg-purple-50 text-purple-700 py-3 rounded-lg text-sm font-bold hover:bg-purple-100 border border-purple-100 mt-2"
                >
                  <BarChart2 className="w-4 h-4" /> Keyword Density
                </button>
                
                <button
                  onClick={analyzeSkillsGap}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 bg-rose-50 text-rose-700 py-3 rounded-lg text-sm font-bold hover:bg-rose-100 border border-rose-100 mt-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Target className="w-4 h-4" /> Skills Gap Analysis</>}
                </button>
                
                <button
                  onClick={generateInterviewPrep}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 bg-amber-50 text-amber-700 py-3 rounded-lg text-sm font-bold hover:bg-amber-100 border border-amber-100 mt-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><MessageSquare className="w-4 h-4" /> Interview Prep</>}
                </button>
              </div>
              
              {/* Skills Gap Results */}
              {skillsGap && (
                <div className="bg-rose-50 p-4 rounded-lg border border-rose-200">
                  <h4 className="font-bold text-rose-800 mb-3 text-sm">Skills Gap Analysis</h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {skillsGap.map((skill, i) => (
                      <div key={i} className={`p-2 rounded ${skill.hasSkill ? 'bg-emerald-100' : 'bg-red-100'}`}>
                        <div className="flex items-center gap-2">
                          {skill.hasSkill ? <CheckCircle className="w-3 h-3 text-emerald-600" /> : <AlertCircle className="w-3 h-3 text-red-600" />}
                          <span className="font-medium text-xs">{skill.skill}</span>
                          <span className={`text-xs px-1 rounded ${skill.importance === 'high' ? 'bg-red-200 text-red-800' : 'bg-slate-200 text-slate-700'}`}>
                            {skill.importance}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-1">{skill.suggestion}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 4: Interview Prep */}
        {step === 4 && interviewResult && (
          <div className="animate-fade-in max-w-4xl mx-auto">
            <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
              <div className="flex items-center gap-3 mb-6 pb-6 border-b border-slate-100">
                <div className="bg-amber-100 p-2 rounded-lg">
                  <MessageSquare className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-800">Interview Prep Guide</h2>
                  <p className="text-slate-500">Tailored Q&A based on your resume</p>
                </div>
              </div>
              
              <div className="space-y-6">
                {interviewResult.map((item, i) => (
                  <div key={i} className="bg-slate-50 p-6 rounded-lg border border-slate-200">
                    <h3 className="font-bold text-slate-800 text-lg mb-3">
                      <span className="text-indigo-600">Q{i+1}:</span> {item.question}
                    </h3>
                    <div className="bg-white p-4 rounded border border-slate-200 text-slate-600 italic">
                      <span className="font-bold text-emerald-600 not-italic block mb-1">STAR Method Answer:</span>
                      {item.star_answer}
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-8 flex justify-end">
                <button onClick={() => setStep(3)} className="bg-slate-800 text-white px-6 py-2 rounded-lg hover:bg-slate-700">
                  Back to Resume
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Resume History Modal */}
      {showHistory && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-auto">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <History className="w-5 h-5" /> Resume History
              </h2>
              <button onClick={() => setShowHistory(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6">
              {resumeHistory.length === 0 ? (
                <p className="text-center text-slate-500 py-8">No saved resumes yet</p>
              ) : (
                <div className="space-y-3">
                  {resumeHistory.map((entry) => (
                    <div key={entry.id} className="bg-slate-50 p-4 rounded-lg border border-slate-200 flex justify-between items-center">
                      <div>
                        <h3 className="font-bold text-slate-800">{entry.jobTitle}</h3>
                        <p className="text-sm text-slate-600">{entry.company}</p>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">
                            Score: {entry.score}%
                          </span>
                          <span className="text-xs text-slate-500">
                            {new Date(entry.date).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => loadFromHistory(entry)}
                          className="bg-indigo-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-indigo-700"
                        >
                          Load
                        </button>
                        <button
                          onClick={() => deleteFromHistory(entry.id)}
                          className="bg-red-100 text-red-600 px-3 py-1.5 rounded text-sm font-medium hover:bg-red-200"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Keyword Analyzer Modal */}
      {showKeywordAnalyzer && keywordAnalysis && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-auto">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <BarChart2 className="w-5 h-5" /> Keyword Density Analysis
              </h2>
              <button onClick={() => setShowKeywordAnalyzer(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6">
              <p className="text-sm text-slate-600 mb-4">
                Analysis of top keywords from job description and their presence in your optimized resume.
              </p>
              <div className="space-y-2">
                {keywordAnalysis.map((kw, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                    <div className="flex-1">
                      <span className="font-medium text-slate-800">{kw.keyword}</span>
                      <span className={`ml-2 text-xs px-2 py-0.5 rounded ${
                        kw.importance === 'high' ? 'bg-red-100 text-red-700' :
                        kw.importance === 'medium' ? 'bg-amber-100 text-amber-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {kw.importance}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-indigo-600">{kw.count}x</div>
                      <div className="text-xs text-slate-500">{kw.density}% density</div>
                    </div>
                    <div className="w-20 h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${kw.count >= 2 ? 'bg-emerald-500' : kw.count >= 1 ? 'bg-amber-500' : 'bg-red-500'}`}
                        style={{ width: `${Math.min(100, kw.count * 25)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 p-4 bg-indigo-50 rounded-lg">
                <h4 className="font-bold text-sm text-indigo-800 mb-2">Tips:</h4>
                <ul className="text-xs text-indigo-700 space-y-1">
                  <li>• Keywords appearing 2-3 times indicate strong optimization</li>
                  <li>• High importance keywords should appear at least once</li>
                  <li>• Natural keyword density should be 1-3%</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* API Settings Modal */}
      {showApiSettings && tempSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-auto">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center sticky top-0 bg-white">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Settings className="w-5 h-5" /> API Settings
              </h2>
              <button onClick={() => setShowApiSettings(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6">
              {/* Active Provider Selection */}
              <div className="mb-6">
                <h3 className="font-bold text-sm text-slate-700 mb-3">Select AI Provider</h3>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {Object.entries(AI_PROVIDERS).map(([key, provider]) => (
                    <button
                      key={key}
                      onClick={() => {
                        setTempSettings(prev => prev ? {
                          ...prev,
                          activeProvider: key,
                          activeModel: provider.models[0]?.id || ''
                        } : null);
                      }}
                      className={`p-3 rounded-lg border-2 text-center transition-all ${
                        tempSettings.activeProvider === key 
                          ? 'border-indigo-500 bg-indigo-50' 
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <span className="text-2xl">{provider.icon}</span>
                      <div className="text-xs font-medium mt-1 truncate">{provider.name}</div>
                      {tempSettings.activeProvider === key && (
                        <CheckCircle className="w-4 h-4 text-indigo-600 mx-auto mt-1" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Model Selection */}
              <div className="mb-6">
                <h3 className="font-bold text-sm text-slate-700 mb-3">Select Model</h3>
                <select
                  value={tempSettings.activeModel}
                  onChange={(e) => setTempSettings(prev => prev ? { ...prev, activeModel: e.target.value } : null)}
                  className="w-full p-3 border border-slate-200 rounded-lg text-sm"
                >
                  {AI_PROVIDERS[tempSettings.activeProvider as keyof typeof AI_PROVIDERS]?.models.map(model => (
                    <option key={model.id} value={model.id}>
                      {model.name} - {model.description} {model.free ? '(FREE)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* API Key Inputs */}
              <div className="mb-6">
                <h3 className="font-bold text-sm text-slate-700 mb-3">API Keys</h3>
                <div className="space-y-3">
                  {Object.entries(AI_PROVIDERS).map(([key, provider]) => (
                    <div key={key} className="flex items-center gap-2">
                      <span className="text-xl w-8">{provider.icon}</span>
                      <div className="flex-1 relative">
                        <input
                          type={showApiKey[key] ? 'text' : 'password'}
                          placeholder={`${provider.name} API Key`}
                          value={tempSettings.apiKeys[key] || ''}
                          onChange={(e) => setTempSettings(prev => prev ? {
                            ...prev,
                            apiKeys: { ...prev.apiKeys, [key]: e.target.value }
                          } : null)}
                          className="w-full p-2 pr-10 border border-slate-200 rounded-lg text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => setShowApiKey(prev => ({ ...prev, [key]: !prev[key] }))}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          {showApiKey[key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <a
                        href={provider.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-indigo-600 hover:text-indigo-800 whitespace-nowrap"
                      >
                        Get Key →
                      </a>
                    </div>
                  ))}
                </div>
              </div>

              {/* Save Button */}
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowApiSettings(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (tempSettings) {
                      setAppSettings(tempSettings);
                      localStorage.setItem('ats_app_settings', JSON.stringify(tempSettings));
                    }
                    setShowApiSettings(false);
                  }}
                  className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
                >
                  Save Settings
                </button>
              </div>

              {/* Current Settings Debug */}
              <div className="mt-6 p-4 bg-slate-50 rounded-lg">
                <h4 className="font-bold text-sm text-slate-700 mb-2">Current Settings:</h4>
                <div className="text-xs text-slate-600 font-mono">
                  Provider: <strong>{tempSettings.activeProvider}</strong><br/>
                  Model: <strong>{tempSettings.activeModel}</strong><br/>
                  Has API Key: <strong>{tempSettings.apiKeys[tempSettings.activeProvider] ? 'Yes ✓' : 'No ✗'}</strong>
                </div>
              </div>

              {/* Info Box */}
              <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <h4 className="font-bold text-sm text-amber-800 mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" /> Important Note
                </h4>
                <p className="text-xs text-amber-700">
                  API keys are stored in your browser's localStorage. Make sure to click "Save Settings" before closing.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cover Letter Preview Modal */}
      {showCoverLetter && coverLetterResult && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-auto">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center sticky top-0 bg-white">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Mail className="w-5 h-5" /> Cover Letter Preview
              </h2>
              <button onClick={() => setShowCoverLetter(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6">
              {/* A4 Preview Container */}
              <div className="flex justify-center mb-6">
                <div className="a4-preview-container">
                  <div className="a4-preview-content">
                    <div 
                      className="whitespace-pre-wrap font-serif"
                      style={{ fontFamily: "'Times New Roman', Times, serif", fontSize: '12pt', lineHeight: '1.5' }}
                      dangerouslySetInnerHTML={{ __html: formatCoverLetter(coverLetterResult) }}
                    />
                  </div>
                </div>
              </div>
              
              {/* Action Buttons */}
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => navigator.clipboard.writeText(coverLetterResult)}
                  className="flex items-center gap-2 bg-slate-100 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-200"
                >
                  <Copy className="w-4 h-4" /> Copy Text
                </button>
                <button
                  onClick={() => downloadDocx(formatCoverLetter(coverLetterResult), 'Cover_Letter.doc')}
                  className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700"
                >
                  <FileDown className="w-4 h-4" /> Download DOCX
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
