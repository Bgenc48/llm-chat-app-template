/**
 * knowledge.ts — grounding layer for the tax-help assistant.
 *
 * This is the deliberately-owned part of the system (the "moat"): a small,
 * curated, *citable* knowledge base plus the retrieval and safety helpers that
 * keep the model grounded. The model is rented (Workers AI / Claude); the facts
 * and citations live here, under our control, and can be updated any time.
 *
 * SCOPE (v1 wedge): US federal IRS notices + back-tax resolution.
 *
 * IMPORTANT: Every entry carries an authoritative citation. Answers that are not
 * supported by an entry should defer to a human Enrolled Agent / CPA rather than
 * guess. Tax law changes; treat this file as living data to be reviewed by a
 * qualified professional before it ships to real users.
 */

export interface Citation {
	label: string;
	url: string;
}

export type Urgency = "info" | "important" | "urgent";

export interface KnowledgeEntry {
	id: string;
	kind: "notice" | "resolution";
	title: string;
	/** Lowercase terms used by the lexical retriever. Include synonyms. */
	keywords: string[];
	urgency: Urgency;
	/** Plain-English explanation, calm and non-alarming. */
	summary: string;
	/** Concrete next steps, most important first. */
	steps: string[];
	/** Deadline note if the item is time-sensitive, else null. */
	deadline: string | null;
	citations: Citation[];
}

// -----------------------------------------------------------------------------
// Seed knowledge base. Curated + hand-cited. Expand over time.
// -----------------------------------------------------------------------------

