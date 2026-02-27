import { db } from '@/lib/db';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import os from 'os';
import mammoth from 'mammoth';
import pdf from 'pdf-parse';
import Tesseract from 'tesseract.js';

// =============================================================================
// TYPES
// =============================================================================

export interface BatchConfig {
  maxFiles: number;
  maxFileSize: number; // in bytes
  supportedTypes: string[];
  maxConcurrentBatches: number;
  tokenCapPerBatch: number;
  costCapPerBatch: number;
  rateLimitPerHour: number;
}

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

export interface ParsedFile {
  fileName: string;
  content: string;
  error?: string;
}

export interface BatchProgress {
  batchId: string;
  totalFiles: number;
  completedFiles: number;
  failedFiles: number;
  processingFiles: number;
  progressPercentage: number;
  status: string;
  resumes: ResumeStatus[];
}

export interface ResumeStatus {
  id: string;
  fileName: string;
  language?: string;
  status: string;
  atsScoreBefore?: number;
  atsScoreAfter?: number;
  nextStepSuggestions?: string;
  providerUsed?: string;
  tokenUsage?: number;
  costEstimate?: number;
  errorMessage?: string;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

export const BATCH_CONFIG: BatchConfig = {
  maxFiles: 20,
  maxFileSize: 10 * 1024 * 1024, // 10MB
  supportedTypes: [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
    'image/jpg',
    '.pdf',
    '.docx',
    '.doc',
    '.jpg',
    '.jpeg',
    '.png'
  ],
  maxConcurrentBatches: 3,
  tokenCapPerBatch: 100000,
  costCapPerBatch: 5.00,
  rateLimitPerHour: 5
};

// =============================================================================
// RATE LIMITING (In-Memory Store)
// =============================================================================

const batchRateLimitStore = new Map<string, { count: number; resetAt: number }>();
const activeBatches = new Set<string>();

export function checkRateLimit(ip: string): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const key = ip;
  const record = batchRateLimitStore.get(key);

  if (!record || now > record.resetAt) {
    // Reset the counter
    batchRateLimitStore.set(key, {
      count: 1,
      resetAt: now + 60 * 60 * 1000 // 1 hour
    });
    return { allowed: true, remaining: BATCH_CONFIG.rateLimitPerHour - 1, resetIn: 3600 };
  }

  if (record.count >= BATCH_CONFIG.rateLimitPerHour) {
    return { allowed: false, remaining: 0, resetIn: Math.ceil((record.resetAt - now) / 1000) };
  }

  record.count++;
  return { allowed: true, remaining: BATCH_CONFIG.rateLimitPerHour - record.count, resetIn: Math.ceil((record.resetAt - now) / 1000) };
}

export function canStartNewBatch(): boolean {
  return activeBatches.size < BATCH_CONFIG.maxConcurrentBatches;
}

export function registerActiveBatch(batchId: string): void {
  activeBatches.add(batchId);
}

export function unregisterActiveBatch(batchId: string): void {
  activeBatches.delete(batchId);
}

// =============================================================================
// FILE VALIDATION
// =============================================================================

export function validateFile(file: File): FileValidationResult {
  // Check file size
  if (file.size > BATCH_CONFIG.maxFileSize) {
    return { valid: false, error: `File ${file.name} exceeds 10MB limit` };
  }

  // Check file type
  const extension = file.name.toLowerCase().split('.').pop() || '';
  const mimeType = file.type;

  const isValidType = BATCH_CONFIG.supportedTypes.some(type =>
    type === mimeType || type === `.${extension}`
  );

  if (!isValidType) {
    return { valid: false, error: `File ${file.name} has unsupported format. Supported: PDF, DOCX, JPG, PNG` };
  }

  return { valid: true };
}

