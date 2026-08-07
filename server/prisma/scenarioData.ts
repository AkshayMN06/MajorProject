// Generates the Scenario Assessment content library: for each module
// (category) and each difficulty, at least 10 real, distinctly-named
// scenarios, each with real attack techniques matched to their real
// countermeasures. Built programmatically from curated attack/defense
// pairs and target-system names rather than hand-typed per scenario, so
// the (category x difficulty x 10) matrix stays easy to extend.

export interface OptionDef {
  id: string;
  name: string;
  description: string;
  difficulty?: string;
  effectiveness?: string;
  category: string;
}

export interface ScenarioDef {
  name: string;
  description: string;
  category: string;
  difficulty: string;
  targetSystem: string;
  context: string;
  attackOptions: OptionDef[];
  defenseOptions: OptionDef[];
}

interface Pair {
  attackName: string;
  attackDesc: string;
  defenseName: string;
  defenseDesc: string;
  subcat: string;
}

function p(attackName: string, attackDesc: string, defenseName: string, defenseDesc: string, subcat: string): Pair {
  return { attackName, attackDesc, defenseName, defenseDesc, subcat };
}

function buildTier(
  category: string,
  difficulty: string,
  targetSystem: string,
  contextOf: (name: string) => string,
  pairs: Pair[],
  targetNames: string[]
): ScenarioDef[] {
  return targetNames.map((name, i) => {
    const chosen = [pairs[i % pairs.length], pairs[(i + 1) % pairs.length], pairs[(i + 2) % pairs.length]];
    const attackOptions: OptionDef[] = chosen.map((pair, idx) => ({
      id: `a${idx + 1}`,
      name: pair.attackName,
      description: pair.attackDesc,
      difficulty,
      category: pair.subcat,
    }));
    const defenseOptions: OptionDef[] = chosen.map((pair, idx) => ({
      id: `d${idx + 1}`,
      name: pair.defenseName,
      description: pair.defenseDesc,
      effectiveness: 'High',
      category: pair.subcat,
    }));
    return {
      name,
      description: `Assess attack and defense strategies for the ${name}.`,
      category,
      difficulty,
      targetSystem,
      context: contextOf(name),
      attackOptions,
      defenseOptions,
    };
  });
}

// ---------------------------------------------------------------------------
// WEB SECURITY
// ---------------------------------------------------------------------------

const webEasyPairs: Pair[] = [
  p('Cross-Site Scripting (XSS)', 'Inject scripts via unsanitized URL parameters.', 'Output Encoding', 'Encode all user-supplied output.', 'Web Security'),
  p('Clickjacking', 'Trick users into clicking hidden UI elements.', 'X-Frame-Options / CSP', 'Block the page from being framed.', 'Web Security'),
  p('Directory Listing Exposure', 'Browse exposed server directories for files.', 'Disable Directory Listing', 'Turn off server directory indexing.', 'System Security'),
  p('Weak Password Policy Exploit', 'Guess weak account passwords.', 'Strong Password Policy', 'Enforce complexity and minimum length.', 'Authentication'),
  p('Open Redirect', 'Redirect users to a malicious site via a trusted link.', 'Redirect Allowlist', 'Only allow redirects to approved destinations.', 'Web Security'),
  p('Insecure CORS Configuration', 'Read cross-origin data via misconfigured CORS.', 'Strict CORS Policy', 'Restrict allowed origins explicitly.', 'Web Security'),
  p('Cookie Theft via Unencrypted Connection', 'Steal cookies sent over plain HTTP.', 'HTTPS Enforcement (HSTS)', 'Force encrypted connections site-wide.', 'Network Security'),
  p('Default Admin Panel Access', 'Log into an exposed default admin page.', 'Restrict/Rename Admin Endpoints', 'Hide and restrict administrative interfaces.', 'Access Control'),
];

