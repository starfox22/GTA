        // SignArt style table (SIGN_DESIGNS), designFor(), paint(), hotel and tower names, billboards and SignArt's API.
        /**
         * THE STYLE TABLE: business -> [family, parameters]. docs/SOURCE_GUIDE.md
         * lists the styles; copy the nearest line for a new business.
         */
        const SIGN_DESIGNS = {
          // Nightlife
          AFTERHOURS: ['neonScript', { script: 'after hours', tube: '#ff4fb8', swash: '#3ff0ff', icon: 'moon', iconColor: '#3ff0ff', balance: false }],
          'NEON PALACE': ['neonBlock', { shape: 'deco', board: '#0c0714', tube: '#c77dff', accent: '#3ff0ff', inline: true, border: 'zigzag', crown: 'crown', crownColor: '#ffd23f' }],
          'THE BLUE HOUR': ['deco', { ink: '#dfe9f2', glow: '#5fd0ff', mode: 'neon', fan: '#8fb8c8', track: 0.5 }],
          'BLUE HOUR HOTEL': ['deco', { board: '#0d1a26', shape: 'deco', ink: '#e9d4a0', glow: '#9fdad8', mode: 'halo', rules: true, fan: '#6c7f86' }],
          COCKTAILS: ['neonScript', { script: 'cocktails', tube: '#ffc46b', icon: 'martini', iconColor: '#7df7ff', balance: false }],
          'PRIVATE LOUNGE': ['plaque', {}],
          ELEVATOR: ['plaque', { metal: '#a9b2b8' }],
          'P · RESERVED GLASS': ['plaque', { lines: ['RESERVED'] }],
          'GOLDEN TIDE': ['bulbs', { shape: 'arch', board: '#6b0f1a', body: '#e8b04a', bulb: '#fff0c0', rim: '#d8a948', rays: 'rgba(255,210,120,0.12)', icon: 'dice', icon2: true, iconColor: '#f4efe6', iconColor2: '#6b0f1a', iconSize: 0.46, iconDy: 0.12 }],
          'ROYAL CINEMA': ['cinema', { lines: ['ROYAL', 'CINEMA'] }],
          'BANDSHELL · LIVE TONIGHT': ['lightbox', { panel: '#fff6e0', ink: '#b3202a', font: 'black', lines: ['BANDSHELL'], sub: 'LIVE TONIGHT', icon: 'note', icon2: true, iconColor: '#b3202a', checker: '#b3202a' }],
          // Pubs, diners, grills
          'THE RUSTY ANCHOR': ['wood', { plank: '#6b4a2e', ink: '#f0e2c0', rope: true, icon: 'anchor', icon2: true, iconColor: '#d9c9a0', lines: ['The', 'RUSTY ANCHOR'], ratio: [0.55, 1], font: 'times', sub: null }],
          'BAYVIEW TAVERN': ['enamel', { shape: 'oval', ground: '#12402c', ink: '#e7c46a', rim: '#e7c46a', font: 'times', gilt: true, subAbove: 'EST. 1961', sub: 'ALES · SPIRITS · FOOD', lines: ['BAYVIEW TAVERN'] }],
          'THE BLUE PLATE DINER': ['diner', { panel: '#b3202a', script: 'Blue Plate', block: 'DINER', tube: '#8fd8ff', icon: 'cup' }],
          'ROSIE’S DINER': ['diner', { panel: '#1d6f8a', script: 'Rosie’s', block: 'DINER', tube: '#ff7ab8', icon: 'cup' }],
          'PALM GRILL · 24 HOURS': ['lightbox', { panel: '#ffd23a', ink: '#c8102e', font: 'black', skew: 0.18, outline: '#3a1a00', lines: ['PALM GRILL'], icon: 'palm', iconColor: '#1e7a3c', iconColor2: '#6b3a12', tab: 'OPEN 24 HRS', tabColor: '#c8102e', tabInk: '#fff4c0', shape: 'pill', balance: false }],
          // Health, learning, law
          'SAINT MARLOW HOSPITAL': ['lightbox', { panel: '#f4f6f5', ink: '#123a6b', band: '#123a6b', icon: 'cross', iconColor: '#d42a2a', iconBox: '#ffffff', font: 'sans', weight: '700', lines: ['SAINT MARLOW', 'HOSPITAL'], ratio: [1.25, 1] }],
          'RIVERSIDE MEDICAL': ['lightbox', { panel: '#f4f6f5', ink: '#0f4f4a', band: '#0f7a6e', icon: 'cross', iconColor: '#ffffff', font: 'sans', weight: '700', lines: ['RIVERSIDE', 'MEDICAL CENTER'], ratio: [1.25, 1] }],
          'EMERGENCY · 24H': ['lightbox', { panel: '#c8102e', ink: '#ffffff', font: 'black', weight: '900', icon: 'cross', iconColor: '#ffffff', lines: ['EMERGENCY'], tab: '24H', tabColor: '#ffffff', tabInk: '#c8102e' }],
          'SOUTH COAST COLLEGE': ['carved', { ground: '#5a1622', kind: 'enamel', icon: 'shield', icon2: true, iconColor: '#d9ae55', iconColor2: '#5a1622', font: 'times', spacing: 0.16, lines: ['SOUTH COAST', 'COLLEGE'], ratio: [0.8, 1.1], sub: 'EST. MCMXXIV' }],
          'RIVERSIDE HIGH SCHOOL': ['varsity', { ground: '#1d3f8f', fill: '#ffd23a', outline: '#ffffff', shadow: '#0a1a3a', icon: 'star', icon2: true, iconColor: '#ffd23a', lines: ['RIVERSIDE', 'HIGH SCHOOL'], ratio: [1.4, 0.9], arc: 6 }],
          'SOUTH COAST POLICE': ['enamel', { ground: '#0e2244', ink: '#ffffff', rim: '#d4af37', icon: 'badge', icon2: true, iconColor: '#d4af37', iconColor2: '#0e2244', font: 'times', spacing: 0.12, backlit: true, sub: 'DEPARTMENT · DISTRICT 1' }],
          // Guns and surplus
          'SOUTH COAST ARMORY': ['stencil', { ground: '#4b5320', kind: 'steel', ink: '#ece5c8', lines: ['SOUTH COAST', 'ARMORY'], ratio: [0.75, 1.25], icon: 'target', icon2: 'pistols', iconColor: '#ece5c8', iconColor2: '#b3202a', rivets: true, rust: 0.6, hazard: 'bottom' }],
          'PALM KEYS ARMORY': ['stencil', { ground: '#3d4a2a', ink: '#f2c21b', icon: 'pistols', icon2: 'target', iconColor: '#f2c21b', iconColor2: '#3d4a2a', rivets: true, rust: 0.4 }],
          'SENTINEL SURPLUS': ['stencil', { ground: '#6b6a4a', kind: 'steel', ink: '#1d1d1d', icon: 'star', icon2: true, iconColor: '#1d1d1d', rivets: true, rust: 0.5, sub: 'ARMY · NAVY · GEAR' }],
          'WEAPONS · AMMO · ARMOR': ['stencil', { ground: '#f2c21b', ink: '#141414', hazard: 'border', border: null, stencil: true }],
          // Garages and cars
          // The respray garages (garages.js): every billboard says MECHANICS.
          'EASTSIDE GARAGE': ['customs', { sub: 'MECHANICS · RESPRAY · REPAIR' }],
          'PALM KEYS AUTO': ['airbrush', { grad: ['#ff7ac0', '#ff9a5a', '#27c6c0'], icon: 'spray', iconColor: '#ffffff', iconColor2: '#1b2a4a', palms: false, lines: ['PALM KEYS AUTO'], sub: 'MECHANICS · RESPRAYS WHILE YOU WAIT', outline: '#2a1a4a' }],
          'SOUTH BANK MOTOR WORKS': ['enamel', { ground: '#1d3b7a', ink: '#d8261c', innerInk: '#d8261c', inner: '#f2efe6', rim: '#f2efe6', font: 'slab', weight: '900', lines: ['SOUTH BANK', 'MOTOR WORKS'], ratio: [0.7, 1], icon: 'piston', icon2: true, iconColor: '#f2efe6', iconColor2: '#1d3b7a', backlit: false, sub: 'MECHANICS · BODYWORK · PAINT', subInk: '#1d3b7a' }],
          'STONECREEK GARAGE': ['painted', { ground: '#7a2e22', ink: '#f0e6c8', icon: 'tyre', icon2: 'wrench', iconColor: '#f0e6c8', iconColor2: '#7a2e22', font: 'slab', sub: 'MECHANICS · TOWING · TYRES' }],
          // The lightbox over each garage's office door.
          MECHANICS: ['lightbox', { panel: '#1e2327', ink: '#ffd200', icon: 'wrench', icon2: true, iconColor: '#ffd200', font: 'sans', weight: '800', spacing: 0.22 }],
          // Rooms
          'SUNSET MOTEL': ['neonScript', { board: '#1f8a8c', shape: 'boomerang', rim: '#f4efe2', script: 'Sunset', block: 'MOTEL', tube: '#ff8a3d', blockTube: '#ff3b5c', painted: 'sunset', paintedColor: '#ffb347', flicker: true }],
          'CORAL PALMS MOTEL': ['neonScript', { board: '#f29c8f', shape: 'round', rim: '#fff4e6', script: 'Coral Palms', block: 'MOTEL', tube: '#19d3c5', blockTube: '#1a5fd0', icon: 'palm', iconColor: '#2fe07a', iconFill: '#1f7a52', flicker: true, balance: false }],
          'SAFEHOUSE · ROOMS': ['hand', { ground: '#d9d0b8', ink: '#6e1f1f', lines: ['ROOMS'] }],
          'CAUSEWAY INN': ['enamel', { ground: '#0f3550', ink: '#f4e7c5', rim: '#f4e7c5', icon: 'helm', icon2: true, iconColor: '#f4e7c5', font: 'times', shape: 'round', sub: 'ROOMS · BAR · BAIT' }],
          // Clothes
          'SOUTH COAST OUTFITTERS': ['enamel', { ground: '#cdbb8a', kind: 'matte', ink: '#1f4a2c', rim: '#1f4a2c', font: 'slab', weight: '900', icon: 'mountain', iconColor: '#1f4a2c', iconColor2: '#f2ecd8', sub: 'SUPPLY CO. · SINCE 1952' }],
          'OCEAN DRIVE MENSWEAR': ['deco', { board: '#0a0a0c', ink: '#d9b25a', glow: '#ffd98a', mode: 'halo', rules: true, ruleColor: '#8a6d34', lines: ['OCEAN DRIVE', 'MENSWEAR'], ratio: [1.25, 1], track: 0.55 }],
          // Civic, transport, industry
          MARINA: ['enamel', { ground: '#f4f1e8', ink: '#0e2c57', rim: '#0e2c57', icon: 'helm', icon2: 'anchor', iconColor: '#0e2c57', font: 'times', spacing: 0.3 }],
          HELIPAD: ['lightbox', { panel: '#1c1c1c', ink: '#ffd200', icon: 'plane', iconColor: '#ffd200', font: 'sans', spacing: 0.25 }],
          'SOUTHPORT INTERNATIONAL': ['lightbox', { panel: '#1e2327', ink: '#ffffff', band: '#ffd200', icon: 'plane', iconColor: '#1e2327', font: 'sans', weight: '700', lines: ['SOUTHPORT', 'INTERNATIONAL AIRPORT'], ratio: [1.3, 1] }],
          'OCEANVIEW INTERNATIONAL': ['lightbox', { panel: '#1e2327', ink: '#ffffff', band: '#ffd200', icon: 'plane', iconColor: '#1e2327', font: 'sans', weight: '700', lines: ['OCEANVIEW', 'INTERNATIONAL AIRPORT'], ratio: [1.3, 1] }],
          'DEPARTURES / ARRIVALS': ['lightbox', { panel: '#ffd200', ink: '#16181a', icon: 'plane', icon2: true, iconColor: '#16181a', font: 'sans', weight: '700', lines: ['DEPARTURES  ·  ARRIVALS'] }],
          'IRONWORKS CARGO': ['stencil', { ground: '#2f5d8a', kind: 'steel', ink: '#f2f2ea', rust: 1, icon: 'ship', iconColor: '#f2f2ea', iconColor2: '#c4121a', sub: 'CONTAINER · BULK · BONDED' }],
          'MORETTI FREIGHT': ['stencil', { ground: '#8a2f22', kind: 'steel', ink: '#f2e6c8', rust: 1.2, sub: 'EST. 1958 · BAYFRONT' }],
          'FREIGHT CO.': ['painted', { ground: '#39463a', ink: '#e8dfc2', lines: ['SOUTH COAST FREIGHT CO.'], sub: 'HAULAGE · STORAGE', age: 1.5 }],
          'RESTRICTED · KEEP CLEAR': ['stencil', { ground: '#f4f4ee', ink: '#b3202a', icon: 'warn', iconColor: '#f2c21b', iconColor2: '#141414', lines: ['RESTRICTED'], sub: 'KEEP CLEAR · NO ENTRY', subInk: '#141414', border: '#b3202a', stencil: false, weight: 0.16, reflective: true }],
          'SOUTH COAST STADIUM': ['varsity', { ground: '#10213f', fill: '#ff7a1a', outline: '#ffffff', icon: 'ball', icon2: true, iconColor: '#ffffff', iconColor2: '#10213f', slant: 0.12, backlit: true, stripe: '#ff7a1a' }],
          TICKETS: ['pixel', { ink: '#ffb020', accent: '#ff7a1a' }],
          // The betting shop beside the stadium plaza (sportsbook3d.js).
          'GOALLINE SPORTS BET': ['neonBlock', { board: '#04120a', tube: '#3dff8e', tube2: '#ffe14d', accent: '#3dff8e', lines: ['GOALLINE', 'SPORTS BET'], ratio: [1.35, 0.75], icon: 'ball', icon2: true, iconColor: '#f4fff8', track: 0.26, border: 'rect' }],
          '24 HOUR': ['lightbox', { panel: '#ffffff', ink: '#1f8a4c', font: 'black', weight: '900', stripes: ['#f47b20', '#1f8a4c', '#d7262e'], lines: ['24 HOUR STORE'], outline: null }],
          'EXCHANGE UNDERPASS': ['highway', { arrow: 'up' }],
          'ROAD UNDERPASS': ['highway', { arrow: 'up' }],
          'OCEANVIEW / AIRPORT': ['highway', { icon: 'plane', arrow: 'right' }],
          'EAGLE PASS · SCENIC ROUTE': ['highway', { ground: '#6b3f1f', icon: 'mountain' }],
          'CORAL COAST': ['enamel', { ground: '#f2ccae', ink: '#1f5f63', rim: '#1f5f63', font: 'times', subAbove: 'WELCOME TO THE', icon: 'palm', icon2: true, iconColor: '#1f5f63', shape: 'round' }],
          // The park
          'CENTRAL GARDEN': ['wood', { plank: '#4a3522', ink: '#efe0b8', routed: true, icon: 'leaf', icon2: true, iconColor: '#9fca7a', font: 'times', sub: 'CITY PARKS · OPEN DAWN TO DUSK' }],
          '4X4 CLUB': ['wood', { plank: '#4a2f1a', ink: '#f3dca8', routed: true, icon: 'mountain', icon2: 'tyre', iconColor: '#e0a64a', iconColor2: '#4a2f1a', font: 'slab', sub: 'RIDGELINE TRAIL RIDERS · EST. 1987' }],
          // The Ridgeline mountain villages (mountain-village.js): carved and routed
          // wood, painted boards, gold leaf on the chapel; lantern-lit.
          'RIDGELINE 4X4 CLUB': ['wood', { plank: '#3d2616', ink: '#f3dca8', routed: true, icon: 'tyre', icon2: 'mountain', iconColor: '#e0a64a', iconColor2: '#3d2616', font: 'slab', lines: ['RIDGELINE 4X4 CLUB'], sub: 'CLUBHOUSE · MEMBERS & GUESTS' }],
          NORTHRIDGE: ['wood', { plank: '#4a3522', ink: '#f3e2b8', routed: true, icon: 'mountain', icon2: 'tree', iconColor: '#f3e2b8', iconColor2: '#9fca7a', font: 'times', subAbove: 'WELCOME TO', sub: 'GATEWAY TO THE RIDGELINE · ELEV. 610 M' }],
          STONECREEK: ['wood', { plank: '#5a3a22', ink: '#f3e2b8', routed: true, icon: 'tree', icon2: true, iconColor: '#9fca7a', font: 'times', subAbove: 'WELCOME TO', sub: 'EST. 1889 · DRIVE SLOW' }],
          EASTGATE: ['wood', { plank: '#4a3a2a', ink: '#f3e2b8', routed: true, icon: 'tree', icon2: 'mountain', iconColor: '#f3e2b8', font: 'times', subAbove: 'WELCOME TO', sub: 'TIMBER TOWN · EST. 1902' }],
          'NORTHRIDGE OUTFITTERS': ['wood', { plank: '#2f4a34', ink: '#f2ead0', routed: true, icon: 'mountain', icon2: true, iconColor: '#f2ead0', font: 'slab', sub: 'SKI · BIKE · HUNTING · RENTALS' }],
          'STONECREEK OUTFITTERS': ['painted', { ground: '#2f4a34', ink: '#efe4c4', icon: 'mountain', iconColor: '#efe4c4', font: 'slab', sub: 'GUNS · AMMO · CAMPING', age: 0.8 }],
          'EASTGATE OUTFITTERS': ['painted', { ground: '#5a2a1e', ink: '#efe4c4', icon: 'target', iconColor: '#efe4c4', iconColor2: '#5a2a1e', font: 'slab', sub: 'HUNTING · FISHING · GUNS', age: 1 }],
          'NORTHRIDGE LODGE': ['wood', { plank: '#4a2e1a', ink: '#f3d9a4', routed: true, icon: 'tree', icon2: true, iconColor: '#9fca7a', iconColor2: '#3a2616', font: 'times', sub: 'ROOMS · FIRESIDE BAR · EST. 1921' }],
          'ALPENGLOW CAFÉ': ['painted', { ground: '#e8dcc0', ink: '#6e2a22', icon: 'cup', iconColor: '#6e2a22', font: 'times', lines: ['ALPENGLOW CAFÉ'], sub: 'ESPRESSO · STRUDEL', age: 0.4 }],
          'GENERAL STORE': ['painted', { ground: '#e6dcc2', ink: '#2a3a4a', font: 'times', lines: ['NORTHRIDGE GENERAL STORE'], sub: 'GROCERIES · HARDWARE · POST OFFICE', age: 1.2 }],
          'MOUNTAIN CHAPEL': ['carved', { ground: '#2a3a2e', kind: 'wood', font: 'times', icon: 'star', iconColor: '#e8c170', sub: 'ALL ARE WELCOME' }],
          'PINE CONE BAKERY': ['painted', { ground: '#3a5a3a', ink: '#f4ead0', icon: 'wheat', icon2: true, iconColor: '#e8c170', font: 'times', sub: 'BREAD · PRETZELS · PIE', age: 0.5 }],
          'RANGER STATION': ['wood', { plank: '#5a3a1e', ink: '#f1e6c2', routed: true, icon: 'tree', icon2: 'mountain', iconColor: '#f1e6c2', font: 'slab', lines: ['RIDGELINE RANGER STATION'], sub: 'COUNTY PARKS · PERMITS · MAPS' }],
          'MOUNTAIN RESCUE': ['painted', { ground: '#a8261e', ink: '#fbf4e2', icon: 'cross', iconColor: '#fbf4e2', font: 'slab', sub: 'SEARCH · RESCUE · HELIPAD', age: 0.3 }],
          'SUMMIT DINER': ['painted', { ground: '#1f3a4a', ink: '#f4e2b0', icon: 'cup', icon2: 'mug', iconColor: '#f4e2b0', font: 'slab', sub: 'BREAKFAST ALL DAY · PIE', age: 0.7 }],
          'THE ANTLER TAVERN': ['wood', { plank: '#3a2414', ink: '#f0d49a', routed: true, icon: 'mug', icon2: true, iconColor: '#e8b04a', font: 'times', lines: ['The', 'ANTLER TAVERN'], ratio: [0.55, 1], sub: null }],
          'RIDGELINE RENTALS': ['wood', { plank: '#27384f', ink: '#f2ead0', routed: true, icon: 'mountain', iconColor: '#f2ead0', font: 'slab', sub: 'SKI · BIKE · KAYAK · SLED' }],
          'STONECREEK LODGE': ['wood', { plank: '#5a3a22', ink: '#f3d9a4', routed: true, icon: 'tree', icon2: true, iconColor: '#9fca7a', iconColor2: '#3a2616', font: 'times', sub: 'ROOMS · CABINS · SINCE 1904' }],
          'PINE CREST MOTEL': ['wood', { plank: '#2f4a34', ink: '#f3e2b8', routed: true, icon: 'tree', icon2: true, iconColor: '#9fca7a', font: 'slab', sub: 'COLOR TV · KITCHENETTES' }],
          VACANCY: ['hand', { ground: '#f1e6c8', ink: '#a8261e', lines: ['VACANCY'] }],
          'GAS · GROCERIES': ['painted', { ground: '#a8261e', ink: '#fbf4e2', icon: 'flame', iconColor: '#f2c21b', font: 'slab', lines: ['GAS · GROCERIES'], sub: 'BAIT · ICE · FIREWOOD', age: 0.6 }],
          'EASTGATE LODGE': ['wood', { plank: '#4a3a2a', ink: '#f3d9a4', routed: true, icon: 'tree', icon2: true, iconColor: '#9fca7a', iconColor2: '#3a2616', font: 'times', sub: 'ROOMS · HOT TUB' }],
          'FEED & SEED': ['painted', { ground: '#6b2a24', ink: '#f4ead0', icon: 'wheat', icon2: true, iconColor: '#e8c170', font: 'slab', lines: ['EASTGATE FEED & SEED'], sub: 'HARDWARE · TACK · LUMBER', age: 1.4 }],
          'RIDGELINE TIMBER CO.': ['wood', { plank: '#4a3a2a', ink: '#f3e2b8', routed: true, icon: 'tree', icon2: true, iconColor: '#f3e2b8', font: 'slab', sub: 'SAWMILL · LUMBER · FIREWOOD' }],
          'MILL OFFICE': ['hand', { ground: '#e0d4b4', ink: '#3a2a1a', lines: ['MILL OFFICE'] }],
          'TIMBERLINE CAFÉ': ['painted', { ground: '#4a2a1e', ink: '#f4e2b0', icon: 'cup', iconColor: '#f4e2b0', font: 'times', lines: ['TIMBERLINE CAFÉ'], sub: 'COFFEE · PIE · SOUP', age: 0.5 }],
          'MOUNT ASCENT TRAILHEAD': ['wood', { plank: '#5b3b1f', ink: '#f2e3b3', routed: true, icon: 'mountain', iconColor: '#f2e3b3', iconColor2: '#5b3b1f', font: 'times', lines: ['MOUNT ASCENT TRAILHEAD'], sub: '4×4 TRAIL · HILL CLIMB START' }],
          'OUTDOOR GYM': ['wood', { plank: '#4a3522', ink: '#efe0b8', routed: true, icon: 'dumbbell', iconColor: '#efe0b8', font: 'sans' }],
          'GARDEN LAKE · BOATHOUSE': ['wood', { plank: '#3f5a6a', ink: '#f4f1e8', icon: 'helm', iconColor: '#f4f1e8', font: 'times', lines: ['BOATHOUSE'], sub: 'GARDEN LAKE · ROWBOATS' }],
          // Sunset Pier
          'THE FALCON': ['varsity', { ground: '#1b1f5c', fill: '#ffcf3a', outline: '#ff4a3a', shadow: '#0a0a2a', icon: 'wing', iconColor: '#ffcf3a', slant: 0.25, backlit: true }],
          'SUNSET EYE': ['bulbs', { board: '#12324f', body: '#5fb8e8', bulb: '#e8fbff', rim: '#9fe6ff', icon: 'sun', icon2: true, iconColor: '#ffcf5a' }],
          'SUNSET PALACE': ['deco', { board: '#3b1f4a', shape: 'deco', ink: '#f3cf7a', glow: '#ff9fd8', mode: 'neon', fan: '#8a6aa0', rules: true }],
          'SUNSET PIER': ['bulbs', { shape: 'scallop', board: '#c8102e', body: '#ffd23a', bulb: '#fff6d0', rim: '#ffffff', rays: 'rgba(255,255,255,0.22)', bounce: 0.08, icon: 'star', icon2: true, iconColor: '#ffffff' }],
          'FREE FALL': ['neonBlock', { board: '#0a0a0a', tube: '#ff3b2e', accent: '#ffd23f', slant: 0.12, icon: 'bolt', icon2: true, iconColor: '#ffd23f' }],
          'WADI SPLASH': ['arabian', { board: '#0f6a86', glow: '#7df7ff' }],
          'ARABIAN NIGHTS': ['arabian', { board: '#3a1452', glow: '#ffd23f' }],
          DODGEMS: ['bulbs', { shape: 'scallop', board: '#161616', body: '#ff4fa0', body2: '#4ff0ff', bulb: '#fff0f8', rim: '#ffd23a', bounce: 0.1, icon: 'car', icon2: true, iconColor: '#4ff0ff', iconColor2: '#161616' }],
          // Monarch Isle (monarch3d.js): the island's houses, one design each.
          'MAISON VERAUD': ['deco', { board: '#0a0a0c', ink: '#eadfc6', glow: '#fff1d6', mode: 'halo', rules: true, ruleColor: '#8a7a5a', track: 0.62 }],
          'HALDEN & FROST': ['carved', { ground: '#0f3b36', kind: 'enamel', icon: 'star', icon2: true, iconColor: '#e2c67a', font: 'palatino', ink: '#e2c67a', spacing: 0.14, sub: 'FINE JEWELLERS · EST. 1899' }],
          VALMONT: ['deco', { board: '#10192b', ink: '#d8e2ee', glow: '#cfe4ff', mode: 'halo', rules: true, ruleColor: '#6b7a90', track: 0.8, lines: ['VALMONT'], ratio: [1] }],
          'SAVILLE & CROWN': ['carved', { ground: '#1b2230', icon: 'scissors', iconColor: '#e8dcc0', font: 'palatino', ink: '#e8dcc0', sub: 'BESPOKE TAILORS' }],
          'FLEUR DE LYS': ['neonScript', { board: '#eef3e6', boardKind: 'enamel', rim: '#355a3a', script: 'Fleur de Lys', tube: '#ff6fa8', icon: 'flower', iconColor: '#ffd23f', iconFill: '#ff8ac0', backer: '#c8d2bc' }],
          'CROWN PRIVATE BANK': ['carved', { ground: '#10202e', icon: 'crown', icon2: true, iconColor: '#d9ae55', font: 'times', ink: '#e7cf8e', spacing: 0.18, lines: ['CROWN', 'PRIVATE BANK'], ratio: [1.1, 0.8] }],
          'AURELIE PARIS': ['deco', { board: '#efe9dd', ink: '#1a1a1a', glow: '#fff4e0', mode: 'halo', rules: true, ruleColor: '#b39a6a', track: 0.55, lines: ['AURELIE', 'PARIS'], ratio: [1.3, 0.7] }],
          'ORO & PERLA': ['carved', { ground: '#3a1f28', kind: 'enamel', icon: 'heart', icon2: true, iconColor: '#e6c886', font: 'palatino', ink: '#f0dcae', sub: 'GIOIELLI' }],
          'THE PROVISIONER': ['enamel', { ground: '#1f3d2c', ink: '#efe2b8', rim: '#c7a45a', font: 'times', spacing: 0.12, icon: 'wheat', icon2: true, iconColor: '#e2c26a', subAbove: 'THE', lines: ['PROVISIONER'], sub: 'FINE FOODS · CHEESE · WINE' }],
          'CAFÉ ROYALE': ['neonScript', { board: '#2b1a12', boardKind: 'enamel', script: 'Café Royale', tube: '#ffd08a', icon: 'cup', iconColor: '#ffb070', backer: '#3d2a1e' }],
          'VINTAGE & VINE': ['wood', { plank: '#4a1420', ink: '#f2dca8', routed: true, icon: 'martini', icon2: true, iconColor: '#e6c886', font: 'times', sub: 'WINE BAR · CELLAR' }],
          'GALERIE MONARCH': ['lightbox', { panel: '#f6f4ee', ink: '#141414', font: 'futura', weight: '500', spacing: 0.35, band: null, lines: ['GALERIE MONARCH'] }],
          'THE HALCYON CLINIC': ['lightbox', { panel: '#f4f6f5', ink: '#0f4f4a', band: '#0f7a6e', icon: 'cross', iconColor: '#ffffff', font: 'sans', weight: '600', lines: ['THE HALCYON', 'PRIVATE CLINIC'], ratio: [1.2, 0.9] }],
          'AQUA SERENA SPA': ['neonScript', { board: '#e8f2f0', boardKind: 'enamel', rim: '#1f5f63', script: 'Aqua Serena', tube: '#3fd8d0', block: 'SPA', blockTube: '#1f7a8a', icon: 'leaf', iconColor: '#3fd8a0', iconFill: '#1f7a52', backer: '#c8d8d4' }],
          'L’ÉTOILE': ['deco', { board: '#0c0c10', ink: '#e8d6a8', glow: '#ffe8b8', mode: 'neon', fan: '#6b5a3a', rules: true, track: 0.5, lines: ['L’ÉTOILE'] }],
          'THE REGENT HOTEL': ['deco', { board: '#1b2638', shape: 'deco', ink: '#ecd9a6', glow: '#ffe2a8', mode: 'halo', rules: true, fan: '#6b7a8a', lines: ['THE REGENT', 'HOTEL'], ratio: [1.2, 0.7] }],
          'MONARCH AUTOMOBILI': ['lightbox', { panel: '#111316', ink: '#f2f2ee', font: 'futura', weight: '800', spacing: 0.3, band: '#c8102e', bandSide: 'bottom', icon: 'car', iconColor: '#c8102e', lines: ['MONARCH AUTOMOBILI'] }],
          SOLARIS: ['lightbox', { panel: '#0e2a3a', ink: '#ffffff', font: 'sans', weight: '800', icon: 'sun', iconColor: '#ffc22a', stripes: ['#ffc22a', '#1fa0d0'], lines: ['SOLARIS'], sub: 'PREMIUM FUEL · EV', subInk: '#ffc22a' }],
          'THE OYSTER ROOM': ['enamel', { ground: '#12324a', ink: '#f3ead2', rim: '#c9a45a', font: 'times', shape: 'oval', gilt: true, icon: 'fish', icon2: true, iconColor: '#f3ead2', subAbove: 'THE', lines: ['OYSTER ROOM'], sub: 'SEAFOOD · CHAMPAGNE' }],
          'GELATERIA DOLCE': ['neonScript', { board: '#f4d9e0', boardKind: 'enamel', rim: '#c47a8a', script: 'Dolce', block: 'GELATERIA', tube: '#ff6fa8', blockTube: '#4fb8ff', icon: 'heart', iconColor: '#ff6fa8', iconFill: '#ffc0d0', backer: '#e8c8d0' }],
          'OCEANIS YACHTS': ['enamel', { ground: '#0e2c57', ink: '#f4f1e8', rim: '#f4f1e8', font: 'sans', weight: '700', spacing: 0.3, icon: 'helm', icon2: true, iconColor: '#f4f1e8', sub: 'BROKERAGE · CHARTER' }],
          'MARINE CHANDLERY': ['wood', { plank: '#1d3f6e', ink: '#ffffff', rope: true, icon: 'anchor', icon2: true, iconColor: '#ffffff', font: 'slab', lines: ['MARINE', 'CHANDLERY'] }],
          'CHAMPAGNE BAR': ['neonScript', { board: '#101012', script: 'Champagne', block: 'BAR', tube: '#ffe08a', blockTube: '#ffffff', icon: 'martini', iconColor: '#ffe08a', balance: false }],
          'BOUTIQUE RIVA': ['deco', { board: '#f3efe6', ink: '#1d3f6e', glow: '#d8e8ff', mode: 'halo', rules: true, ruleColor: '#1d3f6e', track: 0.5, lines: ['BOUTIQUE RIVA'] }],
          'MONARCH ACADEMY': ['carved', { ground: '#1d3a2a', kind: 'enamel', icon: 'shield', icon2: true, iconColor: '#d9ae55', iconColor2: '#1d3a2a', font: 'times', spacing: 0.16, lines: ['MONARCH', 'ACADEMY'], ratio: [0.9, 1], sub: 'FOUNDED MDCCCLXXII' }],
          'POLICE · MONARCH ISLE': ['enamel', { ground: '#0e2244', ink: '#ffffff', rim: '#d4af37', icon: 'badge', icon2: true, iconColor: '#d4af37', iconColor2: '#0e2244', font: 'times', spacing: 0.12, backlit: true, lines: ['POLICE'], sub: 'MONARCH ISLE STATION' }],
          'MONARCH COUNTRY CLUB': ['carved', { ground: '#1f3d2c', kind: 'enamel', icon: 'crown', icon2: true, iconColor: '#e2c67a', font: 'times', ink: '#efe2b8', spacing: 0.14, lines: ['MONARCH', 'COUNTRY CLUB'], ratio: [1, 0.8], sub: 'MEMBERS ONLY' }],
          'MONARCH YACHT CLUB': ['enamel', { ground: '#f4f1e8', ink: '#0e2c57', rim: '#0e2c57', icon: 'helm', icon2: 'anchor', iconColor: '#0e2c57', font: 'times', spacing: 0.2, lines: ['MONARCH', 'YACHT CLUB'], ratio: [1, 0.8] }],
          'ST ALDRIC’S CHAPEL': ['carved', { ground: '#2a2530', kind: 'stone', icon: 'star', iconColor: '#e2c67a', font: 'times', ink: '#efe2b8', lines: ['ST ALDRIC’S'], sub: 'CHAPEL · EVENSONG 6 PM' }],
          'ROYAL BOTANIC GARDEN': ['wood', { plank: '#2f4a2a', ink: '#f1e6c2', routed: true, icon: 'leaf', icon2: true, iconColor: '#a8d07a', font: 'times', lines: ['ROYAL BOTANIC', 'GARDEN'], ratio: [0.9, 1], sub: 'THE PALM HOUSE · OPEN DAILY' }],
          'HARBOUR MASTER': ['enamel', { ground: '#12325a', ink: '#ffffff', rim: '#ffffff', icon: 'ship', iconColor: '#ffffff', font: 'sans', weight: '700', spacing: 0.2, lines: ['HARBOUR MASTER'] }],
          // Shops (the shopfront atlas)
          LAUNDROMAT: ['lightbox', { panel: '#dff3ff', ink: '#1b4f9c', font: 'futura', weight: '800', icon: 'bubbles', iconColor: '#1b8fd0', band: null, stripes: ['#1b4f9c'] }],
          'PAWN & LOAN': ['carved', { ground: '#141414', icon: 'balls', iconColor: '#d9ae55', iconColor2: '#8a6d34', font: 'times' }],
          'BODEGA 24H': ['lightbox', { panel: '#fff7e0', ink: '#d7262e', font: 'black', weight: '900', stripes: ['#ffd23a', '#1f8a4c'], lines: ['BODEGA'], tab: '24H', tabColor: '#1f8a4c' }],
          'VINYL VAULT': ['neonScript', { board: '#15151b', boardKind: 'glass', script: 'Vinyl Vault', tube: '#ffd23f', icon: 'record', iconColor: '#ff4fa0', iconFill: '#0a0a0a', backer: '#2a2a33' }],
          'INK & IRON TATTOO': ['tattoo', {}],
          'CUTS BARBER': ['neonScript', { board: '#f4efe6', boardKind: 'enamel', rim: '#1b3f8a', script: 'Cuts', block: 'BARBER', tube: '#e0283a', blockTube: '#1b5fd0', icon: 'pole', icon2: true, iconFill: '#f4f1ea', iconColor: '#e0283a', backer: '#c9c2b4' }],
          'GOLDEN NOODLE': ['lightbox', { panel: '#b3141d', ink: '#ffd24a', font: 'serif', weight: '900', outline: '#5a0a0e', icon: 'bowl', icon2: true, iconColor: '#ffd24a', iconColor2: '#ffffff', shadow: '#5a0a0e' }],
          LIQUOR: ['neonBlock', { board: '#101012', tube: '#ff3048', accent: '#4ff0ff', border: 'rect', track: 0.45, icon: 'martini', iconColor: '#4ff0ff' }],
          'SLICE PIZZA': ['lightbox', { panel: '#fff6e8', ink: '#b3202a', font: 'black', weight: '900', skew: 0.2, outline: '#ffffff', shadow: '#1f7a3c', icon: 'pizza', iconColor: '#f2b640', iconColor2: '#b3702a', stripes: ['#1f8a4c', '#ffffff', '#c8102e'], stripesTop: true, lines: ['SLICE'] }],
          'CORNER PHARMACY': ['lightbox', { panel: '#ffffff', ink: '#1f7a3c', font: 'sans', weight: '700', icon: 'cross', iconColor: '#1fa04c', lines: ['PHARMACY'], sub: 'CORNER · RX · 24H', subInk: '#1f7a3c' }],
          'BAIL BONDS': ['lightbox', { panel: '#ffd400', ink: '#111111', font: 'impact', weight: '900', condense: 0.85, sub: 'FAST · 24/7 · CALL NOW', lines: ['BAIL BONDS'] }],
          'VIDEO WORLD': ['airbrush', { grad: ['#2a0a5a', '#5a2ad0', '#0a0a2a'], chrome: true, outline: '#ff2ad0', icon: 'tape', iconColor: '#e0e0ff', iconColor2: '#2a0a5a', sun: false, grid: '#ff4ad0' }],
          'CAFÉ MARLOW': ['neonScript', { board: '#2b1a12', boardKind: 'enamel', script: 'Café Marlow', tube: '#ffcf8a', icon: 'cup', iconColor: '#ff9a5a', backer: '#3d2a1e' }],
          'DRY CLEANER': ['lightbox', { panel: '#1b4f9c', ink: '#ffffff', font: 'sans', weight: '800', icon: 'hanger', iconColor: '#ffffff', sub: 'SAME DAY · ALTERATIONS' }],
          HARDWARE: ['painted', { ground: '#b3202a', ink: '#ffffff', icon: 'wrench', iconColor: '#ffffff', font: 'slab', age: 0.6 }],
          'CHECK CASHING': ['lightbox', { panel: '#0f7a3c', ink: '#ffffff', font: 'impact', weight: '900', condense: 0.88, icon: 'star', iconColor: '#ffd23a', sub: 'PAYDAY · MONEY ORDERS', subInk: '#ffd23a' }],
          BAKERY: ['enamel', { ground: '#f6d9e0', ink: '#8a3a52', rim: '#8a3a52', font: 'serif', shape: 'round', icon: 'wheat', icon2: true, iconColor: '#c98a3a', sub: 'FRESH EVERY MORNING' }],
          DELI: ['enamel', { ground: '#f2e8d0', ink: '#1d4f2a', rim: '#b3202a', font: 'slab', weight: '900', spacing: 0.4, sub: 'SUBS · COLD CUTS · BEER' }],
          FLOWERS: ['neonScript', { board: '#e8f0dc', boardKind: 'enamel', rim: '#5a8a4a', script: 'flowers', tube: '#ff5aa5', icon: 'flower', iconColor: '#ffd23f', iconFill: '#ff8ac0', backer: '#c8d2bc' }],
          TAILOR: ['carved', { ground: '#1b2230', icon: 'scissors', iconColor: '#e8dcc0', font: 'palatino', ink: '#e8dcc0', sub: 'BESPOKE · ALTERATIONS' }],
          ARCADE: ['pixel', { ink: '#ff4fd8', accent: '#4ff0ff', icon: 'joystick' }],
          THRIFT: ['hand', { ground: '#f2e6c8', ink: '#2f6b5e' }],
          BOOKS: ['carved', { ground: '#233b2c', kind: 'enamel', icon: 'book', icon2: true, iconColor: '#d9ae55', font: 'palatino' }],
          BOTÁNICA: ['enamel', { ground: '#4a1f5c', ink: '#f2c84a', rim: '#f2c84a', font: 'serif', icon: 'leaf', icon2: 'star', iconColor: '#9fca7a', backlit: true }],
          'SEAFOOD MARKET': ['wood', { plank: '#2f5f7a', ink: '#ffffff', rope: true, icon: 'fish', icon2: true, iconColor: '#ffffff', font: 'slab', lines: ['SEAFOOD', 'MARKET'] }],
          CIGARS: ['carved', { ground: '#3b2415', kind: 'wood', icon: 'cigar', icon2: true, iconColor: '#e8c170', iconColor2: '#b3202a', font: 'palatino', sub: 'HAND ROLLED' }],
          'PAWN SHOP': ['neonBlock', { board: '#101010', tube: '#ffd23f', accent: '#ff3048', icon: 'balls', iconColor: '#ffd23f', lines: ['PAWN'], track: 0.5 }],
          FURNITURE: ['lightbox', { panel: '#f2f2ee', ink: '#333333', font: 'futura', weight: '500', spacing: 0.3, band: '#c99a2e', bandSide: 'bottom' }],
          GYM: ['varsity', { ground: '#111111', fill: '#e02d2d', outline: '#ffffff', icon: 'dumbbell', icon2: true, iconColor: '#ffffff', backlit: true, lines: ['IRON GYM'] }],
          'SHOE REPAIR': ['painted', { ground: '#2c3e50', ink: '#f0e0b0', font: 'serif', age: 0.8, sub: 'KEYS CUT · WHILE-U-WAIT' }],
          'PHOTO 1HR': ['lightbox', { panel: '#ffd200', ink: '#d7262e', font: 'black', weight: '900', icon: 'camera', iconColor: '#d7262e', iconColor2: '#ffffff', lines: ['PHOTO'], tab: '1 HOUR', tabColor: '#d7262e', tabInk: '#ffd200' }],
        };
        /**
         * The design for a name: the table, then trade keywords (a county lodge, an
         * outfitter, a motel...), then the caller's hint, then painted enamel in the
         * sign's own colour.
         */
        function designFor(text, color, hint) {
          if (SIGN_DESIGNS[text]) return SIGN_DESIGNS[text];
          const t = text.toUpperCase();
          if (hint === 'transit' || /^M · /.test(t)) return ['enamel', { ground: '#12325a', ink: '#ffffff', icon: 'm', iconColor: '#d7262e', iconColor2: '#ffffff', font: 'sans', weight: '700', spacing: 0.08, backlit: true, lines: [t.replace(/^M · /, '')] }];
          if (hint === 'kiosk') return ['hand', { ground: color, ink: '#1a3a5a', font: 'black', icon: 'sun', iconColor: '#ff7a1a' }];
          if (hint === 'truck') return ['hand', { ground: '#fff4d6', ink: '#b3202a', icon: t === 'TACOS' ? 'taco' : t === 'COFFEE' ? 'cup' : 'bowl', iconColor: '#b3202a' }];
          if (hint === 'trail' || /TRAIL$/.test(t)) return ['wood', { plank: '#5b3b1f', ink: '#f2e3b3', routed: true, icon: 'mountain', iconColor: '#f2e3b3', iconColor2: '#5b3b1f', font: 'times', sub: 'COUNTY PARKS' }];
          if (hint === 'town') return ['enamel', { ground: '#f4efe0', ink: '#1f4a3a', rim: '#1f4a3a', font: 'times', subAbove: 'WELCOME TO', sub: 'DRIVE CAREFULLY', icon: 'tree', icon2: true, iconColor: '#2f6b4a' }];
          if (hint === 'resort') return ['enamel', { ground: '#f6d6d0', ink: '#1f5f63', rim: '#1f5f63', font: 'times', subAbove: 'WELCOME TO', icon: 'palm', icon2: true, iconColor: '#1f5f63', shape: 'round' }];
          if (/LODGE$/.test(t)) return ['wood', { plank: '#5a3a22', ink: '#f3d9a4', routed: true, icon: 'tree', icon2: true, iconColor: '#9fca7a', iconColor2: '#3a2616', font: 'times', sub: 'ROOMS · CABINS' }];
          if (/OUTFITTERS$/.test(t)) return ['enamel', { ground: '#cdbb8a', kind: 'matte', ink: '#1f4a2c', rim: '#1f4a2c', font: 'slab', weight: '900', icon: 'mountain', iconColor: '#1f4a2c', iconColor2: '#f2ecd8' }];
          if (/ARMORY|GUNS|SURPLUS/.test(t)) return ['stencil', { ground: '#4b5320', ink: '#ece5c8', icon: 'target', iconColor: '#ece5c8', iconColor2: '#b3202a', rivets: true, rust: 0.5 }];
          if (/MOTEL/.test(t)) return ['neonScript', { board: '#1f6f8a', script: t.replace(/ ?MOTEL/, '').toLowerCase() || 'motel', block: 'MOTEL', tube: '#ff8a3d', blockTube: '#ff3b5c', flicker: true }];
          if (/INN$|HOTEL/.test(t)) return ['enamel', { ground: '#0f3550', ink: '#f4e7c5', rim: '#f4e7c5', font: 'times', shape: 'round', icon: 'star', iconColor: '#f4e7c5' }];
          if (/DINER|GRILL/.test(t)) return ['diner', { panel: '#b3202a', script: t.replace(/ ?(DINER|GRILL).*/, '').toLowerCase(), block: 'DINER', tube: '#8fd8ff' }];
          if (/GARAGE|MOTOR|AUTO|CUSTOMS|MECHANIC/.test(t)) return ['painted', { ground: color ? SignKit.shade(color, 0.55) : '#39463a', ink: '#f0e6c8', icon: 'wrench', iconColor: '#f0e6c8', font: 'slab' }];
          if (/HOSPITAL|MEDICAL|CLINIC/.test(t)) return ['lightbox', { panel: '#f4f6f5', ink: '#123a6b', band: '#123a6b', icon: 'cross', iconColor: '#d42a2a', iconBox: '#ffffff' }];
          if (/BANK|TRUST|CAPITAL|EXCHANGE/.test(t)) return ['carved', { ground: '#10202e', font: 'times' }];
          if (/CLUB|LOUNGE|BAR$/.test(t)) return ['neonScript', { script: t.toLowerCase(), tube: color || '#ff4fb8' }];
          if (/FREIGHT|CARGO|DEPOT|WAREHOUSE/.test(t)) return ['stencil', { ground: '#5a6a72', kind: 'steel', ink: '#f2f2ea', rust: 0.8 }];
          if (/STATION|TERMINAL|AIRPORT/.test(t)) return ['lightbox', { panel: '#1e2327', ink: '#ffffff', icon: 'plane', iconColor: '#ffd200' }];
          // Painted enamel in the caller's colour.
          const ground = SignKit.mix(color || '#bcd4cf', '#10181c', 0.82);
          return ['enamel', { ground, ink: color || '#f2e6c8', rim: SignKit.mix(color || '#f2e6c8', ground, 0.35), font: 'sans', weight: '700', spacing: 0.1, backlit: true }];
        }
        /**
         * Paints `text` into (dg, gg), a w x h box. `opaque` fills a fascia behind
         * shaped boards first (atlas cells cannot be cut out). Returns the spec.
         */
        function paint(dg, gg, w, h, text, color, hint, opaque = false) {
          const [family, P] = designFor(text, color, hint);
          if (opaque) {
            dg.fillStyle = '#23272b';
            dg.fillRect(0, 0, w, h);
          }
          for (const g of [dg, gg]) {
            g.textAlign = 'center';
            g.textBaseline = 'middle';
          }
          return Object.assign(FAMILIES[family](dg, gg, w, h, text, P), { family });
        }
        // ---- Rooftop hotel names (Ocean Drive and the Keys) ------------------------------
        // Cut-out letters on a roof frame, each hotel in its own manner.
        const HOTEL_DESIGNS = {
          'THE FLAMINGO': ['script', { script: 'Flamingo', tube: '#ff6fae', swash: '#6fefff' }],
          SEABREEZE: ['decoNeon', { glow: '#6fefff', ink: '#f2f2ea' }],
          'CASA MARINA': ['script', { script: 'Casa Marina', tube: '#ffe066' }],
          'THE CARLYLE': ['decoNeon', { glow: '#8fb8ff', ink: '#ffffff' }],
          'BEACON HOTEL': ['bulbs', { body: '#d64a3a', bulb: '#fff0c0' }],
          AVALON: ['double', { tube: '#a6ff8a' }],
          'TIDES INN': ['script', { script: 'Tides Inn', tube: '#4ff0e0', swash: '#ff9a5c' }],
          'LA PLAYA': ['script', { script: 'La Playa', tube: '#ff9a5c', swash: '#ffe066' }],
          STARLITE: ['script', { script: 'Starlite', tube: '#6fefff', stars: '#ffe066' }],
          'PALM COURT': ['decoNeon', { glow: '#ff6fae', ink: '#f6e6d6' }],
          'EL DORADO': ['bulbs', { body: '#c89a3a', bulb: '#fff4c8' }],
          BREAKWATER: ['double', { tube: '#58a6ff' }],
        };
        function paintHotel(dg, gg, w, h, name, color) {
          const [kind, P] = HOTEL_DESIGNS[name] || ['script', { script: name.toLowerCase(), tube: color }];
          if (kind === 'script') return FAMILIES.neonScript(dg, gg, w, h, name, { ...P, balance: false });
          const u = h / 100,
            run = K.strokeText(name, { cx: w / 2, cy: h / 2, maxW: w - 16 * u, maxH: h * 0.72, track: kind === 'decoNeon' ? 0.45 : 0.28 });
          dg.lineJoin = dg.lineCap = 'round';
          if (kind === 'decoNeon') {
            const thick = run.size * 0.18,
              thin = Math.max(1, run.size * 0.04);
            dg.save();
            dg.translate(1.5 * u, 2 * u);
            K.decoLetters(dg, run.lines, thin + 2.5 * u, thick + 2.5 * u, '#26292d');
            dg.restore();
            K.decoLetters(dg, run.lines, thin, thick, P.ink);
            K.tubes(dg, gg, run.lines, Math.max(1.5, run.size * 0.05), P.glow, { bare: true, electrodes: false, glass: K.tint(P.glow, 0.5) });
            return spec({ cutout: true, light: P.glow });
          }
          if (kind === 'bulbs') {
            K.bulbLetters(dg, gg, run.lines, run.size, { bodyColor: P.body, bulb: P.bulb, body: 0.26, step: 0.2, r: 0.06 });
            return spec({ cutout: true, light: P.bulb });
          }
          dg.strokeStyle = '#26292d';
          dg.lineWidth = run.size * 0.3;
          K.tracePath(dg, run.lines);
          dg.stroke();
          K.doubleTubes(dg, gg, run.lines, Math.max(1.5, run.size * 0.06), P.tube, '#26292d');
          return spec({ cutout: true, light: P.tube });
        }
        // ---- Tower names (the financial cluster) ------------------------------------------
        // Banks and exchanges in incised Roman capitals with a gilt halo; the Deco
        // towers in contrast capitals; the new glass towers in thin, wide LED letters.
        function paintTowerName(dg, gg, w, h, name) {
          const u = h / 100,
            bank = /CAPITAL|TRUST|CROWN|EXCHANGE|ROTUNDA/.test(name),
            deco = /FEDERATION|EMBANKMENT|IMPERIAL/.test(name);
          if (bank) {
            for (const g of [dg, gg]) g.letterSpacing = '0px';
            K.fxText(dg, name, w / 2, h / 2 + 2 * u, { font: 'times', weight: '700', size: h * 0.78, maxW: w - 16 * u, spacing: 0.22, fill: K.gold, shadow: [1.5 * u, 3 * u, 'rgba(0,0,0,0.75)', 0] });
            gg.save();
            gg.shadowColor = '#ffcf7a';
            gg.shadowBlur = h * 0.3;
            K.fxText(gg, name, w / 2, h / 2 + 2 * u, { font: 'times', weight: '700', size: h * 0.78, maxW: w - 16 * u, spacing: 0.22, fill: 'rgba(255,214,140,0.85)' });
            gg.restore();
            return;
          }
          const run = K.strokeText(name, { cx: w / 2, cy: h / 2, maxW: w - 16 * u, maxH: h * 0.66, track: deco ? 0.5 : 0.62 });
          if (deco) {
            K.decoLetters(dg, run.lines, Math.max(1, run.size * 0.05), run.size * 0.2, '#efe2c4');
            gg.save();
            gg.shadowColor = '#ffe2a8';
            gg.shadowBlur = h * 0.2;
            K.decoLetters(gg, run.lines, Math.max(1, run.size * 0.05), run.size * 0.2, '#ffe9c0');
            gg.restore();
          } else {
            K.blockLetters(dg, run.lines, Math.max(2, run.size * 0.12), { fill: '#e9f3ff', cap: 'round' });
            gg.save();
            gg.shadowColor = '#8fd0ff';
            gg.shadowBlur = h * 0.18;
            K.blockLetters(gg, run.lines, Math.max(2, run.size * 0.12), { fill: '#e8f6ff', cap: 'round' });
            gg.restore();
          }
        }
        // ---- Billboards ------------------------------------------------------------------
        /**
         * Each advertiser has its own layout and illustration: a soft-drink ribbon, a
         * radio dial, a casino's cards, a motel sunset, a punk-radio ransom note, an
         * airline's sky... [title, strap, painter]; the painter gets (g, w, h).
         */
        const T = (g, text, x, y, o) => K.fxText(g, text, x, y, o),
          sky = (g, w, h, stops) => {
            const f = g.createLinearGradient(0, 0, 0, h);
            stops.forEach((c, i) => f.addColorStop(i / (stops.length - 1), c));
            g.fillStyle = f;
            g.fillRect(0, 0, w, h);
          };
        const ADS = [
          [
            'DRINK KOLA',
            (g, w, h) => {
              sky(g, w, h, ['#e3342a', '#b71c1c']);
              g.fillStyle = '#ffffff';
              g.beginPath();
              g.moveTo(0, h * 0.78);
              g.bezierCurveTo(w * 0.3, h * 0.45, w * 0.6, h * 1.05, w, h * 0.62);
              g.lineTo(w, h * 0.74);
              g.bezierCurveTo(w * 0.6, h * 1.15, w * 0.3, h * 0.56, 0, h * 0.9);
              g.fill();
              // The bottle: a contour silhouette with a label band.
              g.fillStyle = '#3a1208';
              g.beginPath();
              const bx = w * 0.83;
              g.moveTo(bx - 9, h * 0.08);
              g.lineTo(bx + 9, h * 0.08);
              g.bezierCurveTo(bx + 10, h * 0.3, bx + 26, h * 0.35, bx + 24, h * 0.55);
              g.bezierCurveTo(bx + 20, h * 0.7, bx + 28, h * 0.8, bx + 24, h * 0.95);
              g.lineTo(bx - 24, h * 0.95);
              g.bezierCurveTo(bx - 28, h * 0.8, bx - 20, h * 0.7, bx - 24, h * 0.55);
              g.bezierCurveTo(bx - 26, h * 0.35, bx - 10, h * 0.3, bx - 9, h * 0.08);
              g.fill();
              g.fillStyle = '#ffffff';
              g.fillRect(bx - 24, h * 0.56, 48, h * 0.14);
              const run = K.strokeText('Kola', { lower: true, slant: 0.3, cx: w * 0.4, cy: h * 0.36, maxW: w * 0.5, maxH: h * 0.62 });
              K.blockLetters(g, run.lines, run.size * 0.16, { fill: '#ffffff', cap: 'round', outline: [3, '#8a0f0f'] });
              T(g, 'ICE COLD · SINCE 1921', w * 0.36, h * 0.93, { font: 'sans', weight: '800', size: 16, maxW: w * 0.5, spacing: 0.2, fill: '#ffffff' });
            },
          ],
          [
            'NEON 88.7',
            (g, w, h) => {
              sky(g, w, h, ['#0f1d3c', '#1c2f5a']);
              g.strokeStyle = 'rgba(143,240,255,0.5)';
              g.lineWidth = 2;
              for (let x = 20; x < w - 20; x += 12) {
                g.beginPath();
                g.moveTo(x, h - 22);
                g.lineTo(x, h - (x % 60 === 20 ? 40 : 30));
                g.stroke();
              }
              g.fillStyle = '#ff3b5c';
              g.fillRect(w * 0.62, h - 50, 4, 36);
              const run = K.strokeText('88.7', { cx: w * 0.62, cy: h * 0.4, maxW: w * 0.5, maxH: h * 0.5 });
              K.tubes(g, g, run.lines, run.size * 0.1, '#8ff0ff', { electrodes: false });
              T(g, 'NEON', w * 0.16, h * 0.34, { font: 'futura', weight: '800', size: 44, maxW: w * 0.26, spacing: 0.1, fill: '#ff6fd0' });
              T(g, 'FM', w * 0.16, h * 0.62, { font: 'futura', weight: '800', size: 26, maxW: w * 0.2, spacing: 0.5, fill: '#8ff0ff' });
              T(g, 'THE SOUND OF THE COAST', w / 2, h - 10, { font: 'sans', weight: '700', size: 12, maxW: w * 0.8, spacing: 0.5, fill: '#c9f5ff' });
            },
          ],
          [
            'GOLDEN TIDE CASINO',
            (g, w, h) => {
              sky(g, w, h, ['#1a0e08', '#2c1d12']);
              for (const [x, r, card] of [
                [w * 0.12, -0.25, 'A'],
                [w * 0.17, 0.05, 'K'],
              ]) {
                g.save();
                g.translate(x, h * 0.52);
                g.rotate(r);
                g.fillStyle = '#f6efe0';
                g.beginPath();
                g.roundRect(-30, -44, 60, 88, 6);
                g.fill();
                T(g, card, -14, -26, { font: 'times', weight: '700', size: 22, fill: '#b3202a' });
                K.icon(g, 'heart', 0, 8, 34, '#b3202a');
                g.restore();
              }
              K.icon(g, 'dice', w * 0.9, h * 0.52, 70, '#f6efe0', '#1a0e08');
              T(g, 'GOLDEN TIDE', w * 0.54, h * 0.4, { font: 'times', weight: '700', size: 54, maxW: w * 0.58, spacing: 0.08, fill: K.gold, shadow: [2, 3, '#000', 0] });
              T(g, 'C A S I N O  ·  F O R T U N E   F A V O R S   T H E   B O L D', w * 0.54, h * 0.72, { font: 'times', weight: '700', size: 14, maxW: w * 0.6, fill: '#e8c070' });
              K.bulbDots(g, g, K.resample([[[6, 6], [w - 6, 6], [w - 6, h - 6], [6, h - 6], [6, 6]]], 16), 3.2, '#ffe9b0');
            },
          ],
          [
            'SUNSET MOTEL',
            (g, w, h) => {
              sky(g, w, h, ['#3a1a5a', '#ff5a7a', '#ffb347']);
              g.fillStyle = '#ffd86a';
              g.beginPath();
              g.arc(w * 0.72, h * 0.78, 60, Math.PI, 0);
              g.fill();
              g.fillStyle = '#1f5f63';
              g.fillRect(0, h * 0.78, w, h * 0.22);
              for (let k = 0; k < 4; k++) {
                g.fillStyle = '#ff9a6a';
                g.fillRect(w * 0.55, h * (0.82 + k * 0.045), w * 0.34, 2);
              }
              K.icon(g, 'palm', w * 0.93, h * 0.55, 110, '#1a1030', '#1a1030');
              const run = K.strokeText('Sunset Motel', { lower: true, slant: 0.24, cx: w * 0.38, cy: h * 0.38, maxW: w * 0.62, maxH: h * 0.44 });
              K.blockLetters(g, run.lines, run.size * 0.12, { fill: '#fff4e0', cap: 'round', outline: [3, '#8a1a4a'] });
              T(g, 'VACANCY · HBO · POOL', w * 0.34, h * 0.88, { font: 'futura', weight: '800', size: 17, maxW: w * 0.5, spacing: 0.25, fill: '#fff4e0' });
            },
          ],
          [
            'RIOT 104.5',
            (g, w, h) => {
              sky(g, w, h, ['#141417', '#141417']);
              const rnd = K.seeded('riot');
              // Torn-paper ransom lettering, a splatter and a zigzag.
              for (let k = 0; k < 14; k++) {
                g.fillStyle = rnd() < 0.5 ? 'rgba(255,111,78,0.25)' : 'rgba(255,230,60,0.2)';
                g.beginPath();
                g.arc(w * (0.6 + rnd() * 0.4), h * rnd(), 4 + rnd() * 16, 0, Math.PI * 2);
                g.fill();
              }
              let x = 26;
              for (const [ch, bg, fg, font] of [
                ['R', '#ff6f4e', '#141417', 'impact'],
                ['I', '#f2f2ea', '#141417', 'times'],
                ['O', '#ffe63c', '#141417', 'black'],
                ['T', '#ff6f4e', '#f2f2ea', 'mono'],
              ]) {
                const r = (rnd() - 0.5) * 0.3;
                g.save();
                g.translate(x + 30, h * 0.42);
                g.rotate(r);
                g.fillStyle = bg;
                g.fillRect(-28, -38, 56, 76);
                T(g, ch, 0, 2, { font, weight: '900', size: 64, fill: fg });
                g.restore();
                x += 66;
              }
              T(g, '104.5', w * 0.78, h * 0.4, { font: 'impact', weight: '900', size: 70, maxW: w * 0.36, skew: 0.15, fill: '#ffe63c', outline: [3, '#141417'] });
              T(g, 'LOUD. ALL NIGHT.', w * 0.3, h * 0.87, { font: 'mono', weight: '700', size: 22, maxW: w * 0.5, spacing: 0.2, fill: '#f2f2ea' });
            },
          ],
          [
            'SOUTHPORT AIR',
            (g, w, h) => {
              sky(g, w, h, ['#6fb8e8', '#dff0fa']);
              g.fillStyle = 'rgba(255,255,255,0.85)';
              for (const [x, y, s] of [
                [0.2, 0.75, 1],
                [0.7, 0.25, 0.7],
                [0.9, 0.8, 0.8],
              ]) {
                for (const [dx, dy, r] of [
                  [-24, 4, 18],
                  [0, -6, 24],
                  [26, 4, 17],
                ]) {
                  g.beginPath();
                  g.arc(w * x + dx * s, h * y + dy * s, r * s, 0, Math.PI * 2);
                  g.fill();
                }
              }
              K.icon(g, 'plane', w * 0.8, h * 0.48, 120, '#1f3c52');
              for (const [c, y] of [
                ['#c8102e', 0.9],
                ['#1f3c52', 0.95],
              ]) {
                g.fillStyle = c;
                g.fillRect(0, h * y, w, h * 0.05);
              }
              T(g, 'SOUTHPORT AIR', w * 0.34, h * 0.38, { font: 'futura', weight: '800', size: 48, maxW: w * 0.6, spacing: 0.06, skew: 0.12, fill: '#1f3c52' });
              T(g, 'FLY THE KEYS DAILY  ·  FROM $49', w * 0.34, h * 0.66, { font: 'sans', weight: '700', size: 18, maxW: w * 0.6, spacing: 0.1, fill: '#c8102e' });
            },
          ],
          [
            'PALM KEYS AUTO',
            (g, w, h) => {
              sky(g, w, h, ['#ff7ac0', '#ff9a5a', '#27c6c0']);
              g.strokeStyle = 'rgba(255,255,255,0.7)';
              g.lineWidth = 3;
              for (let k = 0; k < 5; k++) {
                g.beginPath();
                g.moveTo(w * 0.52, h * (0.52 + k * 0.06));
                g.lineTo(w * 0.62 - k * 10, h * (0.52 + k * 0.06));
                g.stroke();
              }
              K.icon(g, 'car', w * 0.8, h * 0.6, 150, '#1b2a4a', '#f6efe0');
              T(g, 'PALM KEYS AUTO', w * 0.3, h * 0.36, { font: 'black', weight: '900', size: 40, maxW: w * 0.54, skew: 0.25, fill: '#ffffff', outline: [2.5, '#2c1e2a'], extrude: [3, 4, '#2c1e2a'] });
              T(g, 'MECHANICS · RESPRAYS WHILE YOU WAIT', w * 0.3, h * 0.7, { font: 'sans', weight: '800', size: 17, maxW: w * 0.5, skew: 0.2, spacing: 0.1, fill: '#2c1e2a' });
            },
          ],
          [
            'MARLOW BAY FERRIES',
            (g, w, h) => {
              sky(g, w, h, ['#22415a', '#16283a']);
              g.fillStyle = '#e6e0c8';
              g.fillRect(12, 12, w - 24, 3);
              g.fillRect(12, h - 15, w - 24, 3);
              K.icon(g, 'ship', w * 0.8, h * 0.52, 130, '#e6e0c8', '#c8102e');
              g.strokeStyle = 'rgba(230,224,200,0.6)';
              g.lineWidth = 2;
              for (let k = 0; k < 3; k++) {
                g.beginPath();
                for (let x = w * 0.62; x < w - 16; x += 6) g.lineTo(x, h * (0.72 + k * 0.06) + Math.sin(x * 0.12 + k) * 3);
                g.stroke();
              }
              T(g, 'MARLOW BAY', w * 0.34, h * 0.36, { font: 'times', weight: '700', size: 44, maxW: w * 0.56, spacing: 0.12, fill: '#e6e0c8' });
              T(g, 'FERRIES  ·  NO LAST FERRY TONIGHT', w * 0.34, h * 0.66, { font: 'times', weight: '700', size: 16, maxW: w * 0.56, spacing: 0.2, fill: '#c9b98a' });
            },
          ],
          [
            'VOLTA MOBILE',
            (g, w, h) => {
              sky(g, w, h, ['#05080f', '#101a2c']);
              g.strokeStyle = 'rgba(125,247,201,0.18)';
              g.lineWidth = 1;
              for (let x = 0; x < w; x += 16) {
                g.beginPath();
                g.moveTo(x, 0);
                g.lineTo(x, h);
                g.stroke();
              }
              for (let y = 0; y < h; y += 16) {
                g.beginPath();
                g.moveTo(0, y);
                g.lineTo(w, y);
                g.stroke();
              }
              // A brick phone with its aerial and green LCD.
              g.fillStyle = '#2a2f36';
              g.beginPath();
              g.roundRect(w * 0.82, h * 0.2, 44, 116, 8);
              g.fill();
              g.fillRect(w * 0.82 + 30, h * 0.04, 6, 30);
              g.fillStyle = '#7df7c9';
              g.fillRect(w * 0.82 + 7, h * 0.28, 30, 22);
              g.fillStyle = '#6a7380';
              for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) g.fillRect(w * 0.82 + 7 + c * 11, h * 0.52 + r * 10, 8, 6);
              T(g, 'VOLTA', w * 0.36, h * 0.38, { font: 'futura', weight: '300', size: 58, maxW: w * 0.6, spacing: 0.5, fill: '#7df7c9' });
              T(g, 'MOBILE · THE CITY IN YOUR POCKET', w * 0.36, h * 0.72, { font: 'sans', weight: '600', size: 15, maxW: w * 0.6, spacing: 0.25, fill: '#dff' });
            },
          ],
          [
            'NORTH POINT BANK',
            (g, w, h) => {
              sky(g, w, h, ['#f2ecdc', '#e6dcc4']);
              g.fillStyle = '#0f2238';
              g.fillRect(0, 0, w * 0.3, h);
              g.fillStyle = '#c9a24e';
              g.fillRect(w * 0.3, 0, 4, h);
              g.fillStyle = '#d8e6f5';
              g.beginPath();
              g.moveTo(w * 0.15 - 22, h * 0.9);
              g.lineTo(w * 0.15 - 16, h * 0.28);
              g.lineTo(w * 0.15, h * 0.1);
              g.lineTo(w * 0.15 + 16, h * 0.28);
              g.lineTo(w * 0.15 + 22, h * 0.9);
              g.fill();
              T(g, 'NORTH POINT', w * 0.65, h * 0.34, { font: 'times', weight: '700', size: 42, maxW: w * 0.6, spacing: 0.14, fill: '#0f2238' });
              T(g, 'B A N K', w * 0.65, h * 0.58, { font: 'times', weight: '400', size: 22, maxW: w * 0.4, fill: '#8a6d34' });
              T(g, 'YOUR MONEY. OUR TOWER.  ·  MEMBER FDIC', w * 0.65, h * 0.84, { font: 'sans', weight: '600', size: 11, maxW: w * 0.6, spacing: 0.2, fill: '#0f2238' });
            },
          ],
          [
            'CAFÉ MARLOW',
            (g, w, h) => {
              sky(g, w, h, ['#c49a6a', '#a57a4a']);
              K.icon(g, 'cup', w * 0.18, h * 0.55, 120, '#f6efe0', '#3b2417');
              const run = K.strokeText('Café Marlow', { lower: true, slant: 0.22, cx: w * 0.6, cy: h * 0.4, maxW: w * 0.6, maxH: h * 0.5 });
              K.blockLetters(g, run.lines, run.size * 0.1, { fill: '#3b2417', cap: 'round' });
              T(g, 'ESPRESSO · CUBANO · OPEN LATE', w * 0.6, h * 0.82, { font: 'mono', weight: '700', size: 15, maxW: w * 0.6, spacing: 0.1, fill: '#fff4e0' });
            },
          ],
          [
            'AFTERHOURS',
            (g, w, h) => {
              sky(g, w, h, ['#1d0f2e', '#07030c']);
              for (let k = 0; k < 40; k++) {
                g.fillStyle = 'rgba(255,255,255,' + (0.2 + (k % 5) * 0.12) + ')';
                g.fillRect((k * 97) % w, (k * 53) % (h * 0.6), 2, 2);
              }
              K.icon(g, 'moon', w * 0.88, h * 0.4, 70, '#3ff0ff');
              const run = K.strokeText('after hours', { lower: true, slant: 0.24, cx: w * 0.44, cy: h * 0.4, maxW: w * 0.7, maxH: h * 0.5 });
              K.tubes(g, g, run.lines, run.size * 0.1, '#ff4fb8', { electrodes: false });
              T(g, 'FRI · SAT · TILL DAWN  ·  DJ LAZLO', w * 0.44, h * 0.84, { font: 'futura', weight: '700', size: 15, maxW: w * 0.7, spacing: 0.3, fill: '#c9b0ff' });
            },
          ],
          [
            'THE BLUE PLATE DINER',
            (g, w, h) => {
              sky(g, w, h, ['#f4efe2', '#f4efe2']);
              for (let x = 0, k = 0; x < w; x += 16, k++) {
                g.fillStyle = k % 2 ? '#b3202a' : '#f4efe2';
                g.fillRect(x, h - 18, 16, 9);
                g.fillStyle = k % 2 ? '#f4efe2' : '#b3202a';
                g.fillRect(x, h - 9, 16, 9);
              }
              g.fillStyle = '#1d4f8a';
              g.beginPath();
              g.ellipse(w * 0.16, h * 0.46, 56, 56, 0, 0, Math.PI * 2);
              g.fill();
              g.fillStyle = '#f4efe2';
              g.beginPath();
              g.ellipse(w * 0.16, h * 0.46, 40, 40, 0, 0, Math.PI * 2);
              g.fill();
              K.icon(g, 'cup', w * 0.16, h * 0.46, 46, '#b3202a', '#b3202a');
              const run = K.strokeText('Blue Plate', { lower: true, slant: 0.24, cx: w * 0.6, cy: h * 0.32, maxW: w * 0.56, maxH: h * 0.4 });
              K.blockLetters(g, run.lines, run.size * 0.13, { fill: '#1d4f8a', cap: 'round' });
              T(g, 'PIE · COFFEE · OPEN 24/7', w * 0.6, h * 0.7, { font: 'black', weight: '900', size: 20, maxW: w * 0.56, spacing: 0.12, fill: '#b3202a' });
            },
          ],
          [
            'THE RUSTY ANCHOR',
            (g, w, h) => {
              g.beginPath();
              g.rect(0, 0, w, h);
              K.fillBoard(g, 'wood', 0, 0, w, h, '#6b4a2e', 'rusty-ad');
              K.icon(g, 'anchor', w * 0.12, h * 0.5, 110, '#f0e2c0');
              K.icon(g, 'mug', w * 0.88, h * 0.52, 90, '#e8b04a', '#ffffff');
              T(g, 'THE RUSTY ANCHOR', w * 0.5, h * 0.36, { font: 'times', weight: '700', size: 38, maxW: w * 0.64, spacing: 0.08, fill: '#f0e2c0', shadow: [2, 3, '#000', 0] });
              T(g, 'HAPPY HOUR 4–7  ·  LIVE DARTS', w * 0.5, h * 0.7, { font: 'times', weight: '700', size: 18, maxW: w * 0.6, spacing: 0.1, fill: '#e8b04a' });
            },
          ],
          [
            'ROYAL CINEMA',
            (g, w, h) => {
              sky(g, w, h, ['#101010', '#101010']);
              g.fillStyle = '#2a2a2a';
              for (const y of [4, h - 20]) for (let x = 6; x < w; x += 22) g.fillRect(x, y + 4, 12, 9);
              g.fillStyle = '#8e0f1f';
              g.fillRect(0, 24, w, h - 48);
              K.icon(g, 'reel', w * 0.12, h * 0.5, 80, '#d8a948', '#8e0f1f');
              T(g, 'NOW SHOWING', w * 0.56, h * 0.32, { font: 'sans', weight: '800', size: 14, maxW: w * 0.5, spacing: 0.6, fill: '#f7f3e6' });
              T(g, 'DEAD END', w * 0.56, h * 0.55, { font: 'impact', weight: '900', size: 48, maxW: w * 0.6, spacing: 0.08, fill: '#ffd24a', shadow: [3, 3, '#000', 0] });
              T(g, 'ROYAL CINEMA · 7PM & 9:30', w * 0.56, h * 0.76, { font: 'sans', weight: '700', size: 13, maxW: w * 0.6, spacing: 0.2, fill: '#f7f3e6' });
            },
          ],
          [
            'MARLINS',
            (g, w, h) => {
              sky(g, w, h, ['#10213f', '#0a1428']);
              g.fillStyle = '#ff7a1a';
              g.beginPath();
              g.moveTo(w * 0.62, 0);
              g.lineTo(w, 0);
              g.lineTo(w, h);
              g.lineTo(w * 0.5, h);
              g.fill();
              K.icon(g, 'fish', w * 0.82, h * 0.46, 120, '#10213f', '#ffffff');
              const run = K.strokeText('MARLINS', { cx: w * 0.3, cy: h * 0.38, maxW: w * 0.46, maxH: h * 0.36, slant: 0.18 });
              K.blockLetters(g, run.lines, run.size * 0.22, { fill: '#ffffff', outline: [2.5, '#ff7a1a'], extrude: [3, 4, '#000'], cap: 'square' });
              T(g, 'SEASON TICKETS ON SALE', w * 0.3, h * 0.78, { font: 'black', weight: '900', size: 16, maxW: w * 0.46, spacing: 0.1, fill: '#ff7a1a' });
            },
          ],
        ];
        return { paint, designFor, paintHotel, paintTowerName, ADS, SIGN_DESIGNS };
