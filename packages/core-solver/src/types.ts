import { StateNode, TransitionEdge } from '@project-zero/canvas-renderer';
import { AutomatonType } from '@project-zero/shared';

export type DFAErrorCode =
  | 'MISSING_INITIAL_STATE'
  | 'MULTIPLE_INITIAL_STATES'
  | 'MISSING_ACCEPTING_STATE'
  | 'EPSILON_TRANSITION'
  | 'DUPLICATE_SYMBOL_TRANSITION'
  | 'EMPTY_TRANSITION_SYMBOL';

export type NFAErrorCode =
  | 'MISSING_INITIAL_STATE'
  | 'MULTIPLE_INITIAL_STATES'
  | 'MISSING_ACCEPTING_STATE'
  | 'EMPTY_TRANSITION_SYMBOL'
  | 'DANGLING_TRANSITION_ENDPOINT';

export type PDAErrorCode =
  | 'MISSING_INITIAL_STATE'
  | 'MULTIPLE_INITIAL_STATES'
  | 'MISSING_INITIAL_STACK_SYMBOL'
  | 'EMPTY_TRANSITION_SYMBOL'
  | 'DANGLING_TRANSITION_ENDPOINT'
  | 'MALFORMED_PDA_TRANSITION';

export type TMErrorCode =
  | 'MISSING_INITIAL_STATE'
  | 'MULTIPLE_INITIAL_STATES'
  | 'EMPTY_TRANSITION_SYMBOL'
  | 'INVALID_MOVE_DIRECTION'
  | 'MISSING_WRITE_SYMBOL'
  | 'DANGLING_TRANSITION_ENDPOINT'
  | 'DUPLICATE_TM_TRANSITION'
  | 'INVALID_BLANK_SYMBOL';

export type TMMoveDirection = 'L' | 'R' | 'S';

export interface DFAValidationError {
  readonly code: DFAErrorCode | NFAErrorCode | PDAErrorCode | TMErrorCode;
  readonly message: string;
  readonly affectedStateIds?: ReadonlyArray<string>;
  readonly affectedTransitionIds?: ReadonlyArray<string>;
}

export interface DFAValidationResult {
  readonly isValid: boolean;
  readonly machineType: AutomatonType;
  readonly errors: ReadonlyArray<DFAValidationError>;
  readonly warnings: ReadonlyArray<string>;
}

export type DFARejectionReason =
  | 'NO_TRANSITION'
  | 'NON_ACCEPTING_FINAL_STATE'
  | 'NO_ACCEPTING_STATE'
  | 'INVALID_MACHINE';

export interface DFAExecutionStep {
  readonly stepIndex: number;
  readonly currentStateId: string;
  readonly currentStateLabel: string;
  readonly readSymbol: string | null;
  readonly remainingInput: string;
  readonly transitionId?: string;
  readonly nextStateId?: string;
  readonly nextStateLabel?: string;
  readonly isHalted: boolean;
  readonly isAccepting: boolean;
}

export interface DFAExecutionResult {
  readonly isAccepted: boolean;
  readonly finalStateId: string | null;
  readonly finalStateLabel: string | null;
  readonly rejectionReason?: DFARejectionReason;
  readonly steps: ReadonlyArray<DFAExecutionStep>;
  readonly inputString: string;
  readonly validationResult: DFAValidationResult;
}

export interface NFAExecutionStep {
  readonly stepIndex: number;
  readonly currentStates: ReadonlyArray<{ id: string; label: string }>;
  readonly epsilonClosure: ReadonlyArray<{ id: string; label: string }>;
  readonly readSymbol: string | null;
  readonly remainingInput: string;
  readonly nextStates: ReadonlyArray<{ id: string; label: string }>;
  readonly isHalted: boolean;
  readonly isAccepting: boolean;
}

export interface NFAExecutionResult {
  readonly isAccepted: boolean;
  readonly finalStates: ReadonlyArray<{ id: string; label: string }>;
  readonly acceptingStates: ReadonlyArray<{ id: string; label: string }>;
  readonly rejectionReason?: DFARejectionReason;
  readonly steps: ReadonlyArray<NFAExecutionStep>;
  readonly inputString: string;
  readonly validationResult: DFAValidationResult;
}

export interface PDAExecutionStep {
  readonly stepIndex: number;
  readonly currentStateId: string;
  readonly currentStateLabel: string;
  readonly activeStates: ReadonlyArray<{ id: string; label: string }>;
  readonly readSymbol: string | null;
  readonly remainingInput: string;
  readonly stackBefore: ReadonlyArray<string>;
  readonly stackAfter: ReadonlyArray<string>;
  readonly transitionId?: string;
  readonly nextStateId?: string;
  readonly nextStateLabel?: string;
  readonly isHalted: boolean;
  readonly isAccepting: boolean;
}

export type PDARejectionReason =
  | 'NO_TRANSITION'
  | 'NON_ACCEPTING_FINAL_STATE'
  | 'INVALID_MACHINE'
  | 'INCONCLUSIVE_LIMIT';

export interface PDABranchNode {
  readonly id: string;
  readonly parentId: string | null;
  readonly stateId: string;
  readonly stateLabel: string;
  readonly inputIndex: number;
  readonly stack: ReadonlyArray<string>;
  readonly transitionId?: string;
  readonly readSymbol: string | null;
  readonly depth: number;
  readonly status: 'ACTIVE' | 'EXPLORED' | 'ACCEPTING' | 'REJECTING' | 'PRUNED';
  readonly historySteps: ReadonlyArray<PDAExecutionStep>;
  readonly children: ReadonlyArray<PDABranchNode>;
}

export interface PDABranchTree {
  readonly root: PDABranchNode;
  readonly totalNodes: number;
  readonly maxDepth: number;
}

