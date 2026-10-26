import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import { readFile } from "node:fs/promises";
import { integrationDestinations, exportToGitHub } from "./integrations.mjs";
import { analyze, aiConfiguration } from "./analysis.mjs";
import { importURL, importPDF, publicRequest } from "./imports.mjs";
import {
  openStorage,
  register,
  login,
  permission,
  tokenHash,
  validateWorkspace,
} from "./storage.mjs";
import {
  validateDocuments,
  validatePredicate,
  outcome,
} from "../src/engine.mjs";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);
const db = openStorage(process.env.BRIEFCHECK_DB || ".data/briefcheck.sqlite");
const PORT = Number(process.env.PORT || 5173);
const allowedHosts = new Set(
  ["127.0.0.1", "localhost", process.env.BRIEFCHECK_HOSTNAME].filter(Boolean),
);
const rates = new Map();
let active = 0,
  aiRuns = 0;
function rate(key, limit) {
  const now = Date.now();
  for (const [k, v] of rates) if (v.until < now) rates.delete(k);
  const entry = rates.get(key) || { n: 0, until: now + 60000 };
  rates.set(key, entry);
  if (++entry.n > limit)
    throw Object.assign(
      new Error("Too many requests. Try again in a minute."),
      { status: 429 },
    );
}
function userOf(req) {
  const token = req.headers.cookie?.match(
    /(?:^|;\s*)briefcheck_session=([^;]+)/,
  )?.[1];
  if (!token) return null;
  return (
    db
      .prepare(
        "SELECT users.id,users.name FROM sessions JOIN users ON users.id=sessions.user_id WHERE token=? AND expires>?",
      )
      .get(tokenHash(token), Date.now()) || null
  );
}
function send(res, status, value, headers = {}) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...headers,
  });
  res.end(JSON.stringify(value));
}
async function body(req, limit = 5_000_000) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit)
      throw Object.assign(new Error("Request is too large."), { status: 413 });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
