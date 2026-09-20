import React, { useState, useMemo } from 'react';
import { useGraph } from '../../../context/GraphContext';
import { useExecution } from '../../../context/ExecutionContext';
import {
  analyzeMachine,
  compareAutomataLanguages,
  constructProductAutomaton,
  complementDFA,
  convertNfaToDfa,
  minimizeDFA,
  generateEquivalenceProof,
  generateCounterexampleTrace,
  generateTransformationProof,
  LanguageOperationType,
  ProductAutomatonResult,
  expandSolverEdges,
} from '@project-zero/core-solver';
import { StateNode, TransitionEdge } from '@project-zero/canvas-renderer';
import {
  Search,
  ArrowRightLeft,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Play,
  Layers,
  HelpCircle,
  Hash,
  Sparkles,
  GitMerge,
  FileCode,
  BookOpen,
} from 'lucide-react';

// Preset comparison machines for educational workbench testing
const PRESET_MACHINES: Array<{ name: string; type: 'DFA' | 'NFA'; nodes: StateNode[]; edges: TransitionEdge[] }> = [
  {
    name: 'Accepts Single "a"',
    type: 'DFA',
    nodes: [
      { id: 'p0', label: 'p0', x: 0, y: 0, isInitial: true, isAccepting: false },
      { id: 'p1', label: 'p1', x: 100, y: 0, isInitial: false, isAccepting: true },
    ],
    edges: [{ id: 'pe0', sourceNodeId: 'p0', targetNodeId: 'p1', label: 'a' }],
  },
  {
    name: 'Accepts Single "b"',
    type: 'DFA',
    nodes: [
      { id: 'p0', label: 'p0', x: 0, y: 0, isInitial: true, isAccepting: false },
      { id: 'p1', label: 'p1', x: 100, y: 0, isInitial: false, isAccepting: true },
    ],
    edges: [{ id: 'pe0', sourceNodeId: 'p0', targetNodeId: 'p1', label: 'b' }],
  },
  {
    name: 'Accepts Even Length Strings (a|b)*',
    type: 'DFA',
    nodes: [
      { id: 'even', label: 'even', x: 0, y: 0, isInitial: true, isAccepting: true },
      { id: 'odd', label: 'odd', x: 100, y: 0, isInitial: false, isAccepting: false },
    ],
    edges: [
      { id: 'pe1', sourceNodeId: 'even', targetNodeId: 'odd', label: 'a' },
      { id: 'pe2', sourceNodeId: 'even', targetNodeId: 'odd', label: 'b' },
      { id: 'pe3', sourceNodeId: 'odd', targetNodeId: 'even', label: 'a' },
      { id: 'pe4', sourceNodeId: 'odd', targetNodeId: 'even', label: 'b' },
    ],
  },
  {
    name: 'Empty Language Automaton L(M) = ∅',
    type: 'DFA',
    nodes: [
      { id: 'q0', label: 'q0', x: 0, y: 0, isInitial: true, isAccepting: false },
      { id: 'q1', label: 'q1', x: 100, y: 0, isInitial: false, isAccepting: false },
    ],
    edges: [{ id: 'pe5', sourceNodeId: 'q0', targetNodeId: 'q1', label: 'a' }],
  },
];

