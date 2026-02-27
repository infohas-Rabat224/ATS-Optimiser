import { NextRequest, NextResponse } from 'next/server';
import { getBatchProgress, getRecentBatches } from '@/lib/batch-processor';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  try {
    const { batchId } = await params;

    if (!batchId) {
      return NextResponse.json({
        success: false,
        error: 'Batch ID is required'
      }, { status: 400 });
    }

    // Handle "recent" endpoint
    if (batchId === 'recent') {
      const batches = await getRecentBatches(10);
      return NextResponse.json({
        success: true,
        batches
      });
    }

    // Get specific batch progress
    const progress = await getBatchProgress(batchId);

    if (!progress) {
      return NextResponse.json({
        success: false,
        error: 'Batch not found'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      ...progress
    });

  } catch (error: any) {
    console.error('Batch status error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to get batch status'
    }, { status: 500 });
  }
}
