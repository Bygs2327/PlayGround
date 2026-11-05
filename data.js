/* ROOT//ACCESS - game content.
   Fictional simulation. Real tool and malware names are used for historical
   context only. No operational attack code or instructions are included. */

export const HANDLES = [
  'nullbyte', 'ghostwire', 'zerocool', 'hexhound', 'v0id', 'razor',
  'packetghost', 'deadchannel', 'kestrel', 'n0face', 'cipher', 'sable'
];

export const RANKS = [
  { min: 0,   name: 'SCRIPT KIDDIE', note: 'You are a rumor with a laptop.' },
  { min: 30,  name: 'PACKET RAT',    note: 'People are starting to answer your messages.' },
  { min: 80,  name: 'GHOST',         note: 'You leave rooms without footprints.' },
  { min: 150, name: 'BLACK HAT',     note: 'The market knows your handle.' },
  { min: 250, name: 'ZERO DAY',      note: 'Analysts say your name in meetings.' },
  { min: 400, name: 'PHANTOM',       note: 'You are a line item in a classified budget.' },
  { min: 600, name: 'MYTH',          note: 'There are forums dedicated to proving you exist.' }
];

export const DARK_RANKS = [
  { min: 0,  name: 'LURKER' },
  { min: 15, name: 'TRADER' },
  { min: 30, name: 'BROKER' },
  { min: 50, name: 'DEALER' },
  { min: 75, name: 'SHADOW' },
  { min: 90, name: 'GHOST MARKET' }
];

export const HEAT_STATES = [
  { max: 24,  name: 'UNNOTICED', tone: 'green' },
  { max: 49,  name: 'WATCHED',   tone: 'amber' },
  { max: 74,  name: 'FLAGGED',   tone: 'orange' },
  { max: 99,  name: 'HUNTED',    tone: 'red' },
  { max: 100, name: 'BREACHED',  tone: 'red' }
];

export const WEAKNESS = {
  web:        'WEB / CMS',
  network:    'NETWORK EDGE',
  auth:       'CREDENTIALS',
  human:      'HUMAN FACTOR',
  industrial: 'OT / INDUSTRIAL'
};

export const CATEGORY_TONE = {
  WEBSITE: 'cyan',
  NETWORK: 'green',
  PERSONAL: 'pink',
  CORPORATE: 'amber',
  INDUSTRIAL: 'orange',
  GOVERNMENT: 'red',
  DARK: 'violet'
};

