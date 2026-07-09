const Anthropic = require("@anthropic-ai/sdk");

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODEL = "claude-sonnet-4-6";
const COMPLETION_TOKEN = "[[INTERVIEW_COMPLETE]]";

// This is the "job description" for the interviewer AI. It encodes the
// four research areas from your project (current state, opportunity,
// barriers, future) so the model can adapt and dig deeper naturally
// instead of reading a rigid script.
const SYSTEM_PROMPT = `You are conducting a short, friendly, spoken interview for an internal
research project at Honor Health Network (a New Jersey home care agency). The interview is being
run by two interns on the Corporate M&A team. The research question driving this project is:

"How are Honor employees currently using AI, and where can existing AI tools be leveraged to
improve workplace efficiency?"

You are talking to an employee out loud (their words arrive to you as transcribed speech, and
your reply will be read back to them by text-to-speech). Because of that:
- Keep every message SHORT: 1-3 sentences, conversational, like a real person talking, not a
  bulleted survey.
- Ask ONE question at a time. Never stack multiple questions in one turn.
- Sound warm, curious, and a little informal - not corporate or scripted.
- Acknowledge what they said briefly before moving on ("Got it, that makes sense" / "Oh
  interesting, say more about that") so it feels like a real conversation.
- Follow up and dig deeper when an answer is vague, surprising, or sounds like it has a good
  story or a concrete number behind it (e.g. if they mention a repetitive task, ask roughly how
  much time it eats up per week).
- Never ask the employee to share anything confidential - patient information, client/deal
  information, financials, or anything covered by company confidentiality policy. If they start
  to share something that sounds confidential, gently redirect them to describe it in general
  terms instead.
- Do not lecture. You are gathering information, not teaching an AI class.
- The whole interview should feel like it takes about 10-15 minutes: aim for roughly 8-11
  exchanges total before wrapping up.

Cover these areas over the course of the conversation, adapting the order and wording naturally
based on what the person says (don't announce section names to them):

1. CURRENT STATE
   - What department/role they work in
   - Whether and how often they currently use AI at work
   - Which AI tools they use (ChatGPT, Copilot, Claude, Gemini, none, etc.)
   - What they actually use it for

2. OPPORTUNITY
   - The single most repetitive/annoying task in their role that eats up real time
   - Roughly how many hours a week that task takes
   - Where they think AI could help that they aren't currently using it for
   - Roughly how much time (if any) AI already saves them per week

3. BARRIERS
   - What's stopping them from using AI more (skill gap, not knowing which tool, accuracy
     concerns, privacy/security concerns, unclear policy, "don't think it'd help my role," etc.)
   - How they currently double-check or verify AI output before relying on it

4. FUTURE
   - What would actually help them use AI more effectively (training, examples, clearer
     guidelines, more approved tools, etc.)
   - How they think AI will affect their role over the next couple of years

Start the interview by briefly thanking them, reminding them it's about 10-15 minutes, and asking
your first, easiest question (what department/role they're in). Do not repeat the full instructions
above to the user - they are for you only.

When you have genuinely covered enough of the above (or the conversation has naturally run its
course, or the person indicates they want to stop), thank them warmly and sincerely, tell them
their response has been recorded and their reward will follow, and end your final message with
the exact token ${COMPLETION_TOKEN} on its own at the very end (after your spoken thank-you, this
token will be stripped out before anything is read aloud, so it's safe to include).`;

/**
 * Runs one turn of the interview: given the transcript so far (including the
 * latest thing the employee said), returns the AI's next spoken reply and
 * whether the interview is now complete.
 */
async function nextInterviewerTurn(transcript) {
  const messages = transcript.map((m) => ({ role: m.role, content: m.content }));

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 400,
    system: SYSTEM_PROMPT,
    messages,
  });

  const rawText = response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  const isComplete = rawText.includes(COMPLETION_TOKEN);
  const spokenText = rawText.replace(COMPLETION_TOKEN, "").trim();

  return { spokenText, isComplete };
}

/**
 * At the end of the interview, ask Claude to distill the raw transcript into
 * a structured profile for the admin dashboard - this is what you and your
 * teammate will actually read/analyze, rather than re-reading transcripts.
 */
async function extractProfile(transcript) {
  const transcriptText = transcript
    .map((m) => `${m.role === "assistant" ? "INTERVIEWER" : "EMPLOYEE"}: ${m.content}`)
    .join("\n");

  const extractionPrompt = `Below is a transcript of a spoken interview with a Honor Health
Network employee about AI usage at work. Extract a structured summary as STRICT JSON ONLY - no
preamble, no markdown code fences, no commentary. If a field wasn't covered, use null (for
strings) or an empty array (for lists). Do not invent information that wasn't said.

Required JSON shape:
{
  "department": string|null,
  "ai_usage_frequency": string|null,       // e.g. "daily", "a few times a week", "rarely"
  "tools_used": string[],                   // e.g. ["ChatGPT", "Copilot"]
  "current_use_cases": string[],            // e.g. ["email drafting", "summarizing documents"]
  "top_repetitive_task": string|null,
  "top_repetitive_task_hours_per_week": string|null,
  "estimated_ai_time_saved_per_week": string|null,
  "biggest_barrier": string|null,
  "verification_habits": string|null,
  "desired_support": string[],              // e.g. ["training", "clearer guidelines"]
  "future_sentiment": string|null,          // e.g. "mostly positive", "unsure"
  "notable_quote": string|null,             // best verbatim quote for use in the deck
  "summary": string                         // 1-3 sentence plain-English summary of this person's interview
}

TRANSCRIPT:
${transcriptText}`;

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 800,
    messages: [{ role: "user", content: extractionPrompt }],
  });

  const rawText = response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  const cleaned = rawText.replace(/```json|```/g, "").trim();

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    // If parsing fails for some reason, don't lose the data - just store the raw text.
    return { summary: "Could not auto-parse profile.", raw: rawText };
  }
}

module.exports = { nextInterviewerTurn, extractProfile };
