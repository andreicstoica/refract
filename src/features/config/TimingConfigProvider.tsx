"use client";

import { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { getTimingConfig } from "@/lib/demoMode";

interface TimingConfigContextValue {
	isDemoMode: boolean;
	config: ReturnType<typeof getTimingConfig>;
}

const TimingConfigContext = createContext<TimingConfigContextValue | undefined>(undefined);

export function TimingConfigProvider({ children }: { children: ReactNode }) {
	const pathname = usePathname();
	const isDemoMode = pathname === "/demo";
	const config = useMemo(() => getTimingConfig(isDemoMode), [isDemoMode]);

	const value = useMemo(
		() => ({
			isDemoMode,
			config
		}),
		[isDemoMode, config]
	);

	return <TimingConfigContext.Provider value={value}>{children}</TimingConfigContext.Provider>;
}

export function useTimingConfig(): TimingConfigContextValue {
	const context = useContext(TimingConfigContext);

	if (!context) {
		throw new Error("useTimingConfig must be used within a TimingConfigProvider");
	}

	return context;
}
