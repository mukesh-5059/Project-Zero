import {
  AIActionEnvelope,
  AIActionItem,
  AIActionType,
} from './types';
import {
  MAX_AI_ACTIONS_PER_PROPOSAL,
  MAX_ACTION_LABEL_LENGTH,
  MAX_ACTION_SYMBOL_LENGTH,
} from './constants';

export class ActionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ActionValidationError';
  }
}

const VALID_ACTION_TYPES = new Set<AIActionType>([
  'CREATE_STATE',
  'DELETE_STATE',
  'SET_INITIAL_STATE',
  'TOGGLE_ACCEPTING_STATE',
  'CREATE_TRANSITION',
  'EDIT_TRANSITION',
  'DELETE_TRANSITION',
]);

/**
 * Validates the structural integrity and bounds of an AIActionEnvelope.
 */
export function validateActionEnvelope(envelope: unknown): asserts envelope is AIActionEnvelope {
  if (!envelope || typeof envelope !== 'object') {
    throw new ActionValidationError('Action envelope must be a non-null object.');
  }

  const env = envelope as Record<string, unknown>;

  if (env.version !== '1.0.0') {
    throw new ActionValidationError('Action envelope version must be "1.0.0".');
  }

  if (!Array.isArray(env.actions)) {
    throw new ActionValidationError('Field "actions" must be an array.');
  }

  if (env.actions.length === 0) {
    throw new ActionValidationError('Action envelope must contain at least one action.');
  }

  if (env.actions.length > MAX_AI_ACTIONS_PER_PROPOSAL) {
    throw new ActionValidationError(`Action count exceeds maximum limit (${MAX_AI_ACTIONS_PER_PROPOSAL}).`);
  }

  for (let i = 0; i < env.actions.length; i++) {
    const item = env.actions[i] as AIActionItem;
    if (!item || typeof item !== 'object') {
      throw new ActionValidationError(`Action at index ${i} must be an object.`);
    }

    if (!VALID_ACTION_TYPES.has(item.type)) {
      throw new ActionValidationError(`Unsupported action type "${item.type}" at index ${i}.`);
    }

    if (!item.parameters || typeof item.parameters !== 'object') {
      throw new ActionValidationError(`Action "${item.type}" at index ${i} must have a valid parameters object.`);
    }

    validateActionItemParameters(item.type, item.parameters, i);
  }
}

function validateActionItemParameters(
  type: AIActionType,
  params: Record<string, unknown>,
  index: number
) {
  switch (type) {
    case 'CREATE_STATE':
    case 'DELETE_STATE':
    case 'SET_INITIAL_STATE':
    case 'TOGGLE_ACCEPTING_STATE': {
      if (typeof params.label !== 'string' || params.label.trim().length === 0) {
        throw new ActionValidationError(`Action "${type}" at index ${index} requires a non-empty string "label".`);
      }
      if (params.label.length > MAX_ACTION_LABEL_LENGTH) {
        throw new ActionValidationError(`State label at index ${index} exceeds ${MAX_ACTION_LABEL_LENGTH} chars.`);
      }
      break;
    }

    case 'CREATE_TRANSITION': {
      if (typeof params.from !== 'string' || typeof params.to !== 'string' || typeof params.symbol !== 'string') {
        throw new ActionValidationError(`CREATE_TRANSITION at index ${index} requires "from", "to", and "symbol".`);
      }
      if (params.symbol.length > MAX_ACTION_SYMBOL_LENGTH) {
        throw new ActionValidationError(`Transition symbol at index ${index} exceeds ${MAX_ACTION_SYMBOL_LENGTH} chars.`);
      }
      break;
    }

    case 'EDIT_TRANSITION': {
      if (
        typeof params.from !== 'string' ||
        typeof params.to !== 'string' ||
        typeof params.oldSymbol !== 'string' ||
        typeof params.newSymbol !== 'string'
      ) {
        throw new ActionValidationError(
          `EDIT_TRANSITION at index ${index} requires "from", "to", "oldSymbol", and "newSymbol".`
        );
      }
      break;
    }

    case 'DELETE_TRANSITION': {
      if (typeof params.from !== 'string' || typeof params.to !== 'string' || typeof params.symbol !== 'string') {
        throw new ActionValidationError(`DELETE_TRANSITION at index ${index} requires "from", "to", and "symbol".`);
      }
      break;
    }
  }
}

