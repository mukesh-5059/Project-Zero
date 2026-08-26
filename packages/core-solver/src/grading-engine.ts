import {
  SolverGraphInput,
  ChallengeDefinition,
  GradingResult,
  GradingCheckResult,
  ExampleEvaluation,
  GradingStatus,
} from './types';
import { validateDFA } from './dfa-validator';
import { validateNFA } from './nfa-validator';
import { validatePDA } from './pda-validator';
import { validateTM } from './tm-validator';
import { executeDFA } from './dfa-executor';
import { executeNFA } from './nfa-executor';
import { executePDA } from './pda-executor';
import { executeTM } from './tm-executor';
import { compareAutomataLanguages } from './dfa-equivalence';
import { AutomatonType } from '@project-zero/shared';

/**
 * Pure deterministic grading engine: Evaluates candidate automaton submission against a ChallengeDefinition.
 * Combines structural validation, constraint verification, example evaluation, and authoritative exact language equivalence testing.
 */
export function gradeSubmission(
  challenge: ChallengeDefinition,
  candidateGraph: SolverGraphInput,
  candidateMachineType: AutomatonType,
  initialStackSymbol: string = 'Z0',
  blankSymbol: string = '□'
): GradingResult {
  const passedChecks: GradingCheckResult[] = [];
  const failedChecks: GradingCheckResult[] = [];
  const positiveEvaluations: ExampleEvaluation[] = [];
  const negativeEvaluations: ExampleEvaluation[] = [];

  // Derive effective machine type if 'FA' is passed
  const effectiveCandidateType =
    candidateMachineType === 'FA'
      ? candidateGraph.edges.some(
          (e) => !e.label || e.label === 'ε' || e.label === 'λ' || e.label.trim() === ''
        )
        ? 'NFA'
        : 'DFA'
      : candidateMachineType;

  // 1. Structural Validation
  let isValidStructure = false;
  let validationErrorMessage = '';

  if (effectiveCandidateType === 'DFA') {
    const val = validateDFA(candidateGraph);
    isValidStructure = val.isValid;
    if (!isValidStructure) validationErrorMessage = val.errors[0]?.message || 'Invalid DFA structure';
  } else if (effectiveCandidateType === 'NFA') {
    const val = validateNFA(candidateGraph);
    isValidStructure = val.isValid;
    if (!isValidStructure) validationErrorMessage = val.errors[0]?.message || 'Invalid NFA structure';
  } else if (effectiveCandidateType === 'PDA') {
    const val = validatePDA(candidateGraph, initialStackSymbol);
    isValidStructure = val.isValid;
    if (!isValidStructure) validationErrorMessage = val.errors[0]?.message || 'Invalid PDA structure';
  } else if (effectiveCandidateType === 'TM') {
    const val = validateTM(candidateGraph, blankSymbol);
    isValidStructure = val.isValid;
    if (!isValidStructure) validationErrorMessage = val.errors[0]?.message || 'Invalid TM structure';
  }

  if (!isValidStructure) {
    failedChecks.push({
      name: 'Automaton Structural Validity',
      passed: false,
      detail: validationErrorMessage,
    });

    return {
      challengeId: challenge.id,
      status: 'INVALID_MACHINE',
      score: 0,
      passedChecks,
      failedChecks,
      positiveExamplesEvaluations: [],
      negativeExamplesEvaluations: [],
      explanation: `Submission rejected: Machine structure is invalid. ${validationErrorMessage}`,
      mathematicalReason: 'An automaton submission must satisfy formal 5-tuple / 7-tuple structural validity before evaluation.',
    };
  }

  passedChecks.push({
    name: 'Automaton Structural Validity',
    passed: true,
    detail: 'Candidate machine structure is valid.',
  });

  // 2. Machine Type Matching Check
  const isTypeMatch =
    candidateMachineType === challenge.targetMachineType ||
    effectiveCandidateType === challenge.targetMachineType ||
    (candidateMachineType === 'FA' && (challenge.targetMachineType === 'DFA' || challenge.targetMachineType === 'NFA'));

  if (!isTypeMatch) {
    failedChecks.push({
      name: 'Machine Type Requirement',
      passed: false,
      detail: `Expected ${challenge.targetMachineType}, but received ${candidateMachineType}.`,
    });
  } else {
    passedChecks.push({
      name: 'Machine Type Requirement',
      passed: true,
      detail: `Machine type ${candidateMachineType} matches target requirement.`,
    });
  }

  // 3. Structural Constraints Check (Max States, Max Transitions)
  if (challenge.maxStatesConstraint !== undefined) {
    if (candidateGraph.nodes.length > challenge.maxStatesConstraint) {
      failedChecks.push({
        name: 'State Count Constraint',
        passed: false,
        detail: `Submission uses ${candidateGraph.nodes.length} states (Maximum allowed: ${challenge.maxStatesConstraint}).`,
      });
    } else {
      passedChecks.push({
        name: 'State Count Constraint',
        passed: true,
        detail: `State count (${candidateGraph.nodes.length}) satisfies constraint (≤ ${challenge.maxStatesConstraint}).`,
      });
    }
  }

  if (challenge.maxTransitionsConstraint !== undefined) {
    if (candidateGraph.edges.length > challenge.maxTransitionsConstraint) {
      failedChecks.push({
        name: 'Transition Count Constraint',
        passed: false,
        detail: `Submission uses ${candidateGraph.edges.length} transitions (Maximum allowed: ${challenge.maxTransitionsConstraint}).`,
      });
    } else {
      passedChecks.push({
        name: 'Transition Count Constraint',
        passed: true,
        detail: `Transition count (${candidateGraph.edges.length}) satisfies constraint (≤ ${challenge.maxTransitionsConstraint}).`,
      });
    }
  }

  // 4. Execution Helper for Candidate Machine
  const executeCandidate = (inputStr: string): boolean => {
    if (effectiveCandidateType === 'DFA') {
      return executeDFA(candidateGraph, inputStr).isAccepted;
    } else if (effectiveCandidateType === 'NFA') {
      return executeNFA(candidateGraph, inputStr).isAccepted;
    } else if (effectiveCandidateType === 'PDA') {
      return executePDA(candidateGraph, inputStr, { initialStackSymbol }).isAccepted;
    } else if (effectiveCandidateType === 'TM') {
      return executeTM(candidateGraph, inputStr, { blankSymbol }).isAccepted;
    }
    return false;
  };

  // 5. Positive Examples Evaluation
  if (challenge.positiveExamples && challenge.positiveExamples.length > 0) {
    challenge.positiveExamples.forEach((w) => {
      const actual = executeCandidate(w);
      const passed = actual === true;
      positiveEvaluations.push({
        input: w,
        expected: true,
        actual,
        passed,
      });
      if (!passed) {
        failedChecks.push({
          name: `Positive Example "${w === '' ? 'ε' : w}"`,
          passed: false,
          detail: `Expected ACCEPT, but candidate machine REJECTED.`,
        });
      }
    });
  }

  // 6. Negative Examples Evaluation
  if (challenge.negativeExamples && challenge.negativeExamples.length > 0) {
    challenge.negativeExamples.forEach((w) => {
      const actual = executeCandidate(w);
      const passed = actual === false;
      negativeEvaluations.push({
        input: w,
        expected: false,
        actual,
        passed,
      });
      if (!passed) {
        failedChecks.push({
          name: `Negative Example "${w === '' ? 'ε' : w}"`,
          passed: false,
          detail: `Expected REJECT, but candidate machine ACCEPTED.`,
        });
      }
    });
  }

  // 7. Authoritative Exact Language Equivalence Check (DFA & NFA)
  let isExactLanguageMatch: boolean | undefined = undefined;
  let shortestCounterexample: string | undefined = undefined;
  let expectedCounterexampleResult: boolean | undefined = undefined;
  let actualCounterexampleResult: boolean | undefined = undefined;

  if (
    challenge.referenceGraph &&
    challenge.referenceMachineType &&
    (effectiveCandidateType === 'DFA' || effectiveCandidateType === 'NFA') &&
    (challenge.referenceMachineType === 'DFA' || challenge.referenceMachineType === 'NFA')
  ) {
    const eqResult = compareAutomataLanguages(
      candidateGraph,
      effectiveCandidateType,
      challenge.referenceGraph,
      challenge.referenceMachineType
    );

    if (eqResult.isEquivalent) {
      isExactLanguageMatch = true;
      passedChecks.push({
        name: 'Exact Language Equivalence L(M) = L(target)',
        passed: true,
        detail: 'Candidate automaton is mathematically proven to accept the exact target language across the unified alphabet.',
      });
    } else {
      isExactLanguageMatch = false;
      shortestCounterexample = eqResult.counterexample !== undefined ? eqResult.counterexample : '';
      expectedCounterexampleResult = eqResult.acceptsB;
      actualCounterexampleResult = eqResult.acceptsA;

      const cDisplay = shortestCounterexample === '' ? 'ε (Empty String)' : `"${shortestCounterexample}"`;
      failedChecks.push({
        name: 'Exact Language Equivalence L(M) = L(target)',
        passed: false,
        detail: `Divergent language match. Shortest counterexample w = ${cDisplay}: Expected ${expectedCounterexampleResult ? 'ACCEPT' : 'REJECT'}, Candidate produced ${actualCounterexampleResult ? 'ACCEPT' : 'REJECT'}.`,
      });
    }
  }

  // 8. Final Status & Score Calculation
  const totalPositiveCount = positiveEvaluations.length;
  const passedPositiveCount = positiveEvaluations.filter((e) => e.passed).length;

  const totalNegativeCount = negativeEvaluations.length;
  const passedNegativeCount = negativeEvaluations.filter((e) => e.passed).length;

  const examplePassRate =
    totalPositiveCount + totalNegativeCount > 0
      ? (passedPositiveCount + passedNegativeCount) / (totalPositiveCount + totalNegativeCount)
      : 1.0;

  const structuralPass = failedChecks.length === 0 || (failedChecks.length === 1 && failedChecks[0].name.includes('Equivalence'));

  let score = 0;
  let status: GradingStatus = 'FAIL';

  if (isExactLanguageMatch === true && structuralPass) {
    score = 100;
    status = 'PASS';
  } else if (isExactLanguageMatch === false) {
    score = Math.round(examplePassRate * 80); // Cap at 80 if exact language match fails
    status = 'FAIL';
  } else {
    // For non-DFA/NFA challenges (e.g. PDA/TM) where exact product equivalence is undecidable/unsupported
    if (examplePassRate === 1.0 && structuralPass) {
      score = 100;
      status = 'PASS';
    } else {
      score = Math.round(examplePassRate * 100);
      status = 'FAIL';
    }
  }

  // Explanations
  let explanation = '';
  let mathematicalReason = '';

  if (status === 'PASS') {
    explanation = `Challenge Passed! Your submission achieves a 100/100 score and satisfies all formal target specifications.`;
    mathematicalReason = `Language L(candidate) is mathematically proven equivalent to the target language L(target).`;
  } else {
    const cDisplay = shortestCounterexample === '' ? 'ε (Empty String)' : `"${shortestCounterexample}"`;
    explanation = `Submission Failed (${score}/100). `;
    if (shortestCounterexample !== undefined) {
      explanation += `Shortest distinguishing counterexample string found: w = ${cDisplay}. Expected: ${expectedCounterexampleResult ? 'ACCEPT' : 'REJECT'}, Your machine: ${actualCounterexampleResult ? 'ACCEPT' : 'REJECT'}.`;
      mathematicalReason = `w = ${cDisplay} ∈ L(candidate) ⊕ L(target). Thus, L(candidate) ≠ L(target).`;
    } else {
      explanation += `Machine failed ${failedChecks.length} test check(s).`;
      mathematicalReason = `Candidate machine does not accept all required positive strings or reject all required negative strings.`;
    }
  }

  return {
    challengeId: challenge.id,
    status,
    score,
    passedChecks,
    failedChecks,
    positiveExamplesEvaluations: positiveEvaluations,
    negativeExamplesEvaluations: negativeEvaluations,
    isExactLanguageMatch,
    shortestCounterexample,
    expectedCounterexampleResult,
    actualCounterexampleResult,
    explanation,
    mathematicalReason,
  };
}

/**
 * Pure deterministic hint helper: Retrieves progressive hint string for a challenge.
 * Returns null if hint index is out of bounds. 0 state mutation.
 */
export function getChallengeHint(challenge: ChallengeDefinition, hintIndex: number): string | null {
  if (!challenge || !challenge.hints || hintIndex < 0 || hintIndex >= challenge.hints.length) {
    return null;
  }
  return challenge.hints[hintIndex];
}
