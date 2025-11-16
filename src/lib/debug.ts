/**
 * Debug utilities for development logging
 */

const isDevEnv = () => typeof process !== "undefined" && process.env.NODE_ENV !== "production";
const isDebugProdsEnabled = () => typeof process !== 'undefined' && process.env.NEXT_PUBLIC_DEBUG_PRODS === '1';

export const debug = {
    /**
     * Log only in development mode
     */
    dev: (message: string, ...args: any[]) => {
        if (isDevEnv()) {
            console.log(message, ...args);
        }
    },

    /**
     * Log only when DEBUG_PRODS is enabled
     */
    prods: (message: string, ...args: any[]) => {
        if (isDebugProdsEnabled()) {
            console.log(message, ...args);
        }
    },

    /**
     * Log in development mode when DEBUG_PRODS is enabled
     */
    devProds: (message: string, ...args: any[]) => {
        if (isDevEnv() && isDebugProdsEnabled()) {
            console.log(message, ...args);
        }
    },

    /**
     * Log errors (always enabled)
     */
    error: (message: string, ...args: any[]) => {
        console.error(message, ...args);
    },

    /**
     * Log warnings (always enabled)
     */
    warn: (message: string, ...args: any[]) => {
        console.warn(message, ...args);
    },
};