/* role: entry = opens the door, support = stacks on top of an entry tool. */
export const TOOLS = [
  {
    id: 'nmap', name: 'NMAP', role: 'support', bonus: 7, heat: 0,
    cost: 0, reqRep: 0, tags: ['recon', 'network'],
    desc: 'A port scanner older than most of the people using it. Maps the way in without touching the lock.',
    tip: 'Cheap, quiet support. Good on almost every target.'
  },
  {
    id: 'proxychains', name: 'PROXYCHAINS', role: 'support', bonus: 2, heat: -7,
    cost: 0, reqRep: 0, tags: ['stealth'],
    desc: 'Chain your traffic through volunteer relays. Slow, but it keeps your real address out of the room.',
    tip: 'Lowers heat on every run. Stacks with cover.'
  },
  {
    id: 'hydra', name: 'HYDRA', role: 'entry', power: 3, heat: 4, energy: 1,
    cost: 0, reqRep: 0, tags: ['auth'],
    desc: 'Parallel credential grinder. Loud if the lockout counter is awake, effective against tired password policy.',
    tip: 'Starter entry tool. Weak against hardened authentication.'
  },
  {
    id: 'sqlmap', name: 'SQLMAP', role: 'entry', power: 4, heat: 2, energy: 1,
    cost: 220, reqRep: 10, tags: ['web'],
    desc: 'Automated web injection engine. It finds the unparameterized query and pulls the table behind it.',
    tip: 'Excellent against WEBSITE targets. Very loud on protected WAFs.'
  },
  {
    id: 'wireshark', name: 'WIRESHARK', role: 'support', bonus: 6, heat: 1,
    cost: 160, reqRep: 0, tags: ['network', 'recon'],
    desc: 'Passive packet capture. Sit still, listen, and let the network tell you its secrets.',
    tip: 'Cheap network support. Adds a little noise.'
  },
  {
    id: 'aircrack', name: 'AIRCRACK-NG', role: 'entry', power: 4, heat: 4, energy: 1,
    cost: 320, reqRep: 25, tags: ['network'],
    desc: 'Wireless handshake capture and key recovery. Built for networks that trust the parking lot.',
    tip: 'Good against NETWORK targets with exposed wireless.'
  },
  {
    id: 'john', name: 'JOHN THE RIPPER', role: 'support', bonus: 8, heat: 1,
    cost: 260, reqRep: 15, tags: ['auth', 'human'],
    desc: 'Offline hash cracker. Quiet, patient, and very good at guessing what people call their dogs.',
    tip: 'Strong support for credential and human-factor jobs.'
  },
  {
    id: 'shodan', name: 'SHODAN', role: 'support', bonus: 6, heat: -2,
    cost: 300, reqRep: 20, tags: ['recon', 'network', 'industrial'],
    desc: 'A search engine for exposed machines. Somebody, somewhere, always left the console open.',
    tip: 'Finds exposed industrial and network services. Low noise.'
  },
  {
    id: 'burp', name: 'BURP SUITE', role: 'support', bonus: 8, heat: -2,
    cost: 380, reqRep: 35, tags: ['web'],
    desc: 'Intercepting web proxy. Lets you edit the conversation between browser and server.',
    tip: 'Best support for web work. Quiet and precise.'
  },
  {
    id: 'set', name: 'SOCIAL-ENGINEER TOOLKIT', role: 'entry', power: 4, heat: 2, energy: 1,
    cost: 480, reqRep: 45, tags: ['human'],
    desc: 'A convincing email, a cloned login, one tired employee. The oldest door is still a person.',
    tip: 'The only good answer to HUMAN FACTOR targets.'
  },
  {
    id: 'ducky', name: 'RUBBER DUCKY', role: 'entry', power: 3, heat: 1, energy: 1,
    cost: 600, reqRep: 60, tags: ['human'],
    desc: 'A keystroke injector disguised as a USB stick. Walk in, plug in, walk out.',
    tip: 'Very quiet, but bulky against hardened targets.'
  },
  {
    id: 'hashcat', name: 'HASHCAT', role: 'support', bonus: 9, heat: 2,
    cost: 520, reqRep: 55, tags: ['auth'],
    desc: 'GPU-accelerated hash cracking. Turns a stolen hash into a password before the coffee cools.',
    tip: 'Top-tier authentication support. Burns GPU power and leaves heat.'
  },
  {
    id: 'metasploit', name: 'METASPLOIT', role: 'entry', power: 5, heat: 5, energy: 2,
    cost: 900, reqRep: 90, tags: ['network', 'auth'],
    desc: 'An exploitation framework with a module for almost everything. Efficient and extremely well-signatured.',
    tip: 'Reliable against network and auth targets. Signatures are everywhere.'
  },
  {
    id: 'mimikatz', name: 'MIMIKATZ', role: 'entry', power: 5, heat: 9, energy: 2,
    cost: 1500, reqRep: 140, tags: ['auth', 'corporate'],
    desc: 'Memory credential extraction. The keys are often still in the room, which is the problem.',
    tip: 'Massive power, massive heat. Use a burner relay or pay the price.'
  },
  {
    id: 'cobalt', name: 'COBALT STRIKE', role: 'entry', power: 5, heat: 3, energy: 2,
    cost: 3000, reqRep: 260, reqDark: 30, tags: ['network', 'corporate', 'industrial'],
    desc: 'A commercial intrusion suite favored by professionals. Quiet, modular, ruinously expensive.',
    tip: 'Endgame entry tool. The quietest way through a hard perimeter.'
  }
];

