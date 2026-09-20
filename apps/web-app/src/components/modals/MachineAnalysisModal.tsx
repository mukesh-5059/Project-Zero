import React, { useState } from 'react';
import { useGraph } from '../../context/GraphContext';
import { useExecution } from '../../context/ExecutionContext';
import { analyzeMachine, explainExecutionRun } from '@project-zero/core-solver';
import { fetchAIExplanation } from '../../services/aiExplanationService';
import { X, Sparkles, CheckCircle2, AlertTriangle, HelpCircle, Layers, Cpu } from 'lucide-react';

interface AnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MachineAnalysisModal: React.FC<AnalysisModalProps> = ({ isOpen, onClose }) => {
  const { nodes, edges, machineType } = useGraph();
  const { inputString, validationResult } = useExecution();

  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);

  if (!isOpen) return null;

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs select-none">
      <div className="bg-bg-surface1 border border-border-subtle rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden text-xs font-mono animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border-subtle bg-bg-surface2/50">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-accent-primary/15 text-accent-primary rounded-md">
              <Cpu size={18} />
            </div>
            <div>
              <h3 className="font-bold text-txt-primary text-sm">Deterministic Machine Analysis</h3>
              <p className="text-[11px] text-txt-muted">Formal graph telemetry & verified mathematical facts</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-txt-muted hover:text-txt-primary p-1 rounded-md transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Machine Summary Cards */}
          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="bg-bg-surface2/80 p-2.5 rounded-lg border border-border-subtle">
              <div className="text-txt-muted text-[10px]">MODEL TYPE</div>
              <div className="font-bold text-accent-primary text-sm mt-0.5">{analysis.machineType}</div>
            </div>
            <div className="bg-bg-surface2/80 p-2.5 rounded-lg border border-border-subtle">
              <div className="text-txt-muted text-[10px]">STATES |Q|</div>
              <div className="font-bold text-txt-primary text-sm mt-0.5">{analysis.stateCount}</div>
            </div>
            <div className="bg-bg-surface2/80 p-2.5 rounded-lg border border-border-subtle">
              <div className="text-txt-muted text-[10px]">TRANSITIONS |δ|</div>
              <div className="font-bold text-txt-primary text-sm mt-0.5">{analysis.transitionCount}</div>
            </div>
            <div className="bg-bg-surface2/80 p-2.5 rounded-lg border border-border-subtle">
              <div className="text-txt-muted text-[10px]">ALPHABET |Σ|</div>
              <div className="font-bold text-semantic-info text-sm mt-0.5">
                {analysis.alphabet.length > 0 ? `{${analysis.alphabet.join(', ')}}` : '∅'}
              </div>
            </div>
          </div>

          {/* Validation & Completeness Status */}
          <div className="flex items-center space-x-2">
            <div
              className={`flex-1 p-2.5 rounded-lg border flex items-center space-x-2 ${
                analysis.isStructurallyValid
                  ? 'bg-semantic-accept/10 border-semantic-accept/30 text-semantic-accept'
                  : 'bg-semantic-error/10 border-semantic-error/30 text-semantic-error'
              }`}
            >
              {analysis.isStructurallyValid ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
              <span className="font-bold">
                {analysis.isStructurallyValid ? `✓ Valid ${analysis.machineType}` : `✕ Invalid ${analysis.machineType}`}
              </span>
            </div>

            {analysis.machineType === 'DFA' && (
              <div
                className={`flex-1 p-2.5 rounded-lg border flex items-center space-x-2 ${
                  analysis.isCompleteDFA
                    ? 'bg-semantic-accept/10 border-semantic-accept/30 text-semantic-accept'
                    : 'bg-semantic-warning/10 border-semantic-warning/30 text-semantic-warning'
                }`}
              >
                <Layers size={16} />
                <span className="font-bold">
                  {analysis.isCompleteDFA ? '✓ Complete DFA' : `⚠ Incomplete DFA (${analysis.missingDFATransitionCount} missing)`}
                </span>
              </div>
            )}
          </div>

          {/* Deterministic Observations */}
          <div className="bg-bg-surface2/60 p-3 rounded-lg border border-border-subtle space-y-2">
            <div className="font-bold text-txt-primary flex items-center space-x-1.5">
              <HelpCircle size={14} className="text-accent-primary" />
              <span>Verified Structural Facts & Telemetry:</span>
            </div>
            <ul className="space-y-1.5 text-txt-secondary text-[11px]">
              {analysis.observations.map((obs, idx) => (
                <li key={idx} className="flex items-start space-x-1.5">
                  <span className="text-accent-primary font-bold">•</span>
                  <span>{obs}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Formal Execution Explanation if Input Exists */}
          {executionExplanation && (
            <div className="bg-bg-surface2/60 p-3 rounded-lg border border-border-subtle space-y-2">
              <div className="font-bold text-txt-primary flex items-center justify-between">
                <span>Execution Proof: String "{executionExplanation.inputString}"</span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                    executionExplanation.isAccepted
                      ? 'bg-semantic-accept/15 text-semantic-accept border-semantic-accept/30'
                      : 'bg-semantic-error/15 text-semantic-error border-semantic-error/30'
                  }`}
                >
                  {executionExplanation.isAccepted ? 'ACCEPT' : 'REJECT'}
                </span>
              </div>
              <pre className="p-2.5 bg-bg-surface3 rounded border border-border-subtle text-txt-primary text-[10px] font-mono leading-relaxed overflow-x-auto whitespace-pre-wrap">
                {executionExplanation.formalProofText}
              </pre>
            </div>
          )}

          {/* AI Teaching & Pedagogical Explanation Section */}
          <div className="border-t border-border-subtle pt-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5 text-txt-primary font-bold">
                <Sparkles size={16} className="text-accent-primary" />
                <span>AI Tutor Pedagogical Insights (Optional)</span>
              </div>
              <button
                type="button"
                onClick={handleFetchAIExplanation}
                disabled={isAiLoading}
                className="px-3 py-1.5 rounded-md bg-accent-primary hover:bg-accent-hover text-white font-semibold flex items-center space-x-1.5 transition-colors shadow-xs text-[11px] disabled:opacity-50"
              >
                <Sparkles size={13} />
                <span>{isAiLoading ? 'Synthesizing...' : 'Explain Machine & Proof'}</span>
              </button>
            </div>

            {aiError && (
              <div className="p-2.5 bg-semantic-error/10 border border-semantic-error/30 text-semantic-error rounded-lg text-[11px]">
                {aiError}
              </div>
            )}

            {aiInsight && (
              <div className="p-3 bg-accent-primary/10 border border-accent-primary/20 rounded-lg text-txt-primary text-[11px] space-y-2 animate-in fade-in duration-150">
                <div className="font-bold text-accent-primary text-[10px] uppercase tracking-wider">
                  NVIDIA NIM AI Tutor Explanation:
                </div>
                <div className="leading-relaxed whitespace-pre-wrap">{aiInsight}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
