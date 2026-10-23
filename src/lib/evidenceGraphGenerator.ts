import {
  DocumentPage,
  EvidenceGraphData,
  EvidenceGraphNode,
  EvidenceGraphEdge,
  EvidenceStatus,
  EvidenceRelationshipType,
} from '../types';
import { verifyPassageInPage, normalizeForSearch } from './contradictionRadar';

/**
 * Clean prefix boilerplates often included in generated answers
 */
function cleanAnswerBoilerplate(text: string): string {
  return text
    .replace(/^Based on (?:Page \d+|the document|the circular)[^:]*:\s*/i, '')
    .replace(/^According to (?:Page \d+|the document|the circular)[^:]*:\s*/i, '')
    .replace(/^दस्तावेज़ के पृष्ठ \d+ के आधार पर:\s*/i, '')
    .replace(/^ஆவணத்தின் படி:\s*/i, '')
    .replace(/^பக்கம் \d+ இன் படி:\s*/i, '')
    .trim();
}

/**
 * Splits an answer into distinct factual claim statements
 */
export function extractClaimsFromAnswer(answer: string): string[] {
  if (!answer) return [];
  const cleaned = cleanAnswerBoilerplate(answer);

  // If the answer is strictly "Not in the document"
  if (
    cleaned.toLowerCase().includes('not in the document') ||
    cleaned.includes('ದಸ್ತಾವೇಜಿನಲ್ಲಿ ಇಲ್ಲ')
  ) {
    return ['The queried information is not stated in the document.'];
  }

  // Protect abbreviations like Rs., No., Dr., etc.
  const protectedText = cleaned.replace(
    /(?<!\w)(Rs|ரூ|No|Vol|Dr|Mr|Mrs|vs|i\.e|e\.g|Sec|Cl)\.\s+/gi,
    '$1.__SPACE__'
  );

  // Split on periods, semicolons, or numbered list items
  const rawClauses = protectedText.split(/(?<=[.!?;\n])\s+/);
  const claims: string[] = [];

  for (const clause of rawClauses) {
    const unescaped = clause.replace(/__SPACE__/g, ' ').replace(/^[\d+.)\-•\s]+/, '').trim();
    if (unescaped.length >= 12) {
      claims.push(unescaped);
    }
  }

  return claims.length > 0 ? claims : [cleaned];
}

interface EvidenceMatch {
  passage: string;
  pageNumber: number;
  status: EvidenceStatus;
  explanation: string;
  isVerbatim: boolean;
  score: number;
}

/**
 * Extracts candidate sentences from a page for evidence matching
 */
function getPageCandidatePassages(pageText: string): string[] {
  if (!pageText) return [];
  const protectedText = pageText.replace(
    /(?<!\w)(Rs|ரூ|No|Vol|Dr|Mr|Mrs|vs|i\.e|e\.g|Sec|Cl)\.\s+/gi,
    '$1.__SPACE__'
  );
  return protectedText
    .split(/(?<=[.!?\n])\s+/)
    .map((s) => s.replace(/__SPACE__/g, ' ').trim())
    .filter((s) => s.length > 15);
}

/**
 * Matches a claim against page passages and evaluates support status
 */
