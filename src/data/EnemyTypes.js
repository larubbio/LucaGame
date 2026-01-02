/**
 * EnemyTypes - Data-driven enemy configuration
 *
 * Each enemy type defines:
 * - name: Display name
 * - hp: Hit points
 * - damage: Damage per attack
 * - range: Attack range in hexes (1 = melee, >1 = ranged)
 * - ap: Action points per turn
 * - maxAttacksPerTurn: Maximum attacks allowed per turn
 * - aiType: 'melee' (chase player) or 'ranged' (maintain distance)
 * - preferredDistance: For ranged AI, ideal distance from player
 * - colors: Visual appearance colors
 * - special: Array of special properties (for future use)
 */

const ENEMY_TYPES = {
    // Melee enemies - higher HP, chase player
    scrapper: {
        name: 'Scrapper',
        hp: 7,
        damage: 2,
        range: 1,
        ap: 3,
        maxAttacksPerTurn: 2,
        aiType: 'melee',
        preferredDistance: 1,
        colors: {
            body: 0xaa5555,      // Red-brown body
            head: 0xcc7777,      // Lighter red head
            visor: 0xff0000,     // Red visor
            legs: 0x884444,      // Dark red legs
            accent: 0xcc4444     // Red accent
        },
        special: []
    },

    brawler: {
        name: 'Brawler',
        hp: 6,
        damage: 2,
        range: 1,
        ap: 3,
        maxAttacksPerTurn: 2,
        aiType: 'melee',
        preferredDistance: 1,
        colors: {
            body: 0x8855aa,      // Purple body
            head: 0xaa77cc,      // Lighter purple head
            visor: 0xff00ff,     // Magenta visor
            legs: 0x664488,      // Dark purple legs
            accent: 0x9944aa     // Purple accent
        },
        special: []
    },

    // Ranged enemies - lower HP, maintain distance
    turret: {
        name: 'Turret',
        hp: 5,
        damage: 1,
        range: 3,
        ap: 3,
        maxAttacksPerTurn: 2,
        aiType: 'ranged',
        preferredDistance: 3,
        colors: {
            body: 0x55aa55,      // Green body
            head: 0x77cc77,      // Lighter green head
            visor: 0x00ff00,     // Green visor
            legs: 0x448844,      // Dark green legs
            accent: 0x44aa44     // Green accent
        },
        special: []
    },

    sniper: {
        name: 'Sniper',
        hp: 5,
        damage: 1,
        range: 3,
        ap: 3,
        maxAttacksPerTurn: 2,
        aiType: 'ranged',
        preferredDistance: 3,
        colors: {
            body: 0x5555aa,      // Blue body
            head: 0x7777cc,      // Lighter blue head
            visor: 0x00ffff,     // Cyan visor
            legs: 0x444488,      // Dark blue legs
            accent: 0x4444aa     // Blue accent
        },
        special: []
    }
};

/**
 * Get a random enemy type key
 * @param {string} [category] - Optional: 'melee' or 'ranged' to filter
 * @returns {string} Enemy type key
 */
function getRandomEnemyType(category = null) {
    let types = Object.keys(ENEMY_TYPES);

    if (category) {
        types = types.filter(key => ENEMY_TYPES[key].aiType === category);
    }

    return types[Math.floor(Math.random() * types.length)];
}

/**
 * Get enemy data by type key
 * @param {string} typeKey - Enemy type key (e.g., 'scrapper', 'turret')
 * @returns {object} Enemy type data
 */
function getEnemyData(typeKey) {
    return ENEMY_TYPES[typeKey];
}

/**
 * Create a spawn configuration for a battle
 * @param {number} count - Number of enemies to spawn
 * @param {object} [options] - Optional spawn options
 * @returns {Array} Array of enemy type keys
 */
function generateEnemySpawnList(count, options = {}) {
    const spawnList = [];
    const { minMelee = 1, minRanged = 1 } = options;

    // Ensure minimum melee
    for (let i = 0; i < minMelee && spawnList.length < count; i++) {
        spawnList.push(getRandomEnemyType('melee'));
    }

    // Ensure minimum ranged
    for (let i = 0; i < minRanged && spawnList.length < count; i++) {
        spawnList.push(getRandomEnemyType('ranged'));
    }

    // Fill remaining with random
    while (spawnList.length < count) {
        spawnList.push(getRandomEnemyType());
    }

    // Shuffle the list
    for (let i = spawnList.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [spawnList[i], spawnList[j]] = [spawnList[j], spawnList[i]];
    }

    return spawnList;
}
