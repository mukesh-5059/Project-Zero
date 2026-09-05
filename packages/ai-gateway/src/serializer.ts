import { AIContextSnapshot } from './types';
import { MAX_SERIALIZED_CONTEXT_CHARS } from './constants';

/**
 * Deterministically serializes an AIContextSnapshot and Educational Evidence into a clean, compact markdown block
 * for the AI Tutor to ground its explanation.
 *
 * Employs deterministic hierarchical compaction:
 * - Tier 1: Machine Specification (type, stateCount, states, initial, accepting, alphabet, params) & Active Workspace
 * - Tier 2: Selection Focus & Critical Transitions
 * - Tier 3: Deterministic Educational Evidence (validity, diagnostics, minimization)
 * - Tier 4: Detailed Analysis & Observations
 */
export function serializeContextForPrompt(ctx: AIContextSnapshot): string {
  const tier1: string[] = [];

  // Workspace & Intent
  tier1.push(`### [Project Zero Workspace Context]`);
  tier1.push(`- Active Machine Type: ${ctx.workspace.activeMachineType}`);
  if (ctx.workspace.activeBottomTab) {
    tier1.push(`- Active Bottom View: ${ctx.workspace.activeBottomTab}`);
  }
  if (ctx.workspace.activeInspectorTab) {
    tier1.push(`- Active Inspector Tab: ${ctx.workspace.activeInspectorTab}`);
  }
  if (ctx.tutorIntent) {
    tier1.push(`- Educational Mode Intent: ${ctx.tutorIntent}`);
  }

  // Selection Focus
  const nodes = ctx.selection?.selectedNodeLabels || [];
  const edges = ctx.selection?.selectedEdgeDescriptions || [];
  if (nodes.length > 0 || edges.length > 0) {
    const selParts: string[] = [];
    if (nodes.length > 0) selParts.push(`Selected States (Focus): [${nodes.join(', ')}]`);
    if (edges.length > 0) selParts.push(`Selected Transitions (Focus): [${edges.join('; ')}]`);
    tier1.push(`- Current Selection: ${selParts.join(' | ')}`);
  } else {
    tier1.push(`- Current Selection: None (Entire Machine Scope)`);
  }


  // Machine Definition
  tier1.push(`\n### [Current Machine Formal Specification]`);
  tier1.push(`- Type: ${ctx.machine.type}`);
  tier1.push(`- States (${ctx.machine.stateCount}): {${ctx.machine.states.join(', ')}}`);
  tier1.push(`- Initial State: ${ctx.machine.initialState || 'None'}`);
  tier1.push(`- Accepting States: {${ctx.machine.acceptingStates.join(', ')}}`);
  tier1.push(`- Alphabet Σ: {${ctx.machine.alphabet.join(', ')}}`);

  if (ctx.machine.initialStackSymbol) {
    tier1.push(`- Initial Stack Symbol: ${ctx.machine.initialStackSymbol}`);
  }
  if (ctx.machine.blankSymbol) {
    tier1.push(`- Tape Blank Symbol: ${ctx.machine.blankSymbol}`);
  }
  if (ctx.machine.pdaAcceptanceMode) {
    tier1.push(`- PDA Acceptance Mode: ${ctx.machine.pdaAcceptanceMode}`);
  }

  // Tier 2: Transitions
  const tier2: string[] = [];
  if (ctx.machine.transitions.length > 0) {
    tier2.push(`- Transitions (${ctx.machine.transitionCount}):`);
    for (const t of ctx.machine.transitions) {
      let tStr = `  δ(${t.from}, '${t.symbol}') → ${t.to}`;
      if (t.stackPop !== undefined || t.stackPush !== undefined) {
        tStr += ` [pop:${t.stackPop || 'ε'}, push:${t.stackPush || 'ε'}]`;
      }
      if (t.tapeWrite !== undefined || t.tapeDirection !== undefined) {
        tStr += ` [write:${t.tapeWrite || '□'}, dir:${t.tapeDirection || 'R'}]`;
      }
      tier2.push(tStr);
    }
  } else {
    tier2.push(`- Transitions: None`);
  }

  // Tier 3: Educational Evidence
  const tier3: string[] = [];
  if (ctx.evidence) {
    tier3.push(`\n### [Deterministic Educational Evidence]`);
    if (ctx.evidence.validityStatus) {
      tier3.push(`- Verified Validity Status: ${ctx.evidence.validityStatus}`);
    }
    if (ctx.evidence.diagnostics && ctx.evidence.diagnostics.length > 0) {
      tier3.push(`- Official Diagnostics:`);
      for (const diag of ctx.evidence.diagnostics) {
        tier3.push(`  ! ${diag}`);
      }
    }
    if (ctx.evidence.minimization) {
      tier3.push(`- Minimization Facts: isAlreadyMinimal=${ctx.evidence.minimization.isAlreadyMinimal}`);
      if (ctx.evidence.minimization.equivalenceClasses) {
        tier3.push(`  Equivalence Classes: ${ctx.evidence.minimization.equivalenceClasses.map((c) => `[${c.join(',')}]`).join(', ')}`);
      }
    }
    if (ctx.evidence.execution) {
      tier3.push(`- Execution Run for "${ctx.evidence.execution.inputString}": ${ctx.evidence.execution.isAccepted ? 'ACCEPTED' : 'REJECTED'}`);
      if (ctx.evidence.execution.proofSummary) {
        tier3.push(`  Proof: ${ctx.evidence.execution.proofSummary}`);
      }
    }
  } else if (ctx.analysis) {
    tier3.push(`\n### [Analysis & Diagnostics]`);
    if (ctx.analysis.isStructurallyValid !== undefined) {
      tier3.push(`- Formal Structural Validity: ${ctx.analysis.isStructurallyValid ? 'VALID' : 'INVALID'}`);
    }
    if (ctx.analysis.diagnostics && ctx.analysis.diagnostics.length > 0) {
      tier3.push(`- Warnings / Errors:`);
      for (const diag of ctx.analysis.diagnostics) {
        tier3.push(`  ! ${diag}`);
      }
    }
    if (ctx.analysis.observations && ctx.analysis.observations.length > 0) {
      tier3.push(`- Observations:`);
      for (const obs of ctx.analysis.observations) {
        tier3.push(`  * ${obs}`);
      }
    }
  }

  // Assemble with strict budget enforcement
  const allLines: string[] = [...tier1];

  for (const line of tier2) {
    const candidate = [...allLines, line].join('\n');
    if (candidate.length > MAX_SERIALIZED_CONTEXT_CHARS - 100) {
      allLines.push(`  ... [remaining transitions compacted]`);
      break;
    }
    allLines.push(line);
  }

  for (const line of tier3) {
    const candidate = [...allLines, line].join('\n');
    if (candidate.length > MAX_SERIALIZED_CONTEXT_CHARS) {
      break;
    }
    allLines.push(line);
  }

  if (ctx.contextTruncated) {
    allLines.push(`\n[Note: Context bounded: ${ctx.truncationReason || 'Size limit'}]`);
  }

  const result = allLines.join('\n');
  if (result.length > MAX_SERIALIZED_CONTEXT_CHARS) {
    return result.slice(0, MAX_SERIALIZED_CONTEXT_CHARS);
  }
  return result;
}