export interface PDAExecutionResult {
  readonly isAccepted: boolean;
  readonly isInconclusive?: boolean;
  readonly finalStates: ReadonlyArray<{ id: string; label: string }>;
  readonly acceptingStates: ReadonlyArray<{ id: string; label: string }>;
  readonly rejectionReason?: PDARejectionReason;
  readonly steps: ReadonlyArray<PDAExecutionStep>;
  readonly inputString: string;
  readonly validationResult: DFAValidationResult;
  readonly initialStackSymbol: string;
  readonly branchTree?: PDABranchTree;
}

export interface TMExecutionStep {
  readonly stepIndex: number;
  readonly currentStateId: string;
  readonly currentStateLabel: string;
  readonly tapeHeadIndex: number;
  readonly tapeContents: Record<number, string>;
  readonly tapeString: string;
  readonly readSymbol: string;
  readonly writeSymbol: string;
  readonly moveDirection: TMMoveDirection;
  readonly transitionId?: string;
  readonly nextStateId?: string;
  readonly nextStateLabel?: string;
  readonly isHalted: boolean;
  readonly isAccepting: boolean;
}

export interface TMInstantaneousConfiguration {
  readonly stepIndex: number;
  readonly stateId: string;
  readonly stateLabel: string;
  readonly headPosition: number;
  readonly readSymbol: string;
  readonly writeSymbol?: string;
  readonly moveDirection?: TMMoveDirection;
  readonly nextStateId?: string;
  readonly nextStateLabel?: string;
  readonly transitionId?: string;
  readonly tapeContents: Record<number, string>;
  readonly tapeString: string;
  readonly isHalted: boolean;
  readonly isAccepting: boolean;
}

export type TMRejectionReason =
  | 'NO_TRANSITION'
  | 'NON_ACCEPTING_FINAL_STATE'
  | 'INVALID_MACHINE'
  | 'INCONCLUSIVE_LIMIT';

export interface TMExecutionResult {
  readonly isAccepted: boolean;
  readonly isInconclusive?: boolean;
  readonly finalStateId: string | null;
  readonly finalStateLabel: string | null;
  readonly rejectionReason?: TMRejectionReason;
  readonly steps: ReadonlyArray<TMExecutionStep>;
  readonly inputString: string;
  readonly validationResult: DFAValidationResult;
  readonly blankSymbol: string;
  readonly finalTapeContents: Record<number, string>;
  readonly finalTapeHeadIndex: number;
}

export interface DFATransitionMatrixEntry {
  readonly stateId: string;
  readonly stateLabel: string;
  readonly isInitial: boolean;
  readonly isAccepting: boolean;
  readonly transitions: Record<string, string | null>; // symbol -> targetStateLabel or null
  readonly hasAmbiguity: Record<string, boolean>; // symbol -> true if NFA duplicate
}

export interface DFATransitionMatrix {
  readonly symbols: ReadonlyArray<string>;
  readonly entries: ReadonlyArray<DFATransitionMatrixEntry>;
  readonly hasAmbiguity: boolean;
}

export interface DFAMissingTransition {
  readonly stateId: string;
  readonly stateLabel: string;
  readonly symbol: string;
}

export interface DFACompletenessResult {
  readonly isComplete: boolean;
  readonly alphabet: ReadonlyArray<string>;
  readonly missingTransitions: ReadonlyArray<DFAMissingTransition>;
  readonly totalRequiredTransitions: number;
  readonly totalPresentTransitions: number;
}

export interface SolverGraphInput {
  readonly nodes: ReadonlyArray<StateNode>;
  readonly edges: ReadonlyArray<TransitionEdge>;
}

export interface NFAConversionSubsetMap {
  readonly dfaStateId: string;
  readonly dfaStateLabel: string;
  readonly nfaStateIds: ReadonlyArray<string>;
  readonly nfaStateLabels: ReadonlyArray<string>;
  readonly isInitial: boolean;
  readonly isAccepting: boolean;
}

export interface NFAConversionStep {
  readonly stepIndex: number;
  readonly currentDfaStateId: string;
  readonly currentDfaStateLabel: string;
  readonly currentNfaStateIds: ReadonlyArray<string>;
  readonly currentNfaStateLabels: ReadonlyArray<string>;
  readonly symbol: string;
  readonly movedNfaStateIds: ReadonlyArray<string>;
  readonly movedNfaStateLabels: ReadonlyArray<string>;
  readonly targetEpsilonClosureIds: ReadonlyArray<string>;
  readonly targetEpsilonClosureLabels: ReadonlyArray<string>;
  readonly targetDfaStateId: string;
  readonly targetDfaStateLabel: string;
  readonly isNewState: boolean;
  readonly isAccepting: boolean;
  readonly isTrap: boolean;
}

export interface NFAConversionTrace {
  readonly initialSubsetIds: ReadonlyArray<string>;
  readonly initialSubsetLabels: ReadonlyArray<string>;
  readonly steps: ReadonlyArray<NFAConversionStep>;
  readonly conversionResult: NFAConversionResult;
}

export interface NFAConversionResult {
  readonly success: boolean;
  readonly nodes: ReadonlyArray<StateNode>;
  readonly edges: ReadonlyArray<TransitionEdge>;
  readonly subsets: ReadonlyArray<NFAConversionSubsetMap>;
  readonly alphabet: ReadonlyArray<string>;
  readonly validationResult: DFAValidationResult;
  readonly errorMessage?: string;
  readonly trace?: NFAConversionTrace;
}

export type RegexASTNode =
  | { type: 'LITERAL'; symbol: string }
  | { type: 'EPSILON' }
  | { type: 'CONCAT'; left: RegexASTNode; right: RegexASTNode }
  | { type: 'UNION'; left: RegexASTNode; right: RegexASTNode }
  | { type: 'STAR'; expression: RegexASTNode }
  | { type: 'PLUS'; expression: RegexASTNode }
  | { type: 'OPTIONAL'; expression: RegexASTNode };

export interface RegexParseResult {
  readonly success: boolean;
  readonly ast?: RegexASTNode;
  readonly errorPosition?: number;
  readonly errorMessage?: string;
}