const webMediumPairs: Pair[] = [
  p('SQL Injection', 'Exploit unsanitized database queries.', 'Parameterized Queries', 'Use prepared statements for all queries.', 'Web Security'),
  p('Cross-Site Request Forgery (CSRF)', 'Forge authenticated requests from another site.', 'Anti-CSRF Tokens', 'Validate a unique token on state-changing requests.', 'Web Security'),
  p('Insecure Direct Object Reference (IDOR)', "Access other users' records by changing an ID.", 'Object-Level Authorization', 'Verify ownership on every resource access.', 'Access Control'),
  p('Session Fixation', 'Force a victim to use a known session ID.', 'Session Regeneration', 'Issue a new session ID after login.', 'Authentication'),
  p('File Upload Vulnerability', 'Upload a malicious script disguised as a file.', 'File Type Validation & Sandboxing', 'Restrict file types and scan uploads.', 'System Security'),
  p('HTTP Parameter Pollution', 'Send duplicate parameters to confuse validation.', 'Strict Parameter Parsing', 'Reject ambiguous duplicate parameters.', 'Web Security'),
  p('Broken Access Control (Vertical)', 'Access admin functions as a regular user.', 'Server-Side Role Enforcement', 'Enforce role checks on every endpoint.', 'Access Control'),
  p('Cache Poisoning', 'Poison a shared cache with malicious content.', 'Cache Key Normalization', 'Validate and normalize cache keys strictly.', 'Web Security'),
];

const webHardPairs: Pair[] = [
  p('Server-Side Request Forgery (SSRF)', 'Trick the server into requesting internal resources.', 'Egress Filtering & Allowlisting', 'Restrict outbound server requests to approved hosts.', 'Web Security'),
  p('XML External Entity (XXE) Injection', 'Exploit XML parsers to read internal files.', 'XML Parser Hardening', 'Disable external entity resolution.', 'Web Security'),
  p('Insecure Deserialization', 'Execute code via a crafted serialized object.', 'Safe Deserialization & Type Checks', 'Validate and restrict deserialized types.', 'System Security'),
  p('Server-Side Template Injection (SSTI)', 'Inject template syntax to execute server code.', 'Template Sandboxing', 'Run templates in a restricted execution context.', 'Web Security'),
  p('Business Logic Abuse (API)', 'Chain legitimate API calls to bypass workflow rules.', 'API Gateway & Schema Validation', 'Enforce strict request schemas and workflow order.', 'Web Security'),
  p('Prototype Pollution', 'Inject properties into JavaScript object prototypes.', 'Object Freezing & Schema Validation', 'Freeze prototypes and validate object shapes.', 'Web Security'),
  p('GraphQL Introspection Abuse', 'Use introspection to map hidden API fields.', 'Disable Introspection & Depth Limiting', 'Disable introspection and limit query depth in production.', 'Web Security'),
  p('Race Condition in Checkout Flow', 'Exploit timing gaps to duplicate a transaction.', 'Idempotency Keys & Locking', 'Enforce atomic, idempotent transaction handling.', 'Web Security'),
];

const webEasyTargets = ['Personal Blog Platform', 'Community Forum', 'Restaurant Ordering Site', 'Local News Website', 'Online Recipe Sharing Site', 'Small Business Storefront', 'Event Ticketing Widget', 'Photo Gallery Site', 'Classroom Assignment Portal', 'Public Library Catalog'];
const webMediumTargets = ['Online Banking Portal', 'E-Commerce Platform', 'University Portal', 'Mobile Banking App', 'Insurance Claims Portal', 'Hotel Booking Platform', 'Ride-Sharing App Backend', 'Telehealth Patient Portal', 'Subscription Billing Platform', 'Real Estate Listing Platform'];
const webHardTargets = ['Government Tax Filing Portal', 'Stock Trading Web Platform', 'Healthcare Records Web Gateway', 'Payment Gateway API', 'Cloud SaaS Admin Console', 'Airline Reservation System', 'Defense Contractor Portal', 'Cryptocurrency Exchange Web App', 'National ID Verification Portal', 'Enterprise HR Management System'];

const webContext = (name: string) => `${name} handles sensitive user data and is a common target for web-based attacks.`;

// ---------------------------------------------------------------------------
// NETWORK SECURITY
// ---------------------------------------------------------------------------