export function validateFiles(files: File[]): { valid: File[]; errors: string[] } {
  const validFiles: File[] = [];
  const errors: string[] = [];

  if (files.length > BATCH_CONFIG.maxFiles) {
    errors.push(`Too many files. Maximum ${BATCH_CONFIG.maxFiles} files allowed.`);
    return { valid: [], errors };
  }

  for (const file of files) {
    const result = validateFile(file);
    if (result.valid) {
      validFiles.push(file);
    } else if (result.error) {
      errors.push(result.error);
    }
  }

  return { validFiles, errors };
}

// =============================================================================
// TEXT SANITIZATION
// =============================================================================

export function sanitizeText(text: string): string {
  // Remove script tags and their content
  let sanitized = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Remove iframe tags and their content
  sanitized = sanitized.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');

  // Remove any remaining dangerous tags
  sanitized = sanitized.replace(/<(script|iframe|object|embed|form|input|button)[^>]*>/gi, '');
  sanitized = sanitized.replace(/<\/(script|iframe|object|embed|form|input|button)>/gi, '');

  // Remove event handlers
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');

  // Remove javascript: URLs
  sanitized = sanitized.replace(/javascript:/gi, '');

  // Clean up excessive whitespace
  sanitized = sanitized.replace(/\s+/g, ' ').trim();

  return sanitized;
}

// =============================================================================
// FILE PARSING
// =============================================================================

async function parsePDF(buffer: Buffer): Promise<string> {
  try {
    const data = await pdf(buffer);
    return data.text;
  } catch (error) {
    console.error('PDF parsing error:', error);
    throw new Error('Failed to parse PDF file');
  }
}

async function parseDOCX(buffer: Buffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } catch (error) {
    console.error('DOCX parsing error:', error);
    throw new Error('Failed to parse DOCX file');
  }
}

async function parseImage(buffer: Buffer): Promise<string> {
  try {
    const result = await Tesseract.recognize(buffer, 'eng');
    return result.data.text;
  } catch (error) {
    console.error('Image OCR error:', error);
    throw new Error('Failed to extract text from image');
  }
}

export async function parseFileContent(file: File): Promise<ParsedFile> {
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

    if (!sanitizedContent || sanitizedContent.length < 50) {
      return {
        fileName: file.name,
        content: sanitizedContent,
        error: 'Extracted content is too short or empty'
      };
    }

    return {
      fileName: file.name,
      content: sanitizedContent
    };
  } catch (error: any) {
    return {
      fileName: file.name,
      content: '',
      error: error.message || 'Failed to parse file'
    };
  }
}

// =============================================================================
// BATCH DATABASE OPERATIONS
// =============================================================================

export async function createBatch(
  files: File[],
  language: string,
  jobDescription?: string
): Promise<{ batchId: string; totalFiles: number }> {
  const batchId = `batch_${randomUUID()}`;

  // Create batch record
  const batch = await db.batch.create({
    data: {
      batchId,
      totalFiles: files.length,
      language,
      jobDescription: jobDescription || null,
      status: 'pending'
    }
  });

  // Parse and create resume records
  for (const file of files) {
    const parsed = await parseFileContent(file);

    await db.resume.create({
      data: {
        batchId: batch.id,
        fileName: file.name,
        language,
        originalContent: parsed.content || '',
        status: parsed.error ? 'failed' : 'pending',
        errorMessage: parsed.error || null
      }
    });

    // Update failed count if file had parsing error
    if (parsed.error) {
      await db.batch.update({
        where: { id: batch.id },
        data: { failedFiles: { increment: 1 } }
      });
    }
  }

  return { batchId, totalFiles: files.length };
}

