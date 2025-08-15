import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";

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
});

