import { NextRequest, NextResponse } from 'next/server';
import { getFailedResumes, resetResumeForRetry, getBatchProgress } from '@/lib/batch-processor';
import { db } from '@/lib/db';

// GET /api/resume/retry - Get failed resumes for a batch
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
      batchId,
      failedCount: failedResumes.length,
      resumes: failedResumes
    });

  } catch (error: any) {
    console.error('Retry list error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to get failed resumes'
    }, { status: 500 });
  }
}

// POST /api/resume/retry - Reset failed resumes for retry
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { resumeIds, batchId } = body;

    if (!resumeIds || !Array.isArray(resumeIds) || resumeIds.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Resume IDs are required'
      }, { status: 400 });
    }

    let successCount = 0;
    let failCount = 0;

    for (const resumeId of resumeIds) {
      const success = await resetResumeForRetry(resumeId);
      if (success) {
        successCount++;
      } else {
        failCount++;
      }
    }

    // If batchId provided, update batch status to pending if it was failed
    if (batchId) {
      const batch = await db.batch.findUnique({ where: { batchId } });
      if (batch && batch.status === 'failed') {
        await db.batch.update({
          where: { batchId },
          data: { status: 'pending' }
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `${successCount} resumes reset for retry`,
      resetCount: successCount,
      failedCount: failCount
    });

  } catch (error: any) {
    console.error('Retry error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to reset resumes for retry'
    }, { status: 500 });
  }
}