export async function getBatchProgress(batchId: string): Promise<BatchProgress | null> {
  const batch = await db.batch.findUnique({
    where: { batchId },
    include: {
      resumes: {
        select: {
          id: true,
          fileName: true,
          language: true,
          status: true,
          atsScoreBefore: true,
          atsScoreAfter: true,
          nextStepSuggestions: true,
          providerUsed: true,
          tokenUsage: true,
          costEstimate: true,
          errorMessage: true
        }
      }
    }
  });

  if (!batch) return null;

  const processingFiles = batch.resumes.filter(r => r.status === 'processing').length;
  const progressPercentage = Math.round(
    ((batch.completedFiles + batch.failedFiles) / batch.totalFiles) * 100
  );

  return {
    batchId: batch.batchId,
    totalFiles: batch.totalFiles,
    completedFiles: batch.completedFiles,
    failedFiles: batch.failedFiles,
    processingFiles,
    progressPercentage,
    status: batch.status,
    resumes: batch.resumes.map(r => ({
      id: r.id,
      fileName: r.fileName,
      language: r.language ?? undefined,
      status: r.status,
      atsScoreBefore: r.atsScoreBefore ?? undefined,
      atsScoreAfter: r.atsScoreAfter ?? undefined,
      nextStepSuggestions: r.nextStepSuggestions ?? undefined,
      providerUsed: r.providerUsed ?? undefined,
      tokenUsage: r.tokenUsage ?? undefined,
      costEstimate: r.costEstimate ?? undefined,
      errorMessage: r.errorMessage ?? undefined
    }))
  };
}

export async function updateResumeResult(
  resumeId: string,
  result: {
    optimizedContent?: string;
    nextStepSuggestions?: string;
    atsScoreBefore?: number;
    atsScoreAfter?: number;
    providerUsed?: string;
    tokenUsage?: number;
    costEstimate?: number;
    status: string;
    errorMessage?: string;
  }
): Promise<void> {
  await db.resume.update({
    where: { id: resumeId },
    data: result
  });
}

export async function incrementBatchProgress(batchId: string, success: boolean): Promise<void> {
  const batch = await db.batch.findUnique({ where: { batchId } });
  if (!batch) return;

  const updateData = success
    ? { completedFiles: { increment: 1 } }
    : { failedFiles: { increment: 1 } };

  const updatedBatch = await db.batch.update({
    where: { batchId },
    data: updateData
  });

  // Check if batch is complete
  if (updatedBatch.completedFiles + updatedBatch.failedFiles >= updatedBatch.totalFiles) {
    await db.batch.update({
      where: { batchId },
      data: { status: 'completed' }
    });
    unregisterActiveBatch(batchId);
  }
}

export async function cancelBatch(batchId: string): Promise<boolean> {
  const batch = await db.batch.findUnique({ where: { batchId } });
  if (!batch) return false;

  // Only allow cancellation if not already completed
  if (batch.status === 'completed' || batch.status === 'cancelled') {
    return false;
  }

  // Update batch status
  await db.batch.update({
    where: { batchId },
    data: { status: 'cancelled' }
  });

  // Mark all pending/processing resumes as failed
  await db.resume.updateMany({
    where: {
      batchId: batch.id,
      status: { in: ['pending', 'processing'] }
    },
    data: { status: 'failed', errorMessage: 'Batch cancelled by user' }
  });

  unregisterActiveBatch(batchId);
  return true;
}

export async function deleteBatch(batchId: string): Promise<boolean> {
  const batch = await db.batch.findUnique({ where: { batchId } });
  if (!batch) return false;

  // Delete all resumes first (cascade)
  await db.resume.deleteMany({
    where: { batchId: batch.id }
  });

  // Delete the batch
  await db.batch.delete({
    where: { batchId }
  });

  unregisterActiveBatch(batchId);
  return true;
}