export interface ThompsonStep {
  readonly stepIndex: number;
  readonly opType: 'LITERAL' | 'EPSILON' | 'CONCAT' | 'UNION' | 'STAR' | 'PLUS' | 'OPTIONAL';
  readonly label: string;
  readonly description: string;
  readonly createdStateIds: ReadonlyArray<string>;
  readonly createdTransitions: ReadonlyArray<{ id: string; sourceId: string; targetId: string; label: string }>;
  readonly fragment: { startId: string; acceptId: string };
}

export interface RegexToNFAResult {
  readonly success: boolean;
  readonly inputRegex?: string;
  readonly nodes: ReadonlyArray<StateNode>;
  readonly edges: ReadonlyArray<TransitionEdge>;
  readonly alphabet: ReadonlyArray<string>;
  readonly ast?: RegexASTNode;
  readonly trace?: ReadonlyArray<ThompsonStep>;
  readonly validationResult?: DFAValidationResult;
  readonly errorMessage?: string;
  readonly errorPosition?: number;
}

export interface MachineAnalysisResult {
  readonly machineType: AutomatonType;
  readonly stateCount: number;
  readonly transitionCount: number;
  readonly alphabet: ReadonlyArray<string>;
  readonly initialStateId?: string;
  readonly initialStateLabel?: string;
  readonly acceptingStateIds: ReadonlyArray<string>;
  readonly acceptingStateLabels: ReadonlyArray<string>;
  readonly reachableStateIds: ReadonlyArray<string>;
  readonly unreachableStateIds: ReadonlyArray<string>;
  readonly coaccessibleStateIds: ReadonlyArray<string>;
  readonly trapStateIds: ReadonlyArray<string>;
  readonly missingDFATransitionCount: number;
  readonly hasNondeterministicBranching: boolean;
  readonly hasEpsilonTransitions: boolean;
  readonly hasEpsilonCycles: boolean;
  readonly isStructurallyValid: boolean;
  readonly isCompleteDFA: boolean;
  readonly isLanguageEmpty: boolean;
  readonly observations: ReadonlyArray<string>;
}

export interface StepDerivation {
  readonly stepIndex: number;
  readonly fromState: string;
  readonly symbol: string;
  readonly toState: string;
  readonly formalNotation: string;
}

export interface ExecutionExplanationResult {
  readonly inputString: string;
  readonly machineType: 'DFA' | 'NFA';
  readonly isAccepted: boolean;
  readonly rejectionReason?: string;
  readonly stepSummaries: ReadonlyArray<string>;
  readonly derivations: ReadonlyArray<StepDerivation>;
  readonly formalProofText: string;
  readonly intuitionSummary: string;
}

export interface DFAMinimizationEquivalenceClass {
  readonly minimizedStateId: string;
  readonly minimizedStateLabel: string;
  readonly originalStateIds: ReadonlyArray<string>;
  readonly originalStateLabels: ReadonlyArray<string>;
  readonly isInitial: boolean;
  readonly isAccepting: boolean;
}

export interface DFAMinimizationStep {
  readonly stepIndex: number;
  readonly iteration: number;
  readonly currentPartitions: ReadonlyArray<ReadonlyArray<string>>;
  readonly currentPartitionLabels: ReadonlyArray<ReadonlyArray<string>>;
  readonly splitOccurred: boolean;
  readonly description: string;
  readonly signatures?: Record<string, string>;
}

export interface DFAMinimizationTrace {
  readonly reachableStateIds: ReadonlyArray<string>;
  readonly unreachableStateIds: ReadonlyArray<string>;
  readonly initialPartitions: ReadonlyArray<ReadonlyArray<string>>;
  readonly steps: ReadonlyArray<DFAMinimizationStep>;
  readonly finalPartitions: ReadonlyArray<ReadonlyArray<string>>;
  readonly minimizationResult: DFAMinimizationResult;
}

export interface DFAMinimizationResult {
  readonly success: boolean;
  readonly nodes: ReadonlyArray<StateNode>;
  readonly edges: ReadonlyArray<TransitionEdge>;
  readonly equivalenceClasses: ReadonlyArray<DFAMinimizationEquivalenceClass>;
  readonly originalStateCount: number;
  readonly reachableStateCount: number;
  readonly unreachableStateCount: number;
  readonly minimizedStateCount: number;
  readonly mergedStateCount: number;
  readonly isAlreadyMinimal: boolean;
  readonly validationResult: DFAValidationResult;
  readonly errorMessage?: string;
  readonly trace?: DFAMinimizationTrace;
}

export interface ProductAutomatonStep {
  readonly stepIndex: number;
  readonly stateA: string;
  readonly labelA: string;
  readonly stateB: string;
  readonly labelB: string;
  readonly symbol: string;
  readonly nextStateA: string;
  readonly nextLabelA: string;
  readonly nextStateB: string;
  readonly nextLabelB: string;
  readonly isMismatch: boolean;
  readonly productPairLabel: string;
  readonly nextProductPairLabel: string;
}

export interface ProductDistinguishingConfig {
  readonly pairLabel: string;
  readonly stateA: string;
  readonly labelA: string;
  readonly isAcceptingA: boolean;
  readonly stateB: string;
  readonly labelB: string;
  readonly isAcceptingB: boolean;
  readonly differentiatingSymbol: string | null;
}

export interface DFAEquivalenceTrace {
  readonly initialPair: string;
  readonly productStatesExplored: number;
  readonly derivationSteps: ReadonlyArray<ProductAutomatonStep>;
  readonly distinguishingConfig?: ProductDistinguishingConfig;
}

export interface DFAEquivalenceResult {
  readonly isEquivalent: boolean;
  readonly counterexample?: string;
  readonly acceptsA?: boolean;
  readonly acceptsB?: boolean;
  readonly productStatesExplored: number;
  readonly trace?: DFAEquivalenceTrace;
  readonly errorMessage?: string;
}

