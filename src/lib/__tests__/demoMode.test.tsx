import { describe, it, expect, beforeAll } from "bun:test";
import { mock } from "bun:test";
import React from "react";
import { renderToString } from "react-dom/server";

const pathnameState = { value: "/demo" };

mock.module("next/navigation", () => ({
	usePathname: () => pathnameState.value,
}));

let demoModule: typeof import("@/lib/demoMode");

beforeAll(async () => {
	demoModule = await import("@/lib/demoMode");
});

function renderHookFor(pathname: string): boolean | undefined {
	pathnameState.value = pathname;
	let captured: boolean | undefined;

	function Probe() {
		captured = demoModule.useDemoMode();
		return React.createElement(React.Fragment, null);
	}

	renderToString(React.createElement(Probe));
	return captured;
}

describe("demoMode utilities", () => {
	it("detects demo route via hook", () => {
		expect(renderHookFor("/demo")).toBe(true);
		expect(renderHookFor("/")).toBe(false);
	});

	it("returns eager timing settings in demo mode", () => {
		const demoTiming = demoModule.getTimingConfig(true);
		expect(demoTiming.cooldownMs).toBeLessThan(demoModule.getTimingConfig(false).cooldownMs);
		expect(demoTiming.emoji).toBe("🎬");
	});

	it("exposes populated demo text for sample sessions", () => {
		expect(demoModule.DEMO_TEXT).toContain("Demo in less than two weeks");
	});
});

