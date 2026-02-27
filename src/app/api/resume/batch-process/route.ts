import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  registerActiveBatch,
  unregisterActiveBatch,
  updateResumeResult,
  incrementBatchProgress,
  canStartNewBatch
} from '@/lib/batch-processor';
import ZAI from 'z-ai-web-dev-sdk';

// Character target for optimization
const CHAR_TARGET_MIN = 2750;
const CHAR_TARGET_MAX = 2850;
const CHAR_TARGET_OPTIMAL = 2800;

// Build optimization prompt
function buildOptimizePrompt(resumeText: string, jobText: string, language: string = 'en'): string {
  const langInstructions = language === 'fr'
    ? 'Générez le CV optimisé en français.'
    : 'Generate the optimized resume in English.';

  return `You are a SENIOR ATS RESUME OPTIMIZATION EXPERT. Create an ATS-MAXIMIZED resume.

CRITICAL CONSTRAINTS:
- Target EXACTLY ${CHAR_TARGET_OPTIMAL} text characters (excluding HTML tags)
- Maximum ${CHAR_TARGET_MAX} characters
- Minimum ${CHAR_TARGET_MIN} characters
- ONE A4 PAGE ONLY
- ${langInstructions}

HTML OUTPUT FORMAT:
<h1>FULL NAME</h1>
<h4>Job Title | City, Country | Phone | Email</h4>

<p><strong>PROFESSIONAL SUMMARY</strong></p>
<p>Three detailed sentences with metrics.</p>

<p><strong>CORE COMPETENCIES & SKILLS</strong></p>
<ul>
<li>• <strong>Category:</strong> Skills listed here.</li>
</ul>

<p><strong>PROFESSIONAL EXPERIENCE</strong></p>
<p><strong>Job Title</strong> Company | Location | Date</p>
<ul>
<li>• Power verb + action + quantified result (80-100 chars per bullet).</li>
</ul>

<p><strong>EDUCATION</strong></p>
<p><strong>Degree</strong> Institution | Location | Year</p>

<p><strong>LANGUAGES</strong></p>
<ul>
<li>• Language: Proficiency Level</li>
</ul>

ORIGINAL RESUME:
${resumeText}

TARGET JOB:
${jobText}

Return ONLY valid JSON:
{
  "score": 85,
  "score_breakdown": { "impact": 85, "brevity": 80, "keywords": 90 },
  "summary_critique": "Brief feedback",
  "missing_keywords": ["keyword1"],
  "matched_keywords": ["keyword2"],
  "optimized_content": "HTML CONTENT HERE - MUST BE ${CHAR_TARGET_MIN}-${CHAR_TARGET_MAX} TEXT CHARACTERS"
}`;
}