/**
 * Normalizes either an imperative action envelope or a declarative 5-tuple automaton (Q, Σ, δ, q0, F)
 * into a canonical AIActionEnvelope.
 */
export function normalizeToEnvelope(raw: unknown): AIActionEnvelope | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;

  // If already an imperative envelope with actions array
  if (Array.isArray(obj.actions)) {
    return obj as unknown as AIActionEnvelope;
  }

  // Check if declarative automaton representation
  const rawStates = obj.states || obj.States;
  if (!Array.isArray(rawStates)) {
    return null;
  }

  const actions: AIActionItem[] = [];
  let actCounter = 1;

  // Determine start state
  const rawStart = obj.start ?? obj.start_state ?? obj.initial ?? obj.initial_state ?? obj.startState;
  const startStateLabel = typeof rawStart === 'string' ? rawStart.trim() : null;

  // Determine accepting/final states
  const rawFinal =
    obj.final ??
    obj.final_states ??
    obj.accepting ??
    obj.accepting_states ??
    obj.finalStates ??
    obj.acceptingStates;
  const finalSet = new Set<string>();
  if (Array.isArray(rawFinal)) {
    for (const f of rawFinal) {
      if (typeof f === 'string') finalSet.add(f.trim());
    }
  } else if (typeof rawFinal === 'string') {
    finalSet.add(rawFinal.trim());
  }

  // Process states
  for (const s of rawStates) {
    let label = '';
    let isInitial = false;
    let isAccepting = false;

    if (typeof s === 'string') {
      label = s.trim();
      isInitial = label === startStateLabel;
      isAccepting = finalSet.has(label);
    } else if (s && typeof s === 'object') {
      const sObj = s as Record<string, unknown>;
      label = String(sObj.name ?? sObj.label ?? sObj.id ?? '').trim();
      isInitial = Boolean(sObj.start ?? sObj.isInitial ?? sObj.initial ?? (label === startStateLabel));
      isAccepting = Boolean(sObj.final ?? sObj.isAccepting ?? sObj.isFinal ?? sObj.accepting ?? finalSet.has(label));
    }

    if (label) {
      actions.push({
        id: `act_${actCounter++}`,
        type: 'CREATE_STATE',
        parameters: {
          label,
          isInitial,
          isAccepting,
        },
        description: `Create state ${label}${isInitial ? ' (start)' : ''}${isAccepting ? ' (final)' : ''}`,
      });
    }
  }

  // Process transitions
  const rawTransitions = obj.transitions ?? obj.Transitions ?? obj.transition ?? obj.delta;
  if (Array.isArray(rawTransitions)) {
    for (const t of rawTransitions) {
      if (Array.isArray(t) && t.length >= 3) {
        // [from, symbol, to]
        const from = String(t[0]).trim();
        const symbol = String(t[1]).trim();
        const to = String(t[2]).trim();
        if (from && to) {
          actions.push({
            id: `act_${actCounter++}`,
            type: 'CREATE_TRANSITION',
            parameters: { from, to, symbol },
            description: `Transition δ(${from}, '${symbol}') -> ${to}`,
          });
        }
      } else if (t && typeof t === 'object') {
        const tObj = t as Record<string, unknown>;
        const from = String(tObj.from ?? tObj.source ?? tObj.src ?? '').trim();
        const to = String(tObj.to ?? tObj.target ?? tObj.tgt ?? tObj.dest ?? '').trim();
        const symbol = String(tObj.symbol ?? tObj.input ?? tObj.read ?? '').trim();
        if (from && to) {
          actions.push({
            id: `act_${actCounter++}`,
            type: 'CREATE_TRANSITION',
            parameters: {
              from,
              to,
              symbol,
              stackTop: typeof tObj.stackTop === 'string' ? tObj.stackTop : undefined,
              stackReplacement: typeof tObj.stackReplacement === 'string' ? tObj.stackReplacement : undefined,
              readSymbol: typeof tObj.readSymbol === 'string' ? tObj.readSymbol : undefined,
              writeSymbol: typeof tObj.writeSymbol === 'string' ? tObj.writeSymbol : undefined,
              moveDirection: (tObj.moveDirection as 'L' | 'R' | 'S') || undefined,
            },
            description: `Transition δ(${from}, '${symbol}') -> ${to}`,
          });
        }
      }
    }
  } else if (rawTransitions && typeof rawTransitions === 'object') {
    // Transition map: { fromState: { symbol: toState | [toStates] } }
    for (const [from, symbolMap] of Object.entries(rawTransitions as Record<string, unknown>)) {
      if (symbolMap && typeof symbolMap === 'object') {
        for (const [symbol, target] of Object.entries(symbolMap as Record<string, unknown>)) {
          if (Array.isArray(target)) {
            for (const to of target) {
              actions.push({
                id: `act_${actCounter++}`,
                type: 'CREATE_TRANSITION',
                parameters: { from: from.trim(), to: String(to).trim(), symbol: symbol.trim() },
                description: `Transition δ(${from}, '${symbol}') -> ${to}`,
              });
            }
          } else if (target !== undefined && target !== null) {
            actions.push({
              id: `act_${actCounter++}`,
              type: 'CREATE_TRANSITION',
              parameters: { from: from.trim(), to: String(target).trim(), symbol: symbol.trim() },
              description: `Transition δ(${from}, '${symbol}') -> ${target}`,
            });
          }
        }
      }
    }
  }

  if (actions.length === 0) return null;

  const stateCount = actions.filter((a) => a.type === 'CREATE_STATE').length;
  const machineTypeStr = typeof obj.type === 'string' ? obj.type : 'Automaton';

  return {
    version: '1.0.0',
    summary: String(obj.summary || `Construct ${machineTypeStr} with ${stateCount} states`),
    actions,
  };
}

