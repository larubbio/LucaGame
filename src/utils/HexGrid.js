/**
 * HexGrid - Utility class for hexagonal grid calculations
 * Uses axial coordinates (q, r) for hex positioning
 * Pointy-top hexagon orientation
 */
class HexGrid {
    constructor(hexSize, gridRadius, centerX, centerY) {
        this.hexSize = hexSize; // Distance from center to corner
        this.gridRadius = gridRadius; // Number of hexes from center to edge
        this.centerX = centerX;
        this.centerY = centerY;

        // Hex dimensions for pointy-top orientation
        this.hexWidth = Math.sqrt(3) * hexSize;
        this.hexHeight = 2 * hexSize;

        // Generate all valid hex positions
        this.hexes = this.generateHexGrid();
    }

    /**
     * Generate all hex positions in a hexagonal-shaped grid
     */
    generateHexGrid() {
        const hexes = [];
        const radius = this.gridRadius;

        for (let q = -radius; q <= radius; q++) {
            const r1 = Math.max(-radius, -q - radius);
            const r2 = Math.min(radius, -q + radius);
            for (let r = r1; r <= r2; r++) {
                hexes.push({ q, r, s: -q - r });
            }
        }

        return hexes;
    }

    /**
     * Convert axial coordinates to pixel position
     */
    hexToPixel(q, r) {
        const x = this.hexSize * (Math.sqrt(3) * q + Math.sqrt(3) / 2 * r);
        const y = this.hexSize * (3 / 2 * r);
        return {
            x: x + this.centerX,
            y: y + this.centerY
        };
    }

    /**
     * Convert pixel position to axial coordinates
     */
    pixelToHex(px, py) {
        const x = px - this.centerX;
        const y = py - this.centerY;

        const q = (Math.sqrt(3) / 3 * x - 1 / 3 * y) / this.hexSize;
        const r = (2 / 3 * y) / this.hexSize;

        return this.roundHex(q, r);
    }

    /**
     * Round fractional hex coordinates to nearest hex
     */
    roundHex(q, r) {
        const s = -q - r;

        let rq = Math.round(q);
        let rr = Math.round(r);
        let rs = Math.round(s);

        const qDiff = Math.abs(rq - q);
        const rDiff = Math.abs(rr - r);
        const sDiff = Math.abs(rs - s);

        if (qDiff > rDiff && qDiff > sDiff) {
            rq = -rr - rs;
        } else if (rDiff > sDiff) {
            rr = -rq - rs;
        }

        return { q: rq, r: rr };
    }

    /**
     * Check if hex coordinates are valid (within grid)
     */
    isValidHex(q, r) {
        return this.hexes.some(hex => hex.q === q && hex.r === r);
    }

    /**
     * Get the 6 corner points of a hexagon at given axial coords
     */
    getHexCorners(q, r) {
        const center = this.hexToPixel(q, r);
        const corners = [];

        for (let i = 0; i < 6; i++) {
            const angleDeg = 60 * i - 30; // Pointy-top orientation
            const angleRad = Math.PI / 180 * angleDeg;
            corners.push({
                x: center.x + this.hexSize * Math.cos(angleRad),
                y: center.y + this.hexSize * Math.sin(angleRad)
            });
        }

        return corners;
    }

    /**
     * Get neighboring hex coordinates
     */
    getNeighbors(q, r) {
        const directions = [
            { q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 },
            { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 }
        ];

        return directions
            .map(dir => ({ q: q + dir.q, r: r + dir.r }))
            .filter(hex => this.isValidHex(hex.q, hex.r));
    }

    /**
     * Calculate distance between two hexes
     */
    getDistance(q1, r1, q2, r2) {
        return (Math.abs(q1 - q2) + Math.abs(q1 + r1 - q2 - r2) + Math.abs(r1 - r2)) / 2;
    }

    /**
     * Get all hexes within range of a position
     */
    getHexesInRange(q, r, range) {
        const results = [];

        for (let dq = -range; dq <= range; dq++) {
            for (let dr = Math.max(-range, -dq - range); dr <= Math.min(range, -dq + range); dr++) {
                const hexQ = q + dq;
                const hexR = r + dr;
                if (this.isValidHex(hexQ, hexR)) {
                    results.push({ q: hexQ, r: hexR });
                }
            }
        }

        return results;
    }