const netEasyPairs: Pair[] = [
  p('Deauthentication Attack', 'Force devices off a Wi-Fi network.', 'Protected Management Frames (802.11w)', 'Prevent forged deauth frames.', 'Network Security'),
  p('Port Scanning', 'Enumerate open ports and services.', 'Firewall Rule Hardening', 'Close unused ports and restrict access.', 'Network Security'),
  p('Unencrypted Traffic Sniffing', 'Capture plaintext data on the network.', 'Network-wide TLS Encryption', 'Encrypt all traffic in transit.', 'Cryptography'),
  p('Rogue Access Point', 'Set up an unauthorized Wi-Fi hotspot.', 'Wireless Intrusion Detection', 'Detect and flag unauthorized access points.', 'Network Security'),
  p('Ping Flood', 'Overwhelm a host with ICMP requests.', 'Rate Limiting & ICMP Throttling', 'Limit ICMP request rates.', 'Network Security'),
  p('Unsecured IoT Device on Network', 'Pivot through a weak IoT device.', 'Network Segmentation for IoT', 'Isolate IoT devices on a separate VLAN.', 'Network Security'),
  p('Default Router Credentials', "Access the router's admin panel with default creds.", 'Mandatory Credential Change', 'Force new credentials on setup.', 'Authentication'),
  p('SSID Broadcast Exploitation', 'Target a network by its broadcast SSID name.', 'Hidden SSID & MAC Filtering', 'Reduce visibility and control device access.', 'Network Security'),
];

const netMediumPairs: Pair[] = [
  p('DNS Spoofing', 'Redirect traffic via forged DNS responses.', 'DNSSEC', 'Cryptographically sign DNS responses.', 'Network Security'),
  p('Man-in-the-Middle (MITM)', 'Intercept traffic between two parties.', 'Certificate Pinning', 'Pin expected certificates to detect forged ones.', 'Cryptography'),
  p('ARP Spoofing', 'Redirect local traffic via forged ARP replies.', 'Dynamic ARP Inspection', 'Validate ARP packets against known bindings.', 'Network Security'),
  p('VLAN Hopping', 'Bypass VLAN segmentation to reach other segments.', 'Private VLANs & Port Security', 'Restrict inter-VLAN traffic and switch ports.', 'Network Security'),
  p('DNS Tunneling', 'Exfiltrate data hidden inside DNS queries.', 'DNS Query Pattern Analysis', 'Detect abnormal DNS query volume and structure.', 'Network Security'),
  p('Session Hijacking over Network', 'Steal an active session via network interception.', 'Encrypted Sessions & Secure Cookies', 'Encrypt sessions end-to-end.', 'Authentication'),
  p('SNMP Enumeration', 'Extract device info via weak SNMP community strings.', 'SNMP Hardening', 'Disable default community strings and restrict access.', 'Network Security'),
  p('Rogue DHCP Server', 'Hand out malicious network settings via a fake DHCP server.', 'DHCP Snooping', 'Validate DHCP responses against trusted ports.', 'Network Security'),
];

const netHardPairs: Pair[] = [
  p('Distributed Denial of Service (DDoS)', 'Flood the network from many sources at once.', 'DDoS Mitigation & Traffic Scrubbing', 'Absorb and filter malicious traffic upstream.', 'Network Security'),
  p('BGP Hijacking', 'Announce false routes to redirect internet traffic.', 'RPKI Route Validation', 'Cryptographically validate route announcements.', 'Network Security'),
  p('Advanced Evasion via Protocol Manipulation', 'Abuse edge cases in network protocols to bypass inspection.', 'Deep Packet Inspection', 'Fully parse and validate protocol conformance.', 'Network Security'),
  p('Signal Jamming', 'Block radio transmissions with noise.', 'Frequency Hopping Spread Spectrum', 'Rapidly switch frequencies to evade jamming.', 'Network Security'),
  p('Domain Hijacking', 'Steal registrar credentials to redirect a domain.', 'Registrar Lock & MFA', 'Lock domain transfers and require MFA.', 'Access Control'),
  p('SYN Flood', 'Exhaust server connections with half-open TCP requests.', 'SYN Cookies', 'Avoid holding state for unverified connections.', 'Network Security'),
  p('Amplification Attack (NTP/DNS)', 'Reflect and amplify traffic off misconfigured servers.', 'Ingress/Egress Filtering (BCP38)', 'Block spoofed source-address traffic.', 'Network Security'),
  p('Covert Channel over Network Protocols', 'Exfiltrate data using protocol side-channels.', 'Deep Traffic Behavior Analysis', 'Baseline and flag abnormal protocol usage.', 'Network Security'),
];

