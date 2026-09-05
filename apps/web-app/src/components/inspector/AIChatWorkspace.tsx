import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  X,
  Bot,
  Send,
  RotateCcw,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  HelpCircle,
  BookOpen,
  GitCompare,
  Wrench,
  Check,
} from 'lucide-react';
import { ChatMessage, TutorIntent, AIActionEnvelope } from '@project-zero/ai-gateway';
import { sendChatMessage } from '../../services/aiChatService';
import { useGraph } from '../../context/GraphContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { buildAIContextSnapshot } from '../../services/aiContextBuilder';
import { executeAIActions } from '../../services/aiActionExecutor';

interface AIChatWorkspaceProps {
  onClose: () => void;
}

export const AIChatWorkspace: React.FC<AIChatWorkspaceProps> = ({ onClose }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showContextDetails, setShowContextDetails] = useState(false);

  // Proposed AI Actions state for Phase 13 User Confirmation
  const [pendingActionEnvelope, setPendingActionEnvelope] = useState<AIActionEnvelope | null>(null);
  const [actionSuccessBanner, setActionSuccessBanner] = useState<string | null>(null);
  const [actionErrorBanner, setActionErrorBanner] = useState<string | null>(null);

  // Canonical state hooks for Phase 13 Action Execution & GraphContext
  const {
    nodes,
    edges,
    machineType,
    selectedNodeIds,
    selectedEdgeIds,
    initialStackSymbol,
    blankSymbol,
    pdaAcceptanceMode,
    lastMinimizationResult,
    addNode,
    removeNode,
    updateNode,
    addEdge,
    removeEdge,
    updateEdge,
    batchMutate,
  } = useGraph();

  const {
    activeSidebarTab,
    activeBottomTab,
    activeInspectorTab,
    focusMode,
  } = useWorkspace();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Auto-scroll to bottom whenever messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, error, pendingActionEnvelope, actionSuccessBanner]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Cleanup pending requests on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Construct current live context snapshot with educational evidence
  const currentContext = buildAIContextSnapshot({
    nodes,
    edges,
    machineType,
    selectedNodeIds,
    selectedEdgeIds,
    activeSidebarTab,
    activeBottomTab,
    activeInspectorTab,
    focusMode,
    initialStackSymbol,
    blankSymbol,
    pdaAcceptanceMode,
    isStructurallyValid: nodes.length > 0 && nodes.some((n) => n.isInitial),
    observations: lastMinimizationResult ? [`DFA was minimized: ${lastMinimizationResult.minimizedStateCount} states`] : undefined,
    evidence: {
      validityStatus: nodes.length > 0 && nodes.some((n) => n.isInitial) ? 'VALID' : 'INVALID',
      diagnostics: nodes.length === 0 ? ['Machine has no states'] : !nodes.some((n) => n.isInitial) ? ['No initial state configured'] : [],
      minimization: lastMinimizationResult
        ? {
            isAlreadyMinimal: lastMinimizationResult.isAlreadyMinimal,
            mergedStateCount: lastMinimizationResult.mergedStateCount,
          }
        : undefined,
    },
  });

  const dispatchAssistantQuery = async (queryText: string, intent?: TutorIntent) => {
    if (!queryText.trim() || isLoading) return;

    setError(null);
    setActionSuccessBanner(null);
    setActionErrorBanner(null);

    const userMessage: ChatMessage = { role: 'user', content: queryText.trim() };
    const updatedMessages = [...messages, userMessage];

    setMessages(updatedMessages);
    setInput('');
    setIsLoading(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Attach inferred intent if provided
    const contextWithIntent = {
      ...currentContext,
      tutorIntent: intent || currentContext.tutorIntent || undefined,
    };

    try {
      const result = await sendChatMessage(updatedMessages, {
        context: contextWithIntent,
        signal: controller.signal,
      });

      const assistantText = result.message.content.trim() ||
        (result.actionProposal ? 'I have generated the structured automaton construction proposal below. Please review and click Apply to update the canvas:' : '');

      if (assistantText) {
        setMessages((prev) => [...prev, { role: 'assistant', content: assistantText }]);
      }

      if (result.actionProposal) {
        setPendingActionEnvelope(result.actionProposal);
      }
    } catch (err: unknown) {
      if ((err as Error).name !== 'AbortError') {
        setError((err as Error).message || 'Failed to communicate with NVIDIA Nemotron AI Gateway.');
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleSend = () => {
    dispatchAssistantQuery(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClear = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setMessages([]);
    setError(null);
    setPendingActionEnvelope(null);
    setActionSuccessBanner(null);
    setActionErrorBanner(null);
    setIsLoading(false);
  };

  // Explicit User Action Confirmation Handlers
  const handleApplyActions = () => {
    if (!pendingActionEnvelope) return;

    const result = executeAIActions({
      envelope: pendingActionEnvelope,
      currentNodes: nodes,
      currentEdges: edges,
      machineType,
      onAddNode: addNode,
      onRemoveNode: removeNode,
      onUpdateNode: updateNode,
      onAddEdge: addEdge,
      onRemoveEdge: removeEdge,
      onUpdateEdge: updateEdge,
      onBatchMutate: batchMutate,
    });

    if (result.success) {
      setActionSuccessBanner(`Successfully applied ${result.appliedCount} AI action(s) to the canvas.`);
      setPendingActionEnvelope(null);
    } else {
      setActionErrorBanner(result.error || 'Action semantic validation failed.');
    }
  };

  const handleCancelActions = () => {
    setPendingActionEnvelope(null);
    setActionErrorBanner(null);
  };

  const selectedCount = selectedNodeIds.length + selectedEdgeIds.length;

  // Quick Action Handlers
  const handleQuickExplainSelection = () => {
    if (selectedCount > 0) {
      dispatchAssistantQuery(`Explain the selected element(s) and their role in this ${machineType}.`, 'EXPLAIN');
    } else {
      dispatchAssistantQuery(`Explain the current ${machineType} machine structure and its primary behavior.`, 'EXPLAIN');
    }
  };

  const handleQuickWhyInvalid = () => {
    dispatchAssistantQuery(`Why is this ${machineType} valid or invalid according to formal computation rules?`, 'WHY');
  };

  const handleQuickTeachConcept = () => {
    dispatchAssistantQuery(`Teach me the foundational theoretical concepts governing this ${machineType} workspace.`, 'CONCEPT');
  };

  const handleQuickCompareConcept = () => {
    if (machineType === 'DFA') {
      dispatchAssistantQuery('What is the difference between a DFA, NFA, and ε-NFA?', 'CONCEPT');
    } else if (machineType === 'PDA') {
      dispatchAssistantQuery('Compare Deterministic Pushdown Automata (DPDA) and Non-deterministic Pushdown Automata (NPDA).', 'CONCEPT');
    } else if (machineType === 'TM') {
      dispatchAssistantQuery('What is the difference between Decidable (Recursive) and Turing-Recognizable (Recursively Enumerable) languages?', 'CONCEPT');
    } else {
      dispatchAssistantQuery('Compare Top-Down LL(1) parsing and Bottom-Up SLR/LR parsing.', 'CONCEPT');
    }
  };

  return (
    <div
      role="region"
      aria-label="AI Assistant Workspace"
      className="flex-1 flex flex-col h-full bg-bg-surface1 text-txt-primary select-none overflow-hidden animate-fadeIn font-sans"
    >
      {/* Header Bar */}
      <div className="h-10 px-3 bg-bg-surface2/80 border-b border-border-subtle flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-2">
          <div className="p-1 rounded bg-accent-purple/15 text-accent-purple border border-accent-purple/20">
            <Sparkles size={13} />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-xs text-txt-primary tracking-tight leading-none">Project Zero AI</span>
            <span className="text-[9px] text-txt-muted font-sans mt-0.5">Assistant • Actions • Context-aware</span>
          </div>
          <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-accent-purple/10 text-accent-purple border border-accent-purple/20">
            Nemotron 3
          </span>
        </div>
        <div className="flex items-center space-x-1">
          {messages.length > 0 && (
            <button
              type="button"
              onClick={handleClear}
              aria-label="Clear Conversation"
              title="Clear Conversation"
              className="p-1 text-txt-muted hover:text-txt-primary hover:bg-bg-surface3 rounded transition-colors"
            >
              <RotateCcw size={13} />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close AI Assistant"
            className="p-1 text-txt-muted hover:text-txt-primary hover:bg-bg-surface3 rounded transition-colors"
            title="Close AI Assistant (Esc)"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Context Awareness Transparency Strip */}
      <div className="px-3 py-1.5 bg-bg-surface2/40 border-b border-border-subtle/50 flex flex-col shrink-0 text-[11px]">
        <div
          onClick={() => setShowContextDetails(!showContextDetails)}
          className="flex items-center justify-between cursor-pointer hover:text-txt-primary text-txt-muted transition-colors"
          title="Toggle Context Engine Details"
        >
          <div className="flex items-center space-x-1.5">
            <CheckCircle2 size={12} className="text-semantic-success shrink-0" />
            <span className="font-medium text-[10px] tracking-tight">
              Live Context: {machineType} ({nodes.length} states, {edges.length} transitions
              {selectedCount > 0 ? `, ${selectedCount} selected` : ''})
            </span>
          </div>
          <div className="flex items-center text-txt-muted">
            {showContextDetails ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </div>
        </div>

        {showContextDetails && (
          <div className="mt-1.5 p-2 bg-bg-surface1/80 border border-border-subtle/60 rounded font-mono text-[10px] text-txt-secondary space-y-1 animate-fadeIn">
            <div className="flex justify-between">
              <span>Machine Type:</span>
              <span className="text-txt-primary font-bold">{machineType}</span>
            </div>
            <div className="flex justify-between">
              <span>Active Workspace:</span>
              <span className="text-txt-primary">{activeBottomTab || 'Canvas'}</span>
            </div>
            <div className="flex justify-between">
              <span>Selected Focus:</span>
              <span className="text-txt-primary">
                {currentContext.selection.selectedNodeLabels.length > 0
                  ? currentContext.selection.selectedNodeLabels.join(', ')
                  : currentContext.selection.selectedEdgeDescriptions.length > 0
                  ? currentContext.selection.selectedEdgeDescriptions.join(', ')
                  : 'Entire Machine'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Alphabet Σ:</span>
              <span className="text-txt-primary">
                {currentContext.machine.alphabet.length > 0
                  ? `{${currentContext.machine.alphabet.join(', ')}}`
                  : 'Ø'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Messages & Actions Conversation Surface */}
      <div className="flex-1 p-3 overflow-y-auto space-y-3 font-sans text-xs">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4 space-y-3">
            <div className="p-3 bg-accent-purple/10 rounded-2xl border border-accent-purple/20 text-accent-purple">
              <Bot size={26} />
            </div>
            <div>
              <div className="font-bold text-txt-primary text-xs">Models of Computation AI Assistant</div>
              <p className="text-[11px] text-txt-muted mt-1 leading-relaxed max-w-[240px]">
                Ask theoretical questions, request step-by-step guidance, or propose machine modifications with confirmation.
              </p>
            </div>

            {/* Quick Assistant Action Prompts */}
            <div className="w-full max-w-[240px] pt-1 space-y-1.5">
              <button
                type="button"
                onClick={handleQuickExplainSelection}
                disabled={isLoading}
                className="w-full flex items-center space-x-2 px-2.5 py-1.5 text-left bg-bg-surface2 hover:bg-bg-surface3 border border-border-subtle rounded-lg text-txt-secondary hover:text-txt-primary transition-colors text-[11px]"
              >
                <HelpCircle size={13} className="text-accent-purple shrink-0" />
                <span>Explain {selectedCount > 0 ? 'Selection' : 'Current Machine'}</span>
              </button>
              <button
                type="button"
                onClick={handleQuickWhyInvalid}
                disabled={isLoading}
                className="w-full flex items-center space-x-2 px-2.5 py-1.5 text-left bg-bg-surface2 hover:bg-bg-surface3 border border-border-subtle rounded-lg text-txt-secondary hover:text-txt-primary transition-colors text-[11px]"
              >
                <AlertCircle size={13} className="text-accent-primary shrink-0" />
                <span>Why is this valid / invalid?</span>
              </button>
              <button
                type="button"
                onClick={handleQuickTeachConcept}
                disabled={isLoading}
                className="w-full flex items-center space-x-2 px-2.5 py-1.5 text-left bg-bg-surface2 hover:bg-bg-surface3 border border-border-subtle rounded-lg text-txt-secondary hover:text-txt-primary transition-colors text-[11px]"
              >
                <BookOpen size={13} className="text-accent-cyan shrink-0" />
                <span>Teach Me {machineType} Concepts</span>
              </button>
              <button
                type="button"
                onClick={handleQuickCompareConcept}
                disabled={isLoading}
                className="w-full flex items-center space-x-2 px-2.5 py-1.5 text-left bg-bg-surface2 hover:bg-bg-surface3 border border-border-subtle rounded-lg text-txt-secondary hover:text-txt-primary transition-colors text-[11px]"
              >
                <GitCompare size={13} className="text-semantic-success shrink-0" />
                <span>Compare Theoretical Models</span>
              </button>
            </div>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div
              key={`msg-${index}`}
              className={`flex flex-col ${
                msg.role === 'user' ? 'items-end' : 'items-start'
              }`}
            >
              <div className="text-[10px] font-mono text-txt-muted mb-0.5 px-1">
                {msg.role === 'user' ? 'You' : 'Project Zero AI'}
              </div>
              <div
                className={`max-w-[90%] rounded-xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap select-text ${
                  msg.role === 'user'
                    ? 'bg-accent-primary text-white rounded-br-none shadow-sm'
                    : 'bg-bg-surface2 text-txt-primary border border-border-subtle rounded-bl-none'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))
        )}

        {/* Phase 13 Proposed Action Card */}
        {pendingActionEnvelope && (
          <div className="p-3 bg-bg-surface2/90 border border-accent-purple/30 rounded-xl space-y-2.5 shadow-md animate-fadeIn font-sans">
            <div className="flex items-center space-x-2 text-accent-purple font-semibold text-xs">
              <Wrench size={14} className="shrink-0" />
              <span>Proposed Canvas Modifications</span>
            </div>

            {pendingActionEnvelope.summary && (
              <p className="text-[11px] text-txt-secondary leading-snug">
                {pendingActionEnvelope.summary}
              </p>
            )}

            <div className="p-2 bg-bg-surface1 rounded-lg border border-border-subtle/70 font-mono text-[10px] space-y-1 text-txt-primary">
              {pendingActionEnvelope.actions.map((act, i) => (
                <div key={act.id || `act-${i}`} className="flex items-start space-x-1.5">
                  <span className="text-accent-primary font-bold">+</span>
                  <span>
                    {act.description || `${act.type}: ${JSON.stringify(act.parameters)}`}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex items-center space-x-2 pt-1">
              <button
                type="button"
                onClick={handleApplyActions}
                className="flex-1 flex items-center justify-center space-x-1.5 py-1.5 px-3 bg-accent-primary hover:bg-accent-primary/90 text-white font-medium rounded-lg text-xs transition-colors"
              >
                <Check size={13} />
                <span>Apply Changes</span>
              </button>
              <button
                type="button"
                onClick={handleCancelActions}
                className="py-1.5 px-3 bg-bg-surface3 hover:bg-bg-surface2 text-txt-muted hover:text-txt-primary rounded-lg text-xs transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Action Success Alert */}
        {actionSuccessBanner && (
          <div className="p-2.5 bg-semantic-success/10 border border-semantic-success/30 rounded-lg text-semantic-success text-xs flex items-center space-x-2">
            <CheckCircle2 size={14} className="shrink-0" />
            <span className="text-[11px] font-medium">{actionSuccessBanner}</span>
          </div>
        )}

        {/* Action Error Alert */}
        {actionErrorBanner && (
          <div className="p-2.5 bg-semantic-error/10 border border-semantic-error/30 rounded-lg text-semantic-error text-xs flex items-start space-x-2">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <div className="leading-snug">
              <span className="font-semibold block text-[11px]">Action Validation Error</span>
              <span className="text-[10px] text-semantic-error/90">{actionErrorBanner}</span>
            </div>
          </div>
        )}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex items-center space-x-2 text-txt-muted text-xs p-2 bg-bg-surface2/50 rounded-lg border border-border-subtle/50 w-fit animate-pulse">
            <Loader2 size={13} className="animate-spin text-accent-purple" />
            <span className="font-mono text-[11px]">Reasoning...</span>
          </div>
        )}

        {/* Inference Error Alert */}
        {error && (
          <div className="p-2.5 bg-semantic-error/10 border border-semantic-error/30 rounded-lg text-semantic-error text-xs flex items-start space-x-2">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <div className="leading-snug">
              <span className="font-semibold block text-[11px]">Assistant Error</span>
              <span className="text-[10px] text-semantic-error/90">{error}</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Chat Prompt Input Bar */}
      <div className="p-2.5 border-t border-border-subtle bg-bg-surface2/50 shrink-0">
        <div className="flex items-center space-x-2 bg-bg-surface1 border border-border-subtle rounded-lg px-2.5 py-1.5 focus-within:border-accent-primary transition-colors">
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            placeholder={`Ask questions or propose modifications...`}
            aria-label="AI message input"
            className="w-full bg-transparent text-xs text-txt-primary placeholder-txt-muted outline-none resize-none disabled:opacity-50 font-sans"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            aria-label="Send message"
            className="p-1 text-accent-primary hover:text-accent-primary/80 disabled:opacity-30 disabled:cursor-not-allowed rounded transition-colors"
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};
