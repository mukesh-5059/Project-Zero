import React, { useMemo } from 'react';
import { useGraph } from '../../../context/GraphContext';
import { computeTransitionMatrix, expandSolverEdges } from '@project-zero/core-solver';

export const TransitionTableTab: React.FC = () => {
  const { nodes, edges, machineType } = useGraph();

  const matrix = useMemo(() => {
    return computeTransitionMatrix({ nodes, edges: expandSolverEdges(edges, machineType) });
  }, [nodes, edges, machineType]);

  if (nodes.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 text-txt-muted text-xs select-none">
        No state nodes placed yet. Add states to view the transition matrix.
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-3 text-xs font-mono select-none">
      <div className="mb-2 text-txt-muted text-[11px] flex items-center justify-between">
        <span>
          State Transition Matrix {machineType === 'TM' ? 'δ: Q × Γ → Q × Γ × {L, R, S}' : machineType === 'PDA' ? 'δ: Q × (Σ ∪ {ε}) × Γ → P(Q × Γ*)' : machineType === 'NFA' ? 'δ: Q × (Σ ∪ {ε}) → P(Q)' : 'δ: Q × Σ → Q'} (Initial: →, Accepting: *)
        </span>
        {matrix.hasAmbiguity && machineType === 'DFA' && (
          <span className="text-semantic-warning font-semibold bg-semantic-warning/10 border border-semantic-warning/30 px-1.5 py-0.5 rounded text-[10px]">
            ⚠ Ambiguous (NFA Branching in DFA mode)
          </span>
        )}
      </div>

      <table className="w-full text-left border-collapse bg-bg-surface2/60 border border-border-subtle rounded-lg overflow-hidden">
        <thead>
          <tr className="border-b border-border-subtle bg-bg-surface2 text-txt-muted">
            <th className="p-2 border-r border-border-subtle">State \ Symbol</th>
            {matrix.symbols.length > 0 ? (
              matrix.symbols.map((sym) => (
                <th key={sym} className="p-2 border-r border-border-subtle text-semantic-info font-bold">
                  {sym}
                </th>
              ))
            ) : (
              <th className="p-2 text-txt-muted italic">(No Alphabet Symbols)</th>
            )}
          </tr>
        </thead>
        <tbody>
          {matrix.entries.map((entry) => (
            <tr key={entry.stateId} className="border-b border-border-subtle hover:bg-bg-surface2/80 transition-colors">
              <td className="p-2 border-r border-border-subtle font-bold flex items-center space-x-1">
                {entry.isInitial && <span className="text-accent-primary" title="Initial State">→ </span>}
                {entry.isAccepting && <span className="text-semantic-accept" title="Accepting State">* </span>}
                <span className={entry.isAccepting ? 'text-semantic-accept' : 'text-accent-primary'}>
                  {entry.stateLabel}
                </span>
              </td>
              {matrix.symbols.length > 0 ? (
                matrix.symbols.map((sym) => {
                  const target = entry.transitions[sym];
                  const isAmbiguous = entry.hasAmbiguity[sym];

                  return (
                    <td key={sym} className="p-2 border-r border-border-subtle font-mono">
                      {target ? (
                        <span className={isAmbiguous ? 'text-semantic-warning font-bold' : 'text-txt-primary font-semibold'}>
                          {target}
                        </span>
                      ) : (
                        <span className="text-txt-muted italic">–</span>
                      )}
                    </td>
                  );
                })
              ) : (
                <td className="p-2 text-txt-muted italic">–</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