export const AnalysisPanelTab: React.FC = () => {
  const { nodes, edges, machineType, replaceMachine } = useGraph();
  const { setInputString, reset } = useExecution();

  const [activeMode, setActiveMode] = useState<'ANALYZE' | 'EQUIVALENCE' | 'TRANSFORM' | 'PROOF'>('ANALYZE');
  const [selectedPresetIdx, setSelectedPresetIdx] = useState<number>(0);
  const [selectedOp, setSelectedOp] = useState<LanguageOperationType | 'NFA_TO_DFA' | 'DFA_MINIMIZE'>('UNION');

  // Mode A: Current Machine Analysis (Compute pure deterministic facts)
  const analysisResult = useMemo(() => {
    return analyzeMachine({ nodes, edges }, machineType);
  }, [nodes, edges, machineType]);

  // Mode B: Language Equivalence Workbench
  const comparisonPreset = PRESET_MACHINES[selectedPresetIdx];
  const equivalenceResult = useMemo(() => {
    if (activeMode !== 'EQUIVALENCE' && activeMode !== 'PROOF') return null;
    return compareAutomataLanguages(
      { nodes, edges },
      machineType,
      { nodes: comparisonPreset.nodes, edges: comparisonPreset.edges },
      comparisonPreset.type
    );
  }, [nodes, edges, machineType, activeMode, comparisonPreset]);

  // Mode C: Automata Relationship & Transformation Workbench
  const transformationResult = useMemo<ProductAutomatonResult | null>(() => {
    if (activeMode !== 'TRANSFORM' && activeMode !== 'PROOF') return null;

    if (selectedOp === 'NFA_TO_DFA') {
      if (machineType !== 'FA' && machineType !== 'NFA' && machineType !== 'DFA') {
        return {
          success: false,
          operation: 'UNION',
          nodes: [],
          edges: [],
          alphabet: [],
          reachableStateCount: 0,
          acceptingStateCount: 0,
          errorMessage: `NFA to DFA conversion is only applicable to Finite Automata, not ${machineType}.`,
        };
      }
      const conv = convertNfaToDfa({ nodes, edges: expandSolverEdges(edges, 'FA') });
      if (!conv.success) {
        return {
          success: false,
          operation: 'UNION',
          nodes: [],
          edges: [],
          alphabet: [],
          reachableStateCount: 0,
          acceptingStateCount: 0,
          errorMessage: conv.errorMessage,
        };
      }
      return {
        success: true,
        operation: 'UNION',
        nodes: conv.nodes,
        edges: conv.edges,
        alphabet: conv.alphabet,
        reachableStateCount: conv.nodes.length,
        acceptingStateCount: conv.nodes.filter((n) => n.isAccepting).length,
      };
    }

    if (selectedOp === 'DFA_MINIMIZE') {
      if (machineType !== 'FA' && machineType !== 'DFA') {
        return {
          success: false,
          operation: 'UNION',
          nodes: [],
          edges: [],
          alphabet: [],
          reachableStateCount: 0,
          acceptingStateCount: 0,
          errorMessage: `Hopcroft DFA minimization is only applicable to Finite Automata. Minimizing a ${machineType} is mathematically undecidable.`,
        };
      }
      const min = minimizeDFA({ nodes, edges: expandSolverEdges(edges, 'FA') });
      if (!min.success) {
        return {
          success: false,
          operation: 'UNION',
          nodes: [],
          edges: [],
          alphabet: [],
          reachableStateCount: 0,
          acceptingStateCount: 0,
          errorMessage: min.errorMessage,
        };
      }
      return {
        success: true,
        operation: 'UNION',
        nodes: min.nodes,
        edges: min.edges,
        alphabet: Array.from(new Set(min.edges.map((e) => e.label))).sort(),
        reachableStateCount: min.nodes.length,
        acceptingStateCount: min.nodes.filter((n) => n.isAccepting).length,
      };
    }

    if (selectedOp === 'COMPLEMENT') {
      return complementDFA({ nodes, edges }, machineType);
    }

    return constructProductAutomaton(
      { nodes, edges },
      machineType,
      { nodes: comparisonPreset.nodes, edges: comparisonPreset.edges },
      comparisonPreset.type,
      selectedOp
    );
  }, [nodes, edges, machineType, activeMode, selectedOp, comparisonPreset]);

  // Mode D: Formal Proof Derivation & Counterexample Exploration
  const formalEquivalenceProof = useMemo(() => {
    if (!equivalenceResult) return null;
    return generateEquivalenceProof(equivalenceResult, `Current Canvas (${machineType})`, comparisonPreset.name);
  }, [equivalenceResult, machineType, comparisonPreset.name]);

  const counterexampleTrace = useMemo(() => {
    if (!equivalenceResult || equivalenceResult.isEquivalent || equivalenceResult.counterexample === undefined) {
      return [];
    }
    return generateCounterexampleTrace(
      { nodes, edges },
      machineType,
      { nodes: comparisonPreset.nodes, edges: comparisonPreset.edges },
      comparisonPreset.type,
      equivalenceResult.counterexample
    );
  }, [equivalenceResult, nodes, edges, machineType, comparisonPreset]);

  const transformationProof = useMemo(() => {
    if (!transformationResult) return null;
    return generateTransformationProof(transformationResult, `Transformation Derivation: ${selectedOp}`);
  }, [transformationResult, selectedOp]);

  // Counterexample Playback (Transient execution state update ONLY)
  const handleInspectCounterexample = (counterexampleStr: string) => {
    if (counterexampleStr !== undefined) {
      setInputString(counterexampleStr);
      reset();
    }
  };

  // Commit Output to Canvas (Exactly 1 Undo History Entry)
  const handleCommitTransformation = () => {
    if (transformationResult && transformationResult.success) {
      const targetType = selectedOp === 'NFA_TO_DFA' ? 'DFA' : machineType === 'NFA' ? 'DFA' : machineType;
      replaceMachine([...transformationResult.nodes], [...transformationResult.edges], targetType);
    }
  };

  return (
    <div className="flex flex-col h-full bg-bg-base text-txt-primary font-mono text-xs overflow-hidden select-none">
      {/* Subpanel Mode Switcher Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-bg-surface1 border-b border-border-subtle shrink-0 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveMode('ANALYZE')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold transition-colors ${
              activeMode === 'ANALYZE'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-bg-surface2 text-txt-secondary hover:text-txt-primary'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            Machine Analysis
          </button>
          <button
            onClick={() => setActiveMode('EQUIVALENCE')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold transition-colors ${
              activeMode === 'EQUIVALENCE'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-bg-surface2 text-txt-secondary hover:text-txt-primary'
            }`}
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            Language Equivalence
          </button>
          <button
            onClick={() => setActiveMode('TRANSFORM')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold transition-colors ${
              activeMode === 'TRANSFORM'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'bg-bg-surface2 text-txt-secondary hover:text-txt-primary'
            }`}
          >
            <GitMerge className="w-3.5 h-3.5" />
            Transformations
          </button>
          <button
            onClick={() => setActiveMode('PROOF')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold transition-colors ${
              activeMode === 'PROOF'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-bg-surface2 text-txt-secondary hover:text-txt-primary'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            Formal Proof & Counterexample
          </button>
        </div>

        <div className="flex items-center gap-3 text-slate-400 text-2xs">
          <span>
            Target Machine: <strong className="text-slate-200">{machineType}</strong> ({nodes.length} states, {edges.length} transitions)
          </span>
        </div>
      </div>

      {/* Panel Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeMode === 'ANALYZE' && (
          /* MODE A: MACHINE ANALYSIS */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-slate-950/80 p-3.5 rounded border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="font-bold text-slate-300 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-blue-400" /> Formal Statistics
                </span>
                <span className="bg-blue-950 text-blue-300 border border-blue-800 px-2 py-0.5 rounded text-3xs font-semibold">
                  {analysisResult.machineType}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-2xs">
                <div className="bg-slate-900 p-2 rounded">
                  <span className="text-slate-500 block">States |Q|</span>
                  <span className="text-sm font-bold text-slate-200">{analysisResult.stateCount}</span>
                </div>
                <div className="bg-slate-900 p-2 rounded">
                  <span className="text-slate-500 block">Transitions |δ|</span>
                  <span className="text-sm font-bold text-slate-200">{analysisResult.transitionCount}</span>
                </div>
                <div className="bg-slate-900 p-2 rounded col-span-2">
                  <span className="text-slate-500 block">Alphabet Σ</span>
                  <span className="text-slate-200 font-semibold">
                    {analysisResult.alphabet.length > 0
                      ? `{ ${analysisResult.alphabet.join(', ')} }`
                      : '∅ (Empty)'}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-slate-950/80 p-3.5 rounded border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="font-bold text-slate-300 flex items-center gap-1.5">
                  <Hash className="w-4 h-4 text-emerald-400" /> Graph Accessibility
                </span>
                {analysisResult.isLanguageEmpty && (
                  <span className="bg-red-950 text-red-300 border border-red-800 px-2 py-0.5 rounded text-3xs font-semibold">
                    L(M) = ∅
                  </span>
                )}
              </div>
              <div className="space-y-1.5 text-2xs">
                <div className="flex justify-between items-center bg-slate-900 p-1.5 rounded">
                  <span className="text-slate-400">Reachable States:</span>
                  <span className="text-emerald-400 font-semibold">{analysisResult.reachableStateIds.length} / {analysisResult.stateCount}</span>
                </div>
                <div className="flex justify-between items-center bg-slate-900 p-1.5 rounded">
                  <span className="text-slate-400">Unreachable States:</span>
                  <span className={analysisResult.unreachableStateIds.length > 0 ? 'text-amber-400 font-semibold' : 'text-slate-500'}>
                    {analysisResult.unreachableStateIds.length}
                  </span>
                </div>
                <div className="flex justify-between items-center bg-slate-900 p-1.5 rounded">
                  <span className="text-slate-400">Co-accessible States:</span>
                  <span className="text-blue-400 font-semibold">{analysisResult.coaccessibleStateIds.length}</span>
                </div>
                <div className="flex justify-between items-center bg-slate-900 p-1.5 rounded">
                  <span className="text-slate-400">Dead / Trap States:</span>
                  <span className={analysisResult.trapStateIds.length > 0 ? 'text-red-400 font-semibold' : 'text-slate-500'}>
                    {analysisResult.trapStateIds.length}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-slate-950/80 p-3.5 rounded border border-slate-800 space-y-2.5 col-span-1 md:col-span-2 lg:col-span-1">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="font-bold text-slate-300 flex items-center gap-1.5">
                  <HelpCircle className="w-4 h-4 text-purple-400" /> Formal Facts
                </span>
              </div>
              <ul className="space-y-1.5 max-h-36 overflow-y-auto pr-1 text-2xs">
                {analysisResult.observations.map((obs, idx) => (
                  <li key={idx} className="flex items-start gap-1.5 text-slate-300 bg-slate-900/60 p-1.5 rounded">
                    <span className="text-blue-400 mt-0.5">•</span>
                    <span>{obs}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {activeMode === 'EQUIVALENCE' && (
          /* MODE B: LANGUAGE EQUIVALENCE WORKBENCH */
          <div className="space-y-4">
            <div className="bg-slate-950/90 p-3 rounded border border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-slate-400 text-xs font-semibold">Compare Current Machine vs:</span>
                <select
                  value={selectedPresetIdx}
                  onChange={(e) => setSelectedPresetIdx(Number(e.target.value))}
                  className="bg-slate-900 border border-slate-700 text-slate-200 rounded px-2.5 py-1 text-xs focus:outline-none focus:border-indigo-500"
                >
                  {PRESET_MACHINES.map((preset, idx) => (
                    <option key={idx} value={idx}>
                      {preset.name} ({preset.type})
                    </option>
                  ))}
                </select>
              </div>

              {equivalenceResult && (
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 text-3xs">
                    Product States Explored: <strong className="text-slate-200">{equivalenceResult.productStatesExplored}</strong>
                  </span>
                </div>
              )}
            </div>

            {equivalenceResult && (
              <div
                className={`p-4 rounded border flex flex-wrap items-center justify-between gap-4 ${
                  equivalenceResult.isEquivalent
                    ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-200'
                    : 'bg-amber-950/40 border-amber-800/80 text-amber-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  {equivalenceResult.isEquivalent ? (
                    <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                  ) : (
                    <XCircle className="w-6 h-6 text-amber-400 shrink-0" />
                  )}
                  <div>
                    <h3 className="font-bold text-sm">
                      {equivalenceResult.isEquivalent
                        ? 'EQUIVALENT: L(M₁) = L(M₂)'
                        : 'NOT EQUIVALENT: L(M₁) ≠ L(M₂)'}
                    </h3>
                    <p className="text-2xs text-slate-400 mt-0.5">
                      {equivalenceResult.isEquivalent
                        ? 'Both automata define identical regular languages across the unified alphabet Σ.'
                        : `Shortest distinguishing counterexample string found in product automaton BFS.`}
                    </p>
                  </div>
                </div>

                {!equivalenceResult.isEquivalent && equivalenceResult.counterexample !== undefined && (
                  <div className="flex items-center gap-3 bg-slate-950/80 p-2.5 rounded border border-amber-900/60">
                    <div className="text-2xs">
                      <span className="text-slate-400 block">Shortest Counterexample w:</span>
                      <code className="text-xs font-bold text-amber-300">
                        {equivalenceResult.counterexample === '' ? 'ε (Empty String)' : `"${equivalenceResult.counterexample}"`}
                      </code>
                    </div>
                    <button
                      onClick={() => handleInspectCounterexample(equivalenceResult.counterexample!)}
                      className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs px-3 py-1.5 rounded transition-colors shadow"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      Inspect Counterexample
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeMode === 'TRANSFORM' && (
          /* MODE C: AUTOMATA RELATIONSHIP & TRANSFORMATION WORKBENCH */
          <div className="space-y-4">
            <div className="bg-slate-950/90 p-3 rounded border border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 text-xs font-semibold">Operation:</span>
                  <select
                    value={selectedOp}
                    onChange={(e) => setSelectedOp(e.target.value as LanguageOperationType | 'NFA_TO_DFA' | 'DFA_MINIMIZE')}
                    className="bg-slate-900 border border-slate-700 text-purple-300 font-bold rounded px-2.5 py-1 text-xs focus:outline-none focus:border-purple-500"
                  >
                    <option value="UNION">Union (L(M₁) ∪ L(M₂))</option>
                    <option value="INTERSECTION">Intersection (L(M₁) ∩ L(M₂))</option>
                    <option value="DIFFERENCE">Difference (L(M₁) \ L(M₂))</option>
                    <option value="SYMMETRIC_DIFFERENCE">Symmetric Difference (L(M₁) ⊕ L(M₂))</option>
                    <option value="COMPLEMENT">Complement (L(M') = Σ* \ L(M₁))</option>
                    <option value="NFA_TO_DFA">NFA → DFA (Subset Construction)</option>
                    <option value="DFA_MINIMIZE">DFA Minimization (Partition Refinement)</option>
                  </select>
                </div>

                {selectedOp !== 'COMPLEMENT' && selectedOp !== 'NFA_TO_DFA' && selectedOp !== 'DFA_MINIMIZE' && (
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 text-xs font-semibold">Operand B (M₂):</span>
                    <select
                      value={selectedPresetIdx}
                      onChange={(e) => setSelectedPresetIdx(Number(e.target.value))}
                      className="bg-slate-900 border border-slate-700 text-slate-200 rounded px-2.5 py-1 text-xs focus:outline-none focus:border-purple-500"
                    >
                      {PRESET_MACHINES.map((preset, idx) => (
                        <option key={idx} value={idx}>
                          {preset.name} ({preset.type})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {transformationResult?.success && (
                <button
                  onClick={handleCommitTransformation}
                  className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs px-3.5 py-1.5 rounded transition-colors shadow"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Commit Output to Canvas
                </button>
              )}
            </div>

            {transformationResult && (
              <div
                className={`p-4 rounded border space-y-3 ${
                  transformationResult.success
                    ? 'bg-purple-950/30 border-purple-800/80 text-purple-200'
                    : 'bg-red-950/40 border-red-800/80 text-red-200'
                }`}
              >
                <div className="flex items-center justify-between border-b border-purple-900/60 pb-2">
                  <div className="flex items-center gap-2">
                    <GitMerge className="w-5 h-5 text-purple-400" />
                    <h3 className="font-bold text-sm">
                      {transformationResult.success
                        ? `Transformation Output: ${selectedOp}`
                        : 'Transformation Error'}
                    </h3>
                  </div>

                  {transformationResult.success && (
                    <div className="flex items-center gap-2 text-2xs text-slate-300">
                      <span className="bg-purple-900/60 px-2 py-0.5 rounded border border-purple-700 font-semibold">
                        |Q| = {transformationResult.reachableStateCount} States
                      </span>
                      <span className="bg-emerald-900/60 px-2 py-0.5 rounded border border-emerald-700 font-semibold text-emerald-300">
                        |F| = {transformationResult.acceptingStateCount} Accepting
                      </span>
                      <span className="bg-blue-900/60 px-2 py-0.5 rounded border border-blue-700 font-semibold text-blue-300">
                        Σ = {`{ ${transformationResult.alphabet.join(', ')} }`}
                      </span>
                    </div>
                  )}
                </div>

                {!transformationResult.success && (
                  <p className="text-2xs text-red-300">{transformationResult.errorMessage}</p>
                )}
              </div>
            )}
          </div>
        )}

        {activeMode === 'PROOF' && (
          /* MODE D: FORMAL PROOF & COUNTEREXAMPLE EXPLORER */
          <div className="space-y-4">
            {/* Overview Banner */}
            <div className="bg-slate-950/90 p-3.5 rounded border border-slate-800 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="font-bold text-sm text-slate-200">Formal Mathematical Proof & Counterexample Explorer</h3>
                  <p className="text-3xs text-slate-400">
                    Inspecting mathematical derivations consuming solver trace sources as the single source of truth.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-slate-400 text-xs">Compare Canvas vs:</span>
                <select
                  value={selectedPresetIdx}
                  onChange={(e) => setSelectedPresetIdx(Number(e.target.value))}
                  className="bg-slate-900 border border-slate-700 text-slate-200 rounded px-2.5 py-1 text-xs focus:outline-none focus:border-amber-500"
                >
                  {PRESET_MACHINES.map((preset, idx) => (
                    <option key={idx} value={idx}>
                      {preset.name} ({preset.type})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Formal Equivalence Proof Derivation Card */}
            {formalEquivalenceProof && (
              <div className="bg-slate-950/80 p-4 rounded border border-slate-800 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-amber-400" />
                    <span className="font-bold text-xs text-amber-200">{formalEquivalenceProof.title}</span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-3xs font-bold border ${
                      formalEquivalenceProof.isEquivalent
                        ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                        : 'bg-amber-950 text-amber-300 border-amber-800'
                    }`}
                  >
                    {formalEquivalenceProof.isEquivalent ? 'L(A) = L(B)' : 'L(A) ≠ L(B)'}
                  </span>
                </div>

                <div className="bg-slate-900/80 p-2.5 rounded border border-slate-800/80 text-2xs space-y-1">
                  <span className="font-bold text-amber-300">Formal Conclusion:</span>
                  <p className="text-slate-200 font-mono">{formalEquivalenceProof.conclusion}</p>
                  <span className="font-bold text-slate-400 block pt-1">Mathematical Justification:</span>
                  <p className="text-slate-300 font-sans leading-relaxed">{formalEquivalenceProof.mathematicalJustification}</p>
                </div>

                {/* Structured Formal Proof Steps Table */}
                <div className="space-y-1">
                  <span className="text-3xs uppercase font-bold text-slate-500">Derivation Steps ({formalEquivalenceProof.steps.length}):</span>
                  <div className="overflow-x-auto max-h-60 overflow-y-auto border border-slate-800 rounded">
                    <table className="w-full text-left border-collapse text-2xs font-mono">
                      <thead className="bg-slate-900 text-slate-400 sticky top-0 border-b border-slate-800">
                        <tr>
                          <th className="p-2">Step</th>
                          <th className="p-2">Type</th>
                          <th className="p-2">Description</th>
                          <th className="p-2">Notation</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {formalEquivalenceProof.steps.map((st) => (
                          <tr
                            key={st.stepIndex}
                            className={
                              st.type === 'DISTINGUISHING_CONFIGURATION'
                                ? 'bg-red-950/40 text-red-200 font-semibold'
                                : st.type === 'RESULT'
                                ? 'bg-emerald-950/30 text-emerald-200 font-semibold'
                                : 'hover:bg-slate-900/50 text-slate-300'
                            }
                          >
                            <td className="p-2 text-slate-500">{st.stepIndex}</td>
                            <td className="p-2 text-amber-400 font-bold">{st.type}</td>
                            <td className="p-2 text-slate-200">{st.description}</td>
                            <td className="p-2 text-indigo-300 font-semibold">{st.mathematicalNotation}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Counterexample Explorer Table & Live Playback */}
            {counterexampleTrace.length > 0 && (
              <div className="bg-amber-950/30 border border-amber-800/80 p-4 rounded space-y-3">
                <div className="flex items-center justify-between border-b border-amber-900/80 pb-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    <span className="font-bold text-xs text-amber-200">
                      Counterexample Step-by-Step Traversal: w = "{equivalenceResult?.counterexample}"
                    </span>
                  </div>

                  <button
                    onClick={() => handleInspectCounterexample(equivalenceResult?.counterexample || '')}
                    className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs px-3 py-1.5 rounded transition-colors shadow"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    Inspect Counterexample Live Playback
                  </button>
                </div>

                <div className="overflow-x-auto border border-slate-800 rounded bg-slate-950/80">
                  <table className="w-full text-left border-collapse text-2xs font-mono">
                    <thead className="bg-slate-900 text-slate-400 sticky top-0 border-b border-slate-800">
                      <tr>
                        <th className="p-2">Step</th>
                        <th className="p-2">Consumed Symbol</th>
                        <th className="p-2">Prefix</th>
                        <th className="p-2">Product Pair (qA, qB)</th>
                        <th className="p-2">Machine A Status</th>
                        <th className="p-2">Machine B Status</th>
                        <th className="p-2">Divergence</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {counterexampleTrace.map((st) => (
                        <tr
                          key={st.stepIndex}
                          className={
                            st.isDistinguishing
                              ? 'bg-red-950/50 text-red-200 font-bold'
                              : 'hover:bg-slate-900/50 text-slate-300'
                          }
                        >
                          <td className="p-2 text-slate-500">Step {st.stepIndex}</td>
                          <td className="p-2 text-indigo-400 font-bold">{st.symbol || 'ε'}</td>
                          <td className="p-2 text-slate-400">"{st.consumedPrefix}"</td>
                          <td className="p-2 text-slate-200">{st.productPairLabel}</td>
                          <td className="p-2">
                            <span
                              className={`px-1.5 py-0.5 rounded text-3xs font-bold ${
                                st.isAcceptingA ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-slate-900 text-slate-500'
                              }`}
                            >
                              {st.stateA.label} ({st.isAcceptingA ? 'ACCEPT' : 'REJECT'})
                            </span>
                          </td>
                          <td className="p-2">
                            <span
                              className={`px-1.5 py-0.5 rounded text-3xs font-bold ${
                                st.isAcceptingB ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-slate-900 text-slate-500'
                              }`}
                            >
                              {st.stateB.label} ({st.isAcceptingB ? 'ACCEPT' : 'REJECT'})
                            </span>
                          </td>
                          <td className="p-2">
                            {st.isDistinguishing ? (
                              <span className="bg-red-900 text-red-100 border border-red-700 px-2 py-0.5 rounded text-3xs font-bold">
                                DISTINGUISHING CONFIGURATION
                              </span>
                            ) : (
                              <span className="text-slate-500">Matching</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Transformation Derivation Proof */}
            {transformationProof && (
              <div className="bg-slate-950/80 p-4 rounded border border-slate-800 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="font-bold text-xs text-purple-300">{transformationProof.title}</span>
                </div>
                <div className="bg-slate-900/80 p-2.5 rounded border border-slate-800/80 text-2xs space-y-1">
                  <span className="font-bold text-purple-300">Transformation Derivation Summary:</span>
                  <p className="text-slate-200 font-mono">{transformationProof.conclusion}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AnalysisPanelTab;