export async function getRecentBatches(limit: number = 10): Promise<BatchProgress[]> {
  const batches = await db.batch.findMany({
    take: limit,
    orderBy: { createdAt: 'desc' },
    include: {
      resumes: {
        select: {
          id: true,
          fileName: true,
          status: true,
          atsScoreBefore: true,
          atsScoreAfter: true,
          errorMessage: true
        }
      }
    }
  });

  return batches.map(batch => {
    const processingFiles = batch.resumes.filter(r => r.status === 'processing').length;
    const progressPercentage = Math.round(
      ((batch.completedFiles + batch.failedFiles) / batch.totalFiles) * 100
    );

    return {
      batchId: batch.batchId,
      totalFiles: batch.totalFiles,
      completedFiles: batch.completedFiles,
      failedFiles: batch.failedFiles,
      processingFiles,
      progressPercentage,
      status: batch.status,
      resumes: batch.resumes.map(r => ({
        id: r.id,
        fileName: r.fileName,
        status: r.status,
        atsScoreBefore: r.atsScoreBefore ?? undefined,
        atsScoreAfter: r.atsScoreAfter ?? undefined,
        errorMessage: r.errorMessage ?? undefined
      }))
    };
  });
}

// =============================================================================
// EXPORT HELPERS
// =============================================================================

export async function getResumesForExport(resumeIds: string[]): Promise<{
  id: string;
  fileName: string;
  optimizedContent: string | null;
  originalContent: string;
  atsScoreBefore: number | null;
  atsScoreAfter: number | null;
}[]> {
  const resumes = await db.resume.findMany({
    where: {
      id: { in: resumeIds },
      status: 'completed'
    },
    select: {
      id: true,
      fileName: true,
      optimizedContent: true,
      originalContent: true,
      atsScoreBefore: true,
      atsScoreAfter: true
    }
  });

  return resumes;
}

