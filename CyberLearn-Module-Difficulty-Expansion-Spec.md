# CyberLearn — Module Difficulty Expansion (Easy / Hard) Build Spec

**Context — read this first, it changes the scope of the work:** `client/src/pages/ModulesPage.tsx`
already has full Easy/Medium/Hard support built — a `DIFFICULTIES = ['All', 'Easy', 'Medium',
'Hard']` filter bar and a `difficultyClass()` function that colors the badge green/yellow/red for
each tier. The gap is entirely on the content side: `server/prisma/moduleData.ts` currently seeds
exactly one module per category (Web Security, Network Security, System Security, Social
Engineering, Cryptography) and every one of them is hardcoded `difficulty: 'Medium'`. **This means
no frontend or backend code changes are required at all** — this is purely a content-authoring task
in one file, followed by re-running the existing seed script. Don't add a difficulty prop, a new
filter, or touch `ModulesPage.tsx`/`LessonPage.tsx`/`modules.routes.ts` — they already do the right
thing the moment Easy/Hard rows exist in the database.

---

## 1. What to change

**File:** `server/prisma/moduleData.ts` only (plus running the existing reseed script afterward —
see §4). Do not touch `schema.prisma` — no schema change is needed for this task.

Add **10 new entries** to the `MODULES: ModuleSeed[]` array — an Easy and a Hard module for each of
the 5 existing categories — while leaving the 5 existing Medium modules' *content* completely
untouched (only their `order` field changes — see §2). The result is 15 total modules: 5 Easy, 5
Medium (existing), 5 Hard.

**Follow the file's own documented content format exactly** (it's stated at the top of
`moduleData.ts` and enforced by `LessonPage.tsx`'s tiny renderer, which does not parse general
markdown):
- `'theory'` lessons: plain text using only `"## Heading"` for section headings, `"**bold**"` for
  inline emphasis, and `"- item"` for bullet lists, with blank lines separating blocks — nothing
  else (`TheoryContent` in `LessonPage.tsx` only recognizes these three constructs).
- `'interactive'` lessons: `JSON.stringify({ steps: [{ title, body }] })`.
- `'quiz'` lessons: `JSON.stringify({ question, options, correctIndex, explanation })`.

Match the existing modules' shape per entry: 1 theory lesson (order 1), 1 interactive walkthrough
(order 2), 1 quiz (order 3) — except Easy modules, which should be kept to 2 lessons (theory +
quiz, order 1–2) or a short interactive in place of the quiz — see the duration guidance in §3, Easy
tiers are meant to be a quick on-ramp, not a full-length module.

---

## 2. Renumbering `order`

`GET /api/modules` (`modules.routes.ts`) sorts by `order` ascending, and the grid on `ModulesPage.tsx`
renders in that order (after the difficulty filter is applied) — so `order` should keep each
category's three tiers adjacent and progressing Easy → Medium → Hard. Use this scheme (category
base × 10 + tier):

| Category | Easy `order` | Medium `order` (was) | Hard `order` |
|---|---|---|---|
| Web Security | 11 | 12 (was 1) | 13 |
| Network Security | 21 | 22 (was 2) | 23 |
| System & Endpoint Security | 31 | 32 (was 3) | 33 |
| Social Engineering | 41 | 42 (was 4) | 43 |
| Cryptography | 51 | 52 (was 5) | 53 |

Update the 5 existing Medium entries' `order` field to the "was" → new value shown above. Do not
change anything else about those 5 entries — same `name`, `description`, `duration`, and all
existing lesson content stays exactly as-is.

---

## 3. Difficulty-differentiation rules

The whole point of this task fails if Easy and Hard just relabel the same content — they need to
genuinely read as a different level, not a reskin:

**Easy tier** — a true beginner on-ramp, not a shorter version of Medium:
- Analogy-first, plain language, no unexplained jargon (a term Medium uses freely should either be
  avoided here or introduced with a one-line everyday analogy).
- Assume zero prior security knowledge — explain what a password/network/website request even *is*
  in plain terms before anything about attacking it.
- Duration target: 15–20 minutes. Keep it to 2 lessons (theory + quiz, or theory + a short
  interactive) — don't pad it to match Medium's length.
- Quiz should test pattern recognition in plain scenarios ("which of these looks suspicious"), not
  technical vocabulary recall.

**Hard tier** — assumes the learner already knows Medium's content; introduces genuinely more
advanced material, not just harder questions on the same facts:
- Explicitly build on top of Medium's specific topics (reference them by name in the opening
  paragraph — "building on X and Y from the Medium module...") and introduce 3–4 new, more advanced
  concepts Medium doesn't cover (concrete topic lists are given per category in §5 below).