export interface AutomataEquivalenceResult {
  readonly isEquivalent: boolean;
  readonly counterexample?: string;
  readonly acceptsA?: boolean;
  readonly acceptsB?: boolean;
  readonly machineTypeA: AutomatonType;
  readonly machineTypeB: AutomatonType;
  readonly wasNFAConvertedA: boolean;
  readonly wasNFAConvertedB: boolean;
  readonly productStatesExplored: number;
  readonly trace?: DFAEquivalenceTrace;
  readonly errorMessage?: string;
}

export type AutomataDiagnosticSeverity = 'error' | 'warning' | 'info';

export type AutomataDiagnosticCode =
  | 'DFA_NO_INITIAL_STATE'
  | 'DFA_MULTIPLE_INITIAL_STATES'
  | 'DFA_EMPTY_TRANSITION_SYMBOL'
  | 'DFA_EPSILON_TRANSITION'
  | 'DFA_NONDETERMINISTIC_TRANSITION'
  | 'DFA_MISSING_TRANSITION'
  | 'DFA_UNREACHABLE_STATE'
  | 'DFA_DEAD_STATE'
  | 'DFA_NO_STATES'
  | 'DFA_DANGLING_TRANSITION_ENDPOINT'
  | 'NFA_NO_INITIAL_STATE'
  | 'NFA_MULTIPLE_INITIAL_STATES'
  | 'NFA_EMPTY_TRANSITION_SYMBOL'
  | 'NFA_UNREACHABLE_STATE'
  | 'NFA_DEAD_STATE'
  | 'NFA_NO_STATES'
  | 'NFA_DANGLING_TRANSITION_ENDPOINT'
  | 'PDA_NO_INITIAL_STATE'
  | 'PDA_MULTIPLE_INITIAL_STATES'
  | 'PDA_EMPTY_TRANSITION_SYMBOL'
  | 'PDA_INVALID_STACK_OPERATION'
  | 'PDA_MALFORMED_TRANSITION'
  | 'PDA_MISSING_INITIAL_STACK_SYMBOL'
  | 'PDA_UNREACHABLE_STATE'
  | 'PDA_DEAD_STATE'
  | 'PDA_NO_STATES'
  | 'PDA_DANGLING_TRANSITION_ENDPOINT'
  | 'TM_NO_INITIAL_STATE'
  | 'TM_MULTIPLE_INITIAL_STATES'
  | 'TM_EMPTY_TRANSITION_SYMBOL'
  | 'TM_INVALID_MOVE_DIRECTION'
  | 'TM_MISSING_WRITE_SYMBOL'
  | 'TM_DUPLICATE_TRANSITION'
  | 'TM_INVALID_BLANK_SYMBOL'
  | 'TM_MALFORMED_TRANSITION'
  | 'TM_UNREACHABLE_STATE'
  | 'TM_DEAD_STATE'
  | 'TM_NO_STATES'
  | 'TM_DANGLING_TRANSITION_ENDPOINT';

export type LanguageSafetyCategory =
  | 'SAFE'
  | 'POTENTIALLY_LANGUAGE_CHANGING'
  | 'LANGUAGE_CHANGING'
  | 'UNKNOWN';

export type RepairActionType =
  | 'SET_INITIAL_STATE'
  | 'REMOVE_NODE'
  | 'REMOVE_EDGE'
  | 'ADD_TRANSITION'
  | 'UPDATE_EDGE'
  | 'CREATE_TRAP_STATE_AND_TRANSITION';

export interface AutomataRepairSuggestion {
  readonly id: string;
  readonly diagnosticId: string;
  readonly title: string;
  readonly description: string;
  readonly category: LanguageSafetyCategory;
  readonly actionType: RepairActionType;
  readonly targetEntityId?: string;
  readonly payload?: Record<string, unknown>;
}

export interface AutomataDiagnostic {
  readonly id: string;
  readonly severity: AutomataDiagnosticSeverity;
  readonly machineType: AutomatonType;
  readonly code: AutomataDiagnosticCode;
  readonly title: string;
  readonly message: string;
  readonly mathematicalExplanation: string;
  readonly affectedStateIds: ReadonlyArray<string>;
  readonly affectedTransitionIds: ReadonlyArray<string>;
  readonly repairs: ReadonlyArray<AutomataRepairSuggestion>;
  readonly isAutoRepairable: boolean;
  readonly changesLanguageSemantics: boolean;
}

export interface AutomataDiagnosticReport {
  readonly machineType: AutomatonType;
  readonly isValid: boolean;
  readonly diagnostics: ReadonlyArray<AutomataDiagnostic>;
  readonly errorCount: number;
  readonly warningCount: number;
  readonly infoCount: number;
}

export interface RepairDiffResult {
  readonly addedNodes: ReadonlyArray<StateNode>;
  readonly removedNodes: ReadonlyArray<StateNode>;
  readonly addedEdges: ReadonlyArray<TransitionEdge>;
  readonly removedEdges: ReadonlyArray<TransitionEdge>;
  readonly modifiedEdges: ReadonlyArray<TransitionEdge>;
}

export interface RepairPreviewResult {
  readonly repairId: string;
  readonly diagnosticId: string;
  readonly beforeNodes: ReadonlyArray<StateNode>;
  readonly beforeEdges: ReadonlyArray<TransitionEdge>;
  readonly afterNodes: ReadonlyArray<StateNode>;
  readonly afterEdges: ReadonlyArray<TransitionEdge>;
  readonly diff: RepairDiffResult;
  readonly isAfterValid: boolean;
  readonly languageSafetyCategory: LanguageSafetyCategory;
  readonly mathematicalSafetyExplanation: string;
}

export type LanguageOperationType =
  | 'UNION'
  | 'INTERSECTION'
  | 'DIFFERENCE'
  | 'SYMMETRIC_DIFFERENCE'
  | 'COMPLEMENT';

export interface ProductAutomatonStepResult {
  readonly stepIndex: number;
  readonly productPairLabel: string;
  readonly symbol: string;
  readonly nextProductPairLabel: string;
  readonly isAccepting: boolean;
}