const netEasyTargets = ['Home Wi-Fi Network', 'Small Office LAN', 'Coffee Shop Public Wi-Fi', 'Campus Guest Network', 'Retail Store Network', 'Co-working Space Network', 'Library Public Network', 'Apartment Complex Network', 'Community Center Network', 'Hotel Guest Wi-Fi'];
const netMediumTargets = ['Corporate Email System', 'DNS Infrastructure', 'Wireless Corporate Network', 'Branch Office VPN', 'School District Network', 'Regional ISP Network', 'Hospital Wireless Network', 'Manufacturing Plant Network', 'Logistics Tracking Network', 'Municipal Public Wi-Fi'];
const netHardTargets = ['Government Network', 'Internet Exchange Point', 'National ISP Backbone', 'Military Communications Network', 'Financial Data Center Network', 'Power Utility Communications Network', 'Airport Network Infrastructure', 'Cloud Provider Backbone', 'Telecom Core Network', 'Emergency Services Radio Network'];

const netContext = (name: string) => `${name} carries critical network traffic that attackers seek to intercept or disrupt.`;

// ---------------------------------------------------------------------------
// SYSTEM SECURITY
// ---------------------------------------------------------------------------

const sysEasyPairs: Pair[] = [
  p('Weak Default Credentials', 'Log in using unchanged factory default passwords.', 'Mandatory Credential Rotation', 'Force password change on first use.', 'Authentication'),
  p('Outdated Software Exploit', 'Exploit a known bug in unpatched software.', 'Patch Management', 'Apply vendor security updates promptly.', 'System Security'),
  p('Unrestricted File Permissions', 'Access files with overly permissive settings.', 'Least Privilege File Permissions', 'Restrict file access to required users only.', 'Access Control'),
  p('USB Malware Drop', 'Infect a system via a malicious USB drive.', 'USB Port Lockdown', 'Disable or restrict removable media.', 'System Security'),
  p('Unsecured Backup Exposure', 'Access unprotected backup files.', 'Encrypted, Access-Controlled Backups', 'Encrypt backups and restrict access.', 'System Security'),
  p('Unpatched Legacy OS Exploit', 'Exploit a known flaw in an old OS version.', 'OS End-of-Life Replacement', 'Retire and replace unsupported systems.', 'System Security'),
  p('Shared Local Admin Account', 'Use a shared admin account left on many machines.', 'Unique Local Admin Passwords', 'Randomize local admin credentials per machine.', 'Authentication'),
  p('Autorun Malware via Removable Media', 'Trigger malware automatically from a removable disk.', 'Disable Autorun', 'Disable automatic execution from removable media.', 'System Security'),
];

const sysMediumPairs: Pair[] = [
  p('Ransomware', 'Encrypt files and demand payment.', 'Offline / Immutable Backups', 'Restore from backups without paying.', 'System Security'),
  p('Privilege Escalation', 'Exploit a flaw to gain admin rights.', 'Least Privilege & RBAC', 'Limit accounts to minimum required permissions.', 'Access Control'),
  p('Fileless Malware', 'Run malicious code entirely in memory.', 'Behavior-Based EDR', 'Detect malicious behavior, not just file signatures.', 'System Security'),
  p('Data Exfiltration', 'Quietly transfer sensitive data out of the network.', 'Data Loss Prevention (DLP)', 'Detect and block unauthorized data transfers.', 'Network Security'),
  p('Credential Dumping', 'Extract stored credentials from memory.', 'Credential Guard & LSASS Protection', 'Protect credential storage in memory.', 'Authentication'),
  p('Living-off-the-Land Techniques', 'Abuse built-in system tools to avoid detection.', 'Application Allowlisting', 'Only permit approved executables to run.', 'System Security'),
  p('Race Condition Exploit (TOCTOU)', 'Exploit a timing gap between check and use.', 'Atomic Operations & Locking', 'Use atomic checks to eliminate timing gaps.', 'System Security'),
  p('Backdoor Installation', 'Plant hidden remote access into a system.', 'Host-based Intrusion Detection', 'Monitor for unauthorized persistence mechanisms.', 'System Security'),
];

