/* ============================================================
   BATTLES — Historical battle data (chronological order)
   ============================================================ */
const Battles = (() => {

  const BATTLE_LIST = [
    /* ──────────────────────────────────────────────────────
       1. BATTLE OF AP BAC — January 2, 1963
    ────────────────────────────────────────────────────── */
    {
      id: 0,
      opName: 'OPERATION BURNING ARROW',
      name: 'Battle of Ap Bac',
      date: '2 January 1963',
      location: 'Ap Bac, Dinh Tuong Province, South Vietnam',
      situation: 'ARVN forces, advised by American military, attempt to encircle and destroy a VC radio company near the village of Ap Bac in the Mekong Delta.',
      history: 'Ap Bac marked a major turning point — the first time the VC successfully stood and fought against a superior ARVN force equipped with US weapons and helicopters. Three US advisors were killed and five helicopters shot down. The battle revealed serious problems with ARVN morale and leadership.',
      intel: 'Intelligence indicates approximately 320 VC fighters well-entrenched along an irrigation dike system. Enemy has anti-aircraft capability against low-flying helicopters. Local villagers may be providing the VC with information about your movements.',
      terrain: 'Mekong Delta — extensive rice paddies, narrow irrigation dikes, scattered jungle patches. The open terrain limits infantry movement and provides little cover. Water crossings will slow all ground forces.',
      objectives: [
        'Locate and destroy the 514th VC Battalion radio company',
        'Capture or destroy the VC command element',
        'Secure the village of Ap Bac',
        'Minimize civilian casualties to maintain local support',
      ],
      assets: { infantry:8, artillery:3, armor:2, helicopter:4, recon:3, airstrike:3, napalm:1, naval:0, resources:150 },
      mapConfig: {
        biome: 'DELTA',
        width: 60, height: 40,
        features: { water: 0.3, jungle: 0.15, village: 3, hills: 0, roads: 1 },
        usStart: { x: 55, y: 35 },
        objectives: [{ x: 15, y: 10, name: 'Ap Bac', type: 'village' }, { x: 22, y: 15, name: 'VC Command', type: 'command' }],
        vcGroups: [
          { type: 'VC_SQUAD', count: 5, area: { x:10, y:8, w:10, h:8 } },
          { type: 'VC_MORTAR', count: 2, area: { x:8, y:12, w:6, h:6 } },
          { type: 'VC_TUNNEL', count: 2, area: { x:14, y:9, w:8, h:6 } },
          { type: 'VC_COMMAND', count: 1, area: { x:22, y:15, w:4, h:4 } },
          { type: 'VC_SNIPER', count: 3, area: { x:12, y:6, w:12, h:10 } },
        ],
        hasNaval: false,
      },
      historicalOutcome: 'The battle was a significant VC tactical victory. Three US Army advisors were killed, and five helicopters were shot down. ARVN forces failed to effectively encircle the VC, who withdrew at nightfall. The battle exposed critical weaknesses in the ARVN chain of command and the limits of US advisory strategy.',
      winCondition: { objectives: 1, vcKills: 40 },
      lossCondition: { usCasualties: 60, timeLimit: 480 },
      vcDoctrine: 'Prepared defensive positions along irrigation dikes. The VC 514th Battalion stood and fought — an unusual choice that exploited ARVN hesitation and poor coordination.',
      historicalEvents: [
        { time: 45,  msg: 'HISTORY: The VC have opened fire on US UH-1 helicopters — 5 aircraft shot down in this battle historically.' },
        { time: 120, msg: 'HISTORY: Col. John Paul Vann to MACV: "This is a miserable damn performance, just like it always is."' },
        { time: 240, msg: 'HISTORY: ARVN blocking forces never closed the escape route — VC begin withdrawing at nightfall.' },
      ],
    },

    /* ──────────────────────────────────────────────────────
       2. BATTLE OF IA DRANG VALLEY — November 14–18, 1965
    ────────────────────────────────────────────────────── */
    {
      id: 1,
      opName: 'OPERATION SILVER BAYONET',
      name: 'Battle of Ia Drang Valley',
      date: '14–18 November 1965',
      location: 'Ia Drang Valley, Central Highlands, South Vietnam',
      situation: 'The 1st Cavalry Division (Airmobile) conducts the first major engagement between US forces and NVA regulars in the Central Highlands. LZ X-Ray and LZ Albany are the focal points of intense fighting.',
      history: 'The Battle of Ia Drang was the first large-scale engagement between the US Army and the People\'s Army of Vietnam (PAVN/NVA). The battle helped shape US air assault doctrine and revealed the NVA\'s willingness to "hug" US forces to neutralize air support. 234 Americans were killed.',
      intel: 'Three NVA regiments — roughly 2,000 soldiers — are operating in the Ia Drang Valley near the Cambodian border. The NVA is battle-hardened and well-equipped with AK-47s, RPGs, and mortars. Intelligence suggests they are training specifically to counter US helicopter tactics.',
      terrain: 'Central Highlands — dense jungle, rolling hills, elephant grass clearings. Significant elevation changes. The Cambodian border provides the NVA with a sanctuary. Anti-aircraft fire will be intense near the main NVA positions.',
      objectives: [
        'Establish and hold Landing Zone X-Ray',
        'Destroy or disperse NVA 66th Regiment',
        'Prevent NVA from reaching the Cambodian sanctuary',
        'Evacuate all US wounded',
      ],
      assets: { infantry:12, artillery:5, armor:0, helicopter:6, recon:3, airstrike:5, napalm:3, naval:0, resources:200 },
      mapConfig: {
        biome: 'HIGHLAND',
        width: 60, height: 40,
        features: { water: 0.05, jungle: 0.45, village: 1, hills: 0.3, roads: 0 },
        usStart: { x: 30, y: 30 },
        objectives: [
          { x: 30, y: 28, name: 'LZ X-Ray', type: 'lz' },
          { x: 15, y: 12, name: 'NVA HQ', type: 'command' },
          { x: 5, y: 20, name: 'Cambodian Border', type: 'border' },
        ],
        vcGroups: [
          { type: 'NVA_REG', count: 8, area: { x:10, y:8, w:20, h:15 } },
          { type: 'NVA_HEAVY', count: 3, area: { x:8, y:10, w:10, h:10 } },
          { type: 'VC_MORTAR', count: 4, area: { x:12, y:6, w:15, h:12 } },
          { type: 'VC_COMMAND', count: 1, area: { x:15, y:12, w:6, h:6 } },
          { type: 'VC_SNIPER', count: 4, area: { x:20, y:15, w:15, h:12 } },
          { type: 'VC_TUNNEL', count: 3, area: { x:5, y:5, w:15, h:20 } },
          { type: 'VC_RPG', count: 3, area: { x:12, y:8, w:18, h:14 } },
          { type: 'VC_RPK', count: 2, area: { x:10, y:10, w:15, h:12 } },
        ],
        hasNaval: false,
      },
      historicalOutcome: 'US forces killed approximately 1,800 NVA soldiers but suffered 234 KIA. The battle demonstrated the effectiveness of airmobile tactics but also revealed that the NVA could inflict severe casualties on US forces. The nearby ambush at LZ Albany (79 KIA) underscored the dangers of the Central Highlands.',
      winCondition: { objectives: 2, vcKills: 80 },
      lossCondition: { usCasualties: 80, timeLimit: 600 },
      vcDoctrine: 'Close assault — "grab the belt buckle." NVA Commander Nguyen Huu An ordered troops within 30 meters of US lines so air power could not be called without hitting Americans.',
      historicalEvents: [
        { time: 60,  msg: 'HISTORY: NVA close to within 30 meters — too close for air support. This is the "hug" tactic. Your helicopters cannot help now.' },
        { time: 180, msg: 'HISTORY: LZ Albany ambush begins nearby — 155 men of 2/7 Cavalry walk into a column ambush. 79 Americans killed in 15 minutes.' },
        { time: 360, msg: 'HISTORY: McNamara Memo, Nov 3 1965: "Attrition alone will not achieve our objectives. The enemy can replace losses from the North."' },
      ],
    },

    /* ──────────────────────────────────────────────────────
       3. OPERATION JUNCTION CITY — February–May 1967
    ────────────────────────────────────────────────────── */
    {
      id: 2,
      opName: 'OPERATION JUNCTION CITY',
      name: 'Operation Junction City',
      date: '22 February – 14 May 1967',
      location: 'War Zone C, Tây Ninh Province',
      situation: 'The largest US airborne operation since WWII targets the VC Central Office for South Vietnam (COSVN) — the VC\'s main command headquarters in War Zone C near the Cambodian border.',
      history: 'Operation Junction City involved 22 US and 4 South Vietnamese battalions. It was the only major US combat parachute assault of the Vietnam War. The operation successfully disrupted VC operations but COSVN headquarters escaped into Cambodia.',
      intel: 'COSVN — the VC\'s "Pentagon" — is believed to be operating from a complex of bunkers in War Zone C. The VC 9th Division (approximately 9,000 men) is providing security. Tunnel systems are extensive. The Cambodia border provides a sanctuary.',
      terrain: 'War Zone C — dense jungle, flat to rolling terrain, light scrub. Heavy defoliation has occurred in some areas. The Cambodian border is only 10km north.',
      objectives: [
        'Locate and destroy COSVN headquarters',
        'Destroy the VC 9th Division\'s combat effectiveness',
        'Interdict VC supply routes from Cambodia',
        'Capture intelligence documents',
      ],
      assets: { infantry:14, artillery:6, armor:4, helicopter:5, recon:4, airstrike:6, napalm:4, naval:0, resources:250, agentOrange:2 },
      mapConfig: {
        biome: 'WARZONE',
        width: 60, height: 40,
        features: { water: 0.05, jungle: 0.5, village: 0, hills: 0.1, roads: 1 },
        usStart: { x: 55, y: 38 },
        objectives: [
          { x: 8, y: 8, name: 'COSVN HQ', type: 'command' },
          { x: 20, y: 5, name: 'Border Crossing', type: 'border' },
          { x: 30, y: 15, name: 'VC Supply Depot', type: 'supply' },
        ],
        vcGroups: [
          { type: 'VC_SQUAD', count: 10, area: { x:5, y:5, w:30, h:20 } },
          { type: 'VC_MORTAR', count: 5, area: { x:10, y:8, w:20, h:15 } },
          { type: 'VC_TUNNEL', count: 6, area: { x:5, y:5, w:25, h:20 } },
          { type: 'VC_COMMAND', count: 2, area: { x:6, y:6, w:8, h:8 } },
          { type: 'NVA_REG', count: 6, area: { x:15, y:5, w:20, h:20 } },
          { type: 'VC_RPG', count: 4, area: { x:8, y:5, w:25, h:18 } },
          { type: 'VC_RPK', count: 3, area: { x:10, y:8, w:20, h:15 } },
        ],
        hasNaval: false,
      },
      historicalOutcome: 'While US forces inflicted heavy casualties (~2,700 VC/NVA killed), COSVN escaped into Cambodia. The operation demonstrated the limitations of conventional military strategy against an enemy with a cross-border sanctuary. The US could win every battle but not the war.',
      winCondition: { objectives: 2, vcKills: 100 },
      lossCondition: { usCasualties: 100, timeLimit: 720 },
      vcDoctrine: 'Tunnel defense and Cambodian sanctuary. The VC 9th Division fights in short bursts then dissolves into underground tunnels — COSVN headquarters will slip across the border before encirclement is complete.',
      historicalEvents: [
        { time: 60,  msg: 'HISTORY: Largest US airborne operation since WWII — the only combat parachute jump of the Vietnam War is happening today.' },
        { time: 240, msg: 'HISTORY: COSVN has slipped into Cambodia. The US cannot pursue across the border — a restriction that will define this entire war.' },
        { time: 480, msg: 'HISTORY: Operation result: Despite 22 battalions, COSVN survives. "The enemy can be beaten everywhere, yet nothing is won." — Col. David Hackworth.' },
      ],
    },

    /* ──────────────────────────────────────────────────────
       4. SIEGE OF KHE SANH — January 21 – July 9, 1968
    ────────────────────────────────────────────────────── */
    {
      id: 3,
      opName: 'OPERATION SCOTLAND',
      name: 'Siege of Khe Sanh',
      date: '21 January – 9 July 1968',
      location: 'Khe Sanh Combat Base, Quảng Trị Province',
      situation: 'The NVA\'s 325th Division and 304th Division — approximately 20,000 soldiers — besiege the Khe Sanh Combat Base, held by 6,000 Marines and ARVN Rangers. US planners fear a "Vietnamese Dien Bien Phu."',
      history: 'The Siege of Khe Sanh lasted 77 days. The US responded with Operation Niagara — the most concentrated air bombing campaign in history up to that point. Over 100,000 tons of bombs were dropped. The Marines held out, but the siege is still debated as a diversion for the Tet Offensive.',
      intel: 'NVA forces have been tunneling towards US perimeter. Artillery is positioned on surrounding hills. Intelligence suggests the siege may be a diversion — watch for secondary attacks elsewhere. Enemy anti-aircraft assets are significant.',
      terrain: 'Quang Tri highlands near the DMZ and Laos border — rugged hills, jungle valleys, red clay. The Khe Sanh plateau is surrounded by dominating hills held by NVA. Monsoon weather limits air support.',
      objectives: [
        'Defend Khe Sanh Combat Base',
        'Hold Hill 861 and Hill 881',
        'Maintain the airstrip for resupply',
        'Destroy NVA siege positions',
      ],
      assets: { infantry:10, artillery:8, armor:3, helicopter:4, recon:2, airstrike:8, napalm:5, naval:0, resources:200 },
      mapConfig: {
        biome: 'HIGHLAND',
        width: 60, height: 40,
        features: { water: 0.02, jungle: 0.35, village: 0, hills: 0.5, roads: 1 },
        usStart: { x: 28, y: 20 },
        objectives: [
          { x: 28, y: 20, name: 'Khe Sanh Base', type: 'defend' },
          { x: 20, y: 10, name: 'Hill 881', type: 'hill' },
          { x: 35, y: 12, name: 'Hill 861', type: 'hill' },
          { x: 28, y: 22, name: 'Airstrip', type: 'airstrip' },
        ],
        vcGroups: [
          { type: 'NVA_REG', count: 12, area: { x:5, y:5, w:50, h:30 } },
          { type: 'NVA_HEAVY', count: 6, area: { x:5, y:5, w:50, h:30 } },
          { type: 'VC_MORTAR', count: 8, area: { x:10, y:8, w:40, h:24 } },
          { type: 'VC_TUNNEL', count: 5, area: { x:18, y:14, w:24, h:14 } },
          { type: 'VC_SNIPER', count: 6, area: { x:15, y:10, w:30, h:20 } },
          { type: 'VC_RPG', count: 5, area: { x:10, y:8, w:40, h:24 } },
          { type: 'VC_RPK', count: 4, area: { x:12, y:10, w:35, h:20 } },
        ],
        defenseMode: true,
        hasNaval: false,
      },
      historicalOutcome: 'The Marines held Khe Sanh. US forces suffered approximately 730 KIA; NVA losses are estimated at 10,000–15,000. However, the base was abandoned in July 1968 — the very outcome that General Westmoreland had promised would not happen. The strategic value of the siege remains disputed.',
      winCondition: { objectives: 3, timeLimit: 480, survivalMode: true },
      lossCondition: { objectivesLost: 2, usCasualties: 150 },
      vcDoctrine: 'Siege and encirclement modeled on Dien Bien Phu (1954). Dig trenches toward the perimeter. Mass mortars from the hills. Deny the airstrip and starve the garrison.',
      historicalEvents: [
        { time: 30,  msg: 'HISTORY: President Johnson has a scale model of Khe Sanh installed in the White House Situation Room. He is obsessed with its defense.' },
        { time: 180, msg: 'HISTORY: Operation Niagara begins — the most concentrated air bombing campaign in history to this date. Over 100,000 tons of bombs will fall.' },
        { time: 360, msg: 'HISTORY: Intelligence now suggests Khe Sanh was a diversion — the Tet Offensive is 10 days away, targeting 108 cities simultaneously.' },
      ],
    },

    /* ──────────────────────────────────────────────────────
       5. TET OFFENSIVE: BATTLE OF HUE — January–March 1968
    ────────────────────────────────────────────────────── */
    {
      id: 4,
      opName: 'OPERATION HUE CITY',
      name: 'Battle of Hue (Tet Offensive)',
      date: '31 January – 3 March 1968',
      location: 'Hue City, Thừa Thiên Province',
      situation: 'During the Tet Offensive, 10,000 NVA and VC fighters have seized the ancient imperial city of Hue. US Marines and ARVN must retake it block by block. The NVA holds the Citadel — a massive 1-square mile fortress.',
      history: 'The Battle of Hue was the longest and bloodiest battle of the Tet Offensive. US and ARVN forces retook the city over 26 days of intense urban combat. NVA forces executed 2,800–6,000 civilians. The destruction of one of Vietnam\'s most historic cities shocked the world.',
      intel: 'NVA has fortified every building in the Citadel. Civilians remain trapped inside — use of heavy weapons will cause civilian casualties and international outcry. Enemy snipers are in every high structure. Tunnel system runs beneath the entire Old City.',
      terrain: 'Dense urban environment — the Citadel\'s 1-meter thick walls, narrow streets, the Perfume River running through the city. Artillery is limited by civilian presence. The ancient imperial architecture provides excellent defensive positions.',
      objectives: [
        'Breach the Citadel\'s outer wall',
        'Secure the Imperial Palace',
        'Clear NVA from the Old City',
        'Minimize civilian casualties (public opinion critical)',
      ],
      assets: { infantry:15, artillery:4, armor:5, helicopter:6, recon:3, airstrike:4, napalm:2, naval:2, resources:220 },
      mapConfig: {
        biome: 'URBAN',
        width: 60, height: 40,
        features: { water: 0.15, jungle: 0.05, village: 0.4, hills: 0, roads: 0.3 },
        usStart: { x: 55, y: 35 },
        objectives: [
          { x: 15, y: 15, name: 'The Citadel', type: 'citadel' },
          { x: 25, y: 20, name: 'Imperial Palace', type: 'palace' },
          { x: 30, y: 25, name: 'Trang Tien Bridge', type: 'bridge' },
        ],
        vcGroups: [
          { type: 'NVA_REG', count: 14, area: { x:5, y:5, w:40, h:30 } },
          { type: 'VC_SNIPER', count: 8, area: { x:10, y:8, w:30, h:24 } },
          { type: 'VC_TUNNEL', count: 4, area: { x:10, y:10, w:30, h:20 } },
          { type: 'NVA_HEAVY', count: 4, area: { x:12, y:12, w:20, h:16 } },
          { type: 'VC_COMMAND', count: 2, area: { x:14, y:13, w:10, h:10 } },
          { type: 'VC_RPG', count: 5, area: { x:8, y:8, w:35, h:26 } },
          { type: 'VC_RPK', count: 4, area: { x:10, y:10, w:30, h:20 } },
        ],
        hasNaval: true,
        civilianRisk: true,
      },
      historicalOutcome: 'US and ARVN forces recaptured Hue on March 3, 1968. The battle cost 216 Americans and 384 ARVN killed; NVA/VC casualties exceeded 5,000. The execution of 2,800+ civilians by NVA forces was widely condemned. The battle, broadcast on television, severely damaged American public support for the war.',
      winCondition: { objectives: 2, vcKills: 80 },
      lossCondition: { usCasualties: 120, timeLimit: 660, opinionDrop: 30 },
      vcDoctrine: 'Fortify every building in the Citadel. Fight room by room. The 1-meter-thick ancient walls absorb artillery and air strikes. Make the Americans pay for every meter of the ancient imperial city.',
      historicalEvents: [
        { time: 60,  msg: 'HISTORY: The Citadel\'s walls were built in 1804 — designed to withstand artillery. US commanders did not know this when they called in fire support.' },
        { time: 200, msg: 'HISTORY: NVA forces execute 2,800–6,000 civilians in mass graves at Gia Hoi. The massacres will not be confirmed until 1969.' },
        { time: 400, msg: 'HISTORY: Walter Cronkite, CBS News: "It seems now more certain than ever that the bloody experience of Vietnam is to end in a stalemate."' },
      ],
    },

    /* ──────────────────────────────────────────────────────
       6. OPERATION LAM SON 719 — February–March 1971
    ────────────────────────────────────────────────────── */
    {
      id: 5,
      opName: 'LAM SON 719',
      name: 'Operation Lam Son 719',
      date: '8 February – 25 March 1971',
      location: 'Laos, along Route 9',
      situation: 'Vietnamization is underway — ARVN forces, supported by US air power but NO US ground troops (forbidden by Congress), invade Laos to cut the Ho Chi Minh Trail. This tests whether ARVN can fight independently.',
      history: 'Lam Son 719 was a military disaster for ARVN. Despite US air support, the ARVN suffered 1,519 killed and thousands wounded. Iconic images of ARVN soldiers clinging to helicopter skids revealed the failure of Vietnamization. The NVA inflicted massive casualties using Soviet-supplied tanks and anti-aircraft weapons.',
      intel: 'The NVA has concentrated the 70B Corps (36,000 troops) to defend the Ho Chi Minh Trail. Soviet-supplied T-54 tanks and ZPU anti-aircraft guns pose serious threats. Anti-aircraft fire will be extremely heavy. ARVN morale is questionable.',
      terrain: 'Laotian highlands — mountainous jungle, Route 9 (the main axis of advance), the A Shau Valley. Anti-aircraft threat is highest ever encountered. Limited helicopter operations due to enemy AA.',
      objectives: [
        'Cut the Ho Chi Minh Trail at Tchepone',
        'Destroy NVA supply depots',
        'Demonstrate ARVN combat effectiveness',
        'Withdraw with forces intact',
      ],
      assets: { infantry:10, artillery:6, armor:4, helicopter:5, recon:2, airstrike:8, napalm:4, naval:0, resources:220 },
      mapConfig: {
        biome: 'HIGHLAND',
        width: 60, height: 40,
        features: { water: 0.05, jungle: 0.5, village: 0, hills: 0.4, roads: 1 },
        usStart: { x: 58, y: 20 },
        objectives: [
          { x: 10, y: 20, name: 'Tchepone', type: 'town' },
          { x: 20, y: 15, name: 'Supply Depot Alpha', type: 'supply' },
          { x: 15, y: 25, name: 'Supply Depot Bravo', type: 'supply' },
        ],
        vcGroups: [
          { type: 'NVA_REG', count: 16, area: { x:5, y:5, w:45, h:35 } },
          { type: 'NVA_HEAVY', count: 8, area: { x:5, y:8, w:40, h:28 } },
          { type: 'NVA_TANK', count: 4, area: { x:8, y:10, w:30, h:20 } },
          { type: 'VC_MORTAR', count: 6, area: { x:10, y:10, w:35, h:25 } },
          { type: 'VC_RPG', count: 6, area: { x:8, y:8, w:40, h:30 } },
          { type: 'VC_RPK', count: 5, area: { x:10, y:10, w:35, h:25 } },
        ],
        hasNaval: false,
        heavyAA: true,
      },
      historicalOutcome: 'Lam Son 719 was a tactical and strategic failure. ARVN suffered over 50% casualties in some units. Images of soldiers hanging from helicopter skids filled American TV screens. The operation revealed that Vietnamization had not worked — South Vietnam could not defend itself without American ground troops.',
      winCondition: { objectives: 2, vcKills: 100 },
      lossCondition: { usCasualties: 130, timeLimit: 540 },
      vcDoctrine: 'Combined arms: coordinate Soviet-supplied T-54 tanks with NVA infantry. Saturate the approach routes with anti-aircraft guns. ARVN has no answer for armor — and US ground troops are forbidden by Congress from crossing the border.',
      historicalEvents: [
        { time: 45,  msg: 'HISTORY: Congress has passed the Cooper-Church Amendment — no US ground troops may enter Laos. ARVN fights alone on the ground.' },
        { time: 180, msg: 'HISTORY: NVA T-54 tanks appear in force — ARVN has never faced massed armor before. Entire units begin to break.' },
        { time: 360, msg: 'HISTORY: Images of ARVN soldiers clinging to helicopter skids to escape are broadcast worldwide. Nixon\'s Vietnamization policy is in ruins.' },
      ],
    },

    /* ──────────────────────────────────────────────────────
       7. EASTER OFFENSIVE: BATTLE OF AN LOC — April–June 1972
    ────────────────────────────────────────────────────── */
    {
      id: 6,
      opName: 'OPERATION NGUYEN HUE',
      name: 'Easter Offensive — Battle of An Lộc',
      date: '2 April – 20 June 1972',
      location: 'An Lộc, Bình Long Province',
      situation: 'North Vietnam launches its largest offensive since Tet — 120,000 NVA regulars with Soviet tanks strike across the DMZ. An Loc, 100km north of Saigon, is besieged by three NVA divisions. Almost no US ground troops remain.',
      history: 'The Easter Offensive (Nguyen Hue Offensive) was North Vietnam\'s largest conventional military operation to date. US air power — B-52 Arc Light strikes — was decisive in stopping the NVA advance. An Loc held after 66 days of siege. The offensive proved that without US air power, South Vietnam could not survive.',
      intel: 'Three NVA divisions (approximately 36,000 men) with Soviet T-54 and PT-76 tanks are besieging An Loc. Anti-aircraft coverage is extensive. B-52 strikes are available but must be carefully coordinated. The NVA has learned to hug ARVN positions to avoid strategic bombing.',
      terrain: 'Northern III Corps — rolling hills, rubber plantations, Route 13 ("Thunder Road") running north to south. Heavy vegetation. The town of An Loc is completely surrounded.',
      objectives: [
        'Hold An Lộc against NVA siege',
        'Destroy NVA armor concentrations',
        'Keep Route 13 clear for resupply',
        'Repel three major NVA assaults',
      ],
      assets: { infantry:8, artillery:8, armor:6, helicopter:4, recon:2, airstrike:10, napalm:5, naval:0, resources:250 },
      mapConfig: {
        biome: 'HIGHLAND',
        width: 60, height: 40,
        features: { water: 0.03, jungle: 0.3, village: 0.1, hills: 0.25, roads: 1 },
        usStart: { x: 28, y: 22 },
        objectives: [
          { x: 28, y: 22, name: 'An Lộc', type: 'defend' },
          { x: 28, y: 35, name: 'Route 13 South', type: 'road' },
        ],
        vcGroups: [
          { type: 'NVA_REG', count: 18, area: { x:3, y:3, w:55, h:36 } },
          { type: 'NVA_HEAVY', count: 8, area: { x:5, y:5, w:50, h:32 } },
          { type: 'NVA_TANK', count: 8, area: { x:5, y:5, w:50, h:32 } },
          { type: 'VC_MORTAR', count: 8, area: { x:5, y:5, w:50, h:32 } },
          { type: 'VC_COMMAND', count: 2, area: { x:5, y:5, w:25, h:20 } },
          { type: 'VC_RPG', count: 7, area: { x:5, y:5, w:50, h:32 } },
          { type: 'VC_RPK', count: 6, area: { x:5, y:5, w:50, h:32 } },
        ],
        defenseMode: true,
        hasNaval: false,
        b52Available: true,
      },
      historicalOutcome: 'An Lộc held after 66 days. US air power — including B-52 Arc Light missions — was decisive. NVA forces suffered approximately 100,000 casualties across the entire Easter Offensive. However, the NVA retained control of large areas of South Vietnam, and Paris peace negotiations accelerated. The offensive demonstrated that without US air power, South Vietnam would fall.',
      winCondition: { objectives: 1, timeLimit: 600, survivalMode: true },
      lossCondition: { objectivesLost: 1, usCasualties: 150 },
      vcDoctrine: 'Three-division conventional siege. Mass artillery preparation, then coordinated armor-infantry assault. Surround and strangle An Loc. Cut Route 13 south. This is no longer guerrilla war — this is the NVA fighting as a modern conventional army.',
      historicalEvents: [
        { time: 60,  msg: 'HISTORY: B-52 Arc Light strikes are falling within 1 kilometer of friendly lines — the closest strategic bombing to US-allied troops in history.' },
        { time: 300, msg: 'HISTORY: 120,000 NVA troops are attacking simultaneously across three fronts. The entire Easter Offensive is the largest operation since Tet.' },
        { time: 480, msg: 'HISTORY: Paris peace negotiations have accelerated. Nixon is preparing for the 1972 election. The military is being asked to hold the line until a deal is signed.' },
      ],
    },

    /* ──────────────────────────────────────────────────────
       8. FALL OF SAIGON — April 29–30, 1975
    ────────────────────────────────────────────────────── */
    {
      id: 7,
      opName: 'OPERATION FREQUENT WIND',
      name: 'Fall of Saigon',
      date: '29–30 April 1975',
      location: 'Saigon (Ho Chi Minh City), South Vietnam',
      situation: 'NVA forces have encircled Saigon. The Paris Peace Accords have collapsed. Congress has refused further military aid. Operation Frequent Wind — the evacuation of US personnel and key South Vietnamese allies — is underway. This is the end.',
      history: 'The Fall of Saigon on April 30, 1975 marked the end of the Vietnam War. NVA tanks crashed through the gates of the Presidential Palace. Operation Frequent Wind evacuated 7,000 Americans and 130,000 South Vietnamese. The iconic image of helicopters on the roof of the US Embassy became one of history\'s defining photographs.',
      intel: 'NVA forces are entering the city from multiple directions. ARVN resistance has largely collapsed. Your mission is not victory — it is to hold the embassy perimeter long enough to complete the evacuation. Every minute counts.',
      terrain: 'Dense urban environment — Saigon city center, the US Embassy compound, Tan Son Nhut airbase (now under fire). NVA armor is advancing through main boulevards.',
      objectives: [
        'Hold the US Embassy perimeter',
        'Evacuate all US personnel by helicopter',
        'Protect South Vietnamese civilian evacuees',
        'Survive until the last helicopter departs',
      ],
      assets: { infantry:6, artillery:0, armor:2, helicopter:8, recon:1, airstrike:2, napalm:0, naval:1, resources:150 },
      mapConfig: {
        biome: 'URBAN',
        width: 60, height: 40,
        features: { water: 0.08, jungle: 0.0, village: 0.5, hills: 0, roads: 0.4 },
        usStart: { x: 30, y: 20 },
        objectives: [
          { x: 30, y: 20, name: 'US Embassy', type: 'defend' },
          { x: 35, y: 15, name: 'Helicopter LZ', type: 'lz' },
        ],
        vcGroups: [
          { type: 'NVA_REG', count: 20, area: { x:0, y:0, w:60, h:40 } },
          { type: 'NVA_TANK', count: 10, area: { x:0, y:0, w:60, h:40 } },
          { type: 'NVA_HEAVY', count: 8, area: { x:0, y:0, w:60, h:40 } },
          { type: 'VC_RPG', count: 8, area: { x:0, y:0, w:60, h:40 } },
          { type: 'VC_RPK', count: 6, area: { x:0, y:0, w:60, h:40 } },
        ],
        defenseMode: true,
        evacuationMode: true,
        hasNaval: true,
      },
      historicalOutcome: 'Saigon fell on April 30, 1975. NVA tanks crashed through the gates of the Presidential Palace at 11:30 AM. The United States evacuated over 7,000 Americans and 130,000 South Vietnamese. 58,220 Americans had died in the war. The last words broadcast from the Saigon radio station were: "We must accept the reality that we have run out of time." The war was over.',
      winCondition: { evacuees: 5, timeLimit: 480, survivalMode: true },
      lossCondition: { objectivesLost: 1, usCasualties: 50 },
      vcDoctrine: 'Final offensive — no more concealment. NVA Tank No. 843 is driving openly down the main boulevard toward the Presidential Palace. This battle cannot be won militarily. The mission is evacuation, not combat.',
      historicalEvents: [
        { time: 30,  msg: 'HISTORY: Ambassador Graham Martin has refused to evacuate until now — he refused to believe Saigon would actually fall.' },
        { time: 120, msg: 'HISTORY: Radio Saigon plays "White Christmas" by Bing Crosby — the pre-arranged signal for all Americans to report to evacuation points immediately.' },
        { time: 300, msg: 'HISTORY: NVA Tank No. 843 crashes through the Presidential Palace gates at 11:30 AM. The flag of the Republic of South Vietnam is lowered for the last time.' },
        { time: 420, msg: 'HISTORY: The last helicopter leaves the US Embassy roof at 7:53 AM. 58,220 Americans and over 2 million Vietnamese civilians died in this war.' },
      ],
    },
  ];

  /* Historical documents for the document viewer */
  const DOCUMENTS = [
    {
      id: 'gulf_tonkin',
      title: 'Gulf of Tonkin Resolution',
      date: 'August 7, 1964',
      category: 'Government',
      stamp: 'SECRET',
      content: `JOINT RESOLUTION
To promote the maintenance of international peace and security in southeast Asia.

Whereas naval units of the Communist regime in Vietnam, in violation of the principles of the Charter of the United Nations and of international law, have deliberately and repeatedly attacked United States naval vessels lawfully present in international waters...

RESOLVED by the Senate and House of Representatives of the United States of America in Congress assembled, That the Congress approves and supports the determination of the President, as Commander in Chief, to take all necessary measures to repel any armed attack against the forces of the United States and to prevent further aggression.

Section 2. The United States regards as vital to its national interest and to world peace the maintenance of international peace and security in southeast Asia. Consonant with the Constitution of the United States and the Charter of the United Nations and in accordance with its obligations under the Southeast Asia Collective Defense Treaty, the United States is, therefore, prepared, as the President determines, to take all necessary steps, including the use of armed force, to assist any member or protocol state of the Southeast Asia Collective Defense Treaty requesting assistance in defense of its freedom.

[NOTE: Classified intelligence reports later revealed that the "second attack" on USS Maddox on August 4, 1964 — the primary justification for this resolution — almost certainly did not occur. Secretary of Defense McNamara acknowledged this in 1995.]`,
    },
    {
      id: 'pentagon_papers',
      title: 'Pentagon Papers — Key Excerpt',
      date: 'June 13, 1971',
      category: 'Classified Intel',
      stamp: 'TOP SECRET',
      content: `HISTORY OF U.S. DECISION-MAKING IN VIETNAM, 1945–68
[Declassified Excerpt — Published by New York Times, June 13, 1971]

The study reveals that the United States had been drawn more deeply into the Vietnam conflict than the public had been told. Among its conclusions:

1. The Truman Administration decided to support France's recolonization of Vietnam despite an internal assessment that this was "an antidemocratic action."

2. The Kennedy Administration had planned to escalate involvement regardless of the political outcome of 1963 South Vietnamese elections.

3. The Johnson Administration, while publicly stating it would not expand the war, had been planning air strikes against North Vietnam for months before telling the public.

4. The war was effectively unwinnable by 1965, according to internal assessments, yet troop commitments continued to increase.

The study was commissioned by Secretary of Defense Robert S. McNamara, who later wrote: "We were wrong, terribly wrong. We owe it to future generations to explain why."

[This document changed American history — it proved the government had systematically deceived the public about the Vietnam War.]`,
    },
    {
      id: 'mcnamara_memo',
      title: 'McNamara Memo on War Strategy',
      date: 'November 3, 1965',
      category: 'Strategy',
      stamp: 'TOP SECRET',
      content: `MEMORANDUM FOR THE PRESIDENT
FROM: Secretary of Defense Robert S. McNamara
SUBJECT: Recommendations of Additional Deployments to Vietnam

The US objective in Vietnam is to create conditions for a favorable outcome by persuading Hanoi, through sustained military pressure, that the cost of pursuing the war is unacceptably high...

Military situation: Although the Ia Drang battle demonstrated the tactical superiority of US forces, the enemy's willingness to accept casualties suggests that attrition alone will not achieve our objectives. The enemy can replace losses from the North; we cannot sustain indefinite escalation.

Recommendation: I recommend deployment of an additional 100,000 troops, bringing total US commitment to 400,000 men by end of 1966. However, I must be candid: even at this level, achieving decisive military victory within two years is unlikely.

[Personal note, written on this document and never sent]: "I am deeply troubled. We are asking Americans to die for a strategy that I increasingly believe cannot succeed. How do I advise the President honestly without undermining the war effort?" — R. McNamara`,
    },
    {
      id: 'ho_chi_minh_letter',
      title: 'Ho Chi Minh Letter to LBJ',
      date: 'February 15, 1967',
      category: 'Diplomatic',
      stamp: 'CONFIDENTIAL',
      content: `To President Lyndon B. Johnson,
President of the United States of America

Mr. President,

The Government of the United States has continued its war of aggression against Vietnam. The American people and people of the world are condemning this war.

Vietnam has never done any harm to the United States. The Vietnamese people have never threatened American security. We are fighting to defend our Fatherland and the sacred rights of every people: independence and freedom.

The Government of the United States must stop definitively and unconditionally its bombing raids and all other acts of war against the Democratic Republic of Vietnam, withdraw to the south all U.S. and satellite troops, recognize the South Vietnam National Front for Liberation, and let the Vietnamese people settle themselves their own affairs.

Our cause is just. Our people are resolute. Our army is heroic. Our entire people, united as one, will never yield.

Respectfully,
Ho Chi Minh
President, Democratic Republic of Vietnam

[President Johnson did not respond to this letter. US bombing resumed within weeks.]`,
    },
    {
      id: 'my_lai_report',
      title: 'My Lai Incident Report',
      date: 'March 16, 1968',
      category: 'Incident',
      stamp: 'CLASSIFIED',
      content: `INCIDENT REPORT — OPERATION MUSCATINE
Task Force Barker, Americal Division
Date of Incident: March 16, 1968
Location: My Lai (4), Son My Village, Quang Ngai Province

Initial report (filed March 1968): Elements of Charlie Company, 1st Battalion, 20th Infantry, conducted a combat assault against a reported VC stronghold at My Lai. 128 enemy combatants killed. No US casualties.

[Actual events, as established by Peers Commission, 1969]:
Between 347 and 504 unarmed South Vietnamese civilians were killed by US Army soldiers under the command of Lt. William Calley. Victims included women, children, and elderly. Many were herded into ditches and shot. Houses were burned. The village was completely destroyed.

No VC combatants were present at My Lai.

The incident was covered up for over a year. It was first reported publicly by journalist Seymour Hersh in November 1969. Only Lt. Calley was convicted — he served 3.5 years of house arrest before being pardoned.

[Effect on the war]: My Lai permanently altered American public opinion. The revelation that US soldiers had committed atrocities — and that the Army had covered it up — destroyed the moral argument for US involvement in Vietnam.`,
    },
    {
      id: 'kent_state',
      title: 'Kent State University — After Action',
      date: 'May 4, 1970',
      category: 'Domestic',
      stamp: 'UNCLASSIFIED',
      content: `OHIO NATIONAL GUARD AFTER-ACTION REPORT
Kent State University, Kent, Ohio
May 4, 1970

Summary: Ohio National Guard soldiers fired 67 rounds over 13 seconds into a crowd of student protesters on the Kent State University campus. Four students were killed; nine were wounded. None of the students were closer than 60 feet to the Guard soldiers. Most had their backs turned.

The four students killed:
• Allison Krause, 19 (protesting)
• Jeffrey Miller, 20 (protesting)
• Sandra Scheuer, 20 (walking to class)
• William Knox Schroeder, 19 (ROTC student, watching protest)

Public reaction: Within days, 4 million students across 900 campuses went on strike. 58 colleges closed. Construction workers attacked student protesters in New York City. President Nixon called protesters "bums." The country was more divided than at any point since the Civil War.

John Filo's Pulitzer Prize-winning photograph of Mary Ann Vecchio kneeling over Jeffrey Miller's body became one of the most iconic images of the 20th century.

[The Scranton Commission concluded that the shooting was "unnecessary, unwarranted, and inexcusable."]`,
    },
    {
      id: 'paris_accords',
      title: 'Paris Peace Accords — Summary',
      date: 'January 27, 1973',
      category: 'Diplomatic',
      stamp: 'OFFICIAL',
      content: `AGREEMENT ON ENDING THE WAR AND RESTORING PEACE IN VIETNAM
Signed: Paris, France — January 27, 1973

Key Provisions:

Article 1: The United States and all other countries respect the independence, sovereignty, unity, and territorial integrity of Vietnam.

Article 2: A ceasefire shall be observed throughout South Vietnam as of 2400 hours G.M.T., on January 27, 1973.

Article 5: Within sixty days of the signing of this Agreement, there will be a total withdrawal from South Vietnam of troops, military advisors, and military personnel including technical military personnel and military personnel associated with the pacification program, armaments, munitions, and war material of the United States.

Article 14: North Vietnam shall not send troops, military advisers, military equipment, or war material into South Vietnam.

[Assessment]:
The Accords allowed the US to withdraw with a "decent interval" — a face-saving measure. North Vietnam immediately violated Article 14, continuing to send troops south. Congress refused further military aid to South Vietnam. The Accords were, in practice, a face-saving exit for the United States.

Henry Kissinger and Le Duc Tho were awarded the Nobel Peace Prize. Le Duc Tho refused it, saying there was no peace.`,
    },
    {
      id: 'vc_captured_doc',
      title: 'Captured VC Battle Orders',
      date: 'March 12, 1967',
      category: 'Intelligence',
      stamp: 'SECRET',
      content: `[TRANSLATED FROM VIETNAMESE — CAPTURED DOCUMENT]
[Authenticity verified by MACV Intelligence, March 1967]

ORDER OF THE DAY
Political Officer, Liberation Front Forces, Binh Long Province

Comrades,

The American imperialists believe that their superior technology can defeat a people's will to resist. They are wrong.

Our tactics must always: (1) Avoid battle on American terms — never stand and fight where their air power and artillery can destroy us. (2) Drag them into jungle and tunnels where their technology is useless. (3) Strike quickly and withdraw before reinforcements arrive. (4) The people are our shield — make the Americans afraid to bomb villages. (5) Time is on our side — they cannot sustain casualties and public opposition simultaneously.

The liberation of our country will take as long as it takes. We have been fighting foreign invaders for one thousand years. We will fight one thousand more if necessary.

Remember: every American soldier who comes to understand this war is unwinnable is our ally. We need only hold out longer than the American political will can endure.

Victory to the People's Liberation Armed Forces.
[Signature — Name redacted]

[Analyst note: This document, and others like it, suggest the VC's primary strategic goal was not military victory but erosion of US political will. They were fighting a war of attrition — against American public opinion.]`,
    },
    {
      id: 'kennedy_advisors',
      title: 'Kennedy: Military Advisors Decision',
      date: 'November 22, 1961',
      category: 'Government',
      stamp: 'SECRET',
      content: `NATIONAL SECURITY ACTION MEMORANDUM No. 111
The White House — Washington
November 22, 1961

TO: Secretary of State, Secretary of Defense

Following consideration of General Taylor's and Mr. Rostow's report, the President has authorized the following actions with respect to South Vietnam:

1. The U.S. will increase its advisory and training mission. Additional U.S. helicopter units will be introduced with supporting U.S. maintenance and logistics personnel, as required.

2. U.S. military personnel will be authorized to accompany South Vietnamese units into combat for training purposes.

3. The President has NOT authorized commitment of U.S. combat forces. He emphasizes that the burden of fighting must remain with South Vietnam.

4. The President has asked that these deployments be carried out without fanfare or special announcement, to avoid the appearance of escalation.

PRESIDENTIAL NOTE (PRIVATE):
"I am deeply opposed to the introduction of U.S. combat troops. This will not save a weak government in Saigon — it will only delay the reckoning and make the eventual American withdrawal more costly. Our advisors can train; they cannot make the Vietnamese want to fight for their government." — J.F.K.

[By November 1963, there were 16,700 U.S. "advisors" in Vietnam. 78 had already died. After Kennedy's assassination, President Johnson dramatically expanded this commitment — a decision whose justification remains disputed by historians.]`,
    },
    {
      id: 'westmoreland_progress',
      title: 'Westmoreland "Light at Tunnel\'s End" Report',
      date: 'November 21, 1967',
      category: 'Military',
      stamp: 'SECRET',
      content: `PROGRESS REPORT TO CONGRESS
General William C. Westmoreland, MACV Commander
National Press Club, Washington D.C.
November 21, 1967

We have reached an important point when the end begins to come into view. We have been winning.

The enemy's guerrilla force has been declining at a steady rate. Our kill ratio — U.S. and allied kills versus U.S. casualties — has averaged 10:1. The enemy has been unable to mount a major offensive since 1965.

The enemy's infrastructure in the South is being systematically dismantled. The pacification program is showing measurable gains. Hamlet Evaluation Survey reports that 67% of South Vietnam's population now lives in "relatively secure" areas, up from 42% in 1966.

I am absolutely certain that, whereas in 1965 the enemy was winning, today he is certainly losing. I estimate that the enemy will be militarily defeated within two years.

CLASSIFIED ADDENDUM (not for public release):
What I cannot tell the American public: My own intelligence staff estimates the enemy has 600,000 fighters inside South Vietnam — far higher than our public figures. The Viet Cong has demonstrated an ability to replace casualties at a rate that makes attrition strategy increasingly ineffective. The "crossover point" where we kill more than they can recruit has not been reached.

[Six weeks after this speech, the Tet Offensive began. On January 31, 1968, the Viet Cong launched coordinated attacks on 108 cities, towns, and military installations simultaneously — including the U.S. Embassy in Saigon. The American public, told the enemy was losing, was not prepared for what they saw on television.]`,
    },
    {
      id: 'rolling_thunder',
      title: 'Operation Rolling Thunder — Final Assessment',
      date: 'October 31, 1968',
      category: 'Military',
      stamp: 'TOP SECRET',
      content: `OPERATION ROLLING THUNDER — FINAL ASSESSMENT
Department of Defense — Systems Analysis Office
October 31, 1968 (The day President Johnson halted bombing of North Vietnam)

OPERATION SUMMARY: March 2, 1965 — October 31, 1968 (3 years, 8 months)

SCALE OF OPERATION:
- 304,000 sorties flown by U.S. aircraft
- 864,000 tons of bombs dropped (more than all bombs dropped in the Pacific theater, World War II)
- 3,706 U.S. aircraft lost (918 pilots killed, 1,016 captured)
- Estimated cost: $6.6 billion USD

RESULTS — NORTH VIETNAM:
- Approximately 90,000 North Vietnamese civilians killed
- North Vietnamese industrial capacity severely damaged — but rapidly rebuilt with Soviet and Chinese aid
- Ho Chi Minh Trail throughput: INCREASED from approximately 60 tons/day (1965) to 6,000 tons/day (1968)

ASSESSMENT:
Rolling Thunder did not achieve its primary objectives. North Vietnamese war-making capacity was not broken. Supply lines were not severed. The bombing did not persuade Hanoi to negotiate on terms acceptable to Washington.

CONCLUSION:
"No amount of bombing of an agricultural society with minimal strategic industry will force that society to capitulate. We have dropped more steel on North Vietnam than fell on Germany in World War II. They are still fighting." — Secretary of Defense Clark Clifford, October 1968

[Rolling Thunder remains one of the most controversial strategic bombing campaigns in military history. Its failure contributed directly to the decision to pursue "Vietnamization" — training South Vietnamese forces to replace American troops.]`,
    },
    {
      id: 'tet_offensive_cia',
      title: 'CIA Analysis: The Tet Offensive',
      date: 'February 1, 1968',
      category: 'Classified Intel',
      stamp: 'TOP SECRET',
      content: `DIRECTORATE OF INTELLIGENCE — SPECIAL REPORT
SUBJECT: Assessment of Tet Offensive — First 24 Hours
DATE: February 1, 1968 — 0600 Hours

This office has now processed sufficient reports from the field to offer initial assessment of the coordinated enemy attacks that began January 31, 1968.

SCOPE: The enemy has launched simultaneous attacks against 108 military and civilian population centers. This includes:
- 5 of 6 major South Vietnamese cities (Hue, Da Nang, Nha Trang, Qui Nhon, Can Tho)
- 36 of 44 provincial capitals
- 64 of 245 district capitals
- Saigon itself — including the U.S. Embassy compound, ARVN headquarters, and Tan Son Nhut Air Base

ENEMY FORCES: Estimated 80,000 VC and NVA troops coordinated across the entire country simultaneously. This force was assembled, armed, and moved into position WITHOUT DETECTION by U.S. or ARVN intelligence — a catastrophic failure.

STRATEGIC ASSESSMENT:
The enemy has demonstrated an organizational capability that directly contradicts public statements by MACV command. General Westmoreland stated six weeks ago that the enemy was incapable of major offensive action. He was incorrect.

The military outcome of this offensive will likely favor U.S. forces — we expect most attacks to be repelled within weeks. However, the POLITICAL damage is incalculable. The American public has been told we are winning. They are now watching the U.S. Embassy being attacked on live television.

Walter Cronkite has just editorialized that the war is a "stalemate." When the most trusted man in America says the war cannot be won, this assessment is correct regardless of military outcomes.

[The Tet Offensive was a tactical defeat for the Viet Cong — most were killed. But it was a strategic victory. President Johnson announced on March 31, 1968 that he would not seek re-election.]`,
    },
    {
      id: 'vietnamization',
      title: 'Nixon\'s "Vietnamization" Address',
      date: 'November 3, 1969',
      category: 'Government',
      stamp: 'CONFIDENTIAL',
      content: `ADDRESS TO THE NATION ON THE WAR IN VIETNAM
President Richard M. Nixon
November 3, 1969

My fellow Americans:

Tonight I want to talk to you on a subject of deep concern to all Americans and to many people in all parts of the world — the war in Vietnam.

I have chosen a plan for peace. I have not chosen to Americanize the war, nor to surrender. Instead, I have chosen Vietnamization — the systematic transfer of combat responsibility from American to South Vietnamese forces.

Under this plan, U.S. troop withdrawals will begin immediately. As South Vietnamese forces become stronger, we will reduce our military presence. All remaining American ground forces will be withdrawn on a schedule that depends on the level of enemy activity and the progress of South Vietnamese training.

To the great silent majority of my fellow Americans — I ask for your support.

North Vietnam cannot humiliate the United States. Only Americans can do that. We will bring this war to a conclusion that will allow us to achieve our objective — a just and lasting peace. We will not be the first American president to suffer a defeat in war.

[HISTORICAL NOTE: The "Vietnamization" policy acknowledged what McNamara had written in 1965 — that the United States could not win this war militarily. Between 1969 and 1972, U.S. troop levels fell from 543,000 to under 50,000. The final U.S. troops left Vietnam in 1973 under the Paris Peace Accords. Saigon fell to North Vietnamese forces on April 30, 1975.]`,
    },
  ];

  return {
    list: BATTLE_LIST,
    docs: DOCUMENTS,
    get(idx) { return BATTLE_LIST[idx] || null; },
    count() { return BATTLE_LIST.length; },
  };
})();
