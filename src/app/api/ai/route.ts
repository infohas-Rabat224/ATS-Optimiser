import { NextRequest, NextResponse } from 'next/server';

console.log('🔄 API route loaded - v3 (client-side PDF extraction)');

// Multi-provider AI endpoint
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, data, provider, apiKey, model } = body;
    
    // Handle local PDF extraction (no AI needed)
    if (action === 'extract-local') {
      return await handleLocalExtraction(data);
    }
    
    // If provider is specified but no API key, return error
    if (provider && !apiKey) {
      return NextResponse.json({ 
        success: false, 
        error: `No API key provided for ${provider}. Please add your ${provider} API key in Settings.` 
      }, { status: 400 });
    }
    
    // If no provider specified, use server-side Gemini (default)
    if (!provider) {
      return await handleDefaultGemini(action, data);
    }

    switch (provider) {
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
      default:
        return NextResponse.json({ 
          success: false, 
          error: `Provider '${provider}' not yet implemented.` 
        }, { status: 400 });
    }
  } catch (error: any) {
    console.error('AI API Error:', error);
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

// Default server-side Gemini (uses Vercel env var GEMINI_API_KEY)
async function handleDefaultGemini(action: string, data: any) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  
  if (!apiKey) {
    return NextResponse.json({ 
      success: false, 
      error: 'No API key configured. Please add your API key in Settings or configure GEMINI_API_KEY on the server.' 
    }, { status: 400 });
  }
  
  return handleGemini(action, data, apiKey, 'gemini-2.0-flash');
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
    
    return processResponse(action, text);
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
    
    return processResponse(action, text);
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
    
    return processResponse(action, text);
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
    
    return processResponse(action, text);
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
    
    return processResponse(action, text);
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
        'HTTP-Referer': 'https://my-project-nine-tau-35.vercel.app',
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
    
    return processResponse(action, text);
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
    
    return processResponse(action, text);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// Helper functions
function buildOptimizePrompt(data: any): string {
  const resumeText = data.resume?.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() || '';
  const jobText = data.job?.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() || '';

  return `You are an ATS Resume Expert. Create an OPTIMIZED RESUME in HTML format.

═══════════════════════════════════════════════════════════════════════════════
⛔⛔⛔ STRICT CHARACTER LIMIT - THIS IS NON-NEGOTIABLE ⛔⛔⛔
═══════════════════════════════════════════════════════════════════════════════

EXACTLY 2800-3200 CHARACTERS OF TEXT CONTENT (excluding HTML tags)

🛑 IF YOUR OUTPUT EXCEEDS 3200 CHARACTERS, IT WILL BE REJECTED! 🛑
🛑 IF YOUR OUTPUT IS BELOW 2800 CHARACTERS, IT WILL BE REJECTED! 🛑

STEPS TO ENSURE CORRECT CHARACTER COUNT:
1. Write the resume content first
2. COUNT THE CHARACTERS (excluding HTML tags like <p>, <li>, <strong>, etc.)
3. If over 3200: DELETE bullet points until under 3200
4. If under 2800: ADD more details to existing bullet points

MAXIMUM STRUCTURE ALLOWED (to stay under 3200 characters):
- 1 Name line
- 1 Contact line
- 1 Professional Summary paragraph (3 sentences MAX)
- 4 Skill categories with 4-5 skills each (one bullet per category)
- 2 Job positions with exactly 3-4 bullets each
- 1 Education entry
- 2-3 Languages

═══════════════════════════════════════════════════════════════════════════════
CRITICAL BULLET FORMATTING RULES - MUST FOLLOW EXACTLY
═══════════════════════════════════════════════════════════════════════════════

⚠️ EACH BULLET MUST BE ON ITS OWN SEPARATE LINE - NO EXCEPTIONS! ⚠️

CORRECT FORMAT (each bullet on its own line):
<ul>
<li>• Single achievement or skill item here.</li>
<li>• Different achievement or skill here.</li>
<li>• Another separate item here.</li>
</ul>

❌ WRONG - DO NOT DO THIS:
<li>• First item. Second item.</li>          <-- TWO items on one line - WRONG!
<li>• Item 1 • Item 2</li>                   <-- TWO bullets on one line - WRONG!
<li>• Skill 1, Skill 2, Skill 3.</li>        <-- Multiple skills without category - WRONG!

✅ CORRECT FOR SKILLS:
<li>• <strong>Category Name:</strong> Skill 1, Skill 2, Skill 3.</li>

✅ CORRECT FOR ACHIEVEMENTS (one achievement per bullet):
<li>• Increased customer satisfaction by 25% through improved service protocols.</li>
<li>• Managed daily operations for a team of 15 staff members.</li>

═══════════════════════════════════════════════════════════════════════════════
OTHER CRITICAL RULES
═══════════════════════════════════════════════════════════════════════════════

1. Output MUST fit on ONE A4 page with margins 0.95cm
2. NO duplicate content - check your output before returning
3. Font: Times New Roman, 12pt
4. EXACTLY 3-4 bullets per job position (NOT 5!)
5. EXACTLY 4 skill categories with 4-5 skills each
6. Include quantified achievements with numbers/percentages
7. Professional summary should be 3 sentences MAX (not 4!)
8. COUNT YOUR CHARACTERS BEFORE OUTPUTTING!

═══════════════════════════════════════════════════════════════════════════════
EXACT OUTPUT FORMAT (copy this structure exactly)
═══════════════════════════════════════════════════════════════════════════════

<h1>FULL NAME</h1>
<h4>Job Title | City, Country | Phone | Email</h4>

<p><strong>PROFESSIONAL SUMMARY</strong></p>
<p>Three to four detailed sentences about professional background, key achievements, and career objectives with specific metrics where possible.</p>

<p><strong>CORE COMPETENCIES & SKILLS</strong></p>
<ul>
<li>• <strong>Customer Service:</strong> Client Relations, Problem Resolution, Conflict Management.</li>
<li>• <strong>Operations:</strong> Process Improvement, Team Coordination, Resource Management.</li>
<li>• <strong>Communication:</strong> Multilingual, Professional Correspondence, Stakeholder Management.</li>
<li>• <strong>Technical:</strong> Microsoft Office Suite, CRM Systems, Data Analysis Tools.</li>
</ul>

<p><strong>PROFESSIONAL EXPERIENCE</strong></p>
<p><strong>Job Title</strong> Company | City, Country | Month Year – Month Year</p>
<ul>
<li>• Delivered exceptional customer service to 100+ clients daily with 98% satisfaction.</li>
<li>• Improved operational efficiency by 20% through streamlined workflows.</li>
<li>• Led a team of 8 staff members, exceeding targets by 15%.</li>
<li>• Implemented scheduling system reducing wait times by 30%.</li>
</ul>

<p><strong>EDUCATION</strong></p>
<p><strong>Degree Name</strong> Institution | City, Country | Year</p>

<p><strong>LANGUAGES</strong></p>
<ul>
<li>• Language 1: Native</li>
<li>• Language 2: Fluent</li>
<li>• Language 3: Professional Working Proficiency</li>
</ul>

═══════════════════════════════════════════════════════════════════════════════
INPUT DATA
═══════════════════════════════════════════════════════════════════════════════

RESUME CONTENT:
${resumeText}

JOB DESCRIPTION:
${jobText}

═══════════════════════════════════════════════════════════════════════════════

Now generate the optimized resume following ALL rules strictly.
Return JSON: {"score": 85, "score_breakdown": {"impact": 85, "brevity": 80, "keywords": 90}, "summary_critique": "Brief feedback", "missing_keywords": ["kw1"], "matched_keywords": ["kw2"], "optimized_content": "HTML here"}`;
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

    'skills-gap': `Analyze skills gap.\n\nRESUME: ${data.resume?.replace(/<[^>]*>/g, ' ') || ''}\nJOB: ${data.job || ''}\n\nReturn JSON array: [{"skill": "...", "hasSkill": true/false, "importance": "high/medium/low", "suggestion": "..."}]`
  };
  return prompts[action] || '';
}

