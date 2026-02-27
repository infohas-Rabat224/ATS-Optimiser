import { NextResponse } from 'next/server';
import { getUsageStats } from '@/lib/batch-processor';

export async function GET() {
  try {
    const stats = await getUsageStats();

    return NextResponse.json({
      success: true,
      stats
    });

  } catch (error: any) {
    console.error('Stats error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to get usage stats'
    }, { status: 500 });
  }
}
