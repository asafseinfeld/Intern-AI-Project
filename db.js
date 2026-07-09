const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

// Railway's filesystem is ephemeral on redeploys unless you attach a Volume.
// For a short internal research project this is usually fine, but if you
// want data to survive redeploys, mount a Railway Volume at /data and
// point DB_PATH there (see README).
const dataDir = path.join(__dirname, "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

const db = new Database(path.join(dataDir, "interviews.db"));

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    contact_name TEXT,
    contact_info TEXT,
    started_at TEXT NOT NULL,
    completed_at TEXT,
    status TEXT NOT NULL DEFAULT 'in_progress', -- in_progress | completed | abandoned
    transcript TEXT NOT NULL DEFAULT '[]',       -- JSON array of {role, content}
    profile TEXT,                                -- JSON structured summary, filled in at the end
    reward_status TEXT NOT NULL DEFAULT 'pending' -- pending | issued
  )
`);

function createSession(id, contactName, contactInfo) {
  db.prepare(
    `INSERT INTO sessions (id, contact_name, contact_info, started_at, transcript)
     VALUES (?, ?, ?, ?, '[]')`
  ).run(id, contactName || null, contactInfo || null, new Date().toISOString());
}

function getSession(id) {
  const row = db.prepare(`SELECT * FROM sessions WHERE id = ?`).get(id);
  if (!row) return null;
  return {
    ...row,
    transcript: JSON.parse(row.transcript || "[]"),
    profile: row.profile ? JSON.parse(row.profile) : null,
  };
}

function saveTranscript(id, transcript) {
  db.prepare(`UPDATE sessions SET transcript = ? WHERE id = ?`).run(
    JSON.stringify(transcript),
    id
  );
}

function completeSession(id, profile) {
  db.prepare(
    `UPDATE sessions SET status = 'completed', completed_at = ?, profile = ? WHERE id = ?`
  ).run(new Date().toISOString(), JSON.stringify(profile), id);
}

function listSessions() {
  const rows = db
    .prepare(`SELECT * FROM sessions ORDER BY started_at DESC`)
    .all();
  return rows.map((row) => ({
    ...row,
    transcript: JSON.parse(row.transcript || "[]"),
    profile: row.profile ? JSON.parse(row.profile) : null,
  }));
}

function setRewardStatus(id, status) {
  db.prepare(`UPDATE sessions SET reward_status = ? WHERE id = ?`).run(
    status,
    id
  );
}

module.exports = {
  createSession,
  getSession,
  saveTranscript,
  completeSession,
  listSessions,
  setRewardStatus,
};