// Count text characters excluding HTML tags
function countTextCharacters(html: string): number {
  const textOnly = html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  return textOnly.length;
}

// Enforce character limits by truncating content if needed
function enforceCharacterLimit(html: string): string {
  const MIN_CHARS = 2800;
  const MAX_CHARS = 3200;
  
  let result = html;
  let charCount = countTextCharacters(result);
  
  console.log(`Character count before enforcement: ${charCount}`);
  
  // If over the limit, progressively remove bullets
  if (charCount > MAX_CHARS) {
    console.log(`Content too long (${charCount}), truncating...`);
    
    // Get all list items
    const liRegex = /<li>•[^<]+<\/li>/gi;
    const lis = result.match(liRegex) || [];
    
    // Remove bullets from the end until we're under the limit
    // But keep a minimum number of bullets
    const minBulletsPerSection = 3;
    let bulletsRemoved = 0;
    
    while (charCount > MAX_CHARS && bulletsRemoved < lis.length - minBulletsPerSection * 2) {
      // Remove the longest bullet points first
      const bulletLengths = lis.map((li, idx) => ({
        idx,
        length: li.length,
        content: li
      })).sort((a, b) => b.length - a.length);
      
      // Mark one bullet for removal
      const toRemove = bulletLengths[bulletsRemoved];
      if (toRemove) {
        result = result.replace(toRemove.content, '');
        bulletsRemoved++;
        charCount = countTextCharacters(result);
      } else {
        break;
      }
    }
    
    // Clean up empty lists and extra whitespace
    result = result.replace(/<ul>\s*<\/ul>/gi, '');
    result = result.replace(/\n{3,}/g, '\n\n');
    
    charCount = countTextCharacters(result);
    console.log(`Character count after truncation: ${charCount}`);
  }
  
  // Log warning if under minimum
  if (charCount < MIN_CHARS) {
    console.warn(`Warning: Content below minimum (${charCount} < ${MIN_CHARS})`);
  }
  
  return result;
}

