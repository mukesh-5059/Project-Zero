import {
  ChatRequest,
  RegisteredModel,
  RoutingDecision,
  TaskCategory,
  TaskProfile,
} from './types';
import { getEnabledModels, getRegisteredModel } from './modelRegistry';

// ============================================================================
// Phase 14A: Deterministic Task Profiler
// Zero I/O, zero network calls, sub-millisecond execution.
// ============================================================================

const EDUCATIONAL_QUERY_PATTERNS = [
  /^(?:explain\s+how\s+to\s+(?:construct|build|create|design)\s+an?\s+(?:dfa|nfa|pda|tm|automaton)\b(?!\s*over|\s*with\s+states|\s*using\s+states|\s*for\s+this))/i,
  /^(?:what\s+is|define|explain|teach\s+me|tell\s+me\s+about|walk\s+me\s+through\s+the\s+concept)\b/i,
];

const CONSTRUCTION_PATTERNS = [
  /\b(?:create|construct|build|make|generate|draw|design|synthesize)\b[\s\S]*?\b(?:dfas?|nfas?|pdas?|tms?|turing\s+machines?|automatons?|automata|machines?|grammars?|states?)\b/i,
  /\b(?:add|create|insert|new)\s+(?:states?|nodes?)\b/i,
  /\b(?:add|create|insert|new)\s+(?:transitions?|edges?|arrows?)\b/i,
  /\b(?:complete\s+(?:the|this)?\s*(?:dfa|nfa|pda|tm|automaton|machine))\b/i,
  /\b(?:missing\s+transitions?)\b/i,
];

const EDITING_PATTERNS = [
  /\b(?:modify|change|edit|update|replace|repair|fix|correct)\b[\s\S]*?\b(?:transitions?|symbols?|labels?|states?|edges?|nodes?|dfas?|nfas?|pdas?|tms?|automatons?|machines?)\b/i,
  /\b(?:delete|remove|clear)\b[\s\S]*?\b(?:states?|nodes?|transitions?|edges?|arrows?)\b/i,
  /\b(?:toggle|set|make)\b[\s\S]*?\b(?:initial|accepting|final|start)\b/i,
  /\b(?:rename|relabel)\s+(?:states?|nodes?)\b/i,
  /\b(?:fix|repair|correct)\s+(?:this|the)?\s*(?:machine|dfa|nfa|pda|tm|automaton|graph)\b/i,
  /\b(?:wrong|incorrect|missing)\s+transitions?\b/i,
  /\b(?:apply\s+(?:this|these)?\s*changes?|convert\s+this\s+machine)\b/i,
];


