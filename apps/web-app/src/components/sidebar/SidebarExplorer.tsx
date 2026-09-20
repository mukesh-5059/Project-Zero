import React, { useState } from 'react';
import { useGraph } from '../../context/GraphContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { Code, ArrowRightLeft, Zap } from 'lucide-react';
import { convertNfaToDfa, minimizeDFA, isFA_NFA, expandSolverEdges } from '@project-zero/core-solver';
import { RegexModal } from '../modals/RegexModal';

export const SidebarExplorer: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'create' | 'convert' | 'templates'>('create');
  const [isRegexModalOpen, setIsRegexModalOpen] = useState(false);
  const { nodes, edges, machineType, replaceMachine, setMachineType, setLastMinimizationResult, setLastRegexResult } = useGraph();
  const { expandPanel, setActiveInspectorTab } = useWorkspace();

  const isFAContext = machineType === 'FA' || machineType === 'DFA' || machineType === 'NFA';
  const hasInitialState = React.useMemo(() => nodes.some((n) => n.isInitial), [nodes]);
  const hasAcceptingState = React.useMemo(() => nodes.some((n) => n.isAccepting), [nodes]);
  const isStructurallyValidFA = isFAContext && hasInitialState && hasAcceptingState;

  const isGraphNFA = React.useMemo(() => {
    if (!isStructurallyValidFA) return false;
    return isFA_NFA(nodes, edges);
  }, [nodes, edges, isStructurallyValidFA]);

  const isGraphDFA = React.useMemo(() => {
    if (!isStructurallyValidFA) return false;
    return !isGraphNFA;
  }, [isStructurallyValidFA, isGraphNFA]);

  const handleNfaToDfaConversion = () => {
    if (!isFAContext) return;
    const res = convertNfaToDfa({ nodes, edges: expandSolverEdges(edges, 'FA') });
    if (res.success && res.nodes.length > 0) {
      replaceMachine([...res.nodes], [...res.edges], 'FA');
    }
  };

  const handleDfaMinimization = () => {
    if (!isFAContext) return;
    const res = minimizeDFA({ nodes, edges: expandSolverEdges(edges, 'FA') });
    setLastMinimizationResult(res);
    if (res.success && !res.isAlreadyMinimal && res.nodes.length > 0) {
      replaceMachine([...res.nodes], [...res.edges], 'FA');
    }
    setActiveInspectorTab('explanation');
  };

  React.useEffect(() => {
    if (nodes.length === 0) {
      replaceMachine(
        [
          { id: 'q0', label: 'q0', x: 200, y: 200, isInitial: true, isAccepting: true },
          { id: 'q1', label: 'q1', x: 400, y: 200, isInitial: false, isAccepting: false },
        ],
        [
          { id: 'e1', sourceNodeId: 'q0', targetNodeId: 'q1', label: 'a' },
          { id: 'e2', sourceNodeId: 'q1', targetNodeId: 'q0', label: 'b' },
        ],
        'FA'
      );
    }
  }, []);

  const handleStartBlank = (type: 'FA' | 'PDA' | 'TM') => {
    setMachineType(type);

    if (type === 'FA') {
      replaceMachine(
        [
          { id: 'q0', label: 'q0', x: 200, y: 200, isInitial: true, isAccepting: true },
          { id: 'q1', label: 'q1', x: 400, y: 200, isInitial: false, isAccepting: false },
        ],
        [
          { id: 'e1', sourceNodeId: 'q0', targetNodeId: 'q1', label: 'a' },
          { id: 'e2', sourceNodeId: 'q1', targetNodeId: 'q0', label: 'b' },
        ],
        'FA'
      );
    } else if (type === 'PDA') {
      replaceMachine(
        [
          { id: 'q0', label: 'q0', x: 200, y: 200, isInitial: true, isAccepting: false },
          { id: 'q1', label: 'q1', x: 450, y: 200, isInitial: false, isAccepting: true },
        ],
        [
          { id: 'e1', sourceNodeId: 'q0', targetNodeId: 'q0', label: 'a, Z0 -> aZ0' },
          { id: 'e2', sourceNodeId: 'q0', targetNodeId: 'q0', label: 'a, a -> aa' },
          { id: 'e3', sourceNodeId: 'q0', targetNodeId: 'q1', label: 'b, a -> ε' },
          { id: 'e4', sourceNodeId: 'q1', targetNodeId: 'q1', label: 'b, a -> ε' },
        ],
        'PDA'
      );
    } else if (type === 'TM') {
      replaceMachine(
        [
          { id: 'q0', label: 'q0', x: 200, y: 200, isInitial: true, isAccepting: false },
          { id: 'q1', label: 'q1', x: 450, y: 200, isInitial: false, isAccepting: true },
        ],
        [
          { id: 'e1', sourceNodeId: 'q0', targetNodeId: 'q0', label: '1 -> 1, R' },
          { id: 'e2', sourceNodeId: 'q0', targetNodeId: 'q1', label: '□ -> 1, S' },
        ],
        'TM'
      );
    }
  };

  const handleLoadExample = (exampleId: string) => {
    if (exampleId === 'dfa-1') {
      setMachineType('FA');
      replaceMachine(
        [
          { id: 'q0', label: 'q0', x: 200, y: 200, isInitial: true, isAccepting: true },
          { id: 'q1', label: 'q1', x: 420, y: 200, isInitial: false, isAccepting: false },
        ],
        [
          { id: 'e1', sourceNodeId: 'q0', targetNodeId: 'q1', label: '0' },
          { id: 'e2', sourceNodeId: 'q1', targetNodeId: 'q0', label: '0' },
          { id: 'e3', sourceNodeId: 'q0', targetNodeId: 'q0', label: '1' },
          { id: 'e4', sourceNodeId: 'q1', targetNodeId: 'q1', label: '1' },
        ],
        'FA'
      );
    } else if (exampleId === 'nfa-1') {
      setMachineType('FA');
      replaceMachine(
        [
          { id: 'q0', label: 'q0', x: 200, y: 200, isInitial: true, isAccepting: false },
          { id: 'q1', label: 'q1', x: 380, y: 200, isInitial: false, isAccepting: false },
          { id: 'q2', label: 'q2', x: 560, y: 200, isInitial: false, isAccepting: true },
        ],
        [
          { id: 'e1', sourceNodeId: 'q0', targetNodeId: 'q0', label: '0' },
          { id: 'e2', sourceNodeId: 'q0', targetNodeId: 'q0', label: '1' },
          { id: 'e3', sourceNodeId: 'q0', targetNodeId: 'q1', label: '0' },
          { id: 'e4', sourceNodeId: 'q1', targetNodeId: 'q2', label: '1' },
        ],
        'FA'
      );
    } else if (exampleId === 'pda-1') {
      setMachineType('PDA');
      replaceMachine(
        [
          { id: 'q0', label: 'q0', x: 200, y: 200, isInitial: true, isAccepting: false },
          { id: 'q1', label: 'q1', x: 420, y: 200, isInitial: false, isAccepting: true },
        ],
        [
          { id: 'e1', sourceNodeId: 'q0', targetNodeId: 'q0', label: 'a, Z0 -> aZ0' },
          { id: 'e2', sourceNodeId: 'q0', targetNodeId: 'q0', label: 'a, a -> aa' },
          { id: 'e3', sourceNodeId: 'q0', targetNodeId: 'q1', label: 'b, a -> ε' },
          { id: 'e4', sourceNodeId: 'q1', targetNodeId: 'q1', label: 'b, a -> ε' },
        ],
        'PDA'
      );
    } else if (exampleId === 'tm-1') {
      setMachineType('TM');
      replaceMachine(
        [
          { id: 'q0', label: 'q0', x: 200, y: 200, isInitial: true, isAccepting: false },
          { id: 'q1', label: 'q1', x: 420, y: 200, isInitial: false, isAccepting: true },
        ],
        [
          { id: 'e1', sourceNodeId: 'q0', targetNodeId: 'q0', label: '1 -> 1, R' },
          { id: 'e2', sourceNodeId: 'q0', targetNodeId: 'q1', label: '□ -> 1, S' },
        ],
        'TM'
      );
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden text-xs select-none">
      <div className="flex items-center space-x-1 p-2 border-b border-border-subtle bg-bg-surface2/30 shrink-0 font-mono text-[10px]">
        <button
          onClick={() => setActiveTab('create')}
          className={`flex-1 py-1 px-1.5 rounded text-center transition-colors ${
            activeTab === 'create'
              ? 'bg-accent-primary text-white font-bold'
              : 'text-txt-muted hover:text-txt-primary hover:bg-bg-surface3'
          }`}
        >
          Build
        </button>
        <button
          onClick={() => setActiveTab('convert')}
          className={`flex-1 py-1 px-1.5 rounded text-center transition-colors ${
            activeTab === 'convert'
              ? 'bg-accent-primary text-white font-bold'
              : 'text-txt-muted hover:text-txt-primary hover:bg-bg-surface3'
          }`}
        >
          Convert
        </button>
        <button
          onClick={() => setActiveTab('templates')}
          className={`flex-1 py-1 px-1.5 rounded text-center transition-colors ${
            activeTab === 'templates'
              ? 'bg-accent-primary text-white font-bold'
              : 'text-txt-muted hover:text-txt-primary hover:bg-bg-surface3'
          }`}
        >
          Library
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {activeTab === 'create' && (
          <div className="space-y-2">
            <div className="space-y-1">
              <span className="font-mono text-[10px] uppercase text-txt-muted tracking-wider block mb-1 px-1">
                Construct State Machine
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => handleStartBlank('FA')}
                  className="p-2 rounded-md bg-bg-surface2 hover:bg-bg-surface3 border border-border-subtle hover:border-accent-primary text-left transition-all flex flex-col space-y-0.5 col-span-2 cursor-pointer group"
                >
                  <span className="font-semibold text-txt-primary text-xs flex items-center justify-between group-hover:text-accent-primary transition-colors">
                    <span>FA — Finite Automaton</span>
                    <span className="text-[9px] font-mono px-1.5 py-0.2 bg-accent-primary/10 text-accent-primary rounded border border-accent-primary/20">
                      DFA / NFA
                    </span>
                  </span>
                  <span className="text-[10px] text-txt-muted">Dynamic Deterministic & Non-Deterministic State Machine</span>
                </button>

                <button
                  onClick={() => handleStartBlank('PDA')}
                  className="p-2 rounded-md bg-bg-surface2 hover:bg-bg-surface3 border border-border-subtle hover:border-border-strong text-left transition-all flex flex-col space-y-0.5 cursor-pointer"
                >
                  <span className="font-semibold text-txt-primary text-xs">PDA</span>
                  <span className="text-[10px] text-txt-muted">Pushdown Automaton</span>
                </button>

                <button
                  onClick={() => handleStartBlank('TM')}
                  className="p-2 rounded-md bg-bg-surface2 hover:bg-bg-surface3 border border-border-subtle hover:border-border-strong text-left transition-all flex flex-col space-y-0.5 cursor-pointer"
                >
                  <span className="font-semibold text-txt-primary text-xs">TM</span>
                  <span className="text-[10px] text-txt-muted">Turing Machine</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'convert' && (
          <div className="space-y-2">
            <span className="font-mono text-[10px] uppercase text-txt-muted tracking-wider block mb-1 px-1">
              Active Context: {machineType}
            </span>
            <div className="space-y-1">
              <button
                onClick={() => setIsRegexModalOpen(true)}
                className="w-full p-2 rounded-md bg-bg-surface2 hover:bg-bg-surface3 border border-border-subtle hover:border-accent-primary text-left transition-all flex items-center space-x-2 group cursor-pointer"
              >
                <Code size={14} className="text-accent-primary shrink-0 group-hover:scale-110 transition-transform" />
                <div>
                  <div className="font-medium text-txt-primary text-xs group-hover:text-accent-primary transition-colors">
                    RegEx → Thompson ε-NFA
                  </div>
                  <div className="text-[10px] text-txt-muted">Convert expression to state machine</div>
                </div>
              </button>

              <button
                disabled={!isStructurallyValidFA || !isGraphNFA}
                onClick={handleNfaToDfaConversion}
                className={`w-full p-2 rounded-md border text-left transition-all flex items-center space-x-2 ${
                  isStructurallyValidFA && isGraphNFA
                    ? 'bg-bg-surface2 hover:bg-bg-surface3 border-border-subtle hover:border-accent-cyan cursor-pointer group'
                    : 'bg-bg-surface2/40 border-border-subtle/50 opacity-50 cursor-not-allowed'
                }`}
              >
                <ArrowRightLeft size={14} className="text-accent-cyan shrink-0" />
                <div>
                  <div className="font-medium text-txt-primary text-xs">NFA → DFA Subset Construction</div>
                  <div className="text-[10px] text-txt-muted">
                    {!isFAContext
                      ? `Not applicable to ${machineType} (FA only)`
                      : !hasInitialState
                      ? 'Requires initial state (q₀)'
                      : !hasAcceptingState
                      ? 'Requires final accepting state'
                      : !isGraphNFA
                      ? 'Already a deterministic DFA'
                      : 'Powerset state transformation'}
                  </div>
                </div>
              </button>

              <button
                disabled={!isStructurallyValidFA || !isGraphDFA}
                onClick={handleDfaMinimization}
                className={`w-full p-2 rounded-md border text-left transition-all flex items-center space-x-2 ${
                  isStructurallyValidFA && isGraphDFA
                    ? 'bg-bg-surface2 hover:bg-bg-surface3 border-border-subtle hover:border-semantic-accept cursor-pointer group'
                    : 'bg-bg-surface2/40 border-border-subtle/50 opacity-50 cursor-not-allowed'
                }`}
              >
                <Zap size={14} className="text-semantic-accept shrink-0" />
                <div>
                  <div className="font-medium text-txt-primary text-xs">Hopcroft DFA Minimization</div>
                  <div className="text-[10px] text-txt-muted">
                    {!isFAContext
                      ? `Not applicable to ${machineType} (FA only)`
                      : !hasInitialState
                      ? 'Requires initial state (q₀)'
                      : !hasAcceptingState
                      ? 'Requires final accepting state'
                      : isGraphNFA
                      ? 'Requires DFA (Convert NFA first)'
                      : 'State equivalence partition'}
                  </div>
                </div>
              </button>
            </div>
          </div>
        )}

        {activeTab === 'templates' && (
          <div className="space-y-1.5">
            <span className="font-mono text-[10px] uppercase text-txt-muted tracking-wider block mb-1 px-1">
              Academic Example Workspaces
            </span>

            <button
              onClick={() => handleLoadExample('dfa-1')}
              className="w-full p-2 rounded-md bg-bg-surface2 hover:bg-bg-surface3 border border-border-subtle text-left transition-all flex items-center justify-between cursor-pointer"
            >
              <div>
                <div className="font-medium text-txt-primary">DFA: Even Count of Zeros</div>
                <div className="text-[10px] text-txt-muted">L = &#123; w | #₀(w) mod 2 = 0 &#125;</div>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 font-mono rounded bg-accent-primary/20 text-accent-primary border border-accent-primary/30">
                DFA
              </span>
            </button>

            <button
              onClick={() => handleLoadExample('nfa-1')}
              className="w-full p-2 rounded-md bg-bg-surface2 hover:bg-bg-surface3 border border-border-subtle text-left transition-all flex items-center justify-between cursor-pointer"
            >
              <div>
                <div className="font-medium text-txt-primary">NFA: Ends with "01"</div>
                <div className="text-[10px] text-txt-muted">L = &#123; w 01 | w ∈ &#123;0,1&#125;* &#125;</div>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 font-mono rounded bg-semantic-warning/20 text-semantic-warning border border-semantic-warning/30">
                NFA
              </span>
            </button>

            <button
              onClick={() => handleLoadExample('pda-1')}
              className="w-full p-2 rounded-md bg-bg-surface2 hover:bg-bg-surface3 border border-border-subtle text-left transition-all flex items-center justify-between cursor-pointer"
            >
              <div>
                <div className="font-medium text-txt-primary">PDA: L = &#123; aⁿbⁿ &#125;</div>
                <div className="text-[10px] text-txt-muted">Pushdown stack matching</div>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 font-mono rounded bg-semantic-accept/20 text-semantic-accept border border-semantic-accept/30">
                PDA
              </span>
            </button>

            <button
              onClick={() => handleLoadExample('tm-1')}
              className="w-full p-2 rounded-md bg-bg-surface2 hover:bg-bg-surface3 border border-border-subtle hover:border-border-strong text-left transition-all flex items-center justify-between cursor-pointer"
            >
              <div>
                <div className="font-medium text-txt-primary">TM: Unary Increment</div>
                <div className="text-[10px] text-txt-muted">Turing Machine tape increment</div>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 font-mono rounded bg-semantic-info/20 text-semantic-info border border-semantic-info/30">
                TM
              </span>
            </button>
          </div>
        )}
      </div>

      <div className="p-2.5 border-t border-border-subtle bg-bg-surface2/60 space-y-1">
        <div className="flex items-center justify-between font-medium text-txt-primary">
          <span>Active Workspace</span>
          <span className="text-[10px] px-1.5 py-0.2 font-mono rounded bg-accent-primary/20 text-accent-primary border border-accent-primary/30">
            {machineType}
          </span>
        </div>
        <p className="text-[11px] text-txt-muted">Unified Computational Laboratory Workspace Active.</p>
      </div>

      <RegexModal
        isOpen={isRegexModalOpen}
        onClose={() => setIsRegexModalOpen(false)}
        onGenerate={(newNodes, newEdges, regexResult, inputRegex) => {
          replaceMachine(newNodes, newEdges, 'NFA');
          setLastRegexResult({ inputRegex, result: regexResult });
          expandPanel('inspector');
          setActiveInspectorTab('explanation');
        }}
      />
    </div>
  );
};
