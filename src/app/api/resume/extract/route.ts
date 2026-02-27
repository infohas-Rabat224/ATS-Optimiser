import { NextRequest, NextResponse } from 'next/server';
import mammoth from 'mammoth';
import pdf from 'pdf-parse';
import Tesseract from 'tesseract.js';

// Force Node.js runtime (required for pdf-parse, mammoth, tesseract.js)
export const runtime = 'nodejs';
export const maxDuration = 60; // 60 seconds timeout for OCR

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

// Text sanitization
function sanitizeText(text: string): string {
  let sanitized = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  sanitized = sanitized.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
  sanitized = sanitized.replace(/<(script|iframe|object|embed|form|input|button)[^>]*>/gi, '');
  sanitized = sanitized.replace(/<\/(script|iframe|object|embed|form|input|button)>/gi, '');
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
  sanitized = sanitized.replace(/javascript:/gi, '');
  sanitized = sanitized.replace(/\s+/g, ' ').trim();
  return sanitized;
}

// PDF parsing
async function parsePDF(buffer: Buffer): Promise<string> {
  try {
    const data = await pdf(buffer);
    return data.text;
  } catch (error) {
    console.error('PDF parsing error:', error);
    throw new Error('Failed to parse PDF file');
  }
}

// DOCX parsing
async function parseDOCX(buffer: Buffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } catch (error) {
    console.error('DOCX parsing error:', error);
    throw new Error('Failed to parse DOCX file');
  }
}

// Image OCR parsing
async function parseImage(buffer: Buffer): Promise<string> {
  try {
    const result = await Tesseract.recognize(buffer, 'eng');
    return result.data.text;
  } catch (error) {
    console.error('Image OCR error:', error);
    throw new Error('Failed to extract text from image');
  }
}

// Main file parsing
async function parseFile(file: File): Promise<{ content: string; error?: string }> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const extension = file.name.toLowerCase().split('.').pop() || '';
  const mimeType = file.type;

  try {
    let content = '';

    if (mimeType === 'application/pdf' || extension === 'pdf') {
      content = await parsePDF(buffer);
    } else if (
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      extension === 'docx'
    ) {
      content = await parseDOCX(buffer);
    } else if (['image/jpeg', 'image/png', 'image/jpg'].includes(mimeType) || ['jpg', 'jpeg', 'png'].includes(extension)) {
      content = await parseImage(buffer);
    } else {
      // Try to read as plain text
      content = buffer.toString('utf-8');
    }

    // Sanitize the extracted text
    const sanitizedContent = sanitizeText(content);

    if (!sanitizedContent || sanitizedContent.length < 10) {
      return {
        content: sanitizedContent,
        error: 'Extracted content is too short or empty'
      };
    }

    return { content: sanitizedContent };
  } catch (error: any) {
    return {
      content: '',
      error: error.message || 'Failed to parse file'
    };
  }
}

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
    const result = await parseFile(file);

    if (result.error) {
      return NextResponse.json({
        success: false,
        error: result.error,
        fileName: file.name
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      text: result.content,
      fileName: file.name,
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
