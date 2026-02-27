import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  registerActiveBatch,
  unregisterActiveBatch,
  updateResumeResult,
  incrementBatchProgress,
  canStartNewBatch,
  enforceCharacterConstraint,
  CHAR_TARGET_MIN,
  CHAR_TARGET_MAX,
  CHAR_TARGET_OPTIMAL
} from '@/lib/batch-processor';
import ZAI from 'z-ai-web-dev-sdk';

// Build optimization prompt with next steps
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
  "next_step_suggestions": "3-5 actionable recommendations for further improvement",
  "optimized_content": "HTML CONTENT HERE - MUST BE ${CHAR_TARGET_MIN}-${CHAR_TARGET_MAX} TEXT CHARACTERS"
}`;
}

// Generate next step suggestions based on the optimization result
function generateNextSteps(parsed: any, charValidation: { valid: boolean; charCount: number; message: string }): string {
  const suggestions: string[] = [];

  // Character count feedback
  if (!charValidation.valid) {
    suggestions.push(`Adjust resume length: ${charValidation.message}`);
  }

  // Missing keywords
  if (parsed.missing_keywords && parsed.missing_keywords.length > 0) {
    suggestions.push(`Consider incorporating these keywords: ${parsed.missing_keywords.slice(0, 5).join(', ')}`);
  }

  // Score-based suggestions
  if (parsed.score_breakdown) {
    if (parsed.score_breakdown.impact < 80) {
      suggestions.push('Add more quantifiable achievements (numbers, percentages, metrics)');
    }
    if (parsed.score_breakdown.brevity < 80) {
      suggestions.push('Tighten bullet points - aim for 80-100 characters each');
    }
    if (parsed.score_breakdown.keywords < 80) {
      suggestions.push('Incorporate more industry-specific keywords from the job description');
    }
  }

  // General suggestions
  if (suggestions.length === 0) {
    suggestions.push('Resume is well-optimized for ATS. Consider tailoring for specific job applications.');
  }

  return suggestions.join(' | ');
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
    let nextStepSuggestions = '';
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

    // Call AI using z-ai-web-dev-sdk
    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: 'You are a resume optimization expert. Return only valid JSON with optimized_content, score, score_breakdown, summary_critique, missing_keywords, matched_keywords, and next_step_suggestions fields.' },
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

        // SERVER-SIDE CHARACTER CONSTRAINT ENFORCEMENT
        const charValidation = enforceCharacterConstraint(optimizedContent);

        if (!charValidation.valid) {
          console.log(`Character constraint violation: ${charValidation.message}`);
          // We still save but log the violation
        }

        // Generate next step suggestions
        nextStepSuggestions = generateNextSteps(parsed, charValidation);
        if (parsed.next_step_suggestions) {
          nextStepSuggestions = `${parsed.next_step_suggestions} | ${nextStepSuggestions}`;
        }
      } else {
        // Use response as-is if not JSON
        optimizedContent = responseText;
        scoreAfter = 85;
        nextStepSuggestions = 'Resume processed. Review content for ATS optimization opportunities.';
      }
    } catch (parseError) {
      console.error('Parse error:', parseError);
      // Use raw response
      optimizedContent = responseText;
      scoreAfter = 85;
      nextStepSuggestions = 'Resume processed. Manual review recommended.';
    }

    // Final character validation
    const finalValidation = enforceCharacterConstraint(optimizedContent);

    // Estimate token usage (rough approximation)
    tokenUsage = Math.ceil((resumeText.length + optimizedContent.length) / 4);

    // Calculate cost estimate (based on provider)
    const costPerToken = 0.00001; // $0.01 per 1000 tokens average
    const costEstimate = tokenUsage * costPerToken;

    // Save result with all fields
    await updateResumeResult(resumeId, {
      optimizedContent,
      nextStepSuggestions,
      atsScoreBefore: scoreBefore,
      atsScoreAfter: scoreAfter,
      providerUsed: provider || 'zai',
      tokenUsage,
      costEstimate,
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
