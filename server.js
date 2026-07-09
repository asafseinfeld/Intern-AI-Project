require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { nanoid } = require("nanoid");
const path = require("path");

const db = require("./db");
const { nextInterviewerTurn, extractProfile } = require("./interviewer");

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

// ---------- Employee-facing interview endpoints ----------

// Start a new interview session. Contact info is stored ONLY for reward
// distribution - it is never shown alongside answers to the employee, and
// only appears to admins on the dashboard.
app.post("/api/session/start", async (req, res) => {
  try {
    const { name, contact } = req.body || {};
    const id = nanoid(12);
    db.createSession(id, name, contact);

    const transcript = []; // no assistant turn yet
    const { spokenText, isComplete } = await nextInterviewerTurn([
      {
        role: "user",
        content:
          "(The interview is starting now. Greet the employee and ask your first question.)",
      },
    ]);

    transcript.push({ role: "user", content: "(session start)" });
    transcript.push({ role: "assistant", content: spokenText });
    db.saveTranscript(id, transcript);

    res.json({ sessionId: id, reply: spokenText, isComplete });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to start session." });
  }
});

// Send what the employee said (already transcribed by the browser), get the
// interviewer's next spoken reply.
app.post("/api/session/message", async (req, res) => {
  try {
    const { sessionId, message } = req.body || {};
    const session = db.getSession(sessionId);
    if (!session) return res.status(404).json({ error: "Session not found." });
    if (session.status === "completed") {
      return res.status(400).json({ error: "This interview has already ended." });
    }

    const transcript = session.transcript;
    transcript.push({ role: "user", content: message });

    const { spokenText, isComplete } = await nextInterviewerTurn(transcript);
    transcript.push({ role: "assistant", content: spokenText });
    db.saveTranscript(sessionId, transcript);

    if (isComplete) {
      const profile = await extractProfile(transcript);
      db.completeSession(sessionId, profile);
    }

    res.json({ reply: spokenText, isComplete });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to process message." });
  }
});

// ---------- Admin (internal) endpoints ----------

function requireAdmin(req, res, next) {
  const password = req.headers["x-admin-password"];
  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

app.post("/api/admin/login", (req, res) => {
  const { password } = req.body || {};
  if (password === process.env.ADMIN_PASSWORD) {
    return res.json({ ok: true });
  }
  res.status(401).json({ ok: false });
});

app.get("/api/admin/sessions", requireAdmin, (req, res) => {
  const sessions = db.listSessions();
  res.json(sessions);
});

app.post("/api/admin/reward-status", requireAdmin, (req, res) => {
  const { sessionId, status } = req.body || {};
  db.setRewardStatus(sessionId, status);
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Honor AI interview app running on port ${PORT}`);
});
