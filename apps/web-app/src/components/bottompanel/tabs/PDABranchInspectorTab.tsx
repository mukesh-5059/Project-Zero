import React, { useState } from 'react';
import { useGraph } from '../../../context/GraphContext';
import { useExecution } from '../../../context/ExecutionContext';
import { PDABranchNode, PDAExecutionResult } from '@project-zero/core-solver';
import { GitBranch, CheckCircle2, XCircle, CornerDownRight } from 'lucide-react';

export const PDABranchInspectorTab: React.FC = () => {
  const { machineType } = useGraph();
  const { executionResult, setCurrentStepIndex } = useExecution();
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  if (machineType !== 'PDA') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-txt-muted font-mono text-xs">
        <GitBranch size={32} className="mb-2 text-border-strong" />
        <span>PDA Nondeterministic Branch Inspector is active for Pushdown Automata only.</span>
      </div>
    );
  }

  if (!executionResult || !('branchTree' in executionResult)) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-txt-muted font-mono text-xs">
        <GitBranch size={32} className="mb-2 text-border-strong" />
        <span>No active PDA branch tree telemetry available. Run simulation to inspect branches.</span>
      </div>
    );
  }

  const pdaResult = executionResult as PDAExecutionResult;
  const branchTree = pdaResult?.branchTree;

  if (!branchTree) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-txt-muted font-mono text-xs">
        <span>No branch tree telemetry available for current input.</span>
      </div>
    );
  }

  const handleSelectBranchNode = (node: PDABranchNode) => {
    setSelectedNodeId(node.id);
    if (node.historySteps.length > 0) {
      setCurrentStepIndex(node.historySteps.length - 1);
    }
  };

  const renderTreeNode = (node: PDABranchNode, depth: number = 0) => {
    const isSelected = selectedNodeId === node.id;
    const isAccepting = node.status === 'ACCEPTING';

    return (
      <div key={node.id} className="space-y-1">
        <div
          onClick={() => handleSelectBranchNode(node)}
          style={{ paddingLeft: `${depth * 18 + 8}px` }}
          className={`flex items-center space-x-2 py-1.5 px-2 rounded cursor-pointer transition-all border text-xs font-mono ${
            isSelected
              ? 'bg-accent-primary/20 border-accent-primary text-txt-primary font-bold shadow-sm'
              : isAccepting
              ? 'bg-semantic-accept/10 border-semantic-accept/30 text-semantic-accept font-semibold'
              : 'bg-bg-surface2/60 border-border-subtle hover:bg-bg-surface2 text-txt-secondary'
          }`}
        >
          {depth > 0 && <CornerDownRight size={12} className="text-txt-muted shrink-0" />}
          <GitBranch size={12} className={isAccepting ? 'text-semantic-accept' : 'text-accent-primary'} />
          <span className="font-bold text-accent-primary">{node.stateLabel}</span>
          <span className="text-txt-muted text-[11px]">Idx: {node.inputIndex}</span>
          <span className="text-semantic-info font-bold text-[11px]">
            Stack: [{node.stack.join(', ')}]
          </span>

          {isAccepting ? (
            <span className="ml-auto text-[10px] px-1.5 py-0.2 rounded bg-semantic-accept/20 text-semantic-accept border border-semantic-accept/30 font-bold flex items-center space-x-1">
              <CheckCircle2 size={10} />
              <span>ACCEPT</span>
            </span>
          ) : (
            <span className="ml-auto text-[10px] text-txt-muted">Depth {node.depth}</span>
          )}
        </div>

        {node.children.length > 0 && (
          <div className="space-y-1">
            {node.children.map((child) => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden text-xs font-mono select-none">
      {/* Header Telemetry */}
      <div className="p-2 border-b border-border-subtle bg-bg-surface2/50 flex items-center justify-between flex-wrap gap-2 shrink-0">
        <div className="flex items-center space-x-2">
          <span className="text-txt-secondary font-bold flex items-center space-x-1">
            <GitBranch size={14} className="text-accent-primary" />
            <span>PDA Nondeterministic Execution Tree</span>
          </span>
          <span className="px-2 py-0.5 rounded bg-bg-surface3 border border-border-subtle text-[11px]">
            Total Nodes: <span className="font-bold text-txt-primary">{branchTree.totalNodes}</span>
          </span>
          <span className="px-2 py-0.5 rounded bg-bg-surface3 border border-border-subtle text-[11px]">
            Max Depth: <span className="font-bold text-txt-primary">{branchTree.maxDepth}</span>
          </span>
        </div>

        {pdaResult.isAccepted ? (
          <span className="text-semantic-accept text-[11px] bg-semantic-accept/10 border border-semantic-accept/30 px-2 py-0.5 rounded flex items-center space-x-1 font-bold">
            <CheckCircle2 size={12} />
            <span>Path Accepted</span>
          </span>
        ) : (
          <span className="text-semantic-error text-[11px] bg-semantic-error/10 border border-semantic-error/30 px-2 py-0.5 rounded flex items-center space-x-1 font-bold">
            <XCircle size={12} />
            <span>All Branches Rejected / Halted</span>
          </span>
        )}
      </div>

      {/* Interactive Tree View */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {renderTreeNode(branchTree.root)}
      </div>
    </div>
  );
};