/**
 * Extracts and validates a structured action envelope from an AI response text if present.
 */
export function extractActionProposal(content: string): { cleanedText: string; actionProposal?: AIActionEnvelope } {
  // 1. Try matching fenced code blocks with any language identifier
  const fencedBlockRegex = /```(?:[a-zA-Z0-9_:-]+)?\s*\n?([\s\S]*?)\n?```/gi;
  let match: RegExpExecArray | null;

  while ((match = fencedBlockRegex.exec(content)) !== null) {
    const rawContent = match[1].trim();
    const startBracket = rawContent.indexOf('{');
    const endBracket = rawContent.lastIndexOf('}');
    if (startBracket !== -1 && endBracket !== -1 && endBracket > startBracket) {
      try {
        const jsonStr = rawContent.slice(startBracket, endBracket + 1);
        const rawJson = JSON.parse(jsonStr);
        const normalized = normalizeToEnvelope(rawJson);
        if (normalized) {
          validateActionEnvelope(normalized);
          const cleanedText = content.replace(match[0], '').trim();
          return {
            cleanedText,
            actionProposal: normalized,
          };
        }
      } catch {
        // Continue searching
      }
    }
  }

  // 2. Fallback: Search for embedded JSON object with version 1.0.0 and actions array
  const jsonObjectRegex = /\{\s*"version"\s*:\s*"1\.0\.0"[\s\S]*?"actions"\s*:\s*\[[\s\S]*?\]\s*\}/i;
  const rawMatch = content.match(jsonObjectRegex);
  if (rawMatch) {
    try {
      const rawJson = JSON.parse(rawMatch[0]);
      const normalized = normalizeToEnvelope(rawJson);
      if (normalized) {
        validateActionEnvelope(normalized);
        const cleanedText = content.replace(rawMatch[0], '').trim();
        return {
          cleanedText,
          actionProposal: normalized,
        };
      }
    } catch {
      // Malformed json
    }
  }

  // 3. Fallback: Search for start of JSON envelope and complete closing brackets if unclosed
  const startIdx = content.indexOf('{"version":');
  const altStartIdx = content.indexOf('{\n  "version":');
  const actualStart = startIdx !== -1 ? startIdx : altStartIdx;

  if (actualStart !== -1) {
    let candidate = content.slice(actualStart).trim();
    candidate = candidate.replace(/```+$/, '').trim();
    const lastActionObjEnd = candidate.lastIndexOf('}');
    if (lastActionObjEnd !== -1) {
      const candidateSlice = candidate.slice(0, lastActionObjEnd + 1) + ']}';
      try {
        const rawJson = JSON.parse(candidateSlice);
        const normalized = normalizeToEnvelope(rawJson);
        if (normalized) {
          validateActionEnvelope(normalized);
          return {
            cleanedText: content.slice(0, actualStart).trim(),
            actionProposal: normalized,
          };
        }
      } catch {
        // ignore
      }
    }
  }

  return { cleanedText: content };
}

