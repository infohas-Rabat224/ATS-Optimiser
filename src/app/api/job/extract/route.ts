import { NextRequest, NextResponse } from 'next/server';
import { extractJobFromUrl, validateUrl } from '@/lib/job-extractor';

/**
 * POST /api/job/extract
 * 
 * Extracts job description from a URL - AI INDEPENDENT
 * Uses Cheerio for HTML parsing, not AI
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url) {
      return NextResponse.json({
        success: false,
        error: 'URL is required'
      }, { status: 400 });
    }

    // Validate URL
    const validation = validateUrl(url);
    if (!validation.valid) {
      return NextResponse.json({
        success: false,
        error: validation.error
      }, { status: 400 });
    }

    // Extract job content - AI-independent
    const result = await extractJobFromUrl(url);

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error || 'Failed to extract job description'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      content: result.content,
      title: result.title,
      cached: result.cached,
      source: 'cheerio-extraction',
      aiIndependent: true
    });
  } catch (error: any) {
    console.error('Job extraction error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to extract job description'
    }, { status: 500 });
  }
}
