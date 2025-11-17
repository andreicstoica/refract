import type { Mock } from "bun:test";

type MockFactory = <T extends (...args: any[]) => any>(implementation?: T) => Mock<T>;

declare module "bun:test" {
	export interface Vi {
		fn: MockFactory;
		mock: MockFactory;
		spyOn: typeof import("bun:test").spyOn;
		clearAllMocks(): void;
		resetAllMocks(): void;
		restoreAllMocks(): void;
	}

	// Bun exposes Vitest's `vi` helpers at runtime but the type definitions omit it.
	export const vi: Vi;
}