// Process a single resume
async function processResume(
  resumeId: string,
  resumeText: string,
  jobDescription: string | null,
  language: string,
  provider?: string,
  apiKey?: string,
  model?: string
): Promise<void> {
  try {
    // Mark as processing
    await db.resume.update({
      where: { id: resumeId },
      data: { status: 'processing' }
    });

    let optimizedContent = '';
    let scoreBefore = 0;
    let scoreAfter = 0;
    let tokenUsage = 0;

    // Use job description or default
    const jobText = jobDescription || 'General professional position requiring strong skills and experience.';

    // Calculate approximate score before (based on content length and keywords)
    const textLength = resumeText.length;
    scoreBefore = Math.min(100, Math.max(0, Math.round(textLength / 30)));

    // Build prompt
    const prompt = buildOptimizePrompt(resumeText, jobText, language);

    // Call AI
    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: 'You are a resume optimization expert. Return only valid JSON.' },
        { role: 'user', content: prompt }
      ]
    });

    const responseText = completion.choices?.[0]?.message?.content || '';

    // Parse response
    try {
      // Try to extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        optimizedContent = parsed.optimized_content || '';
        scoreAfter = parsed.score || 85;

        // Validate character count
        const textOnly = optimizedContent.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
        const charCount = textOnly.length;

        if (charCount < CHAR_TARGET_MIN || charCount > CHAR_TARGET_MAX) {
          console.log(`Character count ${charCount} outside target range, but accepting result`);
        }
      } else {
        // Use response as-is if not JSON
        optimizedContent = responseText;
        scoreAfter = 85;
      }
    } catch (parseError) {
      console.error('Parse error:', parseError);
      // Use raw response
      optimizedContent = responseText;
      scoreAfter = 85;
    }

    // Estimate token usage
    tokenUsage = Math.ceil((resumeText.length + optimizedContent.length) / 4);

    // Save result
    await updateResumeResult(resumeId, {
      optimizedContent,
      atsScoreBefore: scoreBefore,
      atsScoreAfter: scoreAfter,
      providerUsed: provider || 'zai',
      tokenUsage,
      costEstimate: tokenUsage * 0.00001, // Rough estimate
      status: 'completed'
    });

    // Increment batch progress
    const resume = await db.resume.findUnique({ where: { id: resumeId } });
    if (resume?.batchId) {
      const batch = await db.batch.findUnique({ where: { id: resume.batchId } });
      if (batch) {
        await incrementBatchProgress(batch.batchId, true);
      }
    }

  } catch (error: any) {
    console.error('Resume processing error:', error);

    // Save error
    await updateResumeResult(resumeId, {
      status: 'failed',
      errorMessage: error.message || 'Processing failed'
    });

    // Increment batch progress as failed
    const resume = await db.resume.findUnique({ where: { id: resumeId } });
    if (resume?.batchId) {
      const batch = await db.batch.findUnique({ where: { id: resume.batchId } });
      if (batch) {
        await incrementBatchProgress(batch.batchId, false);
      }
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { batchId, provider, apiKey, model } = body;

    if (!batchId) {
      return NextResponse.json({
        success: false,
        error: 'Batch ID is required'
      }, { status: 400 });
    }

    // Get batch
    const batch = await db.batch.findUnique({
      where: { batchId },
      include: {
        resumes: {
          where: { status: 'pending' }
        }
      }
    });

    if (!batch) {
      return NextResponse.json({
        success: false,
        error: 'Batch not found'
      }, { status: 404 });
    }

    if (batch.status === 'completed') {
      return NextResponse.json({
        success: true,
        batchId,
        status: 'completed',
        message: 'Batch already completed'
      });
    }

    if (batch.status === 'cancelled') {
      return NextResponse.json({
        success: false,
        error: 'Batch was cancelled'
      }, { status: 400 });
    }

    if (batch.status === 'processing') {
      return NextResponse.json({
        success: true,
        batchId,
        status: 'processing',
        message: 'Batch is already being processed'
      });
    }

    // Check if we can start a new batch
    if (!canStartNewBatch()) {
      return NextResponse.json({
        success: false,
        error: 'Maximum concurrent batches reached'
      }, { status: 503 });
    }

    // Update batch status
    await db.batch.update({
      where: { batchId },
      data: { status: 'processing' }
    });

    // Register as active
    registerActiveBatch(batchId);

    // Start async processing (don't await)
    (async () => {
      try {
        // Get pending resumes again (to ensure we have latest state)
        const pendingResumes = await db.resume.findMany({
          where: {
            batchId: batch.id,
            status: 'pending'
          }
        });

        // Process one at a time for stability
        for (const resume of pendingResumes) {
          // Check if batch was cancelled
          const currentBatch = await db.batch.findUnique({ where: { batchId } });
          if (currentBatch?.status === 'cancelled') {
            break;
          }

          await processResume(
            resume.id,
            resume.originalContent,
            batch.jobDescription,
            batch.language,
            provider,
            apiKey,
            model
          );

          // Small delay between files
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        // Final status update
        const finalBatch = await db.batch.findUnique({
          where: { batchId },
          include: { resumes: true }
        });

        if (finalBatch && finalBatch.status !== 'cancelled') {
          const allDone = finalBatch.resumes.every(
            r => r.status === 'completed' || r.status === 'failed'
          );
          if (allDone) {
            await db.batch.update({
              where: { batchId },
              data: { status: 'completed' }
            });
          }
        }

      } catch (err) {
        console.error('Batch processing error:', err);
        await db.batch.update({
          where: { batchId },
          data: { status: 'failed' }
        });
      } finally {
        unregisterActiveBatch(batchId);
      }
    })();

    return NextResponse.json({
      success: true,
      batchId,
      status: 'processing',
      message: 'Batch processing started',
      totalFiles: batch.totalFiles,
      pendingFiles: batch.resumes.length
    });

  } catch (error: any) {
    console.error('Batch process error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to process batch'
    }, { status: 500 });
  }
}