/* Historical malware, abstracted into payload effects. */
export const PAYLOADS = [
  {
    id: 'iloveyou', name: 'ILOVEYOU', year: 2000, kind: 'EMAIL WORM',
    cost: 240, reqRep: 0, rep: 14, heat: 7, success: 2, lootMult: 1.0,
    chaos: 2, tags: ['human'], ransom: null,
    desc: 'A love letter with a worm inside. In 2000 it clogged mail servers worldwide. Here it spreads noise and reputation.'
  },
  {
    id: 'melissa', name: 'MELISSA', year: 1999, kind: 'MACRO VIRUS',
    cost: 300, reqRep: 10, rep: 18, heat: 8, success: 3, lootMult: 1.15,
    chaos: 2, tags: ['human'], ransom: null,
    desc: 'Macro virus that mailed itself to the address book. Early proof that trust is an attack surface.'
  },
  {
    id: 'codered', name: 'CODE RED', year: 2001, kind: 'WEB WORM',
    cost: 420, reqRep: 20, rep: 22, heat: 11, success: 5, lootMult: 1.0,
    chaos: 3, tags: ['web'], ransom: null,
    desc: 'Web worm that defaced pages and chewed bandwidth. Loud by design, remembered for the noise.'
  },
  {
    id: 'slammer', name: 'SQL SLAMMER', year: 2003, kind: 'NETWORK WORM',
    cost: 520, reqRep: 35, rep: 28, heat: 14, success: 7, lootMult: 1.05,
    chaos: 4, tags: ['network'], ransom: null,
    desc: 'A tiny worm that hit memory and moved faster than anyone could patch. Speed as a weapon.'
  },
  {
    id: 'mydoom', name: 'MYDOOM', year: 2004, kind: 'MASS MAILER / DDOS',
    cost: 650, reqRep: 50, rep: 32, heat: 15, success: 4, lootMult: 1.0,
    chaos: 5, tags: ['web'], ransom: null,
    desc: 'Mass-mailing worm with a DDoS payload. It turned infected machines into a blunt instrument.'
  },
  {
    id: 'storm', name: 'STORM WORM', year: 2007, kind: 'BOTNET',
    cost: 800, reqRep: 70, rep: 38, heat: 14, success: 5, lootMult: 1.1,
    chaos: 5, tags: ['network'], ransom: null,
    desc: 'Botnet builder with weather-themed lures. A distributed army rented by the hour.'
  },
  {
    id: 'cryptolocker', name: 'CRYPTOLOCKER', year: 2013, kind: 'RANSOMWARE',
    cost: 1000, reqRep: 90, rep: 40, heat: 20, success: 2, lootMult: 1.0,
    chaos: 4, tags: [], ransom: [400, 850],
    desc: 'Ransomware that taught the world to keep backups. In-game: adds ransom credits and a lot of heat.'
  },
  {
    id: 'emotet', name: 'EMOTET', year: 2014, kind: 'BANKING TROJAN',
    cost: 1200, reqRep: 110, rep: 42, heat: 16, success: 6, lootMult: 1.35,
    tags: ['auth'], ransom: null, chaos: 3,
    desc: 'Banking trojan turned malware delivery service. Steals data, sells access, never stays in one place.'
  },
  {
    id: 'mirai', name: 'MIRAI', year: 2016, kind: 'IOT BOTNET',
    cost: 1400, reqRep: 140, rep: 48, heat: 18, success: 8, lootMult: 1.1,
    chaos: 6, tags: ['network'], ransom: null,
    desc: 'IoT botnet that turned cameras and routers into a flood. Network targets hate it.'
  },
  {
    id: 'pegasus', name: 'PEGASUS', year: 2016, kind: 'SPYWARE',
    cost: 3000, reqRep: 300, reqDark: 35, rep: 60, heat: 12, success: 12, lootMult: 1.4,
    chaos: 3, tags: ['auth'], ransom: null,
    desc: 'Zero-click spyware abstraction. Quiet, surgical, and politically radioactive.'
  },
  {
    id: 'wannacry', name: 'WANNACRY', year: 2017, kind: 'RANSOMWARE WORM',
    cost: 1800, reqRep: 180, rep: 55, heat: 28, success: 5, lootMult: 1.15,
    chaos: 5, tags: [], ransom: [900, 1600],
    desc: 'Ransomware worm with a kill switch. Devastating, loud, and very expensive to be near.'
  },
  {
    id: 'notpetya', name: 'NOTPETYA', year: 2017, kind: 'WIPER',
    cost: 2400, reqRep: 260, reqDark: 25, rep: 65, heat: 36, success: 6, lootMult: 1.0,
    chaos: 9, tags: ['network'], ransom: null,
    desc: 'Wiper disguised as ransomware. No refunds. Maximum chaos. The kind of thing that starts a policy debate.'
  },
  {
    id: 'stuxnet', name: 'STUXNET', year: 2010, kind: 'SABOTAGE WORM',
    cost: 3200, reqRep: 340, reqDark: 40, rep: 80, heat: 40, success: 18, lootMult: 1.6,
    chaos: 10, tags: ['industrial'], ransom: null,
    desc: 'Precision worm built to make machines lie. The blueprint for everything after it. Handle with intent.'
  }
];

