// Augment bun:test types for editor ergonomics in tests
declare module "bun:test" {
	// Vitest-compatible mock utility used in some tests.
	// Bun's runtime does not currently export `vi`; this is for type relief only.
	export const vi: any;
}

