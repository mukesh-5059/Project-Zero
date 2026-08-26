import React, { useState } from 'react';
import { useGraph } from '../../../context/GraphContext';
import { useExecution } from '../../../context/ExecutionContext';
import { useWorkspace } from '../../../context/WorkspaceContext';
import { analyzeMachine, explainExecutionRun, convertNfaToDfa, minimizeDFA } from '@project-zero/core-solver';
import { fetchAIExplanation } from '../../../services/aiExplanationService';
import { RegexModal } from '../../modals/RegexModal';
import { Sparkles, CheckCircle2, AlertTriangle, HelpCircle, Layers, Cpu, Wand2, Code, RefreshCw, Zap } from 'lucide-react';

export const MachineAnalysisView: React.FC = () => {
  const [isRegexModalOpen, setIsRegexModalOpen] = useState(false);
  const { setActiveInspectorTab } = useWorkspace();
  const { nodes, edges, machineType, replaceMachine, setLastMinimizationResult, setLastRegexResult } = useGraph();
  const { inputString, validationResult } = useExecution();

  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const analysis = analyzeMachine({ nodes, edges }, machineType);
  const executionExplanation = inputString
    ? explainExecutionRun({ nodes, edges }, inputString, machineType)
    : null;

  const hasInitialState = React.useMemo(() => nodes.some((n) => n.isInitial), [nodes]);
  const hasAcceptingState = React.useMemo(() => nodes.some((n) => n.isAccepting), [nodes]);
  const isStructurallyValidFA = hasInitialState && hasAcceptingState;

  const isGraphNFA = React.useMemo(() => {
    if (!isStructurallyValidFA) return false;
    if (edges.some((e) => !e.label || e.label === 'ε' || e.label === 'λ' || e.label.trim() === '')) return true;
    for (const node of nodes) {
      const seen = new Set<string>();
      for (const e of edges.filter((edge) => edge.sourceNodeId === node.id)) {
        const sym = e.label.trim();
        if (seen.has(sym)) return true;
        seen.add(sym);
      }
    }
    return false;
  }, [nodes, edges, isStructurallyValidFA]);

  const isGraphDFA = React.useMemo(() => {
    if (!isStructurallyValidFA) return false;
    return !isGraphNFA;
  }, [isStructurallyValidFA, isGraphNFA]);

  const handleNfaToDfaConversion = () => {
    const res = convertNfaToDfa({ nodes, edges });
    if (res.success && res.nodes.length > 0) {
      replaceMachine([...res.nodes], [...res.edges], 'FA');
    }
  };

  const handleDfaMinimization = () => {
    const res = minimizeDFA({ nodes, edges });
    setLastMinimizationResult(res);
    if (res.success && !res.isAlreadyMinimal && res.nodes.length > 0) {
      replaceMachine([...res.nodes], [...res.edges], 'FA');
    }
    setActiveInspectorTab('explanation');
  };

  const handleFetchAIExplanation = async () => {
    setIsAiLoading(true);
    setAiError(null);
    try {
      const insight = await fetchAIExplanation({
        machineType,
        analysis,
        executionExplanation,
        validationErrors: validationResult.errors.map((e) => e.message),
      });
      setAiInsight(insight);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'AI Service is currently unavailable.');
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col p-3 select-none overflow-y-auto space-y-3.5 text-xs font-mono">
      {/* View Header */}
      <div className="border-b border-border-subtle pb-2 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="p-1 bg-accent-primary/15 text-accent-primary rounded">
            <Cpu size={15} />
          </div>
          <div>
            <h3 className="font-bold text-txt-primary text-xs uppercase tracking-wider">
              Machine Analysis
            </h3>
            <p className="text-[10px] text-txt-muted">Formal Graph & Telemetry Verified</p>
          </div>
        </div>
      </div>

      {/* Machine Summary Cards */}
      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="bg-bg-surface2/80 p-2 rounded-lg border border-border-subtle">
          <div className="text-txt-muted text-[9px] uppercase">Model Type</div>
          <div className="font-bold text-accent-primary text-xs mt-0.5">{analysis.machineType}</div>
        </div>
        <div className="bg-bg-surface2/80 p-2 rounded-lg border border-border-subtle">
          <div className="text-txt-muted text-[9px] uppercase">States |Q|</div>
          <div className="font-bold text-txt-primary text-xs mt-0.5">{analysis.stateCount}</div>
        </div>
        <div className="bg-bg-surface2/80 p-2 rounded-lg border border-border-subtle">
          <div className="text-txt-muted text-[9px] uppercase">Transitions |δ|</div>
          <div className="font-bold text-txt-primary text-xs mt-0.5">{analysis.transitionCount}</div>
        </div>
        <div className="bg-bg-surface2/80 p-2 rounded-lg border border-border-subtle">
          <div className="text-txt-muted text-[9px] uppercase">Alphabet |Σ|</div>
          <div className="font-bold text-semantic-info text-xs mt-0.5 truncate">
            {analysis.alphabet.length > 0 ? `{${analysis.alphabet.join(',')}}` : '∅'}
          </div>
        </div>
      </div>

      {/* Automata Transformations & Conversions Section */}
      <div className="p-2.5 rounded-lg border border-border-subtle bg-bg-surface2/60 space-y-2">
        <div className="font-bold text-txt-primary text-[11px] flex items-center space-x-1.5">
          <Wand2 size={13} className="text-accent-primary" />
          <span>Automata Transformations & Conversions</span>
        </div>

        <div className="space-y-1.5">
          {/* RegEx to NFA Button */}
          <button
            onClick={() => setIsRegexModalOpen(true)}
            className="w-full p-2 rounded-md border border-border-subtle bg-bg-surface1 hover:bg-bg-surface2 hover:border-accent-primary text-left transition-all flex items-center justify-between group cursor-pointer"
          >
            <div className="flex items-center space-x-2">
              <Code size={14} className="text-accent-primary shrink-0 group-hover:scale-110 transition-transform" />
              <div>
                <div className="font-bold text-txt-primary text-xs group-hover:text-accent-primary transition-colors">
                  RegEx → Thompson ε-NFA
                </div>
                <div className="text-[10px] text-txt-muted">Convert regular expression into state machine</div>
              </div>
            </div>
            <span className="text-[10px] font-bold text-accent-primary bg-accent-primary/10 px-1.5 py-0.5 rounded border border-accent-primary/20 shrink-0 ml-1">
              Run
            </span>
          </button>

          {/* NFA to DFA Button */}
          <button
            disabled={!isStructurallyValidFA || !isGraphNFA}
            onClick={handleNfaToDfaConversion}
            className={`w-full p-2 rounded-md border text-left transition-all flex items-center justify-between group ${
              isStructurallyValidFA && isGraphNFA
                ? 'border-border-subtle bg-bg-surface1 hover:bg-bg-surface2 hover:border-accent-cyan cursor-pointer'
                : 'border-border-subtle/50 bg-bg-surface1/40 opacity-50 cursor-not-allowed'
            }`}
          >
            <div className="flex items-center space-x-2">
              <RefreshCw size={14} className="text-accent-cyan shrink-0" />
              <div>
                <div className="font-bold text-txt-primary text-xs group-hover:text-accent-cyan transition-colors">
                  NFA → DFA Subset Construction
                </div>
                <div className="text-[10px] text-txt-muted">
                  {!hasInitialState
                    ? 'Requires initial state (q₀)'
                    : !hasAcceptingState
                    ? 'Requires final accepting state'
                    : !isGraphNFA
                    ? 'Already a deterministic DFA'
                    : 'Powerset state transformation'}
                </div>
              </div>
            </div>
            <span className="text-[10px] font-bold text-accent-cyan bg-accent-cyan/10 px-1.5 py-0.5 rounded border border-accent-cyan/20 shrink-0 ml-1">
              {isStructurallyValidFA && isGraphNFA ? 'Convert' : 'NFA only'}
            </span>
          </button>

          {/* DFA Minimization Button */}
          <button
            disabled={!isStructurallyValidFA || !isGraphDFA}
            onClick={handleDfaMinimization}
            className={`w-full p-2 rounded-md border text-left transition-all flex items-center justify-between group ${
              isStructurallyValidFA && isGraphDFA
                ? 'border-border-subtle bg-bg-surface1 hover:bg-bg-surface2 hover:border-semantic-accept cursor-pointer'
                : 'border-border-subtle/50 bg-bg-surface1/40 opacity-50 cursor-not-allowed'
            }`}
          >
            <div className="flex items-center space-x-2">
              <Zap size={14} className="text-semantic-accept shrink-0" />
              <div>
                <div className="font-bold text-txt-primary text-xs group-hover:text-semantic-accept transition-colors">
                  Hopcroft DFA Minimization
                </div>
                <div className="text-[10px] text-txt-muted">
                  {!hasInitialState
                    ? 'Requires initial state (q₀)'
                    : !hasAcceptingState
                    ? 'Requires final accepting state'
                    : isGraphNFA
                    ? 'Requires DFA (Convert NFA first)'
                    : 'State equivalence partition'}
                </div>
              </div>
            </div>
            <span className="text-[10px] font-bold text-semantic-accept bg-semantic-accept/10 px-1.5 py-0.5 rounded border border-semantic-accept/20 shrink-0 ml-1">
              {isStructurallyValidFA && isGraphDFA ? 'Minimize' : 'DFA only'}
            </span>
          </button>
        </div>
      </div>

      {/* Validation & Completeness Status */}
      <div className="space-y-1.5">
        <div
          className={`p-2 rounded-lg border flex items-center space-x-2 ${
            analysis.isStructurallyValid
              ? 'bg-semantic-accept/10 border-semantic-accept/30 text-semantic-accept'
              : 'bg-semantic-error/10 border-semantic-error/30 text-semantic-error'
          }`}
        >
          {analysis.isStructurallyValid ? <CheckCircle2 size={14} className="shrink-0" /> : <AlertTriangle size={14} className="shrink-0" />}
          <span className="font-bold text-[11px]">
            {analysis.isStructurallyValid ? `✓ Valid ${analysis.machineType}` : `✕ Invalid ${analysis.machineType}`}
          </span>
        </div>

        {analysis.machineType === 'DFA' && (
          <div
            className={`p-2 rounded-lg border flex items-center space-x-2 ${
              analysis.isCompleteDFA
                ? 'bg-semantic-accept/10 border-semantic-accept/30 text-semantic-accept'
                : 'bg-semantic-warning/10 border-semantic-warning/30 text-semantic-warning'
            }`}
          >
            <Layers size={14} className="shrink-0" />
            <span className="font-bold text-[11px]">
              {analysis.isCompleteDFA ? '✓ Complete DFA' : `⚠ Incomplete DFA (${analysis.missingDFATransitionCount} missing)`}
            </span>
          </div>
        )}
      </div>

      {/* Verified Structural Observations */}
      <div className="bg-bg-surface2/60 p-2.5 rounded-lg border border-border-subtle space-y-1.5">
        <div className="font-bold text-txt-primary flex items-center space-x-1 text-[11px]">
          <HelpCircle size={13} className="text-accent-primary shrink-0" />
          <span>Formal Graph Observations</span>
        </div>
        <ul className="space-y-1 text-txt-secondary text-[10px] leading-tight">
          {analysis.observations.map((obs, idx) => (
            <li key={idx} className="flex items-start space-x-1">
              <span className="text-accent-primary font-bold">•</span>
              <span>{obs}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Formal Execution Explanation if Input Exists */}
      {executionExplanation && (
        <div className="bg-bg-surface2/60 p-2.5 rounded-lg border border-border-subtle space-y-1.5">
          <div className="font-bold text-txt-primary flex items-center justify-between text-[11px]">
            <span className="truncate">Proof: "{executionExplanation.inputString}"</span>
            <span
              className={`px-1.5 py-0.2 rounded text-[9px] font-bold border shrink-0 ${
                executionExplanation.isAccepted
                  ? 'bg-semantic-accept/15 text-semantic-accept border-semantic-accept/30'
                  : 'bg-semantic-error/15 text-semantic-error border-semantic-error/30'
              }`}
            >
              {executionExplanation.isAccepted ? 'ACCEPT' : 'REJECT'}
            </span>
          </div>
          <pre className="p-2 bg-bg-surface3 rounded border border-border-subtle text-txt-primary text-[9px] font-mono leading-relaxed overflow-x-auto whitespace-pre-wrap max-h-36">
            {executionExplanation.formalProofText}
          </pre>
        </div>
      )}

      {/* AI Pedagogical Explanation Section */}
      <div className="border-t border-border-subtle pt-2.5 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1 text-txt-primary font-bold text-[11px]">
            <Sparkles size={13} className="text-accent-primary shrink-0" />
            <span>AI Tutor Proof</span>
          </div>
          <button
            type="button"
            onClick={handleFetchAIExplanation}
            disabled={isAiLoading}
            className="px-2 py-1 rounded bg-accent-primary hover:bg-accent-hover text-white font-semibold flex items-center space-x-1 transition-colors text-[10px] disabled:opacity-50"
          >
            <Sparkles size={11} />
            <span>{isAiLoading ? 'Synthesizing...' : 'Explain'}</span>
          </button>
        </div>

        {aiError && (
          <div className="p-2 bg-semantic-error/10 border border-semantic-error/30 text-semantic-error rounded text-[10px]">
            {aiError}
          </div>
        )}

        {aiInsight && (
          <div className="p-2.5 bg-accent-primary/10 border border-accent-primary/20 rounded text-txt-primary text-[10px] space-y-1">
            <div className="font-bold text-accent-primary text-[9px] uppercase">
              NVIDIA NIM AI Tutor:
            </div>
            <div className="leading-relaxed whitespace-pre-wrap">{aiInsight}</div>
          </div>
        )}
      </div>

      <RegexModal
        isOpen={isRegexModalOpen}
        onClose={() => setIsRegexModalOpen(false)}
        onGenerate={(newNodes, newEdges, regexResult, inputRegex) => {
          replaceMachine(newNodes, newEdges, 'NFA');
          setLastRegexResult({ inputRegex, result: regexResult });
          setActiveInspectorTab('explanation');
        }}
      />
    </div>
  );
};
