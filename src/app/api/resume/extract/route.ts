import { NextRequest, NextResponse } from 'next/server';
import { parseFileContent, sanitizeText } from '@/lib/batch-processor';

/**
 * AI-INDEPENDENT FILE EXTRACTION ENDPOINT
 * 
 * This endpoint extracts text from PDF, DOCX, and image files using local libraries:
 * - PDF: pdf-parse (no AI required)
 * - DOCX: mammoth (no AI required)
 * - Images: tesseract.js (OCR, no AI required)
 * 
 * No API key is needed for file extraction.
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({
        success: false,
        error: 'No file provided'
      }, { status: 400 });
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json({
        success: false,
        error: 'File size exceeds 10MB limit'
      }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png',
      'image/jpg'
    ];
    const extension = file.name.toLowerCase().split('.').pop() || '';
    const allowedExtensions = ['pdf', 'docx', 'doc', 'jpg', 'jpeg', 'png'];

    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(extension)) {
      return NextResponse.json({
        success: false,
        error: 'Unsupported file type. Supported: PDF, DOCX, JPG, PNG'
      }, { status: 400 });
    }

    // Parse file content using AI-independent libraries
    const result = await parseFileContent(file);

    if (result.error) {
      return NextResponse.json({
        success: false,
        error: result.error,
        fileName: result.fileName
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      text: result.content,
      fileName: result.fileName,
      charCount: result.content.length
    });

  } catch (error: any) {
    console.error('File extraction error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to extract text from file'
    }, { status: 500 });
  }
}

// Also support GET for health check
export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'File extraction endpoint ready. Supports: PDF, DOCX, JPG, PNG (AI-independent)',
    note: 'No API key required for file extraction'
  });
}