function matchClaimAgainstPages(claim: string, pages: DocumentPage[]): EvidenceMatch[] {
  const matches: EvidenceMatch[] = [];
  const normClaim = normalizeForSearch(claim);
  const claimWords = normClaim.split(' ').filter((w) => w.length > 2);

  // Extract explicit numerical or date figures from the claim
  const numMatches = claim.match(/(?:ரூ\.?|௹|₹|Rs\.?|INR|\$)?\s*[\d,]+(?:\.\d+)?(?:\/-)?/gi) || [];
  const dateMatches = claim.match(/\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December|மார்ச்|மார்ச்|जनवरी|मार्च)\s+\d{4}/gi) || [];

  for (const page of pages) {
    const pageText = page.extractedText || '';
    if (!pageText.trim()) continue;

    const passages = getPageCandidatePassages(pageText);

    for (const passage of passages) {
      const normPassage = normalizeForSearch(passage);

      // 1. Direct Substring Match (Strongest Evidence)
      if (normPassage.includes(normClaim) || normClaim.includes(normPassage)) {
        matches.push({
          passage,
          pageNumber: page.pageNumber,
          status: 'supported',
          explanation: `Direct verbatim match found on Page ${page.pageNumber}.`,
          isVerbatim: true,
          score: 1.0,
        });
        continue;
      }

      // 2. Token & Entity Overlap
      if (claimWords.length >= 3) {
        let matchedCount = 0;
        for (const word of claimWords) {
          if (normPassage.includes(word)) matchedCount++;
        }
        const overlap = matchedCount / claimWords.length;

        // Check if numbers or dates in claim match or conflict
        let numbersMatch = true;
        let numbersConflict = false;

        for (const num of numMatches) {
          const cleanNum = num.replace(/[^\d]/g, '');
          if (cleanNum.length >= 2) {
            if (passage.includes(num) || normPassage.includes(cleanNum)) {
              // Number matches
            } else {
              // If page has numbers for same entity that differ
              const pageNums = passage.match(/[\d,]+(?:\.\d+)?/g) || [];
              if (pageNums.some((pn) => pn.replace(/[^\d]/g, '').length >= 3 && pn.replace(/[^\d]/g, '') !== cleanNum)) {
                numbersConflict = true;
              }
              numbersMatch = false;
            }
          }
        }

        if (numbersConflict && overlap >= 0.5) {
          matches.push({
            passage,
            pageNumber: page.pageNumber,
            status: 'contradicted',
            explanation: `Document states a conflicting numerical amount or date on Page ${page.pageNumber}.`,
            isVerbatim: verifyPassageInPage(passage, pageText),
            score: overlap,
          });
        } else if (overlap >= 0.75 && (numMatches.length === 0 || numbersMatch)) {
          matches.push({
            passage,
            pageNumber: page.pageNumber,
            status: 'supported',
            explanation: `Passage on Page ${page.pageNumber} substantially and directly supports the factual claim.`,
            isVerbatim: verifyPassageInPage(passage, pageText),
            score: overlap,
          });
        } else if (overlap >= 0.45) {
          matches.push({
            passage,
            pageNumber: page.pageNumber,
            status: 'partially_supported',
            explanation: `Passage on Page ${page.pageNumber} references relevant entities or conditions but does not confirm all details.`,
            isVerbatim: verifyPassageInPage(passage, pageText),
            score: overlap,
          });
        }
      }
    }
  }

  // Sort by score descending and deduplicate
  matches.sort((a, b) => b.score - a.score);
  return matches.slice(0, 2); // Keep top 2 most relevant supporting/contradicting passages
}

/**
 * Main Evidence Traceability Graph Generator
 */