export interface ProductAutomatonResult {
  readonly success: boolean;
  readonly operation: LanguageOperationType;
  readonly nodes: ReadonlyArray<StateNode>;
  readonly edges: ReadonlyArray<TransitionEdge>;
  readonly alphabet: ReadonlyArray<string>;
  readonly reachableStateCount: number;
  readonly acceptingStateCount: number;
  readonly steps?: ReadonlyArray<ProductAutomatonStepResult>;
  readonly errorMessage?: string;
}

export type TransformationStepType =
  | 'REGEX_TO_NFA'
  | 'NFA_TO_DFA'
  | 'DFA_MINIMIZE'
  | 'COMPLEMENT';

export interface TransformationPipelineStepResult {
  readonly stepIndex: number;
  readonly stepName: string;
  readonly inputMachineType: AutomatonType;
  readonly outputMachineType: AutomatonType;
  readonly nodeCount: number;
  readonly edgeCount: number;
}

export interface TransformationPipelineResult {
  readonly success: boolean;
  readonly nodes: ReadonlyArray<StateNode>;
  readonly edges: ReadonlyArray<TransitionEdge>;
  readonly finalMachineType: AutomatonType;
  readonly stepResults: ReadonlyArray<TransformationPipelineStepResult>;
  readonly errorMessage?: string;
}

export type FormalProofStepType =
  | 'INITIAL_CONFIGURATION'
  | 'STATE_DISCOVERY'
  | 'TRANSITION_EVALUATION'
  | 'ACCEPTANCE_EVALUATION'
  | 'PRODUCT_STATE_DISCOVERY'
  | 'DISTINGUISHING_CONFIGURATION'
  | 'TERMINATION'
  | 'RESULT';

export interface FormalProofStepEntityState {
  readonly id: string;
  readonly label: string;
  readonly isAccepting: boolean;
}

export interface FormalProofStep {
  readonly stepIndex: number;
  readonly type: FormalProofStepType;
  readonly title: string;
  readonly description: string;
  readonly mathematicalNotation: string;
  readonly stateA?: FormalProofStepEntityState;
  readonly stateB?: FormalProofStepEntityState;
  readonly symbol?: string;
  readonly isMismatch?: boolean;
  readonly metadata?: Record<string, unknown>;
}

export interface FormalProofDerivation {
  readonly title: string;
  readonly category: 'EQUIVALENCE' | 'COUNTEREXAMPLE' | 'TRANSFORMATION' | 'ANALYSIS';
  readonly isEquivalent?: boolean;
  readonly counterexample?: string;
  readonly acceptsA?: boolean;
  readonly acceptsB?: boolean;
  readonly steps: ReadonlyArray<FormalProofStep>;
  readonly conclusion: string;
  readonly mathematicalJustification: string;
}

export interface CounterexampleStep {
  readonly stepIndex: number;
  readonly consumedPrefix: string;
  readonly symbol: string | null;
  readonly stateA: FormalProofStepEntityState;
  readonly stateB: FormalProofStepEntityState;
  readonly isAcceptingA: boolean;
  readonly isAcceptingB: boolean;
  readonly isDistinguishing: boolean;
  readonly productPairLabel: string;
}

export type ChallengeCategory = 'DFA' | 'NFA' | 'PDA' | 'TM' | 'EQUIVALENCE' | 'REGEX';
export type ChallengeDifficulty = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';

export interface ChallengeDefinition {
  readonly id: string;
  readonly title: string;
  readonly category: ChallengeCategory;
  readonly difficulty: ChallengeDifficulty;
  readonly prompt: string;
  readonly targetMachineType: AutomatonType;
  readonly expectedLanguageDescription: string;
  readonly referenceGraph?: SolverGraphInput;
  readonly referenceMachineType?: AutomatonType;
  readonly positiveExamples?: ReadonlyArray<string>;
  readonly negativeExamples?: ReadonlyArray<string>;
  readonly hints: ReadonlyArray<string>;
  readonly maxStatesConstraint?: number;
  readonly maxTransitionsConstraint?: number;
  readonly requireDeterministic?: boolean;
}

export type GradingStatus = 'PASS' | 'FAIL' | 'INVALID_MACHINE' | 'INCOMPLETE';

export interface GradingCheckResult {
  readonly name: string;
  readonly passed: boolean;
  readonly detail: string;
}

export interface ExampleEvaluation {
  readonly input: string;
  readonly expected: boolean;
  readonly actual: boolean;
  readonly passed: boolean;
}

export interface GradingResult {
  readonly challengeId: string;
  readonly status: GradingStatus;
  readonly score: number;
  readonly passedChecks: ReadonlyArray<GradingCheckResult>;
  readonly failedChecks: ReadonlyArray<GradingCheckResult>;
  readonly positiveExamplesEvaluations: ReadonlyArray<ExampleEvaluation>;
  readonly negativeExamplesEvaluations: ReadonlyArray<ExampleEvaluation>;
  readonly isExactLanguageMatch?: boolean;
  readonly shortestCounterexample?: string;
  readonly expectedCounterexampleResult?: boolean;
  readonly actualCounterexampleResult?: boolean;
  readonly explanation: string;
  readonly mathematicalReason: string;
}

export type GrammarSymbolType = 'TERMINAL' | 'NON_TERMINAL' | 'EPSILON';

export interface GrammarSymbol {
  readonly type: GrammarSymbolType;
  readonly value: string;
}

export interface CFGProduction {
  readonly id: string;
  readonly lhs: string;
  readonly rhs: ReadonlyArray<GrammarSymbol>;
}

export interface ContextFreeGrammar {
  readonly variables: ReadonlyArray<string>;
  readonly terminals: ReadonlyArray<string>;
  readonly productions: ReadonlyArray<CFGProduction>;
  readonly startVariable: string;
}

export type CFGDiagnosticSeverity = 'error' | 'warning' | 'info';

