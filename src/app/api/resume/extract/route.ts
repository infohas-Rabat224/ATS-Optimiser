import { NextRequest, NextResponse } from 'next/server';
import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';

// Force Node.js runtime
export const runtime = 'nodejs';
export const maxDuration = 60;

// Configure PDF.js worker (server-side, no worker needed)
if (typeof window === 'undefined') {
  // @ts-ignore
  globalThis.pdfjsWorker = null;
}

/**
 * AI-INDEPENDENT FILE EXTRACTION ENDPOINT
 * Uses pure JavaScript libraries that work on Vercel serverless:
 * - PDF: pdfjs-dist (pure JS, no native deps)
 * - DOCX: mammoth (pure JS)
 * - Images: Not supported on serverless (requires tesseract.js WebAssembly)
 */

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

// PDF parsing using pdfjs-dist (pure JavaScript)
async function parsePDF(buffer: Buffer): Promise<string> {
  try {
    const uint8Array = new Uint8Array(buffer);
    const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
    const pdfDocument = await loadingTask.promise;
    
    let fullText = '';
    const numPages = pdfDocument.numPages;
    
    for (let i = 1; i <= numPages; i++) {
      const page = await pdfDocument.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      fullText += pageText + '\n';
    }
    
    return fullText.trim();
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
      return {
        content: '',
        error: 'Image OCR is not supported on serverless. Please convert to PDF or DOCX.'
      };
    } else {
      // Try to read as plain text
      content = buffer.toString('utf-8');
    }

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

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json({
        success: false,
        error: 'File size exceeds 10MB limit'
      }, { status: 400 });
    }

    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    const extension = file.name.toLowerCase().split('.').pop() || '';
    const allowedExtensions = ['pdf', 'docx', 'doc', 'txt'];

    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(extension)) {
      return NextResponse.json({
        success: false,
        error: 'Unsupported file type. Supported: PDF, DOCX, TXT'
      }, { status: 400 });
    }

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

export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'File extraction endpoint ready. Supports: PDF, DOCX, TXT (AI-independent)',
    note: 'No API key required for file extraction'
  });
}
