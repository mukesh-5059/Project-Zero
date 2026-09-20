import React from 'react';
import { useGraph } from '../../../context/GraphContext';
import { minimizeDFA, expandSolverEdges } from '@project-zero/core-solver';
import { Cpu, Layers, CheckCircle2, AlertTriangle, HelpCircle, ArrowRight, ShieldCheck } from 'lucide-react';

export const MinimizationExplanationTab: React.FC = () => {
  const { lastMinimizationResult, nodes, edges, machineType, setLastMinimizationResult, replaceMachine } = useGraph();

  const handleRunMinimization = () => {
    if (machineType !== 'DFA' && machineType !== 'FA') return;
    const res = minimizeDFA({ nodes, edges: expandSolverEdges(edges, 'FA') });
    setLastMinimizationResult(res);
    if (res.success && !res.isAlreadyMinimal && res.nodes.length > 0) {
      replaceMachine([...res.nodes], [...res.edges], 'FA');
    }
  };

  if (!lastMinimizationResult) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center select-none bg-bg-surface1 text-xs font-mono space-y-3">
        <div className="p-3 rounded-full bg-accent-primary/10 text-accent-primary border border-accent-primary/20">
          <Cpu size={28} />
        </div>
        <div className="max-w-md space-y-1">
          <h3 className="font-bold text-txt-primary text-sm">No Minimization Performed Yet</h3>
          <p className="text-txt-muted text-[11px]">
            Run Hopcroft Partition Refinement Minimization on your active DFA to inspect step-by-step equivalence classes, partition splits, and formal 5-tuple proofs.
          </p>
        </div>
        {machineType === 'DFA' || machineType === 'FA' ? (
          <button
            onClick={handleRunMinimization}
            className="px-4 py-1.5 rounded-md bg-accent-primary hover:bg-accent-hover text-white font-semibold flex items-center space-x-1.5 transition-colors shadow-xs"
          >
            <span>Run Hopcroft Minimization Now</span>
            <ArrowRight size={14} />
          </button>
        ) : (
          <div className="px-3 py-1.5 rounded bg-semantic-warning/15 border border-semantic-warning/30 text-semantic-warning text-[11px] font-medium">
            Active workspace is {machineType}. Hopcroft minimization is only applicable to Finite Automata (DFA).
          </div>
        )}
      </div>
    );
  }

  const res = lastMinimizationResult;
  const trace = res.trace;

  return (
    <div className="flex-1 flex flex-col overflow-y-auto p-4 space-y-4 bg-bg-surface1 text-xs font-mono select-none">
      {/* Top Banner & Quick Trigger */}
      <div className="flex items-center justify-between border-b border-border-subtle pb-3 shrink-0">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 bg-accent-primary/15 text-accent-primary rounded-md">
            <Cpu size={18} />
          </div>
          <div>
            <h3 className="font-bold text-txt-primary text-sm">Hopcroft DFA Minimization Analysis</h3>
            <p className="text-[11px] text-txt-muted">Formal partition refinement proof & state equivalence classes</p>
          </div>
        </div>
        {machineType === 'DFA' && (
          <button
            onClick={handleRunMinimization}
            className="px-3 py-1 rounded bg-bg-surface2 hover:bg-bg-surface3 border border-border-subtle text-txt-primary font-medium flex items-center space-x-1 text-[11px] transition-colors"
          >
            <span>Re-run Minimization</span>
            <ArrowRight size={12} />
          </button>
        )}
      </div>

      {/* Status Header */}
      <div
        className={`p-3 rounded-lg border flex items-center space-x-2.5 ${
          res.success
            ? 'bg-semantic-accept/10 border-semantic-accept/30 text-semantic-accept'
            : 'bg-semantic-error/10 border-semantic-error/30 text-semantic-error'
        }`}
      >
        {res.success ? <CheckCircle2 size={18} className="shrink-0" /> : <AlertTriangle size={18} className="shrink-0" />}
        <div className="font-bold text-xs">
          {res.success
            ? res.isAlreadyMinimal
              ? '✓ DFA is already minimal! No state reduction possible.'
              : `✓ Hopcroft Reduction Complete: Reduced from ${res.reachableStateCount} to ${res.minimizedStateCount} state(s) (Merged ${res.mergedStateCount}).`
            : `✕ Minimization Error: ${res.errorMessage}`}
        </div>
      </div>

      {/* Metrics Summary Grid */}
      <div className="grid grid-cols-5 gap-2 text-center">
        <div className="bg-bg-surface2/80 p-2.5 rounded-lg border border-border-subtle">
          <div className="text-txt-muted text-[10px]">ORIGINAL STATES</div>
          <div className="font-bold text-txt-primary text-sm mt-0.5">{res.originalStateCount}</div>
        </div>
        <div className="bg-bg-surface2/80 p-2.5 rounded-lg border border-border-subtle">
          <div className="text-txt-muted text-[10px]">REACHABLE STATES</div>
          <div className="font-bold text-txt-primary text-sm mt-0.5">{res.reachableStateCount}</div>
        </div>
        <div className="bg-bg-surface2/80 p-2.5 rounded-lg border border-border-subtle">
          <div className="text-txt-muted text-[10px]">UNREACHABLE</div>
          <div className="font-bold text-semantic-warning text-sm mt-0.5">{res.unreachableStateCount}</div>
        </div>
        <div className="bg-bg-surface2/80 p-2.5 rounded-lg border border-border-subtle">
          <div className="text-txt-muted text-[10px]">MINIMIZED STATES</div>
          <div className="font-bold text-accent-primary text-sm mt-0.5">{res.minimizedStateCount}</div>
        </div>
        <div className="bg-bg-surface2/80 p-2.5 rounded-lg border border-border-subtle">
          <div className="text-txt-muted text-[10px]">MERGED STATES</div>
          <div className="font-bold text-semantic-accept text-sm mt-0.5">{res.mergedStateCount}</div>
        </div>
      </div>

      {/* Partition Refinement Step-by-Step Breakdown */}
      {trace && trace.steps && trace.steps.length > 0 && (
        <div className="bg-bg-surface2/60 p-3.5 rounded-lg border border-border-subtle space-y-3">
          <div className="font-bold text-txt-primary flex items-center space-x-1.5 text-xs">
            <Layers size={14} className="text-accent-primary" />
            <span>Partition Refinement Sequence (P₀ → P_final)</span>
          </div>

          <div className="space-y-2">
            {trace.steps.map((step, idx) => (
              <div key={idx} className="bg-bg-surface3 p-2.5 rounded border border-border-subtle space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-accent-primary">Iteration {step.iteration}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] ${step.splitOccurred ? 'bg-semantic-warning/15 text-semantic-warning' : 'bg-semantic-accept/15 text-semantic-accept'}`}>
                    {step.splitOccurred ? 'Split Occurred' : 'Stabilized'}
                  </span>
                </div>
                <div className="text-[11px] text-txt-muted">{step.description}</div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {step.currentPartitionLabels.map((group, gIdx) => (
                    <div key={gIdx} className="px-2 py-1 bg-bg-surface1 rounded border border-border-subtle text-[11px] font-bold text-txt-secondary">
                      P_{step.iteration}[{gIdx}] = &#123;{group.join(', ')}&#125;
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Equivalence Classes Table */}
      {res.equivalenceClasses.length > 0 && (
        <div className="bg-bg-surface2/60 p-3.5 rounded-lg border border-border-subtle space-y-2">
          <div className="font-bold text-txt-primary flex items-center space-x-1.5 text-xs">
            <ShieldCheck size={14} className="text-semantic-accept" />
            <span>Final Equivalence Classes ([q] ∈ Q')</span>
          </div>
          <div className="space-y-1 text-txt-secondary text-[11px]">
            {res.equivalenceClasses.map((eq, idx) => (
              <div
                key={idx}
                className="p-2.5 bg-bg-surface3 rounded border border-border-subtle flex items-center justify-between"
              >
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-accent-primary">
                    State {eq.minimizedStateLabel}
                  </span>
                  {eq.isInitial && <span className="text-[10px] bg-accent-primary/20 text-accent-primary px-1.5 py-0.2 rounded font-semibold">q₀</span>}
                  {eq.isAccepting && <span className="text-[10px] bg-semantic-accept/20 text-semantic-accept px-1.5 py-0.2 rounded font-semibold">F</span>}
                </div>
                <div className="text-txt-muted font-mono">
                  Equivalent Original States: &#123;{eq.originalStateLabels.join(', ')}&#125;
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Theoretical Explanation */}
      <div className="bg-bg-surface2/40 p-3.5 rounded-lg border border-border-subtle space-y-2 text-[11px] text-txt-secondary">
        <div className="font-bold text-txt-primary flex items-center space-x-1.5">
          <HelpCircle size={14} className="text-accent-primary" />
          <span>Why is this result minimal? (Myhill-Nerode & Hopcroft Theorem)</span>
        </div>
        <p className="leading-relaxed text-txt-muted">
          Hopcroft's algorithm partitions states into equivalence classes such that two states <i>p, q</i> are placed in the same group if and only if for every input string <i>w ∈ Σ*</i>, transition <i>δ(p, w)</i> and <i>δ(q, w)</i> lead to states with identical accepting/non-accepting status. Unreachable states are purged, and indistinguishable states are unified into a single canonical state.
        </p>
      </div>
    </div>
  );
};
