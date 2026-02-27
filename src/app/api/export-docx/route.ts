import { NextRequest, NextResponse } from 'next/server';
import { Document, Packer, Paragraph, TextRun, AlignmentType, LevelFormat } from 'docx';

// 0.95cm = ~539 twips (1 inch = 1440 twips, 1 cm = 567 twips)
const MARGIN_TWIPS = 539;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { content, filename } = body;
    
    if (!content) {
      return NextResponse.json({ error: 'No content provided' }, { status: 400 });
    }
    
    // Parse HTML content and create docx elements
    const elements = parseHtmlToDocx(content);
    
    console.log('Generated paragraphs count:', elements.length);
    
    // Create the document with proper margins
    const doc = new Document({
      styles: {
        default: {
          document: {
            run: { font: "Times New Roman", size: 24 } // 12pt
          }
        }
      },
      numbering: {
        config: [
          {
            reference: "bullet-list",
            levels: [{
              level: 0,
              format: LevelFormat.BULLET,
              text: "•",
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: {
                  indent: { left: 720, hanging: 360 }
                }
              }
            }]
          }
        ]
      },
      sections: [{
        properties: {
          page: {
            margin: {
              top: MARGIN_TWIPS,
              right: MARGIN_TWIPS,
              bottom: MARGIN_TWIPS,
              left: MARGIN_TWIPS
            }
          }
        },
        children: elements
      }]
    });
    
    // Generate buffer
    const buffer = await Packer.toBuffer(doc);
    
    // Return as downloadable file
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename || 'Resume.docx'}"`
      }
    });
    
  } catch (error: any) {
    console.error('DOCX generation error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function parseHtmlToDocx(html: string): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  
  // Track seen content to avoid exact duplicates
  const seenContent = new Set<string>();
  
  // Parse HTML in document order by finding all top-level elements
  // Use a regex to find all elements in order
  const elementRegex = /<(h[1-4]|p|ul|li)[^>]*>([\s\S]*?)<\/\1>/gi;
  
  // First, extract h1 (name)
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1Match) {
    const name = cleanText(h1Match[1]);
    paragraphs.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      children: [new TextRun({ text: name, bold: true, size: 32, font: "Times New Roman" })]
    }));
  }
  
  // Extract h4 (subtitle/contact info)
  const h4Match = html.match(/<h4[^>]*>([\s\S]*?)<\/h4>/i);
  if (h4Match) {
    const subtitle = cleanText(h4Match[1]);
    paragraphs.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 160 },
      children: [new TextRun({ text: subtitle, size: 24, font: "Times New Roman" })]
    }));
  }
  
  // Now process the rest of the content in order
  // Split HTML into sections by top-level elements
  const cleanHtml = html.replace(/<h[1-4][^>]*>[\s\S]*?<\/h[1-4]>/gi, ''); // Remove already processed headers
  
  // Find all paragraphs and lists in order
  const parts: Array<{type: string, content: string}> = [];
  
  // Match <p> tags
  const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let match;
  let lastIndex = 0;
  
  // Create a combined regex for all elements we want to process in order
  const combinedRegex = /<(p|ul)[^>]*>([\s\S]*?)<\/\1>/gi;
  
  while ((match = combinedRegex.exec(cleanHtml)) !== null) {
    const tagName = match[1].toLowerCase();
    const content = match[2];
    
    if (tagName === 'p') {
      parts.push({ type: 'p', content: content });
    } else if (tagName === 'ul') {
      // Extract list items from this ul
      const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
      let liMatch;
      while ((liMatch = liRegex.exec(content)) !== null) {
        parts.push({ type: 'li', content: liMatch[1] });
      }
    }
  }
  
  // Process all parts in order
  for (const part of parts) {
    if (part.type === 'p') {
      const result = processParagraph(part.content, seenContent);
      if (result) {
        paragraphs.push(result);
      }
    } else if (part.type === 'li') {
      const result = processListItem(part.content, seenContent);
      if (result) {
        paragraphs.push(result);
      }
    }
  }
  
  return paragraphs;
}

function processParagraph(content: string, seenContent: Set<string>): Paragraph | null {
  const cleanContent = cleanText(content);
  
  // Skip if empty
  if (!cleanContent || cleanContent.length < 2) return null;
  
  // Skip duplicates
  const normalized = cleanContent.toLowerCase().trim();
  if (seenContent.has(normalized)) return null;
  seenContent.add(normalized);
  
  // Check if it contains a <strong> tag
  const strongMatch = content.match(/<strong>([\s\S]*?)<\/strong>/i);
  
  if (strongMatch) {
    const strongText = cleanText(strongMatch[1]);
    const restHtml = content.replace(/<strong>[\s\S]*?<\/strong>/i, '');
    const restText = cleanText(restHtml).replace(/^\s*[\|–—-]\s*/, '');
    
    // Check if this is a section header (all uppercase)
    const isSectionHeader = strongText === strongText.toUpperCase() && 
                            strongText.length > 3 && 
                            !strongText.includes('|') &&
                            !strongText.includes('@');
    
    if (isSectionHeader) {
      // Section header only
      return new Paragraph({
        spacing: { before: 200, after: 80 },
        children: [new TextRun({ text: strongText, bold: true, size: 24, font: "Times New Roman" })]
      });
    } else {
      // Job title with company/date info
      const fullText = strongText + (restText ? ' ' + restText : '');
      return new Paragraph({
        spacing: { after: 80 },
        children: [
          new TextRun({ text: strongText, bold: true, size: 24, font: "Times New Roman" }),
          restText ? new TextRun({ text: ' ' + restText, size: 24, font: "Times New Roman" }) : new TextRun({ text: '' })
        ]
      });
    }
  }
  
  // Regular paragraph (no strong tag)
  return new Paragraph({
    spacing: { after: 80 },
    children: [new TextRun({ text: cleanContent, size: 24, font: "Times New Roman" })]
  });
}

function processListItem(content: string, seenContent: Set<string>): Paragraph | null {
  let liContent = cleanText(content);
  
  // Skip if empty
  if (!liContent || liContent.length < 2) return null;
  
  // Remove leading bullet if present (we'll use proper bullet)
  liContent = liContent.replace(/^•\s*/, '').trim();
  
  // Skip duplicates
  const normalized = liContent.toLowerCase().trim();
  if (seenContent.has(normalized)) return null;
  seenContent.add(normalized);
  
  // Check for "Category: Value" format
  const catMatch = liContent.match(/^(.+?):\s*(.+)$/);
  
  if (catMatch && catMatch[1].length < 40) { // Make sure category is not too long
    return new Paragraph({
      numbering: { reference: "bullet-list", level: 0 },
      spacing: { after: 60 },
      children: [
        new TextRun({ text: catMatch[1] + ": ", bold: true, size: 24, font: "Times New Roman" }),
        new TextRun({ text: catMatch[2], size: 24, font: "Times New Roman" })
      ]
    });
  }
  
  // Regular bullet point
  return new Paragraph({
    numbering: { reference: "bullet-list", level: 0 },
    spacing: { after: 60 },
    children: [new TextRun({ text: liContent, size: 24, font: "Times New Roman" })]
  });
}

function cleanText(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}
