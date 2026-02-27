import { NextRequest, NextResponse } from 'next/server';
import { getResumesForExport, generateCSV, generateJSON, getDocxHtml } from '@/lib/batch-processor';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

// Download directory
const DOWNLOAD_DIR = '/home/z/my-project/download';

// Ensure download directory exists
if (!fs.existsSync(DOWNLOAD_DIR)) {
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
}

// Simple ZIP-like archive creation (using a manifest file and individual files)
// For a real ZIP, we would use archiver or similar, but this is simpler
interface ExportFile {
  name: string;
  content: string | Buffer;
  type: 'text' | 'binary';
}

async function createExportPackage(
  resumes: any[],
  format: string
): Promise<{ files: ExportFile[]; manifest: any }> {
  const files: ExportFile[] = [];
  const manifest: any = {
    exportDate: new Date().toISOString(),
    totalFiles: resumes.length,
    format,
    files: []
  };

  for (const resume of resumes) {
    const baseName = resume.fileName.replace(/\.[^.]+$/, '');

    switch (format) {
      case 'json': {
        const content = JSON.stringify({
          fileName: resume.fileName,
          atsScoreBefore: resume.atsScoreBefore,
          atsScoreAfter: resume.atsScoreAfter,
          originalContent: resume.originalContent,
          optimizedContent: resume.optimizedContent
        }, null, 2);
        files.push({
          name: `${baseName}.json`,
          content,
          type: 'text'
        });
        break;
      }

      case 'csv': {
        // All resumes in one CSV
        break;
      }

      case 'pdf':
      case 'docx': {
        // Generate HTML-based docx
        const htmlContent = resume.optimizedContent || resume.originalContent;
        const docxHtml = getDocxHtml(htmlContent);
        files.push({
          name: `${baseName}.${format === 'pdf' ? 'html' : 'doc'}`,
          content: docxHtml,
          type: 'text'
        });
        break;
      }

      default:
        // Default to text
        files.push({
          name: `${baseName}.txt`,
          content: resume.optimizedContent || resume.originalContent,
          type: 'text'
        });
    }

    manifest.files.push({
      originalName: resume.fileName,
      exportedName: files[files.length - 1]?.name || baseName,
      atsScoreBefore: resume.atsScoreBefore,
      atsScoreAfter: resume.atsScoreAfter
    });
  }

  return { files, manifest };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { resumeIds, format = 'json' } = body;

    if (!resumeIds || !Array.isArray(resumeIds) || resumeIds.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Resume IDs are required'
      }, { status: 400 });
    }

    // Validate format
    const validFormats = ['pdf', 'docx', 'json', 'csv'];
    if (!validFormats.includes(format)) {
      return NextResponse.json({
        success: false,
        error: `Invalid format. Supported: ${validFormats.join(', ')}`
      }, { status: 400 });
    }

    // Get resumes
    const resumes = await getResumesForExport(resumeIds);

    if (resumes.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No completed resumes found for export'
      }, { status: 404 });
    }

    // Generate unique export ID
    const exportId = `export_${randomUUID()}`;
    const exportDir = path.join(DOWNLOAD_DIR, exportId);

    // Create export directory
    fs.mkdirSync(exportDir, { recursive: true });

    // Handle CSV separately (all in one file)
    if (format === 'csv') {
      const csvContent = generateCSV(resumes);
      const csvPath = path.join(exportDir, 'resumes_export.csv');
      fs.writeFileSync(csvPath, csvContent, 'utf-8');

      const manifest = {
        exportDate: new Date().toISOString(),
        totalFiles: resumes.length,
        format: 'csv',
        file: 'resumes_export.csv'
      };

      fs.writeFileSync(
        path.join(exportDir, 'manifest.json'),
        JSON.stringify(manifest, null, 2),
        'utf-8'
      );

      return NextResponse.json({
        success: true,
        exportId,
        downloadUrl: `/download/${exportId}/resumes_export.csv`,
        manifestUrl: `/download/${exportId}/manifest.json`,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
        fileCount: resumes.length
      });
    }

    // Handle JSON separately (all in one file)
    if (format === 'json') {
      const jsonContent = generateJSON(resumes);
      const jsonPath = path.join(exportDir, 'resumes_export.json');
      fs.writeFileSync(jsonPath, jsonContent, 'utf-8');

      const manifest = {
        exportDate: new Date().toISOString(),
        totalFiles: resumes.length,
        format: 'json',
        file: 'resumes_export.json'
      };

      fs.writeFileSync(
        path.join(exportDir, 'manifest.json'),
        JSON.stringify(manifest, null, 2),
        'utf-8'
      );

      return NextResponse.json({
        success: true,
        exportId,
        downloadUrl: `/download/${exportId}/resumes_export.json`,
        manifestUrl: `/download/${exportId}/manifest.json`,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        fileCount: resumes.length
      });
    }

    // Handle DOCX/PDF (individual files)
    const { files, manifest } = await createExportPackage(resumes, format);

    // Write files
    for (const file of files) {
      const filePath = path.join(exportDir, file.name);
      if (file.type === 'text') {
        fs.writeFileSync(filePath, file.content as string, 'utf-8');
      } else {
        fs.writeFileSync(filePath, file.content as Buffer);
      }
    }

    // Write manifest
    fs.writeFileSync(
      path.join(exportDir, 'manifest.json'),
      JSON.stringify(manifest, null, 2),
      'utf-8'
    );

    // Create a simple archive listing file
    const archiveInfo = {
      exportId,
      createdAt: new Date().toISOString(),
      files: files.map(f => f.name),
      downloadBaseUrl: `/download/${exportId}/`
    };

    fs.writeFileSync(
      path.join(exportDir, 'archive.json'),
      JSON.stringify(archiveInfo, null, 2),
      'utf-8'
    );

    return NextResponse.json({
      success: true,
      exportId,
      downloadUrl: `/download/${exportId}/`,
      manifestUrl: `/download/${exportId}/manifest.json`,
      archiveUrl: `/download/${exportId}/archive.json`,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      fileCount: files.length,
      files: files.map(f => ({
        name: f.name,
        downloadUrl: `/download/${exportId}/${f.name}`
      }))
    });

  } catch (error: any) {
    console.error('Batch export error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to export batch'
    }, { status: 500 });
  }
}
