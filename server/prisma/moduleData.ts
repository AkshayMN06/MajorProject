// Real curriculum content for the client-side Modules/Lessons section
// (ModulesPage/LessonPage). One module per Scenario.category per difficulty
// tier (Easy/Medium/Hard) so a learner can study the concept — at whatever
// level they're ready for — before meeting it in a Scenario Assessment round.
//
// Lesson.content is a plain String column (not Json) in the schema, so:
// - 'theory'      lessons store markdown-ish plain text, rendered as-is.
// - 'interactive' lessons store JSON.stringify({ steps: [{ title, body }] }).
// - 'quiz'        lessons store JSON.stringify({ question, options, correctIndex, explanation }).
//
// order uses category-base*10 + tier (1=Easy, 2=Medium, 3=Hard) so each
// category's three tiers stay adjacent and progress Easy -> Medium -> Hard
// in GET /api/modules's ordering.

export interface QuizLessonContent {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface InteractiveStep {
  title: string;
  body: string;
}

export interface InteractiveLessonContent {
  steps: InteractiveStep[];
}

export interface LessonSeed {
  title: string;
  type: 'theory' | 'interactive' | 'quiz';
  order: number;
  content: string;
}

export interface ModuleSeed {
  name: string;
  description: string;
  category: string; // matches Scenario.category
  difficulty: string;
  duration: number; // minutes
  type: string;
  order: number;
  lessons: LessonSeed[];
}

const quiz = (c: QuizLessonContent) => JSON.stringify(c);
const interactive = (c: InteractiveLessonContent) => JSON.stringify(c);

export const MODULES: ModuleSeed[] = [
  // ─── Web Security ─────────────────────────────────────────────────────────
  {
    name: 'Web Safety Basics',
    description: 'A beginner on-ramp to browsing safely — no jargon, no code, just the habits that keep your accounts and data safe.',
    category: 'Web Security',
    difficulty: 'Easy',
    duration: 20,
    type: 'theory',
    order: 11,
    lessons: [
      {
        title: 'How the Web Actually Works (and How to Stay Safe on It)',
        type: 'theory',
        order: 1,
        content: `## What happens when you visit a website

Every time you open a website, your browser sends a request ("show me
this page") and the website's server sends back a response (the page
itself). Think of it like sending a letter and getting a reply — and
just like a letter, that exchange can be sealed in an envelope or
written on a postcard anyone along the way can read.

## What a password actually protects

A password is the key to an account that holds your information —
email, photos, money. The risky habit isn't having a "weak-looking"
password, it's **reusing the same password across multiple sites**.
If just one of those sites is ever hacked, an attacker now has a key
that also opens every other account where you used it.

## The padlock icon and "https"

You've probably noticed the little padlock next to a website's address
and the "https" at the start of the URL. That padlock means the
connection is like a **sealed, tamper-evident envelope** — even if
someone intercepts it in transit, they can't read what's inside. No
padlock (or plain "http") means the page is more like a **postcard**:
anyone handling it along the way could read it. Never enter a password
or payment details on a page without that padlock.

## Recognizing a suspicious link before you click

A few quick checks catch most bad links before they cause harm:
- Does the web address actually match the company it claims to be
  from (e.g. "yourbank.com", not "yourbank-secure-login.com")?
- Is the message pushing you to act *immediately*, with urgency or a
  threat ("your account will be closed today")?
- Does it ask you to enter a password after clicking a link you
  weren't expecting?

If any of these feel off, don't click — instead, open your browser and
type the company's real address yourself, or use the official app.`,
      },
      {
        title: 'Check Your Understanding',
        type: 'quiz',
        order: 2,
        content: quiz({
          question: 'You get an email saying "Your account will be suspended — verify now" with a link to: secure-yourbank-login-update.com. What should you do?',
          options: [
            'Click it quickly before the account gets suspended',
            'Reply to the email asking if it\'s real',
            'Don\'t click it — the address doesn\'t match the real bank\'s domain, and the urgency is a classic pressure tactic',
            'Click it, but only enter half your password to be safe',
          ],
          correctIndex: 2,
          explanation: 'The web address is a lookalike, not the bank\'s real domain, and the manufactured urgency ("suspended", "now") is designed to make you act before you think. The safe move is to never click — go to the real site directly instead.',
        }),
      },
    ],
  },
  {
    name: 'Web Application Security Fundamentals',
    description: 'Learn how attackers exploit web applications — injection, broken authentication, XSS — and the controls that stop them.',
    category: 'Web Security',
    difficulty: 'Medium',
    duration: 30,
    type: 'theory',
    order: 12,
    lessons: [
      {
        title: 'Common Web Vulnerabilities',
        type: 'theory',
        order: 1,
        content: `## Why web applications get attacked

Web apps sit at the boundary between the public internet and an
organization's data — a single flawed input field can expose an entire
database. Most real-world breaches trace back to a small set of
recurring weaknesses.

## SQL Injection

An attacker inserts SQL syntax into a form field or URL parameter that
the application concatenates directly into a database query, e.g.
entering \`' OR '1'='1\` into a login field. If the backend doesn't
parameterize the query, the attacker can bypass authentication, dump
tables, or modify data.

**Defense:** parameterized queries / prepared statements, an ORM that
escapes input by default, and least-privilege database accounts.

## Cross-Site Scripting (XSS)

An attacker injects a malicious script into a page that other users
view — a comment field that isn't sanitized, for example. The script
then runs in the victim's browser with their session, able to steal
cookies or perform actions as them.

**Defense:** output-encode any user-supplied data before rendering it
in HTML, and use a Content-Security-Policy header to restrict what
scripts can run.

## Broken Authentication & Session Management

Weak password policies, predictable session tokens, or sessions that
never expire let an attacker hijack an account without ever guessing
the password.

**Defense:** strong password hashing (bcrypt/argon2), short-lived
session tokens, and multi-factor authentication for sensitive actions.

## Cross-Site Request Forgery (CSRF)

A malicious site tricks a logged-in user's browser into submitting a
request to a trusted site (e.g. a hidden form that transfers funds),
relying on the browser automatically attaching the user's session
cookie.

**Defense:** CSRF tokens tied to the user's session, and checking the
\`Origin\`/\`Referer\` header on state-changing requests.`,
      },
      {
        title: 'Walkthrough: Spotting an SQL Injection',
        type: 'interactive',
        order: 2,
        content: interactive({
          steps: [
            {
              title: 'The login form',
              body: 'A login page sends username and password to the server. The server builds a query like: SELECT * FROM users WHERE username = \'<input>\' AND password = \'<input>\'. Notice the input is dropped straight into the string.',
            },
            {
              title: 'The malicious input',
              body: 'The attacker types this as the username: admin\' -- \nEverything after -- becomes a SQL comment, so the query effectively becomes: SELECT * FROM users WHERE username = \'admin\' --\' AND password = \'...\'. The password check is commented out entirely.',
            },
            {
              title: 'The result',
              body: 'The database returns the admin row without ever checking a real password, and the attacker is logged in as admin.',
            },
            {
              title: 'The fix',
              body: 'A parameterized query sends the input as data, never as part of the SQL text: db.query(\'SELECT * FROM users WHERE username = ? AND password = ?\', [input1, input2]). The database driver escapes the input automatically, so a stray -- or \' can\'t change the query\'s structure.',
            },
          ],
        }),
      },
      {
        title: 'Check Your Understanding',
        type: 'quiz',
        order: 3,
        content: quiz({
          question: 'A comment field on a blog stores whatever a visitor types and later renders it directly into the page HTML for every other reader, with no escaping. What is this an example of?',
          options: [
            'SQL Injection',
            'Stored Cross-Site Scripting (XSS)',
            'Cross-Site Request Forgery (CSRF)',
            'Privilege Escalation',
          ],
          correctIndex: 1,
          explanation: 'Unsanitized user input that gets rendered as HTML/JS for other users to execute is stored XSS — the payload persists in the database and fires for every visitor who views the comment.',
        }),
      },
    ],
  },
  {
    name: 'Advanced Web Exploitation & Defense in Depth',
    description: 'Beyond SQLi and XSS — SSRF, insecure deserialization, and JWT attacks, plus why layered defenses succeed where any single control fails.',
    category: 'Web Security',
    difficulty: 'Hard',
    duration: 45,
    type: 'theory',
    order: 13,
    lessons: [
      {
        title: 'Beyond the Basics: Advanced Web Exploitation',
        type: 'theory',
        order: 1,
        content: `## Building on the fundamentals

The Medium module covered SQL Injection, XSS, broken authentication,
and CSRF. Those attacks target the application's *inputs and outputs*
directly. This module covers attacks that target something subtler:
the trust an application places in its own backend components,
serialization formats, and token verification logic.

## Server-Side Request Forgery (SSRF)

Instead of attacking a user's browser, an SSRF attack tricks the
*server itself* into making a request on the attacker's behalf — often
to an internal-only service the attacker could never reach directly
(an internal admin panel, a database on a private network, or a cloud
provider's metadata endpoint). A feature as innocent as "fetch this
image from a URL" can become an SSRF vector if the server fetches
whatever URL it's given without restriction.

**Defense:** allow-list the destinations a server-side fetch can reach,
and block requests to internal/private IP ranges by default.

## Insecure Deserialization

Many applications convert objects into a serialized format to store or
transmit them, then deserialize that data back into a live object
later. If an attacker can control the serialized data, a crafted
payload can execute code the instant it's deserialized — before the
application ever "looks" at the data's contents.

**Defense:** never deserialize untrusted data with a format that
allows arbitrary object construction; use signed, simple formats (like
JSON with strict schema validation) for anything crossing a trust
boundary.

## JWT Algorithm-Confusion Attacks

JSON Web Tokens (JWTs) carry a header stating which algorithm signed
them. Some vulnerable implementations trust that header — so an
attacker can submit a token with \`alg: none\` (no signature required
at all), or swap an asymmetric algorithm for a symmetric one the
server can be tricked into misusing, forging a token the server
accepts as legitimate.

**Defense:** the server must hardcode which algorithm it expects and
reject anything else — never trust the algorithm named inside the
token itself.

## Why Defense in Depth Wins

None of the Medium module's individual defenses are perfect alone —
input validation can miss an edge case, a WAF rule can be bypassed. The
real protection comes from **layering** controls (input validation +
parameterized queries + Content-Security-Policy + rate limiting)
together, so an attack that slips past one layer is still caught by
another. This is the core lesson advanced web security keeps coming
back to: no single control is the whole answer.`,
      },
      {
        title: 'Walkthrough: A Chained SSRF-to-Credential-Theft Attack',
        type: 'interactive',
        order: 2,
        content: interactive({
          steps: [
            {
              title: 'Stage 1 — the innocent-looking feature',
              body: 'A web app lets users submit a URL to generate a preview image of that page. The server fetches whatever URL is given, with no restriction on the destination.',
            },
            {
              title: 'Stage 2 — redirecting the fetch internally',
              body: 'The attacker submits an internal address instead of a real website: http://169.254.169.254/latest/meta-data/. This is the cloud provider\'s metadata endpoint, reachable only from inside the server\'s own network — something the attacker could never reach directly from the internet.',
            },
            {
              title: 'Stage 3 — the server does the attacker\'s reaching for them',
              body: 'Because the server itself makes the request (not the attacker\'s browser), it\'s allowed through — the metadata service has no way to know the request wasn\'t legitimate. The response, containing the server\'s temporary cloud credentials, gets included in the "preview" returned to the attacker.',
            },
            {
              title: 'Stage 4 — the cascade',
              body: 'With those stolen cloud credentials, the attacker can now access other cloud resources (storage buckets, databases) the compromised server was authorized to use — turning one unrestricted fetch feature into a much wider breach.',
            },
            {
              title: 'Where the chain could have been broken',
              body: 'Blocking server-side requests to internal/private IP ranges (including the cloud metadata address specifically) at Stage 2 would have stopped the entire chain before Stage 3 ever had a chance to run.',
            },
          ],
        }),
      },
      {
        title: 'Check Your Understanding',
        type: 'quiz',
        order: 3,
        content: quiz({
          question: 'An app has an SSRF flaw AND lets its server-side fetch feature reach any destination, including internal IP ranges. Two candidate defenses are proposed: (A) escaping HTML special characters in the fetched content before display, or (B) blocking outbound server-side requests to internal/private IP ranges. Which would actually have stopped the credential-theft chain above?',
          options: [
            'A — HTML escaping, since the attack involves web content',
            'B — blocking internal-range requests, since the attack depended on the server reaching an internal-only address',
            'Both equally, since they\'re both standard web defenses',
            'Neither — only firewalling the user\'s browser would help',
          ],
          correctIndex: 1,
          explanation: 'The actual failure point was the server being willing to fetch an internal-only address on the attacker\'s behalf. HTML escaping (A) addresses a completely different problem (XSS) and does nothing here — the credentials were stolen server-side, never rendered as HTML at all. Only (B) closes the specific gap that made the chain possible.',
        }),
      },
    ],
  },

  // ─── Network Security ─────────────────────────────────────────────────────
  {
    name: 'Staying Safe on Networks',
    description: 'What a network actually is, why public Wi-Fi carries risk, and the one habit that protects you on it — explained with zero technical jargon.',
    category: 'Network Security',
    difficulty: 'Easy',
    duration: 20,
    type: 'theory',
    order: 21,
    lessons: [
      {
        title: 'Networks, Public Wi-Fi, and What Actually Protects You',
        type: 'theory',
        order: 1,
        content: `## What a network is

A network is simply a shared road that data travels on to get from
your device to wherever it's going — a website, an email server, an
app's servers. Just like a real road, many different people's traffic
can be traveling on that same road at the same time.

## Why public Wi-Fi carries extra risk

On a private, trusted network (like at home), you generally know who
else is on that "road." On public Wi-Fi (a coffee shop, an airport),
you don't — and some of that unencrypted traffic is like writing your
message on a **postcard**: anyone else on that same network, with the
right tool, can potentially read it as it passes by. Traffic protected
by "https" (the padlock icon) is more like a **sealed envelope** —
even on a public network, it stays unreadable to anyone else on that
same Wi-Fi.

## What a VPN does for you

A VPN (Virtual Private Network) creates a **private tunnel** for all
your traffic, so instead of your data traveling openly on the shared
public road, it travels through a protected tunnel until it reaches a
trusted exit point. It's an extra layer of protection, especially
useful on networks you don't control.

## The one thing to check before anything sensitive

Before logging into your bank, email, or anything with a password, on
*any* network but especially public Wi-Fi: check for the padlock icon
and "https" in the address bar. For example, thinking through "should
I check my bank balance on this coffee-shop Wi-Fi?" — if the bank's
site shows the padlock, the connection itself is sealed end-to-end,
and the answer is generally yes; if it doesn't, that's your signal to
wait until you're on a trusted network instead.`,
      },
      {
        title: 'Check Your Understanding',
        type: 'quiz',
        order: 2,
        content: quiz({
          question: 'You\'re at an airport and need to check your email. The Wi-Fi is open (no password), but your email provider\'s site shows the padlock icon and "https" in the address bar. What\'s the safest read of this situation?',
          options: [
            'Unsafe regardless — never use open Wi-Fi for anything',
            'Safe — the padlock means your connection to the email site is sealed end-to-end, even though the Wi-Fi itself is open',
            'Only safe if you also turn on airplane mode first',
            'Unsafe — the padlock only matters on private networks, not public ones',
          ],
          correctIndex: 1,
          explanation: 'The padlock/https indicator means your specific connection to that site is encrypted end-to-end regardless of what network you\'re on — that\'s exactly the protection that makes it safe to use even on an open public Wi-Fi network.',
        }),
      },
    ],
  },
  {
    name: 'Network Security Essentials',
    description: 'Understand how traffic is protected in transit — firewalls, segmentation, and the attacks that try to intercept or reroute it.',
    category: 'Network Security',
    difficulty: 'Medium',
    duration: 30,
    type: 'theory',
    order: 22,
    lessons: [
      {
        title: 'Perimeter and Segmentation Controls',
        type: 'theory',
        order: 1,
        content: `## Defense in depth, not a single wall

A network is rarely protected by one control — it's layers of
filtering, monitoring, and containment, so a single failure doesn't
expose everything.

## Firewalls

Filter traffic based on rules (source/destination IP, port, protocol).
A modern next-generation firewall (NGFW) can also inspect application
data, not just headers, to catch traffic that's using an allowed port
for a disallowed purpose.

## Network Segmentation

Splitting a network into zones (e.g. guest Wi-Fi, corporate LAN,
server VLAN) so that compromising one segment doesn't automatically
grant access to everything else. A compromised employee laptop on the
guest segment shouldn't be able to reach the database server directly.

## Intrusion Detection / Prevention (IDS/IPS)

An IDS monitors traffic and alerts on suspicious patterns (known
attack signatures, anomalous volume); an IPS goes further and actively
blocks the traffic in real time.

## Man-in-the-Middle (MITM) Attacks

An attacker positions themselves between two communicating parties —
e.g. on an unencrypted public Wi-Fi network — and can read or modify
traffic that isn't independently encrypted end-to-end.

**Defense:** TLS everywhere (so even an intercepted connection is
encrypted), certificate pinning for sensitive apps, and VPNs on
untrusted networks.

## Denial of Service (DoS/DDoS)

Overwhelming a service with traffic or requests so legitimate users
can't get through. Distributed (DDoS) attacks use many compromised
machines at once, making simple IP blocking ineffective.

**Defense:** rate limiting, traffic scrubbing services, and
auto-scaling infrastructure that can absorb spikes.`,
      },
      {
        title: 'Walkthrough: A Man-in-the-Middle on Public Wi-Fi',
        type: 'interactive',
        order: 2,
        content: interactive({
          steps: [
            {
              title: 'The setup',
              body: 'A user connects to "Free Airport WiFi" and opens their email client. An attacker on the same network runs a tool that answers ARP requests, telling every device on the network that the attacker\'s laptop is the router.',
            },
            {
              title: 'The interception',
              body: 'Now all the victim\'s traffic physically routes through the attacker\'s machine before reaching the real router. If the email client connects over plain (unencrypted) IMAP, the attacker reads the credentials and every email in plain text.',
            },
            {
              title: 'Where TLS breaks the attack',
              body: 'If the connection instead uses IMAPS/TLS, the attacker still sees the traffic pass through, but it\'s encrypted — they\'d need the private key to read it, which they don\'t have. The attack becomes useless without a way to also compromise the encryption.',
            },
            {
              title: 'The takeaway',
              body: 'Network position alone (being "in the middle") isn\'t enough to read traffic — it has to also be unencrypted, or the attacker has to trick the victim into accepting a fake certificate. This is why "always use HTTPS/TLS" is the single highest-leverage network security habit.',
            },
          ],
        }),
      },
      {
        title: 'Check Your Understanding',
        type: 'quiz',
        order: 3,
        content: quiz({
          question: 'A company puts its guest Wi-Fi, employee laptops, and payment-processing servers on three separate VLANs with firewall rules between them. What is this practice called, and what does it primarily limit?',
          options: [
            'Encryption — it limits what data can be read',
            'Network segmentation — it limits how far an attacker can move after compromising one zone',
            'Rate limiting — it limits how many requests a client can send',
            'Certificate pinning — it limits which certificates a client will trust',
          ],
          correctIndex: 1,
          explanation: 'Segmentation doesn\'t stop an initial compromise, but it contains the blast radius — a compromised guest device can\'t directly reach the payment servers because the network itself doesn\'t route between those zones without passing through firewall rules.',
        }),
      },
    ],
  },
  {
    name: 'Advanced Network Attacks & Detection',
    description: 'DNS spoofing, VLAN-hopping, IDS/IPS evasion, and how real-world DDoS mitigation works at scale — beyond the perimeter-and-segmentation basics.',
    category: 'Network Security',
    difficulty: 'Hard',
    duration: 45,
    type: 'theory',
    order: 23,
    lessons: [
      {
        title: 'Beyond the Perimeter: Advanced Network Attacks',
        type: 'theory',
        order: 1,
        content: `## Building on firewalls, segmentation, IDS/IPS, MITM, and DDoS

The Medium module covered the standard perimeter toolkit — firewalls,
segmentation, IDS/IPS, and defenses against MITM and DDoS. This module
covers techniques that specifically target the *assumptions* those
controls rely on.

## DNS Spoofing / Cache Poisoning

DNS translates a domain name (like "bank.com") into the IP address a
browser actually connects to. If an attacker can inject a forged
answer into a DNS resolver's cache, every subsequent lookup for that
domain returns the attacker's IP instead of the real one — silently
redirecting traffic without the victim's browser or the target
website ever being directly attacked.

**Defense:** DNSSEC (cryptographically signed DNS responses) so a
resolver can verify an answer hasn't been forged.

## VLAN-Hopping

Segmentation (from the Medium module) assumes traffic can't cross
between VLANs without passing through a firewall. VLAN-hopping
techniques — like exploiting a switch port left in trunking mode, or
double-tagging a frame with two VLAN headers — let an attacker's
traffic slip from one VLAN into another the segmentation design
assumed was isolated.

**Defense:** explicitly disable trunking on access ports and never
leave a switch port's VLAN configuration at a permissive default.

## IDS/IPS Evasion

An IDS/IPS matches traffic against known attack signatures. Evasion
techniques deliberately break a payload apart (packet fragmentation)
or re-encode it (using unusual character encodings) so it no longer
matches the exact pattern the signature is looking for, while the
destination system still reassembles/decodes it back into the
original malicious payload.

**Defense:** IDS/IPS engines that reassemble fragmented traffic and
normalize encodings *before* signature matching, rather than matching
against the raw wire format.

## Real DDoS Mitigation at Scale

The Medium module mentioned rate limiting — real large-scale DDoS
defense goes further, combining **scrubbing centers** (traffic is
rerouted through infrastructure designed to filter attack traffic
before it reaches the target), **anycast routing** (the same IP
address is announced from many global locations, so attack traffic
gets spread thin across all of them instead of overwhelming one), and
layered rate-limiting at multiple points — no single technique alone
handles an attack at internet scale.`,
      },
      {
        title: 'Walkthrough: A VLAN-Hopping Bypass',
        type: 'interactive',
        order: 2,
        content: interactive({
          steps: [
            {
              title: 'The intended design',
              body: 'A company segments its network: Guest VLAN 10, Employee VLAN 20, Server VLAN 30 — with firewall rules meant to block Guest VLAN from ever reaching Server VLAN directly.',
            },
            {
              title: 'The overlooked switch port',
              body: 'The switch port the guest Wi-Fi access point connects to was left configured as a trunk port (able to carry traffic for multiple VLANs) instead of a restricted access port limited to VLAN 10 only — a leftover from an earlier network change that was never cleaned up.',
            },
            {
              title: 'The hop',
              body: 'An attacker on the guest network crafts frames with a forged VLAN 30 tag. Because the port is a trunk port, the switch trusts the tag and forwards the frame as if it genuinely originated on the server VLAN — bypassing the firewall rules entirely, since those rules only inspect traffic crossing between VLANs at the expected boundary, not traffic that\'s already tagged as if it belongs.',
            },
            {
              title: 'Where the fix belongs',
              body: 'The firewall rules were never actually wrong — the failure was the trunk port configuration on a switch port that should only ever have carried one VLAN. Locking that port down to access mode for VLAN 10 only removes the ability to inject a forged tag in the first place, regardless of how the firewall rules are written.',
            },
          ],
        }),
      },
      {
        title: 'Check Your Understanding',
        type: 'quiz',
        order: 3,
        content: quiz({
          question: 'In the VLAN-hopping scenario above, what specifically enabled the bypass?',
          options: [
            'The firewall rules between VLANs were misconfigured',
            'The switch port for the guest access point was left in trunk mode instead of restricted access mode',
            'The DDoS mitigation system failed to activate',
            'The IDS signature database was out of date',
          ],
          correctIndex: 1,
          explanation: 'The firewall rules themselves were fine — the actual gap was a switch port configuration issue: leaving a guest-facing port in trunk mode let a forged VLAN tag be trusted, bypassing the segmentation the firewall rules assumed was already enforced at the network layer.',
        }),
      },
    ],
  },

  // ─── System & Endpoint Security ───────────────────────────────────────────
  {
    name: 'Keeping Your Own Device Safe',
    description: 'The basics of protecting your own computer — accounts, updates, antivirus, and safe downloading — explained for a total beginner.',
    category: 'System Security',
    difficulty: 'Easy',
    duration: 20,
    type: 'theory',
    order: 31,
    lessons: [
      {
        title: 'Everyday Habits That Protect Your Computer',
        type: 'theory',
        order: 1,
        content: `## Administrator vs. regular account

Most computers let you set up two kinds of accounts: an
**administrator** account that can install software and change system
settings, and a **regular** account that can't. Using a regular
account day-to-day means that if something malicious ever does run,
it's far more limited in what it can do — it doesn't automatically
inherit the power to reconfigure your whole system. Think of it like
carrying a house key vs. a master key that opens every door in the
building.

## Why software updates matter

An update often patches a security hole that was just discovered —
like a burglar finding a lock everyone thought was solid, and the
locksmith rushing out a fix before word gets around. Every day you
delay an update is a day that hole stays open on your machine, even
after it's public knowledge.

## What antivirus / endpoint protection does

At the simplest level, this kind of software watches for known bad
files and suspicious behavior on your device and blocks or removes
them before they can do damage — a basic, always-on safety net running
quietly in the background.

## The risk of "free" pirated software

Downloading a "free version" of software you'd normally have to pay
for, from an unofficial site, is one of the most common ways malware
ends up on a personal computer — the "free" copy is often bundled with
something harmful, and there's no official source vetting what you're
actually installing.

## Putting it together: "Should I click Run as Administrator?"

If a program you didn't expect asks to run "as Administrator," pause.
A document viewer or a simple game has no real reason to need that
level of access — that request itself is a signal worth taking
seriously before clicking "Yes."`,
      },
      {
        title: 'Check Your Understanding',
        type: 'quiz',
        order: 2,
        content: quiz({
          question: 'You downloaded a "free" version of an expensive photo-editing program from a site you\'d never heard of, and when you open it, it unexpectedly asks to run "as Administrator." What\'s the safest response?',
          options: [
            'Click "Yes" — most programs ask for this eventually',
            'Decline, and consider that this combination (pirated software + an unexpected admin request) is a classic malware pattern',
            'Click "Yes" but only use it once',
            'It\'s fine as long as your antivirus doesn\'t complain immediately',
          ],
          correctIndex: 1,
          explanation: 'A photo editor has no legitimate need for administrator-level system access, and pirated software from an unofficial source is one of the most common malware delivery methods — together, these are strong warning signs, not something to click through.',
        }),
      },
    ],
  },
  {
    name: 'System & Endpoint Security',
    description: 'How attackers escalate privileges and persist on a compromised host, and the controls that limit the damage.',
    category: 'System Security',
    difficulty: 'Medium',
    duration: 30,
    type: 'theory',
    order: 32,
    lessons: [
      {
        title: 'From Foothold to Full Compromise',
        type: 'theory',
        order: 1,
        content: `## Getting in is rarely the whole attack

Most breaches start with a low-privilege foothold — a phished
employee account, an exposed service — and become serious only once
the attacker escalates and moves laterally.

## Privilege Escalation

Exploiting a flaw (unpatched software, a misconfigured permission, a
weak service account) to go from a low-privilege user to
administrator/root. Once an attacker has admin rights, they can
disable security tools, read any file, and create persistent backdoor
accounts.

**Defense:** the principle of least privilege — accounts and services
get only the permissions they actually need, nothing more — plus
regular patching, since many escalation paths are known CVEs in
outdated software.

## Malware & Persistence

Once an attacker has code execution, they typically install something
that survives a reboot: a scheduled task, a registry run key, a
malicious service. "Fileless" malware runs entirely in memory to avoid
leaving files for antivirus to scan.

**Defense:** Endpoint Detection and Response (EDR) tools that watch
*behavior* (a process spawning an unexpected child process, unusual
memory injection) rather than only matching known malware signatures.

## Credential Dumping

Tools like Mimikatz can extract cached credentials directly from a
Windows machine's memory (LSASS process), letting an attacker "pass
the hash" to authenticate elsewhere on the network without ever
knowing the actual plaintext password.

**Defense:** Credential Guard / LSASS protection features that isolate
credential material from the rest of the OS, and disabling credential
caching where it isn't needed.

## Data Exfiltration

The final step of many attacks: quietly moving stolen data out of the
network, often disguised as normal traffic (DNS tunneling, encrypted
uploads to a cloud storage service) to avoid triggering alerts.

**Defense:** Data Loss Prevention (DLP) tooling that inspects outbound
traffic for sensitive data patterns, and network monitoring for
unusual outbound volume.`,
      },
      {
        title: 'Walkthrough: A Privilege Escalation Chain',
        type: 'interactive',
        order: 2,
        content: interactive({
          steps: [
            {
              title: 'Initial foothold',
              body: 'An attacker phishes an employee and gets a reverse shell running as that employee\'s low-privilege Windows account on their laptop.',
            },
            {
              title: 'Finding the flaw',
              body: 'The attacker runs a privilege-escalation scanning tool and finds a scheduled task running as SYSTEM that executes a script from a folder the employee\'s account has write access to.',
            },
            {
              title: 'The escalation',
              body: 'The attacker overwrites that script with their own payload. The next time the scheduled task fires, it runs the attacker\'s code — but as SYSTEM, the highest privilege level on the machine.',
            },
            {
              title: 'Where least privilege would have stopped it',
              body: 'If the scheduled task\'s script folder had been locked down so only administrators could write to it (least privilege applied to *file permissions*, not just user accounts), the employee\'s account could never have modified that script in the first place — the escalation path simply wouldn\'t exist.',
            },
          ],
        }),
      },
      {
        title: 'Check Your Understanding',
        type: 'quiz',
        order: 3,
        content: quiz({
          question: 'An EDR tool flags a process because it injected code into another running process\'s memory, even though the file itself matched no known malware signature. What kind of detection is this?',
          options: [
            'Signature-based detection',
            'Behavior-based detection',
            'Network segmentation',
            'Credential dumping',
          ],
          correctIndex: 1,
          explanation: 'Signature matching only catches known threats by their exact file content. Behavior-based detection watches what a process *does* — like injecting into another process\'s memory — which catches novel or fileless malware that has no matching signature.',
        }),
      },
    ],
  },
  {
    name: 'Advanced Persistence & Evasion',
    description: 'Living-off-the-land techniques, process injection, and anti-forensics — how skilled attackers persist without ever dropping a detectable file.',
    category: 'System Security',
    difficulty: 'Hard',
    duration: 45,
    type: 'theory',
    order: 33,
    lessons: [
      {
        title: 'Beyond Escalation: Advanced Persistence & Evasion',
        type: 'theory',
        order: 1,
        content: `## Building on privilege escalation, persistence, and credential dumping

The Medium module covered how an attacker escalates privileges,
persists via scheduled tasks or services, and dumps credentials. This
module covers how a *skilled* attacker does all of that while leaving
almost nothing for a signature-based tool to find.

## Living-off-the-Land

Rather than dropping a custom malicious executable (which antivirus
might flag), an attacker abuses tools that are *already installed and
trusted* on the system — PowerShell, WMI (Windows Management
Instrumentation), and other built-in administrative utilities — to
carry out the same actions a custom tool would. Since the tool itself
is legitimate and signed by the OS vendor, signature-based antivirus
has nothing unusual to flag.

**Defense:** this is exactly why behavior-based detection matters more
here than ever — the tool is legitimate, but the *pattern of how it's
being used* (e.g. PowerShell reaching out to an unusual external
address and downloading a script) is not.

## Process Injection & DLL Side-Loading

Process injection places malicious code into the memory space of a
*legitimate, already-running* process, so it executes under that
trusted process's identity rather than as its own visible process. DLL
side-loading tricks a legitimate application into loading a malicious
DLL instead of the real one, by placing it somewhere the application's
search order checks first.

**Defense:** application allow-listing and monitoring for unexpected
DLL load sources, alongside the same behavior-based EDR approach.

## Anti-Forensics

Once persistence and access are established, a careful attacker works
to erase the trail: clearing event logs that would reveal what
happened, and "timestomping" (altering a file's timestamps) so
forensic analysis can't easily reconstruct a timeline of when a
malicious file was actually created or modified.

**Defense:** forwarding logs to a separate, write-once system in
real time, so an attacker who compromises the endpoint can't also
erase the copy of the evidence that already left the machine.

## Why Behavioral Detection and Honeytokens Still Catch This

Even when no malicious *file* ever appears and every tool used is
"legitimate," the underlying behavior is still detectable: an unusual
process lineage, PowerShell making network connections it never
normally would, or a **honeytoken** (a fake credential or file
planted specifically to be attractive to an attacker, with alerts
wired to fire the instant it's touched) being accessed at all — since
no legitimate process ever has a reason to touch it.`,
      },
      {
        title: 'Walkthrough: A Fileless, Living-off-the-Land Attack Chain',
        type: 'interactive',
        order: 2,
        content: interactive({
          steps: [
            {
              title: 'Initial access — no malware file at all',
              body: 'An attacker gains code execution through a phishing document that, instead of dropping a malicious executable, runs a single PowerShell command directly from memory.',
            },
            {
              title: 'Living off the land for reconnaissance',
              body: 'That PowerShell command uses WMI (a built-in Windows management tool) to enumerate other machines on the network and identify high-value targets — using only tools already trusted and present on every Windows machine.',
            },
            {
              title: 'Process injection for persistence',
              body: 'Rather than installing a new service (which might be noticed), the attacker injects their code into a legitimate, already-running system process, so it blends into a process that\'s always there anyway.',
            },
            {
              title: 'Covering tracks',
              body: 'Before finishing, the attacker clears the relevant Windows event log entries and alters file timestamps on any artifacts left behind, hoping to defeat a later forensic timeline reconstruction.',
            },
            {
              title: 'Where behavioral detection still catches it',
              body: 'Signature-based antivirus finds nothing — there was never a malicious file to match. But a behavioral EDR rule flags the anomaly directly: PowerShell should not normally be making the specific WMI-based network enumeration calls seen here, and that behavioral pattern alone is enough to trigger an alert, entirely independent of whether any file was ever dropped.',
            },
          ],
        }),
      },
      {
        title: 'Check Your Understanding',
        type: 'quiz',
        order: 3,
        content: quiz({
          question: 'In the attack chain above, why did the signature-based antivirus tool miss the attack entirely while the behavior-based EDR rule caught it?',
          options: [
            'The antivirus was out of date',
            'No malicious file ever existed to match against a signature — the attack used only legitimate, already-trusted tools, so only unusual *behavior* (not file content) revealed it',
            'The EDR rule got lucky',
            'The attacker used encryption, which signature tools can never see through',
          ],
          correctIndex: 1,
          explanation: 'Signature-based detection depends on matching known-bad file content — but this attack never introduced a malicious file at all, only misused legitimate, pre-installed tools. Only watching *how* those tools were being used (behavior), not *what* they were, could reveal the attack.',
        }),
      },
    ],
  },

  // ─── Social Engineering ───────────────────────────────────────────────────
  {
    name: 'Trust Your Gut: Everyday Scam Awareness',
    description: 'The handful of red flags behind almost every scam — no technical background needed, just pattern awareness anyone can use.',
    category: 'Social Engineering',
    difficulty: 'Easy',
    duration: 15,
    type: 'theory',
    order: 41,
    lessons: [
      {
        title: 'The Red Flags Behind Almost Every Scam',
        type: 'theory',
        order: 1,
        content: `## Scams follow patterns, even when the story changes

The specific story a scam tells changes constantly — a delivery
problem, a bank alert, a prize you won — but the underlying pressure
tactics are almost always the same handful of things.

## Red flag: urgency

"Act now," "within 24 hours," "immediately" — scammers want you moving
faster than you'd normally stop to think. A genuine, important message
from your bank or a real company almost never depends on you reacting
within minutes.

## Red flag: unexpected requests

A message asking for something you weren't expecting — a password, a
gift card code, remote access to your computer — is worth extra
suspicion specifically *because* it's unexpected. Legitimate
organizations design their processes so they rarely need to ask for
sensitive information out of the blue.

## Red flag: "too good to be true"

An unexpected prize, a huge unclaimed refund, an investment with
guaranteed high returns — if it sounds unusually good for no clear
reason, that's exactly the bait.

## Red flag: being asked to skip a normal step

If a message asks you to bypass a verification step you'd normally
go through ("don't worry about calling to confirm, just do this
directly"), that's a direct attempt to prevent you from checking with
someone who'd recognize the scam.

## How to verify a suspicious request in real life

Never use contact information provided *in* the suspicious message
itself. Instead, look up the organization's real number or website
independently (from a bill, the back of your card, or their official
site) and reach out that way to confirm.

## One more thing: anyone can be targeted

Scams aren't only aimed at people who are "gullible" — they're
engineered to catch anyone in a distracted or stressful moment. Being
cautious isn't about intelligence, it's about recognizing the pattern.`,
      },
      {
        title: 'Check Your Understanding',
        type: 'quiz',
        order: 2,
        content: quiz({
          question: 'A text message says: "Your package couldn\'t be delivered. Confirm your address within 2 hours or it will be returned: [link]." What red flags does this contain?',
          options: [
            'None — this is a normal delivery notification',
            'Urgency (2-hour deadline) and an unexpected request to click a link and enter information',
            'Only urgency — the request itself is completely normal',
            'It\'s only suspicious if the link doesn\'t use https',
          ],
          correctIndex: 1,
          explanation: 'The tight deadline is the classic urgency tactic, and being asked to click a link and provide information you weren\'t expecting to provide is the unexpected-request red flag — together, a strong signal to verify independently (e.g. through the courier\'s official app) rather than clicking.',
        }),
      },
    ],
  },
  {
    name: 'Social Engineering Awareness',
    description: 'Technical controls can\'t stop an attack that targets a person instead of a system. Learn the patterns behind phishing, pretexting, and vishing.',
    category: 'Social Engineering',
    difficulty: 'Medium',
    duration: 25,
    type: 'theory',
    order: 42,
    lessons: [
      {
        title: 'Why Humans Are the Easiest Target',
        type: 'theory',
        order: 1,
        content: `## The path of least resistance

Firewalls and encryption don't stop an attacker who simply asks an
employee for a password convincingly enough. Social engineering
exploits trust, urgency, and authority instead of software flaws.

## Phishing

Fraudulent emails that impersonate a trusted sender (IT, a bank, a
manager) to get the victim to click a malicious link, open an infected
attachment, or enter credentials on a fake login page. The most
effective phishing emails create urgency ("your account will be locked
in 24 hours") to short-circuit careful thinking.

**Defense:** email filtering that checks sender authenticity (SPF,
DKIM, DMARC), and training users to verify unexpected requests through
a separate channel before acting.

## Vishing (Voice Phishing)

The same trick over the phone — an attacker calls pretending to be IT
support and asks the victim to "verify" their password, or calls
finance pretending to be an executive requesting an urgent wire
transfer.

**Defense:** caller verification protocols — call back through a known,
independently-looked-up number rather than trusting caller ID, which
can be spoofed.

## Smishing (SMS Phishing)

Phishing via text message, often with a shortened/obscured link and a
sense of urgency ("your package couldn't be delivered, confirm your
address here").

**Defense:** SMS filtering and training users to never click links in
unexpected texts, verifying through the official app or website
instead.

## Pretexting

Fabricating a plausible scenario to extract information — e.g. posing
as a new contractor who "just needs" a badge to get through the door,
or as a vendor confirming account details before a fake invoice.

**Defense:** verification procedures that don't bend for urgency or
authority claims — confirm any unusual request through an official,
independently-obtained channel, every time, regardless of who's
asking.`,
      },
      {
        title: 'Walkthrough: Anatomy of a Phishing Email',
        type: 'interactive',
        order: 2,
        content: interactive({
          steps: [
            {
              title: 'The email arrives',
              body: 'Subject: "Action Required: Your mailbox is almost full". It appears to come from "IT-Support@company-helpdesk.com" and asks the reader to click a link to "verify storage settings" within the hour.',
            },
            {
              title: 'Red flag 1 — the sender domain',
              body: 'The real company domain is "company.com", not "company-helpdesk.com". Attackers register lookalike domains that pass a casual glance.',
            },
            {
              title: 'Red flag 2 — urgency and a deadline',
              body: '"Within the hour" is designed to make the reader act before they think to double-check. Legitimate IT notices rarely carry a one-hour countdown.',
            },
            {
              title: 'Red flag 3 — the link destination',
              body: 'Hovering over the button shows the actual link goes to a completely unrelated domain, not the company\'s real login page — a clear sign this is a credential-harvesting page.',
            },
            {
              title: 'The correct response',
              body: 'Don\'t click. Report it to IT/security through the official reporting channel, and if genuinely unsure, navigate to the real company site directly (never via the email\'s link) to check for the notice there.',
            },
          ],
        }),
      },
      {
        title: 'Check Your Understanding',
        type: 'quiz',
        order: 3,
        content: quiz({
          question: 'An attacker calls the finance department, claiming to be the CFO traveling abroad, and urgently requests an emergency wire transfer, insisting there\'s no time to verify through normal channels. This is best described as:',
          options: [
            'Phishing',
            'Smishing',
            'Vishing combined with pretexting (impersonating authority + urgency)',
            'Credential dumping',
          ],
          correctIndex: 2,
          explanation: 'This is a phone-based attack (vishing) built on a fabricated scenario and impersonated authority (pretexting) — a classic combination sometimes called "CEO fraud." The insistence on bypassing normal verification is itself the biggest red flag.',
        }),
      },
    ],
  },
  {
    name: 'Advanced Social Engineering & Human-Layer Defense',
    description: 'Spear phishing, OSINT reconnaissance, and multi-channel campaigns — how targeted attacks are built, and the organizational defenses beyond individual vigilance.',
    category: 'Social Engineering',
    difficulty: 'Hard',
    duration: 45,
    type: 'theory',
    order: 43,
    lessons: [
      {
        title: 'Beyond Generic Phishing: Targeted Social Engineering',
        type: 'theory',
        order: 1,
        content: `## Building on phishing, vishing, smishing, and pretexting

The Medium module covered broad, generic attacks sent to many people
at once. This module covers what happens when an attacker invests real
effort researching *one specific* target.

## Spear Phishing and Whaling

A spear-phishing email is built around specific, real details about
its target — their actual manager's name, a project they're genuinely
working on, an event they attended — making it far more convincing
than a generic phishing blast. "Whaling" is the same idea aimed
specifically at senior executives, where the payoff (wire transfer
authority, sensitive data access) is much higher.

## Multi-Channel Campaigns

A sophisticated attacker doesn't rely on a single email. A campaign
might combine an initial reconnaissance email, a follow-up phone call
(vishing) referencing that email to build legitimacy, and even a
physical pretext (a fake vendor visit) — each channel reinforcing the
credibility of the others.

## OSINT Reconnaissance

Open-Source Intelligence (OSINT) is information gathered from what's
already publicly available — a target's LinkedIn profile, company
press releases, conference talks, even out-of-office replies that
reveal a manager's travel schedule. An attacker mines this to learn
who reports to whom, what projects are in progress, and what
vocabulary/tone would sound authentic coming from a specific person.

## Organizational Defenses Beyond Individual Vigilance

Since a sufficiently well-researched spear-phish can fool even a
careful individual, mature organizations layer in defenses that don't
depend solely on one person catching it: **simulated phishing
programs** (regularly testing employees with realistic fake phishing
attempts to build habitual skepticism), **"security champion"
networks** (a trained point-of-contact embedded in each team who
others can quickly check suspicious requests with), and a
**verified-callback culture** where confirming unusual requests
through an independently-obtained number is simply normal practice,
not an awkward exception.`,
      },
      {
        title: 'Walkthrough: From a LinkedIn Post to a Convincing Spear-Phish',
        type: 'interactive',
        order: 2,
        content: interactive({
          steps: [
            {
              title: 'The public post',
              body: 'A finance employee posts on LinkedIn celebrating "closing out Q3 numbers with the team" and tags their manager by name, along with a photo from a specific conference they both attended that week.',
            },
            {
              title: 'The OSINT extraction',
              body: 'An attacker researching this company finds the post and now knows: the employee\'s exact role, their manager\'s real name, that Q3 close is currently happening (a natural moment for finance-related requests), and that both were recently at a specific conference.',
            },
            {
              title: 'Crafting the pretext',
              body: 'The attacker sends an email to the employee, spoofed to appear from the manager, referencing the conference by name ("great seeing you at [conference] — need you to process an urgent Q3-related payment before close, I\'m still traveling and can\'t access the system").',
            },
            {
              title: 'Why it works',
              body: 'Every specific detail in the email is real and independently verifiable by the employee — which is exactly what makes it feel legitimate. The employee has no reason to doubt facts they know to be true; what they can\'t verify is whether the *sender* is actually who they claim to be.',
            },
            {
              title: 'The control that stops it regardless of research quality',
              body: 'No amount of individual carefulness reliably catches every well-researched pretext — but a verified-callback culture does: calling the manager back on their known number (not one provided in the email) to confirm an unusual payment request would immediately reveal the manager never sent it, regardless of how convincing the email\'s details were.',
            },
          ],
        }),
      },
      {
        title: 'Check Your Understanding',
        type: 'quiz',
        order: 3,
        content: quiz({
          question: 'In the scenario above, what specific OSINT detail made the email convincing, and what organizational control (not "just be more careful") would have stopped it regardless of how well-researched the email was?',
          options: [
            'The detail was the employee\'s job title; better spam filtering would have stopped it',
            'The detail was the shared conference/manager reference from a public LinkedIn post; a verified-callback culture (confirming via an independently-known number) would have stopped it regardless',
            'The detail was the company\'s domain name; two-factor authentication would have stopped it',
            'No specific detail mattered — this attack relied purely on luck',
          ],
          correctIndex: 1,
          explanation: 'The convincing element was public, real, verifiable information (the conference and manager\'s name) pulled from a LinkedIn post — no email filter can flag "true facts." The defense that works regardless of how convincing the pretext is stays organizational: verifying unusual requests through a channel the attacker doesn\'t control.',
        }),
      },
    ],
  },

  // ─── Cryptography ─────────────────────────────────────────────────────────
  {
    name: 'Why the Padlock Icon Matters',
    description: 'What encryption actually does for you as an everyday user — no math, no algorithms, just what the padlock icon means and why it matters.',
    category: 'Cryptography',
    difficulty: 'Easy',
    duration: 20,
    type: 'theory',
    order: 51,
    lessons: [
      {
        title: 'Encryption for Everyday Life',
        type: 'theory',
        order: 1,
        content: `## What encryption means, in plain terms

Encryption is like putting a message in a **locked box** that only the
right person has the key to open. Even if someone else gets hold of
the box along the way, they can't see what's inside without that key.

## Why the padlock/https indicator matters

When you see the padlock icon and "https" in your browser's address
bar, it means the connection between you and that website is running
through this kind of locked box — anything you type (a password, a
credit card number) is scrambled before it leaves your device, and
only unscrambled again once it reaches the real destination. Without
it, that same information travels more like a postcard: readable by
anyone handling it in between.

## Postcard vs. sealed envelope, step by step

Imagine sending your password as a physical letter. On an unencrypted
("http") connection, it's written on a **postcard** — the mail carrier,
anyone at the sorting facility, anyone who intercepts it along the
route can simply read it. On an encrypted ("https") connection, the
same message is sealed inside a **tamper-evident envelope** that only
the intended recipient can open — everyone else along the route sees
only a sealed envelope, not the contents.

## What a password manager does for you

A password manager stores your passwords in an encrypted vault — its
own "locked box" — protected by one master password only you know. It
also generates a unique, hard-to-guess password for every site, so
that even if one site is ever breached, that leaked password can't be
reused to unlock any of your other accounts.

## The general idea, summed up

Your data is "scrambled" while it travels, specifically so that even
if an eavesdropper does intercept it along the way, what they get is
useless without the key to unscramble it.`,
      },
      {
        title: 'Check Your Understanding',
        type: 'quiz',
        order: 2,
        content: quiz({
          question: 'You\'re about to log into an account. Site A shows a padlock icon and "https" in the address bar. Site B shows no padlock and "http" only. Which is safe to enter your password on, and why?',
          options: [
            'Site B — plain http is actually faster and just as safe',
            'Site A — the padlock means your connection is sealed like an envelope, not readable in transit like Site B\'s postcard-style connection',
            'Both are equally safe as long as the password itself is strong',
            'Neither — passwords should never be typed into a browser at all',
          ],
          correctIndex: 1,
          explanation: 'The padlock/https on Site A means your login information travels encrypted, sealed from anyone intercepting it along the way. Site B\'s plain http connection sends that same information in a form that could be read in transit — never enter a password there.',
        }),
      },
    ],
  },
  {
    name: 'Cryptography Fundamentals',
    description: 'The building blocks that keep data confidential and verifiable — symmetric/asymmetric encryption, hashing, and how TLS ties them together.',
    category: 'Cryptography',
    difficulty: 'Medium',
    duration: 35,
    type: 'theory',
    order: 52,
    lessons: [
      {
        title: 'Encryption, Hashing, and TLS',
        type: 'theory',
        order: 1,
        content: `## Two different problems, two different tools

Cryptography solves several distinct problems — keeping data secret,
proving it wasn't tampered with, and verifying identity — and mixing
up which tool solves which problem is one of the most common design
mistakes.

## Symmetric Encryption

The same key encrypts and decrypts (e.g. AES). It's fast and suited
for bulk data, but both parties need to already share the key
securely — which is itself a hard problem at scale.

## Asymmetric (Public-Key) Encryption

A key *pair*: a public key anyone can use to encrypt, and a private
key only the owner holds to decrypt (e.g. RSA, ECC). Solves the
key-distribution problem, but is computationally slower than symmetric
encryption.

## Hashing

A one-way function that turns data into a fixed-size fingerprint
(e.g. SHA-256). You can't reverse a hash back into the original data,
and a tiny input change produces a completely different output — which
is what makes hashes useful for verifying integrity and for storing
passwords (never in plain text).

**Important distinction:** hashing is *not* encryption — there's no key
to "decrypt" a hash back to the original value. That's exactly why it's
one-way and appropriate for passwords: even if the hash database
leaks, the original passwords aren't recoverable (assuming a slow,
salted hash like bcrypt/argon2, not a fast general-purpose hash).

## How TLS Combines Both

TLS (what makes a URL "https") uses asymmetric crypto during the
handshake to safely agree on a shared secret, then switches to fast
symmetric encryption for the actual data — getting the key-distribution
benefit of asymmetric crypto and the speed of symmetric crypto for the
bulk of the connection.

## Downgrade Attacks

An attacker forces a connection to negotiate down to a weaker, older
protocol version or cipher that has known weaknesses, then breaks that
weaker encryption.

**Defense:** disabling legacy protocol versions on the server entirely,
and using Authenticated Encryption (AEAD ciphers) that also detect
tampering, not just confidentiality.`,
      },
      {
        title: 'Walkthrough: What Happens During an HTTPS Connection',
        type: 'interactive',
        order: 2,
        content: interactive({
          steps: [
            {
              title: 'The browser connects',
              body: 'You type https://example.com. The browser and server start a TLS handshake before any page data is exchanged.',
            },
            {
              title: 'The server proves its identity',
              body: 'The server sends its certificate, which contains its public key and is digitally signed by a Certificate Authority the browser already trusts. The browser checks the signature and that the domain matches.',
            },
            {
              title: 'Agreeing on a shared secret',
              body: 'Using asymmetric cryptography, the browser and server agree on a symmetric session key without ever transmitting that key in a form an eavesdropper could read — even someone recording all the traffic can\'t derive it.',
            },
            {
              title: 'The fast part',
              body: 'From here on, all the actual page data is encrypted with fast symmetric encryption using that session key. This is why HTTPS doesn\'t feel noticeably slower than HTTP for browsing, despite the crypto overhead of the handshake.',
            },
            {
              title: 'Where a downgrade attack tries to intervene',
              body: 'An on-path attacker might try to make the browser and server negotiate an old, weak TLS version during the handshake. Modern servers refuse to offer those old versions at all, closing off the attack before it can start.',
            },
          ],
        }),
      },
      {
        title: 'Check Your Understanding',
        type: 'quiz',
        order: 3,
        content: quiz({
          question: 'A system stores user passwords by running them through SHA-256 and saving the result, with no way to reverse it back to the original password. What cryptographic operation is being used, and why is it appropriate here?',
          options: [
            'Symmetric encryption — because the same key encrypts and decrypts',
            'Asymmetric encryption — because a public/private key pair is involved',
            'Hashing — because it\'s one-way, so even a leaked database doesn\'t expose the original passwords',
            'A TLS handshake — because it negotiates a shared secret',
          ],
          correctIndex: 2,
          explanation: 'Hashing is the right tool for passwords precisely because it\'s one-way: the system only ever needs to check "does this input hash to the same value?", never to recover the original password, so there\'s no key to steal that would expose it.',
        }),
      },
    ],
  },
  {
    name: 'Applied Cryptographic Failures',
    description: 'Padding oracle attacks, weak randomness, and certificate-validation bypass — why "using crypto" and "using crypto correctly" are very different things.',
    category: 'Cryptography',
    difficulty: 'Hard',
    duration: 45,
    type: 'theory',
    order: 53,
    lessons: [
      {
        title: 'Beyond the Algorithms: How Correctly-Chosen Crypto Still Fails',
        type: 'theory',
        order: 1,
        content: `## Building on symmetric/asymmetric encryption, hashing, and TLS

The Medium module covered the standard cryptographic building blocks
and how TLS combines them. This module covers the uncomfortable truth
those building blocks don't tell you: **choosing a strong algorithm is
necessary, but nowhere near sufficient**, for actual security.

## Padding Oracle Attacks

Some encryption modes require the plaintext to be padded to a fixed
block size before encrypting. If a system reveals — even indirectly,
through a subtly different error message or response time — whether a
decrypted message's padding was valid, an attacker can exploit that
single bit of information repeatedly to recover the original plaintext
**one byte at a time**, without ever learning the encryption key
itself. The encryption algorithm was never broken; the *implementation
detail* of what the system reveals on failure was the actual flaw.

**Defense:** authenticated encryption (AEAD) modes verify integrity
before ever revealing anything about padding validity, eliminating the
oracle entirely.

## Weak or Predictable Randomness

Strong encryption depends on genuinely unpredictable keys. Real-world
failures have repeatedly come from random number generators that
were subtly predictable — reusing a low-entropy seed, or drawing
randomness from a source with far less actual unpredictability than
assumed — letting an attacker narrow down or reconstruct keys that
"looked" random but weren't. The algorithm can be mathematically sound
and still fail entirely if the randomness feeding it isn't.

## Certificate-Validation Bypass

An application can use TLS and still be completely vulnerable if it
doesn't actually *verify* the certificate presented to it — for
example, a mobile app or IoT device that accepts any certificate
without checking it was issued by a trusted authority for the correct
domain. This turns "the connection is encrypted" into a false sense of
security, since an attacker could present their own certificate and
the app would trust it anyway.

## Key-Management Failures

Even flawless algorithms fail if the keys around them are mishandled:
hardcoding an encryption key directly in an application's source code
(anyone who obtains the code obtains the key), or reusing the same key
across many systems (compromising one system now exposes every other
system that shared that key). The core lesson underlying all of this
module: **using cryptography and using cryptography correctly are very
different claims**, and "the app uses AES" says almost nothing on its
own about whether the system is actually secure.`,
      },
      {
        title: 'Walkthrough: Recovering Data with a Padding Oracle',
        type: 'interactive',
        order: 2,
        content: interactive({
          steps: [
            {
              title: 'The oracle',
              body: 'A server decrypts an encrypted cookie on every request and returns a distinct error ("Invalid padding") if the padding is malformed, versus a different error if padding is valid but the content itself is nonsensical. This tiny difference is the "oracle" — a way to ask a yes/no question about the encrypted data\'s structure.',
            },
            {
              title: 'Byte-by-byte recovery, one block at a time',
              body: 'By systematically modifying one byte of the ciphertext and observing which error comes back, an attacker can determine — through repeated queries — what that byte must have been in the original plaintext, without ever knowing the encryption key. Repeating this across every byte position eventually recovers the entire plaintext.',
            },
            {
              title: 'Why this doesn\'t "break" the algorithm',
              body: 'The underlying encryption algorithm (e.g. AES) was never mathematically broken — the flaw was entirely in what the *implementation* revealed through its distinct error responses. A cryptographically perfect algorithm, used this way, is still exploitable.',
            },
            {
              title: 'Where authenticated encryption closes the gap',
              body: 'An AEAD mode (authenticated encryption) checks a cryptographic integrity tag *before* ever processing or reporting anything about padding. If the tag doesn\'t match, the server returns one single generic error — there\'s no longer a distinguishable "padding was wrong" vs. "content was wrong" response to exploit as an oracle at all.',
            },
            {
              title: 'The other half: proper random IVs',
              body: 'This class of attack is also compounded when initialization vectors (IVs) are reused or predictable — using a properly randomized, unique IV for every encryption operation (which AEAD modes require correctly) removes a second angle attackers use to accelerate exactly this kind of recovery.',
            },
          ],
        }),
      },
      {
        title: 'Check Your Understanding',
        type: 'quiz',
        order: 3,
        content: quiz({
          question: 'A system uses AES encryption (a strong, well-vetted algorithm) but is still successfully attacked via a padding oracle. Why doesn\'t "the app uses AES" alone guarantee security, and what else has to be true?',
          options: [
            'AES itself must have been broken — the algorithm needs to be upgraded',
            'The algorithm choice is only one factor; the implementation must also avoid leaking information (like distinct padding-error responses) and use correct modes like AEAD with proper random IVs',
            'Nothing else matters — this was just bad luck',
            'The key length was too short, so a longer AES key would have fully prevented this',
          ],
          correctIndex: 1,
          explanation: 'AES the algorithm was never broken in this scenario — the vulnerability lived entirely in implementation details: what the system revealed on decryption failure. A strong algorithm choice doesn\'t protect against a leaky implementation; using an authenticated encryption mode (AEAD) with properly randomized IVs closes this specific class of failure regardless of which underlying cipher is used.',
        }),
      },
    ],
  },
];