const sysHardPairs: Pair[] = [
  p('Zero-Day Exploit', 'Exploit an unknown, unpatched vulnerability.', 'Anomaly & Behavior Detection', 'Flag unusual system behavior in real time.', 'System Security'),
  p('Supply Chain Attack', 'Compromise a trusted software dependency.', 'SBOM & Dependency Scanning', 'Track and vet every software component.', 'System Security'),
  p('Container Escape', 'Break out of a container to the host.', 'Container Sandboxing (gVisor/AppArmor)', 'Isolate containers from the host kernel.', 'System Security'),
  p('Rootkit Installation', 'Hide malicious code deep in the OS.', 'Secure Boot & Rootkit Scanning', 'Verify boot integrity and scan for rootkits.', 'System Security'),
  p('Firmware Tampering', 'Modify device firmware to persist access.', 'Firmware Signing & Attestation', 'Only run cryptographically signed firmware.', 'System Security'),
  p('Kernel Exploit', 'Exploit a flaw in the OS kernel for full control.', 'Kernel Hardening & Patching', 'Patch promptly and enable kernel protections.', 'System Security'),
  p('Memory Corruption (Buffer Overflow)', 'Overwrite memory to execute arbitrary code.', 'ASLR & Stack Canaries', 'Randomize memory layout and detect overflow.', 'System Security'),
  p('Advanced Persistent Threat (APT) Campaign', 'Maintain long-term stealthy access to steal data.', 'Threat Hunting & SIEM Correlation', 'Proactively hunt for stealthy indicators of compromise.', 'Network Security'),
];

const sysEasyTargets = ['Personal Laptop Fleet', 'Office Printer Network', 'Employee Workstations', 'Point-of-Sale Terminals', 'Home Security Camera System', 'Small Business Server', 'School Computer Lab', 'Shared File Server', 'Reception Desk Kiosk', 'Warehouse Inventory Scanner'];
const sysMediumTargets = ['Healthcare Database', 'Corporate File Server', 'HR Records System', 'University Research Servers', 'E-Commerce Backend Servers', 'Call Center Systems', 'Payroll Processing System', 'Legal Document Management System', 'Insurance Claims Server', 'Municipal Records System'];
const sysHardTargets = ['Cloud Infrastructure', 'Financial Trading System', 'Power Grid SCADA', 'Air Traffic Control System', 'Nuclear Facility Control System', 'Defense Weapons Systems Network', 'National Voting System Infrastructure', 'Satellite Ground Control System', 'Water Treatment SCADA', 'Autonomous Vehicle Fleet Backend'];

const sysContext = (name: string) => `${name} runs critical operations and is a high-value target for system-level compromise.`;

// ---------------------------------------------------------------------------
// SOCIAL ENGINEERING
// ---------------------------------------------------------------------------

const socEasyPairs: Pair[] = [
  p('Phishing', 'Send fake emails to trick employees.', 'Email Filtering', 'Block phishing emails before delivery.', 'Social Engineering'),
  p('Baiting', 'Leave infected media where victims will find it.', 'Employee Awareness on Baiting', 'Train staff to avoid unknown devices/media.', 'Social Engineering'),
  p('Tailgating', 'Follow an employee through a secure door.', 'Badge Access & Visitor Escort', 'Require badge checks and escort visitors.', 'Access Control'),
  p('Shoulder Surfing', 'Watch someone type their password.', 'Privacy Screens & Awareness', 'Use privacy filters and lock screens.', 'Social Engineering'),
  p('Dumpster Diving', 'Search discarded documents for sensitive info.', 'Document Shredding Policy', 'Shred sensitive documents before disposal.', 'Social Engineering'),
  p('Fake Tech Support Call', 'Impersonate support to gain remote access.', 'Verified Support Channels Only', 'Only accept support via official channels.', 'Social Engineering'),
  p('Free USB Giveaway Bait', 'Distribute infected USB drives as promotional items.', 'Ban Unknown External Devices', 'Prohibit plugging in unverified devices.', 'Social Engineering'),
  p('Social Media Reconnaissance', 'Gather personal info from public profiles for a pretext.', 'Employee Privacy Awareness', 'Train staff to limit public exposure of work details.', 'Social Engineering'),
];

