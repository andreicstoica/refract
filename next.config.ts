import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	// Next.js 15+ uses App Router by default
	// Environment variables for lightningcss
	env: {
		LIGHTNINGCSS_BINARY_TARGET: 'linux-x64-gnu',
	},
};

export default nextConfig;