export type CFGDiagnosticCode =
  | 'CFG_NO_VARIABLES'
  | 'CFG_NO_TERMINALS_WHEN_REQUIRED'
  | 'CFG_NO_START_VARIABLE'
  | 'CFG_INVALID_START_VARIABLE'
  | 'CFG_DUPLICATE_VARIABLE'
  | 'CFG_DUPLICATE_TERMINAL'
  | 'CFG_NAMESPACE_COLLISION'
  | 'CFG_UNDEFINED_VARIABLE'
  | 'CFG_INVALID_EPSILON_USAGE'
  | 'CFG_EMPTY_PRODUCTION'
  | 'CFG_INVALID_PRODUCTION'
  | 'CFG_UNREACHABLE_VARIABLE'
  | 'CFG_NON_GENERATING_VARIABLE';

export interface CFGDiagnostic {
  readonly code: CFGDiagnosticCode;
  readonly severity: CFGDiagnosticSeverity;
  readonly message: string;
  readonly mathematicalExplanation: string;
  readonly affectedVariable?: string;
  readonly affectedProductionId?: string;
}

export interface CFGValidationResult {
  readonly isValid: boolean;
  readonly diagnostics: ReadonlyArray<CFGDiagnostic>;
  readonly errors: ReadonlyArray<CFGDiagnostic>;
  readonly warnings: ReadonlyArray<CFGDiagnostic>;
}

export interface CFGAnalysisResult {
  readonly variables: ReadonlyArray<string>;
  readonly terminals: ReadonlyArray<string>;
  readonly reachableVariables: ReadonlyArray<string>;
  readonly generatingVariables: ReadonlyArray<string>;
  readonly nullableVariables: ReadonlyArray<string>;
  readonly uselessVariables: ReadonlyArray<string>;
  readonly isLanguageEmpty: boolean;
  readonly hasLeftRecursion: boolean;
  readonly productionCount: number;
}

export type DerivationType = 'LEFTMOST' | 'RIGHTMOST' | 'GENERAL';

export interface DerivationStep {
  readonly stepIndex: number;
  readonly sententialForm: ReadonlyArray<GrammarSymbol>;
  readonly productionId?: string;
  readonly productionNotation?: string;
  readonly expandedVariable?: string;
  readonly expandedPosition?: number;
  readonly derivationType: DerivationType;
  readonly mathematicalNotation: string;
}

export interface CFGDerivationResult {
  readonly success: boolean;
  readonly derivationType: DerivationType;
  readonly targetInput: string;
  readonly steps: ReadonlyArray<DerivationStep>;
  readonly exploredStateCount: number;
  readonly errorMessage?: string;
}

export interface CFGMembershipResult {
  readonly isAccepted: boolean;
  readonly targetInput: string;
  readonly derivation?: CFGDerivationResult;
  readonly exploredStates: number;
  readonly reason: string;
  readonly boundedByLimit: boolean;
}

export interface CFGParseTreeNode {
  readonly id: string;
  readonly symbol: GrammarSymbol;
  readonly productionId?: string;
  readonly children: ReadonlyArray<CFGParseTreeNode>;
  readonly depth: number;
}

// ===================================================================
// CNF Transformation Types
// ===================================================================

export type CNFTransformationStage =
  | 'CNF_START'
  | 'START_SYMBOL_NORMALIZATION'
  | 'EPSILON_ELIMINATION'
  | 'UNIT_ELIMINATION'
  | 'USELESS_SYMBOL_ELIMINATION'
  | 'TERMINAL_ISOLATION'
  | 'BINARIZATION'
  | 'CNF_VALIDATION';

export interface CNFTransformationStageTrace {
  readonly stage: CNFTransformationStage;
  readonly description: string;
  readonly mathematicalExplanation: string;
  readonly grammarBefore: ContextFreeGrammar;
  readonly grammarAfter: ContextFreeGrammar;
  readonly addedProductions: ReadonlyArray<CFGProduction>;
  readonly removedProductions: ReadonlyArray<CFGProduction>;
  readonly addedVariables: ReadonlyArray<string>;
  readonly removedVariables: ReadonlyArray<string>;
}

export interface CNFTransformationResult {
  readonly success: boolean;
  readonly originalGrammar: ContextFreeGrammar;
  readonly transformedGrammar: ContextFreeGrammar;
  readonly epsilonInOriginalLanguage: boolean;
  readonly stages: ReadonlyArray<CNFTransformationStageTrace>;
  readonly introducedVariables: ReadonlyArray<string>;
  readonly eliminatedProductions: ReadonlyArray<CFGProduction>;
  readonly totalProductionsOriginal: number;
  readonly totalProductionsTransformed: number;
  readonly warnings: ReadonlyArray<string>;
  readonly validationResult: CFGValidationResult;
  readonly errorMessage?: string;
}

export type CNFDiagnosticCode =
  | 'CNF_RHS_TOO_LONG'
  | 'CNF_TERMINAL_IN_BINARY'
  | 'CNF_NON_TERMINAL_IN_UNIT_TERMINAL'
  | 'CNF_INVALID_EPSILON'
  | 'CNF_UNIT_PRODUCTION'
  | 'CNF_EMPTY_RHS';

export interface CNFDiagnostic {
  readonly code: CNFDiagnosticCode;
  readonly severity: CFGDiagnosticSeverity;
  readonly message: string;
  readonly mathematicalExplanation: string;
  readonly affectedProductionId?: string;
}

export interface CNFValidationResult {
  readonly isValid: boolean;
  readonly diagnostics: ReadonlyArray<CNFDiagnostic>;
  readonly errors: ReadonlyArray<CNFDiagnostic>;
  readonly warnings: ReadonlyArray<CNFDiagnostic>;
  readonly hasStartEpsilon: boolean;
  readonly startSymbol: string;
}

// ===================================================================
// CYK Parser Types
// ===================================================================

export interface CYKCellWitness {
  readonly variable: string;
  readonly productionId: string;
  readonly productionLhs: string;
  readonly productionRhs: ReadonlyArray<GrammarSymbol>;
  readonly splitPosition: number;
  readonly leftVariable?: string;
  readonly rightVariable?: string;
}