export const COVERS = [
  {
    id: 'direct', name: 'DIRECT LINK', cost: 0, heat: 0,
    desc: 'No proxy. Lowest latency, highest exposure.'
  },
  {
    id: 'proxy', name: 'PROXY CHAIN', cost: 60, heat: -7,
    desc: 'Three public exits. Keeps your address off the target.'
  },
  {
    id: 'burner', name: 'BURNER RELAY', cost: 180, heat: -16,
    reqUpgrade: ['relay', 1],
    desc: 'A leased relay in a jurisdiction that does not answer email.'
  },
  {
    id: 'darkfiber', name: 'DARK FIBER', cost: 420, heat: -28,
    reqUpgrade: ['relay', 2],
    desc: 'Private backbone access. Almost nothing reaches the other side.'
  }
];

export const UPGRADES = [
  {
    id: 'rig', name: 'RIG OVERCLOCK', glyph: '⌁', max: 3,
    costs: [450, 1150, 2600], stat: '+4% BREACH SUCCESS / LVL',
    desc: 'A water-cooled stack and a lot of bad decisions. Every layer runs a little faster.'
  },
  {
    id: 'scrubber', name: 'LOG SCRUBBER', glyph: '⌫', max: 3,
    costs: [350, 900, 2000], stat: '-8% HEAT / LVL',
    desc: 'A daemon that eats your footprints while you sleep. Never quite fast enough.'
  },
  {
    id: 'storage', name: 'COLD STORAGE', glyph: '▤', max: 3,
    costs: [250, 600, 1400], stat: '+2 DATA SLOTS / LVL',
    desc: 'Faraday-caged drives under the floor. The market cannot buy what it cannot find.'
  },
  {
    id: 'power', name: 'POWER CELL', glyph: '▮', max: 2,
    costs: [600, 1500], stat: '+1 MAX POWER / LVL',
    desc: 'A second cell bank. More jobs before the lights go out.'
  },
  {
    id: 'relay', name: 'GHOST RELAY', glyph: '◈', max: 2,
    costs: [800, 2000], stat: 'UNLOCK BETTER COVER',
    desc: 'A rack of leased exits with paperwork that evaporates on request.'
  },
  {
    id: 'papers', name: 'FORGED PAPERS', glyph: '▣', max: 2,
    costs: [700, 1800], stat: '-20% RAID LOSSES / LVL',
    desc: 'Three identities, two addresses, one very expensive forger.'
  }
];