export function generateCSV(resumes: any[]): string {
  const headers = ['File Name', 'ATS Score Before', 'ATS Score After', 'Original Content', 'Optimized Content'];
  const rows = resumes.map(r => [
    r.fileName,
    r.atsScoreBefore || '',
    r.atsScoreAfter || '',
    `"${(r.originalContent || '').replace(/"/g, '""')}"`,
    `"${(r.optimizedContent || '').replace(/"/g, '""')}"`
  ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

export function generateJSON(resumes: any[]): string {
  return JSON.stringify(resumes.map(r => ({
    fileName: r.fileName,
    atsScoreBefore: r.atsScoreBefore,
    atsScoreAfter: r.atsScoreAfter,
    originalContent: r.originalContent,
    optimizedContent: r.optimizedContent
  })), null, 2);
}

// =============================================================================
// FILE GENERATION FOR EXPORT
// =============================================================================

export function getDocxHtml(content: string): string {
  return `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>Export</title>
        <style>
          @page { size: 21cm 29.7cm; margin: 1.27cm; }
          body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.15; color: #000; }
          h1 { font-size: 16pt; font-weight: bold; text-align: left; text-transform: uppercase; margin: 0 0 4pt 0; }
          h3 { font-size: 12pt; font-weight: bold; text-transform: uppercase; margin: 12pt 0 6pt 0; }
          p { margin: 0 0 4pt 0; }
          ul { margin: 0 0 8pt 0; padding-left: 18pt; }
          li { margin-bottom: 2pt; }
        </style>
      </head>
      <body>${content}</body>
    </html>
  `;
}

// =============================================================================
// SEARCH FUNCTIONALITY
// =============================================================================

export async function searchResumes(params: {
  query?: string;
  language?: string;
  batchId?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<{
  resumes: Array<{
    id: string;
    fileName: string;
    language: string;
    status: string;
    atsScoreBefore: number | null;
    atsScoreAfter: number | null;
    batchId: string | null;
    createdAt: Date;
  }>;
  total: number;
}> {
  const { query, language, batchId, status, limit = 20, offset = 0 } = params;

  const where: any = {};

  if (query) {
    where.fileName = { contains: query, mode: 'insensitive' };
  }

  if (language) {
    where.language = language;
  }

  if (batchId) {
    const batch = await db.batch.findUnique({ where: { batchId } });
    if (batch) {
      where.batchId = batch.id;
    }
  }

  if (status) {
    where.status = status;
  }

  const [resumes, total] = await Promise.all([
    db.resume.findMany({
      where,
      select: {
        id: true,
        fileName: true,
        language: true,
        status: true,
        atsScoreBefore: true,
        atsScoreAfter: true,
        batchId: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    }),
    db.resume.count({ where })
  ]);

  return { resumes, total };
}

// =============================================================================
// RETRY FAILED FILES
// =============================================================================

export async function getFailedResumes(batchId: string): Promise<Array<{
  id: string;
  fileName: string;
  originalContent: string;
  errorMessage: string | null;
}>> {
  const batch = await db.batch.findUnique({ where: { batchId } });
  if (!batch) return [];

  const failedResumes = await db.resume.findMany({
    where: {
      batchId: batch.id,
      status: 'failed'
    },
    select: {
      id: true,
      fileName: true,
      originalContent: true,
      errorMessage: true
    }
  });

  return failedResumes;
}

export async function resetResumeForRetry(resumeId: string): Promise<boolean> {
  try {
    await db.resume.update({
      where: { id: resumeId },
      data: {
        status: 'pending',
        errorMessage: null
      }
    });
    return true;
  } catch {
    return false;
  }
}

// =============================================================================
// COST TRACKING
// =============================================================================

export async function getUsageStats(): Promise<{
  totalResumes: number;
  completedResumes: number;
  failedResumes: number;
  totalTokens: number;
  totalCost: number;
  providerStats: Record<string, { count: number; tokens: number; cost: number }>;
}> {
  const resumes = await db.resume.findMany({
    select: {
      status: true,
      providerUsed: true,
      tokenUsage: true,
      costEstimate: true
    }
  });

  const stats = {
    totalResumes: resumes.length,
    completedResumes: resumes.filter(r => r.status === 'completed').length,
    failedResumes: resumes.filter(r => r.status === 'failed').length,
    totalTokens: 0,
    totalCost: 0,
    providerStats: {} as Record<string, { count: number; tokens: number; cost: number }>
  };

  for (const resume of resumes) {
    if (resume.tokenUsage) {
      stats.totalTokens += resume.tokenUsage;
    }
    if (resume.costEstimate) {
      stats.totalCost += resume.costEstimate;
    }
    if (resume.providerUsed) {
      if (!stats.providerStats[resume.providerUsed]) {
        stats.providerStats[resume.providerUsed] = { count: 0, tokens: 0, cost: 0 };
      }
      stats.providerStats[resume.providerUsed].count++;
      if (resume.tokenUsage) {
        stats.providerStats[resume.providerUsed].tokens += resume.tokenUsage;
      }
      if (resume.costEstimate) {
        stats.providerStats[resume.providerUsed].cost += resume.costEstimate;
      }
    }
  }

  return stats;
}

// =============================================================================
// CHARACTER CONSTRAINT ENFORCEMENT
// =============================================================================

export const CHAR_TARGET_MIN = 2750;
export const CHAR_TARGET_MAX = 2850;
export const CHAR_TARGET_OPTIMAL = 2800;

export function countTextCharacters(html: string): number {
  const textOnly = html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  return textOnly.length;
}

export function enforceCharacterConstraint(content: string): {
  valid: boolean;
  charCount: number;
  message: string;
} {
  const charCount = countTextCharacters(content);

  if (charCount < CHAR_TARGET_MIN) {
    return {
      valid: false,
      charCount,
      message: `Content too short: ${charCount} characters. Minimum: ${CHAR_TARGET_MIN}`
    };
  }

  if (charCount > CHAR_TARGET_MAX) {
    return {
      valid: false,
      charCount,
      message: `Content too long: ${charCount} characters. Maximum: ${CHAR_TARGET_MAX}`
    };
  }

  return {
    valid: true,
    charCount,
    message: `Content within target: ${charCount} characters (target: ${CHAR_TARGET_OPTIMAL})`
  };
}
