import { describe, it, expect } from "bun:test";
import { cn } from "../utils";

describe("cn", () => {
	it("merges class names and prefers the latter tailwind utility", () => {
		expect(cn("p-2", "p-4")).toBe("p-4");
		expect(cn("bg-red-500", "bg-blue-500")).toBe("bg-blue-500");
	});

	it("keeps non-conflicting classes and ignores falsy values", () => {
		const result = cn("text-red-500", undefined, null, false && "hidden", "font-bold");
		expect(result.includes("text-red-500")).toBe(true);
		expect(result.includes("font-bold")).toBe(true);
	});

	it("handles arrays and conditional objects", () => {
		const result = cn(["p-2", "text-sm"], { hidden: false, block: true }, "md:p-4", "p-3");
		// tailwind-merge prefers the last conflicting utility (p-3 over p-2)
		expect(result.includes("p-3")).toBe(true);
		expect(result.includes("p-2")).toBe(false);
		// keeps non-conflicting classes
		expect(result.includes("text-sm")).toBe(true);
		// includes truthy object key and excludes falsy
		expect(result.includes("block")).toBe(true);
		expect(result.includes("hidden")).toBe(false);
		// preserves responsive variant alongside base
		expect(result.includes("md:p-4")).toBe(true);
	});
});