export const TARGETS = [
  {
    id: 'moth', name: 'MOTH.HOUSE', short: 'MOTH.HOUSE', category: 'WEBSITE',
    weakness: 'web', difficulty: 1, reqRep: 0, payout: [80, 180], rep: 15, heat: 5,
    lootTag: 'PII',
    loot: ['Customer ledger', 'Reservation export', 'Loyalty email list'],
    security: [1, 2, 1],
    desc: 'A café in the old quarter with a beautiful website and a three-year-old CMS. The owner thinks "password" is a strong password.',
    contract: 'The owner\'s ex wants the customer list. Don\'t moralize; invoice.',
    intel: 'The CMS is unpatched. Automated web injection will walk straight through. Avoid noisy scanners on the login page.',
    newsWin: 'MOTH.HOUSE confirms a customer-list leak; the café blames "the internet".',
    newsFail: 'MOTH.HOUSE locks its site after a failed intrusion. Regulars complain about the menu PDF.'
  },
  {
    id: 'gridline', name: 'GRIDLINE LAUNDRY', short: 'GRIDLINE', category: 'NETWORK',
    weakness: 'network', difficulty: 1, reqRep: 0, payout: [100, 220], rep: 18, heat: 6,
    lootTag: 'PII',
    loot: ['Route manifest', 'Vendor credentials', 'Coin-op ledger'],
    security: [2, 1, 1],
    desc: 'A coin-op chain with a router the vendor never patched. Every store phones home through the same tired VPN.',
    contract: 'A rival chain wants the route manifest. Small money, small risk. Start here if the café makes you nervous.',
    intel: 'The store routers share a default key. Wireless capture plus a credential grinder should be enough.',
    newsWin: 'GRIDLINE LAUNDRY reports an "accounting irregularity" across eleven stores.',
    newsFail: 'GRIDLINE rotates every router key after a suspicious wireless probe.'
  },
  {
    id: 'kayla', name: 'KAYLA VOSS', short: 'KAYLA V.', category: 'PERSONAL',
    weakness: 'auth', difficulty: 2, reqRep: 15, payout: [220, 420], rep: 28, heat: 9,
    lootTag: 'PRIVATE',
    loot: ['Cloud photo vault', 'Password reuse table', 'DM archive'],
    security: [1, 3, 2],
    desc: 'A lifestyle influencer with a cloud photo vault and a habit of reusing passwords. Her following is large. Her opsec is not.',
    contract: 'A client wants the archive. Don\'t ask why. The answer is always boring and expensive.',
    intel: 'One password opens three services. Offline hash work is quiet; brute force will wake the login alerts.',
    newsWin: 'A celebrity account posts an uncharacteristically silent week. Fans speculate.',
    newsFail: 'KAYLA V. announces two-factor authentication "after some weird emails".'
  },
  {
    id: 'static9', name: 'STATIC/9 STUDIO', short: 'STATIC/9', category: 'WEBSITE',
    weakness: 'web', difficulty: 2, reqRep: 28, payout: [280, 500], rep: 32, heat: 11,
    lootTag: 'IP',
    loot: ['Build server token', 'Unreleased build', 'Player database'],
    security: [2, 2, 2],
    desc: 'An indie studio with a hit game and a build server that still trusts a staging login from 2021.',
    contract: 'A publisher wants to know what the next patch contains. Source code is worth more than the game.',
    intel: 'A forgotten staging endpoint bypasses the login. The production database shares the same network segment.',
    newsWin: 'STATIC/9 delays its patch; the community blames "unforeseen security work".',
    newsFail: 'STATIC/9 posts a cryptic message about "a probe from the outside" and goes dark for a day.'
  },
  {
    id: 'mirrorlake', name: 'MIRRORLAKE UNIVERSITY', short: 'MIRRORLAKE', category: 'NETWORK',
    weakness: 'network', difficulty: 3, reqRep: 55, payout: [450, 800], rep: 45, heat: 15,
    lootTag: 'PII',
    loot: ['Donor database', 'Research grant files', 'Faculty credential cache'],
    security: [3, 2, 3],
    desc: 'A research network with a grant database, a donor list, and campus security that is sleepy but attentive after lunch.',
    contract: 'A journalist wants the donor list. A rival wants the research files. The same door opens both.',
    intel: 'The research VLAN trusts an old VPN appliance. Pivot through it and the database is one hop away.',
    newsWin: 'MIRRORLAKE confirms "a limited exposure" in its development office.',
    newsFail: 'MIRRORLAKE forces a password reset for every staff account. The help desk is not happy.'
  },
  {
    id: 'copperline', name: 'COPPERLINE LOGISTICS', short: 'COPPERLINE', category: 'NETWORK',
    weakness: 'auth', difficulty: 3, reqRep: 80, payout: [600, 1000], rep: 50, heat: 17,
    lootTag: 'CORP',
    loot: ['Freight manifest', 'Dispatch credentials', 'Customs ledger'],
    security: [3, 3, 2],
    desc: 'A freight dispatcher with a forgotten VPN appliance and a night shift that authenticates with first names.',
    contract: 'A competitor wants to know what moves when. The manifest is the whole business.',
    intel: 'Dispatch accounts reuse a vendor password. Credential work is cleaner than forcing the perimeter.',
    newsWin: 'COPPERLINE reroutes a dozen shipments after an "administrative error".',
    newsFail: 'COPPERLINE locks all remote access. Drivers spend the morning on hold.'
  },
  {
    id: 'northside', name: 'NORTHSIDE CLINIC', short: 'NORTHSIDE', category: 'PERSONAL',
    weakness: 'human', difficulty: 3, reqRep: 105, payout: [700, 1150], rep: 55, heat: 23,
    lootTag: 'MED',
    loot: ['Billing records', 'Patient portal dump', 'Insurance claim table'],
    security: [2, 3, 4],
    desc: 'A patient portal with legacy auth and a billing office that opens attachments from strangers.',
    contract: 'The client wants billing files. Medical data is radioactive. Do not hold it longer than you have to.',
    intel: 'A billing clerk will click a cloned login. Human error is the shortest path; brute force is the loudest.',
    newsWin: 'NORTHSIDE CLINIC notifies patients of a "billing vendor incident".',
    newsFail: 'NORTHSIDE CLINIC warns staff about phishing after a near miss.'
  },
  {
    id: 'orbital', name: 'ORBITAL MEDIA', short: 'ORBITAL', category: 'WEBSITE',
    weakness: 'web', difficulty: 4, reqRep: 130, payout: [800, 1300], rep: 60, heat: 20,
    lootTag: 'CORP',
    loot: ['Broadcast schedule', 'Anchor inbox', 'Advertiser contracts'],
    security: [4, 2, 3],
    desc: 'The public face of a broadcast network. The site is hardened, the staging environment is not.',
    contract: 'A defacement contract. Make it loud, make it brief, make it hurt. Do not touch the broadcast chain.',
    intel: 'Staging still points at production media storage. Web injection is the way in; the WAF will notice brute force.',
    newsWin: 'ORBITAL MEDIA\'s homepage briefly displays a message nobody can quote on air.',
    newsFail: 'ORBITAL MEDIA pushes a perimeter patch and thanks "an attentive vendor".'
  },
  {
    id: 'vanta', name: 'VANTA FINANCIAL', short: 'VANTA', category: 'CORPORATE',
    weakness: 'auth', difficulty: 4, reqRep: 170, payout: [1200, 2000], rep: 75, heat: 28,
    lootTag: 'FIN',
    loot: ['Wire transfer table', 'Trading credentials', 'Private client dossier'],
    security: [4, 4, 3],
    desc: 'A private bank with a trading floor and a compliance intern who reuses admin credentials.',
    contract: 'A short seller wants the wire table. The number is large. So is the response.',
    intel: 'The intern\'s account is still active. Credential work beats the perimeter; memory extraction leaves a signature.',
    newsWin: 'VANTA FINANCIAL freezes withdrawals for an hour, citing "routine reconciliation".',
    newsFail: 'VANTA FINANCIAL deploys hardware tokens after an attempted intrusion.'
  },
  {
    id: 'helios', name: 'HELIOS ENERGY', short: 'HELIOS', category: 'INDUSTRIAL',
    weakness: 'network', difficulty: 4, reqRep: 210, payout: [1400, 2300], rep: 85, heat: 32,
    lootTag: 'SCADA',
    loot: ['SCADA topology', 'Turbine telemetry', 'Operator credential vault'],
    security: [3, 4, 5],
    desc: 'A regional grid operator testbed. The client wants access, not damage. Precision matters more than speed.',
    contract: 'Access first. If the lights blink, the contract is void and so are you.',
    intel: 'The testbed shares a segment with the corporate VPN. Network access is the clean path; OT systems are monitored.',
    newsWin: 'HELIOS ENERGY reports a "telemetry anomaly" at a decommissioned test rig.',
    newsFail: 'HELIOS ENERGY isolates its testbed and starts an emergency audit.'
  },
  {
    id: 'civicnet', name: 'CIVICNET', short: 'CIVICNET', category: 'GOVERNMENT',
    weakness: 'human', difficulty: 5, reqRep: 260, payout: [1700, 2800], rep: 95, heat: 38,
    lootTag: 'GOV',
    loot: ['Permit database', 'Voter outreach list', 'City contractor files'],
    security: [5, 4, 4],
    desc: 'The city services portal. Election-adjacent, camera-dense, and impossible to ignore. Every cop in the sprawl will care.',
    contract: 'A political operative wants the outreach list. If this surfaces, people will call it a coup rehearsal.',
    intel: 'A vendor account has no MFA. The human path is quieter than the perimeter, but the perimeter is watching.',
    newsWin: 'CIVICNET confirms a "data export anomaly" and suspends two contractor accounts.',
    newsFail: 'CIVICNET escalates to the city cyber unit after a suspicious login pattern.'
  },
  {
    id: 'lattice', name: 'THE LATTICE', short: 'LATTICE', category: 'NETWORK',
    weakness: 'network', difficulty: 5, reqRep: 320, payout: [2200, 3500], rep: 120, heat: 42,
    lootTag: 'DARK',
    loot: ['Relay keyring', 'Ghost market ledger', 'Admin botnet list'],
    security: [5, 5, 4],
    desc: 'A darknet relay ring that thinks it cannot be found. It is wrong, but it is not careless.',
    contract: 'The client wants the keyring. The ring wants you dead. Both are negotiating with the same data.',
    intel: 'The relays trust each other too much. One exposed management port is enough to walk the chain.',
    newsWin: 'Three darknet relays go silent. The market blames an exit scam; the smart money knows better.',
    newsFail: 'THE LATTICE rotates every relay and posts a bounty for a handle it does not name.'
  },
  {
    id: 'aegis', name: 'AEGIS DEFENSE', short: 'AEGIS', category: 'CORPORATE',
    weakness: 'auth', difficulty: 5, reqRep: 520, payout: [3500, 5500], rep: 160, heat: 50,
    lootTag: 'BLACK',
    loot: ['Black budget ledger', 'Drone control keys', 'Contractor identity vault'],
    security: [5, 5, 5],
    desc: 'A defense contractor with a private fiber ring and a security team that gets paid to be paranoid. Everything you have done leads here.',
    contract: 'The final door. After this, there is no version of you that goes back. Make it count.',
    intel: 'The contractor identity vault shares credentials with an executive assistant. The perimeter is a wall; the human is a crack.',
    newsWin: 'AEGIS DEFENSE confirms an "internal review" and declines to comment further.',
    newsFail: 'AEGIS DEFENSE goes dark. Its stock does not.'
  }
];

