import React, { useState, useMemo } from 'react';
import { useGraph } from '../../../context/GraphContext';
import {
  convertNfaToDfaWithTrace,
  minimizeDFAWithTrace,
  NFAConversionStep,
  DFAMinimizationStep,
  expandSolverEdges,
} from '@project-zero/core-solver';
import {
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  SkipBack,
  SkipForward,
  CheckCircle2,
  Cpu,
  Layers,
} from 'lucide-react';

export const AlgorithmVisualizerTab: React.FC = () => {
  const { nodes, edges, machineType, replaceMachine } = useGraph();
  const [stepIndex, setStepIndex] = useState<number>(0);

  // Compute derivation trace on-the-fly from the mathematical core-solver
  const conversionTraceResult = useMemo(() => {
    if (machineType === 'NFA') {
      return convertNfaToDfaWithTrace({ nodes, edges: expandSolverEdges(edges, 'FA') });
    }
    return null;
  }, [nodes, edges, machineType]);

  const minimizationTraceResult = useMemo(() => {
    if (machineType === 'DFA') {
      return minimizeDFAWithTrace({ nodes, edges: expandSolverEdges(edges, 'FA') });
    }
    return null;
  }, [nodes, edges, machineType]);

  const nfaSteps = conversionTraceResult?.trace?.steps ?? [];
  const dfaMinSteps = minimizationTraceResult?.trace?.steps ?? [];

  const maxSteps = machineType === 'NFA' ? nfaSteps.length : dfaMinSteps.length;

  const currentStep = useMemo(() => {
    if (maxSteps === 0) return null;
    const clamped = Math.min(Math.max(0, stepIndex), maxSteps - 1);
    if (machineType === 'NFA') return nfaSteps[clamped] || null;
    return dfaMinSteps[clamped] || null;
  }, [machineType, stepIndex, maxSteps, nfaSteps, dfaMinSteps]);

  const handleFirst = () => setStepIndex(0);
  const handleBack = () => setStepIndex((prev) => Math.max(0, prev - 1));
  const handleNext = () => setStepIndex((prev) => Math.min(maxSteps - 1, prev + 1));
  const handleLast = () => setStepIndex(Math.max(0, maxSteps - 1));
  const handleReset = () => setStepIndex(0);

  const handleCommitConversion = () => {
    if (machineType === 'NFA' && conversionTraceResult?.success) {
      replaceMachine(
        [...conversionTraceResult.nodes],
        [...conversionTraceResult.edges],
        'DFA'
      );
    } else if (machineType === 'DFA' && minimizationTraceResult?.success) {
      replaceMachine(
        [...minimizationTraceResult.nodes],
        [...minimizationTraceResult.edges],
        'DFA'
      );
    }
  };

  if (machineType !== 'NFA' && machineType !== 'DFA') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-txt-muted font-mono text-xs">
        <Cpu size={32} className="mb-2 text-border-strong" />
        <span>Algorithm Visualization available for NFA (Subset Construction) and DFA (Minimization).</span>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden text-xs font-mono select-none">
      {/* Top Toolbar Navigation */}
      <div className="p-2 border-b border-border-subtle bg-bg-surface2/50 flex items-center justify-between flex-wrap gap-2 shrink-0">
        <div className="flex items-center space-x-2">
          <span className="text-txt-secondary font-bold flex items-center space-x-1">
            <Cpu size={14} className="text-accent-primary" />
            <span>{machineType === 'NFA' ? 'Subset Construction (NFA → DFA)' : 'Partition Refinement (DFA Minimization)'}</span>
          </span>

          <span className="px-2 py-0.5 rounded bg-bg-surface3 border border-border-subtle text-[11px] text-txt-secondary">
            Step {maxSteps > 0 ? Math.min(stepIndex + 1, maxSteps) : 0} of {maxSteps}
          </span>
        </div>

        {/* Stepping controls */}
        <div className="flex items-center space-x-1">
          <button
            onClick={handleFirst}
            disabled={stepIndex === 0 || maxSteps === 0}
            className="p-1 rounded bg-bg-surface3 hover:bg-bg-surface1 disabled:opacity-40 text-txt-primary transition-all"
            title="First Step"
          >
            <SkipBack size={14} />
          </button>
          <button
            onClick={handleBack}
            disabled={stepIndex === 0 || maxSteps === 0}
            className="p-1 rounded bg-bg-surface3 hover:bg-bg-surface1 disabled:opacity-40 text-txt-primary transition-all"
            title="Previous Step"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            onClick={handleNext}
            disabled={stepIndex >= maxSteps - 1 || maxSteps === 0}
            className="p-1 rounded bg-bg-surface3 hover:bg-bg-surface1 disabled:opacity-40 text-txt-primary transition-all"
            title="Next Step"
          >
            <ChevronRight size={14} />
          </button>
          <button
            onClick={handleLast}
            disabled={stepIndex >= maxSteps - 1 || maxSteps === 0}
            className="p-1 rounded bg-bg-surface3 hover:bg-bg-surface1 disabled:opacity-40 text-txt-primary transition-all"
            title="Last Step"
          >
            <SkipForward size={14} />
          </button>
          <button
            onClick={handleReset}
            disabled={stepIndex === 0}
            className="p-1 rounded bg-bg-surface3 hover:bg-bg-surface1 disabled:opacity-40 text-txt-primary transition-all ml-1"
            title="Reset Navigation"
          >
            <RotateCcw size={14} />
          </button>
        </div>

        {/* Explicit Commit Button */}
        <button
          onClick={handleCommitConversion}
          disabled={machineType === 'NFA' ? !conversionTraceResult?.success : !minimizationTraceResult?.success}
          className="px-3 py-1 rounded bg-accent-primary hover:bg-accent-primary/90 text-txt-onAccent font-bold flex items-center space-x-1.5 transition-all text-xs shadow-sm disabled:opacity-50"
        >
          <CheckCircle2 size={13} />
          <span>{machineType === 'NFA' ? 'Commit Generated DFA' : 'Apply Minimized DFA'}</span>
        </button>
      </div>

      {/* Main Algorithm Telemetry Display */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {machineType === 'NFA' && currentStep && (
          <div className="space-y-3">
            {/* Step Formal Derivation Card */}
            <div className="p-3 bg-bg-surface2/60 border border-border-subtle rounded-xl space-y-2">
              <div className="text-xs font-bold text-accent-primary flex items-center space-x-1">
                <Layers size={14} />
                <span>Formal Derivation: Step {(currentStep as NFAConversionStep).stepIndex + 1}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="p-2 bg-bg-surface3 rounded-lg border border-border-subtle">
                  <div className="text-txt-muted text-[11px]">Current Subset (S):</div>
                  <div className="font-bold text-txt-primary mt-0.5">{(currentStep as NFAConversionStep).currentDfaStateLabel}</div>
                  <div className="text-[10px] text-txt-muted mt-1 font-mono">
                    NFA States: [{(currentStep as NFAConversionStep).currentNfaStateLabels.join(', ')}]
                  </div>
                </div>

                <div className="p-2 bg-bg-surface3 rounded-lg border border-border-subtle">
                  <div className="text-txt-muted text-[11px]">Symbol & Transition:</div>
                  <div className="font-bold text-semantic-info mt-0.5">
                    Symbol (a): '{(currentStep as NFAConversionStep).symbol}'
                  </div>
                  <div className="text-[10px] text-txt-muted mt-1 font-mono">
                    MOVE(S, a) → [{(currentStep as NFAConversionStep).movedNfaStateLabels.join(', ') || 'Ø'}]
                  </div>
                </div>

                <div className="p-2 bg-bg-surface3 rounded-lg border border-border-subtle">
                  <div className="text-txt-muted text-[11px]">Resulting Subset S' = ε-closure:</div>
                  <div className="font-bold text-accent-primary mt-0.5 flex items-center space-x-1">
                    <span>{(currentStep as NFAConversionStep).targetDfaStateLabel}</span>
                    {(currentStep as NFAConversionStep).isNewState && (
                      <span className="text-[9px] px-1 py-0.2 bg-semantic-accept/20 text-semantic-accept rounded font-bold">
                        NEW
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-txt-muted mt-1 font-mono">
                    Target States: [{(currentStep as NFAConversionStep).targetEpsilonClosureLabels.join(', ') || 'Ø'}]
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {machineType === 'DFA' && currentStep && (
          <div className="space-y-3">
            {/* Partition Refinement Step Card */}
            <div className="p-3 bg-bg-surface2/60 border border-border-subtle rounded-xl space-y-2">
              <div className="text-xs font-bold text-accent-primary flex items-center space-x-1">
                <Layers size={14} />
                <span>Partition Refinement: {(currentStep as DFAMinimizationStep).description}</span>
              </div>
              <div className="space-y-1">
                <div className="text-[11px] text-txt-muted font-semibold">Equivalence Partitions (P{(currentStep as DFAMinimizationStep).iteration}):</div>
                <div className="flex flex-wrap gap-2">
                  {(currentStep as DFAMinimizationStep).currentPartitionLabels.map((group, gIdx) => (
                    <span
                      key={gIdx}
                      className="px-2.5 py-1 rounded bg-bg-surface3 border border-border-subtle text-txt-primary font-bold font-mono"
                    >
                      {`{${group.join(', ')}}`}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
