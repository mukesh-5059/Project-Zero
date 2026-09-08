export type MessageRole = 'system' | 'user' | 'assistant';

export type TutorIntent = 'EXPLAIN' | 'WHY' | 'STEP_BY_STEP' | 'CONCEPT' | 'DEBUG';

export interface ChatMessage {
  role: MessageRole;
  content: string;
}

// ---------------------------------------------------------------------------
// Phase 13: Structured AI Action Protocol
// ---------------------------------------------------------------------------

export type AIActionType =
  | 'CREATE_STATE'
  | 'DELETE_STATE'
  | 'SET_INITIAL_STATE'
  | 'TOGGLE_ACCEPTING_STATE'
  | 'CREATE_TRANSITION'
  | 'EDIT_TRANSITION'
  | 'DELETE_TRANSITION';

export interface CreateStateParams {
  label: string;
  isInitial?: boolean;
  isAccepting?: boolean;
  x?: number;
  y?: number;
}

export interface DeleteStateParams {
  label: string;
}

export interface SetInitialStateParams {
  label: string;
}

export interface ToggleAcceptingStateParams {
  label: string;
}

export interface CreateTransitionParams {
  from: string;
  to: string;
  symbol: string;
  stackTop?: string;
  stackReplacement?: string;
  readSymbol?: string;
  writeSymbol?: string;
  moveDirection?: 'L' | 'R' | 'S';
}

export interface EditTransitionParams {
  from: string;
  to: string;
  oldSymbol: string;
  newSymbol: string;
  stackTop?: string;
  stackReplacement?: string;
  writeSymbol?: string;
  moveDirection?: 'L' | 'R' | 'S';
}

export interface DeleteTransitionParams {
  from: string;
  to: string;
  symbol: string;
}

export type AIActionPayload =
  | { type: 'CREATE_STATE'; parameters: CreateStateParams }
  | { type: 'DELETE_STATE'; parameters: DeleteStateParams }
  | { type: 'SET_INITIAL_STATE'; parameters: SetInitialStateParams }
  | { type: 'TOGGLE_ACCEPTING_STATE'; parameters: ToggleAcceptingStateParams }
  | { type: 'CREATE_TRANSITION'; parameters: CreateTransitionParams }
  | { type: 'EDIT_TRANSITION'; parameters: EditTransitionParams }
  | { type: 'DELETE_TRANSITION'; parameters: DeleteTransitionParams };

export interface AIActionItem {
  id: string;
  type: AIActionType;
  parameters: Record<string, unknown>;
  description?: string;
}

export interface AIActionEnvelope {
  version: '1.0.0';
  summary?: string;
  actions: AIActionItem[];
}

export interface EducationalEvidence {
  validityStatus?: 'VALID' | 'INVALID' | 'UNCHECKED';
  diagnostics?: string[];
  minimization?: {
    isAlreadyMinimal?: boolean;
    equivalenceClasses?: string[][];
    mergedStateCount?: number;
  };
  execution?: {
    inputString?: string;
    isAccepted?: boolean;
    traceLength?: number;
    proofSummary?: string;
  };
  grammar?: {
    derivationSteps?: string[];
    cnfRules?: string[];
    isLL1?: boolean;
    ll1Conflicts?: string[];
  };
}

export interface AIContextSnapshot {
  version: '1.0.0';
  workspace: {
    activeMachineType: string;
    activeSidebarTab?: string;
    activeBottomTab?: string;
    activeInspectorTab?: string;
    focusMode?: boolean;
  };
  selection: {
    selectedNodeLabels: string[];
    selectedEdgeDescriptions: string[];
  };
  machine: {
    type: string;
    stateCount: number;
    states: string[];
    initialState: string | null;
    acceptingStates: string[];
    alphabet: string[];
    transitionCount: number;
    transitions: Array<{
      from: string;
      symbol: string;
      to: string;
      stackPop?: string;
      stackPush?: string;
      tapeWrite?: string;
      tapeDirection?: string;
    }>;
    initialStackSymbol?: string;
    blankSymbol?: string;
    pdaAcceptanceMode?: string;
  };
  analysis?: {
    isStructurallyValid?: boolean;
    observations?: string[];
    diagnosticsCount?: number;
    diagnostics?: string[];
  };
  evidence?: EducationalEvidence;
  tutorIntent?: TutorIntent;
  contextTruncated?: boolean;
  truncationReason?: string;
}

// ---------------------------------------------------------------------------
// Phase 14A: Intelligent Model Router & Registry Types
// ---------------------------------------------------------------------------

export type LatencyClass = 'ULTRA_FAST' | 'FAST' | 'MODERATE' | 'SLOW' | 'VERY_SLOW';

export interface ModelCapabilities {
  generalChat: boolean;
  education: boolean;
  reasoning: boolean;
  coding: boolean;
  structuredActions: boolean;
  graphConstruction: boolean;
  graphEditing: boolean;
  graphUnderstanding: boolean;
  multimodal: boolean;
}

export interface RegisteredModel {
  id: string;
  displayName: string;
  enabled: boolean;
  role: 'primary_fast_capable' | 'fast_general' | 'fast_reasoning' | 'secondary_reasoning' | 'heavy_reasoning_reference';
  latencyClass: LatencyClass;
  observedLatencyMs: number;
  priority: number;
  reliabilityScore: number;
  capabilities: ModelCapabilities;
  description: string;
}

export type TaskCategory =
  | 'SIMPLE_EXPLANATION'
  | 'EDUCATIONAL_REASONING'
  | 'AUTOMATON_CONSTRUCTION'
  | 'GRAPH_EDITING'
  | 'COMPLEX_FORMAL_REASONING'
  | 'GENERAL_CHAT';

export interface TaskProfile {
  category: TaskCategory;
  tutorIntent?: TutorIntent;
  reasoningComplexity: 'LOW' | 'MEDIUM' | 'HIGH';
  requiresStructuredActions: boolean;
  requiresGraphConstruction: boolean;
  requiresGraphEditing: boolean;
  requiresGraphUnderstanding: boolean;
  requiresMultimodal: boolean;
  isLatencySensitive: boolean;
  isComplexProofOrVerification: boolean;
  rawLastQueryLength: number;
  activeMachineType?: string;
}

export interface RoutingDecision {
  selectedModel: string;
  fallbackModel?: string;
  taskProfile: TaskProfile;
  routingReason: string;
  calculatedScores: Record<string, number>;
  timestamp: string;
}

export interface RoutingTelemetry {
  selectedModel: string;
  taskCategory: TaskCategory;
  reason: string;
  fallbackUsed?: boolean;
}

export interface ChatRequest {
  messages: ChatMessage[];
  context?: AIContextSnapshot;
  maxTokens?: number;
  temperature?: number;
}

export interface ChatResponse {
  id: string;
  model: string;
  message: ChatMessage;
  actionProposal?: AIActionEnvelope;
  routingInfo?: RoutingTelemetry;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

export interface GatewayErrorResponse {
  error: {
    message: string;
    type: 'config_error' | 'validation_error' | 'upstream_error' | 'network_error';
    statusCode?: number;
  };
}
