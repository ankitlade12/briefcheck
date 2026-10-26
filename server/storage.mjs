import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import {
  scryptSync,
  randomBytes,
  timingSafeEqual,
  createHash,
} from "node:crypto";
export function openStorage(path = ".data/briefcheck.sqlite") {
  if (path !== ":memory:") mkdirSync(".data", { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT UNIQUE NOT NULL, salt TEXT NOT NULL, password TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id), expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS workspaces (id TEXT PRIMARY KEY, owner TEXT REFERENCES users(id), title TEXT NOT NULL, data TEXT NOT NULL, updated TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE IF NOT EXISTS access (workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE, user_id TEXT REFERENCES users(id), role TEXT NOT NULL, PRIMARY KEY(workspace_id,user_id));
    CREATE TABLE IF NOT EXISTS templates (id TEXT PRIMARY KEY, owner TEXT REFERENCES users(id), title TEXT NOT NULL, data TEXT NOT NULL);`);
  return db;
}
export const tokenHash = (s) => createHash("sha256").update(s).digest("hex");
export function passwordHash(password, salt) {
  return scryptSync(password, salt, 64).toString("hex");
}
export function register(db, name, password) {
  if (
    typeof name !== "string" ||
    !/^[a-zA-Z0-9_-]{3,40}$/.test(name) ||
    typeof password !== "string" ||
    password.length < 12 ||
    password.length > 200
  )
    throw new Error(
      "Use a 3–40 character username and a password of 12–200 characters.",
    );
  const id = crypto.randomUUID(),
    salt = randomBytes(16).toString("hex");
  try {
    db.prepare("INSERT INTO users VALUES (?,?,?,?)").run(
      id,
      name.toLowerCase(),
      salt,
      passwordHash(password, salt),
    );
  } catch {
    throw new Error("Username unavailable. Choose another or sign in.");
  }
  return { id, name: name.toLowerCase() };
}
export function login(db, name, password) {
  if (
    typeof name !== "string" ||
    typeof password !== "string" ||
    password.length > 200
  )
    throw new Error("Invalid username or password.");
  const user = db
    .prepare("SELECT * FROM users WHERE name=?")
    .get(name.toLowerCase());
  const derived = passwordHash(
    password,
    user?.salt || "invalid-user-fixed-salt",
  );
  if (
    !user ||
    !timingSafeEqual(
      Buffer.from(derived, "hex"),
      Buffer.from(user.password, "hex"),
    )
  )
    throw new Error("Invalid username or password.");
  return { id: user.id, name: user.name };
}
export function permission(db, id, user) {
  const ws = db.prepare("SELECT * FROM workspaces WHERE id=?").get(id);
  if (!ws || !user) return null;
  const role =
    ws.owner === user.id
      ? "owner"
      : db
          .prepare("SELECT role FROM access WHERE workspace_id=? AND user_id=?")
          .get(id, user.id)?.role;
  return role ? { ws, role } : null;
}

// Saved workspaces are untrusted request data, even when posted by an editor.
export function validateWorkspace(data) {
  if (!data || typeof data.title !== 'string' || !data.title.trim() || data.title.length > 200 || !Array.isArray(data.documents) || data.documents.length > 4 || !Array.isArray(data.runs) || data.runs.length > 100 || !Array.isArray(data.revisions) || data.revisions.length > 500) throw new Error('Invalid workspace structure or history limit exceeded.');
  const validDoc=d=>d && typeof d.id==='string' && typeof d.title==='string' && typeof d.text==='string' && d.text.length<=40000 && ['overview','official rules','FAQ','update','submission checklist','other'].includes(d.role) && d.coverage && typeof d.coverage==='object';
  if(data.documents.some(d=>!validDoc(d)) || data.documents.reduce((n,d)=>n+d.text.length,0)>40000)throw new Error('Invalid source documents in saved workspace.');
  for(const run of data.runs){
    if(!Array.isArray(run.versions)||!Array.isArray(run.requirements)||!Array.isArray(run.findings)||!Array.isArray(run.scenarios)||!Array.isArray(run.coverage)||!Array.isArray(run.errors)||!Array.isArray(run.limitations))throw new Error('Invalid review structure.');
    for(const v of run.versions)if(!validDoc(v)||v.contentHash!==createHash('sha256').update(v.text).digest('hex'))throw new Error('Saved source hash does not match its text.');
    const validEvidence=e=>{const v=run.versions.find(v=>v.versionId===e?.versionId);return v&&Number.isInteger(e.start)&&Number.isInteger(e.end)&&e.start>=0&&e.end>e.start&&e.end<=v.text.length&&v.text.slice(e.start,e.end)===e.quote;};
    for(const r of run.requirements)if(!validEvidence(r.evidence))throw new Error('Saved requirement evidence is invalid.');
    for(const f of run.findings)if(!Array.isArray(f.evidence)||!f.evidence.length||f.evidence.some(e=>!validEvidence(e)))throw new Error('Saved finding evidence is invalid.');
  }
}
