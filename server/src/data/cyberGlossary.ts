export interface GlossaryEntry {
  terms: string[];
  definition: string;
}

// Curated general cybersecurity terminology, independent of the platform's
// own scenario data. Each entry's `terms` are the keywords/aliases matched
// against student questions by the rule-based AI Tutor.
export const CYBER_GLOSSARY: GlossaryEntry[] = [
  {
    terms: ['phishing'],
    definition:
      'Phishing is a social-engineering attack where an attacker sends fraudulent messages (usually email) that impersonate a trusted sender to trick the recipient into revealing credentials, clicking a malicious link, or downloading malware. It relies on deception rather than technical exploitation.',
  },
  {
    terms: ['spear phishing', 'spear-phishing'],
    definition:
      'Spear phishing is a targeted form of phishing aimed at a specific person or organization, using researched personal details (name, role, colleagues) to make the message far more convincing than a generic phishing blast.',
  },
  {
    terms: ['business email compromise', 'bec'],
    definition:
      'Business Email Compromise is a targeted scam where an attacker impersonates or compromises an executive or vendor email account to trick an employee into making a fraudulent wire transfer or disclosing sensitive data.',
  },
  {
    terms: ['sql injection', 'sqli'],
    definition:
      'SQL Injection is an attack where untrusted input is inserted into a database query without proper sanitization, letting an attacker read, modify, or delete data they should not have access to. It is prevented with parameterized queries/prepared statements and strict input validation.',
  },
  {
    terms: ['cross-site scripting', 'cross site scripting', 'xss'],
    definition:
      'Cross-Site Scripting (XSS) is an attack where malicious script is injected into a web page viewed by other users, letting the attacker run code in their browsers to steal session cookies, deface content, or redirect them. Prevented with output encoding, input sanitization, and a Content Security Policy.',
  },
  {
    terms: ['cross-site request forgery', 'cross site request forgery', 'csrf'],
    definition:
      "Cross-Site Request Forgery (CSRF) tricks a logged-in user's browser into submitting an unwanted request to a site where they're authenticated, performing an action (like changing account settings) without their consent. Prevented with anti-CSRF tokens and SameSite cookies.",
  },
  {
    terms: ['distributed denial of service', 'ddos', 'denial of service', 'dos attack'],
    definition:
      'A Denial-of-Service (DoS) attack floods a system with traffic or requests to exhaust its resources and make it unavailable to legitimate users. A Distributed Denial-of-Service (DDoS) attack does this from many compromised machines (a botnet) at once, making it much harder to block.',
  },
  {
    terms: ['brute force', 'brute-force'],
    definition:
      'A brute-force attack systematically tries many password or key combinations until the correct one is found. It is mitigated with account lockouts, rate limiting, strong password policies, and multi-factor authentication.',
  },
  {
    terms: ['credential stuffing'],
    definition:
      'Credential stuffing uses username/password pairs leaked from one breach to automatically try logging into other, unrelated services — it works because people reuse passwords. Mitigated with unique passwords per site, MFA, and login-anomaly detection.',
  },
  {
    terms: ['man-in-the-middle', 'man in the middle', 'mitm'],
    definition:
      'A Man-in-the-Middle (MITM) attack intercepts communication between two parties who believe they are talking directly to each other, letting the attacker eavesdrop on or alter the traffic. Mitigated with TLS encryption, certificate validation, and certificate pinning.',
  },
  {
    terms: ['session hijacking'],
    definition:
      "Session hijacking is when an attacker steals or predicts a valid session token (e.g. a cookie) to impersonate a logged-in user without needing their password. Mitigated with secure/HttpOnly cookies, TLS everywhere, and session regeneration on login.",
  },
  {
    terms: ['dns spoofing', 'dns cache poisoning', 'cache poisoning'],
    definition:
      'DNS spoofing (cache poisoning) corrupts a DNS resolver\'s cache with a forged record so that a domain name resolves to an attacker-controlled IP address, silently redirecting victims to malicious sites. Mitigated with DNSSEC and validating responses.',
  },
  {
    terms: ['ransomware'],
    definition:
      "Ransomware is malware that encrypts a victim's files (or locks the system) and demands payment for the decryption key. Defended against with offline/immutable backups, endpoint protection, patching, and user training against the phishing emails that usually deliver it.",
  },
  {
    terms: ['malware'],
    definition:
      'Malware is any software intentionally designed to cause harm to a system or its users — including viruses, worms, trojans, ransomware, and spyware. Defended against with endpoint protection (antivirus/EDR), patching, and least-privilege access.',
  },
  {
    terms: ['zero-day', 'zero day', '0-day'],
    definition:
      'A zero-day is a software vulnerability that is unknown to the vendor (and therefore has no patch yet) at the time it is discovered or exploited. Zero-day exploits are especially dangerous because standard signature-based defenses have nothing to detect. Mitigated with defense-in-depth, network segmentation, and behavior-based detection rather than relying on patches alone.',
  },
  {
    terms: ['social engineering'],
    definition:
      'Social engineering is manipulating people, rather than systems, into breaking normal security procedures — e.g. tricking someone into revealing a password or letting an unauthorized person into a building. Phishing, pretexting, and baiting are all forms of it. Mitigated primarily with security-awareness training.',
  },
  {
    terms: ['privilege escalation'],
    definition:
      "Privilege escalation is when an attacker who has gained limited access to a system exploits a bug or misconfiguration to gain higher-level permissions (often full admin/root). Mitigated with least-privilege access, patching, and separating admin from regular accounts.",
  },
  {
    terms: ['insider threat'],
    definition:
      'An insider threat is a security risk that originates from someone with legitimate access — an employee, contractor, or partner — who misuses that access, whether maliciously or through negligence. Mitigated with least privilege, activity monitoring, and offboarding processes.',
  },
  {
    terms: ['advanced persistent threat', 'apt'],
    definition:
      'An Advanced Persistent Threat (APT) is a well-resourced, often state-sponsored attacker that gains long-term, stealthy access to a network to steal data over an extended period, rather than causing immediate, obvious damage.',
  },
  {
    terms: ['supply chain attack'],
    definition:
      "A supply chain attack compromises a trusted third-party component, vendor, or software update mechanism to reach the ultimate target indirectly — e.g. inserting malicious code into a library that thousands of applications depend on.",
  },
  {
    terms: ['keylogger'],
    definition:
      'A keylogger is malware or hardware that secretly records keystrokes to capture passwords, messages, and other sensitive input typed by the victim.',
  },
  {
    terms: ['rootkit'],
    definition:
      "A rootkit is malware designed to hide its own presence and maintain privileged (root/admin) access on a compromised system, often by tampering with the operating system itself, making it very hard to detect with normal tools.",
  },
  {
    terms: ['trojan', 'trojan horse'],
    definition:
      'A trojan is malware disguised as legitimate software; unlike a worm it does not self-replicate — it relies on tricking a user into installing or running it.',
  },
  {
    terms: ['worm'],
    definition:
      'A worm is self-replicating malware that spreads automatically across a network without needing a user to run or open anything, unlike a virus or trojan.',
  },
  {
    terms: ['spyware'],
    definition:
      "Spyware is malware that covertly monitors a user's activity — keystrokes, browsing habits, screen content — and exfiltrates that data to an attacker.",
  },
  {
    terms: ['botnet'],
    definition:
      'A botnet is a network of compromised devices ("bots") controlled remotely by an attacker, typically used to launch DDoS attacks, send spam, or mine cryptocurrency at scale.',
  },
  {
    terms: ['watering hole attack', 'watering hole'],
    definition:
      "A watering-hole attack compromises a website the target audience is known to visit, so that visiting it silently infects them — instead of attacking the target directly.",
  },
  {
    terms: ['typosquatting'],
    definition:
      'Typosquatting registers domain names that are common misspellings of a legitimate site (e.g. "gooogle.com") to catch users who mistype a URL, often for phishing or serving malware.',
  },
  {
    terms: ['firewall'],
    definition:
      'A firewall is a network security control that monitors and filters incoming and outgoing traffic based on defined rules, blocking traffic that does not meet the allowed criteria. It is a perimeter defense, not a substitute for securing the applications behind it.',
  },
  {
    terms: ['intrusion detection system', 'ids'],
    definition:
      'An Intrusion Detection System (IDS) monitors network or system activity for suspicious behavior and alerts defenders, but does not block traffic itself — that is the job of an IPS.',
  },
  {
    terms: ['intrusion prevention system', 'ips'],
    definition:
      'An Intrusion Prevention System (IPS) monitors traffic like an IDS but can actively block or drop malicious traffic in real time rather than only alerting.',
  },
  {
    terms: ['multi-factor authentication', 'multi factor authentication', 'mfa', 'two-factor authentication', 'two factor authentication', '2fa'],
    definition:
      'Multi-Factor Authentication (MFA) requires two or more independent proofs of identity to log in — typically something you know (password), something you have (a phone/token), or something you are (biometrics). It dramatically reduces the impact of a stolen password. Two-Factor Authentication (2FA) is the common two-factor case of MFA.',
  },
  {
    terms: ['encryption'],
    definition:
      "Encryption transforms data into unreadable ciphertext using a key, so only someone with the correct key can decrypt it back to plaintext. Symmetric encryption uses the same key to encrypt and decrypt (fast, used for bulk data); asymmetric encryption uses a public/private key pair (used for secure key exchange and digital signatures).",
  },
  {
    terms: ['hashing', 'hash function'],
    definition:
      'Hashing is a one-way transformation that converts data into a fixed-size digest; unlike encryption it cannot be reversed. It is used to verify integrity and to store passwords (as a salted hash) without storing the password itself.',
  },
  {
    terms: ['vpn', 'virtual private network'],
    definition:
      'A VPN (Virtual Private Network) creates an encrypted tunnel for network traffic between a device and a remote server, hiding the traffic from anyone on the intermediate network and often masking the origin IP address.',
  },
  {
    terms: ['web application firewall', 'waf'],
    definition:
      'A Web Application Firewall (WAF) filters and monitors HTTP traffic to and from a web application specifically, blocking common attack patterns like SQL injection and XSS payloads at the application layer.',
  },
  {
    terms: ['input validation'],
    definition:
      'Input validation checks that user-supplied data conforms to an expected format, type, and range before it is processed or stored, preventing malformed or malicious input from reaching vulnerable code such as database queries or HTML rendering.',
  },
  {
    terms: ['rate limiting'],
    definition:
      'Rate limiting restricts how many requests a client can make in a given time window, mitigating brute-force login attempts, credential stuffing, and denial-of-service traffic.',
  },
  {
    terms: ['least privilege', 'principle of least privilege'],
    definition:
      'The Principle of Least Privilege states that a user, process, or system should only be granted the minimum access necessary to perform its function — limiting the damage possible if that account or process is compromised.',
  },
  {
    terms: ['role-based access control', 'role based access control', 'rbac'],
    definition:
      'Role-Based Access Control (RBAC) grants permissions based on a user\'s assigned role rather than individually, making access easier to manage and audit at scale.',
  },
  {
    terms: ['zero trust', 'zero trust architecture'],
    definition:
      'Zero Trust is a security model that assumes no user or device should be trusted by default, even inside the network perimeter — every request is authenticated, authorized, and encrypted based on identity and context, not network location.',
  },
  {
    terms: ['patch management', 'patching'],
    definition:
      'Patch management is the process of regularly applying vendor updates that fix known vulnerabilities, closing the window of exposure between a flaw being disclosed and it being exploited.',
  },
  {
    terms: ['network segmentation'],
    definition:
      'Network segmentation divides a network into isolated zones so that a compromise in one segment cannot easily spread to others, limiting the blast radius of an attack.',
  },
  {
    terms: ['endpoint detection and response', 'edr'],
    definition:
      'Endpoint Detection and Response (EDR) continuously monitors endpoint devices (laptops, servers) for suspicious behavior, enabling detection and rapid response to threats that bypass traditional antivirus.',
  },
  {
    terms: ['data loss prevention', 'dlp'],
    definition:
      'Data Loss Prevention (DLP) is a set of tools and policies that detect and block sensitive data (like credit card numbers or confidential documents) from leaving an organization through channels like email or USB drives.',
  },
  {
    terms: ['security awareness training', 'security awareness'],
    definition:
      'Security awareness training teaches employees to recognize and respond correctly to threats like phishing and social engineering — the human counterpart to technical controls, since people are frequently the weakest link.',
  },
  {
    terms: ['penetration testing', 'pen testing', 'pentest'],
    definition:
      'Penetration testing is an authorized, simulated attack against a system to identify exploitable vulnerabilities before real attackers do, typically performed by a "red team" and reported back with remediation guidance.',
  },
  {
    terms: ['vulnerability scanning', 'vulnerability scanner'],
    definition:
      'Vulnerability scanning uses automated tools to check systems and software against databases of known vulnerabilities, giving a broad but shallower picture than manual penetration testing.',
  },
  {
    terms: ['incident response'],
    definition:
      'Incident response is the structured process an organization follows to detect, contain, eradicate, and recover from a security breach, followed by a post-incident review to prevent recurrence.',
  },
  {
    terms: ['siem', 'security information and event management'],
    definition:
      'A SIEM (Security Information and Event Management) system aggregates and correlates log data from across an organization to detect suspicious patterns and support incident investigation.',
  },
  {
    terms: ['sandbox', 'sandboxing'],
    definition:
      'Sandboxing runs untrusted code or files in an isolated environment separate from the production system, so that if the code is malicious it cannot affect real systems or data.',
  },
  {
    terms: ['honeypot'],
    definition:
      'A honeypot is a decoy system deliberately exposed to attract attackers, letting defenders study attack techniques and detect intrusions without risking real assets.',
  },
  {
    terms: ['red team', 'blue team'],
    definition:
      "A red team simulates real attackers to test an organization's defenses (offensive security). A blue team is the defenders who detect and respond to those simulated (or real) attacks. Exercises combining both are called purple team exercises.",
  },
  {
    terms: ['cia triad', 'confidentiality integrity availability'],
    definition:
      'The CIA Triad is the foundational model of information security: Confidentiality (only authorized parties can access data), Integrity (data cannot be altered undetected), and Availability (systems and data are accessible when needed). Most security controls map to protecting one or more of these three properties.',
  },
  {
    terms: ['attack surface'],
    definition:
      'The attack surface is the sum of all the points where an unauthorized user could try to enter or extract data from a system — every exposed endpoint, open port, input field, and third-party integration. Reducing it (fewer exposed services, less code, fewer permissions) is a core defensive strategy.',
  },
  {
    terms: ['threat actor'],
    definition:
      'A threat actor is any individual or group that carries out (or could carry out) a malicious attack — ranging from lone hackers and criminal organizations to insider threats and nation-state groups.',
  },
  {
    terms: ['vulnerability'],
    definition:
      'A vulnerability is a weakness in a system — a bug, misconfiguration, or design flaw — that could be exploited to cause harm. A vulnerability only becomes dangerous once an exploit is developed and used against it.',
  },
  {
    terms: ['exploit'],
    definition:
      'An exploit is a piece of code or technique that takes advantage of a specific vulnerability to cause unintended behavior, such as gaining unauthorized access or executing arbitrary code.',
  },
  {
    terms: ['risk assessment'],
    definition:
      'A risk assessment identifies assets, the threats and vulnerabilities that could affect them, and the likelihood and impact of each, so an organization can prioritize which risks to mitigate first.',
  },
  {
    terms: ['defense in depth', 'defense-in-depth'],
    definition:
      'Defense in depth is a strategy of layering multiple, independent security controls (network, host, application, human) so that if one layer fails or is bypassed, others still provide protection — no single point of failure.',
  },
  {
    terms: ['digital forensics'],
    definition:
      'Digital forensics is the practice of collecting, preserving, and analyzing digital evidence after a security incident to determine what happened, how, and by whom, often for legal or remediation purposes.',
  },
  {
    terms: ['public key infrastructure', 'pki'],
    definition:
      'Public Key Infrastructure (PKI) is the system of certificate authorities, digital certificates, and public/private key pairs used to verify identities and enable encrypted, trusted communication (e.g. HTTPS).',
  },
  {
    terms: ['owasp top 10', 'owasp'],
    definition:
      'The OWASP Top 10 is a regularly updated industry-standard list of the most critical web application security risks (such as injection flaws, broken access control, and security misconfiguration), widely used as a baseline for secure development.',
  },
];
