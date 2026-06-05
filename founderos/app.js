// FounderOS static frontend (GitHub Pages).
// Password gate (client-side), chat through a Google Apps Script proxy that
// keeps the OpenAI key private and emails Tomás the results, voice input,
// and a client-side PDF download of the founder's own copy.

const CFG = window.FOUNDEROS_CONFIG || {};
const $ = (id) => document.getElementById(id);
const messages = [];      // {role, content} sent to the model
let finished = false;
let founderName = "";
let resultContext = "";
let resultDossier = "";

const SYSTEM_PROMPT = `
You are FounderOS, an interviewer that builds a founder's "dossier". You interview ONE founder and produce two artefacts for a downstream decision model: a CONTEXT block (fixed-format YAML + headers) and a DOSSIER block (numbered prose). You are an extractor, not a coach or a writer.

# ABSOLUTE FIRST STEP
Your very first message asks ONLY for the founder's first name, warmly and briefly:
"Hi, welcome to FounderOS. Before we start, what's your first name?"
Wait for the name. From then on, address the founder by their name naturally throughout ("Got it, Inês.", "Good one, João.").

# SECOND MESSAGE (after you have the name)
Say, in plain language:
"Thanks {name}. I'm a questionnaire that builds your Founder Dossier. Tomás will run your answers through a decision model that ranks which business you should start or focus on next. It takes about 30 minutes. Best way to answer: tap the microphone and just talk. I'll give you options A/B/C/D every time, but you don't have to pick one cleanly. Say things like 'between B and C, because my savings are tight but I'd risk more for the right idea'. That nuance is exactly what makes your dossier good. One question at a time, and we don't skip anything. Ready? Section 1 of 18."
Then ask the first question.

# HOW EVERY QUESTION WORKS
- ALWAYS multiple choice: give 3-5 concrete labelled options (A, B, C, D, E=other). Options must be real and specific, never vague.
- ALWAYS invite a spoken in-between answer: end each question with a nudge like "(pick one, or talk it through by mic, e.g. 'closer to B but...')".
- NEVER let them skip. If they dodge or say "skip"/"I don't know", do NOT move on. Reframe smaller, give an example, or offer a rougher band ("just ballpark: under 1k, a few k, or more?"). Advance only once you have a usable answer. If after 2 reframes they genuinely cannot know it, capture their best guess, tag it [EST], and continue. Never loop forever.

# DYNAMIC FOLLOW-UP LOOP (run for EVERY scripted question)
You do NOT move to the next scripted question until the current topic is fully pinned down.
1. Ask the scripted multiple-choice question.
2. Read the answer. Silently check: do I now have (a) a clear choice or nuance, (b) a number or band, and (c) enough specifics to fill the matching field with ZERO guessing?
3. If anything is fuzzy, vague, or missing, ask a NEW follow-up multiple-choice question targeting exactly the missing piece (always A/B/C/D + mic nudge). Triggers: named a product but no number -> ask the number as bands; said "businesses" -> ask which kind; gave a range -> ask which end is realistic; named a skill -> ask for proof.
4. Repeat step 3 as many times as needed until you are 100% sure the field is complete and unambiguous. Extraction quality beats speed.
5. Only then say "Got it, {name}" and move to the next scripted question.
Cap: if one follow-up thread passes ~4 rounds without converging, lock the best answer with [EST] and move on. Keep every follow-up multiple-choice and voice-friendly.

# GENERAL EXTRACTION RULES
- On vague claims ("I automated outbound", "I built a platform"), follow up until you have: what it does in plain words, who it's for, and a number.
- Chase a number in everything: how many, how much, how long, what %, in what time.
- Get the plain-language explanation BEFORE any product name. A name alone means nothing.
- Hunt MACRO examples (a real tradeoff, a real failure), not micro. Always ask for failures, not just wins.
- Confirm the REAL role every time: alone, in a team, as founder, or as intern? Never inflate.
- Tag each captured item PROOF (number/fact) or CLAIM (words only). Push every CLAIM toward a PROOF.

# MECE COVERAGE — cover all 18 sections, in order, no gaps, no overlaps
Announce each ("Section 4 of 18: how you like to sell"). Each section = one or more multiple-choice questions plus the follow-up loop.
1 Snapshot: age band, location, education level, near-term goal (oxygen now / build slowly / both).
2 Credibility: for each past role, what proof + number? Offer ranges as options.
3 Money & risk — ASK ALL OF: (a) cash on hand band, (b) monthly burn band, (c) how much of YOUR OWN money you'd invest from your pocket, if any (0 / under 500 / 500-2k / 2-10k / 10k+ EUR), (d) max you'd lose on one bet before killing it, (e) runway months.
4 Selling style: which channel energises vs drains (warm intros / content / cold outreach / paid / partnerships).
5 Network 3-split: observation access, distribution access, trust capital. Get names + rough numbers.
6 Delivery: what you can ship ALONE vs need help for, and how fast.
7 Psychology: peak hours, weekly hours free, burnout threshold, energising vs killer traits.
8 Business model: service / productized / subscription, plus proof you've done it.
9 Buyers you can reach warm today vs not at all.
10 Offer type that fits (one-off / sprint / retainer / product).
11 Mission: what you actually care about, plus a real story why.
12 Existing assets & proof (audiences, repos, case studies, numbers).
13 Fast proof artifacts you could ship in a weekend.
14 Pricing comfort: real numbers, and your floor.
15 Legal/geo/ops: where you can invoice, licences, base, remote.
16 Technical direction & future identity.
17 Candidate ideas already in your head (1-liner + who pays, for each).
18 Geo weights: confirm your city/country/region and the rough split of where the MARKET is vs where your WARM network is.
Also run two quick multiple-choice batteries: (i) rate your network in each of the 17 verticals (none / weak / some / strong / insider), and (ii) confirm hard kill-criteria (industries or work types you refuse).

# OUTPUT FORMAT RULES
- YAML field names in the CONTEXT block are FIXED. Never rename them. geo_weights rows each sum to ~1.0.
- Never invent numbers. Every field ends with a real answer or a tagged [EST].
- No dashes. No filler words (comprehensive, leverage, robust, seamless).
- You do not write their pitch. You output only the two artefacts.

# WHEN THE INTERVIEW IS DONE — CRITICAL MACHINE FORMAT
First, tell the founder warmly that you're done and their results are being sent to Tomás.
Then, on a new line, output EXACTLY this machine block and NOTHING after it (the platform parses it; the founder will not see the raw block):

%%FOUNDEROS_RESULT%%
%%NAME%%
<founder first name here>
%%CONTEXT%%
<the full CONTEXT.md content: the USER_CONSTRAINTS YAML plus the FOUNDER PROFILE, SITUATIONAL STATE and NETWORK headers, exactly like the reference format>
%%DOSSIER%%
<the full DOSSIER.md content: the numbered prose sections>
%%END%%

Do not wrap the machine block in code fences. Do not add commentary after %%END%%. Fill every field from what the founder told you.
`;

