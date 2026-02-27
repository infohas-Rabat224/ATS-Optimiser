import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

console.log('🔄 API route loaded - v9 (improved URL fetching with direct HTTP support)');

// Configuration from environment variables
function getAIConfig() {
  const baseUrl = process.env.ZAI_BASE_URL || process.env.NEXT_PUBLIC_ZAI_BASE_URL;
  const apiKey = process.env.ZAI_API_KEY || process.env.NEXT_PUBLIC_ZAI_API_KEY;
  
  console.log('🔍 ZAI Config check:', {
    hasBaseUrl: !!baseUrl,
    hasApiKey: !!apiKey,
    baseUrlPrefix: baseUrl ? baseUrl.substring(0, 30) + '...' : 'none'
  });
  
  if (!baseUrl || !apiKey) {
    console.log('⚠️ ZAI config missing - baseUrl or apiKey not set');
    return null;
  }
  
  console.log('✅ ZAI config found, creating client');
  return { baseUrl, apiKey };
}

// Initialize ZAI client
let zaiClient: ZAI | null = null;

async function getZAIClient() {
  // Try to use environment variables first
  const config = getAIConfig();
  if (config) {
    if (!zaiClient) {
      try {
        zaiClient = new ZAI(config);
        console.log('✅ ZAI client created from env config');
      } catch (e: any) {
        console.error('❌ Failed to create ZAI client from config:', e.message);
      }
    }
    return zaiClient;
  }
  
  // Fall back to auto-initialization (for local development with config file)
  if (!zaiClient) {
    try {
      zaiClient = await ZAI.create();
      console.log('✅ ZAI client created from auto-init');
    } catch (e: any) {
      console.error('❌ Failed to auto-init ZAI client:', e.message);
    }
  }
  return zaiClient;
}

// Web search for job fetching
async function fetchJobFromUrl(url: string): Promise<string> {
  try {
    const zai = await getZAIClient();
    if (!zai) {
      throw new Error('AI service not configured');
    }
    
    // Use web search to get job information
    const searchResult = await zai.functions.invoke("web_search", {
      query: `job listing ${url}`,
      num: 5
    });
    
    // Also try to read the URL directly
    try {
      const readerResult = await zai.functions.invoke("web_reader", { url });
      if (readerResult && readerResult.content) {
        return `Job Listing Content:\n${readerResult.content}\n\nRelated Search Results:\n${JSON.stringify(searchResult, null, 2)}`;
      }
    } catch (e) {
      // Web reader failed, use search results only
    }
    
    // Return search results
    if (searchResult && Array.isArray(searchResult) && searchResult.length > 0) {
      return searchResult.map((r: any) => 
        `Title: ${r.name || 'N/A'}\nURL: ${r.url || 'N/A'}\nSnippet: ${r.snippet || 'N/A'}`
      ).join('\n\n');
    }
    
    throw new Error('Could not fetch job details from URL');
  } catch (error: any) {
    throw new Error(`Failed to fetch job: ${error.message}`);
  }
}

