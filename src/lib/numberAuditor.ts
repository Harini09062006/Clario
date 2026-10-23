import { DocumentPage, NumberVerificationItem, NumberVerificationResult } from '../types';

/**
 * Extended item type with convenient aliases
 */
export interface AuditedNumberItem extends NumberVerificationItem {
  value?: string;
  type?: string;
  status?: string;
}

export interface AuditedNumberResult extends NumberVerificationResult {
  success?: boolean;
  ambiguousCount?: number;
  discrepancyCount?: number;
  isScanned?: boolean;
  ocrRequired?: boolean;
  error?: string;
  data?: any;
  items: AuditedNumberItem[];
}

/**
 * Unicode-aware regex patterns for Indian & International numerical figures.
 * Uses (?<![\p{L}\p{N}]) and (?![\p{L}\p{N}]) with 'u' flag so Indic scripts
 * (Tamil, Hindi, etc.) are properly respected at word boundaries.
 */
const CURRENCY_PATTERNS = [
  // Explicit currency prefixes: ₹ 1,20,000, Rs. 65,000, ரூ. 1,20,000, रुपये 88,800, $50,000
  /(?<![\p{L}\p{N}])(?:ரூ\.?|௹|₹|Rs\.?|INR|\$|USD|EUR|GBP|रुपये|रुपए|रु\.?)\s*[\d,]+(?:\.\d{1,2})?(?:\/-)?(?![\p{L}\p{N}])/gui,
  // Currency suffixes: 1,20,000/- or 65,000 INR or 50,000 ரூபாய்
  /(?<![\p{L}\p{N}])[\d,]+(?:\.\d{1,2})?\s*(?:INR|USD|rupees?|ரூபாய்|रुपये|रु)(?![\p{L}\p{N}])/gui,
  // Standalone high-value comma-separated figures (e.g. 1,48,000 or 88,800 or 3,50,000)
  /(?<![\p{L}\p{N}])\d{1,3}(?:,\d{2,3})+(?:\.\d{1,2})?(?:\/-)?(?![\p{L}\p{N}])/gu,
];

const PERCENTAGE_PATTERNS = [
  /(?<![\p{L}\p{N}])\d+(?:\.\d+)?\s*%(?![\p{L}\p{N}])/gu,
  /(?<![\p{L}\p{N}])\d+(?:\.\d+)?\s*(?:percent|percentage|प्रतिशत|சதவீதம்)(?![\p{L}\p{N}])/gui,
];

const DATE_PATTERNS = [
  // DD Month YYYY (English, Hindi, Tamil)
  /(?<![\p{L}\p{N}])\d{1,2}\s+(?:ஜனவரி|பிப்ரவரி|மார்ச்|ஏப்ரல்|மே|ஜூன்|ஜூலை|ஆகஸ்ட்|செப்டம்பர்|அக்டோபர்|நவம்பர்|டிசம்பர்|जनवरी|फरवरी|मार्च|अप्रैल|मई|जून|जुलाई|अगस्त|सितंबर|अक्टूबर|नवंबर|दिसंबर|January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}(?![\p{L}\p{N}])/gui,
  // Month DD, YYYY (e.g. October 31, 2026)
  /(?<![\p{L}\p{N}])(?:January|February|March|April|May|June|July|August|September|October|November|December|ஜனவரி|மார்ச்|जनवरी|मार्च)\s+\d{1,2},?\s+\d{4}(?![\p{L}\p{N}])/gui,
  // DD/MM/YYYY or DD-MM-YYYY
  /(?<![\p{L}\p{N}])\d{1,2}[/-]\d{1,2}[/-]\d{4}(?![\p{L}\p{N}])/gu,
  // YYYY-YYYY range (e.g. 2026-2027)
  /(?<![\p{L}\p{N}])\d{4}[-–]\d{4}(?![\p{L}\p{N}])/gu,
  // Month YYYY
  /(?<![\p{L}\p{N}])(?:January|February|March|April|May|June|July|August|September|October|November|December|மார்ச்|मार्च)\s+\d{4}(?![\p{L}\p{N}])/gui,
];

const THRESHOLD_PATTERNS = [
  // Operational units & land thresholds (e.g., 2 HP, 3 kW, 5 acres, 2 years)
  /(?<![\p{L}\p{N}])\d+(?:\.\d+)?\s*(?:HP|kW|MW|kVA|hectares?|acres?|ஏக்கர்|वर्ष|years?|ஆண்டு|மாதம்|months?|days?|நாட்கள்|units?|வகைகள்|மாதாந்திர|sq\.?\s*ft|sq\.?\s*m|litres?|kg)(?![\p{L}\p{N}])/gui,
  // Range units (e.g. "3 or 4 years")
  /(?<![\p{L}\p{N}])\d+\s+or\s+\d+\s+(?:years?|months?|days?)(?![\p{L}\p{N}])/gui,
  // Phone/Helpline numbers with dashes (e.g. 1800-425-3993)
  /(?<![\p{L}\p{N}])\d{3,4}-\d{3,4}-\d{3,4}(?![\p{L}\p{N}])/gu,
  // Ratios and clauses
  /(?<![\p{L}\p{N}])(?:Clause|Section|Table|अधिनियम|அட்டவணை|तालिका)\s+\d+(?:\.\d+)?(?![\p{L}\p{N}])/gui,
  // Standalone numbers with operational context
  /(?<![\p{L}\p{N}])(?:Phase|Level|Grade|Tier|Step)\s+\d+(?![\p{L}\p{N}])/gui,
];