// ---------- Password gate ----------
function showMain() {
  $('gate').classList.add('hidden');
  $('main').classList.remove('hidden');
  $('input').focus();
  if (messages.length === 0) kickoff();
}

$('gate-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const pw = $('password').value;
  if (pw === (CFG.SITE_PASSWORD || '')) {
    sessionStorage.setItem('fos_ok', '1');
    showMain();
  } else {
    $('gate-error').classList.remove('hidden');
    $('password').value = '';
  }
});

if (sessionStorage.getItem('fos_ok') === '1') showMain();

// ---------- Chat rendering ----------
function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function addMsg(text, who) {
  const div = document.createElement('div');
  div.className = `msg ${who}`;
  div.innerHTML = escapeHtml(text).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  $('chat').appendChild(div);
  div.scrollIntoView({ behavior: 'smooth', block: 'end' });
  return div;
}
function typingOn() {
  const t = document.createElement('div');
  t.className = 'typing';
  t.id = 'typing';
  t.innerHTML = '<span>●</span><span>●</span><span>●</span>';
  $('chat').appendChild(t);
  t.scrollIntoView({ behavior: 'smooth', block: 'end' });
}
function typingOff() { const t = $('typing'); if (t) t.remove(); }

// ---------- Talk to the model (via Apps Script proxy) ----------
async function callModel() {
  if (!CFG.APPS_SCRIPT_URL) {
    return "Setup note for Tomás: the connection URL is not set yet. Paste the Apps Script web-app URL into config.js (APPS_SCRIPT_URL).";
  }
  const payload = {
    action: 'chat',
    messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
  };
  const r = await fetch(CFG.APPS_SCRIPT_URL, { method: 'POST', body: JSON.stringify(payload) });
  const data = await r.json();
  if (data.error) throw new Error(data.error);
  return data.reply || '';
}

async function kickoff() {
  typingOn();
  try {
    const reply = await callModel();
    typingOff();
    handleReply(reply);
  } catch (e) {
    typingOff();
    addMsg("Something went wrong reaching the assistant. Please refresh and try again.", 'bot');
  }
}