const COMPLEX_REASONING_PATTERNS = [
  /\b(?:reduction\s+proof|undecidab|halting\s+problem|rice's\s+theorem|post\s+correspondence|pcp)\b/i,
  /\b(?:cyk\s+(?:algorithm|table|matrix)|chomsky\s+normal\s+form\s+conversion\s+proof)\b/i,
  /\b(?:pda\s+to\s+cfg|cfg\s+to\s+pda|greibach\s+normal\s+form)\b/i,
  /\b(?:formal\s+5-tuple|formal\s+7-tuple|multi-tape\s+turing|cross-product\s+construction\s+proof)\b/i,
  /\b(?:prove\s+that.*(?:not\s+regular|not\s+context-free|undecidable|unrecognizable))\b/i,
  /\b(?:deep\s+proof|exhaustive\s+verification|verify\s+every\s+transition\s+and\s+prove)\b/i,
];

export function buildTaskProfile(request: ChatRequest): TaskProfile {
  const lastUserMsg = [...request.messages].reverse().find((m) => m.role === 'user');
  const userText = (lastUserMsg?.content || '').trim();
  const lowerText = userText.toLowerCase();

  const isEducationalGeneral = EDUCATIONAL_QUERY_PATTERNS.some((p) => p.test(lowerText));
  const isConstructionQuery = !isEducationalGeneral && CONSTRUCTION_PATTERNS.some((p) => p.test(lowerText));
  const isEditingQuery = !isEducationalGeneral && EDITING_PATTERNS.some((p) => p.test(lowerText));
  const isComplexFormalProof = COMPLEX_REASONING_PATTERNS.some((p) => p.test(lowerText));

  const tutorIntent = request.context?.tutorIntent;
  const activeMachineType = request.context?.workspace?.activeMachineType || request.context?.machine?.type;

  let category: TaskCategory = 'GENERAL_CHAT';
  let reasoningComplexity: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
  let requiresStructuredActions = false;
  let requiresGraphConstruction = false;
  let requiresGraphEditing = false;
  let requiresGraphUnderstanding = Boolean(request.context?.machine && request.context.machine.stateCount > 0);

  if (isComplexFormalProof) {
    category = 'COMPLEX_FORMAL_REASONING';
    reasoningComplexity = 'HIGH';
  } else if (isConstructionQuery) {
    category = 'AUTOMATON_CONSTRUCTION';
    requiresStructuredActions = true;
    requiresGraphConstruction = true;
    requiresGraphUnderstanding = true;
    reasoningComplexity = 'MEDIUM';
  } else if (isEditingQuery) {
    category = 'GRAPH_EDITING';
    requiresStructuredActions = true;
    requiresGraphEditing = true;
    requiresGraphUnderstanding = true;
    reasoningComplexity = 'MEDIUM';
  } else if (
    tutorIntent === 'WHY' ||
    tutorIntent === 'STEP_BY_STEP' ||
    tutorIntent === 'DEBUG' ||
    lowerText.includes('pumping lemma') ||
    lowerText.includes('minimization') ||
    lowerText.includes('equivalence')
  ) {
    category = 'EDUCATIONAL_REASONING';
    reasoningComplexity = 'MEDIUM';
  } else if (
    isEducationalGeneral ||
    tutorIntent === 'EXPLAIN' ||
    tutorIntent === 'CONCEPT' ||
    lowerText.startsWith('what is') ||
    lowerText.startsWith('define') ||
    lowerText.startsWith('explain')
  ) {
    category = 'SIMPLE_EXPLANATION';
    reasoningComplexity = 'LOW';
  }

  const isLatencySensitive = category === 'SIMPLE_EXPLANATION' || category === 'GENERAL_CHAT' || category === 'GRAPH_EDITING';

  return {
    category,
    tutorIntent,
    reasoningComplexity,
    requiresStructuredActions,
    requiresGraphConstruction,
    requiresGraphEditing,
    requiresGraphUnderstanding,
    requiresMultimodal: false,
    isLatencySensitive,
    isComplexProofOrVerification: isComplexFormalProof,
    rawLastQueryLength: userText.length,
    activeMachineType,
  };
}

// ============================================================================
// Model Scoring Engine
// Deterministic arithmetic scoring based on:
// 1. Capability Fit (up to 30 pts)
// 2. Task Category & Role Fit (up to 35 pts)
// 3. Latency Score (up to 20 pts)
// 4. Reliability Score (up to 10 pts)
// 5. Priority Tiebreaker (up to 10 pts)
// ============================================================================

export function scoreModel(model: RegisteredModel, profile: TaskProfile): number {
  if (!model.enabled) {
    return -9999;
  }

  let capabilityScore = 0;

  // Strict requirements check
  if (profile.requiresStructuredActions) {
    if (!model.capabilities.structuredActions) return -5000;
    capabilityScore += 10;
  }

  if (profile.requiresGraphConstruction) {
    if (!model.capabilities.graphConstruction) return -5000;
    capabilityScore += 10;
  }

  if (profile.requiresGraphEditing) {
    if (!model.capabilities.graphEditing) return -5000;
    capabilityScore += 10;
  }

  if (profile.requiresGraphUnderstanding && model.capabilities.graphUnderstanding) {
    capabilityScore += 5;
  }

  if (profile.reasoningComplexity === 'HIGH' && model.capabilities.reasoning) {
    capabilityScore += 10;
  }

  // Task Category & Role Alignment
  let taskFitScore = 0;
  switch (profile.category) {
    case 'COMPLEX_FORMAL_REASONING':
      if (model.role === 'heavy_reasoning_reference') taskFitScore = 45; // Ultra heavily rewarded for true complex reasoning
      else if (model.role === 'primary_fast_capable') taskFitScore = 20;
      else if (model.role === 'secondary_reasoning') taskFitScore = 15;
      else taskFitScore = 5;
      break;

    case 'AUTOMATON_CONSTRUCTION':
      if (model.role === 'primary_fast_capable') taskFitScore = 30; // Super is ideal
      else if (model.role === 'fast_general') taskFitScore = 25;
      else if (model.role === 'heavy_reasoning_reference') taskFitScore = 15;
      break;

    case 'GRAPH_EDITING':
      if (model.role === 'primary_fast_capable') taskFitScore = 30;
      else if (model.role === 'fast_general') taskFitScore = 25;
      else if (model.role === 'heavy_reasoning_reference') taskFitScore = 15;
      break;

    case 'EDUCATIONAL_REASONING':
      if (model.role === 'primary_fast_capable') taskFitScore = 30;
      else if (model.role === 'fast_reasoning') taskFitScore = 28;
      else if (model.role === 'fast_general') taskFitScore = 22;
      else if (model.role === 'heavy_reasoning_reference') taskFitScore = 10;
      break;

    case 'SIMPLE_EXPLANATION':
    case 'GENERAL_CHAT':
    default:
      if (model.role === 'primary_fast_capable') taskFitScore = 30;
      else if (model.role === 'fast_general') taskFitScore = 30;
      else if (model.role === 'fast_reasoning') taskFitScore = 20;
      else if (model.role === 'heavy_reasoning_reference') taskFitScore = -15; // Penalize ultra on simple quick queries
      break;
  }

  // Latency scoring
  let latencyScore = 0;
  switch (model.latencyClass) {
    case 'ULTRA_FAST':
      latencyScore = 20;
      break;
    case 'FAST':
      latencyScore = 15;
      break;
    case 'MODERATE':
      latencyScore = 10;
      break;
    case 'SLOW':
      latencyScore = profile.category === 'COMPLEX_FORMAL_REASONING' ? 8 : 2;
      break;
    case 'VERY_SLOW':
      latencyScore = profile.category === 'COMPLEX_FORMAL_REASONING' ? 10 : -10; // Waive latency penalty for complex proofs
      break;
  }

  const reliabilityScore = (model.reliabilityScore || 3) * 2;
  const priorityScore = (model.priority || 50) * 0.1;

  return capabilityScore + taskFitScore + latencyScore + reliabilityScore + priorityScore;
}

// ============================================================================
// Authoritative Model Selection
// ============================================================================

export function selectModel(request: ChatRequest, options?: { excludeModelId?: string }): RoutingDecision {
  const taskProfile = buildTaskProfile(request);
  const enabledModels = getEnabledModels().filter((m) => m.id !== options?.excludeModelId);

  if (enabledModels.length === 0) {
    // If all excluded or none enabled, fallback to primary default if exists
    const defaultModel = getRegisteredModel('nvidia/nemotron-3-super-120b-a12b') || getRegisteredModel('nvidia/nemotron-3-ultra-550b-a55b');
    return {
      selectedModel: defaultModel ? defaultModel.id : 'nvidia/nemotron-3-super-120b-a12b',
      taskProfile,
      routingReason: 'Emergency fallback: no enabled models available in registry filter.',
      calculatedScores: {},
      timestamp: new Date().toISOString(),
    };
  }

  const scores: Record<string, number> = {};
  for (const model of enabledModels) {
    scores[model.id] = scoreModel(model, taskProfile);
  }

  const sortedModels = [...enabledModels].sort((a, b) => (scores[b.id] ?? -9999) - (scores[a.id] ?? -9999));

  const best = sortedModels[0];
  const secondBest = sortedModels[1];

  let reason = `Selected ${best.id} for category ${taskProfile.category} (score: ${scores[best.id]})`;
  if (taskProfile.category === 'COMPLEX_FORMAL_REASONING') {
    reason = `Escalated to high-reasoning model ${best.id} for complex formal reduction/proof task.`;
  } else if (taskProfile.requiresStructuredActions) {
    reason = `Selected fast action-capable model ${best.id} for ${taskProfile.category}.`;
  } else if (taskProfile.category === 'SIMPLE_EXPLANATION') {
    reason = `Selected ultra-fast educational model ${best.id} for simple concept explanation.`;
  }

  // Safe server-side telemetry log (no secrets)
  if (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'test') {
    console.log(`[AI Router] intent=${taskProfile.category} model=${best.id} reason="${reason}"`);
  }

  return {
    selectedModel: best.id,
    fallbackModel: secondBest ? secondBest.id : undefined,
    taskProfile,
    routingReason: reason,
    calculatedScores: scores,
    timestamp: new Date().toISOString(),
  };
}
