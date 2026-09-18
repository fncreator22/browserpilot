"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { 
  Sparkles, 
  Search,
  Briefcase,
  Layers,
  Clock,
  Globe,
  Target,
  ChevronDown,
  ChevronUp,
  X,
  Square,
  AlertTriangle,
  SlidersHorizontal,
  ImagePlus,
  Plus,
  Mic,
  MicOff,
  Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { parseSearchIntent } from "@/lib/scraper/intentParser";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import { useUIState } from "@/components/providers/ui-state-provider";
import { SearchAccessGateModal } from "@/components/auth/search-access-gate-modal";

export interface OpportunitySearchResultPayload {
  searchId: string;
  status: "COMPLETE" | "PARTIAL" | "NO_RESULTS" | "UNAUTHORIZED" | "FAILED" | string;
  query: string;
  intent?: any;
  canonicalIntent?: any;
  requestedCount?: number;
  verifiedCount?: number;
  results: any[];
  partial?: boolean;
  explanation?: string;
  diagnostics?: {
    requestedCount?: number;
    validResultCount?: number;
    rejectedResultCount?: number;
    stoppingReason?: string;
    totalRounds?: number;
    rejectionReasons?: string[];
    duplicateCount?: number;
  };
  correctionState?: any;
  sourceSummary?: {
    toolsExecuted?: string[];
    memoriesRetrieved?: number;
    durationMs?: number;
  };
  personalization?: {
    applied: boolean;
    memoriesUsed?: Array<{ category: string; key: string; value: string }>;
    summary?: string;
    overrideNotice?: string;
  };
  metadata: {
    totalUniqueOpportunities?: number;
    returnedCount?: number;
    durationMs?: number;
    providersAttempted?: number;
    providersSucceeded?: number;
    telemetry?: any;
    explanation?: string;
  };
  errorCode?: string;
  error?: string;
}

interface TaskInputProps {
  initialPrompt?: string;
  isCompact?: boolean;
  hasSearchHistory?: boolean;
  isSearching?: boolean;
  executionId?: string | null;
  onOpportunitySearchResult?: (result: OpportunitySearchResultPayload | null) => void;
  onSearchingChange?: (isSearching: boolean) => void;
  onExecutionQueued?: (executionId: string, query: string) => void;
  onCancel?: () => void;
  trailingActions?: React.ReactNode;
}

const PLACEHOLDER_IDEAS = [
  "Search remote AI & Machine Learning internships for 2026 batch...",
  "Find entry-level full-stack roles at Y Combinator startups...",
  "Search lead frontend engineer opportunities with React & Next.js...",
  "Discover data analyst roles in Bengaluru posted in the last 48 hours...",
];

const PRESET_TEMPLATES = [
  {
    label: "Remote AI & Systems Engineer",
    icon: Briefcase,
    goal: "Find remote AI and Machine Learning engineering roles at high-growth startups.",
    domains: "",
    steps: 0,
  },
  {
    label: "Founding Full Stack at YC Startup",
    icon: Layers,
    goal: "Discover founding full stack and frontend engineering opportunities at Y Combinator companies with React and TypeScript.",
    domains: "",
    steps: 0,
  },
  {
    label: "Data Analyst in Bengaluru (Last 30 Days)",
    icon: Search,
    goal: "Find data analyst in bengaluru in last 30 days.",
    domains: "",
    steps: 0,
  },
  {
    label: "Staff Frontend Architect",
    icon: Layers,
    goal: "Search for lead or staff frontend engineer opportunities with React, Next.js, and TypeScript.",
    domains: "",
    steps: 0,
  },
];



export interface RecommendationItem {
  label: string;
  goal: string;
  icon?: any;
  domains?: string;
  steps?: number;
}

