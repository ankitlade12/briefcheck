import assert from "node:assert/strict";
const base = "http://127.0.0.1:5173";
async function call(path, body, cookie = "", method = body ? "POST" : "GET") {
  const r = await fetch(base + "/api" + path, {
    method,
    headers: {
      Origin: base,
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return {
    status: r.status,
    data: await r.json(),
    cookie: r.headers.get("set-cookie")?.split(";")[0],
  };
}
const suffix = Date.now().toString(36),
  password = "Testing-only-password-123!";
const owner = await call("/auth", {
    action: "register",
    name: "owner_" + suffix,
    password,
  }),
  reviewer = await call("/auth", {
    action: "register",
    name: "reviewer_" + suffix,
    password,
  }),
  outsider = await call("/auth", {
    action: "register",
    name: "outsider_" + suffix,
    password,
  });
assert.equal(owner.status, 200);
const docs = [
  {
    id: "a",
    title: "Overview",
    role: "overview",
    text: "Demo video must be at most 3 minutes.",
    coverage: {},
  },
  {
    id: "b",
    title: "Rules",
    role: "official rules",
    text: "Demo video must be under 3 minutes.",
    coverage: {},
  },
];
const run = await call("/reviews", { documents: docs, mode: "deterministic" });
assert.equal(run.status, 200);
assert.equal(run.data.findings.length, 1);
const saved = await call(
  "/workspaces",
  { title: "API test", documents: docs, runs: [run.data], revisions: [] },
  owner.cookie,
);
assert.equal(saved.status, 200);
const id = saved.data.id;
assert.equal(
  (await call("/workspaces/" + id, undefined, outsider.cookie)).status,
  403,
);
assert.equal(
  (
    await call(
      `/workspaces/${id}/access`,
      { name: "reviewer_" + suffix, role: "reviewer" },
      owner.cookie,
    )
  ).status,
  200,
);
assert.equal(
  (await call("/workspaces/" + id, undefined, reviewer.cookie)).data.role,
  "reviewer",
);
assert.equal(
  (
    await call(
      "/workspaces/" + id,
      { title: "overwrite", revision: 1 },
      reviewer.cookie,
      "PUT",
    )
  ).status,
  403,
);
const decision = await call(
  `/workspaces/${id}/decisions`,
  {
    runId: run.data.id,
    findingId: run.data.findings[0].id,
    status: "dismissed",
    reason: "Intentional difference",
  },
  reviewer.cookie,
);
assert.equal(decision.status, 200);
assert.equal(
  (
    await call(
      "/workspaces/" + id,
      { title: "stale overwrite", revision: 1 },
      owner.cookie,
      "PUT",
    )
  ).status,
  409,
);
assert.equal(
  (
    await call(
      `/workspaces/${id}/access`,
      { name: "reviewer_" + suffix, role: "remove" },
      owner.cookie,
    )
  ).status,
  200,
);
assert.equal(
  (await call("/workspaces/" + id, undefined, reviewer.cookie)).status,
  403,
);
const noOrigin = await fetch(base + "/api/reviews", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ documents: docs }),
});
assert.equal(noOrigin.status, 403);
assert.equal(
  (await call("/reviews", { documents: docs, mode: "ai" })).status,
  400,
);
assert.equal(
  (await call("/import/url", { url: "https://127.0.0.1/" })).status,
  400,
);
assert.equal(
  (await call("/workspaces/" + id, undefined, owner.cookie, "DELETE")).status,
  200,
);
assert.equal(
  (await call("/workspaces/" + id, undefined, owner.cookie)).status,
  403,
);
console.log(
  "API flow passed: anonymous review, accounts, persistence, reviewer decisions, editor restrictions, access revocation, optimistic concurrency, CSRF, unavailable AI, SSRF, deletion.",
);
