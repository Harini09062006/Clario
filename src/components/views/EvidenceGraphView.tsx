import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Network,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  ExternalLink,
  RotateCw,
  Search,
  FileText,
  Sparkles,
  ArrowRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  FileCheck2,
  XCircle,
  MessageSquareQuote,
  Layers,
  ChevronRight,
  BookOpen,
  Info,
} from 'lucide-react';
import {
  ClarioDocument,
  EvidenceGraphData,
  EvidenceGraphNode,
  EvidenceStatus,
} from '../../types';
import { AuthUser } from '../../lib/supabase';
import { apiUrl } from '../../lib/api';

interface EvidenceGraphViewProps {
  documents: ClarioDocument[];
  currentUser: AuthUser;
  initialDocId?: string;
  onOpenViewer: (doc: ClarioDocument, page: number, passage: string) => void;
  onGoToAuth: () => void;
  onNavigateToMyDocs: () => void;
  onTriggerUpload?: () => void;
  isUploading?: boolean;
}

export const EvidenceGraphView: React.FC<EvidenceGraphViewProps> = ({
  documents,
  currentUser: _currentUser,
  initialDocId,
  onOpenViewer,
  onGoToAuth: _onGoToAuth,
  onNavigateToMyDocs: _onNavigateToMyDocs,
  onTriggerUpload: _onTriggerUpload,
  isUploading: _isUploading = false,
}) => {
  // Document and question selection
  const [selectedDocId, setSelectedDocId] = useState<string>(
    initialDocId || documents[0]?.id || ''
  );
  const [questionInput, setQuestionInput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [graphData, setGraphData] = useState<EvidenceGraphData | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Zoom and pan state
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const svgContainerRef = useRef<HTMLDivElement>(null);

  // Suggested questions based on selected document
  const selectedDocument = useMemo(() => {
    return documents.find((d) => d.id === selectedDocId) || documents[0] || null;
  }, [documents, selectedDocId]);

  const defaultSuggestedQuestion = useMemo(() => {
    if (!selectedDocument) return 'What are the main eligibility criteria and deadlines?';
    const title = selectedDocument.title.toLowerCase();
    if (title.includes('cmchis') || title.includes('health')) {
      return 'What is the maximum annual family income limit and treatment coverage?';
    }
    if (title.includes('solar') || title.includes('kusum')) {
      return 'What are the costs, subsidies, and deadlines for 2 HP and 3 HP solar pumps?';
    }
    if (title.includes('scholarship') || title.includes('merit')) {
      return 'What are the eligibility requirements, family income ceiling, and scholarship amounts?';
    }
    return 'What are the main financial amounts, deadlines, and requirements?';
  }, [selectedDocument]);

  // Sync selected doc when documents list changes
  useEffect(() => {
    if (documents.length > 0) {
      if (!selectedDocId || !documents.some((d) => d.id === selectedDocId)) {
        setSelectedDocId(documents[0].id);
      }
    }
  }, [documents, selectedDocId]);

  // Set default question when switching documents
  useEffect(() => {
    if (defaultSuggestedQuestion && !questionInput) {
      setQuestionInput(defaultSuggestedQuestion);
    }
  }, [defaultSuggestedQuestion]);

  // Auto-run graph generation on initial load when a document is selected
  useEffect(() => {
    if (selectedDocument && !graphData && !loading) {
      runGenerateGraph(defaultSuggestedQuestion);
    }
  }, [selectedDocument?.id]);

  const runGenerateGraph = async (overrideQuestion?: string) => {
    if (!selectedDocument) return;
    const query = overrideQuestion || questionInput || defaultSuggestedQuestion;

    setLoading(true);
    setError(null);
    setSelectedNodeId(null);

    const normalizedPages = (selectedDocument.pages || []).map((p, idx) => ({
      id: p.id || `p-${idx + 1}`,
      pageNumber: p.pageNumber || idx + 1,
      extractedText: p.extractedText || (p as any).text || '',
      ocrConfidence: p.ocrConfidence !== undefined ? p.ocrConfidence : 0.95,
    }));

    try {
      const response = await fetch(apiUrl('/api/documents/evidence-graph'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: selectedDocument.id,
          title: selectedDocument.title,
          filename: selectedDocument.filename,
          question: query,
          pages: normalizedPages,
          answerLanguage: selectedDocument.language || 'English',
        }),
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      const data: EvidenceGraphData = await response.json();
      setGraphData(data);
      // Select the first claim node by default if available
      const firstClaim = data.nodes.find((n) => n.type === 'claim');
      if (firstClaim) setSelectedNodeId(firstClaim.id);
    } catch (err: any) {
      console.error('Evidence graph generation error:', err);
      setError(`Evidence graph generation failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Zoom & Pan Handlers
  const handleZoomIn = () => setZoomLevel((z) => Math.min(z + 0.15, 2.0));
  const handleZoomOut = () => setZoomLevel((z) => Math.max(z - 0.15, 0.5));
  const handleResetView = () => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Left click only
    setIsDragging(true);
    setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPanOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  // Selected Node Details
  const selectedNode = useMemo(() => {
    if (!graphData || !selectedNodeId) return null;
    return graphData.nodes.find((n) => n.id === selectedNodeId) || null;
  }, [graphData, selectedNodeId]);

  // Connected Edges for highlighting
  const connectedEdgeIds = useMemo(() => {
    if (!graphData || !selectedNodeId) return new Set<string>();
    const set = new Set<string>();
    graphData.edges.forEach((e) => {
      if (e.source === selectedNodeId || e.target === selectedNodeId) {
        set.add(e.id);
      }
    });
    return set;
  }, [graphData, selectedNodeId]);

  // Compute Layout Positions for Nodes
  const layout = useMemo(() => {
    if (!graphData || graphData.nodes.length === 0) return { nodesWithPos: [], width: 900, height: 500 };

    // Group nodes by layer/type
    const questionNodes = graphData.nodes.filter((n) => n.type === 'question');
    const answerNodes = graphData.nodes.filter((n) => n.type === 'answer');
    const claimNodes = graphData.nodes.filter((n) => n.type === 'claim');
    const evidenceNodes = graphData.nodes.filter((n) => n.type === 'evidence');
    const pageNodes = graphData.nodes.filter((n) => n.type === 'page');

    const columnX: Record<string, number> = {
      question: 60,
      answer: 260,
      claim: 480,
      evidence: 720,
      page: 950,
    };

    const maxItems = Math.max(
      questionNodes.length,
      answerNodes.length,
      claimNodes.length,
      evidenceNodes.length,
      pageNodes.length,
      4
    );

    const totalHeight = Math.max(500, maxItems * 130 + 80);
    const totalWidth = 1080;

    const computeY = (index: number, count: number) => {
      if (count === 1) return totalHeight / 2;
      const spacing = (totalHeight - 120) / (count - 1);
      return 60 + index * spacing;
    };

    const posMap = new Map<string, { x: number; y: number }>();

    questionNodes.forEach((n, idx) => posMap.set(n.id, { x: columnX.question, y: computeY(idx, questionNodes.length) }));
    answerNodes.forEach((n, idx) => posMap.set(n.id, { x: columnX.answer, y: computeY(idx, answerNodes.length) }));
    claimNodes.forEach((n, idx) => posMap.set(n.id, { x: columnX.claim, y: computeY(idx, claimNodes.length) }));
    evidenceNodes.forEach((n, idx) => posMap.set(n.id, { x: columnX.evidence, y: computeY(idx, evidenceNodes.length) }));
    pageNodes.forEach((n, idx) => posMap.set(n.id, { x: columnX.page, y: computeY(idx, pageNodes.length) }));

    return {
      nodesWithPos: graphData.nodes.map((n) => ({
        ...n,
        pos: posMap.get(n.id) || { x: 100, y: 100 },
      })),
      posMap,
      width: totalWidth,
      height: totalHeight,
    };
  }, [graphData]);

  // Status Styling Helper
  const getStatusBadge = (status?: EvidenceStatus) => {
    switch (status) {
      case 'supported':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#F0FDF4] text-[#15803D] border border-[#DCFCE7]">
            <CheckCircle2 className="w-3 h-3 text-[#15803D]" />
            Supported
          </span>
        );
      case 'partially_supported':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A]">
            <HelpCircle className="w-3 h-3 text-[#D97706]" />
            Partially Supported
          </span>
        );
      case 'contradicted':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#FEF2F2] text-[#DC2626] border border-[#FEE2E2]">
            <XCircle className="w-3 h-3 text-[#DC2626]" />
            Contradicted
          </span>
        );
      case 'insufficient_evidence':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#F8FAFC] text-[#64748B] border border-[#E2E8F0]">
            <HelpCircle className="w-3 h-3 text-[#94A3B8]" />
            Insufficient Evidence
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#F8FAFC] text-[#64748B] border border-[#E2E8F0]">
            Not Verified
          </span>
        );
    }
  };

  // Node Type Color Config
  const getNodeBorderAndBg = (node: EvidenceGraphNode, isSelected: boolean) => {
    let base = 'bg-white border-[#E2E8F0] text-[#172554]';
    if (node.type === 'question') {
      base = 'bg-[#F5F3FF] border-[#DDD6FE] text-[#6D28D9]';
    } else if (node.type === 'answer') {
      base = 'bg-[#F8FAFC] border-[#CBD5E1] text-[#0F172A]';
    } else if (node.type === 'claim') {
      if (node.status === 'supported') base = 'bg-[#F0FDF4] border-[#86EFAC] text-[#15803D]';
      else if (node.status === 'partially_supported') base = 'bg-[#FFFBEB] border-[#FDE68A] text-[#B45309]';
      else if (node.status === 'contradicted') base = 'bg-[#FEF2F2] border-[#FCA5A5] text-[#DC2626]';
      else base = 'bg-[#F8FAFC] border-[#CBD5E1] text-[#475569]';
    } else if (node.type === 'evidence') {
      base = 'bg-white border-[#E2E8F0] text-[#1E293B] shadow-xs';
    } else if (node.type === 'page') {
      base = 'bg-[#EFF6FF] border-[#BFDBFE] text-[#1D4ED8] font-bold';
    }

    if (isSelected) {
      return `${base} ring-2 ring-[#6D28D9] shadow-md`;
    }
    return `${base} hover:shadow-xs`;
  };

  // Scanned image PDF without OCR
  const isScannedOcrError = Boolean(
    graphData?.ocrRequired || graphData?.code === 'ocr_unavailable' || graphData?.isScanned
  );

  // 1. EMPTY STATE: NO DOCUMENTS IN LIBRARY
  if (documents.length === 0) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-[#172554] tracking-tight mb-1">
              Evidence Traceability Graph
            </h2>
            <p className="text-xs text-[#64748B]">
              Visually connect user questions to individual answer claims, supporting passages, and original PDF pages.
            </p>
          </div>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-12 sm:p-16 shadow-xs text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#F5F3FF] text-[#6D28D9] border border-[#EDE9FE] flex items-center justify-center mx-auto mb-4">
            <Network className="w-7 h-7 stroke-[2]" />
          </div>
          <h3 className="text-base font-bold text-[#172554] mb-1">
            No Documents Available
          </h3>
          <p className="text-xs text-[#64748B] max-w-md mx-auto mb-6 leading-relaxed">
            Upload an Indian-language or English document to trace factual assertions back to verified source citations.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {/* A. Header with Document Selection & Question Input */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-lg bg-[#F5F3FF] text-[#6D28D9] flex items-center justify-center">
                <Network className="w-4 h-4 stroke-[2.2]" />
              </div>
              <h2 className="text-base font-bold text-[#172554] tracking-tight">
                Evidence Traceability Graph
              </h2>
            </div>
            <p className="text-xs text-[#64748B]">
              Visually connect user questions to individual answer claims, verified source passages, and original PDF pages.
            </p>
          </div>

          {/* Document Switcher */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-2.5 py-1.5 text-xs">
              <span className="text-[#64748B] font-medium hidden sm:inline">Document:</span>
              <select
                value={selectedDocId}
                onChange={(e) => setSelectedDocId(e.target.value)}
                className="bg-transparent text-xs font-semibold text-[#172554] focus:outline-none max-w-[220px] truncate cursor-pointer"
              >
                {documents.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.title} ({doc.language || 'English'})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Question Search / Input Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={questionInput}
              onChange={(e) => setQuestionInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') runGenerateGraph();
              }}
              placeholder="Ask a question to trace its evidence graph (e.g. What is the family income limit?)..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-[#172554] placeholder-[#94A3B8] focus:outline-none focus:border-[#6D28D9] focus:bg-white"
            />
          </div>

          <button
            onClick={() => runGenerateGraph()}
            disabled={loading || !questionInput.trim()}
            className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-[#6D28D9] hover:bg-[#5B21B6] disabled:opacity-50 text-white text-xs font-semibold transition-colors cursor-pointer shadow-xs whitespace-nowrap"
          >
            <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Tracing Evidence...' : 'Generate Traceability Graph'}</span>
          </button>
        </div>
      </div>

      {/* Scanned Document Without OCR Warning */}
      {isScannedOcrError && (
        <div className="p-5 rounded-xl bg-[#FFFBEB] border border-[#FDE68A] flex flex-col sm:flex-row sm:items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-[#D97706] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-[#92400E]">
              Scanned Document Requires Active OCR
            </h4>
            <p className="text-xs text-[#B45309] leading-relaxed">
              {graphData?.error ||
                'This document appears to be a scanned image-only PDF and requires active OCR to trace evidence back to source pages.'}
            </p>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && !isScannedOcrError && (
        <div className="p-4 rounded-xl bg-[#FEF2F2] border border-[#FEE2E2] flex items-center justify-between gap-3 text-xs text-[#B91C1C]">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => runGenerateGraph()}
            className="px-3 py-1 bg-white border border-[#FCA5A5] rounded-md font-semibold text-[#B91C1C] hover:bg-[#FEF2F2] cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* B. Metrics Strip */}
      {graphData && !isScannedOcrError && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-3.5 shadow-xs">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#64748B]">
              Total Claims
            </span>
            <div className="text-xl font-bold text-[#172554] mt-0.5">
              {graphData.totalClaims}
            </div>
            <span className="text-[10px] text-[#64748B]">Factual assertions</span>
          </div>

          <div className="bg-white border border-[#E2E8F0] rounded-xl p-3.5 shadow-xs">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#15803D]">
              Supported
            </span>
            <div className="text-xl font-bold text-[#15803D] mt-0.5">
              {graphData.supportedCount}
            </div>
            <span className="text-[10px] text-[#64748B]">Verbatim passage match</span>
          </div>

          <div className="bg-white border border-[#E2E8F0] rounded-xl p-3.5 shadow-xs">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#D97706]">
              Partially Supported
            </span>
            <div className="text-xl font-bold text-[#D97706] mt-0.5">
              {graphData.partiallySupportedCount}
            </div>
            <span className="text-[10px] text-[#64748B]">Partial qualification</span>
          </div>

          <div className="bg-white border border-[#E2E8F0] rounded-xl p-3.5 shadow-xs">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#DC2626]">
              Contradicted
            </span>
            <div className="text-xl font-bold text-[#DC2626] mt-0.5">
              {graphData.contradictedCount}
            </div>
            <span className="text-[10px] text-[#64748B]">Conflicting page evidence</span>
          </div>

          <div className="bg-white border border-[#E2E8F0] rounded-xl p-3.5 shadow-xs">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#64748B]">
              Insufficient Evidence
            </span>
            <div className="text-xl font-bold text-[#475569] mt-0.5">
              {graphData.insufficientEvidenceCount}
            </div>
            <span className="text-[10px] text-[#64748B]">Unproven assertions</span>
          </div>
        </div>
      )}

      {/* C. Interactive Evidence Graph Canvas & Evidence Details Panel */}
      {graphData && !isScannedOcrError && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Main Visual Graph Canvas (2 Columns on Desktop) */}
          <div className="lg:col-span-2 bg-white border border-[#E2E8F0] rounded-xl shadow-xs overflow-hidden flex flex-col min-h-[560px]">
            {/* Graph Controls Toolbar & Legend */}
            <div className="p-3 bg-[#F8FAFC] border-b border-[#E2E8F0] flex flex-wrap items-center justify-between gap-2 text-xs">
              {/* Legend of Node Types */}
              <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#64748B]">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#6D28D9]" />
                  <span>Question</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#0F172A]" />
                  <span>Answer</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#15803D]" />
                  <span>Claims</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#D97706]" />
                  <span>Evidence Passage</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#2563EB]" />
                  <span>PDF Page</span>
                </div>
              </div>

              {/* Zoom & Pan Controls */}
              <div className="flex items-center gap-1 bg-white border border-[#E2E8F0] rounded-lg p-0.5 shadow-2xs">
                <button
                  onClick={handleZoomIn}
                  className="p-1 rounded hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#172554] cursor-pointer"
                  title="Zoom In"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleZoomOut}
                  className="p-1 rounded hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#172554] cursor-pointer"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="text-[10px] px-1 font-mono text-[#64748B]">
                  {Math.round(zoomLevel * 100)}%
                </span>
                <button
                  onClick={handleResetView}
                  className="p-1 rounded hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#172554] cursor-pointer"
                  title="Fit to Screen"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* SVG Interactive Canvas */}
            <div
              ref={svgContainerRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              className={`flex-1 relative overflow-hidden bg-[#FAFAFA] select-none ${
                isDragging ? 'cursor-grabbing' : 'cursor-grab'
              }`}
            >
              <svg
                width="100%"
                height="100%"
                viewBox={`0 0 ${layout.width} ${layout.height}`}
                className="w-full h-full min-h-[500px]"
                style={{
                  transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`,
                  transformOrigin: 'top left',
                  transition: isDragging ? 'none' : 'transform 0.15s ease-out',
                }}
              >
                {/* Defs for arrow markers */}
                <defs>
                  <marker
                    id="arrow-generic"
                    viewBox="0 0 10 10"
                    refX="8"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#94A3B8" />
                  </marker>
                  <marker
                    id="arrow-supported"
                    viewBox="0 0 10 10"
                    refX="8"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#15803D" />
                  </marker>
                  <marker
                    id="arrow-active"
                    viewBox="0 0 10 10"
                    refX="8"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#6D28D9" />
                  </marker>
                </defs>

                {/* Relationship Edges */}
                {graphData.edges.map((edge) => {
                  const sourcePos = layout.posMap?.get(edge.source);
                  const targetPos = layout.posMap?.get(edge.target);
                  if (!sourcePos || !targetPos) return null;

                  const isConnected = connectedEdgeIds.has(edge.id);
                  const isSupported = edge.relationship === 'SUPPORTED_BY';

                  // Cubic bezier curve path
                  const dx = targetPos.x - sourcePos.x;
                  const c1x = sourcePos.x + dx * 0.45;
                  const c2x = targetPos.x - dx * 0.45;
                  const pathD = `M ${sourcePos.x + 80} ${sourcePos.y} C ${c1x} ${sourcePos.y}, ${c2x} ${targetPos.y}, ${targetPos.x - 80} ${targetPos.y}`;

                  let strokeColor = '#CBD5E1';
                  let marker = 'url(#arrow-generic)';
                  if (isConnected) {
                    strokeColor = '#6D28D9';
                    marker = 'url(#arrow-active)';
                  } else if (isSupported) {
                    strokeColor = '#86EFAC';
                    marker = 'url(#arrow-supported)';
                  }

                  return (
                    <g key={edge.id} className="transition-all">
                      <path
                        d={pathD}
                        fill="none"
                        stroke={strokeColor}
                        strokeWidth={isConnected ? 2.5 : 1.5}
                        strokeDasharray={edge.relationship === 'PARTIALLY_SUPPORTED_BY' ? '4,4' : undefined}
                        markerEnd={marker}
                      />
                    </g>
                  );
                })}

                {/* Graph Nodes */}
                {layout.nodesWithPos.map((node) => {
                  const isSelected = selectedNodeId === node.id;
                  const pos = node.pos;

                  return (
                    <g
                      key={node.id}
                      transform={`translate(${pos.x - 75}, ${pos.y - 32})`}
                      onClick={() => setSelectedNodeId(node.id)}
                      className="cursor-pointer transition-transform hover:scale-105"
                    >
                      {/* Node Box */}
                      <rect
                        width={150}
                        height={64}
                        rx={10}
                        className={`transition-colors ${
                          isSelected
                            ? 'fill-white stroke-[#6D28D9] stroke-[2.5px] filter drop-shadow-md'
                            : node.type === 'question'
                            ? 'fill-[#F5F3FF] stroke-[#DDD6FE] stroke-1'
                            : node.type === 'page'
                            ? 'fill-[#EFF6FF] stroke-[#BFDBFE] stroke-1'
                            : node.status === 'supported'
                            ? 'fill-[#F0FDF4] stroke-[#86EFAC] stroke-1'
                            : node.status === 'contradicted'
                            ? 'fill-[#FEF2F2] stroke-[#FCA5A5] stroke-1'
                            : 'fill-white stroke-[#E2E8F0] stroke-1'
                        }`}
                      />

                      {/* Header label & type */}
                      <text
                        x={10}
                        y={20}
                        className="text-[9px] font-bold uppercase tracking-wider fill-[#64748B]"
                      >
                        {node.type.toUpperCase()}
                      </text>

                      {/* Main node snippet */}
                      <text
                        x={10}
                        y={38}
                        className="text-[11px] font-semibold fill-[#172554]"
                        clipPath={`url(#clip-${node.id})`}
                      >
                        {node.label}
                      </text>

                      {/* Sub-label / status pill */}
                      <text
                        x={10}
                        y={52}
                        className={`text-[9px] font-medium ${
                          node.status === 'supported'
                            ? 'fill-[#15803D]'
                            : node.status === 'contradicted'
                            ? 'fill-[#DC2626]'
                            : 'fill-[#64748B]'
                        }`}
                      >
                        {node.type === 'page'
                          ? `PDF Page ${node.pageNumber}`
                          : node.status
                          ? node.status.replace('_', ' ')
                          : node.text.slice(0, 18) + '...'}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>

          {/* D. Evidence Details Side Panel */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-[#F1F5F9]">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#6D28D9]" />
                  <h3 className="text-xs font-bold text-[#172554] tracking-tight">
                    Evidence Inspection Details
                  </h3>
                </div>
                {selectedNode && (
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-[#F1F5F9] text-[#64748B]">
                    {selectedNode.type}
                  </span>
                )}
              </div>

              {selectedNode ? (
                <div className="mt-4 space-y-4">
                  {/* Node Status & Title */}
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-xs font-bold text-[#172554]">
                        {selectedNode.label}
                      </span>
                      {selectedNode.status && getStatusBadge(selectedNode.status)}
                    </div>
                    <p className="text-xs text-[#334155] leading-relaxed bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-3 font-medium">
                      "{selectedNode.text}"
                    </p>
                  </div>

                  {/* Verification Explanation */}
                  {selectedNode.metadata?.explanation && (
                    <div className="bg-[#F5F3FF] border border-[#EDE9FE] rounded-lg p-3 text-xs text-[#6D28D9]">
                      <div className="flex items-center gap-1.5 font-bold mb-1">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Evidence Grounding Rationale</span>
                      </div>
                      <p className="leading-relaxed">
                        {selectedNode.metadata.explanation}
                      </p>
                    </div>
                  )}

                  {/* Page Citation Badge */}
                  {selectedNode.pageNumber && (
                    <div className="flex items-center justify-between p-3 rounded-lg bg-[#EFF6FF] border border-[#DBEAFE] text-xs text-[#1D4ED8]">
                      <div className="flex items-center gap-1.5 font-semibold">
                        <FileText className="w-4 h-4 text-[#2563EB]" />
                        <span>Source Document Page: {selectedNode.pageNumber}</span>
                      </div>
                      <button
                        onClick={() => {
                          if (selectedDocument && selectedNode.pageNumber) {
                            onOpenViewer(selectedDocument, selectedNode.pageNumber, selectedNode.text);
                          }
                        }}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-[#1D4ED8] hover:underline cursor-pointer"
                      >
                        <span>Open Page</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  {/* Limitations or Ambiguity Note */}
                  <div className="flex items-start gap-2 text-[11px] text-[#64748B] pt-1">
                    <Info className="w-3.5 h-3.5 text-[#94A3B8] shrink-0 mt-0.5" />
                    <span>
                      Claims are verified strictly against the uploaded document's extracted text. Every evidence citation is validated verbatim against source pages.
                    </span>
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center text-xs text-[#94A3B8]">
                  Click on any node in the graph to inspect its evidence passage, claim status, and source page.
                </div>
              )}
            </div>

            {/* Bottom Actions */}
            {selectedNode && (
              <div className="pt-3 border-t border-[#F1F5F9]">
                <button
                  onClick={() => {
                    if (selectedDocument) {
                      const pageNum = selectedNode.pageNumber || 1;
                      onOpenViewer(selectedDocument, pageNum, selectedNode.text);
                    }
                  }}
                  className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-[#172554] hover:bg-[#0F172A] text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Inspect in PDF Document Viewer</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