- Duration target: 40–45 minutes.
- The interactive walkthrough should show a *chained* or *multi-step* attack (not a single
  attack/defense pair like Medium's walkthroughs) — this is what makes it feel advanced rather than
  just "the same kind of walkthrough with bigger words."
- The quiz question should require synthesis (why did defense A stop this but not defense B; what
  specific step in the chain was the actual failure point) rather than a single fact lookup.

---

## 4. Reseeding

After editing `moduleData.ts`, run from `server/`:
```
npm run prisma:seed:modules
```
This runs the existing `server/prisma/reseedModules.ts`, which **wipes and recreates every
`Module`/`Lesson` row from scratch, and also wipes `LessonProgress` entirely** (per that script's
own header comment — old lesson ids won't exist anymore after a reseed, so progress against them
can't be kept). It does **not** touch `Scenario`, `Session`, `Attempt`, `Event`, or any gameplay/
assessment history — only the curriculum tables. This is fine for a dev/demo database, but flag it
explicitly to whoever runs it: any learner's "lessons completed" progress resets to zero on every
reseed. No schema migration is needed for this task since no model fields are being added.

---

## 5. Content briefs — write real lesson content from these, not generic filler

Each brief below gives the new module's name, description, duration, and a topic outline for its
theory lesson plus a premise for its interactive walkthrough and the angle its quiz question should
take. Write full lesson content (in the exact theory/interactive/quiz format from §1) from these
outlines — the outlines are deliberately specific so the result reads as real, differentiated
curriculum rather than filler text.

### Web Security

**Easy — "Web Safety Basics"** (category: `Web Security`, duration: 20)
Theory topics: what a website request/response actually is, in plain terms (browser asks, server
answers); what a password is protecting and why reusing the same one across sites is risky (one
leaked site compromises all of them); what "https" and the padlock icon mean, in plain terms (a
sealed, tamper-evident envelope vs. a postcard anyone can read); how to recognize an obviously
suspicious link before clicking it. No query/code internals at all — keep it entirely conceptual.
Interactive premise: "Spot the fake login page" — a side-by-side comparison of a real vs. a
lookalike bank login page (mismatched URL, missing padlock, odd design details), no technical
vocabulary required. Quiz angle: pattern recognition — "which of these URLs is most likely a fake
login page," not a definitional question.

**Hard — "Advanced Web Exploitation & Defense in Depth"** (category: `Web Security`, duration: 45)
Theory topics (builds explicitly on Medium's SQLi/XSS/CSRF/broken-auth): Server-Side Request
Forgery (SSRF) — tricking the *server* into making requests to internal-only services on its
behalf; insecure deserialization — a crafted serialized object that executes code the moment the
app deserializes it; JWT algorithm-confusion attacks (e.g. an app that trusts a token's claimed
`alg: none` or lets an attacker swap the signing algorithm); and why defense-in-depth chaining
(input validation + parameterized queries + CSP + rate limiting together) stops attacks that any
single control alone would miss. Interactive premise: a chained attack where SSRF is used to reach
an internal cloud-metadata endpoint and extract credentials — showing how one flaw cascades into a
much bigger compromise. Quiz angle: given a two-stage attack description, ask which of two candidate
defenses would actually have broken the chain (synthesis, not single-fact recall).

### Network Security

**Easy — "Staying Safe on Networks"** (category: `Network Security`, duration: 20)
Theory topics: what a network is in plain terms (a shared road data travels on); why public Wi-Fi
carries risk, explained with the postcard-vs-sealed-envelope analogy (unencrypted vs. encrypted
traffic); what a VPN does for an everyday user, in plain terms (a private tunnel); the one thing to
check before doing anything sensitive on public Wi-Fi (the padlock/https indicator). Interactive
premise: a short decision-tree walkthrough — "should I check my bank account on this coffee-shop
Wi-Fi?" — reasoning through the checks in plain language. Quiz angle: scenario recognition in plain
language, no protocol names required.

**Hard — "Advanced Network Attacks & Detection"** (category: `Network Security`, duration: 45)
Theory topics (builds explicitly on Medium's firewalls/segmentation/IDS-IPS/MITM/DDoS): DNS
spoofing/cache poisoning; VLAN-hopping techniques that bypass network segmentation; IDS/IPS evasion
via packet fragmentation and encoding; and how real DDoS mitigation actually works at scale
(scrubbing centers, anycast routing, layered rate-limiting working together, not any single
technique). Interactive premise: an attacker uses a VLAN-hopping technique to reach a "protected"
server segment despite firewall rules between zones, then the walkthrough shows the specific switch
port misconfiguration that allowed it and how correct configuration would have blocked it. Quiz
angle: synthesis — identify which specific misconfiguration (not "the firewall failed" in general)
enabled the bypass.

### System & Endpoint Security

**Easy — "Keeping Your Own Device Safe"** (category: `System Security`, duration: 20)
Theory topics: what "administrator" vs. a regular account means on a personal computer, in plain
terms; why software updates matter (patching a hole before someone finds it, burglar-and-lock
analogy); what antivirus/endpoint protection does at a beginner level; why downloading "free
versions" of paid software from unofficial sites is risky. Interactive premise: simple "should I
click 'Run as Administrator'?" decision scenarios. Quiz angle: plain-language scenario recognition.

**Hard — "Advanced Persistence & Evasion"** (category: `System Security`, duration: 45)
Theory topics (builds explicitly on Medium's privilege-escalation/persistence/credential-dumping
baseline): living-off-the-land techniques (abusing legitimate admin tools like PowerShell/WMI
instead of dropping detectable malware files); process injection and DLL side-loading; anti-
forensics (log clearing, timestomping); and how behavior-based detection/honeytokens counter all of
the above even when no malicious *file* ever appears. Interactive premise: an attack chain that uses
only built-in OS tools end-to-end, evading a signature-based antivirus completely, followed by how a
behavioral EDR rule still catches it. Quiz angle: synthesis — why did the signature-based tool miss
this attack while the behavior-based tool caught it?

### Social Engineering

**Easy — "Trust Your Gut: Everyday Scam Awareness"** (category: `Social Engineering`, duration: 15)
Theory topics: general scam red flags in everyday language (urgency, unexpected requests, "too good
to be true," being asked to skip a normal verification step); how to verify a suspicious request in
real life (call back on a number you looked up yourself, not one given to you); the point that
anyone can be targeted, not just "gullible" people. Interactive premise: a short "text message from
your bank" example with two obvious red flags for a genuine beginner to spot. Quiz angle: plain
recognition — spot the red flags in a short message.

**Hard — "Advanced Social Engineering & Human-Layer Defense"** (category: `Social Engineering`,
duration: 45)
Theory topics (builds explicitly on Medium's phishing/vishing/smishing/pretexting): spear phishing
and whaling (highly targeted attacks built from research on a specific person); multi-channel
campaigns combining email, phone, and physical pretexting in sequence; OSINT reconnaissance — how an
attacker mines a target's public social media/LinkedIn presence to craft a convincing pretext; and
organizational defenses beyond individual vigilance (simulated phishing programs, "security
champion" networks, a verified-callback culture). Interactive premise: trace how a specific public
LinkedIn post gave an attacker exactly the detail needed to craft a devastatingly convincing spear-
phishing email. Quiz angle: synthesis — what specific OSINT detail made the email convincing, and
what organizational control (not "just be more careful") would have stopped it regardless?

### Cryptography

**Easy — "Why the Padlock Icon Matters"** (category: `Cryptography`, duration: 20)
Theory topics: what encryption means in plain terms (a locked box only the right person can open);
why the padlock/https indicator matters for everyday browsing; what a password manager does and why
it helps, described in plain terms (not hashing internals); the general idea that your data is
"scrambled" in transit so an eavesdropper can't read it even if they intercept it. Interactive
premise: walk through the postcard-vs-sealed-envelope analogy step by step. Quiz angle: plain
recognition — which of two sites is safe to enter a password on, and why.

**Hard — "Applied Cryptographic Failures"** (category: `Cryptography`, duration: 45)
Theory topics (builds explicitly on Medium's symmetric/asymmetric/hashing/TLS baseline): padding
oracle attacks (recovering plaintext byte-by-byte without ever learning the key); weak/predictable
randomness in key generation (citing the general pattern of real-world RNG failures, not
implementation specifics); certificate-validation bypass — why an app using TLS is still vulnerable
if it doesn't actually check the certificate properly; and key-management failures (hardcoded keys,
key reuse across systems) — the core lesson that "using crypto" and "using crypto correctly" are
very different things. Interactive premise: walk through a padding-oracle attack recovering data
byte by byte, then show why authenticated encryption with properly randomized IVs closes the exact
gap that made it possible. Quiz angle: synthesis — why doesn't "the app uses AES" alone guarantee
security; what else has to be true?

---

## 6. Optional (flag as a decision point, not required for this task): prerequisite gating

Not required to satisfy "add Easy and Hard modules," but worth flagging as a natural next step once
they exist: gate Medium behind Easy's completion and Hard behind Medium's, within the same
category, so the platform enforces the progression it now offers rather than leaving all three
tiers equally open from the start. This *does* require a small code change (unlike everything
above), so only do it if explicitly asked to follow up:
- `GET /api/modules` (`modules.routes.ts`) would need to compute, per module, whether the same
  category's next-lower tier is 100% complete for this user (via existing `LessonProgress` data),
  and include a `locked: boolean` on the response.
- `ModulesPage.tsx`'s `ModuleCard` would need a locked visual state (dimmed, a lock icon, `onClick`
  disabled) when `locked` is true.

## 7. Acceptance criteria

After editing `moduleData.ts` and reseeding: `ModulesPage.tsx`'s existing Easy/Medium/Hard filter
buttons each show exactly 5 modules (one per category); every new module's lessons render correctly
through `LessonPage.tsx`'s existing theory/interactive/quiz renderers with zero code changes;
Medium modules' content is byte-for-byte unchanged except their `order` value; a learner reading an
Easy module encounters no unexplained jargon, and a learner reading a Hard module encounters at
least 3 concepts not present in that category's Medium module.