// Post-process HTML to fix combined bullets - VERY AGGRESSIVE
function fixCombinedBullets(html: string): string {
  console.log('fixCombinedBullets called on content length:', html?.length || 0);
  
  if (!html || typeof html !== 'string') {
    return '';
  }
  
  let result = html;
  
  // Pattern 1: Split multiple bullets with • symbol on same line
  // Keep doing this until no more matches
  let iterations = 0;
  while (result.match(/<li>\s*•\s*[^<]+•\s*[^<]+\s*<\/li>/i) && iterations < 10) {
    result = result.replace(/<li>\s*•\s*([^<•]+?)\s*•\s*([^<]+?)\s*<\/li>/gi, 
      '<li>• $1</li>\n<li>• $2</li>');
    iterations++;
  }
  
  // Pattern 2: Split items separated by | character
  iterations = 0;
  while (result.match(/<li>\s*•\s*[^<]+\|\s*[^<]+\s*<\/li>/i) && iterations < 10) {
    result = result.replace(/<li>\s*•\s*([^<|]+?)\s*\|\s*([^<]+?)\s*<\/li>/gi, 
      '<li>• $1</li>\n<li>• $2</li>');
    iterations++;
  }
  
  // Pattern 3: Split bullets that have TWO complete sentences separated by period-space
  // Match: <li>• First sentence. Second sentence.</li>  ->  Two separate bullets
  result = result.replace(/<li>\s*•\s*([A-Z][^<]+?\.)\s+([A-Z][^<]+)\s*<\/li>/gi, 
    '<li>• $1</li>\n<li>• $2</li>');
  
  // Pattern 4: Handle skill categories properly
  // "Category: item1, item2, item3" should stay together as ONE bullet
  // But "Category: item1. Category2: item2" should be split
  result = result.replace(/<li>\s*•\s*<strong>([^:]+):\s*<\/strong>\s*([^<]+?)\.\s+([A-Z][^<]+)\s*<\/li>/gi,
    '<li>• <strong>$1:</strong> $2.</li>\n<li>• $3</li>');
  
  // Pattern 5: Remove duplicate <li> elements
  const liMatches = result.match(/<li>•[^<]+<\/li>/gi) || [];
  const seenContent = new Set<string>();
  const uniqueLis: string[] = [];
  
  liMatches.forEach(li => {
    const normalized = li.toLowerCase().replace(/\s+/g, ' ').trim();
    if (!seenContent.has(normalized)) {
      seenContent.add(normalized);
      uniqueLis.push(li);
    }
  });
  
  // Replace all <li> elements with unique ones
  if (uniqueLis.length > 0 && liMatches.length !== uniqueLis.length) {
    let liIndex = 0;
    result = result.replace(/<li>•[^<]+<\/li>/gi, () => {
      return uniqueLis[liIndex++] || '';
    });
  }
  
  // Pattern 6: Clean up malformed HTML
  result = result.replace(/<\/li\s*>/gi, '</li>');
  result = result.replace(/<li\s*>/gi, '<li>');
  result = result.replace(/<\/ul\s*>/gi, '</ul>');
  result = result.replace(/<ul\s*>/gi, '<ul>');
  
  // Pattern 7: Fix unclosed tags
  result = result.replace(/<li>[^<]*$/gm, ''); // Remove unclosed li tags at end of lines
  result = result.replace(/<[^>]*$/gm, ''); // Remove any other unclosed tags at end
  
  // Pattern 8: Ensure proper line breaks between sections
  result = result.replace(/<\/ul>\s*<p>/gi, '</ul>\n\n<p>');
  result = result.replace(/<\/p>\s*<p><strong>/gi, '</p>\n\n<p><strong>');
  
  // Pattern 9: Remove empty <li> elements
  result = result.replace(/<li>\s*<\/li>/gi, '');
  result = result.replace(/<li>\s*•\s*<\/li>/gi, '');
  
  // Clean up multiple newlines
  result = result.replace(/\n{3,}/g, '\n\n');
  
  return result.trim();
}

