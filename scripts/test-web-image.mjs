import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { setTimeout } from "node:timers/promises";

const baseUrl = "http://localhost:3000";
const cookies = new Map();

async function request(path, body) {
	const response = await fetch(`${baseUrl}${path}`, {
		method: body === undefined ? "GET" : "POST",
		signal: AbortSignal.timeout(15000),
		headers: {
			"Content-Type": "application/json",
			Origin: baseUrl,
			Cookie: [...cookies]
				.map(([name, value]) => `${name}=${value}`)
				.join("; "),
		},
		body: body === undefined ? undefined : JSON.stringify(body),
	});
	const text = await response.text();
	assert.ok(response.ok, `${path}: ${response.status} ${text}`);
	for (const header of response.headers.getSetCookie()) {
		const value = header.split(";")[0];
		const split = value.indexOf("=");
		cookies.set(value.slice(0, split), value.slice(split + 1));
	}
	return JSON.parse(text);
}

async function rpc(path, input, mutation = false) {
	const payload = { json: input ?? null };
	const url = mutation
		? path
		: `${path}?input=${encodeURIComponent(JSON.stringify(payload))}`;
	const response = await request(
		`/api/trpc/${url}`,
		mutation ? payload : undefined,
	);
	assert.ok(response.result, JSON.stringify(response));
	return response.result.data.json;
}

for (let attempt = 0; attempt < 60; attempt++) {
	try {
		await request("/api/auth/get-session");
		break;
	} catch (error) {
		if (attempt === 59) throw error;
		await setTimeout(1000);
	}
}

const email = "image-test@example.test";
const password = randomBytes(24).toString("hex");
await request("/api/auth/sign-up/email", {
	email,
	password,
	name: "Image Test",
});
cookies.clear();
await request("/api/auth/sign-in/email", { email, password });
const session = await request("/api/auth/get-session");
assert.equal(session.user.email, email);

const created = await rpc(
	"workspace.create",
	{
		name: "Image Test",
		slug: "image-test",
		domain: "example.test",
	},
	true,
);
const workspaceId = created.workspace.id;
assert.ok(workspaceId);
const workspaces = await rpc("workspace.listAllForUser");
assert.ok(JSON.stringify(workspaces).includes(workspaceId));

const prompts = ["Which brands offer image testing?"];
await rpc("prompt.store", { workspaceId, prompts }, true);
const stored = await rpc("prompt.fetchUserPrompts", { workspaceId });
assert.ok(stored.some((prompt) => prompt.prompt === prompts[0]));
await rpc(
	"workspace.setSchedule",
	{ workspaceId, schedule: "0 0 1 1 *" },
	true,
);
assert.equal(
	(await rpc("workspace.getSchedule", { workspaceId })).schedule,
	"0 0 1 1 *",
);
await rpc("workspace.setSchedule", { workspaceId, schedule: null }, true);
assert.equal(
	(await rpc("workspace.getSchedule", { workspaceId })).schedule,
	null,
);
const status = await rpc("agent.status", { workspaceId, jobId: "image-test" });
assert.equal(status.status, "pending");
await request("/api/providers");

for (const route of ["/", "/providers", "/workspace/new"]) {
	const response = await fetch(`${baseUrl}${route}`, {
		headers: {
			Cookie: [...cookies]
				.map(([name, value]) => `${name}=${value}`)
				.join("; "),
		},
	});
	assert.ok(response.ok, `${route}: ${response.status}`);
	assert.match(await response.text(), /<html/);
}
console.log(
	"Web signup, signin, workspace, prompts, scheduling, Redis status, providers, and pages passed",
);