const socMediumPairs: Pair[] = [
  p('Spear Phishing', 'Send a targeted, personalized phishing email.', 'Security Awareness Training', 'Train staff to recognize targeted lures.', 'Social Engineering'),
  p('Vishing (Voice Phishing)', 'Call and impersonate IT support for credentials.', 'Caller Verification Protocols', 'Verify caller identity through a known channel.', 'Social Engineering'),
  p('Smishing (SMS Phishing)', 'Send fraudulent links via text message.', 'SMS Filtering & User Verification', 'Filter suspicious texts and verify links.', 'Social Engineering'),
  p('Pretexting', 'Fabricate a scenario to extract information.', 'Verification Procedures', 'Confirm requests through official channels.', 'Social Engineering'),
  p('Impersonation', 'Pose as an employee or vendor to gain access.', 'Identity Verification Policy', 'Require ID checks for access requests.', 'Access Control'),
  p('Fake Job Offer Lure', 'Send a fraudulent job offer with a malicious attachment.', 'Attachment Sandboxing', 'Scan and sandbox all email attachments.', 'Social Engineering'),
  p('Authority Impersonation (Fake Executive)', 'Pose as a manager to pressure quick compliance.', 'Out-of-Band Confirmation', 'Confirm unusual requests via a separate channel.', 'Social Engineering'),
  p('Fake Survey/Contest Phishing', 'Collect credentials via a fake survey or contest.', 'Link/Domain Reputation Checking', 'Check link reputation before clicking.', 'Social Engineering'),
];

const socHardPairs: Pair[] = [
  p('Business Email Compromise (BEC)', 'Impersonate an executive to authorize a fraudulent transfer.', 'Financial Approval Workflows', 'Require multi-person sign-off on transfers.', 'Social Engineering'),
  p('Whaling', 'Target a senior executive with a tailored attack.', 'Executive Protection Training', 'Give executives specialized security training.', 'Social Engineering'),
  p('Watering Hole Attack', 'Compromise a site the target frequently visits.', 'Web Filtering & EDR', 'Block malicious sites and detect infections.', 'Web Security'),
  p('Quid Pro Quo', 'Offer a fake service in exchange for credentials.', 'Skepticism Training & Verification', 'Train staff to verify unsolicited offers.', 'Social Engineering'),
  p('USB Drop Attack (Targeted)', 'Plant a labeled USB drive for a specific target.', 'USB Port Lockdown & Awareness', 'Disable unauthorized removable media by policy.', 'System Security'),
  p('Deepfake Voice Impersonation', "Use AI-generated audio to impersonate an executive's voice.", 'Voice Verification Protocols', 'Require a secondary verification for voice requests.', 'Social Engineering'),
  p('Long-Term Insider Cultivation', 'Groom an insider over time for eventual data access.', 'Behavioral Monitoring & Insider Threat Program', 'Monitor for gradual behavioral changes and access anomalies.', 'Access Control'),
  p('Coordinated Multi-Channel Social Engineering', 'Combine email, phone, and in-person tactics in one campaign.', 'Cross-Channel Incident Correlation', 'Correlate suspicious activity across communication channels.', 'Social Engineering'),
];

const socEasyTargets = ['Retail Store Staff', 'Small Business Reception', 'Local Nonprofit Office', 'Community Bank Branch', 'School Front Office', 'Coworking Space Members', 'Neighborhood Clinic Staff', 'Startup Office Team', 'Restaurant Chain Staff', 'Gym Front Desk'];
const socMediumTargets = ['Social Media Platform', 'Corporate Helpdesk', 'Regional Bank Call Center', 'Hospital Administrative Staff', 'University Admissions Office', 'Insurance Sales Team', 'HR Onboarding Team', 'IT Support Desk', 'Customer Service Center', 'Property Management Office'];
const socHardTargets = ['Fortune 500 Executive Office', 'Government Agency Staff', 'Defense Contractor Personnel', 'Investment Bank Trading Desk', 'Hospital Executive Leadership', 'National Media Organization', 'Political Campaign Staff', 'Critical Infrastructure Operators', 'Airline Executive Team', 'Pharmaceutical Company Leadership'];