function processResponse(action: string, text: string) {
  if (action === 'extract-file' || action === 'extract-local') {
    return NextResponse.json({ success: true, data: { text } });
  }
  
  if (action === 'optimize-resume') {
    try {
      let cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        // Fix combined bullets in the output
        if (parsed.optimized_content) {
          parsed.optimized_content = fixCombinedBullets(parsed.optimized_content);
          // Enforce character limits
          parsed.optimized_content = enforceCharacterLimit(parsed.optimized_content);
        }
        // Ensure we have all required fields
        return NextResponse.json({ 
          success: true, 
          data: {
            score: parsed.score || 80,
            score_breakdown: {
              impact: parsed.score_breakdown?.impact || 80,
              brevity: parsed.score_breakdown?.brevity || 75,
              keywords: parsed.score_breakdown?.keywords || 80
            },
            summary_critique: parsed.summary_critique || 'Resume optimized successfully',
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
    fallbackContent = enforceCharacterLimit(fallbackContent);
    return NextResponse.json({ 
      success: true, 
      data: { 
        score: 75, 
        score_breakdown: { impact: 80, brevity: 75, keywords: 70 }, 
        optimized_content: fallbackContent
      } 
    });
  }
  
  if (action === 'generate-email' || action === 'generate-interview' || action === 'skills-gap') {
    try {
      let cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const jsonMatch = cleanText.match(/[\[\{][\s\S]*[\]\}]/);
      if (jsonMatch) {
        return NextResponse.json({ success: true, data: JSON.parse(jsonMatch[0]) });
      }
    } catch (e) {}
  }
  
  return NextResponse.json({ success: true, data: { text } });
}
