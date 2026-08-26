import React from 'react';
import { useGraph } from '../../../context/GraphContext';
import { minimizeDFA, RegexASTNode } from '@project-zero/core-solver';
import {
  Cpu,
  Layers,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  BookOpen,
  Code,
  GitCommit,
  GitBranch,
} from 'lucide-react';

export const MinimizationExplanationView: React.FC = () => {
  const {
    lastMinimizationResult,
    lastRegexResult,
    activeExplanationSource,
    setActiveExplanationSource,
    nodes,
    edges,
    machineType,
    setLastMinimizationResult,
    replaceMachine,
  } = useGraph();

  // Determine effective active source
  const currentSource: 'minimization' | 'regex' =
    activeExplanationSource ||
    (lastMinimizationResult ? 'minimization' : lastRegexResult ? 'regex' : 'minimization');

  const handleRunMinimization = () => {
    if (machineType !== 'DFA') return;
    const res = minimizeDFA({ nodes, edges });
    setLastMinimizationResult(res);
    if (res.success && !res.isAlreadyMinimal && res.nodes.length > 0) {
      replaceMachine([...res.nodes], [...res.edges], 'DFA');
    }
  };

  // Render AST Tree Node Helper
  const renderASTNodeTree = (node: RegexASTNode, depth: number = 0, keyPath: string = '0'): React.ReactNode => {
    const indent = '│ '.repeat(depth);
    switch (node.type) {
      case 'LITERAL':
        return (
          <div key={keyPath} className="text-txt-primary">
            {indent}└── <span className="font-bold text-accent-primary">Literal ('{node.symbol}')</span>
          </div>
        );
      case 'EPSILON':
        return (
          <div key={keyPath} className="text-txt-muted">
            {indent}└── <span className="font-bold text-txt-secondary">Epsilon (ε)</span>
          </div>
        );
      case 'CONCAT':
        return (
          <div key={keyPath} className="space-y-0.5">
            <div className="text-accent-cyan font-bold">{indent}├── Concatenation (·)</div>
            {renderASTNodeTree(node.left, depth + 1, `${keyPath}-L`)}
            {renderASTNodeTree(node.right, depth + 1, `${keyPath}-R`)}
          </div>
        );
      case 'UNION':
        return (
          <div key={keyPath} className="space-y-0.5">
            <div className="text-accent-purple font-bold">{indent}├── Union (|)</div>
            {renderASTNodeTree(node.left, depth + 1, `${keyPath}-L`)}
            {renderASTNodeTree(node.right, depth + 1, `${keyPath}-R`)}
          </div>
        );
      case 'STAR':
        return (
          <div key={keyPath} className="space-y-0.5">
            <div className="text-semantic-warning font-bold">{indent}├── Kleene Star (*)</div>
            {renderASTNodeTree(node.expression, depth + 1, `${keyPath}-sub`)}
          </div>
        );
      case 'PLUS':
        return (
          <div key={keyPath} className="space-y-0.5">
            <div className="text-semantic-accept font-bold">{indent}├── Plus (+)</div>
            {renderASTNodeTree(node.expression, depth + 1, `${keyPath}-sub`)}
          </div>
        );
      case 'OPTIONAL':
        return (
          <div key={keyPath} className="space-y-0.5">
            <div className="text-accent-primary font-bold">{indent}├── Optional (?)</div>
            {renderASTNodeTree(node.expression, depth + 1, `${keyPath}-sub`)}
          </div>
        );
      default:
        return null;
    }
  };

  // ---------------------------------------------------------------------------
  // REGEX EXPLANATION VIEW
  // ---------------------------------------------------------------------------
  if (currentSource === 'regex' && lastRegexResult) {
    const { inputRegex, result } = lastRegexResult;

    // Handle Parser / Syntax Error for Invalid Regex
    if (!result.success) {
      return (
        <div className="flex-1 flex flex-col overflow-y-auto p-3.5 space-y-4 bg-bg-surface1 text-xs font-mono select-none">
          {/* Source Switcher Sub-Header if Minimization result also exists */}
          {lastMinimizationResult && (
            <div className="flex border-b border-border-subtle pb-2 mb-1 space-x-1 shrink-0">
              <button
                onClick={() => setActiveExplanationSource('regex')}
                className="flex-1 py-1 rounded text-[10px] font-bold border transition-colors bg-accent-primary/15 border-accent-primary text-accent-primary"
              >
                Regex Conversion
              </button>
              <button
                onClick={() => setActiveExplanationSource('minimization')}
                className="flex-1 py-1 rounded text-[10px] font-bold border transition-colors bg-bg-surface2 border-border-subtle text-txt-muted hover:text-txt-primary"
              >
                Hopcroft Minimization
              </button>
            </div>
          )}

          {/* Header Banner */}
          <div className="flex items-center space-x-2 border-b border-border-subtle pb-3 shrink-0">
            <div className="p-1.5 bg-semantic-error/15 text-semantic-error rounded-md">
              <Code size={18} />
            </div>
            <div>
              <h3 className="font-bold text-txt-primary text-sm">RegEx → ε-NFA Conversion</h3>
              <p className="text-[11px] text-semantic-error font-medium">Syntax & Parser Error</p>
            </div>
          </div>

          {/* Input Regular Expression */}
          <div className="p-3 bg-bg-surface2/80 rounded-lg border border-border-subtle space-y-1.5">
            <div className="text-txt-muted text-[10px] font-bold tracking-wider">INPUT REGULAR EXPRESSION</div>
            <div className="font-bold text-txt-primary text-sm font-mono bg-bg-surface1 p-2 rounded border border-border-subtle">
              {inputRegex || '∅ (empty)'}
            </div>
          </div>

          {/* Parser Error Block */}
          <div className="p-3 bg-semantic-error/10 border border-semantic-error/30 rounded-lg space-y-2 text-semantic-error">
            <div className="font-bold text-[11px] flex items-center space-x-1.5">
              <AlertTriangle size={15} className="shrink-0" />
              <span>Parsing Error</span>
            </div>
            <div className="text-xs font-mono font-bold bg-bg-surface1/80 p-2 rounded border border-semantic-error/20 text-txt-primary">
              ⚠ {result.errorMessage || 'Failed to parse regular expression.'}
            </div>
            {typeof result.errorPosition === 'number' && (
              <div className="text-[10px] text-txt-muted">
                Error position index: <span className="font-bold text-semantic-error">{result.errorPosition}</span>
              </div>
            )}
          </div>

          {/* Status Details */}
          <div className="p-3 bg-bg-surface2/70 rounded-lg border border-border-subtle space-y-1.5 text-txt-secondary text-[11px]">
            <div className="font-bold text-txt-primary">Conversion Status</div>
            <p className="text-txt-muted leading-relaxed">
              Conversion could not be completed. The existing automaton was not modified.
            </p>
          </div>

          {/* Supported Operators Reference */}
          <div className="p-3 bg-bg-surface2/60 rounded-lg border border-border-subtle space-y-2 text-[11px]">
            <div className="font-bold text-txt-primary flex items-center space-x-1.5">
              <BookOpen size={14} className="text-accent-primary" />
              <span>Supported Regex Operators</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-[10px] text-txt-secondary">
              <div className="bg-bg-surface1/60 p-1.5 rounded border border-border-subtle">
                <code className="text-accent-primary font-bold">|</code> Alternation (Union)
              </div>
              <div className="bg-bg-surface1/60 p-1.5 rounded border border-border-subtle">
                <code className="text-accent-primary font-bold">*</code> Kleene Star (0+)
              </div>
              <div className="bg-bg-surface1/60 p-1.5 rounded border border-border-subtle">
                <code className="text-accent-primary font-bold">+</code> Plus Operator (1+)
              </div>
              <div className="bg-bg-surface1/60 p-1.5 rounded border border-border-subtle">
                <code className="text-accent-primary font-bold">?</code> Optional (0 or 1)
              </div>
              <div className="bg-bg-surface1/60 p-1.5 rounded border border-border-subtle">
                <code className="text-accent-primary font-bold">( )</code> Parentheses Grouping
              </div>
              <div className="bg-bg-surface1/60 p-1.5 rounded border border-border-subtle">
                <code className="text-accent-primary font-bold">ε / λ</code> Empty Transition
              </div>
            </div>
          </div>
        </div>
      );
    }

    const trace = result.trace || [];
    const ast = result.ast;
    const initialNode = result.nodes.find((n) => n.isInitial);
    const initialLabel = initialNode ? initialNode.label || initialNode.id : 'q₀';
    const acceptingNodes = result.nodes.filter((n) => n.isAccepting);
    const acceptingLabels = acceptingNodes.map((n) => n.label || n.id);
    const epsilonCount = result.edges.filter((e) => e.label === 'ε' || e.label === 'λ').length;

    return (
      <div className="flex-1 flex flex-col overflow-y-auto p-3.5 space-y-4 bg-bg-surface1 text-xs font-mono select-none">
        {/* Source Switcher Sub-Header if Minimization result also exists */}
        {lastMinimizationResult && (
          <div className="flex border-b border-border-subtle pb-2 mb-1 space-x-1 shrink-0">
            <button
              onClick={() => setActiveExplanationSource('regex')}
              className="flex-1 py-1 rounded text-[10px] font-bold border transition-colors bg-accent-primary/15 border-accent-primary text-accent-primary"
            >
              Regex Conversion
            </button>
            <button
              onClick={() => setActiveExplanationSource('minimization')}
              className="flex-1 py-1 rounded text-[10px] font-bold border transition-colors bg-bg-surface2 border-border-subtle text-txt-muted hover:text-txt-primary"
            >
              Hopcroft Minimization
            </button>
          </div>
        )}

        {/* Header Banner */}
        <div className="flex items-center space-x-2 border-b border-border-subtle pb-3 shrink-0">
          <div className="p-1.5 bg-accent-primary/15 text-accent-primary rounded-md">
            <Code size={18} />
          </div>
          <div>
            <h3 className="font-bold text-txt-primary text-sm">RegEx → ε-NFA Conversion</h3>
            <p className="text-[11px] text-txt-muted">Thompson Construction Formal Derivation</p>
          </div>
        </div>

        {/* SECTION 1: Input Regular Expression */}
        <div className="p-3 bg-bg-surface2/80 rounded-lg border border-border-subtle space-y-1.5">
          <div className="text-txt-muted text-[10px] font-bold tracking-wider">1. INPUT REGULAR EXPRESSION</div>
          <div className="font-bold text-accent-primary text-sm font-mono bg-bg-surface1 p-2 rounded border border-border-subtle">
            {inputRegex || 'ε'}
          </div>
        </div>

        {/* SECTION 2: Parsing / Structure (AST Breakdown) */}
        {ast && (
          <div className="bg-bg-surface2/70 p-3 rounded-lg border border-border-subtle space-y-2">
            <div className="font-bold text-txt-primary text-[11px] flex items-center space-x-1.5">
              <GitBranch size={14} className="text-accent-cyan" />
              <span>2. Abstract Syntax Tree (AST) Parsing</span>
            </div>
            <div className="p-2.5 bg-bg-surface1 rounded border border-border-subtle text-[11px] font-mono leading-relaxed overflow-x-auto">
              {renderASTNodeTree(ast)}
            </div>
          </div>
        )}

        {/* SECTION 3 & 4: Thompson Construction Steps & Intermediate Sequence */}
        {trace.length > 0 && (
          <div className="bg-bg-surface2/70 p-3 rounded-lg border border-border-subtle space-y-2.5">
            <div className="font-bold text-txt-primary text-[11px] flex items-center space-x-1.5">
              <Layers size={14} className="text-accent-primary" />
              <span>3 & 4. Thompson Construction Trace Steps</span>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {trace.map((step) => (
                <div key={step.stepIndex} className="bg-bg-surface1 p-2.5 rounded border border-border-subtle space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-accent-primary flex items-center space-x-1">
                      <span>Step {step.stepIndex}</span>
                      <span className="text-txt-muted font-normal">({step.opType})</span>
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-bg-surface2 text-txt-secondary border border-border-subtle">
                      Fragment: {step.fragment.startId} → {step.fragment.acceptId}
                    </span>
                  </div>

                  <div className="text-[10px] text-txt-muted leading-snug">{step.description}</div>

                  {/* Created States */}
                  {step.createdStateIds.length > 0 && (
                    <div className="text-[10px] text-txt-secondary">
                      <span className="text-txt-muted">Created States: </span>
                      <span className="font-bold text-accent-primary">&#123;{step.createdStateIds.join(', ')}&#125;</span>
                    </div>
                  )}

                  {/* Created Transitions */}
                  {step.createdTransitions.length > 0 && (
                    <div className="space-y-0.5 pt-0.5">
                      <div className="text-[9px] text-txt-muted font-bold">Transitions:</div>
                      {step.createdTransitions.map((t) => (
                        <div key={t.id} className="text-[9px] font-mono text-txt-secondary flex items-center space-x-1 pl-2">
                          <GitCommit size={10} className="text-accent-cyan" />
                          <span>{t.sourceId}</span>
                          <ArrowRight size={10} className="text-txt-muted" />
                          <span className="font-bold text-accent-primary">'{t.label}'</span>
                          <ArrowRight size={10} className="text-txt-muted" />
                          <span>{t.targetId}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SECTION 5: Final NFA 5-Tuple Specification */}
        <div className="bg-bg-surface2/70 p-3 rounded-lg border border-border-subtle space-y-2">
          <div className="font-bold text-txt-primary text-[11px] flex items-center justify-between">
            <span className="text-accent-primary">5. GENERATED NFA FORMAL SPECIFICATION</span>
            <span className="text-[10px] text-txt-muted font-normal">N = (Q, Σ, δ, q₀, F)</span>
          </div>
          <div className="space-y-1 text-[11px] text-txt-secondary bg-bg-surface1 p-2 rounded border border-border-subtle">
            <div><b className="text-txt-primary">Q</b> (States) = &#123;{result.nodes.map((n) => n.label || n.id).join(', ')}&#125;</div>
            <div><b className="text-txt-primary">Σ</b> (Alphabet) = &#123;{result.alphabet.length > 0 ? result.alphabet.join(', ') : '∅'}&#125;</div>
            <div><b className="text-txt-primary">q₀</b> (Start State) = {initialLabel}</div>
            <div><b className="text-txt-primary">F</b> (Accepting States) = &#123;{acceptingLabels.join(', ')}&#125;</div>
          </div>
        </div>

        {/* SECTION 6: Construction Summary Metrics */}
        <div className="grid grid-cols-4 gap-1.5 text-center">
          <div className="bg-bg-surface2 p-2 rounded border border-border-subtle">
            <div className="text-txt-muted text-[9px]">STATES</div>
            <div className="font-bold text-txt-primary text-xs mt-0.5">{result.nodes.length}</div>
          </div>
          <div className="bg-bg-surface2 p-2 rounded border border-border-subtle">
            <div className="text-txt-muted text-[9px]">TRANSITIONS</div>
            <div className="font-bold text-txt-primary text-xs mt-0.5">{result.edges.length}</div>
          </div>
          <div className="bg-bg-surface2 p-2 rounded border border-border-subtle">
            <div className="text-txt-muted text-[9px]">ε-TRANSITIONS</div>
            <div className="font-bold text-accent-primary text-xs mt-0.5">{epsilonCount}</div>
          </div>
          <div className="bg-bg-surface2 p-2 rounded border border-border-subtle">
            <div className="text-txt-muted text-[9px]">ACCEPTING</div>
            <div className="font-bold text-semantic-accept text-xs mt-0.5">{acceptingNodes.length}</div>
          </div>
        </div>

        {/* SECTION 7: Supported Operators Reference Guide */}
        <div className="p-3 bg-bg-surface2/60 rounded-lg border border-border-subtle space-y-2 text-[11px]">
          <div className="font-bold text-txt-primary flex items-center space-x-1.5">
            <BookOpen size={14} className="text-accent-primary" />
            <span>Supported Operators Reference</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5 text-[10px] text-txt-secondary">
            <div className="bg-bg-surface1/60 p-1.5 rounded border border-border-subtle">
              <code className="text-accent-primary font-bold">|</code> Alternation (Union)
            </div>
            <div className="bg-bg-surface1/60 p-1.5 rounded border border-border-subtle">
              <code className="text-accent-primary font-bold">*</code> Kleene Star (0+)
            </div>
            <div className="bg-bg-surface1/60 p-1.5 rounded border border-border-subtle">
              <code className="text-accent-primary font-bold">+</code> Plus Operator (1+)
            </div>
            <div className="bg-bg-surface1/60 p-1.5 rounded border border-border-subtle">
              <code className="text-accent-primary font-bold">?</code> Optional (0 or 1)
            </div>
            <div className="bg-bg-surface1/60 p-1.5 rounded border border-border-subtle">
              <code className="text-accent-primary font-bold">( )</code> Parentheses Grouping
            </div>
            <div className="bg-bg-surface1/60 p-1.5 rounded border border-border-subtle">
              <code className="text-accent-primary font-bold">ε / λ</code> Empty Transition
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // HOPCROFT DFA MINIMIZATION EXPLANATION VIEW
  // ---------------------------------------------------------------------------
  if (currentSource === 'minimization' && lastMinimizationResult) {
    const res = lastMinimizationResult;
    const trace = res.trace;

    const alphabet = Array.from(
      new Set(edges.map((e) => e.label).filter((l) => l && l !== 'ε' && l !== 'λ'))
    ).sort();
    const stateLabels = nodes.map((n) => n.label || n.id);
    const initialNode = nodes.find((n) => n.isInitial);
    const initialLabel = initialNode ? initialNode.label || initialNode.id : 'q₀';
    const acceptingLabels = nodes.filter((n) => n.isAccepting).map((n) => n.label || n.id);
    const nonAcceptingLabels = nodes.filter((n) => !n.isAccepting).map((n) => n.label || n.id);

    const minStateLabels = res.nodes.map((n) => n.label || n.id);
    const minInitialNode = res.nodes.find((n) => n.isInitial);
    const minInitialLabel = minInitialNode ? minInitialNode.label || minInitialNode.id : 'min_q0';
    const minAcceptingLabels = res.nodes.filter((n) => n.isAccepting).map((n) => n.label || n.id);

    return (
      <div className="flex-1 flex flex-col overflow-y-auto p-3.5 space-y-4 bg-bg-surface1 text-xs font-mono select-none">
        {/* Source Switcher Sub-Header if Regex result also exists */}
        {lastRegexResult && (
          <div className="flex border-b border-border-subtle pb-2 mb-1 space-x-1 shrink-0">
            <button
              onClick={() => setActiveExplanationSource('regex')}
              className="flex-1 py-1 rounded text-[10px] font-bold border transition-colors bg-bg-surface2 border-border-subtle text-txt-muted hover:text-txt-primary"
            >
              Regex Conversion
            </button>
            <button
              onClick={() => setActiveExplanationSource('minimization')}
              className="flex-1 py-1 rounded text-[10px] font-bold border transition-colors bg-accent-primary/15 border-accent-primary text-accent-primary"
            >
              Hopcroft Minimization
            </button>
          </div>
        )}

        {/* Header Banner */}
        <div className="flex items-center justify-between border-b border-border-subtle pb-3 shrink-0">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-accent-primary/15 text-accent-primary rounded-md">
              <Cpu size={18} />
            </div>
            <div>
              <h3 className="font-bold text-txt-primary text-sm">Hopcroft DFA Minimization</h3>
              <p className="text-[11px] text-txt-muted">Formal Academic Proof & Partition Refinement</p>
            </div>
          </div>
          {machineType === 'DFA' && (
            <button
              onClick={handleRunMinimization}
              className="px-2.5 py-1 rounded bg-bg-surface2 hover:bg-bg-surface3 border border-border-subtle text-txt-primary font-medium flex items-center space-x-1 text-[10px] transition-colors"
            >
              <span>Re-run</span>
              <ArrowRight size={12} />
            </button>
          )}
        </div>

        {/* Result Status Badge */}
        <div
          className={`p-2.5 rounded-lg border flex items-center space-x-2 ${
            res.success
              ? 'bg-semantic-accept/10 border-semantic-accept/30 text-semantic-accept'
              : 'bg-semantic-error/10 border-semantic-error/30 text-semantic-error'
          }`}
        >
          {res.success ? <CheckCircle2 size={16} className="shrink-0" /> : <AlertTriangle size={16} className="shrink-0" />}
          <div className="font-bold text-[11px]">
            {res.success
              ? res.isAlreadyMinimal
                ? '✓ DFA is already minimal. No further state reduction possible.'
                : `✓ Reduced from ${res.reachableStateCount} to ${res.minimizedStateCount} state(s) (Merged ${res.mergedStateCount}).`
              : `✕ Minimization Error: ${res.errorMessage}`}
          </div>
        </div>

        {/* SECTION 1: Input DFA Formal 5-Tuple */}
        <div className="bg-bg-surface2/70 p-3 rounded-lg border border-border-subtle space-y-2">
          <div className="font-bold text-txt-primary flex items-center justify-between text-[11px]">
            <span className="text-accent-primary">INPUT DFA FORMAL SPECIFICATION</span>
            <span className="text-[10px] text-txt-muted font-normal">M = (Q, Σ, δ, q₀, F)</span>
          </div>
          <div className="space-y-1 text-[11px] text-txt-secondary bg-bg-surface1 p-2 rounded border border-border-subtle">
            <div><b className="text-txt-primary">Q</b> (States) = &#123;{stateLabels.join(', ')}&#125;</div>
            <div><b className="text-txt-primary">Σ</b> (Alphabet) = &#123;{alphabet.length > 0 ? alphabet.join(', ') : '∅'}&#125;</div>
            <div><b className="text-txt-primary">q₀</b> (Start State) = {initialLabel}</div>
            <div><b className="text-txt-primary">F</b> (Accepting States) = &#123;{acceptingLabels.join(', ')}&#125;</div>
          </div>
        </div>

        {/* SECTION 2: Step 1 — Initial Partition P0 */}
        <div className="bg-bg-surface2/70 p-3 rounded-lg border border-border-subtle space-y-2">
          <div className="font-bold text-txt-primary text-[11px] flex items-center space-x-1.5">
            <Layers size={14} className="text-accent-cyan" />
            <span>Step 1 — Initial Partition (P₀)</span>
          </div>
          <p className="text-[11px] text-txt-muted leading-tight">
            Separate states into accepting (F) and non-accepting (Q − F) sets:
          </p>
          <div className="space-y-1 text-[11px]">
            <div className="p-1.5 bg-bg-surface1 rounded border border-border-subtle">
              <span className="font-bold text-semantic-accept">P₀[0] (F)</span> = &#123;{acceptingLabels.length > 0 ? acceptingLabels.join(', ') : '∅'}&#125;
            </div>
            <div className="p-1.5 bg-bg-surface1 rounded border border-border-subtle">
              <span className="font-bold text-txt-secondary">P₀[1] (Q − F)</span> = &#123;{nonAcceptingLabels.length > 0 ? nonAcceptingLabels.join(', ') : '∅'}&#125;
            </div>
          </div>
        </div>

        {/* SECTION 3: Step 2 — Partition Refinement Iterations */}
        {trace && trace.steps && trace.steps.length > 0 && (
          <div className="bg-bg-surface2/70 p-3 rounded-lg border border-border-subtle space-y-2.5">
            <div className="font-bold text-txt-primary text-[11px] flex items-center space-x-1.5">
              <Layers size={14} className="text-accent-primary" />
              <span>Step 2 — Partition Refinement Sequence</span>
            </div>

            <div className="space-y-2">
              {trace.steps.map((step, idx) => (
                <div key={idx} className="bg-bg-surface1 p-2.5 rounded border border-border-subtle space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-accent-primary">Iteration {step.iteration}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                        step.splitOccurred
                          ? 'bg-semantic-warning/15 text-semantic-warning border border-semantic-warning/30'
                          : 'bg-semantic-accept/15 text-semantic-accept border border-semantic-accept/30'
                      }`}
                    >
                      {step.splitOccurred ? 'Split Occurred' : 'Partition Stabilized'}
                    </span>
                  </div>
                  <div className="text-[10px] text-txt-muted">{step.description}</div>
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {step.currentPartitionLabels.map((group, gIdx) => (
                      <div key={gIdx} className="px-2 py-0.5 bg-bg-surface2 rounded text-[10px] font-bold text-txt-secondary border border-border-subtle">
                        P_{step.iteration}[{gIdx}] = &#123;{group.join(', ')}&#125;
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SECTION 4: Step 3 — Stable Partition / Equivalence Classes */}
        {res.equivalenceClasses.length > 0 && (
          <div className="bg-bg-surface2/70 p-3 rounded-lg border border-border-subtle space-y-2">
            <div className="font-bold text-txt-primary text-[11px] flex items-center space-x-1.5">
              <ShieldCheck size={14} className="text-semantic-accept" />
              <span>Step 3 — Stable Equivalence Classes ([q] ∈ Q')</span>
            </div>
            <div className="space-y-1.5">
              {res.equivalenceClasses.map((eq, idx) => (
                <div
                  key={idx}
                  className="p-2 bg-bg-surface1 rounded border border-border-subtle flex items-center justify-between text-[11px]"
                >
                  <div className="flex items-center space-x-1.5">
                    <span className="font-bold text-accent-primary">[{eq.minimizedStateLabel}]</span>
                    {eq.isInitial && <span className="text-[9px] bg-accent-primary/20 text-accent-primary px-1 rounded font-bold">q₀</span>}
                    {eq.isAccepting && <span className="text-[9px] bg-semantic-accept/20 text-semantic-accept px-1 rounded font-bold">F</span>}
                  </div>
                  <div className="text-txt-muted text-[10px]">
                    Original: &#123;{eq.originalStateLabels.join(', ')}&#125;
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SECTION 5: Step 4 — Minimized DFA Construction & Formal 5-Tuple */}
        <div className="bg-bg-surface2/70 p-3 rounded-lg border border-border-subtle space-y-2">
          <div className="font-bold text-txt-primary text-[11px] flex items-center justify-between">
            <span className="text-accent-primary">Step 4 — MINIMIZED DFA (M') FORMAL SPEC</span>
            <span className="text-[10px] text-txt-muted font-normal">M' = (Q', Σ, δ', q₀', F')</span>
          </div>
          <div className="space-y-1 text-[11px] text-txt-secondary bg-bg-surface1 p-2 rounded border border-border-subtle">
            <div><b className="text-txt-primary">Q'</b> (Minimized States) = &#123;{minStateLabels.join(', ')}&#125;</div>
            <div><b className="text-txt-primary">Σ</b> (Alphabet) = &#123;{alphabet.length > 0 ? alphabet.join(', ') : '∅'}&#125;</div>
            <div><b className="text-txt-primary">q₀'</b> (Start State) = {minInitialLabel}</div>
            <div><b className="text-txt-primary">F'</b> (Accepting States) = &#123;{minAcceptingLabels.length > 0 ? minAcceptingLabels.join(', ') : '∅'}&#125;</div>
          </div>
        </div>

        {/* SECTION 6: Metrics Summary */}
        <div className="grid grid-cols-5 gap-1.5 text-center">
          <div className="bg-bg-surface2 p-2 rounded border border-border-subtle">
            <div className="text-txt-muted text-[9px]">ORIGINAL</div>
            <div className="font-bold text-txt-primary text-xs mt-0.5">{res.originalStateCount}</div>
          </div>
          <div className="bg-bg-surface2 p-2 rounded border border-border-subtle">
            <div className="text-txt-muted text-[9px]">REACHABLE</div>
            <div className="font-bold text-txt-primary text-xs mt-0.5">{res.reachableStateCount}</div>
          </div>
          <div className="bg-bg-surface2 p-2 rounded border border-border-subtle">
            <div className="text-txt-muted text-[9px]">UNREACHABLE</div>
            <div className="font-bold text-semantic-warning text-xs mt-0.5">{res.unreachableStateCount}</div>
          </div>
          <div className="bg-bg-surface2 p-2 rounded border border-border-subtle">
            <div className="text-txt-muted text-[9px]">MINIMIZED</div>
            <div className="font-bold text-accent-primary text-xs mt-0.5">{res.minimizedStateCount}</div>
          </div>
          <div className="bg-bg-surface2 p-2 rounded border border-border-subtle">
            <div className="text-txt-muted text-[9px]">MERGED</div>
            <div className="font-bold text-semantic-accept text-xs mt-0.5">{res.mergedStateCount}</div>
          </div>
        </div>
      </div>
    );
  }

  // Empty state if neither minimization nor regex has been run yet
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center select-none bg-bg-surface1 text-xs font-mono space-y-3">
      <div className="p-3 rounded-full bg-accent-primary/10 text-accent-primary border border-accent-primary/20">
        <BookOpen size={28} />
      </div>
      <div className="max-w-md space-y-1">
        <h3 className="font-bold text-txt-primary text-sm">No Active Formal Proof Explanation</h3>
        <p className="text-txt-muted text-[11px]">
          Run Hopcroft Partition Refinement Minimization on a DFA or convert a Regular Expression to an ε-NFA to generate step-by-step mathematical proofs inside this tab.
        </p>
      </div>
      {machineType === 'DFA' && (
        <button
          onClick={handleRunMinimization}
          className="px-4 py-1.5 rounded-md bg-accent-primary hover:bg-accent-hover text-white font-semibold flex items-center space-x-1.5 transition-colors shadow-xs"
        >
          <span>Run Hopcroft Minimization</span>
          <ArrowRight size={14} />
        </button>
      )}
    </div>
  );
};
