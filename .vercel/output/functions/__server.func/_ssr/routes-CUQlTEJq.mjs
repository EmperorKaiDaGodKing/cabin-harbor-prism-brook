import { i as __toESM } from "../_runtime.mjs";
import { U as isRedirect, b as require_jsx_runtime, q as require_react, y as useRouter } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as TSS_SERVER_FUNCTION, r as getServerFnById, t as createServerFn } from "./ssr.mjs";
import { t as cva } from "../_libs/class-variance-authority+clsx.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/frank-CfLastTZ.js
var KEY = "frank.chat.v1";
var MAX_CHARS = 2e3;
function loadThread() {
	try {
		const raw = localStorage.getItem(KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		return parsed.flatMap((item) => {
			if (!item || typeof item !== "object") return [];
			const message = item;
			if (message.role !== "user" && message.role !== "assistant") return [];
			if (typeof message.content !== "string" || !message.content.trim()) return [];
			if (typeof message.id !== "string") return [];
			return [{
				id: message.id,
				role: message.role,
				content: message.content.slice(0, MAX_CHARS),
				at: typeof message.at === "string" ? message.at : (/* @__PURE__ */ new Date()).toISOString()
			}];
		});
	} catch {
		return [];
	}
}
function saveThread(messages) {
	localStorage.setItem(KEY, JSON.stringify(messages.slice(-80)));
}
function newMessage(role, content) {
	return {
		id: crypto.randomUUID(),
		role,
		content,
		at: (/* @__PURE__ */ new Date()).toISOString()
	};
}
//#endregion
//#region node_modules/.nitro/vite/services/ssr/assets/routes-CUQlTEJq.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function useServerFn(serverFn) {
	const router = useRouter();
	return import_react.useCallback(async (...args) => {
		try {
			const res = await serverFn(...args);
			if (isRedirect(res)) throw res;
			return res;
		} catch (err) {
			if (isRedirect(err)) {
				err.options._fromLocation = router.stores.location.get();
				return router.navigate(router.resolveRedirect(err).options);
			}
			throw err;
		}
	}, [router, serverFn]);
}
var buttonStyles = cva("inline-flex h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-40", {
	variants: { intent: {
		primary: "bg-sienna text-on-sienna hover:bg-ink",
		quiet: "border border-line bg-sheet text-ink hover:border-ink",
		danger: "bg-ink text-on-sienna hover:bg-sienna"
	} },
	defaultVariants: { intent: "primary" }
});
function Button({ intent, className, type = "button", ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		type,
		className: [buttonStyles({ intent }), className].filter(Boolean).join(" "),
		...props
	});
}
var createSsrRpc = (functionId) => {
	const url = "/_serverFn/" + functionId;
	const serverFnMeta = { id: functionId };
	const fn = async (...args) => {
		return (await getServerFnById(functionId, { origin: "server" }))(...args);
	};
	return Object.assign(fn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
function cleanThread(input) {
	if (!input || typeof input !== "object" || !Array.isArray(input.messages)) throw new Error("Send a message first.");
	const raw = input.messages;
	if (raw.length === 0 || raw.length > 16) throw new Error("That thread is too long. Clear it and start again.");
	return raw.map((item) => {
		if (!item || typeof item !== "object") throw new Error("Bad message.");
		const turn = item;
		if (turn.role !== "user" && turn.role !== "assistant") throw new Error("Bad message.");
		if (typeof turn.content !== "string") throw new Error("Bad message.");
		const content = turn.content.trim();
		if (!content || content.length > 2e3) throw new Error("Keep each message under 2000 characters.");
		return {
			role: turn.role,
			content
		};
	});
}
var sendToFrank = createServerFn({ method: "POST" }).validator(cleanThread).handler(createSsrRpc("e9cb1ac93149f9d29606248fd2912007255a15f346665c989c175edd1e312ac0"));
var fieldClass = "w-full resize-none rounded-lg border border-line bg-paper px-3 py-3 text-base text-ink outline-none placeholder:text-muted focus:border-sienna";
function Home() {
	const [messages, setMessages] = (0, import_react.useState)([]);
	const [ready, setReady] = (0, import_react.useState)(false);
	const [draft, setDraft] = (0, import_react.useState)("");
	const [pending, setPending] = (0, import_react.useState)(false);
	const [error, setError] = (0, import_react.useState)("");
	const [confirmClear, setConfirmClear] = (0, import_react.useState)(false);
	const sendToFrank$1 = useServerFn(sendToFrank);
	const scroller = (0, import_react.useRef)(null);
	const box = (0, import_react.useRef)(null);
	(0, import_react.useEffect)(() => {
		setMessages(loadThread());
		setReady(true);
	}, []);
	(0, import_react.useEffect)(() => {
		if (!ready) return;
		saveThread(messages);
	}, [messages, ready]);
	(0, import_react.useEffect)(() => {
		const node = scroller.current;
		if (!node) return;
		node.scrollTop = node.scrollHeight;
	}, [
		messages,
		pending,
		ready
	]);
	async function send() {
		const text = draft.trim();
		if (!text || pending) return;
		if (text.length > 2e3) {
			setError("Keep it under 2000 characters.");
			return;
		}
		const next = [...messages, newMessage("user", text)].slice(-16);
		setMessages(next);
		setDraft("");
		setError("");
		setConfirmClear(false);
		setPending(true);
		try {
			const result = await sendToFrank$1({ data: { messages: next.map((message) => ({
				role: message.role,
				content: message.content
			})) } });
			if (!result.ok) {
				setError(result.error);
				return;
			}
			setMessages((current) => [...current, newMessage("assistant", result.text)].slice(-80));
		} catch {
			setError("Could not send that. Try once more.");
		} finally {
			setPending(false);
			box.current?.focus();
		}
	}
	function clearChat() {
		setMessages([]);
		setError("");
		setConfirmClear(false);
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "mx-auto flex h-dvh w-full max-w-2xl flex-col px-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "flex items-start justify-between gap-3 border-b border-line py-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "size-3 bg-sienna",
						"aria-hidden": "true"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						className: "font-display text-3xl leading-none text-ink",
						children: "Frank"
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-sm text-muted",
					children: "Plain talk. Not a sex chat, and not a how-to for hurting anyone."
				})] }), confirmClear ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					intent: "danger",
					onClick: clearChat,
					children: "Clear it"
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					intent: "quiet",
					onClick: () => setConfirmClear(true),
					disabled: messages.length === 0,
					children: "Clear"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				ref: scroller,
				className: "min-h-0 flex-1 space-y-3 overflow-y-auto py-4",
				children: [!ready ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-muted",
					children: "Opening the chat…"
				}) : messages.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Intro, {}) : messages.map((message) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bubble, { message }, message.id)), pending ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-muted",
					children: "Frank is thinking."
				}) : null]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				className: "border-t border-line py-3",
				onSubmit: (event) => {
					event.preventDefault();
					send();
				},
				children: [
					error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mb-2 text-sm text-sienna",
						role: "status",
						children: error
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "block",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "sr-only",
							children: "Message Frank"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
							ref: box,
							className: fieldClass,
							rows: 2,
							value: draft,
							placeholder: "Say it plain.",
							maxLength: MAX_CHARS,
							onChange: (event) => setDraft(event.target.value),
							onKeyDown: (event) => {
								if (event.key === "Enter" && !event.shiftKey) {
									event.preventDefault();
									send();
								}
							}
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-2 flex items-center justify-between gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs text-muted",
							children: "Enter sends. Shift+Enter starts a new line."
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "submit",
							disabled: pending || draft.trim().length === 0,
							children: "Send"
						})]
					})
				]
			})
		]
	});
}
function Intro() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-xl border border-line bg-sheet px-4 py-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs font-semibold uppercase tracking-widest text-muted",
				children: "Companion"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 font-display text-3xl leading-tight text-ink",
				children: "Talk straight."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-3 text-base text-muted",
				children: "Frank answers like a friend: short, direct, no lecture. Sex and harm stay off the table. The chat stays on this device."
			})
		]
	});
}
function Bubble({ message }) {
	const mine = message.role === "user";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: mine ? "flex justify-end" : "flex justify-start",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "max-w-[85%] whitespace-pre-wrap rounded-xl px-3 py-3 text-base " + (mine ? "bg-ink text-on-sienna" : "border border-line bg-sheet text-ink"),
			children: message.content
		})
	});
}
//#endregion
export { Home as component };