export function TaskInput({
  initialPrompt = "",
  isCompact = false,
  hasSearchHistory = false,
  isSearching = false,
  executionId,
  onOpportunitySearchResult,
  onSearchingChange,
  onExecutionQueued,
  onCancel,
  trailingActions,
}: TaskInputProps) {
  const router = useRouter();
  const shouldReduceMotion = useReducedMotion();
  const [prompt, setPrompt] = useState(initialPrompt);
  const prevInitialPromptRef = useRef(initialPrompt);

  useEffect(() => {
    if (initialPrompt !== undefined && initialPrompt !== prevInitialPromptRef.current) {
      prevInitialPromptRef.current = initialPrompt;
      setPrompt(initialPrompt);
    }
  }, [initialPrompt]);

  const [placeholderIndex, setPlaceholderIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % PLACEHOLDER_IDEAS.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const { data: session } = useSession();
  const { openProfileModal } = useUIState();
  const [showAccessGate, setShowAccessGate] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isBusy = isSubmitting || Boolean(isSearching);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [attachedImage, setAttachedImage] = useState<{ base64: string; name: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // R2: Unified "+" Action Menu state
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const plusMenuRef = useRef<HTMLDivElement>(null);

  // R3: Speech-to-Text Voice Recording & Audio Metering state (100% client-side)
  const [isListening, setIsListening] = useState(false);
  const isListeningRef = useRef(false);
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const basePromptRef = useRef<string>("");
  const recognitionRef = useRef<any>(null);

  // Close plus menu on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (plusMenuRef.current && !plusMenuRef.current.contains(e.target as Node)) {
        setShowPlusMenu(false);
      }
    }
    if (showPlusMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showPlusMenu]);

  // Clean up recognition on unmount
  useEffect(() => {
    return () => {
      isListeningRef.current = false;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
    };
  }, []);

  const stopAudioTracking = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch {}
      audioContextRef.current = null;
    }
    setAudioLevel(0);
  };

  const startVoiceRecording = async () => {
    const SpeechRecognition =
      typeof window !== "undefined"
        ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        : null;

    if (!SpeechRecognition) {
      toast.error("Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.");
      return;
    }

    basePromptRef.current = prompt;

    // Connect to Web Audio API for live loudness/softness audio metering
    if (typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;

        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const audioCtx = new AudioCtx();
          audioContextRef.current = audioCtx;
          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 256;
          analyser.smoothingTimeConstant = 0.4;
          source.connect(analyser);

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const meterLoop = () => {
            if (!isListeningRef.current) return;
            analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i];
            }
            const avg = sum / dataArray.length;
            const normalized = Math.min(1, Math.max(0, avg / 65));
            setAudioLevel((prev) => prev * 0.25 + normalized * 0.75);
            animFrameRef.current = requestAnimationFrame(meterLoop);
          };
          animFrameRef.current = requestAnimationFrame(meterLoop);
        }
      } catch (mediaErr: any) {
        console.warn("[TaskInput] Microphone audio permission denied:", mediaErr);
        isListeningRef.current = false;
        setIsListening(false);
        stopAudioTracking();
        toast.info("Microphone Access Needed", {
          description: "Microphone permission was denied. Click the lock or site settings icon in your browser URL bar to allow microphone access, then try again.",
        });
        return;
      }
    }

    try {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onresult = (event: any) => {
        let finalSentence = "";
        let interimSentence = "";

        for (let i = 0; i < event.results.length; i++) {
          const item = event.results[i];
          const text = (item[0]?.transcript || "").trim();
          if (!text) continue;

          if (item.isFinal) {
            finalSentence = finalSentence ? `${finalSentence} ${text}` : text;
          } else {
            interimSentence = interimSentence ? `${interimSentence} ${text}` : text;
          }
        }

        const speechCombined = [finalSentence, interimSentence].filter(Boolean).join(" ").trim();
        if (!speechCombined) return;
        const base = basePromptRef.current.trim();
        const nextPrompt = base
          ? `${base} ${speechCombined}`
          : speechCombined;

        setPrompt(nextPrompt);
      };

      recognition.onerror = (event: any) => {
        console.warn("Speech recognition error:", event.error);
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          isListeningRef.current = false;
          setIsListening(false);
          stopAudioTracking();
          toast.info("Microphone Permission Required", {
            description: "Microphone access was denied. Click the lock icon in your browser URL bar to allow microphone permissions, then try again.",
          });
          return;
        }
        if (event.error !== "no-speech" && event.error !== "aborted") {
          toast.error(`Speech recognition notice: ${event.error}`);
          isListeningRef.current = false;
          setIsListening(false);
          stopAudioTracking();
        }
      };

      recognition.onend = () => {
        if (isListeningRef.current) {
          setPrompt((currentPrompt) => {
            basePromptRef.current = currentPrompt.trim();
            return currentPrompt;
          });
          try {
            recognition.start();
          } catch {
            isListeningRef.current = false;
            setIsListening(false);
            stopAudioTracking();
          }
        }
      };

      recognition.start();
      recognitionRef.current = recognition;
      isListeningRef.current = true;
      setIsListening(true);
    } catch (err: any) {
      console.error("Failed to start speech recognition:", err);
      isListeningRef.current = false;
      setIsListening(false);
      stopAudioTracking();
      toast.error("Could not activate microphone. Please check browser permissions.");
    }
  };

  const stopVoiceRecording = () => {
    isListeningRef.current = false;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    stopAudioTracking();
    setIsListening(false);
    setPrompt((current) => {
      const clean = current.trim();
      basePromptRef.current = clean;
      return clean;
    });
    const textarea = document.getElementById("task-goal") as HTMLTextAreaElement | null;
    textarea?.focus();
  };

  const toggleVoiceRecording = () => {
    if (isListening) {
      stopVoiceRecording();
    } else {
      startVoiceRecording();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        const file = items[i].getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = () => {
            if (typeof reader.result === "string") {
              setAttachedImage({
                base64: reader.result,
                name: file.name || "pasted_screenshot.png",
              });
              toast.success("Screenshot attached for DeepReach Vision extraction");
            }
          };
          reader.readAsDataURL(file);
          break;
        }
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          setAttachedImage({
            base64: reader.result,
            name: file.name,
          });
          toast.success("Image attached for DeepReach Vision extraction");
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Dynamic recommendations personalized to user career memory & search history
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>(PRESET_TEMPLATES);
  const [isPersonalized, setIsPersonalized] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function loadDynamicRecommendations() {
      try {
        const res = await fetch("/api/account/recommendations");
        if (res.ok) {
          const rawRec = await res.text();
          const data = rawRec && rawRec.trim().length > 0 ? JSON.parse(rawRec) : null;
          if (data && isMounted && Array.isArray(data.recommendations) && data.recommendations.length > 0) {
            const mapped = data.recommendations.map((item: any) => {
              let IconComponent = Briefcase;
              if (item.icon === "layers") IconComponent = Layers;
              else if (item.icon === "search") IconComponent = Search;
              else if (item.icon === "sparkles") IconComponent = Sparkles;
              return {
                label: item.label,
                goal: item.goal,
                icon: IconComponent,
                domains: "",
                steps: 0,
              };
            });
            setRecommendations(mapped);
            setIsPersonalized(Boolean(data.personalized));
          }
        }
      } catch {
        // Silently retain static presets
      }
    }
    loadDynamicRecommendations();
    return () => {
      isMounted = false;
    };
  }, []);

  const parsedIntent = useMemo(() => {
    if (!prompt.trim()) return null;
    try {
      return parseSearchIntent(prompt);
    } catch {
      return null;
    }
  }, [prompt]);

  // Refinement overrides state (progressive disclosure)
  const [showRefine, setShowRefine] = useState(false);
  const [customFreshness, setCustomFreshness] = useState<number | null>(null);
  const [customWorkMode, setCustomWorkMode] = useState<string | null>(null);
  const [customOppType, setCustomOppType] = useState<string | null>(null);
  const [customMinScore, setCustomMinScore] = useState<number | null>(null);

  const effectiveFreshnessHours = customFreshness !== null ? customFreshness : parsedIntent?.freshnessWindowHours;
  const effectiveWorkMode = customWorkMode || parsedIntent?.workMode || "ANY";
  const effectiveMinScore = customMinScore !== null ? customMinScore : (parsedIntent?.minimumMatchScore || 70);

  // Execution concurrency & cancellation controls
  const abortControllerRef = useRef<AbortController | null>(null);
  const currentExecutionIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (executionId) {
      currentExecutionIdRef.current = executionId;
    }
  }, [executionId]);

  // Immediate UI reset and controller abort upon search cancellation
  useEffect(() => {
    if (!isSearching) {
      setIsSubmitting(false);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      currentExecutionIdRef.current = null;
    }
  }, [isSearching]);

  useEffect(() => {
    const handleCancelledEvent = () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      currentExecutionIdRef.current = null;
      setIsSubmitting(false);
      if (onSearchingChange) onSearchingChange(false);
    };

    if (typeof window !== "undefined") {
      window.addEventListener("browserai:search-cancelled", handleCancelledEvent);
      return () => {
        window.removeEventListener("browserai:search-cancelled", handleCancelledEvent);
      };
    }
  }, [onSearchingChange]);

  const handleCancelSearch = async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const execId = currentExecutionIdRef.current || executionId;
    if (execId) {
      try {
        await fetch("/api/search/cancel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ executionId: execId }),
        });
      } catch {}
    }
    currentExecutionIdRef.current = null;
    setIsSubmitting(false);
    if (onSearchingChange) onSearchingChange(false);
    if (onOpportunitySearchResult) onOpportunitySearchResult(null);
    if (onCancel) onCancel();
    const { showDeduplicatedCancelToast } = await import("@/lib/utils/toastDebounce");
    showDeduplicatedCancelToast("Search execution was cancelled by user request.");
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isListening) {
      stopVoiceRecording();
    }
    let text = prompt.trim();
    if (!text && !attachedImage) return;

    if (isBusy) {
      toast.info("Search in progress", {
        description: "Your discovery query is actively querying discovery plugins.",
      });
      return;
    }

    // Grab client Puter token if user is signed into Puter in this browser
    const clientPuterToken = typeof window !== "undefined"
      ? (localStorage.getItem("puter.auth.token.v2") || (window as any).puter?.authToken || undefined)
      : undefined;

    // Check for stored client BYOK keys
    const localGeminiKey = typeof window !== "undefined"
      ? (localStorage.getItem("browserpilot_gemini_key") || undefined)
      : undefined;
    const localDeepseekKey = typeof window !== "undefined"
      ? (localStorage.getItem("browserpilot_deepseek_key") || undefined)
      : undefined;

    const hasAuthOrKey = Boolean(session?.user || clientPuterToken || localGeminiKey || localDeepseekKey);

    // Pre-flight check: If no authenticated session and no AI keys configured, intercept with access gate modal
    if (!hasAuthOrKey) {
      setShowAccessGate(true);
      return;
    }

    // 1. If an image is attached, run DeepReach Vision Multi-Platform Discovery
    if (attachedImage) {
      setIsSubmitting(true);
      if (onSearchingChange) onSearchingChange(true);
      try {
        let clientOcrText: string | undefined;
        if (typeof window !== "undefined" && window.puter?.ai?.img2txt) {
          try {
            clientOcrText = await window.puter.ai.img2txt(attachedImage.base64);
          } catch {
            // Non-fatal, server-side will handle
          }
        }

        const deepRes = await fetch("/api/discovery/deep-reach", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageBase64: attachedImage.base64,
            mimeType: attachedImage.base64.match(/^data:([^;]+);base64,/)?.[1] || "image/png",
            prompt: text,
            puterToken: clientPuterToken,
            ocrText: clientOcrText,
          }),
        });
        let deepData: any = null;
        try {
          const rawDeep = await deepRes.text();
          if (rawDeep && rawDeep.trim().length > 0) {
            deepData = JSON.parse(rawDeep);
          }
        } catch {
          deepData = null;
        }

        if (deepRes.ok && deepData?.data) {
          // Listing Trust Advisory Toast for ghost jobs or undisclosed employers
          if (deepData.data.isUndisclosed || deepData.data.trustReport?.isGhostJob) {
            toast.warning("Listing Trust Advisory", {
              description: deepData.data.trustReport?.advisoryTitle || "Suspicious or undisclosed listing detected.",
            });
          }

          const foundJobs = deepData.data.jobs && deepData.data.jobs.length > 0;
          if (foundJobs) {
            toast.success("DeepReach Vision Processed", {
              description: `Extracted ${deepData.data.companyName}: ${deepData.data.jobs.length} jobs, ${deepData.data.recruiters?.length || 0} recruiters verified.`,
            });
            if (onOpportunitySearchResult) {
              onOpportunitySearchResult({
                searchId: `deep_${Date.now()}`,
                status: "COMPLETE",
                query: text || deepData.data.companyName,
                results: deepData.data.jobs.map((j: any) => ({
                  id: `deep_${Math.random().toString(36).slice(2, 7)}`,
                  title: j.title,
                  companyName: j.companyName,
                  primaryApplyUrl: j.applyUrl,
                  applyUrl: j.applyUrl,
                  sourcePlatform: j.sourcePlatform,
                  verificationStatus: "VERIFIED",
                  matchScore: 92,
                  companyContacts: deepData.data.recruiters,
                  trustReport: deepData.data.trustReport,
                  urlAnalysis: deepData.data.urlAnalysis,
                  companyIntelligence: deepData.data.companyIntelligence,
                  isUndisclosed: deepData.data.isUndisclosed,
                })),
                metadata: {
                  totalUniqueOpportunities: deepData.data.jobs.length,
                  returnedCount: deepData.data.jobs.length,
                  durationMs: 1200,
                  providersAttempted: 4,
                  providersSucceeded: 4,
                  explanation: deepData.data.multimodalSummary || "DeepReach multi-platform extraction complete",
                },
              });
            }
            setIsSubmitting(false);
            if (onSearchingChange) onSearchingChange(false);
            return;
          } else if (deepData.data.companyName) {
            // Planner-Executor Bridge: Fall back to mainline ATS and Job search engine
            toast.info(`Vision Extracted: ${deepData.data.companyName}`, {
              description: `Searching direct ATS and career endpoints for ${deepData.data.companyName}...`,
            });
            const bridgeQuery = [deepData.data.companyName, deepData.data.roleTitle || "Software Engineer"].filter(Boolean).join(" ");
            text = bridgeQuery;
            if (deepData.data.recruiters && deepData.data.recruiters.length > 0) {
              (window as any).__lastDeepReachContacts = deepData.data.recruiters;
            }
            setAttachedImage(null);
            // Fall through to mainline search POST /api/search
          } else {
            toast.info("Image Analyzed", {
              description: "No specific company detected in image. Running general query...",
            });
            setAttachedImage(null);
            // Fall through to mainline search
          }
        } else {
          toast.error("DeepReach Notice", {
            description: deepData?.message || "Vision extraction was unable to identify listings in this image.",
          });
          setIsSubmitting(false);
          if (onSearchingChange) onSearchingChange(false);
          return;
        }
      } catch {
        toast.error("DeepReach Notice", {
          description: "An issue occurred while analyzing the document image. Please try again or enter your search keywords directly.",
        });
        setIsSubmitting(false);
        if (onSearchingChange) onSearchingChange(false);
        return;
      }
    }

    setIsSubmitting(true);
    if (onSearchingChange) onSearchingChange(true);
    setSubmitError(null);

    const clientExecutionId = `search_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    currentExecutionIdRef.current = clientExecutionId;
    if (onExecutionQueued) {
      onExecutionQueued(clientExecutionId, text);
    }

    const abortCtrl = new AbortController();
    abortControllerRef.current = abortCtrl;
    const timeoutId = setTimeout(() => {
      abortCtrl.abort(new Error("Search timed out: Upstream discovery plugins took too long to respond. Try narrowing your query or retrying."));
    }, 300000);

    let searchHandedOffToQueue = false;
    try {
      const filters: Record<string, any> = {};
      if (customFreshness !== null) {
        if (customFreshness > 0) {
          filters.freshnessWindowHours = customFreshness;
          filters.isExplicitFreshness = true;
        } else {
          filters.freshnessWindowHours = undefined;
          filters.isExplicitFreshness = false;
        }
      }
      if (customWorkMode && customWorkMode !== "ANY") {
        filters.workMode = customWorkMode;
      }
      if (customOppType && customOppType !== "ANY") {
        filters.opportunityType = customOppType;
      }
      if (customMinScore !== null) {
        filters.minimumMatchScore = customMinScore;
      }

      const res = await fetch("/api/search", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-execution-id": clientExecutionId,
        },
        body: JSON.stringify({ 
          executionId: clientExecutionId,
          query: text,
          filters: Object.keys(filters).length > 0 ? filters : undefined,
          puterToken: clientPuterToken,
          allowDeterministicFallback: true,
        }),
        signal: abortCtrl.signal,
      });

      const execIdHeader = res.headers.get("x-execution-id") || clientExecutionId;
      if (execIdHeader) {
        currentExecutionIdRef.current = execIdHeader;
      }

      let data: any = null;
      try {
        const rawText = await res.text();
        if (rawText && rawText.trim().length > 0) {
          data = JSON.parse(rawText);
        }
      } catch {
        data = null;
      }

      if (abortCtrl.signal.aborted) {
        return;
      }

      if (!res.ok) {
        if (res.status === 504 || res.status === 502 || res.status === 503) {
          const timeoutDesc = "The search service took longer than expected or is under high traffic. Please retry in a few moments.";
          setSubmitError(timeoutDesc);
          toast.error("Search Notice", { description: timeoutDesc });
          if (onOpportunitySearchResult) onOpportunitySearchResult(null);
          return;
        }
        if (res.status === 401 || data?.error === "AUTH_OR_KEY_REQUIRED") {
          setShowAccessGate(true);
          setIsSubmitting(false);
          if (onSearchingChange) onSearchingChange(false);
          toast.warning("Sign In or AI Key Required", {
            description: "Please sign in or configure an AI API key to execute discovery searches.",
          });
          return;
        }
        if (res.status === 429) {
          toast.error(data?.message || "Rate limit reached. Please wait a moment before trying again.");
          return;
        }
        if (res.status === 499) {
          if (onOpportunitySearchResult) {
            onOpportunitySearchResult(null);
          }
          if (onCancel) {
            onCancel();
          }
          return;
        }
        throw new Error(data?.message || "We could not find matching results. Please try a different query or adjust your filters.");
      }

      if (!data) {
        throw new Error("Unable to read search results from server. Please retry in a moment.");
      }

      if (data.status === "QUEUED" && data.executionId) {
        searchHandedOffToQueue = true;
        currentExecutionIdRef.current = data.executionId;
        setIsSubmitting(false);
        if (onExecutionQueued) {
          onExecutionQueued(data.executionId, text);
        }
        return;
      }

      if (typeof window !== "undefined" && (window as any).__lastDeepReachContacts && data.results && data.results.length > 0) {
        data.results = data.results.map((r: any) => ({
          ...r,
          companyContacts: r.companyContacts || (window as any).__lastDeepReachContacts,
        }));
        (window as any).__lastDeepReachContacts = undefined;
      }

      if (data.status === "MODEL_CONFIGURATION_REQUIRED" || data.errorCode === "MODEL_CONFIGURATION_REQUIRED") {
        toast.warning("AI Provider Configuration Required", {
          description: "Connect free Puter AI or add your Gemini API key to run autonomous AI searches.",
        });
        return;
      }

      if (onOpportunitySearchResult) {
        onOpportunitySearchResult(data);
      }

      const foundCount = data.metadata?.totalUniqueOpportunities ?? data.results?.length ?? 0;
      const sourceCount = data.metadata?.providersAttempted || 10;

      if (foundCount === 0) {
        toast.info("Search Complete", {
          description: `Search complete. No matches found across your ${sourceCount} sources.`,
        });
      } else {
        toast.success("Opportunities Discovered!", {
          description: `Found ${foundCount} unique opportunities across ${sourceCount} sources.`,
        });
      }
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      const isTimeout = abortCtrl.signal.aborted && ((err as Error).name === "AbortError" || (err as Error).message?.includes("timed out"));
      if (isTimeout) {
        const timeoutMsg = "Search took longer than expected to query all job plugins. Please try narrowing your search keywords.";
        setSubmitError(timeoutMsg);
        toast.error("Search Notice", { description: timeoutMsg });
        if (onOpportunitySearchResult) {
          onOpportunitySearchResult(null);
        }
        return;
      }
      if (abortCtrl.signal.aborted) {
        return;
      }
      const rawMsg = (err as Error).message || "";
      const isTechnicalError = 
        rawMsg.includes("JSON") || 
        rawMsg.includes("Unexpected end") || 
        rawMsg.includes("Failed to execute 'json'") ||
        rawMsg.includes("fetch failed") ||
        rawMsg.includes("NetworkError") ||
        rawMsg.includes("Load failed");

      const friendlyMsg = isTechnicalError
        ? "We could not complete your search at this moment. Please check your internet connection or retry shortly."
        : rawMsg || "An unexpected issue occurred during your search. Please try again.";

      setSubmitError(friendlyMsg);
      toast.error("Search Notice", { description: friendlyMsg });
      if (onOpportunitySearchResult) {
        onOpportunitySearchResult(null);
      }
    } finally {
      clearTimeout(timeoutId);
      setIsSubmitting(false);
      if (!searchHandedOffToQueue && onSearchingChange) {
        onSearchingChange(false);
      }
    }
  };

  const handleSelectPreset = (preset: RecommendationItem) => {
    setPrompt(preset.goal);
  };

  const hasActiveFilters = customFreshness !== null || (customWorkMode && customWorkMode !== "ANY") || customMinScore !== null;

  return (
    <div className="w-full space-y-3">
      <form
        id="task-input-form"
        onSubmit={handleSubmit}
        className={`max-w-3xl mx-auto rounded-2xl border bg-card p-4 sm:p-5 shadow-marble-2 transition-all space-y-3 ${
          isBusy
            ? "border-primary/50 animate-glow-active shadow-marble-3"
            : "border-border hover:border-primary/30 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20"
        }`}
      >
        {/* Textarea: Clean, borderless with dynamic rotating placeholder */}
        <div className="relative">
          <label htmlFor="task-goal" className="sr-only">
            Describe your career discovery query
          </label>
          {attachedImage && (
            <div className="mb-2 inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/20 text-xs text-primary">
              <span className="font-medium text-[11px]">DeepReach Vision:</span>
              <span className="font-mono text-[11px] truncate max-w-[180px]">{attachedImage.name}</span>
              <button
                type="button"
                onClick={() => setAttachedImage(null)}
                className="p-0.5 hover:bg-primary/20 rounded cursor-pointer"
                title="Remove attachment"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
          <Textarea
            id="task-goal"
            value={prompt}
            disabled={isBusy}
            readOnly={isListening || isBusy}
            onClick={() => {
              if (isBusy) return;
              if (isListening) {
                stopVoiceRecording();
              }
            }}
            onChange={(e) => {
              if (isBusy) return;
              const val = e.target.value;
              setPrompt(val);
              basePromptRef.current = val;
            }}
            onPaste={(e) => {
              if (isBusy) {
                e.preventDefault();
                return;
              }
              handlePaste(e);
            }}
            onKeyDown={(e) => {
              if (isBusy) return;
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder={
              isBusy
                ? "Autonomous discovery agent is scouting live job boards and ATS sources..."
                : isListening
                ? "Listening to voice input... Click mic or text box to stop and edit."
                : attachedImage
                ? "Add any additional context or hit Discover to parse image..."
                : PLACEHOLDER_IDEAS[placeholderIndex]
            }
            title={isBusy ? "Search in progress - input locked" : isListening ? "Listening... Click to stop recording and edit prompt" : undefined}
            rows={isCompact ? 2 : 3}
            className="text-sm sm:text-base leading-relaxed placeholder:text-muted-foreground/50 resize-none min-h-[70px] max-h-[160px] sm:max-h-[180px] overflow-y-auto focus:outline-none bg-transparent w-full p-0 border-0 shadow-none focus-visible:ring-0 font-sans disabled:opacity-85 disabled:cursor-not-allowed select-text"
          />
        </div>

        {/* Error Alert */}
        {submitError && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-2.5 text-xs font-sans text-destructive flex items-center justify-between gap-3 animate-in fade-in-50">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
              <span>{submitError}</span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSubmitError(null)}
              className="h-5 w-5 p-0 text-destructive hover:bg-destructive/10 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}


        {/* Action Bar (Bottom of Textarea) */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/40">
          {/* Left Actions: Unified Plus Menu + Filters + Voice Recording (R2 & R3) */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Unified "+" Action Menu */}
            <div className="relative" ref={plusMenuRef}>
              <button
                type="button"
                disabled={isBusy}
                onClick={() => setShowPlusMenu(!showPlusMenu)}
                aria-expanded={showPlusMenu}
                aria-label="Add action or context"
                className={`inline-flex items-center justify-center h-8 w-8 rounded-lg text-xs font-sans font-medium transition-colors cursor-pointer border ${
                  showPlusMenu || attachedImage
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground border-border"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
                title="Upload screenshot or media"
              >
                <Plus className={`h-4 w-4 transition-transform duration-200 ${showPlusMenu ? "rotate-45" : ""}`} />
              </button>

              <AnimatePresence>
                {showPlusMenu && !isBusy && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -4 }}
                    transition={{ duration: 0.15 }}
                    className="absolute left-0 bottom-full mb-2 w-56 rounded-xl border border-border bg-popover/95 backdrop-blur-md p-1.5 shadow-marble-2 z-50 flex flex-col gap-1 text-xs font-sans"
                  >
                    {/* Media / Screenshot Upload */}
                    <button
                      type="button"
                      onClick={() => {
                        setShowPlusMenu(false);
                        fileInputRef.current?.click();
                      }}
                      className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left hover:bg-muted transition-colors text-foreground cursor-pointer group w-full"
                    >
                      <div className="p-1 rounded-md bg-primary/10 text-primary group-hover:bg-primary/20">
                        <ImagePlus className="h-3.5 w-3.5" />
                      </div>
                      <div>
                        <div className="font-medium text-xs leading-none">Upload Flyer / Screenshot</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">DeepReach Vision flyer parsing</div>
                      </div>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Filters Toggle Button */}
            <button
              type="button"
              disabled={isBusy}
              onClick={() => setShowRefine(!showRefine)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-sans font-medium transition-colors cursor-pointer border ${
                showRefine || hasActiveFilters
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground border-border"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5 stroke-[1.75]" />
              <span className="hidden sm:inline">Filters</span>
              {hasActiveFilters && (
                <span className="h-1.5 w-1.5 rounded-full bg-background" />
              )}
              {showRefine ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>

            {/* Speech-to-Text Microphone Button & Volume-Reactive Waveform */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={isBusy}
                onClick={toggleVoiceRecording}
                aria-label={isListening ? "Stop voice recording" : "Record voice input"}
                className={`inline-flex items-center justify-center h-8 w-8 rounded-lg text-xs font-sans font-medium transition-all cursor-pointer border ${
                  isListening
                    ? "bg-primary text-primary-foreground border-primary shadow-marble-1"
                    : "bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground border-border"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
                title={isBusy ? "Search in progress" : isListening ? "Stop recording (speaking writes to prompt directly)" : "Voice input (Speech to Text)"}
              >
                {isListening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5 stroke-[1.75]" />}
              </button>

              {/* Compact Dynamic Volume-Reactive Level Meter with 1-Click Stop & Save */}
              {isListening && (
                <button 
                  type="button"
                  onClick={stopVoiceRecording}
                  className="flex items-center gap-1.5 px-2.5 h-8 rounded-lg bg-primary/10 hover:bg-primary/20 border border-primary/25 text-primary text-xs font-sans transition-all cursor-pointer animate-in fade-in-50 duration-200 shadow-xs"
                  title="Click to stop recording and edit prompt"
                >
                  <div className="flex items-center gap-0.5 h-3.5">
                    <span 
                      className="w-1 bg-primary rounded-full transition-all duration-75" 
                      style={{ height: `${Math.max(3, Math.min(14, audioLevel * 16 + 3))}px` }} 
                    />
                    <span 
                      className="w-1 bg-primary rounded-full transition-all duration-75" 
                      style={{ height: `${Math.max(4, Math.min(14, audioLevel * 22 + 4))}px` }} 
                    />
                    <span 
                      className="w-1 bg-primary rounded-full transition-all duration-75" 
                      style={{ height: `${Math.max(3, Math.min(14, audioLevel * 18 + 3))}px` }} 
                    />
                    <span 
                      className="w-1 bg-primary rounded-full transition-all duration-75" 
                      style={{ height: `${Math.max(2, Math.min(14, audioLevel * 12 + 2))}px` }} 
                    />
                  </div>
                  <span className="text-[11px] font-medium hidden sm:inline">
                    {audioLevel > 0.4 ? "Speaking..." : "Listening..."}
                  </span>
                  <span className="text-[10px] text-primary font-semibold ml-0.5 bg-primary/20 px-1.5 py-0.5 rounded">
                    Stop & Edit
                  </span>
                </button>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {/* Right Actions: Stop Search + Primary Discover Button */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {isBusy && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleCancelSearch}
                className="bg-rose-600 hover:bg-rose-700 text-white rounded-lg h-9 px-2.5 sm:px-3 font-medium flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors text-xs font-sans shrink-0"
              >
                <Square className="h-3 w-3 fill-current" />
                <span>Stop</span>
              </Button>
            )}

            <Button
              type="submit"
              disabled={isBusy || (!prompt.trim() && !attachedImage)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg h-9 px-3.5 sm:px-5 font-semibold flex items-center gap-x-1.5 sm:gap-x-2 cursor-pointer shadow-marble-1 transition-all disabled:opacity-50 text-xs sm:text-sm font-sans shrink-0"
            >
              {isBusy ? (
                <>
                  <div className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                  <span className="hidden sm:inline">Searching...</span>
                </>
              ) : (
                <>
                  <Search className="h-3.5 w-3.5 stroke-[2]" />
                  <span>Discover</span>
                </>
              )}
            </Button>

            {trailingActions}
          </div>
        </div>

        {/* Progressive Disclosure Filters Panel */}
        <AnimatePresence>
          {showRefine && (
            <motion.div
              initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, clipPath: "inset(0 0 100% 0)" }}
              animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, clipPath: "inset(0 0 0% 0)" }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, clipPath: "inset(0 0 100% 0)" }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
            >
              <div className="pt-3 mt-1 border-t border-border/50 space-y-3 font-sans text-xs">
                {/* Freshness Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-foreground" />
                    Freshness
                  </span>
                  <div className="flex items-center gap-1">
                    {[
                      { label: "24h", value: 24 },
                      { label: "48h", value: 48 },
                      { label: "7d", value: 168 },
                      { label: "Any", value: 0 },
                    ].map((f) => {
                      const isSelected = effectiveFreshnessHours === f.value || (f.value === 0 && !effectiveFreshnessHours);
                      return (
                        <button
                          type="button"
                          key={f.label}
                          onClick={() => setCustomFreshness(f.value)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer border ${
                            isSelected
                              ? "bg-primary text-primary-foreground border-primary font-semibold"
                              : "bg-muted/40 text-muted-foreground border-border/60 hover:text-foreground hover:bg-muted"
                          }`}
                        >
                          {f.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Work Mode Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <Globe className="h-3.5 w-3.5 text-foreground" />
                    Work Mode
                  </span>
                  <div className="flex items-center gap-1">
                    {[
                      { id: "ANY", label: "Any" },
                      { id: "REMOTE", label: "Remote" },
                      { id: "HYBRID", label: "Hybrid" },
                      { id: "ON_SITE", label: "Onsite" },
                    ].map((m) => (
                      <button
                        type="button"
                        key={m.id}
                        onClick={() => setCustomWorkMode(m.id)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer border ${
                          effectiveWorkMode === m.id
                            ? "bg-primary text-primary-foreground border-primary font-semibold"
                            : "bg-muted/40 text-muted-foreground border-border/60 hover:text-foreground hover:bg-muted"
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Min Match Score Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <Target className="h-3.5 w-3.5 text-foreground" />
                    Min Match Score
                  </span>
                  <div className="flex items-center gap-1">
                    {[
                      { label: "70%", value: 70 },
                      { label: "80%", value: 80 },
                      { label: "90%", value: 90 },
                    ].map((s) => (
                      <button
                        type="button"
                        key={s.label}
                        onClick={() => setCustomMinScore(s.value)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer border ${
                          effectiveMinScore === s.value
                            ? "bg-primary text-primary-foreground border-primary font-semibold"
                            : "bg-muted/40 text-muted-foreground border-border/60 hover:text-foreground hover:bg-muted"
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Reset Filters */}
                {hasActiveFilters && (
                  <div className="pt-2 flex justify-end border-t border-border/30">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setCustomFreshness(null);
                        setCustomWorkMode(null);
                        setCustomOppType(null);
                        setCustomMinScore(null);
                      }}
                      className="h-6 text-[11px] font-sans text-muted-foreground hover:text-foreground gap-1 cursor-pointer"
                    >
                      <X className="h-3 w-3" />
                      Reset filters
                    </Button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </form>



      {/* Preset Recommendation Chips: Displayed when prompt is empty and not actively searching */}
      {!prompt.trim() && !isSearching && (
        <div className="max-w-3xl mx-auto space-y-2 pt-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-sans text-muted-foreground font-medium">
              <Sparkles className="h-3 w-3 text-foreground" />
              <span>{isPersonalized ? "Recommended for you:" : "Sample discovery queries:"}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
            {recommendations.map((preset) => {
              const Icon = preset.icon || Briefcase;
              return (
                <button
                  type="button"
                  key={preset.label}
                  onClick={() => handleSelectPreset(preset)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted/70 hover:border-primary/40 transition-all cursor-pointer shrink-0 shadow-marble-1"
                >
                  <Icon className="h-3 w-3 text-muted-foreground" />
                  <span>{preset.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Access Gate Modal: Prompted when user searches without active session or AI keys */}
      <SearchAccessGateModal
        isOpen={showAccessGate}
        onClose={() => setShowAccessGate(false)}
        onOpenProviders={() => openProfileModal("PROVIDERS")}
        queryAttempted={prompt}
      />
    </div>
  );
}
