import React, { useState, useEffect } from 'react';
import {
  Sliders,
  FileText,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  HelpCircle,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Plus,
  Trash2,
  GitCompare,
  ArrowRight,
  Info,
  ShieldAlert,
  Calendar,
  Layers,
  Sparkles,
  UploadCloud,
  CheckSquare,
  Square,
} from 'lucide-react';
import {
  ClarioDocument,
  DocumentRule,
  SimulationResult,
  SimulationScenario,
  ScenarioComparisonResult,
  EvaluatedCondition,
} from '../../types';
import { AuthUser } from '../../lib/supabase';
import { apiUrl } from '../../lib/api';
import {
  extractDocumentRulesFromPages,
  evaluateAllDocumentRules,
  compareScenarios,
} from '../../lib/decisionSimulator';

interface DecisionSimulatorViewProps {
  documents: ClarioDocument[];
  currentUser: AuthUser;
  initialDocId?: string;
  onOpenViewer: (doc: ClarioDocument, page: number, passage?: string) => void;
  onGoToAuth: () => void;
  onNavigateToMyDocs: () => void;
  onTriggerUpload: () => void;
  isUploading: boolean;
}

export const DecisionSimulatorView: React.FC<DecisionSimulatorViewProps> = ({
  documents,
  currentUser,
  initialDocId,
  onOpenViewer,
  onGoToAuth,
  onNavigateToMyDocs,
  onTriggerUpload,
  isUploading,
}) => {
  // 1. Document Selection State
  const [selectedDocId, setSelectedDocId] = useState<string>(
    initialDocId || (documents.length > 0 ? documents[0].id : '')
  );

  const selectedDocument =
    documents.find((d) => d.id === selectedDocId) || (documents.length > 0 ? documents[0] : null);

  // 2. Rule Extraction State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [rules, setRules] = useState<DocumentRule[]>([]);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'simulator' | 'rules' | 'compare'>('simulator');

  // 3. Scenario & Simulation State
  const [scenarios, setScenarios] = useState<SimulationScenario[]>([
    {
      id: 'scenario-1',
      name: 'Scenario A (Baseline)',
      inputs: {},
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'scenario-2',
      name: 'Scenario B (Alternative)',
      inputs: {},
      updatedAt: new Date().toISOString(),
    },
  ]);
  const [activeScenarioId, setActiveScenarioId] = useState<string>('scenario-1');
  const [isSimulating, setIsSimulating] = useState(false);

  // Active scenario reference
  const activeScenario =
    scenarios.find((s) => s.id === activeScenarioId) || scenarios[0];

  // Sync selectedDocId if initialDocId changes
  useEffect(() => {
    if (initialDocId) {
      setSelectedDocId(initialDocId);
    } else if (!selectedDocId && documents.length > 0) {
      setSelectedDocId(documents[0].id);
    }
  }, [initialDocId, documents]);

  // Reset rules on document change if switching
  useEffect(() => {
    setRules([]);
    setHasAnalyzed(false);
    setAnalysisError(null);
  }, [selectedDocId]);

  // Handle Document Rule Extraction
  const handleAnalyzeRules = async () => {
    if (!selectedDocument) return;

    setIsAnalyzing(true);
    setAnalysisError(null);

    try {
      // First attempt backend endpoint
      const response = await fetch(apiUrl('/api/documents/decision-rules'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: selectedDocument.id,
          title: selectedDocument.title,
          filename: selectedDocument.filename,
          pages: selectedDocument.pages,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.isScanned && data.ocrRequired) {
          setAnalysisError(
            data.error ||
              'This document appears to be a scanned image-only PDF and requires active OCR to extract rules.'
          );
          setRules([]);
          setHasAnalyzed(true);
          return;
        }

        if (Array.isArray(data.rules) && data.rules.length > 0) {
          setRules(data.rules);
          setHasAnalyzed(true);
          initializeScenarioDefaults(data.rules);
          return;
        }
      }

      // High-precision client-side extraction fallback
      if (selectedDocument.pages && selectedDocument.pages.length > 0) {
        const extracted = extractDocumentRulesFromPages(
          selectedDocument.pages,
          selectedDocument.title
        );
        setRules(extracted);
        setHasAnalyzed(true);
        initializeScenarioDefaults(extracted);
      } else {
        setAnalysisError('No readable pages or text found in this document.');
        setRules([]);
        setHasAnalyzed(true);
      }
    } catch (err: any) {
      console.warn('[Decision Simulator] Rule extraction notice, running local extractor:', err);
      if (selectedDocument.pages && selectedDocument.pages.length > 0) {
        const extracted = extractDocumentRulesFromPages(
          selectedDocument.pages,
          selectedDocument.title
        );
        setRules(extracted);
        setHasAnalyzed(true);
        initializeScenarioDefaults(extracted);
      } else {
        setAnalysisError(err?.message || 'Failed to extract rules from document.');
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Helper to prefill reasonable empty state for inputs based on rules
  const initializeScenarioDefaults = (extractedRules: DocumentRule[]) => {
    setScenarios((prev) =>
      prev.map((sc) => {
        const updatedInputs = { ...sc.inputs };
        for (const r of extractedRules) {
          if (updatedInputs[r.fieldId] === undefined) {
            if (r.ruleType === 'document_checklist') {
              updatedInputs[r.fieldId] = [];
            } else if (r.ruleType === 'boolean') {
              updatedInputs[r.fieldId] = false;
            } else if (r.ruleType === 'category' && r.allowedCategories && r.allowedCategories.length > 0) {
              updatedInputs[r.fieldId] = r.allowedCategories[0];
            } else {
              updatedInputs[r.fieldId] = '';
            }
          }
        }
        return {
          ...sc,
          inputs: updatedInputs,
          result: undefined,
        };
      })
    );
  };

  // Handle Input Changes for Active Scenario
  const handleInputChange = (fieldId: string, value: any) => {
    setScenarios((prev) =>
      prev.map((s) =>
        s.id === activeScenarioId
          ? {
              ...s,
              inputs: { ...s.inputs, [fieldId]: value },
              updatedAt: new Date().toISOString(),
            }
          : s
      )
    );
  };

  // Preset filler for easy testing
  const handleApplyPreset = (presetType: 'satisfy_income' | 'boundary_income' | 'exceed_income') => {
    if (!activeScenario) return;
    const incomeRule = rules.find((r) => r.fieldId === 'family_income');
    const marksRule = rules.find((r) => r.fieldId === 'academic_marks_percentage');
    const deadlineRule = rules.find((r) => r.fieldId === 'application_date');

    const newInputs = { ...activeScenario.inputs };

    if (incomeRule) {
      const thresh = Number(incomeRule.requiredValue) || 250000;
      if (presetType === 'satisfy_income') {
        newInputs[incomeRule.fieldId] = thresh - 50000;
      } else if (presetType === 'boundary_income') {
        newInputs[incomeRule.fieldId] = thresh; // Boundary test!
      } else if (presetType === 'exceed_income') {
        newInputs[incomeRule.fieldId] = thresh + 50000;
      }
    }

    if (marksRule) {
      newInputs[marksRule.fieldId] = 75;
    }
    if (deadlineRule && deadlineRule.requiredValue) {
      newInputs[deadlineRule.fieldId] = deadlineRule.requiredValue;
    }

    setScenarios((prev) =>
      prev.map((s) => (s.id === activeScenarioId ? { ...s, inputs: newInputs } : s))
    );
  };

  // Run Simulation for Active Scenario
  const handleRunSimulation = async () => {
    if (!selectedDocument || rules.length === 0) return;

    setIsSimulating(true);

    try {
      // Execute safe deterministic evaluation
      const result = evaluateAllDocumentRules(
        selectedDocument.id,
        selectedDocument.title,
        rules,
        activeScenario.inputs,
        activeScenario.selectedCategory
      );

      setScenarios((prev) =>
        prev.map((s) =>
          s.id === activeScenarioId
            ? {
                ...s,
                result,
                updatedAt: new Date().toISOString(),
              }
            : s
        )
      );
    } catch (err) {
      console.error('[Decision Simulator] Simulation error:', err);
    } finally {
      setIsSimulating(false);
    }
  };

  // Scenario Management
  const handleAddScenario = () => {
    const nextNum = scenarios.length + 1;
    const char = String.fromCharCode(64 + nextNum);
    const newSc: SimulationScenario = {
      id: `scenario-${Date.now()}`,
      name: `Scenario ${char}`,
      inputs: { ...(activeScenario?.inputs || {}) },
      updatedAt: new Date().toISOString(),
    };
    setScenarios((prev) => [...prev, newSc]);
    setActiveScenarioId(newSc.id);
  };

  const handleDeleteScenario = (id: string) => {
    if (scenarios.length <= 1) return;
    const remaining = scenarios.filter((s) => s.id !== id);
    setScenarios(remaining);
    if (activeScenarioId === id) {
      setActiveScenarioId(remaining[0].id);
    }
  };

  // Compute Scenario Comparison
  const getComparisonDiff = (): ScenarioComparisonResult | null => {
    if (scenarios.length < 2 || rules.length === 0) return null;
    return compareScenarios(scenarios[0], scenarios[1], rules);
  };

  const comparisonDiff = getComparisonDiff();

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* 1. Header & Context */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <div className="w-9 h-9 rounded-xl bg-[#F5F3FF] text-[#6D28D9] flex items-center justify-center">
                <Sliders className="w-5 h-5 stroke-[2.2]" />
              </div>
              <h1 className="text-xl font-bold text-[#172554] tracking-tight">
                Document Decision Simulator
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#F5F3FF] text-[#6D28D9] border border-[#EDE9FE]">
                Deterministic Engine
              </span>
            </div>
            <p className="text-xs text-[#64748B] max-w-2xl leading-relaxed">
              Interact with the actual rules, financial thresholds, eligibility criteria, and deadlines extracted from your uploaded PDF. Explore how changing your inputs impacts outcomes with traceable citations to exact source pages.
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('simulator')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === 'simulator'
                  ? 'bg-[#6D28D9] text-white shadow-xs'
                  : 'bg-[#F8FAFC] text-[#64748B] hover:text-[#172554] border border-[#E2E8F0]'
              }`}
            >
              Simulator & Results
            </button>
            <button
              onClick={() => setActiveTab('rules')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === 'rules'
                  ? 'bg-[#6D28D9] text-white shadow-xs'
                  : 'bg-[#F8FAFC] text-[#64748B] hover:text-[#172554] border border-[#E2E8F0]'
              }`}
            >
              Extracted Rules ({rules.length})
            </button>
            <button
              onClick={() => setActiveTab('compare')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === 'compare'
                  ? 'bg-[#6D28D9] text-white shadow-xs'
                  : 'bg-[#F8FAFC] text-[#64748B] hover:text-[#172554] border border-[#E2E8F0]'
              }`}
            >
              Compare Scenarios
            </button>
          </div>
        </div>

        {/* Document Selection Toolbar */}
        <div className="mt-6 pt-5 border-t border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-xs font-semibold text-[#172554] whitespace-nowrap">
              Active Document:
            </label>
            {documents.length > 0 ? (
              <select
                value={selectedDocId}
                onChange={(e) => setSelectedDocId(e.target.value)}
                className="bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg px-3 py-1.5 text-xs text-[#172554] font-medium focus:outline-hidden focus:ring-2 focus:ring-[#6D28D9]/20 focus:border-[#6D28D9] cursor-pointer min-w-56"
              >
                {documents.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.title || doc.filename} ({doc.pageCount || doc.pages?.length || 1} pages)
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-xs text-[#DC2626] font-medium">
                No documents uploaded yet.
              </span>
            )}

            {selectedDocument && (
              <div className="flex items-center gap-2 text-[11px] text-[#64748B]">
                <span className="px-2 py-0.5 rounded bg-[#F1F5F9] font-mono text-[#334155]">
                  {selectedDocument.filename}
                </span>
                <span>•</span>
                <span>{selectedDocument.pageCount || selectedDocument.pages?.length || 0} Pages</span>
                <span>•</span>
                <span className="capitalize font-semibold text-[#15803D]">
                  {selectedDocument.processingStatus}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            {documents.length === 0 ? (
              <button
                onClick={onTriggerUpload}
                disabled={isUploading}
                className="px-4 py-2 rounded-lg bg-[#6D28D9] hover:bg-[#5B21B6] text-white text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
              >
                <UploadCloud className="w-4 h-4" />
                <span>Upload PDF Document</span>
              </button>
            ) : (
              <button
                onClick={handleAnalyzeRules}
                disabled={isAnalyzing || !selectedDocument}
                className="px-4 py-2 rounded-lg bg-[#6D28D9] hover:bg-[#5B21B6] text-white text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
              >
                {isAnalyzing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Analyzing Document Rules...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Analyze Document Rules</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Analysis Error / Scanned Document Notice */}
      {analysisError && (
        <div className="bg-[#FEF2F2] border border-[#FEE2E2] rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-[#DC2626] shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-xs font-bold text-[#991B1B]">Rule Extraction Notice</h4>
            <p className="text-xs text-[#DC2626] mt-0.5 leading-relaxed">{analysisError}</p>
          </div>
        </div>
      )}

      {/* Empty State before Analysis */}
      {!hasAnalyzed && !isAnalyzing && documents.length > 0 && (
        <div className="bg-white rounded-2xl border border-dashed border-[#CBD5E1] p-12 text-center">
          <div className="w-12 h-12 rounded-2xl bg-[#F5F3FF] text-[#6D28D9] flex items-center justify-center mx-auto mb-3">
            <Sliders className="w-6 h-6 stroke-[2]" />
          </div>
          <h3 className="text-sm font-bold text-[#172554]">
            Ready to Simulate Document Rules
          </h3>
          <p className="text-xs text-[#64748B] max-w-md mx-auto mt-1 mb-5">
            Click <strong>"Analyze Document Rules"</strong> to parse explicit thresholds, academic requirements, cutoff deadlines, and required documents from <strong>{selectedDocument?.title || 'the selected PDF'}</strong>.
          </p>
          <button
            onClick={handleAnalyzeRules}
            className="px-5 py-2.5 rounded-lg bg-[#6D28D9] hover:bg-[#5B21B6] text-white text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer shadow-xs"
          >
            <Sparkles className="w-4 h-4" />
            <span>Analyze Document Rules</span>
          </button>
        </div>
      )}

      {/* Main Content when Rules are Analyzed */}
      {hasAnalyzed && rules.length > 0 && (
        <>
          {/* TAB 1: SIMULATOR & RESULTS */}
          {activeTab === 'simulator' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Dynamic Input Form (5 cols) */}
              <div className="lg:col-span-5 space-y-5">
                <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 shadow-xs">
                  {/* Scenario Switcher Toolbar */}
                  <div className="flex items-center justify-between pb-4 border-b border-[#E2E8F0] mb-4">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-[#172554]">Active Scenario:</span>
                      <select
                        value={activeScenarioId}
                        onChange={(e) => setActiveScenarioId(e.target.value)}
                        className="bg-[#F8FAFC] border border-[#CBD5E1] rounded-md px-2 py-1 text-xs font-medium text-[#172554] cursor-pointer"
                      >
                        {scenarios.map((sc) => (
                          <option key={sc.id} value={sc.id}>
                            {sc.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={handleAddScenario}
                        title="Add New Scenario"
                        className="p-1 rounded-md text-[#6D28D9] hover:bg-[#F5F3FF] transition-colors cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                      {scenarios.length > 1 && (
                        <button
                          onClick={() => handleDeleteScenario(activeScenarioId)}
                          title="Delete Current Scenario"
                          className="p-1 rounded-md text-[#DC2626] hover:bg-[#FEF2F2] transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Sample Test Preset Bar */}
                  <div className="mb-5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3">
                    <span className="text-[11px] font-bold text-[#64748B] block mb-2">
                      Quick Test Presets (Rule Validation):
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        onClick={() => handleApplyPreset('satisfy_income')}
                        className="text-[11px] font-semibold px-2 py-1 rounded-md bg-white border border-[#CBD5E1] text-[#15803D] hover:bg-[#F0FDF4] cursor-pointer"
                      >
                        Under Threshold (Satisfied)
                      </button>
                      <button
                        onClick={() => handleApplyPreset('boundary_income')}
                        className="text-[11px] font-semibold px-2 py-1 rounded-md bg-white border border-[#CBD5E1] text-[#D97706] hover:bg-[#FFFBEB] cursor-pointer"
                      >
                        Exact Boundary (Strict &lt;)
                      </button>
                      <button
                        onClick={() => handleApplyPreset('exceed_income')}
                        className="text-[11px] font-semibold px-2 py-1 rounded-md bg-white border border-[#CBD5E1] text-[#DC2626] hover:bg-[#FEF2F2] cursor-pointer"
                      >
                        Above Limit (Not Satisfied)
                      </button>
                    </div>
                  </div>

                  {/* Dynamic Form Fields */}
                  <h3 className="text-xs font-bold text-[#172554] uppercase tracking-wider mb-4 flex items-center justify-between">
                    <span>Input Conditions</span>
                    <span className="text-[11px] font-normal lowercase text-[#64748B]">
                      derived from {rules.length} document rules
                    </span>
                  </h3>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleRunSimulation();
                    }}
                    className="space-y-4"
                  >
                    {rules.map((rule) => {
                      const curVal = activeScenario.inputs[rule.fieldId];

                      return (
                        <div
                          key={rule.id}
                          className="p-3.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC]/50 hover:bg-[#F8FAFC] transition-colors"
                        >
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <label className="text-xs font-bold text-[#172554]">
                              {rule.fieldLabel}
                            </label>
                            <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-white text-[#6D28D9] border border-[#E2E8F0]">
                              Page {rule.pageNumber}
                            </span>
                          </div>

                          {/* Constraint Hint */}
                          <div className="text-[11px] text-[#64748B] mb-2 flex items-center gap-1">
                            <span>Requirement:</span>
                            <span className="font-semibold text-[#172554]">
                              {rule.operator.replace(/_/g, ' ')} {String(rule.requiredValue)}{' '}
                              {rule.unit || rule.currency || ''}
                            </span>
                          </div>

                          {/* Dynamic Input Control */}
                          {rule.ruleType === 'currency' ||
                          rule.ruleType === 'number' ||
                          rule.ruleType === 'percentage' ? (
                            <div className="relative">
                              {rule.currency && (
                                <span className="absolute left-3 top-2 text-xs font-bold text-[#64748B]">
                                  {rule.currency}
                                </span>
                              )}
                              <input
                                type="number"
                                value={curVal ?? ''}
                                onChange={(e) =>
                                  handleInputChange(rule.fieldId, e.target.value)
                                }
                                placeholder={`Enter ${rule.fieldLabel}`}
                                className={`w-full bg-white border border-[#CBD5E1] rounded-lg text-xs py-2 text-[#172554] font-medium focus:ring-2 focus:ring-[#6D28D9]/20 focus:border-[#6D28D9] ${
                                  rule.currency ? 'pl-8 pr-3' : 'px-3'
                                }`}
                              />
                            </div>
                          ) : rule.ruleType === 'date' ? (
                            <input
                              type="date"
                              value={curVal ?? ''}
                              onChange={(e) =>
                                handleInputChange(rule.fieldId, e.target.value)
                              }
                              className="w-full bg-white border border-[#CBD5E1] rounded-lg text-xs py-2 px-3 text-[#172554] font-medium focus:ring-2 focus:ring-[#6D28D9]/20 focus:border-[#6D28D9]"
                            />
                          ) : rule.ruleType === 'category' ? (
                            <select
                              value={curVal ?? ''}
                              onChange={(e) =>
                                handleInputChange(rule.fieldId, e.target.value)
                              }
                              className="w-full bg-white border border-[#CBD5E1] rounded-lg text-xs py-2 px-3 text-[#172554] font-medium focus:ring-2 focus:ring-[#6D28D9]/20 focus:border-[#6D28D9] cursor-pointer"
                            >
                              <option value="">-- Select Category --</option>
                              {rule.allowedCategories?.map((cat) => (
                                <option key={cat} value={cat}>
                                  {cat}
                                </option>
                              ))}
                              {rule.operator === 'not_in_set' && (
                                <>
                                  <option value="Undergraduate (UG)">Undergraduate (UG)</option>
                                  <option value="Postgraduate (PG)">Postgraduate (PG)</option>
                                  <option value="Doctoral / PhD">Doctoral / PhD (Excluded)</option>
                                  <option value="Distance Learning">Distance Learning (Excluded)</option>
                                </>
                              )}
                            </select>
                          ) : rule.ruleType === 'boolean' ? (
                            <div className="flex items-center gap-4 mt-1">
                              <label className="flex items-center gap-1.5 text-xs text-[#172554] cursor-pointer">
                                <input
                                  type="radio"
                                  name={rule.fieldId}
                                  checked={curVal === true || curVal === 'true'}
                                  onChange={() => handleInputChange(rule.fieldId, true)}
                                  className="text-[#6D28D9] focus:ring-[#6D28D9]"
                                />
                                <span>Yes</span>
                              </label>
                              <label className="flex items-center gap-1.5 text-xs text-[#172554] cursor-pointer">
                                <input
                                  type="radio"
                                  name={rule.fieldId}
                                  checked={curVal === false || curVal === 'false'}
                                  onChange={() => handleInputChange(rule.fieldId, false)}
                                  className="text-[#6D28D9] focus:ring-[#6D28D9]"
                                />
                                <span>No</span>
                              </label>
                            </div>
                          ) : rule.ruleType === 'document_checklist' ? (
                            <div className="space-y-1.5 mt-1 bg-white p-2.5 rounded-lg border border-[#E2E8F0]">
                              {(rule.requiredDocuments || []).map((docItem) => {
                                const checkedList = Array.isArray(curVal) ? curVal : [];
                                const isChecked = checkedList.includes(docItem);
                                return (
                                  <label
                                    key={docItem}
                                    className="flex items-center gap-2 text-xs text-[#172554] cursor-pointer"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={(e) => {
                                        const updated = e.target.checked
                                          ? [...checkedList, docItem]
                                          : checkedList.filter((d: string) => d !== docItem);
                                        handleInputChange(rule.fieldId, updated);
                                      }}
                                      className="rounded text-[#6D28D9] focus:ring-[#6D28D9]"
                                    />
                                    <span>{docItem}</span>
                                  </label>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="p-2 rounded bg-[#FFFBEB] text-[11px] text-[#92400E] border border-[#FEF3C7]">
                              {rule.notes || 'Discretionary / Unstructured rule condition.'}
                            </div>
                          )}

                          {/* Evidence inspection button */}
                          <div className="mt-2 text-right">
                            <button
                              type="button"
                              onClick={() =>
                                selectedDocument &&
                                onOpenViewer(
                                  selectedDocument,
                                  rule.pageNumber,
                                  rule.quotation
                                )
                              }
                              className="text-[11px] text-[#6D28D9] hover:underline inline-flex items-center gap-1 cursor-pointer font-medium"
                            >
                              <span>View Source Quotation</span>
                              <ExternalLink className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    <button
                      type="submit"
                      disabled={isSimulating}
                      className="w-full py-2.5 rounded-xl bg-[#6D28D9] hover:bg-[#5B21B6] text-white text-xs font-bold tracking-wide transition-colors cursor-pointer shadow-md flex items-center justify-center gap-2"
                    >
                      {isSimulating ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Evaluating Rules...</span>
                        </>
                      ) : (
                        <>
                          <Sliders className="w-4 h-4" />
                          <span>Run Simulation ({activeScenario.name})</span>
                        </>
                      )}
                    </button>
                  </form>
                </div>
              </div>

              {/* Right Column: Results Dashboard (7 cols) */}
              <div className="lg:col-span-7 space-y-5">
                {activeScenario.result ? (
                  <div className="space-y-5">
                    {/* Overall Assessment Status Banner */}
                    <div
                      className={`rounded-2xl border p-5 shadow-xs ${
                        activeScenario.result.overallStatus === 'all_satisfied'
                          ? 'bg-[#F0FDF4] border-[#BBF7D0]'
                          : activeScenario.result.overallStatus === 'some_not_satisfied'
                          ? 'bg-[#FEF2F2] border-[#FECDD3]'
                          : activeScenario.result.overallStatus === 'review_required'
                          ? 'bg-[#FFFBEB] border-[#FDE68A]'
                          : 'bg-[#F8FAFC] border-[#E2E8F0]'
                      }`}
                    >
                      <div className="flex items-start gap-3.5">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                            activeScenario.result.overallStatus === 'all_satisfied'
                              ? 'bg-[#15803D] text-white'
                              : activeScenario.result.overallStatus === 'some_not_satisfied'
                              ? 'bg-[#DC2626] text-white'
                              : activeScenario.result.overallStatus === 'review_required'
                              ? 'bg-[#D97706] text-white'
                              : 'bg-[#64748B] text-white'
                          }`}
                        >
                          {activeScenario.result.overallStatus === 'all_satisfied' && (
                            <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
                          )}
                          {activeScenario.result.overallStatus === 'some_not_satisfied' && (
                            <XCircle className="w-5 h-5 stroke-[2.5]" />
                          )}
                          {activeScenario.result.overallStatus === 'review_required' && (
                            <AlertTriangle className="w-5 h-5 stroke-[2.5]" />
                          )}
                          {activeScenario.result.overallStatus === 'insufficient_information' && (
                            <HelpCircle className="w-5 h-5 stroke-[2.5]" />
                          )}
                        </div>

                        <div className="flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="text-sm font-bold text-[#172554] tracking-tight">
                              {activeScenario.result.overallStatus === 'all_satisfied' &&
                                'All Evaluated Conditions Satisfied'}
                              {activeScenario.result.overallStatus === 'some_not_satisfied' &&
                                'Some Conditions Not Satisfied'}
                              {activeScenario.result.overallStatus === 'review_required' &&
                                'Review Required'}
                              {activeScenario.result.overallStatus ===
                                'insufficient_information' && 'Insufficient Information'}
                            </h3>
                            <span className="text-[11px] font-semibold text-[#64748B]">
                              {activeScenario.name}
                            </span>
                          </div>

                          <p className="text-xs text-[#334155] mt-1 leading-relaxed">
                            {activeScenario.result.overallExplanation}
                          </p>

                          {/* Mandatory Disclaimer */}
                          <div className="mt-3 pt-3 border-t border-black/10 flex items-start gap-2 text-[11px] text-[#475569] leading-snug">
                            <Info className="w-3.5 h-3.5 shrink-0 text-[#6D28D9] mt-0.5" />
                            <span>{activeScenario.result.disclaimer}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Metrics Breakdown Pills */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <div className="bg-white border border-[#E2E8F0] p-3 rounded-xl text-center shadow-2xs">
                        <span className="text-lg font-bold text-[#15803D] block">
                          {activeScenario.result.satisfiedCount}
                        </span>
                        <span className="text-[11px] font-medium text-[#64748B]">
                          Satisfied
                        </span>
                      </div>
                      <div className="bg-white border border-[#E2E8F0] p-3 rounded-xl text-center shadow-2xs">
                        <span className="text-lg font-bold text-[#DC2626] block">
                          {activeScenario.result.notSatisfiedCount}
                        </span>
                        <span className="text-[11px] font-medium text-[#64748B]">
                          Not Satisfied
                        </span>
                      </div>
                      <div className="bg-white border border-[#E2E8F0] p-3 rounded-xl text-center shadow-2xs">
                        <span className="text-lg font-bold text-[#D97706] block">
                          {activeScenario.result.needsReviewCount}
                        </span>
                        <span className="text-[11px] font-medium text-[#64748B]">
                          Needs Review
                        </span>
                      </div>
                      <div className="bg-white border border-[#E2E8F0] p-3 rounded-xl text-center shadow-2xs">
                        <span className="text-lg font-bold text-[#64748B] block">
                          {activeScenario.result.missingInputCount}
                        </span>
                        <span className="text-[11px] font-medium text-[#64748B]">
                          Missing Input
                        </span>
                      </div>
                    </div>

                    {/* Condition Cards */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold text-[#172554] uppercase tracking-wider">
                        Evaluated Conditions ({activeScenario.result.evaluatedConditions.length})
                      </h4>

                      {activeScenario.result.evaluatedConditions.map((cond) => {
                        const isPass = cond.status === 'satisfied';
                        const isFail = cond.status === 'not_satisfied';
                        const isReview = cond.status === 'needs_review';
                        const isMissing = cond.status === 'missing_input';

                        return (
                          <div
                            key={cond.ruleId}
                            className="bg-white rounded-xl border border-[#E2E8F0] p-4 shadow-2xs hover:border-[#CBD5E1] transition-all"
                          >
                            <div className="flex items-start justify-between gap-3 mb-2">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                                    isPass
                                      ? 'bg-[#F0FDF4] text-[#15803D] border border-[#DCFCE7]'
                                      : isFail
                                      ? 'bg-[#FEF2F2] text-[#DC2626] border border-[#FEE2E2]'
                                      : isReview
                                      ? 'bg-[#FFFBEB] text-[#D97706] border border-[#FEF3C7]'
                                      : 'bg-[#F1F5F9] text-[#64748B] border border-[#E2E8F0]'
                                  }`}
                                >
                                  {cond.status.replace(/_/g, ' ')}
                                </span>
                                <h5 className="text-xs font-bold text-[#172554]">
                                  {cond.ruleName}
                                </h5>
                              </div>

                              <button
                                onClick={() =>
                                  selectedDocument &&
                                  onOpenViewer(
                                    selectedDocument,
                                    cond.pageNumber,
                                    cond.quotation
                                  )
                                }
                                className="px-2.5 py-1 rounded-md bg-[#F5F3FF] hover:bg-[#EDE9FE] text-[#6D28D9] text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                              >
                                <span>Page {cond.pageNumber}</span>
                                <ExternalLink className="w-3 h-3" />
                              </button>
                            </div>

                            {/* User Value vs Required Value comparison */}
                            <div className="grid grid-cols-2 gap-2 my-2.5 p-2 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-xs">
                              <div>
                                <span className="text-[10px] text-[#64748B] block font-medium">
                                  Your Entered Input:
                                </span>
                                <span className="font-semibold text-[#172554]">
                                  {cond.userValue !== null && cond.userValue !== undefined
                                    ? String(cond.userValue)
                                    : 'None provided'}
                                </span>
                              </div>
                              <div>
                                <span className="text-[10px] text-[#64748B] block font-medium">
                                  Required Document Condition:
                                </span>
                                <span className="font-semibold text-[#6D28D9]">
                                  {cond.requiredValueDisplay}
                                </span>
                              </div>
                            </div>

                            {/* Explanation */}
                            <p className="text-xs text-[#334155] leading-relaxed mb-3">
                              {cond.explanation}
                            </p>

                            {/* Source Quotation Evidence Block */}
                            <div className="p-2.5 rounded-lg bg-[#F5F3FF]/40 border border-[#EDE9FE] text-xs">
                              <span className="text-[10px] font-bold text-[#6D28D9] uppercase tracking-wider block mb-1">
                                Exact Source Evidence (Page {cond.pageNumber}):
                              </span>
                              <blockquote className="italic text-[#172554] border-l-2 border-[#6D28D9] pl-2.5 py-0.5">
                                "{cond.quotation}"
                              </blockquote>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl border border-dashed border-[#CBD5E1] p-12 text-center">
                    <div className="w-10 h-10 rounded-xl bg-[#F5F3FF] text-[#6D28D9] flex items-center justify-center mx-auto mb-3">
                      <HelpCircle className="w-5 h-5 stroke-[2]" />
                    </div>
                    <h4 className="text-sm font-bold text-[#172554]">
                      Simulation Pending
                    </h4>
                    <p className="text-xs text-[#64748B] max-w-sm mx-auto mt-1 mb-4">
                      Fill in sample values on the left or select a quick test preset, then click <strong>"Run Simulation"</strong> to evaluate each condition deterministically against the document rules.
                    </p>
                    <button
                      onClick={handleRunSimulation}
                      className="px-4 py-2 rounded-lg bg-[#6D28D9] hover:bg-[#5B21B6] text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <span>Run Simulation Now</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: EXTRACTED RULES REVIEW */}
          {activeTab === 'rules' && (
            <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
                <div>
                  <h3 className="text-sm font-bold text-[#172554]">
                    Extracted Document Rules & Conditions
                  </h3>
                  <p className="text-xs text-[#64748B]">
                    Explicit eligibility criteria extracted from {selectedDocument?.title || 'the document'}.
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#F5F3FF] text-[#6D28D9] border border-[#EDE9FE]">
                  {rules.length} Rules Grounded
                </span>
              </div>

              <div className="space-y-3">
                {rules.map((rule, idx) => (
                  <div
                    key={rule.id}
                    className="p-4 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC]/40 hover:bg-[#F8FAFC] transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-md bg-[#6D28D9] text-white text-xs font-bold flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <div>
                          <h4 className="text-xs font-bold text-[#172554]">
                            {rule.ruleName}
                          </h4>
                          <span className="text-[10px] text-[#64748B]">
                            Field Identifier: <code className="font-mono text-[#6D28D9]">{rule.fieldId}</code>
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            rule.status === 'clear'
                              ? 'bg-[#F0FDF4] text-[#15803D] border-[#DCFCE7]'
                              : 'bg-[#FFFBEB] text-[#D97706] border-[#FEF3C7]'
                          }`}
                        >
                          {rule.status === 'clear' ? 'Verified Rule' : 'Requires Review'}
                        </span>
                        <button
                          onClick={() =>
                            selectedDocument &&
                            onOpenViewer(selectedDocument, rule.pageNumber, rule.quotation)
                          }
                          className="px-2.5 py-1 rounded-md bg-white border border-[#CBD5E1] text-[#172554] text-[11px] font-semibold flex items-center gap-1 hover:bg-[#F1F5F9] cursor-pointer"
                        >
                          <span>Page {rule.pageNumber}</span>
                          <ExternalLink className="w-3 h-3 text-[#6D28D9]" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-2.5 rounded-lg bg-white border border-[#E2E8F0] my-2 text-xs">
                      <div>
                        <span className="text-[10px] text-[#64748B] block">Rule Type:</span>
                        <span className="font-semibold text-[#172554] capitalize">
                          {rule.ruleType}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#64748B] block">Operator:</span>
                        <span className="font-mono font-semibold text-[#6D28D9]">
                          {rule.operator}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#64748B] block">Threshold / Target:</span>
                        <span className="font-semibold text-[#172554]">
                          {rule.currency ? `${rule.currency} ` : ''}
                          {Array.isArray(rule.requiredValue)
                            ? rule.requiredValue.join(', ')
                            : String(rule.requiredValue)}
                          {rule.unit ? ` ${rule.unit}` : ''}
                        </span>
                      </div>
                    </div>

                    {/* Quotation */}
                    <div className="mt-2 text-xs">
                      <span className="text-[10px] font-bold text-[#6D28D9] block mb-1">
                        Original Document Quotation:
                      </span>
                      <blockquote className="italic text-[#334155] border-l-2 border-[#6D28D9] pl-2.5 py-0.5">
                        "{rule.quotation}"
                      </blockquote>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: COMPARE SCENARIOS (WHAT-IF SIMULATION) */}
          {activeTab === 'compare' && (
            <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6 shadow-xs space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#E2E8F0]">
                <div>
                  <h3 className="text-sm font-bold text-[#172554] flex items-center gap-2">
                    <GitCompare className="w-4 h-4 text-[#6D28D9]" />
                    <span>What-If Scenario Comparison</span>
                  </h3>
                  <p className="text-xs text-[#64748B]">
                    Evaluate how changing your inputs across two scenarios shifts rule outcomes.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-[#64748B]">
                    {scenarios[0]?.name || 'Scenario A'} vs {scenarios[1]?.name || 'Scenario B'}
                  </span>
                </div>
              </div>

              {comparisonDiff && (
                <div className="space-y-4">
                  {/* Summary Bar */}
                  <div className="p-3.5 rounded-xl bg-[#F5F3FF] border border-[#EDE9FE] flex items-center justify-between text-xs">
                    <span className="font-bold text-[#6D28D9]">
                      {comparisonDiff.summary}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-white text-[#172554] border border-[#CBD5E1]">
                      {comparisonDiff.changedConditionsCount} Changes Detected
                    </span>
                  </div>

                  {/* Diff Table / Cards */}
                  <div className="space-y-3">
                    {comparisonDiff.diffs.map((diff) => (
                      <div
                        key={diff.ruleId}
                        className={`p-4 rounded-xl border transition-all ${
                          diff.hasChanged
                            ? 'bg-[#FEF2F2]/30 border-[#FECDD3]'
                            : 'bg-white border-[#E2E8F0]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                                diff.hasChanged ? 'bg-[#DC2626]' : 'bg-[#15803D]'
                              }`}
                            />
                            <h5 className="text-xs font-bold text-[#172554]">
                              {diff.ruleName}
                            </h5>
                          </div>

                          <button
                            onClick={() =>
                              selectedDocument &&
                              onOpenViewer(selectedDocument, diff.pageNumber, diff.quotation)
                            }
                            className="text-[11px] font-semibold text-[#6D28D9] hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <span>Page {diff.pageNumber}</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Scenario Values Comparison */}
                        <div className="grid grid-cols-2 gap-3 my-2 text-xs">
                          <div className="p-2.5 rounded-lg bg-white border border-[#E2E8F0]">
                            <span className="text-[10px] font-bold text-[#64748B] block">
                              {scenarios[0]?.name}:
                            </span>
                            <div className="flex items-center justify-between mt-1">
                              <span className="font-semibold text-[#172554]">
                                {diff.scenarioAValue !== undefined && diff.scenarioAValue !== null
                                  ? String(diff.scenarioAValue)
                                  : 'None'}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                                  diff.scenarioAStatus === 'satisfied'
                                    ? 'bg-[#F0FDF4] text-[#15803D]'
                                    : 'bg-[#FEF2F2] text-[#DC2626]'
                                }`}
                              >
                                {diff.scenarioAStatus.replace('_', ' ')}
                              </span>
                            </div>
                          </div>

                          <div className="p-2.5 rounded-lg bg-white border border-[#E2E8F0]">
                            <span className="text-[10px] font-bold text-[#64748B] block">
                              {scenarios[1]?.name}:
                            </span>
                            <div className="flex items-center justify-between mt-1">
                              <span className="font-semibold text-[#172554]">
                                {diff.scenarioBValue !== undefined && diff.scenarioBValue !== null
                                  ? String(diff.scenarioBValue)
                                  : 'None'}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                                  diff.scenarioBStatus === 'satisfied'
                                    ? 'bg-[#F0FDF4] text-[#15803D]'
                                    : 'bg-[#FEF2F2] text-[#DC2626]'
                                }`}
                              >
                                {diff.scenarioBStatus.replace('_', ' ')}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Difference Explanation */}
                        <p className="text-xs text-[#334155] leading-relaxed">
                          {diff.differenceExplanation}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};
