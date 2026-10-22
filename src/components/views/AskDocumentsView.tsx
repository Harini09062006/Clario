import React, { useState, useRef } from 'react';
import {
  Sparkles,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  FileText,
  Clock,
  ShieldCheck,
  CornerDownLeft,
  Copy,
  Check,
  ChevronDown,
  Upload,
  Loader2,
  Mic,
  Square,
  Volume2,
  StopCircle,
} from 'lucide-react';
import { ClarioDocument, QuestionAnswer, Language } from '../../types';
import { AuthUser } from '../../lib/supabase';
import { GuestSignInPrompt } from '../GuestSignInPrompt';

interface AskDocumentsViewProps {
  document: ClarioDocument | null;
  currentUser: AuthUser;
  answerLanguage: Language;
  onOpenViewer: (doc: ClarioDocument, page: number, passage?: string) => void;
  onNavigateToMyDocs: () => void;
  onGoToAuth: () => void;
  onTriggerUpload?: () => void;
  isUploading?: boolean;
}

export const AskDocumentsView: React.FC<AskDocumentsViewProps> = ({
  document,
  currentUser,
  answerLanguage,
  onOpenViewer,
  onNavigateToMyDocs,
  onGoToAuth,
  onTriggerUpload,
  isUploading = false,
}) => {
  const [questionText, setQuestionText] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [currentAnswer, setCurrentAnswer] = useState<QuestionAnswer | null>(null);
  const [history, setHistory] = useState<QuestionAnswer[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedAnswer, setCopiedAnswer] = useState(false);
  
  // Voice interaction states
  const [isRecording, setIsRecording] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const startRecording = async () => {
    setErrorMsg(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      
      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64Audio = reader.result as string;
          try {
            const res = await fetch('/api/voice/stt', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ audio: base64Audio, language: answerLanguage }),
            });
            const data = await res.json();
            if (data.text) setQuestionText(data.text);
            else setErrorMsg('Transcription failed.');
          } catch (e) {
            setErrorMsg('Speech recognition failed.');
          }
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.start();
      setIsRecording(true);
      setErrorMsg(null);
    } catch (err: any) {
      console.error('Microphone error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        const isIframe = window.self !== window.top;
        const msg = isIframe
          ? 'Microphone access is blocked by the preview window. Please open the app in a new tab: https://ais-dev-oa6v6u4wgh7jjtf3tdt5lq-60569947795.asia-southeast1.run.app'
          : 'Microphone access denied. Please enable microphone permissions in your browser settings.';
        setErrorMsg(msg);
      } else if (err.name === 'NotFoundError') {
        setErrorMsg('No microphone found.');
      } else {
        setErrorMsg(`Microphone error: ${err.message || 'Permission denied'}`);
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };


  const handleTTS = async (text: string, answerId: string) => {
    // Toggle off if already playing this answer
    if (isPlayingAudio === answerId) {
      audioRef.current?.pause();
      window.speechSynthesis?.cancel();
      setIsPlayingAudio(null);
      return;
    }

    try {
      console.log(`[TTS_FRONTEND] Full text to be synthesized: "${text}"`);
      const res = await fetch('/api/voice/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, language: answerLanguage }),
      });
      const data = await res.json();

      if (res.ok && data.audioUrl) {
        // ── Primary path: VerbX TTS returned audio ────────────────────────
        if (!audioRef.current) audioRef.current = new Audio();
        audioRef.current.src = data.audioUrl;
        audioRef.current.onended = () => setIsPlayingAudio(null);
        audioRef.current.play();
        setIsPlayingAudio(answerId);
      } else if (res.status === 503 && typeof window !== 'undefined' && window.speechSynthesis) {
        // ── Fallback: VerbX not configured — use browser Web Speech API ───
        console.warn('[TTS_FRONTEND] VerbX TTS not configured. Using browser Web Speech API fallback.');
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);

        // Map Clario language names to BCP-47 tags for best voice matching
        const langMap: Record<string, string> = {
          English: 'en-IN', Tamil: 'ta-IN', Hindi: 'hi-IN', Telugu: 'te-IN',
          Kannada: 'kn-IN', Bengali: 'bn-IN', Marathi: 'mr-IN',
          Gujarati: 'gu-IN', Malayalam: 'ml-IN',
        };
        utterance.lang = langMap[answerLanguage] || 'en-IN';
        utterance.rate = 0.95;
        utterance.pitch = 1;

        utterance.onstart = () => setIsPlayingAudio(answerId);
        utterance.onend = () => setIsPlayingAudio(null);
        utterance.onerror = () => setIsPlayingAudio(null);

        window.speechSynthesis.speak(utterance);
        setIsPlayingAudio(answerId);
      } else {
        setErrorMsg(`Audio generation failed: ${data.error || 'Unknown error'}`);
      }
    } catch (e: any) {
      setErrorMsg(`Text-to-speech failed: ${e.message || 'Network error'}`);
    }
  };
  
  // ... Rest of the component ...
  // Need to update handleAskQuestion etc. if they relied on the voice interaction code.
  // Actually, the previous implementation relied on 'mediaRecorderRef' and 'audioRef' which I am removing or replacing.
  // The existing 'handleAskQuestion' doesn't seem to rely on voice directly, only 'setQuestionText'.
  // I need to ensure the button handlers correctly call the new 'startRecording'/'stopRecording'/'handleTTS' functions.
  // The original implementation had handlers at lines 60-123. I should replace those.


  // EMPTY DOCUMENT STATE (when no document is selected / available):
  if (!document) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-[#172554] tracking-tight mb-1">
              Ask Documents
            </h2>
            <p className="text-xs text-[#64748B]">
              Source-grounded questions with exact page citations.
            </p>
          </div>
          {onTriggerUpload && (
            <button
              onClick={onTriggerUpload}
              disabled={isUploading}
              className="px-3.5 py-2 bg-[#6D28D9] hover:bg-[#5B21B6] disabled:opacity-60 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer flex items-center gap-1.5 self-start sm:self-auto"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Processing PDF...</span>
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload PDF to Ask</span>
                </>
              )}
            </button>
          )}
        </div>

        {currentUser.isGuest && (
          <div className="bg-[#FFFBEB] border border-[#FEF3C7] rounded-xl p-4 flex items-start gap-3">
            <Sparkles className="w-4 h-4 text-[#D97706] shrink-0 mt-0.5" />
            <div className="text-xs text-[#92400E] leading-relaxed">
              <strong className="font-semibold">Guest Mode Active:</strong> You can upload PDFs, ask grounded questions, inspect verbatim citations, and use voice features without an account. Documents are kept in temporary session memory.
            </div>
          </div>
        )}

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-12 shadow-xs text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#F5F3FF] text-[#6D28D9] border border-[#EDE9FE] flex items-center justify-center mx-auto mb-4">
            <FileText className="w-7 h-7 stroke-[2]" />
          </div>
          <h3 className="text-base font-bold text-[#172554] mb-1">
            No documents loaded for this session.
          </h3>
          <p className="text-xs text-[#64748B] max-w-md mx-auto mb-6 leading-relaxed">
            Upload an Indian-language or English PDF to begin grounded question answering with exact page citations.
          </p>
          {onTriggerUpload && (
            <button
              onClick={onTriggerUpload}
              disabled={isUploading}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#6D28D9] hover:bg-[#5B21B6] disabled:opacity-60 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing Document...</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  <span>Upload PDF Document</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    );
  }

  // Dynamic context-aware suggested questions based on the active document


  const getSuggestedQuestions = () => {
    const title = (document?.title || '').toLowerCase();
    const filename = (document?.filename || '').toLowerCase();

    if (title.includes('insurance') || title.includes('மருத்துவ') || filename.includes('health') || filename.includes('cmehic')) {
      return [
        { label: 'Family Income Ceiling', query: 'What is the maximum annual family income limit to be eligible for CMCHIS?' },
        { label: 'Coverage Amount', query: 'What is the annual medical treatment coverage amount per family?' },
        { label: 'Application Deadline', query: 'What is the deadline to submit applications under this scheme?' },
        { label: 'Missing Info Test', query: 'What is the car loan subsidy percentage under this scheme?' },
      ];
    }

    if (title.includes('solar') || title.includes('सोलर') || filename.includes('krishi') || filename.includes('solar')) {
      return [
        { label: '2 HP Pump Cost & Subsidy', query: 'What is the estimated total cost and 60% subsidy amount for a 2 HP DC solar pump in Table 1.1?' },
        { label: 'Registration Deadline', query: 'What is the online registration deadline on upagriculture.com?' },
        { label: 'Land Eligibility', query: 'What are the landholding and borewell requirements for farmers?' },
        { label: 'Missing Info Test', query: 'What is the laptop allowance for farmers?' },
      ];
    }

    if (title.includes('scholarship') || title.includes('छात्रवृत्ति') || filename.includes('scholarship')) {
      return [
        { label: 'UG Student Stipend', query: 'What is the annual stipend amount for undergraduate students?' },
        { label: 'Portal Deadline', query: 'What is the last date to apply on the national scholarship portal?' },
        { label: 'Missing Fact Test (TC3)', query: 'What is the maximum age limit for PhD applicants applying for this scholarship?' },
      ];
    }

    return [
      { label: 'Application Deadline', query: 'What is the application deadline mentioned in this document?' },
      { label: 'Eligibility Requirements', query: 'What are the main eligibility criteria?' },
      { label: 'Financial Amounts', query: 'What financial amounts, subsidies, or fees are specified?' },
      { label: 'Absent Fact Test', query: 'Is there any passport or international travel allowance mentioned?' },
    ];
  };

  const handleAskQuestion = async (queryToAsk?: string) => {
    const query = (queryToAsk || questionText).trim();
    if (!query) return;

    if (!document || !document.pages || document.pages.length === 0) {
      setErrorMsg('Please select a valid document with indexed pages.');
      return;
    }

    setIsAsking(true);
    setErrorMsg(null);

    try {
      const response = await fetch('/api/documents/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: document.id,
          pages: document.pages,
          questionText: query,
          answerLanguage,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to retrieve grounded answer from server.');
      }

      const answerData: QuestionAnswer = await response.json();
      setCurrentAnswer(answerData);
      setHistory((prev) => [answerData, ...prev.filter(h => h.id !== answerData.id).slice(0, 9)]);
      if (!queryToAsk) {
        setQuestionText('');
      }
    } catch (err: any) {
      console.error('Ask error:', err);
      setErrorMsg(err.message || 'Error occurred while contacting grounding engine.');
    } finally {
      setIsAsking(false);
    }
  };

  const handleCopyAnswer = () => {
    if (!currentAnswer) return;
    const textToCopy = `${currentAnswer.answerText}\n\n[Citations: ${
      currentAnswer.citations?.map((c) => `Page ${c.pageNumber}: "${c.supportingPassage}"`).join('; ') || 'None'
    }]`;
    navigator.clipboard.writeText(textToCopy);
    setCopiedAnswer(true);
    setTimeout(() => setCopiedAnswer(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
        {/* Compact Document Header Banner */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-[#F5F3FF] text-[#6D28D9] flex items-center justify-center shrink-0 shadow-xs">
              <FileText className="w-5 h-5 stroke-[2]" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-[#172554] truncate">
                {document.title}
              </h2>
              <div className="flex items-center gap-2 text-xs text-[#64748B] mt-0.5">
                <span className="font-medium text-[#172554]">{document.language}</span>
                <span aria-hidden="true" className="text-[#CBD5E1]">·</span>
                <span>{document.pageCount} Pages</span>
                <span aria-hidden="true" className="text-[#CBD5E1]">·</span>
                <span className="text-[#15803D] flex items-center gap-1 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  OCR Indexed
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onOpenViewer(document, 1)}
              className="px-3 py-1.5 rounded-lg border border-[#E2E8F0] hover:bg-[#F8FAFC] text-xs font-semibold text-[#172554] hover:text-[#6D28D9] flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>View Pages</span>
            </button>
            <button
              onClick={onNavigateToMyDocs}
              className="text-xs text-[#64748B] hover:text-[#172554] px-2 py-1.5 cursor-pointer font-medium"
            >
              Switch Doc
            </button>
          </div>
        </div>

      {/* Main Focus: Question-Answer Panel */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-xs">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#15803D]" />
            <h3 className="text-base font-bold text-[#172554] tracking-tight">
              Ask Clario
            </h3>
          </div>
          <span className="text-xs text-[#64748B]">
            Target Language: <strong className="text-[#6D28D9] font-semibold">{answerLanguage}</strong>
          </span>
        </div>

        <p className="text-xs text-[#64748B] mb-4">
          Ask questions in English or Indian languages. Every answer is grounded strictly in this document with verified page citations.
        </p>

        {/* Large Question Input */}
        <div className="relative mb-3">
          <textarea
            rows={3}
            value={questionText}
            onChange={(e) => setQuestionText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleAskQuestion();
              }
            }}
            placeholder="Ask about application deadlines, eligibility criteria, subsidy amounts, or required certificates..."
            className="w-full p-3.5 text-sm rounded-lg border border-[#E2E8F0] focus:outline-none focus:border-[#6D28D9] focus:ring-1 focus:ring-[#6D28D9] text-[#172554] placeholder-[#94A3B8] resize-none leading-relaxed bg-[#FFFFFF]"
          />
          <button
            onClick={isRecording ? stopRecording : startRecording}
            className={`absolute right-3 bottom-3 p-2 rounded-lg transition-colors cursor-pointer ${
              isRecording ? 'bg-[#DC2626] text-white animate-pulse' : 'bg-[#F8FAFC] text-[#64748B] hover:text-[#6D28D9] hover:bg-[#F5F3FF]'
            }`}
            title={isRecording ? "Stop Recording" : "Record Question"}
          >
            {isRecording ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
        </div>

        {/* Action Controls & Suggested Questions */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Suggested question chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-[#64748B] mr-1 hidden sm:inline">Try:</span>
            {getSuggestedQuestions().map((item, idx) => (
              <button
                key={`suggested-${idx}`}
                onClick={() => handleAskQuestion(item.query)}
                className="px-2.5 py-1 text-xs rounded-md bg-[#F8FAFC] hover:bg-[#F5F3FF] border border-[#E2E8F0] hover:border-[#6D28D9]/40 text-[#64748B] hover:text-[#6D28D9] transition-colors cursor-pointer font-medium"
                title={item.query}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Submit button */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] text-[#94A3B8] hidden md:inline flex items-center gap-0.5">
              <CornerDownLeft className="w-2.5 h-2.5" /> Enter to ask
            </span>
            <button
              onClick={() => handleAskQuestion()}
              disabled={isAsking || !questionText.trim()}
              className="px-6 py-2.5 rounded-lg bg-[#6D28D9] hover:bg-[#5B21B6] disabled:opacity-50 text-white font-semibold text-xs transition-colors shadow-xs cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
            >
              {isAsking ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Searching Evidence...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Ask Clario</span>
                </>
              )}
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="mt-4 p-3 rounded-lg bg-[#FEF2F2] border border-[#FEE2E2] flex items-start gap-2.5 text-xs text-[#DC2626]">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* Answer & Evidence Presentation */}
      {currentAnswer && (
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-xs animate-in fade-in duration-200">
          <div className="flex items-center justify-between mb-3 pb-3 border-b border-[#E2E8F0]">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold uppercase tracking-wider text-[#172554]">
                Answer ({currentAnswer.answerLanguage})
              </span>
              {currentAnswer.isFallback ? (
                <span className="text-[11px] font-semibold text-[#DC2626] bg-[#FEF2F2] px-2 py-0.5 rounded border border-[#FEE2E2]">
                  STRICT GROUNDING FALLBACK
                </span>
              ) : (
                <span className="text-[11px] font-semibold text-[#15803D] bg-[#F0FDF4] px-2 py-0.5 rounded border border-[#DCFCE7] flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  GROUNDED EVIDENCE VERIFIED
                </span>
              )}
              {currentAnswer.executionEngine === 'live_gemini_agent' ? (
                <span className="text-[11px] font-semibold text-[#6D28D9] bg-[#F5F3FF] px-2 py-0.5 rounded border border-[#DDD6FE] flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Live Gemini Agent (Function Calling)
                </span>
              ) : (
                <span className="text-[11px] font-semibold text-[#0369A1] bg-[#F0F9FF] px-2 py-0.5 rounded border border-[#BAE6FD] flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  Deterministic Grounding Engine
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleTTS(currentAnswer.answerText, currentAnswer.id)}
                className={`p-1.5 rounded-md hover:bg-[#F8FAFC] transition-colors cursor-pointer ${
                  isPlayingAudio === currentAnswer.id ? 'text-[#6D28D9]' : 'text-[#64748B] hover:text-[#6D28D9]'
                }`}
                title={isPlayingAudio === currentAnswer.id ? 'Stop Playing' : 'Listen to Answer'}
              >
                {isPlayingAudio === currentAnswer.id ? <StopCircle className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              {currentAnswer.latencyMs !== undefined && (
                <span className="text-[11px] text-[#64748B] font-mono">
                  {currentAnswer.latencyMs} ms
                </span>
              )}
              <button
                onClick={handleCopyAnswer}
                className="p-1.5 rounded-md hover:bg-[#F8FAFC] text-[#64748B] hover:text-[#172554] transition-colors cursor-pointer"
                title="Copy Answer & Citations"
              >
                {copiedAnswer ? (
                  <Check className="w-3.5 h-3.5 text-[#15803D]" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>

          {/* Echo of question */}
          <div className="text-xs text-[#64748B] mb-2 font-medium">
            Question: <span className="text-[#172554] font-semibold">"{currentAnswer.questionText}"</span>
          </div>

          {/* Answer Text */}
          {currentAnswer.isFallback ? (
            <div className="p-4 rounded-xl bg-[#FEF2F2]/40 border border-[#FEE2E2] my-3">
              <p className="font-mono text-base font-bold text-[#DC2626]">
                {currentAnswer.answerText}
              </p>
              <p className="text-xs text-[#64748B] mt-2 leading-relaxed">
                Grounding Rule: If the document does not mention the requested fact, Clario returns strictly <code>Not in the document</code> with no speculative explanation or hallucinated details.
              </p>
            </div>
          ) : (
            <div className="text-sm font-medium text-[#172554] leading-relaxed my-3 bg-[#F8FAFC] p-4 rounded-xl border border-[#E2E8F0]">
              {currentAnswer.answerText}
            </div>
          )}

          {/* Agent Activity & Reasoning Trace */}
          {currentAnswer.agentSteps && currentAnswer.agentSteps.length > 0 && (
            <div className="mt-4 pt-3 border-t border-[#E2E8F0]">
              <div className="flex items-center gap-1.5 mb-2.5">
                <Sparkles className="w-3.5 h-3.5 text-[#6D28D9]" />
                <h4 className="text-xs font-bold text-[#172554] uppercase tracking-wider">
                  Agent Reasoning & Tool Activity ({currentAnswer.agentSteps.length} Steps)
                </h4>
              </div>

              <div className="space-y-2">
                {currentAnswer.agentSteps.map((step, idx) => (
                  <div
                    key={`step-${step.stepNumber}-${idx}`}
                    className="p-2.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-xs"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="w-4 h-4 rounded-full bg-[#6D28D9] text-white flex items-center justify-center text-[10px] font-bold font-sans">
                          {step.stepNumber}
                        </span>
                        <span className="font-semibold text-[#6D28D9] bg-[#F5F3FF] px-2 py-0.5 rounded border border-[#EDE9FE] font-mono text-[11px]">
                          tool: {step.tool}
                        </span>
                      </div>
                      <span className="text-[10px] text-[#94A3B8]">
                        {new Date(step.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    </div>

                    <p className="text-[11px] text-[#334155] pl-5.5 leading-relaxed">
                      {step.output}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Citations & Evidence */}
          {!currentAnswer.isFallback && currentAnswer.citations && currentAnswer.citations.length > 0 && (
            <div className="mt-5 pt-4 border-t border-[#E2E8F0] space-y-3">
              <h4 className="text-xs font-bold text-[#172554] uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#6D28D9]" />
                <span>Exact Source Citations ({currentAnswer.citations.length})</span>
              </h4>

              <div className="space-y-2.5">
                {currentAnswer.citations.map((citation, index) => {
                  const langKey = currentAnswer.answerLanguage || answerLanguage;
                  const CITATION_LABELS: Record<string, { original: string; translation: (lang: string) => string; unavailable: string }> = {
                    English: { original: 'Original source', translation: (lang) => `${lang} translation`, unavailable: 'Translation unavailable' },
                    Tamil: { original: 'அசல் ஆதாரம்', translation: (lang) => `${lang} மொழிபெயர்ப்பு`, unavailable: 'மொழிபெயர்ப்பு கிடைக்கவில்லை' },
                    Hindi: { original: 'मूल स्रोत', translation: (lang) => `${lang} अनुवाद`, unavailable: 'अनुवाद उपलब्ध नहीं है' },
                    Telugu: { original: 'అసలు మూలం', translation: (lang) => `${lang} అనువాదం`, unavailable: 'అనువాదం అందుబాటులో లేదు' },
                    Kannada: { original: 'ಮೂಲ ಮೂಲ', translation: (lang) => `${lang} ಅನುವಾದ`, unavailable: 'ಅನುವಾದ ಲಭ್ಯವಿಲ್ಲ' },
                    Bengali: { original: 'মূল উৎস', translation: (lang) => `${lang} অনুবাদ`, unavailable: 'অনুবাদ উপলব্ধ নয়' },
                    Marathi: { original: 'मूळ स्त्रोत', translation: (lang) => `${lang} भाषांतर`, unavailable: 'भाषांतर उपलब्ध नाही' },
                    Gujarati: { original: 'મૂળ સ્ત્રોત', translation: (lang) => `${lang} ભાષાંતર`, unavailable: 'ભાષાંતર ઉપલબ્ધ નથી' },
                    Malayalam: { original: 'യഥാർത്ഥ ഉറവിടം', translation: (lang) => `${lang} വിവർത്തനം`, unavailable: 'വിവർത്തനം ലഭ്യമല്ല' },
                  };
                  const labels = CITATION_LABELS[langKey] || CITATION_LABELS['English'];

                  return (
                    <div
                      key={`citation-${citation.id || index}`}
                      className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex flex-col justify-between gap-3"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#6D28D9] bg-[#F5F3FF] px-2 py-0.5 rounded border border-[#EDE9FE]">
                            Page {citation.pageNumber}
                          </span>
                          <span aria-hidden="true" className="text-[#CBD5E1]">·</span>
                          <span className="text-[11px] text-[#15803D] font-medium flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Immutable Source Citation
                          </span>
                        </div>

                        <button
                          onClick={() =>
                            onOpenViewer(document, citation.pageNumber, citation.supportingPassage)
                          }
                          className="text-xs font-semibold text-[#6D28D9] hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Inspect in Document</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {/* Original Source Excerpt (Immutable) */}
                        <div className="p-3 rounded-lg bg-white border border-[#E2E8F0] space-y-1.5">
                          <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">
                            {labels.original} ({document.language || 'Original'})
                          </span>
                          <blockquote className="text-xs font-serif italic text-[#172554] leading-relaxed">
                            "{citation.supportingPassage}"
                          </blockquote>
                        </div>

                        {/* Localized Translation beside original excerpt */}
                        <div className="p-3 rounded-lg bg-[#F5F3FF]/40 border border-[#EDE9FE] space-y-1.5">
                          <span className="text-[11px] font-bold text-[#6D28D9] uppercase tracking-wider">
                            {labels.translation(langKey)}
                          </span>
                          <blockquote className="text-xs font-serif italic text-[#172554] leading-relaxed">
                            "{citation.translatedPassage || labels.unavailable}"
                          </blockquote>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Informative Guidance Box when no question is asked yet */}
      {!currentAnswer && (
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs">
          <div className="flex items-center gap-2 mb-2 text-xs font-bold uppercase tracking-wider text-[#172554]">
            <ShieldCheck className="w-4 h-4 text-[#6D28D9]" />
            <span>Strict Document Grounding Protocol</span>
          </div>
          <p className="text-xs text-[#64748B] leading-relaxed">
            Every answer provided by Clario is derived solely from the indexed pages of <strong>{document.title}</strong>. If a requested deadline, stipend, or eligibility requirement is absent from the document, Clario returns strictly <code>Not in the document</code> without hallucinating or making external assumptions.
          </p>
        </div>
      )}

      {/* Prior History Stream */}
      {history.length > 1 && (
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#172554] uppercase tracking-wider mb-3">
            <Clock className="w-3.5 h-3.5 text-[#64748B]" />
            <span>Recent Query Log ({history.length})</span>
          </div>

          <div className="space-y-2">
            {history.slice(1, 4).map((item, idx) => (
              <div
                key={`history-${item.id || idx}`}
                onClick={() => handleAskQuestion(item.questionText)}
                className="p-3 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] hover:bg-[#F5F3FF]/50 transition-colors text-xs flex justify-between items-start gap-3 cursor-pointer"
              >
                <div>
                  <p className="font-semibold text-[#172554] mb-0.5">
                    "{item.questionText}"
                  </p>
                  <p className="text-[#64748B] text-xs line-clamp-1">
                    {item.answerText}
                  </p>
                </div>
                {item.citations?.[0] && (
                  <span className="text-[10px] text-[#6D28D9] font-mono shrink-0 bg-white px-1.5 py-0.5 rounded border border-[#E2E8F0]">
                    Page {item.citations[0].pageNumber}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