async function json(req, limit) {
  try {
    return JSON.parse((await body(req, limit)).toString());
  } catch (e) {
    if (e.status) throw e;
    throw new Error("Request must contain valid JSON.");
  }
}
function authorized(req, id, roles = ["owner", "editor", "reviewer"]) {
  const access = permission(db, id, userOf(req));
  if (!access || !roles.includes(access.role))
    throw Object.assign(
      new Error("Workspace not found or access not permitted."),
      { status: 403 },
    );
  return access;
}
function needUser(req) {
  const user = userOf(req);
  if (!user)
    throw Object.assign(new Error("Sign in to save or share a workspace."), {
      status: 401,
    });
  return user;
}
const server = createServer(async (req, res) => {
  const host = (req.headers.host || "").split(":")[0];
  if (!allowedHosts.has(host))
    return send(res, 403, { error: "Host is not allowed." });
  const url = new URL(req.url, `http://${req.headers.host}`),
    path = url.pathname;
  if (!path.startsWith("/api/")) return staticHandler(req, res);
  try {
    if (req.method !== "GET") {
      const origin = req.headers.origin;
      if (!origin || new URL(origin).host !== req.headers.host)
        throw Object.assign(new Error("Same-origin requests are required."), {
          status: 403,
        });
    }
    const user = userOf(req);
    rate(req.socket.remoteAddress + ":general", 120);
    if (path === "/api/config" && req.method === "GET")
      return send(res, 200, {
        aiEnabled: aiConfiguration().enabled,
        model: aiConfiguration().model,
        user,
        integrations: integrationDestinations(),
      });
    if (path === "/api/auth" && req.method === "POST") {
      rate(req.socket.remoteAddress + ":auth", 10);
      const b = await json(req, 5000);
      const account =
        b.action === "register"
          ? register(db, b.name, b.password)
          : login(db, b.name, b.password);
      const token = randomBytes(32).toString("hex");
      db.prepare("DELETE FROM sessions WHERE expires<?").run(Date.now());
      db.prepare("INSERT INTO sessions VALUES (?,?,?)").run(
        tokenHash(token),
        account.id,
        Date.now() + 86400000,
      );
      return send(
        res,
        200,
        { user: account },
        {
          "Set-Cookie": `briefcheck_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400${process.env.BRIEFCHECK_SECURE_COOKIE === "true" ? "; Secure" : ""}`,
        },
      );
    }
    if (path === "/api/logout" && req.method === "POST") {
      const token = req.headers.cookie?.match(
        /briefcheck_session=([^;]+)/,
      )?.[1];
      if (token)
        db.prepare("DELETE FROM sessions WHERE token=?").run(tokenHash(token));
      return send(
        res,
        200,
        { ok: true },
        {
          "Set-Cookie":
            "briefcheck_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0",
        },
      );
    }
    if (
      ["/api/reviews", "/api/reviews/recheck"].includes(path) &&
      req.method === "POST"
    ) {
      rate((user?.id || req.socket.remoteAddress) + ":review", 10);
      const b = await json(req, 200000);
      validateDocuments(b.documents);
      if (active >= 2)
        throw Object.assign(
          new Error("Two reviews are already running. Retry shortly."),
          { status: 429 },
        );
      if (
        b.mode === "ai" &&
        aiRuns >= Number(process.env.BRIEFCHECK_MAX_AI_REVIEWS || 30)
      )
        throw Object.assign(
          new Error(
            "The configured AI review allowance is exhausted. Deterministic review remains available.",
          ),
          { status: 429 },
        );
      active++;
      if (b.mode === "ai") aiRuns++;
      try {
        return send(res, 200, await analyze(b.documents, b.mode));
      } finally {
        active--;
      }
    }
    if (path === "/api/scenarios/evaluate" && req.method === "POST") {
      const b = await json(req, 20000);
      if (
        !Array.isArray(b.requirements) ||
        b.requirements.length > 100 ||
        !b.facts ||
        typeof b.facts !== "object" ||
        b.requirements.some((r) => !validatePredicate(r.predicate))
      )
        throw new Error("Use validated predicates and typed facts.");
      return send(res, 200, {
        outcomes: b.requirements.map((r) => ({
          id: r.id,
          result: outcome(r, b.facts),
        })),
      });
    }
    if (path === "/api/import/url" && req.method === "POST") {
      rate(req.socket.remoteAddress + ":import", 6);
      const b = await json(req, 5000);
      return send(res, 200, await importURL(b.url));
    }
    if (path === "/api/import/pdf" && req.method === "POST") {
      rate(req.socket.remoteAddress + ":import", 6);
      return send(
        res,
        200,
        await importPDF(
          await body(req, 2_000_000),
          decodeURIComponent(req.headers["x-file-name"] || "Imported PDF"),
        ),
      );
    }
    if (path === "/api/workspaces" && req.method === "GET") {
      const u = needUser(req);
      return send(
        res,
        200,
        db
          .prepare(
            "SELECT DISTINCT w.id,w.title,w.updated,w.revision,CASE WHEN w.owner=? THEN 'owner' ELSE a.role END as role FROM workspaces w LEFT JOIN access a ON w.id=a.workspace_id WHERE w.owner=? OR a.user_id=? ORDER BY w.updated DESC",
          )
          .all(u.id, u.id, u.id),
      );
    }
    if (path === "/api/workspaces" && req.method === "POST") {
      const u = needUser(req),
        b = await json(req);
      if (
        typeof b.title !== "string" ||
        !b.title.trim() ||
        b.title.length > 200
      )
        throw new Error("Workspace needs a title.");
      validateWorkspace(b);
      const id = crypto.randomUUID();
      db.prepare(
        "INSERT INTO workspaces(id,owner,title,data,updated) VALUES(?,?,?,?,?)",
      ).run(id, u.id, b.title, JSON.stringify(b), new Date().toISOString());
      return send(res, 200, { id, revision: 1, role: "owner" });
    }
    const wsMatch = path.match(
      /^\/api\/workspaces\/([a-f0-9-]+)(?:\/(access|decisions|clarifications))?$/,
    );
    if (wsMatch) {
      const [, id, action] = wsMatch;
      if (req.method === "GET" && !action) {
        const a = authorized(req, id);
        return send(res, 200, {
          ...JSON.parse(a.ws.data),
          id,
          revision: a.ws.revision,
          role: a.role,
        });
      }
      if (req.method === "DELETE" && !action) {
        authorized(req, id, ["owner"]);
        db.prepare("DELETE FROM workspaces WHERE id=?").run(id);
        return send(res, 200, { ok: true });
      }
      if (req.method === "PUT" && !action) {
        const b = await json(req);
        const a = authorized(req, id, ["owner", "editor"]);
        if (b.revision !== a.ws.revision)
          throw Object.assign(
            new Error(
              "Another reviewer saved changes. Reopen the workspace before saving; your local copy is preserved.",
            ),
            { status: 409 },
          );
        if (
          typeof b.title !== "string" ||
          !b.title.trim() ||
          b.title.length > 200
        )
          throw new Error("Invalid title.");
        validateWorkspace(b);
        db.prepare(
          "UPDATE workspaces SET title=?,data=?,updated=?,revision=revision+1 WHERE id=? AND revision=?",
        ).run(b.title, JSON.stringify(b), new Date().toISOString(), id, b.revision);
        return send(res, 200, {
          id,
          revision: a.ws.revision + 1,
          role: a.role,
        });
      }
      if (action === "access" && req.method === "POST") {
        const b = await json(req, 5000);
        authorized(req, id, ["owner"]);
        if (!["editor", "reviewer", "remove"].includes(b.role))
          throw new Error("Choose editor or reviewer.");
        const target = db
          .prepare("SELECT id FROM users WHERE name=?")
          .get(String(b.name).toLowerCase());
        if (!target)
          throw new Error("That user must register on this server first.");
        if (b.role === "remove")
          db.prepare(
            "DELETE FROM access WHERE workspace_id=? AND user_id=?",
          ).run(id, target.id);
        else
          db.prepare("INSERT OR REPLACE INTO access VALUES(?,?,?)").run(
            id,
            target.id,
            b.role,
          );
        return send(res, 200, { ok: true });
      }
      if (action === "decisions" && req.method === "POST") {
        const b = await json(req, 10000);
        const a = authorized(req, id), data = JSON.parse(a.ws.data);
        if (b.revision !== undefined && b.revision !== a.ws.revision) throw Object.assign(new Error('The shared workspace changed. Reopen it before recording this decision; your local work is preserved.'),{status:409});
        const run = data.runs?.find((r) => r.id === b.runId);
        if (
          !run?.findings.some((f) => f.id === b.findingId) ||
          !["accepted", "dismissed", "deferred", "open"].includes(b.status) ||
          typeof b.reason !== "string" ||
          b.reason.length > 2000 ||
          (b.status === "dismissed" && !b.reason.trim())
        )
          throw new Error(
            "A valid finding, decision and dismissal reason are required.",
          );
        run.decisions ??= {};
        run.decisions[b.findingId] = {
          status: b.status,
          reason: b.reason,
          reviewer: user.name,
          at: new Date().toISOString(),
        };
        db.prepare(
          "UPDATE workspaces SET data=?,updated=?,revision=revision+1 WHERE id=?",
        ).run(JSON.stringify(data), new Date().toISOString(), id);
        return send(res, 200, {
          revision: a.ws.revision + 1,
          decision: run.decisions[b.findingId],
        });
      }
    }
    if (path === "/api/templates" && req.method === "GET") {
      const u = needUser(req);
      return send(
        res,
        200,
        db
          .prepare("SELECT id,title,data FROM templates WHERE owner=?")
          .all(u.id)
          .map((t) => ({ ...t, data: JSON.parse(t.data) })),
      );
    }
    if (path === "/api/templates" && req.method === "POST") {
      const u = needUser(req),
        b = await json(req, 200000);
      validateDocuments(b.documents);
      if (typeof b.title !== "string" || !b.title.trim())
        throw new Error("Template title is required.");
      const id = crypto.randomUUID();
      db.prepare("INSERT INTO templates VALUES(?,?,?,?)").run(
        id,
        u.id,
        b.title.slice(0, 200),
        JSON.stringify(b.documents),
      );
      return send(res, 200, { id });
    }
    if (path === "/api/integrations/export" && req.method === "POST") {
      needUser(req);
      rate(user.id + ":webhook", 3);
      if (!integrationDestinations().length)
        throw new Error("No integration destination is configured.");
      const b = await json(req);
      if (b.confirm !== true)
        throw new Error("Explicit export confirmation is required.");
      if(process.env.BRIEFCHECK_GITHUB_REPO) return send(res,200,{ok:true,...await exportToGitHub(b.report,req.socket.remoteAddress)});
      await publicRequest(process.env.BRIEFCHECK_WEBHOOK_URL, {
        method: "POST",
        body: JSON.stringify(b.report),
        headers: {
          "Content-Type": "application/json",
          ...(process.env.BRIEFCHECK_WEBHOOK_TOKEN
            ? {
                Authorization: `Bearer ${process.env.BRIEFCHECK_WEBHOOK_TOKEN}`,
              }
            : {}),
        },
      });
      return send(res, 200, { ok: true });
    }
    send(res, 404, { error: "Endpoint not found." });
  } catch (error) {
    send(res, error.status || 400, {
      error: error.message || "Request failed.",
    });
  }
});
let staticHandler;
if (process.env.NODE_ENV === "production") {
  staticHandler = async (req, res) => {
    try {
      const pathname = new URL(req.url, "http://localhost").pathname;
      const relative =
        pathname === "/"
          ? "index.html"
          : decodeURIComponent(pathname).replace(/^\/+/, "");
      const path = resolve(root, "dist", relative);
      if (!path.startsWith(resolve(root, "dist") + "/")) {
        res.writeHead(403);
        res.end();
        return;
      }
      const data = await readFile(path);
      const ext = path.split(".").pop();
      res.writeHead(200, {
        "Content-Type":
          {
            html: "text/html",
            js: "text/javascript",
            css: "text/css",
            svg: "image/svg+xml",
          }[ext] || "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  };
} else {
  const { createServer: createViteServer } = await import("vite");
  const vite = await createViteServer({
    root,
    server: { middlewareMode: true, hmr: { server } },
    appType: "spa",
  });
  staticHandler = (req, res) => vite.middlewares(req, res);
}
server.requestTimeout = 20000;
server.listen(PORT, process.env.BRIEFCHECK_BIND || "127.0.0.1", () =>
  console.log(`BriefCheck: http://127.0.0.1:${PORT}`),
);