export const KNOWLEDGE_BASE: KnowledgeEntry[] = [
	{
		id: "cp14",
		kind: "notice",
		title: "CP14 — Balance Due (first bill)",
		keywords: ["cp14", "balance due", "you owe", "unpaid", "first notice", "bill"],
		urgency: "important",
		summary:
			"A CP14 is usually the first notice the IRS sends when you have an unpaid balance on your account. It states the tax, penalties, and interest owed for a specific year. It is a bill, not an audit or a penalty for wrongdoing.",
		steps: [
			"Check the notice against your own records for the tax year listed to confirm the amount looks right.",
			"If you agree and can pay, pay by the due date on the notice to stop additional penalties and interest.",
			"If you agree but can't pay in full, you can request a payment plan (installment agreement).",
			"If you disagree, contact the IRS at the number on the notice with your supporting documents before the due date.",
		],
		deadline:
			"Pay or respond by the date on the notice (commonly ~21 days) to limit additional failure-to-pay penalties and interest.",
		citations: [
			{ label: "IRS — Understanding your CP14 notice", url: "https://www.irs.gov/individuals/understanding-your-cp14-notice" },
		],
	},
	{
		id: "cp2000",
		kind: "notice",
		title: "CP2000 — Underreported Income (proposed change)",
		keywords: ["cp2000", "underreporter", "does not match", "mismatch", "1099", "w-2", "proposed", "income"],
		urgency: "important",
		summary:
			"A CP2000 means income reported to the IRS by third parties (employers, banks, brokerages via W-2s and 1099s) does not match what was on your return. It is a PROPOSED change, not a final bill and not an audit. You can agree or disagree.",
		steps: [
			"Read the notice to see which income items the IRS says are missing or different.",
			"Compare against your own W-2s, 1099s, and records — sometimes the third party reported in error.",
			"If you agree, sign and return the response form and arrange payment of the additional amount.",
			"If you disagree, return the response form marked disagree with a signed explanation and copies (not originals) of supporting documents by the deadline.",
		],
		deadline:
			"Respond by the date on the notice (usually 30 days from the notice date) to preserve your options and avoid the change being finalized.",
		citations: [
			{ label: "IRS — Understanding your CP2000 notice", url: "https://www.irs.gov/individuals/understanding-your-cp2000-notice" },
		],
	},
	{
		id: "cp2501",
		kind: "notice",
		title: "CP2501 — Income Discrepancy (early stage)",
		keywords: ["cp2501", "discrepancy", "income does not match", "underreporter"],
		urgency: "important",
		summary:
			"A CP2501 is an earlier-stage version of the underreporter process. Like the CP2000 it flags a mismatch between your return and income reported by third parties, and asks you to respond before a formal proposed change (CP2000) is issued.",
		steps: [
			"Compare the flagged income items to your own records.",
			"Respond with the enclosed form indicating whether you agree or disagree.",
			"Attach copies of supporting documents if you disagree.",
		],
		deadline: "Respond by the date on the notice (commonly 30 days).",
		citations: [
			{ label: "IRS — Understanding your CP2501 notice", url: "https://www.irs.gov/individuals/understanding-your-cp2501-notice" },
		],
	},
	{
		id: "cp501",
		kind: "notice",
		title: "CP501 — Reminder of Balance Due",
		keywords: ["cp501", "reminder", "balance due", "still owe"],
		urgency: "important",
		summary:
			"A CP501 is a reminder that you still have an unpaid balance on a tax account. It typically follows an earlier notice such as a CP14.",
		steps: [
			"Pay the balance if you can, to stop further penalties and interest.",
			"If you can't pay in full, look at a payment plan (installment agreement) or other resolution options.",
			"Don't ignore it — reminders escalate toward levy notices.",
		],
		deadline: "Respond by the date on the notice to avoid escalation.",
		citations: [
			{ label: "IRS — Understanding your CP501 notice", url: "https://www.irs.gov/individuals/understanding-your-cp501-notice" },
		],
	},
	{
		id: "cp503",
		kind: "notice",
		title: "CP503 — Second Reminder of Balance Due",
		keywords: ["cp503", "second reminder", "balance due", "immediate attention"],
		urgency: "important",
		summary:
			"A CP503 is a second reminder that the IRS has not received payment or a response on an unpaid balance. It is a step closer to enforced collection.",
		steps: [
			"Address the balance now — pay, or set up a payment plan.",
			"If you disagree with the amount, contact the IRS with documentation.",
			"Understand that the next notices (CP504, then LT11/CP90) begin the levy process.",
		],
		deadline: "Respond promptly by the date on the notice.",
		citations: [
			{ label: "IRS — Understanding your CP503 notice", url: "https://www.irs.gov/individuals/understanding-your-cp503-notice" },
		],
	},
	{
		id: "cp504",
		kind: "notice",
		title: "CP504 — Notice of Intent to Levy (state refund)",
		keywords: ["cp504", "intent to levy", "levy", "urgent", "seize", "state refund"],
		urgency: "urgent",
		summary:
			"A CP504 is an urgent notice: if the balance isn't paid, the IRS intends to levy (seize) your state tax refund and may search for other assets to levy. It is a serious escalation, though it is not yet the final levy notice that grants Collection Due Process hearing rights for other property.",
		steps: [
			"Do not ignore this. Pay the balance or arrange a resolution immediately.",
			"Call the number on the notice to discuss payment plans or hardship options.",
			"Consider getting a tax professional (Enrolled Agent or CPA) involved now, before the final levy notice.",
		],
		deadline: "Act by the date on the notice — typically within 30 days — to avoid levy of your state refund and further enforcement.",
		citations: [
			{ label: "IRS — Understanding your CP504 notice", url: "https://www.irs.gov/individuals/understanding-your-cp504-notice" },
			{ label: "IRS — Levies", url: "https://www.irs.gov/businesses/small-businesses-self-employed/levy" },
		],
	},
	{
		id: "lt11",
		kind: "notice",
		title: "LT11 / Letter 1058 — Final Notice of Intent to Levy + CDP rights",
		keywords: ["lt11", "letter 1058", "1058", "final notice", "intent to levy", "collection due process", "cdp", "hearing", "urgent"],
		urgency: "urgent",
		summary:
			"An LT11 (or Letter 1058) is the Final Notice of Intent to Levy and Notice of Your Right to a Hearing. This is the notice that starts the clock on your Collection Due Process (CDP) hearing rights. After the deadline the IRS can levy wages, bank accounts, and other property.",
		steps: [
			"Treat this as time-critical. You generally have 30 days to request a Collection Due Process (CDP) hearing using Form 12153.",
			"Requesting a timely CDP hearing generally pauses levy action and lets you propose alternatives (payment plan, offer in compromise, currently-not-collectible).",
			"Strongly consider engaging an Enrolled Agent, CPA, or tax attorney immediately.",
		],
		deadline: "Request a CDP hearing within 30 days of the notice date (Form 12153) to preserve your hearing rights and pause levy action.",
		citations: [
			{ label: "IRS — Levies / Final notice", url: "https://www.irs.gov/businesses/small-businesses-self-employed/levy" },
			{ label: "IRS Form 12153 — Request for a CDP Hearing", url: "https://www.irs.gov/forms-pubs/about-form-12153" },
		],
	},
	{
		id: "cp90",
		kind: "notice",
		title: "CP90 — Final Notice of Intent to Levy + Right to a Hearing",
		keywords: ["cp90", "final notice", "intent to levy", "right to hearing", "cdp", "urgent"],
		urgency: "urgent",
		summary:
			"A CP90 is a Final Notice of Intent to Levy and Notice of Your Right to a Hearing. Like the LT11, it grants Collection Due Process (CDP) hearing rights and precedes levy of your income and assets if you do not act.",
		steps: [
			"Act within 30 days. Request a CDP hearing with Form 12153 to preserve your rights and generally pause levy.",
			"Prepare a resolution proposal (installment agreement, offer in compromise, or currently-not-collectible).",
			"Get professional representation involved right away.",
		],
		deadline: "Request a CDP hearing within 30 days of the notice date (Form 12153).",
		citations: [
			{ label: "IRS — Understanding your CP90 notice", url: "https://www.irs.gov/individuals/understanding-your-cp90-notice" },
			{ label: "IRS Form 12153 — Request for a CDP Hearing", url: "https://www.irs.gov/forms-pubs/about-form-12153" },
		],
	},
	{
		id: "cp11",
		kind: "notice",
		title: "CP11 — Changes to Your Return, Balance Due",
		keywords: ["cp11", "changes to your return", "math error", "miscalculation", "balance due"],
		urgency: "important",
		summary:
			"A CP11 says the IRS made changes to your return (often due to a miscalculation) and those changes resulted in a balance due. You have the right to disagree.",
		steps: [
			"Review the notice to see exactly what the IRS changed.",
			"If you agree, pay or set up a payment plan by the due date.",
			"If you disagree, contact the IRS within 60 days so any reversal can be made without additional steps.",
		],
		deadline: "Contact the IRS within 60 days if you disagree; pay by the due date if you agree.",
		citations: [
			{ label: "IRS — Understanding your CP11 notice", url: "https://www.irs.gov/individuals/understanding-your-cp11-notice" },
		],
	},
	{
		id: "cp12",
		kind: "notice",
		title: "CP12 — Changes to Your Return, Refund Adjusted",
		keywords: ["cp12", "changes to your return", "refund adjusted", "corrected", "overpayment"],
		urgency: "info",
		summary:
			"A CP12 means the IRS corrected one or more mistakes on your return and the change affects your refund (you may now be getting a different refund, or a refund where you expected a balance).",
		steps: [
			"Review what was changed.",
			"If you agree, no reply is usually needed; expect your adjusted refund in a few weeks.",
			"If you disagree, contact the IRS within 60 days.",
		],
		deadline: "Contact the IRS within 60 days if you disagree.",
		citations: [
			{ label: "IRS — Understanding your CP12 notice", url: "https://www.irs.gov/individuals/understanding-your-cp12-notice" },
		],
	},
	{
		id: "cp05",
		kind: "notice",
		title: "CP05 — Return Under Review (refund held)",
		keywords: ["cp05", "under review", "reviewing", "refund held", "verifying", "hold"],
		urgency: "info",
		summary:
			"A CP05 tells you the IRS is reviewing your return (for example, verifying income, withholding, or credits) and is holding your refund while it does so. No action is usually required immediately.",
		steps: [
			"Read the notice; usually you don't need to do anything yet.",
			"If the IRS needs documents, a follow-up notice (such as a CP05A) will ask for them.",
			"Keep your income and withholding records handy in case they're requested.",
		],
		deadline: "No immediate action unless a follow-up notice requests documents.",
		citations: [
			{ label: "IRS — Understanding your CP05 notice", url: "https://www.irs.gov/individuals/understanding-your-cp05-notice" },
		],
	},
	{
		id: "cp2000-vs-audit",
		kind: "notice",
		title: "Is this an audit? (notice vs. examination)",
		keywords: ["audit", "examination", "is this an audit", "being audited", "exam"],
		urgency: "info",
		summary:
			"Many IRS notices are NOT audits. Automated notices (CP2000, CP11, CP14) are computer-generated matching or billing notices. A true examination (audit) is a separate process, usually opened by a specific letter (for example Letter 2205 or 566) and often assigned to an examiner.",
		steps: [
			"Check the notice/letter number and its title — most CP notices are automated, not audits.",
			"If it's an underreporter notice (CP2000), respond to the proposed change; you don't need to treat it as a full audit.",
			"If it is an examination letter, gather the specific records requested and consider professional representation.",
		],
		deadline: "Respond by whatever date the specific notice or letter states.",
		citations: [
			{ label: "IRS — IRS audits", url: "https://www.irs.gov/businesses/small-businesses-self-employed/irs-audits" },
		],
	},
	{
		id: "installment-agreement",
		kind: "resolution",
		title: "Payment Plan (Installment Agreement)",
		keywords: ["payment plan", "installment", "installment agreement", "monthly payments", "can't pay", "cannot pay", "pay over time", "form 9465"],
		urgency: "info",
		summary:
			"An installment agreement lets you pay your tax debt over time in monthly payments. Many taxpayers can apply online. Short-term plans (typically up to 180 days) and long-term monthly plans are available; penalties and interest continue until the balance is paid, but at a reduced failure-to-pay rate while an agreement is in effect.",
		steps: [
			"Check eligibility for the IRS Online Payment Agreement tool (commonly available if you owe under set thresholds combined tax, penalties, and interest).",
			"Choose a monthly amount you can sustain to avoid defaulting the agreement.",
			"Apply online, by phone, or with Form 9465; keep filing and paying future taxes on time to stay in good standing.",
		],
		deadline: null,
		citations: [
			{ label: "IRS — Payment plans / installment agreements", url: "https://www.irs.gov/payments/payment-plans-installment-agreements" },
			{ label: "IRS — Online Payment Agreement application", url: "https://www.irs.gov/payments/online-payment-agreement-application" },
		],
	},
	{
		id: "offer-in-compromise",
		kind: "resolution",
		title: "Offer in Compromise (settle for less)",
		keywords: ["offer in compromise", "oic", "settle", "settle for less", "pennies on the dollar", "form 656", "reduce debt"],
		urgency: "info",
		summary:
			"An Offer in Compromise (OIC) lets qualifying taxpayers settle a tax debt for less than the full amount when paying in full would create a genuine financial hardship or there is doubt about collectibility. Not everyone qualifies, and the IRS evaluates income, expenses, and asset equity. Be wary of 'pennies on the dollar' advertising.",
		steps: [
			"Use the IRS Offer in Compromise Pre-Qualifier tool to get a realistic sense of eligibility.",
			"Make sure you're compliant: all required returns filed and current on estimated payments/withholding.",
			"Prepare Form 656 plus Form 433-A (OIC) or 433-B (OIC) with full financial documentation.",
		],
		deadline: null,
		citations: [
			{ label: "IRS — Offer in Compromise", url: "https://www.irs.gov/payments/offer-in-compromise" },
		],
	},
	{
		id: "currently-not-collectible",
		kind: "resolution",
		title: "Currently Not Collectible (hardship pause)",
		keywords: ["currently not collectible", "cnc", "hardship", "can't afford", "financial hardship", "pause collection", "status 53"],
		urgency: "info",
		summary:
			"If you truly can't afford to pay basic living expenses and your tax debt at the same time, the IRS may place your account in Currently Not Collectible (CNC) status, temporarily pausing active collection. The debt doesn't go away and interest continues, but levies and enforced collection are generally halted while in CNC.",
		steps: [
			"Be ready to document your monthly income and necessary living expenses (often via Form 433-F or 433-A).",
			"Contact the IRS to request CNC/hardship status and explain your situation.",
			"Understand the balance remains and the IRS periodically reviews your ability to pay.",
		],
		deadline: null,
		citations: [
			{ label: "IRS — Temporarily delay the collection process", url: "https://www.irs.gov/businesses/small-businesses-self-employed/temporarily-delay-the-collection-process" },
		],
	},
	{
		id: "penalty-abatement",
		kind: "resolution",
		title: "Penalty Relief (First-Time Abatement & Reasonable Cause)",
		keywords: ["penalty", "penalty abatement", "first time abatement", "fta", "reasonable cause", "remove penalty", "waive penalty"],
		urgency: "info",
		summary:
			"The IRS may remove certain penalties. First-Time Abatement (FTA) can waive a failure-to-file or failure-to-pay penalty if you have a clean compliance history for the prior three years and are otherwise current. Reasonable-cause relief applies when circumstances beyond your control (serious illness, disaster, etc.) caused the failure.",
		steps: [
			"Identify which penalty was charged (the notice lists it).",
			"If you have a clean prior-3-year history, ask for First-Time Abatement — often by phone.",
			"Otherwise, request reasonable-cause relief with a written explanation and any supporting documentation.",
		],
		deadline: null,
		citations: [
			{ label: "IRS — Penalty relief", url: "https://www.irs.gov/payments/penalty-relief" },
			{ label: "IRS — First-time penalty abatement", url: "https://www.irs.gov/payments/penalty-relief-due-to-first-time-abate-or-other-administrative-waiver" },
		],
	},
	{
		id: "unfiled-returns",
		kind: "resolution",
		title: "Unfiled / Back Tax Returns",
		keywords: ["unfiled", "unfiled returns", "years of unfiled", "haven't filed", "back taxes", "old returns", "multiple years", "didn't file", "substitute for return", "sfr"],
		urgency: "important",
		summary:
			"If you have years of unfiled returns, the priority is getting into compliance. If you don't file, the IRS may file a Substitute for Return (SFR) on your behalf without your deductions or credits, usually resulting in a higher balance. Filing the actual returns often reduces what's owed and reopens resolution options.",
		steps: [
			"Gather income records (wage & income transcripts can be requested from the IRS) for each unfiled year.",
			"File the missing returns — the IRS generally requires the last several years to be considered in compliance.",
			"Once filed, address any balance with a payment plan, offer in compromise, or hardship status.",
		],
		deadline: null,
		citations: [
			{ label: "IRS — Filing past due tax returns", url: "https://www.irs.gov/businesses/small-businesses-self-employed/filing-past-due-tax-returns" },
			{ label: "IRS — Get transcript", url: "https://www.irs.gov/individuals/get-transcript" },
		],
	},
	{
		id: "cdp-hearing",
		kind: "resolution",
		title: "Collection Due Process (CDP) Hearing",
		keywords: ["cdp", "collection due process", "hearing", "form 12153", "appeal levy", "appeal lien"],
		urgency: "important",
		summary:
			"A Collection Due Process (CDP) hearing lets you dispute a levy or lien and propose collection alternatives before an independent IRS Appeals officer. It's triggered by a final levy notice (LT11/CP90) or a lien notice, and must be requested within a strict window.",
		steps: [
			"File Form 12153 within 30 days of the final levy notice (or the lien notice deadline) to get a timely hearing that pauses levy.",
			"State your reason and the alternative you want (payment plan, offer, CNC, or dispute of the liability if you had no prior chance).",
			"Consider representation — an EA, CPA, or tax attorney can attend on your behalf.",
		],
		deadline: "Generally 30 days from the final levy notice date to request a hearing that preserves levy-pause rights.",
		citations: [
			{ label: "IRS Form 12153 — Request for a CDP Hearing", url: "https://www.irs.gov/forms-pubs/about-form-12153" },
			{ label: "IRS — Appeals", url: "https://www.irs.gov/appeals" },
		],
	},
];