    /**
     * A* pathfinding between two hexes
     * @param {number} startQ - Start hex Q coordinate
     * @param {number} startR - Start hex R coordinate
     * @param {number} endQ - End hex Q coordinate
     * @param {number} endR - End hex R coordinate
     * @param {Array} obstacles - Array of {q, r} positions to avoid
     * @returns {Array|null} - Array of hex positions forming path, or null if no path
     */
    findPath(startQ, startR, endQ, endR, obstacles = []) {
        // Helper to create a key for hex position
        const hexKey = (q, r) => `${q},${r}`;

        // Check if a hex is blocked
        const isBlocked = (q, r) => {
            return obstacles.some(obs => obs.q === q && obs.r === r);
        };

        // Priority queue implemented as sorted array (simple but works)
        const openSet = [];
        const closedSet = new Set();

        // Track came-from for path reconstruction
        const cameFrom = new Map();

        // G scores (cost from start)
        const gScore = new Map();
        gScore.set(hexKey(startQ, startR), 0);

        // F scores (g + heuristic)
        const fScore = new Map();
        const startH = this.getDistance(startQ, startR, endQ, endR);
        fScore.set(hexKey(startQ, startR), startH);

        // Add start to open set
        openSet.push({ q: startQ, r: startR, f: startH });

        while (openSet.length > 0) {
            // Sort by f score and get lowest
            openSet.sort((a, b) => a.f - b.f);
            const current = openSet.shift();
            const currentKey = hexKey(current.q, current.r);

            // Found the goal!
            if (current.q === endQ && current.r === endR) {
                // Reconstruct path
                const path = [];
                let curr = { q: endQ, r: endR };

                while (curr) {
                    path.unshift(curr);
                    curr = cameFrom.get(hexKey(curr.q, curr.r));
                }

                // Remove start position from path (we're already there)
                path.shift();
                return path;
            }

            closedSet.add(currentKey);

            // Check all neighbors
            const neighbors = this.getNeighbors(current.q, current.r);

            for (const neighbor of neighbors) {
                const neighborKey = hexKey(neighbor.q, neighbor.r);

                // Skip if already evaluated or blocked
                if (closedSet.has(neighborKey)) continue;
                if (isBlocked(neighbor.q, neighbor.r)) continue;

                // Calculate tentative g score
                const tentativeG = (gScore.get(currentKey) || Infinity) + 1;

                // Check if this path is better
                const existingG = gScore.get(neighborKey);
                if (existingG === undefined || tentativeG < existingG) {
                    // This is a better path
                    cameFrom.set(neighborKey, { q: current.q, r: current.r });
                    gScore.set(neighborKey, tentativeG);

                    const h = this.getDistance(neighbor.q, neighbor.r, endQ, endR);
                    const f = tentativeG + h;
                    fScore.set(neighborKey, f);

                    // Add to open set if not already there
                    const inOpen = openSet.some(n => n.q === neighbor.q && n.r === neighbor.r);
                    if (!inOpen) {
                        openSet.push({ q: neighbor.q, r: neighbor.r, f: f });
                    }
                }
            }
        }

        // No path found
        return null;
    }

    /**
     * Check line of sight between two hexes
     * Uses hex line drawing algorithm to check for blocking obstacles
     * @param {number} q1 - Start hex Q
     * @param {number} r1 - Start hex R
     * @param {number} q2 - End hex Q
     * @param {number} r2 - End hex R
     * @param {Array} blockers - Array of {q, r} positions that block LOS
     * @returns {boolean} - True if there's clear line of sight
     */
    hasLineOfSight(q1, r1, q2, r2, blockers = []) {
        // If same hex, always has LOS
        if (q1 === q2 && r1 === r2) return true;

        // Get all hexes along the line
        const lineHexes = this.getHexLine(q1, r1, q2, r2);

        // Check each hex (except start and end) for blockers
        for (let i = 1; i < lineHexes.length - 1; i++) {
            const hex = lineHexes[i];
            const blocked = blockers.some(b => b.q === hex.q && b.r === hex.r);
            if (blocked) return false;
        }

        return true;
    }

    /**
     * Get all hexes along a line between two hexes
     * Uses cube coordinate linear interpolation
     */
    getHexLine(q1, r1, q2, r2) {
        const N = this.getDistance(q1, r1, q2, r2);
        if (N === 0) return [{ q: q1, r: r1 }];

        const results = [];

        // Convert to cube coordinates
        const s1 = -q1 - r1;
        const s2 = -q2 - r2;

        for (let i = 0; i <= N; i++) {
            const t = i / N;
            // Linear interpolation in cube coordinates
            const q = q1 + (q2 - q1) * t;
            const r = r1 + (r2 - r1) * t;
            const s = s1 + (s2 - s1) * t;

            // Round to nearest hex
            const rounded = this.roundCube(q, r, s);
            results.push(rounded);
        }

        return results;
    }

    /**
     * Round fractional cube coordinates to nearest hex
     */
    roundCube(q, r, s) {
        let rq = Math.round(q);
        let rr = Math.round(r);
        let rs = Math.round(s);

        const qDiff = Math.abs(rq - q);
        const rDiff = Math.abs(rr - r);
        const sDiff = Math.abs(rs - s);

        if (qDiff > rDiff && qDiff > sDiff) {
            rq = -rr - rs;
        } else if (rDiff > sDiff) {
            rr = -rq - rs;
        }
        // else rs = -rq - rr (but we don't need s for axial)

        return { q: rq, r: rr };
    }
}