// Multi-provider AI endpoint
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, data, provider, apiKey, model } = body;
    
    // Handle job fetching separately (uses web search)
    if (action === 'fetch-job') {
      return await handleFetchJob(data, provider, apiKey, model);
    }
    
    // Handle local PDF extraction (no AI needed)
    if (action === 'extract-local') {
      return await handleLocalExtraction(data);
    }
    
    // If provider is specified with API key, use that provider
    if (provider && apiKey) {
      switch (provider) {
        case 'zai':
          return await handleZAI(action, data, apiKey, model);
        case 'gemini':
          return await handleGemini(action, data, apiKey, model);
        case 'deepseek':
          return await handleDeepSeek(action, data, apiKey, model);
        case 'openai':
          return await handleOpenAI(action, data, apiKey, model);
        case 'groq':
          return await handleGroq(action, data, apiKey, model);
        case 'anthropic':
          return await handleAnthropic(action, data, apiKey, model);
        case 'openrouter':
          return await handleOpenRouter(action, data, apiKey, model);
        case 'perplexity':
          return await handlePerplexity(action, data, apiKey, model);
        case 'glm':
          return await handleGLM(action, data, apiKey, model);
        case 'mistral':
          return await handleMistral(action, data, apiKey, model);
        case 'xai':
          return await handleXAI(action, data, apiKey, model);
        default:
          return NextResponse.json({ 
            success: false, 
            error: `Provider '${provider}' not yet implemented.` 
          }, { status: 400 });
      }
    }

    // Default: Use z-ai-web-dev-sdk (no API key required)
    return await handleDefaultAI(action, data);
  } catch (error: any) {
    console.error('AI API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// Handle job fetching
async function handleFetchJob(data: any, provider?: string, apiKey?: string, model?: string) {
  const url = data.url;
  if (!url) {
    return NextResponse.json({ success: false, error: 'No URL provided' }, { status: 400 });
  }
  
  try {
    let jobContent = '';
    
    // Method 1: Try direct fetch with CORS proxy
    try {
      console.log('🔄 Attempting direct fetch for URL:', url);
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        redirect: 'follow'
      });
      
      if (response.ok) {
        const html = await response.text();
        // Extract text from HTML (simple approach)
        jobContent = html
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        console.log('✅ Direct fetch succeeded, content length:', jobContent.length);
      }
    } catch (e: any) {
      console.log('⚠️ Direct fetch failed:', e.message);
    }
    
    // Method 2: Try ZAI web reader if direct fetch failed or content is too short
    if (!jobContent || jobContent.length < 200) {
      try {
        const zai = await getZAIClient();
        console.log('ZAI client status:', zai ? 'initialized' : 'null');
        
        if (zai) {
          try {
            console.log('Trying web_reader for URL:', url);
            const readerResult = await zai.functions.invoke("web_reader", { url });
            console.log('web_reader result:', readerResult ? 'got content' : 'empty');
            if (readerResult && readerResult.content) {
              jobContent = readerResult.content;
            }
          } catch (e: any) {
            console.log('Web reader failed:', e.message);
            // Try web search as fallback
            try {
              console.log('Trying web_search fallback');
              const searchResult = await zai.functions.invoke("web_search", {
                query: `job listing ${url}`,
                num: 5
              });
              if (searchResult && Array.isArray(searchResult) && searchResult.length > 0) {
                jobContent = searchResult.map((r: any) => 
                  `Title: ${r.name || 'N/A'}\nURL: ${r.url || 'N/A'}\nSnippet: ${r.snippet || 'N/A'}`
                ).join('\n\n');
              }
            } catch (e2: any) {
              console.log('Web search also failed:', e2.message);
            }
          }
        }
      } catch (e: any) {
        console.log('Failed to use ZAI client:', e.message);
      }
    }
    
    // If we got content, return it
    if (jobContent && jobContent.length > 100) {
      // If user has API key, enhance with AI analysis
      if (provider && apiKey) {
        const prompt = `You are a job listing analyst. Analyze the following job information and extract key details.\n\nJOB INFORMATION:\n${jobContent}\n\nExtract and summarize:\n- Job Title\n- Company Name\n- Location\n- Key Responsibilities\n- Required Skills (Hard Skills)\n- Soft Skills\n- Benefits/Perks\n- Salary (if mentioned)\n\nProvide a comprehensive summary that a job seeker would find useful for tailoring their resume.`;
        
        try {
          switch (provider) {
            case 'gemini':
              return await handleGemini('fetch-job', { jobContent, prompt }, apiKey, model);
            case 'openai':
              return await handleOpenAI('fetch-job', { jobContent, prompt }, apiKey, model);
            case 'deepseek':
              return await handleDeepSeek('fetch-job', { jobContent, prompt }, apiKey, model);
            case 'groq':
              return await handleGroq('fetch-job', { jobContent, prompt }, apiKey, model);
            default:
              break;
          }
        } catch (aiError) {
          console.log('AI analysis failed, returning raw content:', aiError);
        }
      }
      
      // Return raw content (works without API key)
      return NextResponse.json({
        success: true,
        data: { text: jobContent }
      });
    }
    
    // No content fetched
    return NextResponse.json({ 
      success: false, 
      error: 'Could not fetch job details from this URL. Please paste the job description manually.' 
    }, { status: 400 });
    
  } catch (error: any) {
    console.error('Job fetch error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// Local PDF extraction - now handled client-side
async function handleLocalExtraction(data: any) {
  return NextResponse.json({ 
    success: false, 
    error: 'PDF extraction is now handled client-side. Please use the file upload button in the browser.' 
  }, { status: 400 });
}

// Z.AI (chat.z.ai) handler using z-ai-web-dev-sdk
async function handleZAI(action: string, data: any, apiKey: string, model?: string) {
  try {
    // Create ZAI client with user's API key
    const zai = new ZAI({
      baseUrl: 'https://api.z.ai/v1',
      apiKey: apiKey
    });
    
    // Build the prompt based on action
    let prompt: string;
    if (action === 'optimize-resume') {
      prompt = buildOptimizePrompt(data);
    } else if (action === 'extract-file' && data.base64 && data.mimeType) {
      prompt = 'Extract ALL text from this document. Return ONLY the extracted text content, preserving structure and formatting.';
    } else {
      prompt = getPromptForAction(action, data);
    }
    
    // Call the AI
    const completion = await zai.chat.completions.create({
      model: model || 'auto',
      messages: [
        { role: 'system', content: 'You are a helpful assistant specialized in resume optimization and career services.' },
        { role: 'user', content: prompt }
      ]
    });
    
    const text = completion.choices?.[0]?.message?.content || '';
    return processResponse(action, text, data);
  } catch (error: any) {
    console.error('Z.AI API Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: `Z.AI request failed: ${error.message}` 
    }, { status: 500 });
  }
}

// Default AI handler using z-ai-web-dev-sdk (no API key required)
async function handleDefaultAI(action: string, data: any) {
  try {
    const zai = await getZAIClient();
    
    if (!zai) {
      return NextResponse.json({ 
        success: false, 
        error: 'AI service not configured. Please set ZAI_BASE_URL and ZAI_API_KEY environment variables.' 
      }, { status: 500 });
    }
    
    // Build the prompt based on action
    let prompt: string;
    if (action === 'optimize-resume') {
      prompt = buildOptimizePrompt(data);
    } else if (action === 'extract-file' && data.base64 && data.mimeType) {
      // For file extraction, we handle it differently
      prompt = 'Extract ALL text from this document. Return ONLY the extracted text content, preserving structure and formatting.';
    } else {
      prompt = getPromptForAction(action, data);
    }
    
    // Call the AI
    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: 'You are a helpful assistant specialized in resume optimization and career services.' },
        { role: 'user', content: prompt }
      ]
    });
    
    const text = completion.choices?.[0]?.message?.content || '';
    return processResponse(action, text, data);
  } catch (error: any) {
    console.error('ZAI API Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: `AI request failed: ${error.message}` 
    }, { status: 500 });
  }
}

