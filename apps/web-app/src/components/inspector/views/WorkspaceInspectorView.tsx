import React, { useState, useMemo } from 'react';
import { useGraph } from '../../../context/GraphContext';
import { useExecution } from '../../../context/ExecutionContext';
import { useWorkspace } from '../../../context/WorkspaceContext';
import { IInspectorSchema } from '../types';
import { InspectorSchemaRenderer } from '../InspectorSchemaRenderer';
import { AutomatonType } from '@project-zero/shared';
import { convertNfaToDfa, minimizeDFA } from '@project-zero/core-solver';
import { RegexModal } from '../../modals/RegexModal';
import { Code, RefreshCw, Zap, Wand2 } from 'lucide-react';

export const WorkspaceInspectorView: React.FC = () => {
  const [isRegexModalOpen, setIsRegexModalOpen] = useState<boolean>(false);
  const { setActiveInspectorTab } = useWorkspace();
  const {
    nodes,
    edges,
    machineType,
    setMachineType,
    initialStackSymbol,
    setInitialStackSymbol,
    blankSymbol,
    setBlankSymbol,
    getInitialState,
    getAcceptingStates,
    getAlphabet,
    to5Tuple,
    replaceMachine,
    setLastMinimizationResult,
    setLastRegexResult,
  } = useGraph();

  const { validationResult, currentStep, executionResult } = useExecution();

  const initialStateNode = getInitialState();
  const acceptingNodes = getAcceptingStates();
  const alphabet = getAlphabet();
  const tuple5 = to5Tuple();

  const isGraphNFA = useMemo(() => {
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
  }, [nodes, edges]);

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

  const tapeAlphabet = useMemo(() => {
    const set = new Set<string>();
    alphabet.forEach((s) => set.add(s));
    edges.forEach((e) => {
      if (e.readSymbol && e.readSymbol.trim()) set.add(e.readSymbol);
      if (e.writeSymbol && e.writeSymbol.trim()) set.add(e.writeSymbol);
    });
    if (blankSymbol) set.add(blankSymbol);
    return Array.from(set).sort();
  }, [alphabet, edges, blankSymbol]);

  const schema: IInspectorSchema = useMemo(() => {
    const metaFields = [
      { id: 'machine-name', label: 'Machine Name', type: 'text' as const, value: 'Automaton_Workspace.pz' },
      {
        id: 'machine-type',
        label: 'Formal Model Type',
        type: 'select' as const,
        value: machineType.toLowerCase(),
        options: [
          { label: 'Deterministic Finite Automaton (DFA)', value: 'dfa' },
          { label: 'Nondeterministic Finite Automaton (NFA)', value: 'nfa' },
          { label: 'Pushdown Automaton (PDA)', value: 'pda' },
          { label: 'Turing Machine (TM)', value: 'tm' },
        ],
      },
      {
        id: 'validation-status',
        label: `${machineType} Validation Status`,
        type: 'badge' as const,
        value: validationResult.isValid
          ? `✓ Valid ${machineType}`
          : `✕ Invalid ${machineType} (${validationResult.errors.length} issue${validationResult.errors.length > 1 ? 's' : ''})`,
      },
    ];

    if (machineType === 'PDA') {
      metaFields.push({
        id: 'initial-stack-symbol',
        label: 'Initial Stack Symbol (Z₀)',
        type: 'text',
        value: initialStackSymbol,
      });
    } else if (machineType === 'TM') {
      metaFields.push({
        id: 'blank-symbol',
        label: 'Blank Symbol (B)',
        type: 'text',
        value: blankSymbol,
      });
    }

    const tupleTitle =
      machineType === 'TM'
        ? 'Formal 7-Tuple Definition M = (Q, Σ, Γ, δ, q₀, B, F)'
        : machineType === 'PDA'
        ? 'Formal 7-Tuple Definition M = (Q, Σ, Γ, δ, q₀, Z₀, F)'
        : `Formal 5-Tuple Definition M = (Q, Σ, δ, q₀, F)${machineType === 'NFA' ? ' where δ: Q × (Σ ∪ {ε}) → P(Q)' : ''}`;

    const tupleFields = [
      {
        id: 'tuple-states',
        label: `States Q (${nodes.length})`,
        type: 'badge' as const,
        value: tuple5.states.length > 0 ? `{ ${tuple5.states.join(', ')} }` : '∅',
      },
      {
        id: 'tuple-alphabet',
        label: `Input Alphabet Σ (${alphabet.length})`,
        type: 'badge' as const,
        value: tuple5.alphabet.length > 0 ? `{ ${tuple5.alphabet.join(', ')} }` : '∅',
      },
    ];

    if (machineType === 'TM') {
      tupleFields.push({
        id: 'tuple-tape-alphabet',
        label: `Tape Alphabet Γ (${tapeAlphabet.length})`,
        type: 'badge' as const,
        value: tapeAlphabet.length > 0 ? `{ ${tapeAlphabet.join(', ')} }` : '∅',
      });
      tupleFields.push({
        id: 'tuple-blank-symbol',
        label: 'Blank Symbol B',
        type: 'badge' as const,
        value: blankSymbol || '□',
      });
    }

    tupleFields.push(
      {
        id: 'tuple-initial',
        label: 'Start State q₀',
        type: 'badge' as const,
        value: initialStateNode ? initialStateNode.label : 'Unassigned',
      },
      {
        id: 'tuple-accepting',
        label: `Accepting States F (${acceptingNodes.length})`,
        type: 'badge' as const,
        value: acceptingNodes.length > 0 ? `{ ${acceptingNodes.map((n) => n.label).join(', ')} }` : '∅',
      },
      {
        id: 'tuple-transitions',
        label: `Transitions δ (${edges.length})`,
        type: 'badge' as const,
        value: `${edges.length} delta mapping(s)`,
      }
    );

    const sections = [
      {
        id: 'sec-meta',
        title: 'Machine Metadata',
        isExpanded: true,
        fields: metaFields,
      },
      {
        id: 'sec-5tuple',
        title: tupleTitle,
        isExpanded: true,
        fields: tupleFields,
      },
    ];

    if (machineType === 'TM' && currentStep) {
      const tmStep = currentStep as import('@project-zero/core-solver').TMExecutionStep;
      const transFormula = tmStep.nextStateLabel
        ? `δ(${tmStep.currentStateLabel}, ${tmStep.readSymbol}) = (${tmStep.nextStateLabel}, ${tmStep.writeSymbol}, ${tmStep.moveDirection})`
        : `δ(${tmStep.currentStateLabel}, ${tmStep.readSymbol}) is undefined`;

      const statusDisplay = tmStep.isAccepting
        ? '✓ ACCEPT'
        : tmStep.isHalted
        ? `✕ REJECT (${executionResult.rejectionReason ?? 'HALTED'})`
        : ('isInconclusive' in executionResult && executionResult.isInconclusive)
        ? '⚠ INCONCLUSIVE_LIMIT'
        : '⚡ EXECUTING';

      sections.push({
        id: 'sec-tm-config',
        title: 'Instantaneous Debug Configuration C = (q, tape, head)',
        isExpanded: true,
        fields: [
          { id: 'dbg-step', label: 'Computation Step', type: 'badge' as const, value: `Step ${tmStep.stepIndex}` },
          { id: 'dbg-state', label: 'Current State (q)', type: 'badge' as const, value: tmStep.currentStateLabel },
          { id: 'dbg-head', label: 'Head Position Index', type: 'badge' as const, value: String(tmStep.tapeHeadIndex) },
          { id: 'dbg-read', label: 'Scanned Read Symbol', type: 'badge' as const, value: tmStep.readSymbol },
          { id: 'dbg-trans', label: 'Applied Transition', type: 'badge' as const, value: transFormula },
          { id: 'dbg-status', label: 'Configuration Status', type: 'badge' as const, value: statusDisplay },
        ],
      });
    }

    return {
      selectionType: 'workspace',
      title: 'Automaton Machine Inspector',
      subtitle: `${machineType} Automaton`,
      sections,
    };
  }, [machineType, initialStackSymbol, blankSymbol, nodes, edges, initialStateNode, acceptingNodes, alphabet, tapeAlphabet, tuple5, validationResult, currentStep, executionResult]);

  const handleFieldChange = (id: string, value: string | number | boolean) => {
    if (id === 'machine-type') {
      const val = String(value).toUpperCase() as AutomatonType;
      setMachineType(val);
    } else if (id === 'initial-stack-symbol') {
      setInitialStackSymbol(String(value).trim() || 'Z0');
    } else if (id === 'blank-symbol') {
      setBlankSymbol(String(value).trim() || '□');
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-y-auto select-none">
      <InspectorSchemaRenderer schema={schema} onFieldChange={handleFieldChange} />

      {/* Automata Transformations & Conversions Action Section */}
      <div className="p-3 border-t border-border-subtle bg-bg-surface2/40 space-y-2 shrink-0 font-mono text-xs">
        <div className="font-bold text-txt-primary text-[11px] flex items-center space-x-1.5">
          <Wand2 size={13} className="text-accent-primary" />
          <span>Automata Transformations</span>
        </div>

        <div className="space-y-1.5">
          {/* RegEx to NFA Button */}
          <button
            onClick={() => setIsRegexModalOpen(true)}
            className="w-full p-2 rounded-lg border border-border-subtle bg-bg-surface1 hover:bg-bg-surface2 hover:border-accent-primary text-left transition-all flex items-center justify-between group"
          >
            <div className="flex items-center space-x-2">
              <div className="p-1 rounded bg-accent-primary/15 text-accent-primary">
                <Code size={14} />
              </div>
              <div>
                <div className="font-bold text-txt-primary text-xs group-hover:text-accent-primary transition-colors">
                  RegEx → Thompson ε-NFA
                </div>
                <div className="text-[10px] text-txt-muted">Convert regular expressions to state machine</div>
              </div>
            </div>
            <span className="text-[10px] font-bold text-accent-primary bg-accent-primary/10 px-1.5 py-0.5 rounded border border-accent-primary/20 shrink-0 ml-1">
              Run
            </span>
          </button>

          {/* NFA to DFA Button */}
          <button
            disabled={!isGraphNFA && machineType !== 'NFA'}
            onClick={handleNfaToDfaConversion}
            className={`w-full p-2 rounded-lg border text-left transition-all flex items-center justify-between group ${
              isGraphNFA || machineType === 'NFA'
                ? 'border-border-subtle bg-bg-surface1 hover:bg-bg-surface2 hover:border-accent-cyan cursor-pointer'
                : 'border-border-subtle/50 bg-bg-surface1/40 opacity-50 cursor-not-allowed'
            }`}
          >
            <div className="flex items-center space-x-2">
              <div className="p-1 rounded bg-accent-cyan/15 text-accent-cyan">
                <RefreshCw size={14} />
              </div>
              <div>
                <div className="font-bold text-txt-primary text-xs group-hover:text-accent-cyan transition-colors">
                  NFA → DFA Subset Construction
                </div>
                <div className="text-[10px] text-txt-muted">
                  {isGraphNFA || machineType === 'NFA' ? 'Determinize NFA via power-set construction' : 'Requires NFA graph'}
                </div>
              </div>
            </div>
            <span className="text-[10px] font-bold text-accent-cyan bg-accent-cyan/10 px-1.5 py-0.5 rounded border border-accent-cyan/20 shrink-0 ml-1">
              {isGraphNFA || machineType === 'NFA' ? 'Convert' : 'NFA only'}
            </span>
          </button>

          {/* DFA Minimization Button */}
          <button
            disabled={isGraphNFA}
            onClick={handleDfaMinimization}
            className={`w-full p-2 rounded-lg border text-left transition-all flex items-center justify-between group ${
              !isGraphNFA
                ? 'border-border-subtle bg-bg-surface1 hover:bg-bg-surface2 hover:border-semantic-accept cursor-pointer'
                : 'border-border-subtle/50 bg-bg-surface1/40 opacity-50 cursor-not-allowed'
            }`}
          >
            <div className="flex items-center space-x-2">
              <div className="p-1 rounded bg-semantic-accept/15 text-semantic-accept">
                <Zap size={14} />
              </div>
              <div>
                <div className="font-bold text-txt-primary text-xs group-hover:text-semantic-accept transition-colors">
                  Hopcroft DFA Minimization
                </div>
                <div className="text-[10px] text-txt-muted">
                  {!isGraphNFA ? 'Minimize states via partition refinement' : 'Requires DFA (Convert NFA first)'}
                </div>
              </div>
            </div>
            <span className="text-[10px] font-bold text-semantic-accept bg-semantic-accept/10 px-1.5 py-0.5 rounded border border-semantic-accept/20 shrink-0 ml-1">
              {!isGraphNFA ? 'Minimize' : 'DFA only'}
            </span>
          </button>
        </div>
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

