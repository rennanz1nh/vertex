import Anthropic from "@anthropic-ai/sdk";

// Server-only client, mirrors src/lib/stripe.ts's singleton pattern.
export const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
