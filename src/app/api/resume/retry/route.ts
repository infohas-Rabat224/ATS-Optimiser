import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getFailedResumes, resetResumeForRetry } from '@/lib/batch-processor';

// Get failed resumes for a batch
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const batchId = searchParams.get('batchId');

    if (!batchId) {
      return NextResponse.json({
        success: false,
        error: 'Batch ID is required'
      }, { status: 400 });
    }

    const failedResumes = await getFailedResumes(batchId);

    return NextResponse.json({
      success: true,
      failedResumes
    });

  } catch (error: any) {
    console.error('Retry fetch error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to get failed resumes'
    }, { status: 500 });
  }
}

// Reset failed resumes for retry
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { resumeIds, batchId } = body;

    if (!resumeIds && !batchId) {
      return NextResponse.json({
        success: false,
        error: 'Either resumeIds or batchId is required'
      }, { status: 400 });
    }

    let resetCount = 0;

    if (resumeIds && Array.isArray(resumeIds)) {
      // Reset specific resumes
      for (const resumeId of resumeIds) {
        const success = await resetResumeForRetry(resumeId);
        if (success) resetCount++;
      }
    } else if (batchId) {
      // Reset all failed resumes in batch
      const batch = await db.batch.findUnique({ where: { batchId } });
      if (batch) {
        const failedResumes = await db.resume.findMany({
          where: { batchId: batch.id, status: 'failed' }
        });
        
        for (const resume of failedResumes) {
          const success = await resetResumeForRetry(resume.id);
          if (success) resetCount++;
        }
        
        // Update batch failed count
        await db.batch.update({
          where: { batchId },
          data: { 
            failedFiles: { decrement: resetCount },
            status: 'pending'
          }
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Reset ${resetCount} resumes for retry`,
      resetCount
    });

  } catch (error: any) {
    console.error('Retry reset error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to reset resumes for retry'
    }, { status: 500 });
  }
}