export interface CYKCell {
  readonly spanStart: number;
  readonly spanEnd: number;
  readonly substring: string;
  readonly variables: ReadonlyArray<string>;
  readonly witnesses: ReadonlyArray<CYKCellWitness>;
}

export interface CYKTable {
  readonly cells: ReadonlyArray<ReadonlyArray<CYKCell>>;
  readonly tokenCount: number;
  readonly tokens: ReadonlyArray<string>;
}

export interface CYKParseResult {
  readonly isAccepted: boolean;
  readonly inputString: string;
  readonly tokens: ReadonlyArray<string>;
  readonly table: CYKTable;
  readonly exploredCellCount: number;
  readonly parseTree?: CFGParseTreeNode;
  readonly rejectionExplanation?: string;
  readonly boundedByLimit: boolean;
  readonly isEpsilonAcceptance: boolean;
}

// ===================================================================
// CYK Proof Trace Types
// ===================================================================

export type CYKProofStepType =
  | 'CYK_INITIALIZATION'
  | 'CYK_CELL_EVALUATION'
  | 'CYK_SPLIT_EVALUATION'
  | 'CYK_ACCEPTANCE'
  | 'CYK_REJECTION'
  | 'CYK_PARSE_RECONSTRUCTION';

export interface CYKProofStep {
  readonly stepIndex: number;
  readonly type: CYKProofStepType;
  readonly title: string;
  readonly description: string;
  readonly mathematicalNotation: string;
  readonly spanStart?: number;
  readonly spanEnd?: number;
  readonly splitPosition?: number;
  readonly variable?: string;
  readonly productionId?: string;
}

// ===================================================================
// LL(1) Analysis & Parser Types
// ===================================================================

export const LL1_END_MARKER = '$';

export type LL1ConflictType = 'FIRST_FIRST' | 'FIRST_FOLLOW';

export interface LL1Conflict {
  readonly type: LL1ConflictType;
  readonly variable: string;
  readonly terminal: string;
  readonly productionIds: ReadonlyArray<string>;
  readonly productionNotations: ReadonlyArray<string>;
  readonly selectSetA: ReadonlyArray<string>;
  readonly selectSetB: ReadonlyArray<string>;
  readonly mathematicalExplanation: string;
}

export interface ProductionSelectSet {
  readonly productionId: string;
  readonly lhs: string;
  readonly rhsNotation: string;
  readonly selectSet: ReadonlyArray<string>;
  readonly isNullableRhs: boolean;
}

export interface LL1ParseTableCell {
  readonly variable: string;
  readonly terminal: string;
  readonly productionIds: ReadonlyArray<string>;
  readonly productions: ReadonlyArray<CFGProduction>;
  readonly hasConflict: boolean;
}

export interface LL1ParseTable {
  readonly variables: ReadonlyArray<string>;
  readonly terminals: ReadonlyArray<string>; // includes '$'
  readonly grid: Record<string, Record<string, LL1ParseTableCell>>;
  readonly totalConflicts: number;
}

export interface LeftRecursionDiagnostic {
  readonly isLeftRecursive: boolean;
  readonly directVariables: ReadonlyArray<string>;
  readonly indirectCycles: ReadonlyArray<ReadonlyArray<string>>;
  readonly explanation: string;
}

export interface LeftFactoringSuggestion {
  readonly variable: string;
  readonly commonPrefix: ReadonlyArray<GrammarSymbol>;
  readonly commonPrefixNotation: string;
  readonly productionIds: ReadonlyArray<string>;
  readonly explanation: string;
}

export interface LL1AnalysisResult {
  readonly isLL1: boolean;
  readonly firstSets: Record<string, ReadonlyArray<string>>;
  readonly followSets: Record<string, ReadonlyArray<string>>;
  readonly selectSets: ReadonlyArray<ProductionSelectSet>;
  readonly parseTable: LL1ParseTable;
  readonly conflicts: ReadonlyArray<LL1Conflict>;
  readonly nullableVariables: ReadonlyArray<string>;
  readonly leftRecursion: LeftRecursionDiagnostic;
  readonly leftFactoringSuggestions: ReadonlyArray<LeftFactoringSuggestion>;
  readonly diagnostics: ReadonlyArray<string>;
}

export interface LL1ParseStep {
  readonly stepIndex: number;
  readonly stack: ReadonlyArray<string>;
  readonly remainingInput: ReadonlyArray<string>;
  readonly lookahead: string;
  readonly action: string;
  readonly productionId?: string;
  readonly productionNotation?: string;
  readonly matchedTerminal?: string;
  readonly mathematicalExplanation: string;
}

export interface LL1ParseResult {
  readonly isAccepted: boolean;
  readonly inputString: string;
  readonly tokens: ReadonlyArray<string>;
  readonly steps: ReadonlyArray<LL1ParseStep>;
  readonly parseTree?: CFGParseTreeNode;
  readonly appliedProductionIds: ReadonlyArray<string>;
  readonly rejectionReason?: string;
  readonly boundedByLimit: boolean;
  readonly analysisResult: LL1AnalysisResult;
}

export type LL1ProofStepType =
  | 'FIRST_SET_INITIALIZATION'
  | 'FIRST_SET_PROPAGATION'
  | 'FIRST_SET_FIXED_POINT'
  | 'FOLLOW_SET_INITIALIZATION'
  | 'FOLLOW_SET_PROPAGATION'
  | 'FOLLOW_SET_FIXED_POINT'
  | 'SELECT_SET_COMPUTATION'
  | 'PARSE_TABLE_ENTRY'
  | 'LL1_CONFLICT'
  | 'LL1_VERDICT'
  | 'PREDICTIVE_PARSE_STEP'
  | 'PREDICTIVE_PARSE_ACCEPT'
  | 'PREDICTIVE_PARSE_REJECT';

export interface LL1ProofStep {
  readonly stepIndex: number;
  readonly type: LL1ProofStepType;
  readonly title: string;
  readonly description: string;
  readonly mathematicalNotation: string;
}

// ===================================================================
// Grammar Transformation Engine Types
// ===================================================================