export function generateEvidenceGraph(
  documentId: string,
  documentTitle: string,
  question: string,
  answer: string,
  pages: DocumentPage[],
  answerLanguage: string = 'English'
): EvidenceGraphData {
  const now = new Date().toISOString();

  // 1. Check for scanned / empty document
  const totalTextLength = pages.reduce((acc, p) => acc + (p.extractedText || '').length, 0);
  if (totalTextLength < 15) {
    return {
      documentId,
      documentTitle,
      question,
      answer,
      totalClaims: 0,
      supportedCount: 0,
      partiallySupportedCount: 0,
      contradictedCount: 0,
      insufficientEvidenceCount: 0,
      notVerifiedCount: 0,
      nodes: [],
      edges: [],
      isScanned: true,
      ocrRequired: true,
      code: 'ocr_unavailable',
      error: 'This document appears to be a scanned image-only PDF and requires active OCR to trace evidence. Please configure OCR or upload a text-readable PDF.',
      generatedAt: now,
    };
  }

  const nodes: EvidenceGraphNode[] = [];
  const edges: EvidenceGraphEdge[] = [];
  const pageNodesCreated = new Set<number>();

  // 2. Question Node
  const questionNodeId = 'node-question';
  nodes.push({
    id: questionNodeId,
    type: 'question',
    label: 'User Question',
    text: question,
    docId: documentId,
    docTitle: documentTitle,
  });

  // 3. Answer Node
  const answerNodeId = 'node-answer';
  nodes.push({
    id: answerNodeId,
    type: 'answer',
    label: 'Generated Answer',
    text: answer,
    docId: documentId,
    docTitle: documentTitle,
    metadata: { language: answerLanguage },
  });

  // Edge: Question -> Answer
  edges.push({
    id: 'edge-q-a',
    source: questionNodeId,
    target: answerNodeId,
    relationship: 'GENERATES_ANSWER',
    label: 'generates answer',
  });

  // 4. Extract Claims
  const rawClaims = extractClaimsFromAnswer(answer);
  let supportedCount = 0;
  let partiallySupportedCount = 0;
  let contradictedCount = 0;
  let insufficientEvidenceCount = 0;
  const notVerifiedCount = 0;

  rawClaims.forEach((claimText, idx) => {
    const claimNodeId = `node-claim-${idx + 1}`;

    // Handle "Not in the document" special case
    if (claimText.includes('not stated in the document')) {
      nodes.push({
        id: claimNodeId,
        type: 'claim',
        label: `Claim ${idx + 1}`,
        text: claimText,
        status: 'supported',
        metadata: {
          explanation: 'Verified: Topic is entirely absent from document content.',
        },
      });

      edges.push({
        id: `edge-a-claim-${idx + 1}`,
        source: answerNodeId,
        target: claimNodeId,
        relationship: 'CONTAINS_CLAIM',
        label: 'asserts absence',
      });

      supportedCount++;
      return;
    }

    // Match claim against document pages
    const evidenceMatches = matchClaimAgainstPages(claimText, pages);

    // Determine overall claim status
    let claimStatus: EvidenceStatus = 'insufficient_evidence';
    if (evidenceMatches.length > 0) {
      if (evidenceMatches.some((m) => m.status === 'contradicted')) {
        claimStatus = 'contradicted';
        contradictedCount++;
      } else if (evidenceMatches.some((m) => m.status === 'supported')) {
        claimStatus = 'supported';
        supportedCount++;
      } else if (evidenceMatches.some((m) => m.status === 'partially_supported')) {
        claimStatus = 'partially_supported';
        partiallySupportedCount++;
      }
    } else {
      insufficientEvidenceCount++;
    }

    // Add Claim Node
    nodes.push({
      id: claimNodeId,
      type: 'claim',
      label: `Claim ${idx + 1}`,
      text: claimText,
      status: claimStatus,
      metadata: {
        explanation:
          evidenceMatches[0]?.explanation ||
          'No supporting or relevant evidence found in the document.',
      },
    });

    // Edge: Answer -> Claim
    edges.push({
      id: `edge-a-claim-${idx + 1}`,
      source: answerNodeId,
      target: claimNodeId,
      relationship: 'CONTAINS_CLAIM',
      label: 'asserts claim',
    });

    // Add Evidence Nodes & Edges (if real evidence was found)
    if (evidenceMatches.length > 0) {
      evidenceMatches.forEach((ev, evIdx) => {
        // Enforce anti-hallucination: reject if not genuinely in page text
        const pageObj = pages.find((p) => p.pageNumber === ev.pageNumber);
        if (!pageObj || !verifyPassageInPage(ev.passage, pageObj.extractedText)) {
          return;
        }

        const evidenceNodeId = `node-evidence-${idx + 1}-${evIdx + 1}`;
        nodes.push({
          id: evidenceNodeId,
          type: 'evidence',
          label: `Evidence P.${ev.pageNumber}`,
          text: ev.passage,
          status: ev.status,
          pageNumber: ev.pageNumber,
          docId: documentId,
          docTitle: documentTitle,
          metadata: {
            explanation: ev.explanation,
            confidence: ev.score,
          },
        });

        let relType: EvidenceRelationshipType = 'SUPPORTED_BY';
        if (ev.status === 'partially_supported') relType = 'PARTIALLY_SUPPORTED_BY';
        if (ev.status === 'contradicted') relType = 'CONTRADICTED_BY';

        edges.push({
          id: `edge-claim-${idx + 1}-ev-${evIdx + 1}`,
          source: claimNodeId,
          target: evidenceNodeId,
          relationship: relType,
          label: ev.status.replace('_', ' '),
        });

        // Add or link to PDF Page Node
        const pageNodeId = `node-page-${ev.pageNumber}`;
        if (!pageNodesCreated.has(ev.pageNumber)) {
          pageNodesCreated.add(ev.pageNumber);
          nodes.push({
            id: pageNodeId,
            type: 'page',
            label: `Page ${ev.pageNumber}`,
            text: `Original PDF Source — Page ${ev.pageNumber}`,
            pageNumber: ev.pageNumber,
            docId: documentId,
            docTitle: documentTitle,
          });
        }

        edges.push({
          id: `edge-ev-${idx + 1}-${evIdx + 1}-page-${ev.pageNumber}`,
          source: evidenceNodeId,
          target: pageNodeId,
          relationship: 'LOCATED_ON_PAGE',
          label: 'located on',
        });
      });
    }
  });

  return {
    documentId,
    documentTitle,
    question,
    answer,
    totalClaims: rawClaims.length,
    supportedCount,
    partiallySupportedCount,
    contradictedCount,
    insufficientEvidenceCount,
    notVerifiedCount,
    nodes,
    edges,
    generatedAt: now,
  };
}
