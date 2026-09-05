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
        validateActionEnvelope(rawJson);
        const cleanedText = content.replace(match[0], '').trim();
        return {
          cleanedText,
          actionProposal: rawJson,
        };
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
      validateActionEnvelope(rawJson);
      const cleanedText = content.replace(rawMatch[0], '').trim();
      return {
        cleanedText,
        actionProposal: rawJson,
      };
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
        validateActionEnvelope(rawJson);
        return {
          cleanedText: content.slice(0, actualStart).trim(),
          actionProposal: rawJson,
        };
      } catch {
        // ignore
      }
    }
  }

  return { cleanedText: content };
}

