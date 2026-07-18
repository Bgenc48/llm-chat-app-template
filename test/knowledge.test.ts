import { describe, it, expect } from "vitest";
import {
	retrieve,
	extractNoticeCodes,
	scanForPII,
	buildSystemPrompt,
	composeReply,
} from "../src/knowledge";

describe("notice code extraction", () => {
	it("finds CP and LT codes with or without spaces", () => {
		expect(extractNoticeCodes("What is a CP2000?")).toContain("cp2000");
		expect(extractNoticeCodes("cp 14 arrived")).toContain("cp14");
		expect(extractNoticeCodes("I got an LT11 today")).toContain("lt11");
	});
	it("finds letter numbers", () => {
		expect(extractNoticeCodes("received Letter 1058")).toContain("letter1058");
	});
});

describe("retrieval", () => {
	it("routes a CP2000 question to the CP2000 entry", () => {
		expect(retrieve("What does a CP2000 notice mean?")[0].id).toBe("cp2000");
	});
	it("routes an LT11 question to the urgent levy entry", () => {
		const top = retrieve("I got an LT11 — how urgent?")[0];
		expect(top.id).toBe("lt11");
		expect(top.urgency).toBe("urgent");
	});
	it("routes 'can't pay' to a resolution option", () => {
		const ids = retrieve("I can't pay my tax bill").map((e) => e.id);
		expect(ids).toContain("installment-agreement");
	});
	it("routes unfiled-returns questions correctly", () => {
		const ids = retrieve("I haven't filed for several years").map((e) => e.id);
		expect(ids).toContain("unfiled-returns");
	});
	it("returns nothing for clearly out-of-scope questions", () => {
		expect(retrieve("what is the best pizza in Chicago").length).toBe(0);
	});
});

describe("PII guard", () => {
	it("blocks a dashed SSN", () => {
		expect(scanForPII("my ssn is 123-45-6789").blocked).toBe(true);
	});
	it("blocks a 9-digit SSN when context says so", () => {
		expect(scanForPII("social security 123456789").blocked).toBe(true);
	});
	it("does NOT block an ordinary notice question", () => {
		expect(scanForPII("I received a CP2000 for 2023").blocked).toBe(false);
	});
	it("does NOT block a tax year like 2023", () => {
		expect(scanForPII("this was for tax year 2023").blocked).toBe(false);
	});
});

describe("system prompt grounding", () => {
	it("injects reference material + citations when a topic hits", () => {
		const p = buildSystemPrompt("What does a CP2000 mean?");
		// "END REFERENCE MATERIAL" only appears when a grounding block is injected
		// (the base prompt mentions the phrase "REFERENCE MATERIAL" in its rules).
		expect(p).toContain("END REFERENCE MATERIAL");
		expect(p).toContain("irs.gov");
	});
	it("stays scoped (no reference block) when nothing matches", () => {
		const p = buildSystemPrompt("recommend a good movie");
		expect(p).not.toContain("END REFERENCE MATERIAL");
	});
});

describe("deterministic notice cards", () => {
	it("returns a formatted, cited card for a recognized notice code", () => {
		const md = composeReply("What does a CP2000 mean?");
		expect(md).not.toBeNull();
		expect(md).toContain("**"); // markdown formatting
		expect(md).toContain("Sources");
		expect(md).toContain("irs.gov");
	});
	it("flags an urgent levy notice with the time-sensitive badge", () => {
		expect(composeReply("I got an LT11")).toContain("Time-sensitive");
	});
	it("cards a 'can't pay' resolution question", () => {
		expect(composeReply("I can't pay my tax bill")).toContain("Payment Plan");
	});
	it("returns null (defer to model) for a vague/off-topic message", () => {
		expect(composeReply("hello there")).toBeNull();
	});
});