// -----------------------------------------------------------------------------
// Retrieval — lexical, deterministic, dependency-free.
// Good enough for a grounded MVP; upgrade to embeddings/Vectorize later.
// -----------------------------------------------------------------------------

const STOPWORDS = new Set([
	"the", "a", "an", "and", "or", "but", "to", "of", "in", "on", "for", "is",
	"it", "my", "i", "me", "do", "does", "what", "whats", "how", "why", "this",
	"that", "was", "with", "have", "has", "am", "are", "be", "get", "got", "if",
	"can", "cant", "cannot", "you", "your", "about", "from", "they", "them",
]);

/** Extract IRS notice/letter codes like "CP2000", "cp 14", "LT11", "letter 1058". */
export function extractNoticeCodes(text: string): string[] {
	const codes = new Set<string>();
	const lower = text.toLowerCase();
	// CPxx / LTxx (allow an optional space: "cp 2000")
	for (const m of lower.matchAll(/\b(cp|lt)\s?(\d{1,4})\b/g)) {
		codes.add(`${m[1]}${m[2]}`);
	}
	// "letter 1058", "ltr 1058"
	for (const m of lower.matchAll(/\b(?:letter|ltr)\s?(\d{2,4})\b/g)) {
		codes.add(`letter${m[1]}`);
		codes.add(m[1]);
	}
	return [...codes];
}

