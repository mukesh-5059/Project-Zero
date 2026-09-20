import React, { useState } from 'react';
import { useGraph } from '../../../context/GraphContext';
import { useExecution } from '../../../context/ExecutionContext';
import { analyzeMachine, explainExecutionRun } from '@project-zero/core-solver';
import { fetchAIExplanation } from '../../../services/aiExplanationService';
import { Sparkles, CheckCircle2, AlertTriangle, HelpCircle, Layers, Cpu } from 'lucide-react';

export const MachineAnalysisView: React.FC = () => {
  const { nodes, edges, machineType } = useGraph();
  const { inputString, validationResult } = useExecution();

  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const analysis = analyzeMachine({ nodes, edges }, machineType);
  const executionExplanation = inputString
    ? explainExecutionRun({ nodes, edges }, inputString, machineType)
    : null;

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
    </div>
  );
};