// Gemini handler
async function handleGemini(action: string, data: any, apiKey: string, model: string = 'gemini-2.0-flash') {
  const baseUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model.includes('vision') || action === 'extract-file' ? 'gemini-2.0-flash' : model}:generateContent`;
  
  try {
    let body: any;
    
    if (action === 'extract-file' && data.base64 && data.mimeType) {
      body = {
        contents: [{
          parts: [
            { text: 'Extract ALL text from this document image. Return ONLY the extracted text content, preserving structure and formatting. Do not add any commentary.' },
            { inline_data: { mime_type: data.mimeType, data: data.base64 } }
          ]
        }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 8192 }
      };
    } else if (action === 'optimize-resume') {
      const prompt = buildOptimizePrompt(data);
      body = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 8192 }
      };
    } else {
      const prompt = getPromptForAction(action, data);
      body = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 4096 }
      };
    }

    const response = await fetch(`${baseUrl}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    return processResponse(action, text, data);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DeepSeek handler
async function handleDeepSeek(action: string, data: any, apiKey: string, model: string = 'deepseek-chat') {
  const baseUrl = 'https://api.deepseek.com/chat/completions';
  
  try {
    let content: string;
    
    if (action === 'extract-file') {
      return NextResponse.json({ 
        success: false, 
        error: 'DeepSeek does not support image/PDF extraction. Please use Gemini or OpenAI for file uploads.' 
      }, { status: 400 });
    } else if (action === 'optimize-resume') {
      content = buildOptimizePrompt(data);
    } else {
      content = getPromptForAction(action, data);
    }

    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model || 'deepseek-chat',
        messages: [{ role: 'user', content }],
        max_tokens: 4096,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMsg = `DeepSeek API error: ${response.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMsg += ` - ${errorJson.error?.message || errorText}`;
      } catch {
        errorMsg += ` - ${errorText}`;
      }
      throw new Error(errorMsg);
    }

    const result = await response.json();
    const text = result.choices?.[0]?.message?.content || '';
    
    return processResponse(action, text, data);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// OpenAI handler
async function handleOpenAI(action: string, data: any, apiKey: string, model: string = 'gpt-4o-mini') {
  const baseUrl = 'https://api.openai.com/v1/chat/completions';
  
  try {
    let messages: any[];
    
    if (action === 'extract-file' && data.base64 && data.mimeType) {
      messages = [{
        role: 'user',
        content: [
          { type: 'text', text: 'Extract ALL text from this document image. Return ONLY the extracted text content.' },
          { type: 'image_url', image_url: { url: `data:${data.mimeType};base64,${data.base64}` } }
        ]
      }];
    } else {
      const content = action === 'optimize-resume' ? buildOptimizePrompt(data) : getPromptForAction(action, data);
      messages = [{ role: 'user', content }];
    }

    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model || 'gpt-4o-mini',
        messages,
        max_tokens: 4096
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    const text = result.choices?.[0]?.message?.content || '';
    
    return processResponse(action, text, data);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// Groq handler
async function handleGroq(action: string, data: any, apiKey: string, model: string = 'llama-3.3-70b-versatile') {
  const baseUrl = 'https://api.groq.com/openai/v1/chat/completions';
  
  try {
    if (action === 'extract-file') {
      return NextResponse.json({ 
        success: false, 
        error: 'Groq does not support image/PDF extraction. Please use Gemini or OpenAI for file uploads.' 
      }, { status: 400 });
    }

    const content = action === 'optimize-resume' ? buildOptimizePrompt(data) : getPromptForAction(action, data);
    
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model || 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content }],
        max_tokens: 4096
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Groq API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    const text = result.choices?.[0]?.message?.content || '';
    
    return processResponse(action, text, data);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// Anthropic handler
async function handleAnthropic(action: string, data: any, apiKey: string, model: string = 'claude-3-5-sonnet-20241022') {
  const baseUrl = 'https://api.anthropic.com/v1/messages';
  
  try {
    let content: any[];
    
    if (action === 'extract-file' && data.base64 && data.mimeType) {
      content = [
        { type: 'text', text: 'Extract ALL text from this document image. Return ONLY the extracted text content.' },
        { type: 'image', source: { type: 'base64', media_type: data.mimeType, data: data.base64 } }
      ];
    } else {
      const text = action === 'optimize-resume' ? buildOptimizePrompt(data) : getPromptForAction(action, data);
      content = [{ type: 'text', text }];
    }

    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: model || 'claude-3-5-sonnet-20241022',
        max_tokens: 4096,
        messages: [{ role: 'user', content }]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    const text = result.content?.[0]?.text || '';
    
    return processResponse(action, text, data);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// OpenRouter handler
async function handleOpenRouter(action: string, data: any, apiKey: string, model: string = 'anthropic/claude-3.5-sonnet') {
  const baseUrl = 'https://openrouter.ai/api/v1/chat/completions';
  
  try {
    let messages: any[];
    
    if (action === 'extract-file' && data.base64 && data.mimeType) {
      messages = [{
        role: 'user',
        content: [
          { type: 'text', text: 'Extract ALL text from this document image. Return ONLY the extracted text content.' },
          { type: 'image_url', image_url: { url: `data:${data.mimeType};base64,${data.base64}` } }
        ]
      }];
    } else {
      const content = action === 'optimize-resume' ? buildOptimizePrompt(data) : getPromptForAction(action, data);
      messages = [{ role: 'user', content }];
    }

    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://atsoptimiser.vercel.app',
        'X-Title': 'ATS Resume Optimizer'
      },
      body: JSON.stringify({
        model: model || 'anthropic/claude-3.5-sonnet',
        messages,
        max_tokens: 4096
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    const text = result.choices?.[0]?.message?.content || '';
    
    return processResponse(action, text, data);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// Perplexity handler
async function handlePerplexity(action: string, data: any, apiKey: string, model: string = 'llama-3.1-sonar-large-128k-online') {
  const baseUrl = 'https://api.perplexity.ai/chat/completions';
  
  try {
    if (action === 'extract-file') {
      return NextResponse.json({ 
        success: false, 
        error: 'Perplexity does not support image/PDF extraction. Please use Gemini or OpenAI for file uploads.' 
      }, { status: 400 });
    }

    const content = action === 'optimize-resume' ? buildOptimizePrompt(data) : getPromptForAction(action, data);
    
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model || 'llama-3.1-sonar-large-128k-online',
        messages: [{ role: 'user', content }],
        max_tokens: 4096
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Perplexity API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    const text = result.choices?.[0]?.message?.content || '';
    
    return processResponse(action, text, data);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// GLM (Zhipu AI) handler
async function handleGLM(action: string, data: any, apiKey: string, model: string = 'glm-4-flash') {
  const baseUrl = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
  
  try {
    if (action === 'extract-file') {
      return NextResponse.json({ 
        success: false, 
        error: 'GLM does not support image/PDF extraction. Please use Gemini or OpenAI for file uploads.' 
      }, { status: 400 });
    }

    const content = action === 'optimize-resume' ? buildOptimizePrompt(data) : getPromptForAction(action, data);
    
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model || 'glm-4-flash',
        messages: [{ role: 'user', content }],
        max_tokens: 4096
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GLM API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    const text = result.choices?.[0]?.message?.content || '';
    
    return processResponse(action, text, data);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// Mistral AI handler
async function handleMistral(action: string, data: any, apiKey: string, model: string = 'mistral-small-latest') {
  const baseUrl = 'https://api.mistral.ai/v1/chat/completions';
  
  try {
    if (action === 'extract-file') {
      return NextResponse.json({ 
        success: false, 
        error: 'Mistral does not support image/PDF extraction. Please use Gemini or OpenAI for file uploads.' 
      }, { status: 400 });
    }

    const content = action === 'optimize-resume' ? buildOptimizePrompt(data) : getPromptForAction(action, data);
    
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model || 'mistral-small-latest',
        messages: [{ role: 'user', content }],
        max_tokens: 4096
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Mistral API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    const text = result.choices?.[0]?.message?.content || '';
    
    return processResponse(action, text, data);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// X.AI (Grok) handler
async function handleXAI(action: string, data: any, apiKey: string, model: string = 'grok-beta') {
  const baseUrl = 'https://api.x.ai/v1/chat/completions';
  
  try {
    if (action === 'extract-file') {
      return NextResponse.json({ 
        success: false, 
        error: 'X.AI does not support image/PDF extraction. Please use Gemini or OpenAI for file uploads.' 
      }, { status: 400 });
    }

    const content = action === 'optimize-resume' ? buildOptimizePrompt(data) : getPromptForAction(action, data);
    
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model || 'grok-beta',
        messages: [{ role: 'user', content }],
        max_tokens: 4096
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`X.AI API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    const text = result.choices?.[0]?.message?.content || '';
    
    return processResponse(action, text, data);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// =============================================================================
// OPTIMIZED PROMPT - FORCES EXACTLY 2800 CHARACTERS
// =============================================================================

function buildOptimizePrompt(data: any): string {
  const resumeText = data.resume?.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() || '';
  const jobText = data.job?.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() || '';

  return `You are a SENIOR ATS RESUME OPTIMIZATION EXPERT with 15+ years of experience in aviation, hospitality, and corporate recruitment. Your task is to create an ATS-MAXIMIZED resume that scores 95%+ on ATS systems.

╔══════════════════════════════════════════════════════════════════════════════╗
║  🎯 CRITICAL MISSION: GENERATE EXACTLY 2800-3000 TEXT CHARACTERS 🎯         ║
║  This is your #1 priority. Failure means the resume will be REJECTED.        ║
╚══════════════════════════════════════════════════════════════════════════════╝

┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ STEP 1: CONTENT STRATEGY (DO THIS FIRST)                                      ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

You MUST include ALL of these sections with EXACTLY this content length:

1. HEADER (80-100 chars): Full Name + Job Title | City, Country | Phone | Email
2. PROFESSIONAL SUMMARY (250-300 chars): 3 impactful sentences with metrics
3. CORE COMPETENCIES (400-450 chars): 4 skill categories, each with 5-6 skills
4. PROFESSIONAL EXPERIENCE (1400-1500 chars): 2 positions, 4-5 bullets each
5. EDUCATION (80-100 chars): Degree + Institution + Location + Year
6. LANGUAGES (100-120 chars): 3 languages with proficiency levels

TOTAL TARGET: 2800-3000 TEXT CHARACTERS (excluding HTML tags)

┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ STEP 2: BULLET POINT RULES (CRITICAL FOR ATS)                                 ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

Each bullet point MUST:
✓ Start with a POWER VERB (Achieved, Delivered, Led, Implemented, Increased, Managed, Developed, Spearheaded, Optimized, Streamlined)
✓ Include a QUANTIFIABLE RESULT (number, percentage, or metric)
✓ Be 80-100 characters long each
✓ Be on its own line (NEVER combine multiple achievements in one bullet)

Example BULLETS (use similar structure):
• Delivered premium customer service to 150+ passengers daily, achieving 98% satisfaction rating through proactive communication and efficient problem resolution.
• Led cross-functional team of 12 staff members, increasing operational efficiency by 25% through implementation of streamlined workflows and standardized procedures.
• Managed inventory worth $500K+ with 99.9% accuracy, reducing waste by 15% through implementation of digital tracking systems and regular audits.
• Spearheaded training program for 50+ new hires, reducing onboarding time by 30% while improving retention rates by 20% through mentorship initiatives.

┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ STEP 3: HTML OUTPUT FORMAT (COPY EXACTLY)                                     ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

Use this EXACT structure:

<h1>FULL NAME</h1>
<h4>Job Title | City, Country | Phone | Email</h4>

<p><strong>PROFESSIONAL SUMMARY</strong></p>
<p>Three detailed sentences with specific achievements and metrics demonstrating value to potential employers.</p>

<p><strong>CORE COMPETENCIES & SKILLS</strong></p>
<ul>
<li>• <strong>Customer Service:</strong> Client Relations, Problem Resolution, Conflict Management, VIP Services, Service Excellence.</li>
<li>• <strong>Operations:</strong> Process Improvement, Team Coordination, Resource Management, Quality Assurance, Compliance.</li>
<li>• <strong>Communication:</strong> Multilingual Communication, Professional Correspondence, Stakeholder Management, Presentation Skills.</li>
<li>• <strong>Technical:</strong> Microsoft Office Suite, CRM Systems, Data Analysis Tools, Reservation Systems, ERP Software.</li>
</ul>

<p><strong>PROFESSIONAL EXPERIENCE</strong></p>
<p><strong>Job Title</strong> Company Name | City, Country | Month Year – Present</p>
<ul>
<li>• [Power verb] + [action] + [quantified result] with 80-100 characters per bullet.</li>
<li>• [Power verb] + [action] + [quantified result] with 80-100 characters per bullet.</li>
<li>• [Power verb] + [action] + [quantified result] with 80-100 characters per bullet.</li>
<li>• [Power verb] + [action] + [quantified result] with 80-100 characters per bullet.</li>
</ul>

<p><strong>Previous Job Title</strong> Previous Company | City, Country | Month Year – Month Year</p>
<ul>
<li>• [Power verb] + [action] + [quantified result] with 80-100 characters per bullet.</li>
<li>• [Power verb] + [action] + [quantified result] with 80-100 characters per bullet.</li>
<li>• [Power verb] + [action] + [quantified result] with 80-100 characters per bullet.</li>
<li>• [Power verb] + [action] + [quantified result] with 80-100 characters per bullet.</li>
</ul>

<p><strong>EDUCATION</strong></p>
<p><strong>Degree Name</strong> Institution Name | City, Country | Year</p>

<p><strong>LANGUAGES</strong></p>
<ul>
<li>• Language 1: Native</li>
<li>• Language 2: Fluent</li>
<li>• Language 3: Professional Working Proficiency</li>
</ul>

┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ STEP 4: ATS OPTIMIZATION CHECKLIST                                            ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

Before outputting, VERIFY:
□ Character count is 2800-3000 (count text only, not HTML tags)
□ Each bullet is on its own line
□ Every bullet starts with a power verb
□ Every bullet has a number/percentage
□ Keywords from job description are naturally integrated
□ No duplicate content
□ One A4 page compatible (0.95cm margins, Times New Roman, 12pt)

╔══════════════════════════════════════════════════════════════════════════════╗
║ INPUT DATA                                                                    ║
╚══════════════════════════════════════════════════════════════════════════════╝

CANDIDATE'S ORIGINAL RESUME:
${resumeText}

TARGET JOB DESCRIPTION:
${jobText}

╔══════════════════════════════════════════════════════════════════════════════╗
║ OUTPUT FORMAT - Return ONLY valid JSON                                       ║
╚══════════════════════════════════════════════════════════════════════════════╝

{
  "score": 85,
  "score_breakdown": {
    "impact": 85,
    "brevity": 80,
    "keywords": 90
  },
  "summary_critique": "Brief feedback on optimization",
  "missing_keywords": ["keyword1"],
  "matched_keywords": ["keyword2"],
  "optimized_content": "HTML CONTENT HERE - MUST BE 2800-3000 TEXT CHARACTERS"
}

NOW GENERATE THE OPTIMIZED RESUME. Remember: 2800-3000 TEXT CHARACTERS is MANDATORY!`;
}

function getPromptForAction(action: string, data: any): string {
  const prompts: Record<string, string> = {
    'generate-cover-letter': `You are a professional cover letter writer. Write a PROPER COVER LETTER - NOT a resume.

═══════════════════════════════════════════════════════════════════════════════
⚠️ COVER LETTER FORMAT - DO NOT USE BULLETS OR LISTS ⚠️
═══════════════════════════════════════════════════════════════════════════════

A cover letter is a FORMAL BUSINESS LETTER written in PARAGRAPHS, not bullet points!

Write EXACTLY in this letter format:

---
[Your Full Name]
[Job Title/Focus]
[City, Country]
[Phone Number]
[Email Address]

Date: [Current Date]

[Company Name]
[City, Country]

RE: Application for [Position Title]

Dear Hiring Manager,

[Opening paragraph: 2-3 sentences explaining which position you are applying for, where you found it, and why you are excited about this opportunity.]

[Body paragraph 1: 3-4 sentences describing your most relevant experience and achievements that directly relate to this position. Include specific metrics and examples.]

[Body paragraph 2: 3-4 sentences explaining why you want to work for THIS specific company, what value you bring, and how your skills match their needs.]

[Body paragraph 3: 2-3 sentences about language skills, availability, relocation readiness, and your commitment to the company's mission.]

[Closing paragraph: 2 sentences with a call to action requesting an interview and thanking them for their consideration.]

Sincerely,

[Your Full Name]
---

═══════════════════════════════════════════════════════════════════════════════
⚠️ CRITICAL RULES ⚠️
═══════════════════════════════════════════════════════════════════════════════

- DO NOT use bullet points
- DO NOT use numbered lists
- DO NOT use headings like "PROFESSIONAL SUMMARY" or "CORE COMPETENCIES"
- Write in proper paragraphs only
- Use formal business letter tone
- Total length: 300-350 words
- Margins: 0.95cm all sides
- Font: Times New Roman, 12pt

═══════════════════════════════════════════════════════════════════════════════
INPUT DATA
═══════════════════════════════════════════════════════════════════════════════

CANDIDATE'S RESUME:
${data.resume?.replace(/<[^>]*>/g, ' ') || ''}

TARGET JOB:
${data.job || ''}

Write the complete cover letter in the exact format shown above. Output ONLY the letter text.`,

    'generate-email': `Generate a hiring manager email.\n\nRESUME: ${data.resume?.replace(/<[^>]*>/g, ' ') || ''}\nJOB: ${data.job || ''}\n\nReturn JSON: {"subject_line": "subject", "email_body": "body"}`,

    'generate-interview': `Generate 5 interview questions with STAR answers.\n\nRESUME: ${data.resume?.replace(/<[^>]*>/g, ' ') || ''}\nJOB: ${data.job || ''}\n\nReturn JSON array: [{"question": "...", "star_answer": "..."}]`,

    'linkedin-optimize': `Create LinkedIn optimization.\n\nRESUME: ${data.resume?.replace(/<[^>]*>/g, ' ') || ''}\nJOB: ${data.job || ''}\n\nGenerate: Headline (120 chars), About section, Skills (10-15), Achievement highlights.`,

    'skills-gap': `Analyze skills gap.\n\nRESUME: ${data.resume?.replace(/<[^>]*>/g, ' ') || ''}\nJOB: ${data.job || ''}\n\nReturn JSON array: [{"skill": "...", "hasSkill": true/false, "importance": "high/medium/low", "suggestion": "..."}]`,

    'ats-simulation': `You are an ATS (Applicant Tracking System) Parsing Simulator. Analyze the following resume HTML for ATS compatibility.\n\nRESUME HTML: ${data.resumeHtml || ''}\n\nAnalyze for:\n1. Parsing confidence (0-100%)\n2. Issues detected (formatting, encoding, structure problems)\n3. Skills extracted count\n4. Keyword density analysis\n\nReturn JSON: { "parsing_confidence": number, "issues": [{"type": "string", "severity": "string", "message": "string"}], "extracted_entities": {"skills_detected": number}, "density_analysis": "string" }`,

    'fetch-job': `You are a job listing analyst. Analyze the job listing at this URL or from the provided information.\n\nURL: ${data.url || ''}\n\nExtract and summarize:\n- Job Title\n- Company Name\n- Location\n- Key Responsibilities\n- Required Skills (Hard Skills)\n- Soft Skills\n- Benefits/Perks\n\nProvide a comprehensive summary that a job seeker would find useful for tailoring their resume.`
  };
  return prompts[action] || '';
}

// =============================================================================
// CHARACTER COUNT & ENFORCEMENT
// =============================================================================

// Count text characters excluding HTML tags
function countTextCharacters(html: string): number {
  const textOnly = html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  return textOnly.length;
}

// Expand content if below minimum characters
function expandContent(html: string, minChars: number = 2800): string {
  const currentCount = countTextCharacters(html);
  
  if (currentCount >= minChars) {
    return html;
  }
  
  console.log(`Content too short (${currentCount}), expanding to ${minChars}...`);
  
  let result = html;
  const deficit = minChars - currentCount;
  
  // Find all bullet points and expand them
  const bulletRegex = /<li>•\s*([^<]+)<\/li>/gi;
  const bullets = result.match(bulletRegex) || [];
  
  // Expand each bullet by adding more detail
  bullets.forEach(bullet => {
    if (countTextCharacters(result) >= minChars) return;
    
    const content = bullet.replace(/<\/?li[^>]*>/gi, '').replace(/•\s*/, '').trim();
    
    // Add more detail to bullets that seem short
    if (content.length < 100 && !content.includes('%') && !content.includes('+')) {
      // Add quantification if missing
      const expandedContent = content.replace(/\.$/, `, resulting in improved team performance and customer satisfaction metrics.`);
      result = result.replace(bullet, `<li>• ${expandedContent}</li>`);
    }
  });
  
  // If still short, add more skills to categories
  if (countTextCharacters(result) < minChars) {
    result = result.replace(
      /<li>• <strong>(Customer Service):<\/strong>\s*([^<]+)<\/li>/gi,
      '<li>• <strong>$1:</strong> $2, Guest Relations, Service Recovery.</li>'
    );
    result = result.replace(
      /<li>• <strong>(Operations):<\/strong>\s*([^<]+)<\/li>/gi,
      '<li>• <strong>$1:</strong> $2, Supply Chain Management, Quality Control.</li>'
    );
  }
  
  // If still short, expand professional summary
  if (countTextCharacters(result) < minChars) {
    const summaryRegex = /<p><strong>PROFESSIONAL SUMMARY<\/strong><\/p>\s*<p>([^<]+)<\/p>/i;
    const summaryMatch = result.match(summaryRegex);
    if (summaryMatch) {
      const expandedSummary = summaryMatch[1] + ' Proven track record of exceeding performance targets and delivering exceptional results in fast-paced environments.';
      result = result.replace(summaryRegex, `<p><strong>PROFESSIONAL SUMMARY</strong></p>\n<p>${expandedSummary}</p>`);
    }
  }
  
  console.log(`After expansion: ${countTextCharacters(result)} characters`);
  return result;
}

// Truncate content if above maximum characters
function truncateContent(html: string, maxChars: number = 3200): string {
  const currentCount = countTextCharacters(html);
  
  if (currentCount <= maxChars) {
    return html;
  }
  
  console.log(`Content too long (${currentCount}), truncating to ${maxChars}...`);
  
  let result = html;
  
  // Get all bullets and sort by length (remove longest first)
  const bulletRegex = /<li>•[^<]+<\/li>/gi;
  const bullets = (result.match(bulletRegex) || []).sort((a, b) => b.length - a.length);
  
  let removed = 0;
  for (const bullet of bullets) {
    if (countTextCharacters(result) <= maxChars) break;
    
    // Don't remove skill category bullets (they have <strong>)
    if (bullet.includes('<strong>') && result.match(bulletRegex)?.length || 0 < 8) {
      continue;
    }
    
    result = result.replace(bullet, '');
    removed++;
  }
  
  // Clean up empty lists
  result = result.replace(/<ul>\s*<\/ul>/gi, '');
  result = result.replace(/\n{3,}/g, '\n\n');
  
  console.log(`After truncation: ${countTextCharacters(result)} characters (removed ${removed} bullets)`);
  return result;
}

// Post-process HTML to fix combined bullets
function fixCombinedBullets(html: string): string {
  if (!html || typeof html !== 'string') return '';
  
  let result = html;
  
  // Split multiple bullets with • symbol on same line
  let iterations = 0;
  while (result.match(/<li>\s*•\s*[^<]+•\s*[^<]+\s*<\/li>/i) && iterations < 10) {
    result = result.replace(/<li>\s*•\s*([^<•]+?)\s*•\s*([^<]+?)\s*<\/li>/gi, 
      '<li>• $1</li>\n<li>• $2</li>');
    iterations++;
  }
  
  // Split items separated by | character
  iterations = 0;
  while (result.match(/<li>\s*•\s*[^<]+\|\s*[^<]+\s*<\/li>/i) && iterations < 10) {
    result = result.replace(/<li>\s*•\s*([^<|]+?)\s*\|\s*([^<]+?)\s*<\/li>/gi, 
      '<li>• $1</li>\n<li>• $2</li>');
    iterations++;
  }
  
  // Split bullets with two sentences
  result = result.replace(/<li>\s*•\s*([A-Z][^<]+?\.)\s+([A-Z][^<]+)\s*<\/li>/gi, 
    '<li>• $1</li>\n<li>• $2</li>');
  
  // Remove empty <li> elements
  result = result.replace(/<li>\s*<\/li>/gi, '');
  result = result.replace(/<li>\s*•\s*<\/li>/gi, '');
  
  // Clean up multiple newlines
  result = result.replace(/\n{3,}/g, '\n\n');
  
  return result.trim();
}

// Process response with character enforcement
function processResponse(action: string, text: string, data?: any) {
  if (action === 'extract-file' || action === 'extract-local') {
    return NextResponse.json({ success: true, data: { text } });
  }
  
  if (action === 'optimize-resume') {
    try {
      let cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        if (parsed.optimized_content) {
          // Fix combined bullets
          parsed.optimized_content = fixCombinedBullets(parsed.optimized_content);
          
          // Enforce character limits - EXPAND if too short, TRUNCATE if too long
          const currentCount = countTextCharacters(parsed.optimized_content);
          console.log(`Initial character count: ${currentCount}`);
          
          if (currentCount < 2800) {
            console.log('Content too short, attempting expansion...');
            parsed.optimized_content = expandContent(parsed.optimized_content, 2800);
          } else if (currentCount > 3200) {
            console.log('Content too long, truncating...');
            parsed.optimized_content = truncateContent(parsed.optimized_content, 3200);
          }
          
          const finalCount = countTextCharacters(parsed.optimized_content);
          console.log(`Final character count: ${finalCount}`);
        }
        
        // Ensure we have all required fields
        return NextResponse.json({ 
          success: true, 
          data: {
            score: parsed.score || 85,
            score_breakdown: {
              impact: parsed.score_breakdown?.impact || 85,
              brevity: parsed.score_breakdown?.brevity || 80,
              keywords: parsed.score_breakdown?.keywords || 90
            },
            summary_critique: parsed.summary_critique || 'Resume optimized successfully for maximum ATS score.',
            missing_keywords: parsed.missing_keywords || [],
            matched_keywords: parsed.matched_keywords || [],
            optimized_content: parsed.optimized_content || ''
          }
        });
      }
    } catch (e) {
      console.error('JSON parse error:', e);
    }
    
    // Fallback if JSON parsing fails
    let fallbackContent = fixCombinedBullets(text);
    fallbackContent = expandContent(fallbackContent, 2800);
    
    return NextResponse.json({ 
      success: true, 
      data: { 
        score: 80, 
        score_breakdown: { impact: 85, brevity: 80, keywords: 85 }, 
        summary_critique: 'Resume optimized with fallback processing.',
        missing_keywords: [],
        matched_keywords: [],
        optimized_content: fallbackContent
      } 
    });
  }
  
  if (action === 'generate-email' || action === 'generate-interview' || action === 'skills-gap' || action === 'ats-simulation') {
    try {
      let cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const jsonMatch = cleanText.match(/[\[\{][\s\S]*[\]\}]/);
      if (jsonMatch) {
        return NextResponse.json({ success: true, data: JSON.parse(jsonMatch[0]) });
      }
    } catch (e) {}
  }
  
  // Default: return text response (used for fetch-job, cover-letter, etc.)
  return NextResponse.json({ success: true, data: { text } });
}
