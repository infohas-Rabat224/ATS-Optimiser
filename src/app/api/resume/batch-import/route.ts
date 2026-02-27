import { NextRequest, NextResponse } from 'next/server';
import {
  validateFiles,
  checkRateLimit,
  canStartNewBatch,
  createBatch
} from '@/lib/batch-processor';

// Maximum file size for form data (50MB to handle multiple files)
export const config = {
  api: {
    bodyParser: false
  }
};

export async function POST(request: NextRequest) {
  try {
    // Get client IP for rate limiting
    const ip = request.headers.get('x-forwarded-for') ||
               request.headers.get('x-real-ip') ||
               'unknown';

    // Check rate limit
    const rateLimit = checkRateLimit(ip);
    if (!rateLimit.allowed) {
      return NextResponse.json({
        success: false,
        error: `Rate limit exceeded. Try again in ${rateLimit.resetIn} seconds.`,
        retryAfter: rateLimit.resetIn
      }, { status: 429 });
    }

    // Check concurrent batches
    if (!canStartNewBatch()) {
      return NextResponse.json({
        success: false,
        error: 'Maximum concurrent batches reached. Please wait for existing batches to complete.'
      }, { status: 503 });
    }

    // Parse multipart form data
    const formData = await request.formData();
    const language = formData.get('language') as string || 'en';
    const jobDescription = formData.get('jobDescription') as string || null;

    // Validate language
    if (!['en', 'fr'].includes(language)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid language. Supported: en, fr'
      }, { status: 400 });
    }

    // Get all files from form data
    const files: File[] = [];
    formData.forEach((value, key) => {
      if (key === 'files' && value instanceof File) {
        files.push(value);
      }
    });

    // Also check for individual file entries (file_0, file_1, etc.)
    for (const [key, value] of formData.entries()) {
      if (key.startsWith('file') && value instanceof File && !files.includes(value)) {
        files.push(value);
      }
    }

    if (files.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No files provided'
      }, { status: 400 });
    }

    // Validate files
    const { validFiles, errors } = validateFiles(files);
    if (validFiles.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No valid files to process',
        validationErrors: errors
      }, { status: 400 });
    }

    // Create batch with files
    const result = await createBatch(validFiles, language, jobDescription || undefined);

    return NextResponse.json({
      success: true,
      batchId: result.batchId,
      totalFiles: result.totalFiles,
      message: `Batch created successfully. ${validFiles.length} files queued for processing.`,
      warnings: errors.length > 0 ? errors : undefined,
      rateLimit: {
        remaining: rateLimit.remaining,
        resetIn: rateLimit.resetIn
      }
    });

  } catch (error: any) {
    console.error('Batch import error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to create batch'
    }, { status: 500 });
  }
}
