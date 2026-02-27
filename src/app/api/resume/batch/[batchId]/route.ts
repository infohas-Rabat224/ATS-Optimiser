import { NextRequest, NextResponse } from 'next/server';
import { cancelBatch, deleteBatch, getBatchProgress } from '@/lib/batch-processor';

export async function DELETE(
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

    // Get URL params for action (cancel vs delete)
    const url = new URL(request.url);
    const action = url.searchParams.get('action') || 'cancel';

    if (action === 'cancel') {
      // Cancel the batch (stop processing but keep records)
      const cancelled = await cancelBatch(batchId);

      if (!cancelled) {
        return NextResponse.json({
          success: false,
          error: 'Could not cancel batch. It may already be completed or not found.'
        }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        message: 'Batch cancelled successfully',
        batchId
      });
    }

    if (action === 'delete') {
      // Delete the batch and all associated resumes
      const deleted = await deleteBatch(batchId);

      if (!deleted) {
        return NextResponse.json({
          success: false,
          error: 'Could not delete batch. It may not exist.'
        }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        message: 'Batch deleted successfully',
        batchId
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Invalid action. Use ?action=cancel or ?action=delete'
    }, { status: 400 });

  } catch (error: any) {
    console.error('Batch action error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to perform batch action'
    }, { status: 500 });
  }
}

// GET endpoint to retrieve batch status
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
