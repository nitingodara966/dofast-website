import "server-only";

export type AssistantContext = {
  siteName: string;
  userMessage: string;
};

/**
 * Placeholder responder — this exact boundary is replaced by the
 * provider-backed AI layer in the next milestone (ARCHITECTURE.md §2.5).
 * It must never echo untrusted content in a way that changes semantics;
 * the reply is a fixed template.
 */
export async function generateAssistantReply(
  context: AssistantContext
): Promise<string> {
  return [
    `Thanks — your message about ${context.siteName} is saved.`,
    "",
    "I can't make changes to your website just yet: the AI editing engine ships in the next update. This chat will come alive the moment it does.",
  ].join("\n");
}