/**
 * Extracts supporting context passage around a matched index
 */
function extractContextPassage(text: string, matchIndex: number, matchLength: number): string {
  const windowRadius = 45;
  const start = Math.max(0, matchIndex - windowRadius);
  const end = Math.min(text.length, matchIndex + matchLength + windowRadius);
  let snippet = text.slice(start, end).replace(/[\r\n]+/g, ' ').trim();
  if (start > 0) snippet = '...' + snippet;
  if (end < text.length) snippet = snippet + '...';
  return snippet;
}

/**
 * High-Precision Document Number Auditor
 * Overloaded signature allows calling either:
 *   auditDocumentNumbers(docId, title, pages) OR
 *   auditDocumentNumbers(pages, docId, title)
 */
export function auditDocumentNumbers(
  arg1: string | DocumentPage[],
  arg2?: string | DocumentPage[],
  arg3?: DocumentPage[]
): AuditedNumberResult {
  let documentId = 'doc-1';
  let title = 'Document';
  let pages: DocumentPage[] = [];

  if (Array.isArray(arg1)) {
    pages = arg1;
    documentId = typeof arg2 === 'string' ? arg2 : 'doc-1';
    title = typeof arg3 === 'string' ? arg3 : 'Document';
  } else {
    documentId = typeof arg1 === 'string' ? arg1 : 'doc-1';
    title = typeof arg2 === 'string' ? arg2 : 'Document';
    pages = Array.isArray(arg3) ? arg3 : (Array.isArray(arg2) ? (arg2 as DocumentPage[]) : []);
  }

  // Handle completely empty pages
  if (!pages || pages.length === 0) {
    const emptyRes: AuditedNumberResult = {
      success: true,
      documentId,
      documentTitle: title,
      totalNumbersChecked: 0,
      confirmedCount: 0,
      flaggedCount: 0,
      ambiguousCount: 0,
      discrepancyCount: 0,
      items: [],
    };
    emptyRes.data = { ...emptyRes };
    return emptyRes;
  }

  // Check if document is scanned with zero meaningful text
  const totalTextLength = pages.reduce((acc, p) => {
    const text = (p.extractedText || (p as any).text || '').trim();
    return acc + text.length;
  }, 0);

  if (totalTextLength < 15) {
    const scannedRes: AuditedNumberResult = {
      success: false,
      documentId,
      documentTitle: title,
      totalNumbersChecked: 0,
      confirmedCount: 0,
      flaggedCount: 0,
      ambiguousCount: 0,
      discrepancyCount: 0,
      isScanned: true,
      ocrRequired: true,
      error: 'This document appears to be a scanned image-only PDF and requires active OCR to extract numerical figures.',
      items: [],
    };
    scannedRes.data = { ...scannedRes };
    return scannedRes;
  }

  const items: AuditedNumberItem[] = [];
  const seenKeys = new Set<string>();

  pages.forEach((p) => {
    const text = (p.extractedText || (p as any).text || '').trim();
    if (!text) return;

    const pageOcrConfidence = p.ocrConfidence !== undefined ? p.ocrConfidence : 0.95;
    const isPageScannedOrNoisy = pageOcrConfidence < 0.70;

    // Helper to add unique item
    const addItem = (
      val: string,
      category: NumberVerificationItem['category'],
      rawMatchIndex: number
    ) => {
      const cleanVal = val.trim();
      const dedupKey = `${cleanVal.toLowerCase()}_p${p.pageNumber}_${category}`;
      if (seenKeys.has(dedupKey)) return;
      seenKeys.add(dedupKey);

      const passage = extractContextPassage(text, rawMatchIndex, cleanVal.length);

      // Determine verification status: Confirmed vs Ambiguous vs Discrepancy
      let status: 'confirmed' | 'ambiguous' | 'discrepancy' = 'confirmed';
      let note = `Verified in source clause on Page ${p.pageNumber}.`;

      // Check for OCR artifacts (e.g. O instead of 0, broken comma, suspicious formatting)
      const hasOcrArtifact = /[A-Za-z]\d+\b|\b\d+[A-Za-z]\b|\d+\s+[.,]\s+\d+|\?|~/.test(cleanVal) ||
                             /[~?]/.test(passage);
      if (isPageScannedOrNoisy || hasOcrArtifact) {
        status = 'ambiguous';
        note = `Extracted from scanned layout (confidence ${Math.round(pageOcrConfidence * 100)}%). Verify with document image.`;
      }

      items.push({
        id: `num-${category}-${p.pageNumber}-${items.length + 1}`,
        extractedValue: cleanVal,
        value: cleanVal, // convenience alias
        category,
        type: category, // convenience alias
        passage,
        pageNumber: p.pageNumber,
        verificationStatus: status,
        status, // convenience alias
        notes: note,
      });
    };

    // 1. Currency
    for (const pattern of CURRENCY_PATTERNS) {
      const regex = new RegExp(pattern.source, pattern.flags);
      let match;
      while ((match = regex.exec(text)) !== null) {
        const val = match[0].trim();
        // Skip lone punctuation or very short non-numbers
        if (val.replace(/[^\d]/g, '').length < 2) continue;
        addItem(val, 'currency', match.index);
      }
    }

    // 2. Percentages
    for (const pattern of PERCENTAGE_PATTERNS) {
      const regex = new RegExp(pattern.source, pattern.flags);
      let match;
      while ((match = regex.exec(text)) !== null) {
        addItem(match[0].trim(), 'percentage', match.index);
      }
    }

    // 3. Dates
    for (const pattern of DATE_PATTERNS) {
      const regex = new RegExp(pattern.source, pattern.flags);
      let match;
      while ((match = regex.exec(text)) !== null) {
        addItem(match[0].trim(), 'date', match.index);
      }
    }

    // 4. Thresholds & Operational Units
    for (const pattern of THRESHOLD_PATTERNS) {
      const regex = new RegExp(pattern.source, pattern.flags);
      let match;
      while ((match = regex.exec(text)) !== null) {
        addItem(match[0].trim(), 'threshold', match.index);
      }
    }
  });

  // -------------------------------------------------------------
  // CROSS-PAGE DISCREPANCY DETECTION
  // -------------------------------------------------------------
  // Check if multiple contradictory figures exist across pages for the same subject
  const currencyItems = items.filter((i) => i.category === 'currency');
  if (currencyItems.length >= 2 && pages.length > 1) {
    // If the document contains recurring terms like "fee", "cost", "subsidy", "registration"
    // across different pages with differing figures:
    const keywords = ['fee', 'subsidy', 'grant', 'cost', 'registration', 'அரசு', 'अनुदान'];
    for (const kw of keywords) {
      const matchingItems = currencyItems.filter((c) =>
        new RegExp(kw, 'i').test(c.passage)
      );
      if (matchingItems.length > 1) {
        const uniqueValues = new Set(matchingItems.map((m) => m.extractedValue));
        if (uniqueValues.size > 1) {
          // Cross-page divergence found!
          const first = matchingItems[0];
          for (let i = 1; i < matchingItems.length; i++) {
            const item = matchingItems[i];
            if (item.pageNumber !== first.pageNumber && item.extractedValue !== first.extractedValue) {
              item.verificationStatus = 'discrepancy';
              item.status = 'discrepancy';
              item.notes = `Discrepancy alert: Page ${item.pageNumber} states "${item.extractedValue}" for ${kw}, whereas Page ${first.pageNumber} states "${first.extractedValue}".`;
            }
          }
        }
      }
    }
  }

  // Cross-page Date Divergence
  const dateItems = items.filter((i) => i.category === 'date');
  if (dateItems.length > 1 && pages.length > 1) {
    const firstDate = dateItems[0];
    for (let i = 1; i < dateItems.length; i++) {
      const d = dateItems[i];
      if (d.pageNumber !== firstDate.pageNumber && d.extractedValue !== firstDate.extractedValue) {
        // If passages both mention deadline/last date/closing:
        const isDeadlineContext = /deadline|last date|கடைசி தேதி|अंतिम तिथि|closing|expir/i.test(d.passage + ' ' + firstDate.passage);
        if (isDeadlineContext) {
          d.verificationStatus = 'discrepancy';
          d.status = 'discrepancy';
          d.notes = `Timeline discrepancy: Page ${d.pageNumber} specifies "${d.extractedValue}" while Page ${firstDate.pageNumber} mentions "${firstDate.extractedValue}".`;
        }
      }
    }
  }

  const confirmedCount = items.filter((i) => i.verificationStatus === 'confirmed').length;
  const ambiguousCount = items.filter((i) => i.verificationStatus === 'ambiguous').length;
  const discrepancyCount = items.filter((i) => i.verificationStatus === 'discrepancy').length;
  const flaggedCount = ambiguousCount + discrepancyCount;

  const result: AuditedNumberResult = {
    success: true,
    documentId,
    documentTitle: title,
    totalNumbersChecked: items.length,
    confirmedCount,
    flaggedCount,
    ambiguousCount,
    discrepancyCount,
    items,
  };
  result.data = { ...result };

  return result;
}
