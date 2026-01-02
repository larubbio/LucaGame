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
}
