import { ChatMessage, ChatRequest, AIContextSnapshot } from './types';
import {
  MAX_MESSAGE_CONTENT_LENGTH,
  MAX_CONVERSATION_TURNS,
  MAX_CONTEXT_STATES,
  MAX_CONTEXT_TRANSITIONS,
  MAX_CONTEXT_DIAGNOSTICS,
} from './constants';

export class RequestValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RequestValidationError';
  }
}

export function validateContextSnapshot(ctx: unknown): asserts ctx is AIContextSnapshot {
  if (!ctx || typeof ctx !== 'object') {
    throw new RequestValidationError('Context must be a non-null object.');
  }

  const c = ctx as Record<string, unknown>;
  if (c.version !== '1.0.0') {
    throw new RequestValidationError('Context version must be "1.0.0".');
  }

  if (!c.workspace || typeof c.workspace !== 'object') {
    throw new RequestValidationError('Context must have a valid workspace object.');
  }

  if (!c.machine || typeof c.machine !== 'object') {
    throw new RequestValidationError('Context must have a valid machine object.');
  }

  const machine = c.machine as Record<string, unknown>;
  if (typeof machine.type !== 'string') {
    throw new RequestValidationError('Context machine must have a valid string type.');
  }

  if (!Array.isArray(machine.states) || !Array.isArray(machine.transitions)) {
    throw new RequestValidationError('Context machine states and transitions must be arrays.');
  }

  if (machine.states.length > MAX_CONTEXT_STATES + 5) {
    throw new RequestValidationError(`Context exceeds maximum states limit (${MAX_CONTEXT_STATES}).`);
  }

  if (machine.transitions.length > MAX_CONTEXT_TRANSITIONS + 5) {
    throw new RequestValidationError(`Context exceeds maximum transitions limit (${MAX_CONTEXT_TRANSITIONS}).`);
  }

  if (c.analysis && typeof c.analysis === 'object') {
    const analysis = c.analysis as Record<string, unknown>;
    if (Array.isArray(analysis.diagnostics) && analysis.diagnostics.length > MAX_CONTEXT_DIAGNOSTICS + 5) {
      throw new RequestValidationError(`Context exceeds maximum diagnostics limit (${MAX_CONTEXT_DIAGNOSTICS}).`);
    }
  }
}

export function validateChatRequest(request: unknown): asserts request is ChatRequest {
  if (!request || typeof request !== 'object') {
    throw new RequestValidationError('Request body must be a non-null object.');
  }

  const req = request as Record<string, unknown>;

  if (!Array.isArray(req.messages)) {
    throw new RequestValidationError('Field "messages" must be an array.');
  }

  if (req.messages.length === 0) {
    throw new RequestValidationError('Field "messages" must contain at least one message.');
  }

  if (req.messages.length > MAX_CONVERSATION_TURNS) {
    throw new RequestValidationError(`Conversation exceeds maximum allowed turns (${MAX_CONVERSATION_TURNS}).`);
  }

  const validRoles = new Set(['user', 'assistant', 'system']);

  for (let i = 0; i < req.messages.length; i++) {
    const msg = req.messages[i] as ChatMessage;
    if (!msg || typeof msg !== 'object') {
      throw new RequestValidationError(`Message at index ${i} must be a valid object.`);
    }

    if (!validRoles.has(msg.role)) {
      throw new RequestValidationError(`Invalid role "${msg.role}" at index ${i}. Allowed: user, assistant, system.`);
    }

    if (typeof msg.content !== 'string') {
      throw new RequestValidationError(`Message content at index ${i} must be a string.`);
    }

    const trimmed = msg.content.trim();
    if (trimmed.length === 0) {
      throw new RequestValidationError(`Message content at index ${i} cannot be empty.`);
    }

    const isLatestUserMessage = i === req.messages.length - 1 && msg.role === 'user';

    if (msg.content.length > MAX_MESSAGE_CONTENT_LENGTH) {
      if (isLatestUserMessage) {
        throw new RequestValidationError(
          `Message content at index ${i} exceeds maximum length of ${MAX_MESSAGE_CONTENT_LENGTH} characters.`
        );
      } else {
        // Deterministically bound history messages to prevent multi-turn session degradation
        msg.content = msg.content.slice(0, 3800) + '\n... [History truncated for context]';
      }
    }

  }

  if (req.context !== undefined && req.context !== null) {
    validateContextSnapshot(req.context);
  }

  if (req.maxTokens !== undefined) {
    if (typeof req.maxTokens !== 'number' || req.maxTokens <= 0 || req.maxTokens > 4096) {
      throw new RequestValidationError('Field "maxTokens" must be a positive number up to 4096.');
    }
  }

  if (req.temperature !== undefined) {
    if (typeof req.temperature !== 'number' || req.temperature < 0 || req.temperature > 2) {
      throw new RequestValidationError('Field "temperature" must be a number between 0 and 2.');
    }
  }
}