export type GrammarTransformationType =
  | 'DIRECT_LEFT_RECURSION_ELIMINATION'
  | 'INDIRECT_LEFT_RECURSION_ELIMINATION'
  | 'LEFT_FACTORING'
  | 'PREDICTIVE_TRANSFORMATION_PIPELINE';

export type LanguagePreservationStatus =
  | 'VERIFIED_BOUNDED'
  | 'NOT_VERIFIED'
  | 'MISMATCH_DETECTED';

export type GrammarTransformationStepType =
  | 'TRANSFORMATION_START'
  | 'VARIABLE_ORDERING'
  | 'INDIRECT_SUBSTITUTION'
  | 'DIRECT_LEFT_RECURSION_DETECTED'
  | 'DIRECT_LEFT_RECURSION_ELIMINATION'
  | 'NEW_VARIABLE_GENERATED'
  | 'LEFT_FACTORIZATION_DETECTED'
  | 'LEFT_FACTORIZATION_APPLIED'
  | 'FIRST_FOLLOW_RECOMPUTATION'
  | 'LL1_REANALYSIS'
  | 'LANGUAGE_PRESERVATION_CHECK'
  | 'TRANSFORMATION_COMPLETE';

export interface GrammarTransformationStep {
  readonly stepIndex: number;
  readonly type: GrammarTransformationStepType;
  readonly title: string;
  readonly description: string;
  readonly mathematicalNotation: string;
  readonly affectedVariable?: string;
  readonly beforeProductions: ReadonlyArray<CFGProduction>;
  readonly afterProductions: ReadonlyArray<CFGProduction>;
  readonly generatedVariables: ReadonlyArray<string>;
}

export interface GrammarTransformationResult {
  readonly success: boolean;
  readonly originalGrammar: ContextFreeGrammar;
  readonly transformedGrammar: ContextFreeGrammar;
  readonly transformationType: GrammarTransformationType;
  readonly changed: boolean;
  readonly steps: ReadonlyArray<GrammarTransformationStep>;
  readonly generatedSymbolNames: ReadonlyArray<string>;
  readonly warnings: ReadonlyArray<string>;
  readonly diagnostics: ReadonlyArray<string>;
  readonly languagePreservationStatus: LanguagePreservationStatus;
  readonly mismatchDetails?: string;
  readonly beforeLL1Analysis: LL1AnalysisResult;
  readonly afterLL1Analysis: LL1AnalysisResult;
  readonly iterations: number;
  readonly boundedByLimit: boolean;
}

// ===================================================================
// PDA ↔ CFG Translation Engine Types
// ===================================================================

export type TranslationDirection = 'CFG_TO_PDA' | 'PDA_TO_CFG';

export type PDACFGTranslationStepType =
  | 'TRANSLATION_START'
  | 'CFG_VALIDATION'
  | 'PDA_VALIDATION'
  | 'PDA_NORMALIZATION_START'
  | 'PDA_NORMALIZATION_FRESH_INITIAL_STATE'
  | 'PDA_NORMALIZATION_FRESH_STACK_BOTTOM'
  | 'PDA_NORMALIZATION_ACCEPTANCE_TO_EMPTY_STACK'
  | 'PDA_NORMALIZATION_COMPLETE'
  | 'CFG_TO_PDA_START_STATE'
  | 'CFG_TO_PDA_START_VARIABLE_PUSH'
  | 'CFG_TO_PDA_PRODUCTION_EXPANSION'
  | 'CFG_TO_PDA_TERMINAL_MATCH'
  | 'PDA_TO_CFG_TRIPLET_VARS_INIT'
  | 'PDA_TO_CFG_START_VARIABLE_PRODUCTIONS'
  | 'PDA_TO_CFG_POP_TRANSITION_PRODUCTIONS'
  | 'PDA_TO_CFG_REPLACEMENT_TRANSITION_PRODUCTIONS'
  | 'PDA_TO_CFG_USELESS_VARIABLE_CLEANUP'
  | 'LANGUAGE_PRESERVATION_CHECK'
  | 'TRANSLATION_COMPLETE';

export interface PDACFGTranslationStep {
  readonly stepIndex: number;
  readonly type: PDACFGTranslationStepType;
  readonly title: string;
  readonly description: string;
  readonly mathematicalNotation: string;
  readonly affectedSymbols?: ReadonlyArray<string>;
  readonly details?: string;
}

export interface LanguagePreservationCase {
  readonly inputString: string;
  readonly sourceAccepted: boolean;
  readonly targetAccepted: boolean;
  readonly match: boolean;
}

export interface PDACFGLanguagePreservationResult {
  readonly status: LanguagePreservationStatus;
  readonly totalTested: number;
  readonly totalMatches: number;
  readonly cases: ReadonlyArray<LanguagePreservationCase>;
  readonly mismatches: ReadonlyArray<LanguagePreservationCase>;
  readonly explanation: string;
}

export interface CFGToPDAResult {
  readonly success: boolean;
  readonly sourceCFG: ContextFreeGrammar;
  readonly targetPDAGraph: SolverGraphInput;
  readonly targetInitialStackSymbol: string;
  readonly steps: ReadonlyArray<PDACFGTranslationStep>;
  readonly generatedStates: ReadonlyArray<string>;
  readonly generatedStackSymbols: ReadonlyArray<string>;
  readonly warnings: ReadonlyArray<string>;
  readonly preservation: PDACFGLanguagePreservationResult;
}

export interface PDAToCFGResult {
  readonly success: boolean;
  readonly sourcePDAGraph: SolverGraphInput;
  readonly sourceInitialStackSymbol: string;
  readonly normalizedPDAGraph?: SolverGraphInput;
  readonly targetCFG: ContextFreeGrammar;
  readonly steps: ReadonlyArray<PDACFGTranslationStep>;
  readonly generatedVariables: ReadonlyArray<string>;
  readonly tripletMap: Record<string, { q: string; X: string; p: string }>;
  readonly warnings: ReadonlyArray<string>;
  readonly preservation: PDACFGLanguagePreservationResult;
}