const socContext = (name: string) => `Staff at ${name} are targeted to bypass technical security controls through human manipulation.`;

// ---------------------------------------------------------------------------
// CRYPTOGRAPHY
// ---------------------------------------------------------------------------

const cryptoEasyPairs: Pair[] = [
  p('Weak Password Hashing Crack', 'Crack unsalted, weakly hashed passwords.', 'Salted Strong Hashing (bcrypt/Argon2)', 'Use salted, slow hashing algorithms.', 'Authentication'),
  p('Outdated Cipher Exploit', 'Exploit a deprecated, weak cipher (e.g. DES).', 'Modern Cipher Suites (AES-256)', 'Use strong, current encryption standards.', 'Cryptography'),
  p('Unencrypted Data Storage', 'Read sensitive data stored in plaintext.', 'Encryption at Rest', 'Encrypt stored data with strong keys.', 'Cryptography'),
  p('Predictable Token Generation', 'Guess predictable session/reset tokens.', 'Cryptographically Secure RNG', 'Generate tokens with a CSPRNG.', 'Cryptography'),
  p('Weak Wi-Fi Encryption Crack', 'Crack outdated WEP/WPA encryption.', 'WPA3 Encryption', 'Use the current strong Wi-Fi standard.', 'Network Security'),
  p('Hardcoded Secret Key Discovery', 'Find an encryption key hardcoded in source code.', 'Secrets Management (Vault)', 'Store keys in a dedicated secrets manager.', 'System Security'),
  p('ECB Mode Pattern Leakage', 'Exploit encryption mode that leaks data patterns.', 'Secure Cipher Modes (GCM/CBC)', 'Use cipher modes that hide data patterns.', 'Cryptography'),
  p('Weak Key Length Brute Force', 'Brute-force a short encryption key.', 'Minimum Key Length Standards', 'Enforce modern minimum key lengths.', 'Cryptography'),
];

const cryptoMediumPairs: Pair[] = [
  p('Replay Attack', 'Capture and resend a valid encrypted message.', 'Timestamp & Nonce Validation', 'Reject repeated or stale messages.', 'Cryptography'),
  p('Downgrade Attack', 'Force a connection to use a weaker protocol.', 'TLS Version Enforcement', 'Reject connections below a minimum TLS version.', 'Cryptography'),
  p('Padding Oracle Attack', 'Exploit error responses to decrypt ciphertext.', 'Authenticated Encryption (AEAD)', 'Use encryption that also verifies integrity.', 'Cryptography'),
  p('Man-in-the-Middle on Key Exchange', 'Intercept and alter a key exchange.', 'Mutual TLS & Certificate Pinning', "Verify both parties' certificates explicitly.", 'Network Security'),
  p('Hash Collision Attack', 'Find two inputs with the same hash.', 'Collision-Resistant Hashing (SHA-256+)', 'Use modern, collision-resistant hash functions.', 'Cryptography'),
  p('Insecure Random Session Token', 'Predict session tokens from a weak generator.', 'CSPRNG-based Tokens', 'Generate tokens with a cryptographically secure RNG.', 'Authentication'),
  p('Mixed Content Downgrade', 'Force part of a session to unencrypted HTTP.', 'Strict Transport Security (HSTS)', 'Force HTTPS for the entire session.', 'Cryptography'),
  p('Key Reuse Across Systems', 'Exploit a key reused across multiple systems.', 'Per-System Key Derivation', 'Derive unique keys per system/purpose.', 'Cryptography'),
];

