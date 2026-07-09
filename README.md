# Honor AI Interview Tool

A voice-based AI interview that replaces the static survey. Employees talk to an
AI interviewer out loud (~10-15 min), the AI adapts and digs deeper based on their
answers, and every session becomes a structured "profile" that only you and your
teammate can see on `/admin`.

## How it works

- `public/index.html` - what employees see: consent screen → voice conversation →
  thank-you screen. Uses the browser's built-in Speech Recognition (listening) and
  Speech Synthesis (the AI talking back) - no extra voice API needed.
- `server.js` - the API. Runs each turn of the interview through Claude, and once
  the interview ends, asks Claude to extract a structured JSON profile from the
  transcript (department, tools used, biggest time-sink, barriers, etc.).
- `db.js` - stores everything in a local SQLite file: contact info (for the
  reward), full transcript, and the structured profile.
- `public/admin.html` - password-protected dashboard listing every respondent,
  their structured profile, their full transcript, and a reward-status toggle.

## 1. Run it locally first

```bash
npm install
cp .env.example .env
# edit .env: paste your ANTHROPIC_API_KEY and pick an ADMIN_PASSWORD
npm start
```

Open `http://localhost:3000` in **Chrome** (Speech Recognition support is best there)
to try the interview, and `http://localhost:3000/admin.html` to see the dashboard.

## 2. Push to GitHub

```bash
git add .
git commit -m "Honor AI interview tool"
git branch -M main
git remote add origin https://github.com/<your-username>/<repo-name>.git
git push -u origin main
```

`.env` is in `.gitignore` already - your API key will never get committed. Good.

## 3. Deploy on Railway

1. Go to railway.app → New Project → Deploy from GitHub repo → pick this repo.
2. Railway auto-detects Node and runs `npm start`.
3. In the Railway project → Variables tab, add:
   - `ANTHROPIC_API_KEY`
   - `ADMIN_PASSWORD`
   - (leave `PORT` unset - Railway injects it automatically)
4. Once deployed, Railway gives you a public URL like `honor-ai-interview.up.railway.app`.
   That's the link you send to employees. `/admin.html` on the same domain is your dashboard.

### Important: data persistence

Railway's default filesystem resets on every redeploy. For a short project this is
usually fine (don't redeploy mid-collection), but if you want the SQLite file to
survive redeploys:

- In Railway, add a **Volume**, mount it at e.g. `/data`.
- In `db.js`, change the `dataDir` path to that mount (`/data` instead of `./data`).

If you'd rather not deal with volumes at all, Railway also offers a one-click
Postgres addon - worth switching to if you expect this to run for weeks or want
extra durability, but SQLite + a Volume is enough for an internal intern project.

## Notes / things to double check with HR before launch

- This ties voice responses to a name/contact for reward payout - it is **not**
  anonymous. Say that plainly on the consent screen (already does), and loop in
  HR/Legal on how rewards get paid out and how long you'll retain recordings/transcripts.
- The system prompt already tells the AI to redirect employees away from sharing
  confidential client, patient, or deal information - but you may want your own
  team to skim a few early transcripts to confirm nothing sensitive is coming through.
- Browser Speech Recognition works best in Chrome (desktop and Android). Safari/iOS
  support is inconsistent - if a lot of your workforce is on iPhone, test that
  specifically before wide rollout.