export const COMPLICATIONS = [
  'A heartbeat monitor wakes up and turns toward your session.',
  'An admin badge swipes into the console. You have seconds, not minutes.',
  'The target starts a checksum sweep. Something in the archive does not match.',
  'A second login appears from an address that should not exist.',
  'The endpoint protection quarantines your staging file and starts a scan.',
  'A calendar alert fires: the night shift is early.'
];

export const WORLD_NEWS = [
  'NET WATCH: a new honeypot cluster appears in the eastern relay ring.',
  'MARKET: stolen cloud credentials trade 18% above last week\'s floor.',
  'POLICE: the cyber unit expands "Project Glasshouse" after a string of intrusions.',
  'GRID: rolling brownouts hit the industrial belt; the operator blames legacy firmware.',
  'COURT: a data broker loses its appeal; breach disclosure becomes mandatory.',
  'DARKNET: two escrow services exit-scam in one week. Trust is expensive.',
  'SIGINT: a scanner is mapping exposed cameras across the sprawl.',
  'CITY: the council approves a facial-recognition pilot for transit stations.',
  'WEATHER: a solar flare disrupts satellite links. Networks run hot.',
  'WIRE: an anonymous paste claims a major bank was quietly patched last night.',
  'LABOR: contract analysts demand hazard pay for breach-response work.',
  'TRANSPORT: the port authority tests a new air-gapped cargo system.',
  'MEDIA: a documentary about the 2000 mail worm trended for six hours.',
  'MARKET: a zero-day broker opens a private auction with no reserve price.'
];

