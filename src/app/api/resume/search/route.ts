import { NextRequest, NextResponse } from 'next/server';
import { searchResumes } from '@/lib/batch-processor';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const query = searchParams.get('query') || undefined;
    const language = searchParams.get('language') || undefined;
    const batchId = searchParams.get('batchId') || undefined;
    const status = searchParams.get('status') || undefined;
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    const result = await searchResumes({
      query,
      language,
      batchId,
      status,
      limit,
      offset
    });

    return NextResponse.json({
      success: true,
      ...result
    });

  } catch (error: any) {
    console.error('Search error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Search failed'
    }, { status: 500 });
  }
}
