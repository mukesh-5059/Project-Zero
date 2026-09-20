import { MachineAnalysisResult, ExecutionExplanationResult } from '@project-zero/core-solver';
import { AutomatonType } from '@project-zero/shared';

import { sendChatMessage } from './aiChatService';

export interface AIExplanationPayload {
  machineType: AutomatonType;
  analysis: MachineAnalysisResult;
  executionExplanation: ExecutionExplanationResult | null;
  validationErrors: string[];
}

/**
 * Service: Fetches educational AI explanations from the AI gateway / NVIDIA NIM.
 * Handles timeouts, network unavailability, and gracefully falls back to deterministic explanations.
 */
export async function fetchAIExplanation(payload: AIExplanationPayload): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    // Construct prompt containing strictly verified deterministic facts
    const prompt = `You are an expert theoretical computer science professor and AI tutor.
Explain the following verified automaton machine facts to a student clearly and concisely:

Machine Type: ${payload.machineType}
States Count: ${payload.analysis.stateCount}
Alphabet Σ: {${payload.analysis.alphabet.join(', ')}}
Initial State: ${payload.analysis.initialStateLabel || 'None'}
Accepting States F: {${payload.analysis.acceptingStateLabels.join(', ')}}
Validation Status: ${payload.analysis.isStructurallyValid ? 'Valid' : 'Invalid'}
Structural Observations:
${payload.analysis.observations.map((o) => `- ${o}`).join('\n')}

${
  payload.executionExplanation
    ? `Execution Run Facts:
Input: "${payload.executionExplanation.inputString}"
Result: ${payload.executionExplanation.isAccepted ? 'ACCEPT' : 'REJECT'}
Formal Derivation:
${payload.executionExplanation.formalProofText}`
    : ''
}

Rules:
- Provide clear intuition and pedagogical context.
- Do NOT alter any mathematical facts or result statuses.
- Keep the response under 150 words.`;

    const res = await sendChatMessage(
      [{ role: 'user', content: prompt }],
      { signal: controller.signal }
    );

    clearTimeout(timeoutId);

    if (res.message?.content) {
      return res.message.content.trim();
    }
    throw new Error('Malformed AI model response');
  } catch (_err: unknown) {
    clearTimeout(timeoutId);

    // Deterministic fallback when AI service is unavailable
    const obsText = payload.analysis.observations.join(' ');
    const proofText = payload.executionExplanation
      ? ` Execution result for "${payload.executionExplanation.inputString}": ${
          payload.executionExplanation.isAccepted ? 'ACCEPTED' : 'REJECTED'
        }.`
      : '';

    return `[Deterministic Analysis Summary]: The ${payload.machineType} has ${payload.analysis.stateCount} state(s) and ${payload.analysis.transitionCount} transition(s). ${obsText}${proofText}`;
  }
}