export const ACHIEVEMENTS = [
  { id: 'first',    name: 'FIRST BLOOD',   desc: 'Complete your first contract.',       test: s => s.stats.success >= 1 },
  { id: 'five',     name: 'WORKING GHOST', desc: 'Complete five contracts.',             test: s => s.stats.success >= 5 },
  { id: 'clean',    name: 'NO FINGERPRINT',desc: 'Land three clean runs.',               test: s => s.stats.clean >= 3 },
  { id: 'fence',    name: 'FENCE FLOW',    desc: 'Sell five pieces of data.',            test: s => s.stats.sold >= 5 },
  { id: 'virus',    name: 'CHAOS THEORY',  desc: 'Deploy a payload on a live job.',      test: s => s.stats.viruses >= 1 },
  { id: 'rich',     name: 'COLD WALLET',   desc: 'Hold 5,000 credits.',                  test: s => s.credits >= 5000 },
  { id: 'shadow',   name: 'SHADOW TRADER', desc: 'Reach 50 darknet reputation.',         test: s => s.darknet >= 50 },
  { id: 'phantom',  name: 'PHANTOM',       desc: 'Reach 400 street reputation.',         test: s => s.rep >= 400 },
  { id: 'survivor', name: 'UNTOUCHABLE',   desc: 'Finish eight jobs with zero arrests.', test: s => s.stats.ops >= 8 && s.stats.arrests === 0 },
  { id: 'aegis',    name: 'THE FINAL DOOR',desc: 'Zero AEGIS DEFENSE.',                  test: s => !!s.targets.aegis?.done }
];

export const TOOL_MAP = Object.fromEntries(TOOLS.map(t => [t.id, t]));
export const PAYLOAD_MAP = Object.fromEntries(PAYLOADS.map(p => [p.id, p]));
export const TARGET_MAP = Object.fromEntries(TARGETS.map(t => [t.id, t]));
export const COVER_MAP = Object.fromEntries(COVERS.map(c => [c.id, c]));
export const UPGRADE_MAP = Object.fromEntries(UPGRADES.map(u => [u.id, u]));