function tokenize(text: string): string[] {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9\s']/g, " ")
		.split(/\s+/)
		.filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

export interface ScoredEntry {
	entry: KnowledgeEntry;
	score: number;
}

/**
 * Retrieve the most relevant knowledge entries for a user message.
 * Scoring: exact notice-code hits dominate; otherwise keyword overlap.
 */
export function retrieveScored(query: string, topK = 3): ScoredEntry[] {
	const codes = extractNoticeCodes(query);
	const tokens = new Set(tokenize(query));
	const scored: ScoredEntry[] = [];

	for (const entry of KNOWLEDGE_BASE) {
		let score = 0;
		const kw = entry.keywords;

		// Strong signal: a notice code in the query matches an entry keyword.
		for (const code of codes) {
			if (kw.includes(code) || entry.id.replace(/-.*/, "") === code) {
				score += 100;
			}
		}

		// Keyword overlap. Multi-word keywords that appear as substrings count more.
		for (const keyword of kw) {
			if (keyword.includes(" ")) {
				if (query.toLowerCase().includes(keyword)) score += 5;
			} else if (tokens.has(keyword)) {
				score += 2;
			}
		}

		if (score > 0) scored.push({ entry, score });
	}

	scored.sort((a, b) => b.score - a.score);
	return scored.slice(0, topK);
}

export function retrieve(query: string, topK = 3): KnowledgeEntry[] {
	return retrieveScored(query, topK).map((s) => s.entry);
}

// A confident match: a notice-code hit, or a strong keyword overlap. Used to
// decide when we can answer with a deterministic, authoritative card instead
// of leaning on the (small, swappable) language model.
const STRONG_SCORE = 5;
export function topMatch(query: string): ScoredEntry | null {
	const [top] = retrieveScored(query, 1);
	return top && top.score >= STRONG_SCORE ? top : null;
}

const URGENCY_BADGE: Record<Urgency, string> = {
	info: "🟢 Good to know",
	important: "🟡 Needs attention",
	urgent: "🔴 Time-sensitive — act now",
};

/** Render a knowledge entry as a clean, cited Markdown "card". */
export function renderCardMarkdown(entry: KnowledgeEntry): string {
	const steps = entry.steps.map((s, i) => `${i + 1}. ${s}`).join("\n");
	const deadline = entry.deadline
		? `\n\n**⏰ Deadline:** ${entry.deadline}`
		: "";
	const sources = entry.citations
		.map((c) => `- [${c.label}](${c.url})`)
		.join("\n");
	return [
		`**${entry.title}**`,
		URGENCY_BADGE[entry.urgency],
		"",
		entry.summary,
		"",
		"**What to do**",
		steps + deadline,
		"",
		"**Sources**",
		sources,
		"",
		"_General information, not tax advice. For your specific situation, confirm with a licensed Enrolled Agent or CPA._",
	].join("\n");
}

/**
 * If the message confidently maps to a known notice/topic, return a
 * deterministic, authoritative Markdown card. Otherwise null (use the model).
 */
export function composeReply(query: string): string | null {
	const top = topMatch(query);
	return top ? renderCardMarkdown(top.entry) : null;
}

/**
 * Build the grounding block injected into the system prompt. Includes citations
 * so the model can (and is instructed to) cite them. Returns "" if nothing hit.
 */
export function buildGroundingBlock(entries: KnowledgeEntry[]): string {
	if (entries.length === 0) return "";
	const parts = entries.map((e) => {
		const cites = e.citations.map((c) => `${c.label} <${c.url}>`).join("; ");
		const steps = e.steps.map((s, i) => `  ${i + 1}. ${s}`).join("\n");
		const deadline = e.deadline ? `\nDeadline: ${e.deadline}` : "";
		return `### ${e.title} [urgency: ${e.urgency}]\n${e.summary}\nWhat to do:\n${steps}${deadline}\nSources: ${cites}`;
	});
	return parts.join("\n\n");
}

// -----------------------------------------------------------------------------
// Safety: PII / sensitive-data guard (free tier collects NO sensitive data).
// -----------------------------------------------------------------------------

export interface PiiScan {
	blocked: boolean;
	reason: string;
}

/**
 * Detect obviously-sensitive identifiers a free-tier user should never paste.
 * We block BEFORE the message reaches the model or any logs.
 */
export function scanForPII(text: string): PiiScan {
	// SSN / ITIN: 9 digits, optionally dashed (###-##-#### or #########).
	if (/\b\d{3}-\d{2}-\d{4}\b/.test(text)) {
		return { blocked: true, reason: "ssn" };
	}
	// Bare 9-digit run that isn't clearly something else — conservative: only if
	// the surrounding context mentions ssn/social to avoid false positives.
	if (/\b\d{9}\b/.test(text) && /\b(ssn|social security|itin)\b/i.test(text)) {
		return { blocked: true, reason: "ssn" };
	}
	// Long digit runs that look like a bank/card/account number (13–19 digits).
	if (/\b\d[\d\s-]{11,21}\d\b/.test(text) && /\b(account|routing|card|bank)\b/i.test(text)) {
		return { blocked: true, reason: "financial-account" };
	}
	return { blocked: false, reason: "" };
}

export const PII_REFUSAL_MESSAGE =
	"For your security, please don't share Social Security numbers, ITINs, or full bank/card account numbers here. " +
	"This free assistant is designed to help WITHOUT any sensitive identifiers.\n\n" +
	"Tell me in general terms instead — for example, the notice number (like CP2000 or LT11), the tax year, and what it says — " +
	"and I can walk you through what it means and your options.";

// -----------------------------------------------------------------------------
// System prompt (scoped + safety-first). The model is told to stay grounded.
// -----------------------------------------------------------------------------

export const TAX_SYSTEM_PROMPT = `You are a calm, plain-English assistant that helps people understand US federal IRS notices and back-tax situations, and the options for resolving them.

SCOPE — you help with:
- Understanding IRS notices and letters (what they mean, how urgent, what to do).
- Back-tax resolution options: payment plans (installment agreements), offers in compromise, currently-not-collectible/hardship, penalty relief, unfiled returns, and Collection Due Process hearings.
Politely DECLINE and redirect anything outside this scope (preparing/filing specific returns, detailed state or local tax, non-tax legal advice, or investment advice). Suggest they consult a qualified professional for those.

GROUNDING:
- When "REFERENCE MATERIAL" is provided below, base your answer on it and cite the "Sources" it lists (name the source and include its URL) in a short "Sources" line at the end.
- If the reference material does not cover the question, say plainly that you're not certain and recommend speaking with an Enrolled Agent or CPA. Do NOT invent notice numbers, dollar thresholds, form numbers, code sections, or deadlines.

SAFETY & TONE:
- This is general educational information, NOT tax or legal advice, and does not create a professional relationship.
- Never ask for, and never require, a Social Security number, ITIN, or full financial-account numbers.
- Keep users calm. For urgent levy notices (CP504, LT11/Letter 1058, CP90), clearly flag the time sensitivity and the 30-day hearing window, and recommend professional help.
- Be concise and use short numbered steps. End consequential answers by recommending the user confirm specifics with a licensed Enrolled Agent or CPA.`;

/**
 * Assemble the final system prompt for a turn, injecting any retrieved grounding.
 */
export function buildSystemPrompt(userMessage: string): string {
	const entries = retrieve(userMessage);
	const grounding = buildGroundingBlock(entries);
	if (!grounding) return TAX_SYSTEM_PROMPT;
	return `${TAX_SYSTEM_PROMPT}\n\n--- REFERENCE MATERIAL (cite these Sources) ---\n${grounding}\n--- END REFERENCE MATERIAL ---`;
}
