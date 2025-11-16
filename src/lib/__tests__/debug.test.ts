import { describe, it, expect, afterEach } from "bun:test";
import { spyOn } from "bun:test";
import { debug } from "@/lib/debug";

const env = process.env as Record<string, string | undefined>;
const originalNodeEnv = env.NODE_ENV;
const originalDebugEnv = env.NEXT_PUBLIC_DEBUG_PRODS;

afterEach(() => {
	env.NODE_ENV = originalNodeEnv;
	if (typeof originalDebugEnv === "string") {
		env.NEXT_PUBLIC_DEBUG_PRODS = originalDebugEnv;
	} else {
		delete env.NEXT_PUBLIC_DEBUG_PRODS;
	}
});

describe("debug logger", () => {
	it("logs dev messages only when NODE_ENV is not production", () => {
		const logSpy = spyOn(console, "log").mockImplementation(() => {});

		env.NODE_ENV = "development";
		debug.dev("dev log");
		expect(logSpy.mock.calls.length).toBe(1);

		logSpy.mockClear();
		env.NODE_ENV = "production";
		debug.dev("hidden");
		expect(logSpy.mock.calls.length).toBe(0);

		logSpy.mockRestore();
	});

	it("logs prod-specific debug only when flag is enabled", () => {
		const logSpy = spyOn(console, "log").mockImplementation(() => {});

		delete env.NEXT_PUBLIC_DEBUG_PRODS;
		debug.prods("silenced");
		expect(logSpy.mock.calls.length).toBe(0);

		env.NEXT_PUBLIC_DEBUG_PRODS = "1";
		debug.prods("visible");
		expect(logSpy.mock.calls.length).toBe(1);

		logSpy.mockRestore();
	});

	it("logs combined dev/prod messages only when both conditions pass", () => {
		const logSpy = spyOn(console, "log").mockImplementation(() => {});

		env.NODE_ENV = "production";
		env.NEXT_PUBLIC_DEBUG_PRODS = "1";
		debug.devProds("blocked");
		expect(logSpy.mock.calls.length).toBe(0);

		env.NODE_ENV = "development";
		debug.devProds("allowed");
		expect(logSpy.mock.calls.length).toBe(1);

		logSpy.mockRestore();
	});

	it("always logs warnings and errors", () => {
		const errorSpy = spyOn(console, "error").mockImplementation(() => {});
		const warnSpy = spyOn(console, "warn").mockImplementation(() => {});

		env.NODE_ENV = "production";
		debug.error("boom");
		debug.warn("caution");

		expect(errorSpy.mock.calls.length).toBe(1);
		expect(warnSpy.mock.calls.length).toBe(1);

		errorSpy.mockRestore();
		warnSpy.mockRestore();
	});
});
