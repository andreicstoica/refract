"use client";

import { useChat } from "@ai-sdk/react";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";

export default function ReflectiveMirror() {
	const { messages, sendMessage } = useChat(); // calls /api/chat
	const [input, setInput] = useState("");
	const [chips, setChips] = useState<string[]>([]);
	const scrollRef = useRef<HTMLDivElement>(null);

	// derive the latest user paragraph for chips
	const lastUserBlock = useMemo(() => {
		const lastUser = [...messages].reverse().find((m) => m.role === "user");
		if (!lastUser) return "";
		// collect text parts only
		return (
			lastUser.parts?.map((p) => (p.type === "text" ? p.text : "")).join(" ") ??
			""
		);
	}, [messages]);

	// fetch chips after user sends something new
	useEffect(() => {
		if (!lastUserBlock.trim()) return;

		const ctrl = new AbortController();
		(async () => {
			setChips([]); // reset
			const res = await fetch("/api/prods", {
				method: "POST",
				body: JSON.stringify({ lastParagraph: lastUserBlock }),
				headers: { "Content-Type": "application/json" },
				signal: ctrl.signal,
			});
			const reader = res.body?.getReader();
			if (!reader) return;

			let buffer = "";
			while (true) {
				const { value, done } = await reader.read();
				if (done) break;
				buffer += new TextDecoder().decode(value);
				// split on newlines as they arrive
				const lines = buffer.split("\n");
				// keep last chunk (may be partial)
				buffer = lines.pop() ?? "";
				setChips((prev) => {
					const next = [...prev];
					for (const l of lines) {
						const t = l.trim();
						if (t && !next.includes(t) && next.length < 2) next.push(t);
					}
					return next;
				});
			}
			if (buffer.trim())
				setChips((prev) => (prev.length < 2 ? [...prev, buffer.trim()] : prev));
		})();

		return () => ctrl.abort();
	}, [lastUserBlock]);

	// auto-scroll to bottom as you type
	useEffect(() => {
		scrollRef.current?.scrollTo({
			top: scrollRef.current.scrollHeight,
			behavior: "smooth",
		});
	}, []);

	return (
		<div className="min-h-dvh bg-background text-foreground">
			{/* Content area with top fade */}
			<div
				ref={scrollRef}
				className="mask-top-fade relative mx-auto h-[calc(100dvh-92px)] max-w-2xl overflow-y-auto px-4 pt-16 pb-24"
			>
				{/* flowing text */}
				<div className="relative">
					{messages.map((m) => (
						<div key={m.id} className="mb-6 text-muted-foreground leading-7">
							{m.parts?.map((part, i) =>
								part.type === "text" ? (
									<p
										key={`${m.id}-part-${i}-${part.text?.slice(0, 10)}`}
										className={
											m.role === "user"
												? "text-foreground"
												: "text-muted-foreground"
										}
									>
										{part.text}
									</p>
								) : null,
							)}
						</div>
					))}
				</div>

				{/* right gutter chips (anchored to the last user block visually) */}
				<div className="pointer-events-none absolute inset-0">
					<div className="absolute top-12 right-0 flex flex-col gap-2 md:right-[-4px]">
						<AnimatePresence>
							{chips.map((c, i) => (
								<motion.div
									key={c}
									initial={{ opacity: 0, y: -4, scale: 0.98 }}
									animate={{ opacity: 1, y: 0, scale: 1 }}
									exit={{ opacity: 0, y: -6 }}
									transition={{ duration: 0.18, delay: i * 0.06 }}
									className="pointer-events-auto select-none rounded-full bg-card/70 px-3 py-1.5 text-card-foreground text-xs shadow-sm backdrop-blur"
								>
									{c}
								</motion.div>
							))}
						</AnimatePresence>
					</div>
				</div>
			</div>

			{/* bottom composer */}
			<form
				onSubmit={(e) => {
					e.preventDefault();
					const text = input.trim();
					if (!text) return;
					setInput("");
					sendMessage({ text }); // streams via /api/chat
				}}
				className="fixed inset-x-0 bottom-0 border-border border-t bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75"
			>
				<div className="mx-auto max-w-2xl p-3">
					<textarea
						value={input}
						onChange={(e) => setInput(e.currentTarget.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter" && !e.shiftKey) {
								e.preventDefault();
								const text = input.trim();
								if (!text) return;
								setInput("");
								sendMessage({ text });
							}
						}}
						rows={1}
						placeholder="What's on your mind?"
						className="w-full resize-none rounded-xl bg-muted/80 px-4 py-3 outline-none ring-1 ring-border placeholder:text-muted-foreground/60 focus:ring-ring"
						style={{
							minHeight: "48px",
							maxHeight: "200px",
							height: "auto",
						}}
						onInput={(e) => {
							const target = e.target as HTMLTextAreaElement;
							target.style.height = "auto";
							target.style.height = `${Math.min(target.scrollHeight, 200)}px`;
						}}
					/>
				</div>
			</form>
		</div>
	);
}
