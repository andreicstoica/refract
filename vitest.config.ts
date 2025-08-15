import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
	// Default to a Node environment so tests for utilities run without extra deps.
	// For React component tests, switch to `environment: "jsdom"` and install `jsdom`.
	test: {
		globals: false,
		environment: "node",
		include: [
			"src/**/*.test.{ts,tsx}",
			"src/**/__tests__/**/*.{ts,tsx}",
		],
	},
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
});