const cryptoHardPairs: Pair[] = [
  p('Side-Channel Attack', 'Extract keys via power/timing analysis.', 'Constant-Time Algorithms & Hardware Shielding', 'Eliminate timing/power signal leakage.', 'Cryptography'),
  p('Cryptanalysis of Custom Cipher', 'Break a non-standard, unproven encryption scheme.', 'Adopt Peer-Reviewed Standard Algorithms', 'Use vetted, published cryptographic standards.', 'Cryptography'),
  p('Quantum Computing Threat', 'Future-break RSA/ECC with a quantum computer.', 'Post-Quantum Cryptography', 'Adopt quantum-resistant algorithms.', 'Cryptography'),
  p('Certificate Forgery', 'Forge a trusted certificate to impersonate a server.', 'Certificate Transparency Monitoring', 'Monitor CT logs for unauthorized certificates.', 'Access Control'),
  p('Birthday Attack on Weak Hash', 'Exploit hash collisions to forge signatures.', 'Long, Modern Hash Digests', 'Use hash functions with sufficiently large output.', 'Cryptography'),
  p('Fault Injection Attack', 'Induce hardware faults to leak key material.', 'Fault-Tolerant Cryptographic Hardware', 'Detect and respond to induced fault conditions.', 'Cryptography'),
  p('Chosen-Plaintext Attack', 'Analyze encryption of chosen inputs to derive the key.', 'Semantically Secure Encryption Schemes', 'Use encryption resistant to chosen-plaintext analysis.', 'Cryptography'),
  p('Rogue Certificate Authority Compromise', 'Issue fraudulent certificates via a compromised CA.', 'Certificate Transparency & CA Pinning', 'Detect and reject unauthorized certificate issuance.', 'Access Control'),
];

const cryptoEasyTargets = ['Personal Password Manager', 'Small Website Login System', 'Home Wi-Fi Encryption', 'Local File Backup Tool', 'Student Portal Login', 'Community App Login', 'Basic Chat App Encryption', 'Personal Cloud Storage', 'Freelancer Invoice System', 'Simple IoT Sensor Link'];
const cryptoMediumTargets = ['Corporate VPN Tunnel', 'Mobile App Session Tokens', 'E-Commerce Payment Encryption', 'Cloud Storage Provider Encryption', 'Enterprise Single Sign-On', 'Messaging App End-to-End Encryption', 'API Authentication Tokens', 'Document Signing Service', 'Health App Data Sync', 'Banking OTP System'];
const cryptoHardTargets = ['Military Communications', 'National ID Cryptosystem', 'Central Bank Settlement System', 'Government Classified Network', 'Certificate Authority Infrastructure', 'Cryptocurrency Wallet Infrastructure', 'Satellite Command Encryption', 'Election Results Transmission System', 'Cross-Border Diplomatic Comms', 'Critical Infrastructure Key Management'];

const cryptoContext = (name: string) => `${name} relies on cryptographic protections that attackers attempt to break or bypass.`;

// ---------------------------------------------------------------------------

export const SCENARIOS: ScenarioDef[] = [
  ...buildTier('Web Security', 'Easy', 'Web Application', webContext, webEasyPairs, webEasyTargets),
  ...buildTier('Web Security', 'Medium', 'Web Application', webContext, webMediumPairs, webMediumTargets),
  ...buildTier('Web Security', 'Hard', 'Web Application', webContext, webHardPairs, webHardTargets),

  ...buildTier('Network Security', 'Easy', 'Network Infrastructure', netContext, netEasyPairs, netEasyTargets),
  ...buildTier('Network Security', 'Medium', 'Network Infrastructure', netContext, netMediumPairs, netMediumTargets),
  ...buildTier('Network Security', 'Hard', 'Network Infrastructure', netContext, netHardPairs, netHardTargets),

  ...buildTier('System Security', 'Easy', 'System / Host', sysContext, sysEasyPairs, sysEasyTargets),
  ...buildTier('System Security', 'Medium', 'System / Host', sysContext, sysMediumPairs, sysMediumTargets),
  ...buildTier('System Security', 'Hard', 'System / Host', sysContext, sysHardPairs, sysHardTargets),

  ...buildTier('Social Engineering', 'Easy', 'Personnel', socContext, socEasyPairs, socEasyTargets),
  ...buildTier('Social Engineering', 'Medium', 'Personnel', socContext, socMediumPairs, socMediumTargets),
  ...buildTier('Social Engineering', 'Hard', 'Personnel', socContext, socHardPairs, socHardTargets),

  ...buildTier('Cryptography', 'Easy', 'Cryptographic System', cryptoContext, cryptoEasyPairs, cryptoEasyTargets),
  ...buildTier('Cryptography', 'Medium', 'Cryptographic System', cryptoContext, cryptoMediumPairs, cryptoMediumTargets),
  ...buildTier('Cryptography', 'Hard', 'Cryptographic System', cryptoContext, cryptoHardPairs, cryptoHardTargets),
];