async function send(userText) {
  if (!userText || finished) return;
  addMsg(userText, 'me');
  messages.push({ role: 'user', content: userText });
  $('input').value = '';
  autosize();
  typingOn();
  try {
    const reply = await callModel();
    typingOff();
    handleReply(reply);
  } catch (e) {
    typingOff();
    addMsg("Something went wrong. Please try sending that again.", 'bot');
  }
}

// ---------- Detect + handle the end-of-interview machine block ----------
function handleReply(reply) {
  const marker = '%%FOUNDEROS_RESULT%%';
  const idx = reply.indexOf(marker);
  if (idx === -1) {
    messages.push({ role: 'assistant', content: reply });
    addMsg(reply, 'bot');
    return;
  }
  const visible = reply.slice(0, idx).trim();
  if (visible) addMsg(visible, 'bot');
  messages.push({ role: 'assistant', content: reply });
  parseResult(reply.slice(idx));
  finishUp();
}

function section(block, start, end) {
  const s = block.indexOf(start);
  if (s === -1) return '';
  const from = s + start.length;
  const e = end ? block.indexOf(end, from) : -1;
  return block.slice(from, e === -1 ? undefined : e).trim();
}

function parseResult(block) {
  founderName = section(block, '%%NAME%%', '%%CONTEXT%%');
  resultContext = section(block, '%%CONTEXT%%', '%%DOSSIER%%');
  resultDossier = section(block, '%%DOSSIER%%', '%%END%%');
}

async function finishUp() {
  finished = true;
  $('composer').classList.add('hidden');
  $('hint').classList.add('hidden');
  $('done').classList.remove('hidden');
  // Send to Tomás (best effort; the founder still gets their PDF either way).
  if (CFG.APPS_SCRIPT_URL) {
    try {
      await fetch(CFG.APPS_SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: 'submit',
          name: founderName,
          context: resultContext,
          dossier: resultDossier,
        }),
      });
    } catch (e) { /* graceful: download still works */ }
  }
}

// ---------- PDF download (client-side) ----------
$('download').addEventListener('click', () => {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const margin = 48;
  const width = doc.internal.pageSize.getWidth() - margin * 2;
  let y = margin;

  function writeBlock(title, body, mono) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
    if (y > 780) { doc.addPage(); y = margin; }
    doc.text(title, margin, y); y += 20;
    doc.setFont(mono ? 'courier' : 'helvetica', 'normal');
    doc.setFontSize(mono ? 9 : 11);
    const lines = doc.splitTextToSize(body || '', width);
    for (const ln of lines) {
      if (y > 800) { doc.addPage(); y = margin; }
      doc.text(ln, margin, y);
      y += mono ? 12 : 15;
    }
    y += 16;
  }

  doc.setFont('helvetica', 'bold'); doc.setFontSize(22);
  doc.text('FounderOS Dossier', margin, y); y += 26;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(12); doc.setTextColor(120);
  doc.text((founderName ? founderName + ' · ' : '') + new Date().toISOString().slice(0, 10), margin, y);
  doc.setTextColor(0); y += 30;

  writeBlock('CONTEXT', resultContext, true);
  writeBlock('DOSSIER', resultDossier, false);

  const safe = (founderName || 'founder').replace(/[^a-z0-9]/gi, '_');
  doc.save(`FounderOS_${safe}.pdf`);
});

// ---------- Composer ----------
function autosize() {
  const ta = $('input');
  ta.style.height = 'auto';
  ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';
}
$('input').addEventListener('input', autosize);
$('input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    send($('input').value.trim());
  }
});
$('composer').addEventListener('submit', (e) => {
  e.preventDefault();
  send($('input').value.trim());
});

// ---------- Voice input (Web Speech API) ----------
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null, recording = false;
if (SR) {
  rec = new SR();
  rec.continuous = true;
  rec.interimResults = true;
  rec.lang = 'en-US';
  let base = '';
  rec.onresult = (ev) => {
    let interim = '';
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const t = ev.results[i][0].transcript;
      if (ev.results[i].isFinal) base += t + ' ';
      else interim += t;
    }
    $('input').value = (base + interim).trim();
    autosize();
  };
  rec.onend = () => { if (recording) rec.start(); };
  $('mic').addEventListener('click', () => {
    recording = !recording;
    $('mic').classList.toggle('rec', recording);
    if (recording) { base = $('input').value ? $('input').value + ' ' : ''; rec.start(); }
    else { rec.stop(); }
  });
} else {
  $('mic').addEventListener('click', () => {
    addMsg("Voice input is not supported in this browser. Please type your answer.", 'bot');
  });
}
