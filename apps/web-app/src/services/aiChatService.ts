import { ChatMessage, ChatResponse, GatewayErrorResponse, AIContextSnapshot, AIActionEnvelope } from '@project-zero/ai-gateway';

export interface SendChatMessageOptions {
  context?: AIContextSnapshot;
  signal?: AbortSignal;
}

export interface SendChatMessageResult {
  message: ChatMessage;
  actionProposal?: AIActionEnvelope;
}

export function boundChatMessage(msg: ChatMessage, isLatestUserMessage: boolean): ChatMessage {
  if (isLatestUserMessage || msg.content.length <= 4000) {
    return msg;
  }
  return {
    ...msg,
    content: msg.content.slice(0, 3800) + '\n... [History truncated for context]',
  };
}

export async function sendChatMessage(
  messages: ChatMessage[],
  options?: SendChatMessageOptions
): Promise<SendChatMessageResult> {
  const sanitizedMessages = messages.map((m, idx) =>
    boundChatMessage(m, idx === messages.length - 1 && m.role === 'user')
  );

  const response = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: sanitizedMessages,
      context: options?.context,
    }),
    signal: options?.signal,
  });


  if (!response.ok) {
    let errorMessage = `HTTP error ${response.status}`;
    try {
      const errorJson: GatewayErrorResponse = await response.json();
      if (errorJson?.error?.message) {
        errorMessage = errorJson.error.message;
      }
    } catch {
      // Use fallback status error
    }
    throw new Error(errorMessage);
  }

  const data: ChatResponse = await response.json();
  if (!data?.message?.content && !data?.actionProposal) {
    throw new Error('Received invalid empty response from AI Gateway.');
  }

  return {
    message: data.message || { role: 'assistant', content: '' },
    actionProposal: data.actionProposal,
  };
}
