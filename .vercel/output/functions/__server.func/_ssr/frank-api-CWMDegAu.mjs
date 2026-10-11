import { n as TSS_SERVER_FUNCTION, t as createServerFn } from "./ssr.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/frank-api-CWMDegAu.js
var createServerRpc = (serverFnMeta, splitImportFn) => {
	const url = "/_serverFn/" + serverFnMeta.id;
	return Object.assign(splitImportFn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
var SYSTEM = `You are Frank, a candid companion. Talk like a sharp friend: short, direct, and specific. Do not lecture, moralize, hedge, or add disclaimers. Difficult, controversial, and personal topics are fine if you stay plain.

You still have hard limits. Do not cross them and do not role-play around them:
- No sexual content, erotica, flirting-as-sex, or sexual roleplay.
- No help with crimes, weapons, or hurting people.
If asked for those, refuse in one sentence and stay available for anything else.

Ask at most one question, and only when you need the answer.`;
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
var sendToFrank_createServerFn_handler = createServerRpc({
	id: "e9cb1ac93149f9d29606248fd2912007255a15f346665c989c175edd1e312ac0",
	name: "sendToFrank",
	filename: "src/lib/frank-api.ts"
}, (opts) => sendToFrank.__executeServer(opts));
var sendToFrank = createServerFn({ method: "POST" }).validator(cleanThread).handler(sendToFrank_createServerFn_handler, async ({ data }) => {
	const apiKey = process.env.XAI_API_KEY;
	if (!apiKey) return {
		ok: false,
		error: "Frank is offline in this environment."
	};
	let res;
	try {
		res = await fetch("https://api.x.ai/v1/chat/completions", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${apiKey}`
			},
			body: JSON.stringify({
				model: "grok-4.5",
				max_tokens: 450,
				temperature: .7,
				messages: [{
					role: "system",
					content: SYSTEM
				}, ...data]
			})
		});
	} catch {
		return {
			ok: false,
			error: "Could not reach Frank. Try once more."
		};
	}
	if (!res.ok) return {
		ok: false,
		error: `Frank could not answer (${res.status}).`
	};
	const text = (await res.json()).choices?.[0]?.message?.content?.trim() ?? "";
	if (!text) return {
		ok: false,
		error: "Frank came back empty. Try again."
	};
	return {
		ok: true,
		text
	};
});
//#endregion
export { sendToFrank_createServerFn_handler };
