import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed...');

  // 15 Scenarios with specific rules
  const scenariosData = [
    {
      name: 'Online Banking Portal',
      description: 'Defend or attack a major online banking portal.',
      category: 'Web Security',
      difficulty: 'Medium',
      targetSystem: 'Web Server & DB',
      context: 'You are targeting a financial institution with high-value transactions.',
      attackOptions: [
        { id: 'a1', name: 'Phishing', description: 'Send fake emails to employees.', difficulty: 'Easy', category: 'Social Engineering' },
        { id: 'a2', name: 'SQL Injection', description: 'Exploit DB vulnerabilities.', difficulty: 'Medium', category: 'Web Security' },
        { id: 'a3', name: 'Brute Force', description: 'Guess passwords.', difficulty: 'Easy', category: 'Authentication' },
        { id: 'a4', name: 'Malware', description: 'Deploy trojan to employee machines.', difficulty: 'Hard', category: 'System Security' }
      ],
      defenseOptions: [
        { id: 'd1', name: 'Email Filtering', description: 'Block phishing emails.', effectiveness: 'High', category: 'Network Security' },
        { id: 'd2', name: 'Input Validation', description: 'Sanitize all user inputs.', effectiveness: 'High', category: 'Web Security' },
        { id: 'd3', name: 'Rate Limiting', description: 'Limit login attempts.', effectiveness: 'High', category: 'Authentication' },
        { id: 'd4', name: 'EDR', description: 'Endpoint detection and response.', effectiveness: 'High', category: 'System Security' }
      ]
    },
    {
      name: 'Corporate Email System',
      description: 'Attack or defend a corporate email infrastructure.',
      category: 'Network Security',
      difficulty: 'Easy',
      targetSystem: 'Exchange Server',
      context: 'Corporate emails often contain sensitive internal info.',
      attackOptions: [
        { id: 'a1', name: 'Spear Phishing', description: 'Targeted phishing.', difficulty: 'Medium', category: 'Social Engineering' },
        { id: 'a2', name: 'Email Spoofing', description: 'Forged sender address.', difficulty: 'Easy', category: 'Network Security' },
        { id: 'a3', name: 'Credential Stuffing', description: 'Reuse leaked passwords.', difficulty: 'Easy', category: 'Authentication' }
      ],
      defenseOptions: [
        { id: 'd1', name: 'Security Awareness', description: 'Train employees.', effectiveness: 'Medium', category: 'Social Engineering' },
        { id: 'd2', name: 'DMARC/SPF/DKIM', description: 'Authenticate emails.', effectiveness: 'High', category: 'Network Security' },
        { id: 'd3', name: 'MFA', description: 'Multi-factor authentication.', effectiveness: 'High', category: 'Authentication' }
      ]
    },
    {
      name: 'E-Commerce Platform',
      description: 'E-Commerce site with user data and payment info.',
      category: 'Web Security',
      difficulty: 'Medium',
      targetSystem: 'Web App',
      context: 'Customer PII and credit cards at risk.',
      attackOptions: [
        { id: 'a1', name: 'XSS', description: 'Inject scripts.', difficulty: 'Medium', category: 'Web Security' },
        { id: 'a2', name: 'SQL Injection', description: 'Extract data.', difficulty: 'Medium', category: 'Web Security' },
        { id: 'a3', name: 'CSRF', description: 'Forge requests.', difficulty: 'Medium', category: 'Web Security' }
      ],
      defenseOptions: [
        { id: 'd1', name: 'CSP', description: 'Content Security Policy.', effectiveness: 'High', category: 'Web Security' },
        { id: 'd2', name: 'Parameterized Queries', description: 'Safe DB access.', effectiveness: 'High', category: 'Web Security' },
        { id: 'd3', name: 'Anti-CSRF Tokens', description: 'Validate requests.', effectiveness: 'High', category: 'Web Security' }
      ]
    },
    {
      name: 'Government Network',
      description: 'High security government infrastructure.',
      category: 'Network Security',
      difficulty: 'Hard',
      targetSystem: 'Internal Network',
      context: 'State secrets and critical services.',
      attackOptions: [
        { id: 'a1', name: 'DDoS', description: 'Overwhelm services.', difficulty: 'Easy', category: 'Network Security' },
        { id: 'a2', name: 'APT', description: 'Advanced Persistent Threat.', difficulty: 'Hard', category: 'System Security' },
        { id: 'a3', name: 'Insider Threat', description: 'Malicious employee.', difficulty: 'Hard', category: 'Access Control' }
      ],
      defenseOptions: [
        { id: 'd1', name: 'DDoS Mitigation', description: 'Traffic scrubbing.', effectiveness: 'High', category: 'Network Security' },
        { id: 'd2', name: 'Network Segmentation', description: 'Limit lateral movement.', effectiveness: 'High', category: 'Network Security' },
        { id: 'd3', name: 'Zero Trust', description: 'Strict access control.', effectiveness: 'High', category: 'Access Control' }
      ]
    },
    {
      name: 'Healthcare Database',
      description: 'Database storing patient medical records.',
      category: 'System Security',
      difficulty: 'Medium',
      targetSystem: 'Database Server',
      context: 'HIPAA compliance and sensitive medical history.',
      attackOptions: [
        { id: 'a1', name: 'Ransomware', description: 'Encrypt records.', difficulty: 'Medium', category: 'System Security' },
        { id: 'a2', name: 'Data Exfiltration', description: 'Steal records.', difficulty: 'Medium', category: 'Network Security' },
        { id: 'a3', name: 'Privilege Escalation', description: 'Gain admin rights.', difficulty: 'Hard', category: 'Access Control' }
      ],
      defenseOptions: [
        { id: 'd1', name: 'Offline Backups', description: 'Restore without paying.', effectiveness: 'High', category: 'System Security' },
        { id: 'd2', name: 'DLP System', description: 'Data Loss Prevention.', effectiveness: 'High', category: 'Network Security' },
        { id: 'd3', name: 'RBAC', description: 'Role Based Access Control.', effectiveness: 'High', category: 'Access Control' }
      ]
    },
    {
      name: 'Cloud Infrastructure',
      description: 'AWS/Azure/GCP cloud environment.',
      category: 'System Security',
      difficulty: 'Hard',
      targetSystem: 'Cloud Services',
      context: 'Modern infrastructure relying on APIs and containers.',
      attackOptions: [
        { id: 'a1', name: 'MITM', description: 'Intercept API traffic.', difficulty: 'Medium', category: 'Network Security' },
        { id: 'a2', name: 'DNS Spoofing', description: 'Redirect traffic.', difficulty: 'Medium', category: 'Network Security' },
        { id: 'a3', name: 'Container Escape', description: 'Break out of Docker/K8s.', difficulty: 'Hard', category: 'System Security' }
      ],
      defenseOptions: [
        { id: 'd1', name: 'TLS Encryption', description: 'Encrypt in transit.', effectiveness: 'High', category: 'Cryptography' },
        { id: 'd2', name: 'DNSSEC', description: 'Secure DNS.', effectiveness: 'High', category: 'Network Security' },
        { id: 'd3', name: 'gVisor/AppArmor', description: 'Container isolation.', effectiveness: 'High', category: 'System Security' }
      ]
    },
    {
      name: 'IoT Smart Home',
      description: 'Consumer IoT devices network.',
      category: 'Network Security',
      difficulty: 'Easy',
      targetSystem: 'IoT Devices',
      context: 'Weak default creds and unpatched firmware.',
      attackOptions: [
        { id: 'a1', name: 'Firmware Attack', description: 'Exploit old firmware.', difficulty: 'Medium', category: 'System Security' },
        { id: 'a2', name: 'Network Sniffing', description: 'Capture unencrypted data.', difficulty: 'Easy', category: 'Network Security' },
        { id: 'a3', name: 'Replay Attack', description: 'Capture and resend commands.', difficulty: 'Medium', category: 'Cryptography' }
      ],
      defenseOptions: [
        { id: 'd1', name: 'Auto Updates', description: 'Keep firmware current.', effectiveness: 'High', category: 'System Security' },
        { id: 'd2', name: 'WPA3 Encryption', description: 'Secure local network.', effectiveness: 'High', category: 'Cryptography' },
        { id: 'd3', name: 'Timestamping', description: 'Prevent replays.', effectiveness: 'High', category: 'Cryptography' }
      ]
    },
    {
      name: 'University Portal',
      description: 'Student and faculty portal.',
      category: 'Web Security',
      difficulty: 'Medium',
      targetSystem: 'Web App',
      context: 'Grades and student info.',
      attackOptions: [
        { id: 'a1', name: 'Session Hijacking', description: 'Steal session cookies.', difficulty: 'Medium', category: 'Authentication' },
        { id: 'a2', name: 'LDAP Injection', description: 'Bypass auth.', difficulty: 'Hard', category: 'Authentication' },
        { id: 'a3', name: 'Brute Force', description: 'Guess weak student passwords.', difficulty: 'Easy', category: 'Authentication' }
      ],
      defenseOptions: [
        { id: 'd1', name: 'Secure Cookies', description: 'HttpOnly and Secure flags.', effectiveness: 'High', category: 'Authentication' },
        { id: 'd2', name: 'Input Validation', description: 'Sanitize LDAP input.', effectiveness: 'High', category: 'Authentication' },
        { id: 'd3', name: 'Account Lockout', description: 'Lock after N attempts.', effectiveness: 'High', category: 'Authentication' }
      ]
    },
    {
      name: 'Financial Trading System',
      description: 'High-frequency trading platform.',
      category: 'System Security',
      difficulty: 'Hard',
      targetSystem: 'Trading Engine',
      context: 'Microsecond latency, massive financial risk.',
      attackOptions: [
        { id: 'a1', name: 'Zero-Day', description: 'Exploit unknown bug.', difficulty: 'Hard', category: 'System Security' },
        { id: 'a2', name: 'Supply Chain', description: 'Compromise dependency.', difficulty: 'Hard', category: 'System Security' },
        { id: 'a3', name: 'API Abuse', description: 'Exploit business logic.', difficulty: 'Medium', category: 'Web Security' }
      ],
      defenseOptions: [
        { id: 'd1', name: 'Anomaly Detection', description: 'Detect zero-day behavior.', effectiveness: 'Medium', category: 'System Security' },
        { id: 'd2', name: 'SCA & SBOM', description: 'Manage software supply chain.', effectiveness: 'High', category: 'System Security' },
        { id: 'd3', name: 'API Gateway', description: 'Strict API schema validation.', effectiveness: 'High', category: 'Web Security' }
      ]
    },
    {
      name: 'Social Media Platform',
      description: 'Global social network.',
      category: 'Social Engineering',
      difficulty: 'Medium',
      targetSystem: 'User Accounts',
      context: 'Massive user base, misinformation risk.',
      attackOptions: [
        { id: 'a1', name: 'Account Takeover', description: 'Compromise user accounts.', difficulty: 'Medium', category: 'Authentication' },
        { id: 'a2', name: 'Data Scraping', description: 'Mass extract profiles.', difficulty: 'Easy', category: 'Web Security' },
        { id: 'a3', name: 'Social Engineering', description: 'Trick users into sharing info.', difficulty: 'Medium', category: 'Social Engineering' }
      ],
      defenseOptions: [
        { id: 'd1', name: 'Risk-based Auth', description: 'Challenge unusual logins.', effectiveness: 'High', category: 'Authentication' },
        { id: 'd2', name: 'Bot Management', description: 'Block scrapers.', effectiveness: 'High', category: 'Web Security' },
        { id: 'd3', name: 'In-app Warnings', description: 'Warn about scams.', effectiveness: 'Medium', category: 'Social Engineering' }
      ]
    },
    {
      name: 'Military Communications',
      description: 'Tactical comms network.',
      category: 'Cryptography',
      difficulty: 'Hard',
      targetSystem: 'Radio Network',
      context: 'Life-critical, highly classified.',
      attackOptions: [
        { id: 'a1', name: 'Signal Jamming', description: 'Block transmissions.', difficulty: 'Medium', category: 'Network Security' },
        { id: 'a2', name: 'Side Channel', description: 'Extract keys via power analysis.', difficulty: 'Hard', category: 'Cryptography' },
        { id: 'a3', name: 'Cryptanalysis', description: 'Break encryption math.', difficulty: 'Hard', category: 'Cryptography' }
      ],
      defenseOptions: [
        { id: 'd1', name: 'Frequency Hopping', description: 'Evade jamming.', effectiveness: 'High', category: 'Network Security' },
        { id: 'd2', name: 'Hardware Shielding', description: 'Prevent side channels.', effectiveness: 'High', category: 'System Security' },
        { id: 'd3', name: 'Post-Quantum Crypto', description: 'Stronger algorithms.', effectiveness: 'High', category: 'Cryptography' }
      ]
    },
    {
      name: 'Power Grid SCADA',
      description: 'Industrial control systems.',
      category: 'System Security',
      difficulty: 'Hard',
      targetSystem: 'PLCs and RTUs',
      context: 'Critical infrastructure.',
      attackOptions: [
        { id: 'a1', name: 'PLC Exploit', description: 'Send malicious logic.', difficulty: 'Hard', category: 'System Security' },
        { id: 'a2', name: 'Protocol Manipulation', description: 'Abuse Modbus/DNP3.', difficulty: 'Medium', category: 'Network Security' },
        { id: 'a3', name: 'Physical Access', description: 'Tamper with substation.', difficulty: 'Easy', category: 'Access Control' }
      ],
      defenseOptions: [
        { id: 'd1', name: 'Firmware Signing', description: 'Only run trusted logic.', effectiveness: 'High', category: 'System Security' },
        { id: 'd2', name: 'Deep Packet Inspection', description: 'Validate SCADA protocols.', effectiveness: 'High', category: 'Network Security' },
        { id: 'd3', name: 'Physical Security', description: 'Locks, cameras, guards.', effectiveness: 'High', category: 'Access Control' }
      ]
    },
    {
      name: 'Mobile Banking App',
      description: 'Smartphone banking application.',
      category: 'Web Security',
      difficulty: 'Medium',
      targetSystem: 'Mobile App',
      context: 'Convenient but potentially insecure environments.',
      attackOptions: [
        { id: 'a1', name: 'Reverse Engineering', description: 'Decompile app.', difficulty: 'Medium', category: 'System Security' },
        { id: 'a2', name: 'MITM Proxy', description: 'Intercept app traffic.', difficulty: 'Medium', category: 'Network Security' },
        { id: 'a3', name: 'Keylogger', description: 'Steal PINs via malware.', difficulty: 'Medium', category: 'System Security' }
      ],
      defenseOptions: [
        { id: 'd1', name: 'Code Obfuscation', description: 'Hinder RE.', effectiveness: 'Medium', category: 'System Security' },
        { id: 'd2', name: 'Certificate Pinning', description: 'Prevent rogue CAs.', effectiveness: 'High', category: 'Network Security' },
        { id: 'd3', name: 'Secure Keyboard', description: 'Bypass OS keyboard.', effectiveness: 'High', category: 'System Security' }
      ]
    },
    {
      name: 'DNS Infrastructure',
      description: 'Global DNS resolution.',
      category: 'Network Security',
      difficulty: 'Medium',
      targetSystem: 'DNS Servers',
      context: 'The phonebook of the internet.',
      attackOptions: [
        { id: 'a1', name: 'DNS Cache Poisoning', description: 'Insert fake records.', difficulty: 'Hard', category: 'Network Security' },
        { id: 'a2', name: 'DNS Tunneling', description: 'Exfiltrate data via DNS.', difficulty: 'Medium', category: 'Network Security' },
        { id: 'a3', name: 'Domain Hijacking', description: 'Steal registrar creds.', difficulty: 'Medium', category: 'Access Control' }
      ],
      defenseOptions: [
        { id: 'd1', name: 'DNSSEC', description: 'Sign DNS responses.', effectiveness: 'High', category: 'Network Security' },
        { id: 'd2', name: 'Query Analysis', description: 'Detect tunneling patterns.', effectiveness: 'High', category: 'Network Security' },
        { id: 'd3', name: 'Registrar Lock & MFA', description: 'Secure domain management.', effectiveness: 'High', category: 'Access Control' }
      ]
    },
    {
      name: 'Wireless Network',
      description: 'Corporate Wi-Fi.',
      category: 'Network Security',
      difficulty: 'Easy',
      targetSystem: 'WLAN',
      context: 'Radio waves can be intercepted by anyone nearby.',
      attackOptions: [
        { id: 'a1', name: 'Evil Twin', description: 'Fake AP.', difficulty: 'Medium', category: 'Network Security' },
        { id: 'a2', name: 'Deauth Attack', description: 'Kick users off.', difficulty: 'Easy', category: 'Network Security' },
        { id: 'a3', name: 'WPA Cracking', description: 'Crack Wi-Fi password.', difficulty: 'Medium', category: 'Cryptography' }
      ],
      defenseOptions: [
        { id: 'd1', name: 'WPA3 Enterprise', description: 'Strong auth.', effectiveness: 'High', category: 'Network Security' },
        { id: 'd2', name: 'PMF (802.11w)', description: 'Protected Management Frames.', effectiveness: 'High', category: 'Network Security' },
        { id: 'd3', name: 'Strong Passwords', description: 'Prevent dictionary attacks.', effectiveness: 'Medium', category: 'Cryptography' }
      ]
    }
  ];

  for (const sData of scenariosData) {
    const scenario = await prisma.scenario.create({
      data: {
        name: sData.name,
        description: sData.description,
        category: sData.category,
        difficulty: sData.difficulty,
        targetSystem: sData.targetSystem,
        context: sData.context,
        attackOptions: sData.attackOptions,
        defenseOptions: sData.defenseOptions,
      }
    });

    const rulesData = [];
    
    // Generate rules mapping attacks to defenses
    for (const attack of sData.attackOptions) {
      for (const defense of sData.defenseOptions) {
        let outcome = 'breached';
        let explanation = 'The defense was completely ineffective against this attack.';
        let scoreModifier = -10;

        // Simple matching logic for the seed
        if (attack.id === 'a1' && defense.id === 'd1') {
          outcome = 'defended';
          explanation = 'The primary defense perfectly countered the primary attack method.';
          scoreModifier = 20;
        } else if (attack.id === 'a2' && defense.id === 'd2') {
          outcome = 'defended';
          explanation = 'The specific technical control successfully blocked the exploit attempt.';
          scoreModifier = 20;
        } else if (attack.id === 'a3' && defense.id === 'd3') {
          outcome = 'defended';
          explanation = 'Properly configured security settings neutralized the threat.';
          scoreModifier = 20;
        } else if (attack.id === 'a4' && defense.id === 'd4') {
          outcome = 'defended';
          explanation = 'Advanced monitoring and response capabilities stopped the attack chain.';
          scoreModifier = 20;
        } else if (attack.category === defense.category) {
          outcome = 'partially_defended';
          explanation = 'The defense belonged to the right category but was not specific enough to fully stop the attack, mitigating some damage.';
          scoreModifier = 5;
        }

        rulesData.push({
          scenarioId: scenario.id,
          attackType: attack.id,
          defenseType: defense.id,
          outcome,
          explanation,
          scoreModifier
        });
      }
    }

    await prisma.rule.createMany({
      data: rulesData
    });
  }

  // Modules
  for (let i = 1; i <= 8; i++) {
    const module = await prisma.module.create({
      data: {
        name: `Cyber Security Module ${i}`,
        description: `Learn core concepts for topic ${i}.`,
        category: 'General',
        difficulty: 'Medium',
        duration: 120,
        type: 'theory',
        content: {},
        order: i,
      }
    });

    await prisma.lesson.createMany({
      data: [
        { moduleId: module.id, title: `Lesson 1 for Module ${i}`, content: 'Content 1', type: 'theory', order: 1 },
        { moduleId: module.id, title: `Lesson 2 for Module ${i}`, content: 'Content 2', type: 'interactive', order: 2 },
        { moduleId: module.id, title: `Lesson 3 for Module ${i}`, content: 'Content 3', type: 'quiz', order: 3 },
      ]
    });
  }

  console.log('Seed completed successfully.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
