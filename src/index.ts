/**
 * Tax-help assistant — free tier.
 *
 * A grounded, safety-first chat assistant for understanding US federal IRS
 * notices and back-tax resolution options. Built on Cloudflare Workers AI with
 * streaming (SSE) responses.
 *
 * Design notes:
 * - The model is RENTED (Workers AI here; swappable for Claude). The value/moat
 *   is the curated, cited knowledge base in ./knowledge.ts.
 * - Every request is grounded: we retrieve relevant, cited reference material
 *   and inject it into a scoped system prompt.
 * - Free tier collects NO sensitive data: we block SSNs / account numbers
 *   before they ever reach the model.
 *
 * @license MIT
 */
import { Env, ChatMessage } from "./types";
import {
	buildSystemPrompt,
	composeReply,
	scanForPII,
	PII_REFUSAL_MESSAGE,
} from "./knowledge";

// Model ID for Workers AI. Swappable — see README "Changing the Model".
// For higher-quality answers, route to Claude via an API binding instead.
const MODEL_ID = "@cf/meta/llama-3.1-8b-instruct-fp8";

export default {
	async fetch(
		request: Request,
		env: Env,
		ctx: ExecutionContext,
	): Promise<Response> {
		const url = new URL(request.url);

		// Static assets (frontend)
		if (url.pathname === "/" || !url.pathname.startsWith("/api/")) {
			return env.ASSETS.fetch(request);
		}

		if (url.pathname === "/api/chat") {
			if (request.method === "POST") {
				return handleChatRequest(request, env);
			}
			return new Response("Method not allowed", { status: 405 });
		}

		return new Response("Not found", { status: 404 });
	},
} satisfies ExportedHandler<Env>;

/**
 * Handles chat API requests: PII guard -> grounding -> streamed model response.
 */
async function handleChatRequest(
	request: Request,
	env: Env,
): Promise<Response> {
	try {
		const { messages = [] } = (await request.json()) as {
			messages: ChatMessage[];
		};

		// The last user turn drives both the PII guard and retrieval.
		const lastUser = [...messages]
			.reverse()
			.find((m) => m.role === "user");
		const lastUserText = lastUser?.content ?? "";

		// SAFETY: block sensitive identifiers before anything else happens.
		// Nothing sensitive reaches the model, logs, or the AI provider.
		const pii = scanForPII(lastUserText);
		if (pii.blocked) {
			return sseFromText(PII_REFUSAL_MESSAGE);
		}

		// FAST PATH: if the message confidently maps to a known notice/topic,
		// answer with a deterministic, authoritative card built from our own
		// curated data — accurate, well-formatted, and instant. No dependence
		// on the small language model for the most common (and highest-value)
		// case: someone typing in their notice code.
		const card = composeReply(lastUserText);
		if (card) {
			return sseFromText(card);
		}

		// GROUNDING: never trust a client-supplied system prompt. Strip any
		// system messages from the client and inject our own scoped prompt,
		// enriched with retrieved, cited reference material for this question.
		const convo = messages.filter((m) => m.role !== "system");
		const systemPrompt = buildSystemPrompt(lastUserText);
		const modelMessages: ChatMessage[] = [
			{ role: "system", content: systemPrompt },
			...convo,
		];

		const stream = await env.AI.run(
			MODEL_ID,
			{
				messages: modelMessages,
				max_tokens: 1024,
				stream: true,
			},
			{
				// Uncomment to use AI Gateway (rate limiting, caching, analytics):
				// gateway: { id: "YOUR_GATEWAY_ID", skipCache: false, cacheTtl: 3600 },
			},
		);

		return new Response(stream, {
			headers: {
				"content-type": "text/event-stream; charset=utf-8",
				"cache-control": "no-cache",
				connection: "keep-alive",
			},
		});
	} catch (error) {
		console.error("Error processing chat request:", error);
		return new Response(
			JSON.stringify({ error: "Failed to process request" }),
			{
				status: 500,
				headers: { "content-type": "application/json" },
			},
		);
	}
}

/**
 * Produce an SSE Response streaming a fixed string in the same event shape the
 * frontend already parses ({ response: "..." } then [DONE]). Used for canned
 * replies (e.g. the PII refusal) so the client path stays identical.
 */
function sseFromText(text: string): Response {
	const encoder = new TextEncoder();
	const stream = new ReadableStream({
		start(controller) {
			controller.enqueue(
				encoder.encode(`data: ${JSON.stringify({ response: text })}\n\n`),
			);
			controller.enqueue(encoder.encode("data: [DONE]\n\n"));
			controller.close();
		},
	});
	return new Response(stream, {
		headers: {
			"content-type": "text/event-stream; charset=utf-8",
			"cache-control": "no-cache",
			connection: "keep-alive",
		},
	});
}
