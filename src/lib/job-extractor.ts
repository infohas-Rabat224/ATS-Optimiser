/**
 * Job Extraction Module - AI-INDEPENDENT
 * 
 * This module extracts job descriptions from URLs using:
 * - Cheerio for HTML parsing
 * - Timeout-enforced fetch
 * - Caching for performance
 * - No AI API calls
 */

import * as cheerio from 'cheerio';

// =============================================================================
// CONFIGURATION
// =============================================================================

const FETCH_TIMEOUT = 8000; // 8 seconds max
const MAX_REDIRECTS = 3;
const MAX_CONTENT_LENGTH = 5000; // characters
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// Simple in-memory cache
const extractionCache = new Map<string, { content: string; title?: string; timestamp: number }>();

// =============================================================================
// URL VALIDATION
// =============================================================================

export function validateUrl(url: string): { valid: boolean; error?: string } {
  try {
    const parsed = new URL(url);
    
    // Only allow HTTP/HTTPS
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, error: 'Only HTTP/HTTPS URLs are allowed' };
    }
    
    // Block private IPs
    const hostname = parsed.hostname;
    const privatePatterns = [
      /^localhost$/i,
      /^127\./,
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[01])\./,
      /^192\.168\./,
      /^0\.0\.0\.0$/,
      /^::1$/,
      /^fc00:/i,
      /^fe80:/i,
    ];
    
    if (privatePatterns.some(pattern => pattern.test(hostname))) {
      return { valid: false, error: 'Private IP addresses are not allowed' };
    }
    
    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}

// =============================================================================
// CONTENT EXTRACTION
// =============================================================================

function extractJobContent(html: string): string {
  const $ = cheerio.load(html);
  
  // Remove unwanted elements
  $('script, style, noscript, iframe, nav, footer, header, aside, [role="navigation"], [role="banner"]').remove();
  
  // Try to find job-specific content
  const jobSelectors = [
    'article',
    '[class*="job-description"]',
    '[class*="job-details"]',
    '[class*="job-content"]',
    '[class*="posting-content"]',
    '[class*="listing-content"]',
    '[data-job-id]',
    'main',
    '.content',
    '#content',
    'section'
  ];
  
  let content = '';
  
  for (const selector of jobSelectors) {
    const element = $(selector).first();
    if (element.length) {
      const text = element.text().trim();
      if (text.length > 200) {
        content = text;
        break;
      }
    }
  }
  
  // Fallback to body content
  if (!content) {
    content = $('body').text().trim();
  }
  
  // Clean up the text
  content = content
    .replace(/\s+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  
  // Limit content length
  if (content.length > MAX_CONTENT_LENGTH) {
    content = content.substring(0, MAX_CONTENT_LENGTH) + '...';
  }
  
  return content;
}

// =============================================================================
// MAIN EXTRACTION FUNCTION
// =============================================================================

export async function extractJobFromUrl(url: string): Promise<{
  success: boolean;
  content: string;
  title?: string;
  error?: string;
  cached: boolean;
}> {
  // Check cache first
  const cached = extractionCache.get(url);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return {
      success: true,
      content: cached.content,
      title: cached.title,
      cached: true
    };
  }
  
  try {
    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
    
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ATSOptimizer/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      }
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      return { 
        success: false, 
        content: '', 
        error: `HTTP error: ${response.status}`,
        cached: false 
      };
    }
    
    // Check content type
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) {
      return {
        success: false,
        content: '',
        error: 'URL does not return HTML content',
        cached: false
      };
    }
    
    // Parse HTML
    const html = await response.text();
    const content = extractJobContent(html);
    
    // Extract metadata
    const $ = cheerio.load(html);
    const title = $('title').text().trim() || 
                  $('h1').first().text().trim() ||
                  $('meta[property="og:title"]').attr('content');
    
    // Cache result
    extractionCache.set(url, { content, title, timestamp: Date.now() });
    
    return {
      success: true,
      content,
      title,
      cached: false
    };
    
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return {
        success: false,
        content: '',
        error: 'Request timed out',
        cached: false
      };
    }
    
    return {
      success: false,
      content: '',
      error: error.message || 'Failed to fetch URL',
      cached: false
    };
  }
}

// =============================================================================
// CLEAR CACHE
// =============================================================================

export function clearCache(): void {
  extractionCache.clear();
}

// Clean old cache entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of extractionCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      extractionCache.delete(key);
    }
  }
}, CACHE_TTL);
