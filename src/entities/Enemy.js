/**
 * Enemy - Individual enemy instance with AI and rendering
 */
class Enemy {
    constructor(scene, typeKey, q, r) {
        this.scene = scene;
        this.typeKey = typeKey;
        this.data = getEnemyData(typeKey);

        // Position
        this.pos = { q, r };

        // Stats (copy from data so we can modify)
        this.hp = this.data.hp;
        this.maxHP = this.data.hp;
        this.damage = this.data.damage;
        this.range = this.data.range;
        this.ap = this.data.ap;
        this.maxAP = this.data.ap;
        this.maxAttacksPerTurn = this.data.maxAttacksPerTurn;
        this.attacksThisTurn = 0;

        // AI settings
        this.aiType = this.data.aiType;
        this.preferredDistance = this.data.preferredDistance;

        // Visual
        this.container = null;
        this.hpBar = null;
        this.idleTween = null;

        // State
        this.isAlive = true;
        this.isMoving = false;

        this.createVisual();
    }

    createVisual() {
        const pos = this.scene.hexGrid.hexToPixel(this.pos.q, this.pos.r);
        const colors = this.data.colors;

        // Create container
        this.container = this.scene.add.container(pos.x, pos.y);

        // Robot body graphics
        const graphics = this.scene.add.graphics();

        // Main body
        graphics.fillStyle(colors.body, 1);
        graphics.fillRect(-12, -16, 24, 28);

        // Head
        graphics.fillStyle(colors.head, 1);
        graphics.fillRect(-8, -24, 16, 10);

        // Eye visor
        graphics.fillStyle(colors.visor, 1);
        graphics.fillRect(-6, -22, 12, 4);

        // Legs
        graphics.fillStyle(colors.legs, 1);
        graphics.fillRect(-10, 12, 6, 10);
        graphics.fillRect(4, 12, 6, 10);

        // Accent/gear
        graphics.fillStyle(colors.accent, 1);
        graphics.fillRect(-4, -8, 8, 8);

        // Add ranged indicator (antenna) for ranged enemies
        if (this.aiType === 'ranged') {
            graphics.fillStyle(colors.visor, 1);
            graphics.fillRect(-1, -30, 2, 8);
            graphics.fillStyle(colors.visor, 1);
            graphics.fillCircle(0, -32, 3);
        }

        this.container.add(graphics);

        // HP bar background
        const hpBg = this.scene.add.graphics();
        hpBg.fillStyle(0x333333, 1);
        hpBg.fillRect(-15, -38, 30, 6);
        this.container.add(hpBg);

        // HP bar fill
        this.hpBar = this.scene.add.graphics();
        this.container.add(this.hpBar);
        this.updateHPBar();

        // Start idle animation
        this.startIdleAnimation();
    }

    updateHPBar() {
        this.hpBar.clear();
        const hpPercent = this.hp / this.maxHP;
        const barWidth = 28 * hpPercent;

        // Color based on health
        let color = 0xaa4444; // Red (enemy color)
        if (hpPercent <= 0.25) {
            color = 0x662222; // Dark red
        }

        this.hpBar.fillStyle(color, 1);
        this.hpBar.fillRect(-14, -37, barWidth, 4);
    }

    startIdleAnimation() {
        if (this.idleTween) {
            this.idleTween.stop();
        }

        const basePos = this.scene.hexGrid.hexToPixel(this.pos.q, this.pos.r);
        this.idleTween = this.scene.tweens.add({
            targets: this.container,
            y: basePos.y - 3,
            duration: 1000 + Math.random() * 200, // Slight variation
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
    }

    stopIdleAnimation() {
        if (this.idleTween) {
            this.idleTween.stop();
            this.idleTween = null;
        }
    }

    takeDamage(amount) {
        this.hp = Math.max(0, this.hp - amount);
        this.updateHPBar();

        // Visual feedback - flash white
        this.scene.tweens.add({
            targets: this.container,
            alpha: 0.3,
            duration: 50,
            yoyo: true,
            repeat: 2
        });

        // Show damage number
        const pos = this.scene.hexGrid.hexToPixel(this.pos.q, this.pos.r);
        this.scene.showDamageText(pos.x, pos.y - 40, `-${amount}`);

        if (this.hp <= 0) {
            this.die();
        }
    }

    die() {
        this.isAlive = false;
        this.stopIdleAnimation();

        // Death animation
        this.scene.tweens.add({
            targets: this.container,
            alpha: 0,
            scaleX: 0,
            scaleY: 0,
            angle: 180,
            duration: 300,
            ease: 'Power2',
            onComplete: () => {
                this.container.destroy();
            }
        });
    }

    resetTurn() {
        this.ap = this.maxAP;
        this.attacksThisTurn = 0;
    }

    canAttack() {
        return this.attacksThisTurn < this.maxAttacksPerTurn && this.ap >= 1;
    }

    /**
     * Move to a hex position with animation
     * @returns {Promise} Resolves when movement is complete
     */
    moveTo(q, r) {
        return new Promise((resolve) => {
            this.stopIdleAnimation();
            this.isMoving = true;

            const targetPos = this.scene.hexGrid.hexToPixel(q, r);

            this.scene.tweens.add({
                targets: this.container,
                x: targetPos.x,
                y: targetPos.y,
                duration: 200,
                ease: 'Power2',
                onComplete: () => {
                    this.pos = { q, r };
                    this.ap -= 1;
                    this.isMoving = false;
                    this.startIdleAnimation();
                    resolve();
                }
            });
        });
    }

    /**
     * Attack the player
     * @returns {Promise} Resolves when attack animation is complete
     */
    attackPlayer() {
        return new Promise((resolve) => {
            if (!this.canAttack()) {
                resolve();
                return;
            }

            this.attacksThisTurn++;
            this.ap -= 1;

            const playerPos = this.scene.hexGrid.hexToPixel(
                this.scene.playerPos.q,
                this.scene.playerPos.r
            );
            const myPos = this.scene.hexGrid.hexToPixel(this.pos.q, this.pos.r);

            this.stopIdleAnimation();

            // Lunge toward player
            const lungeX = myPos.x + (playerPos.x - myPos.x) * 0.3;
            const lungeY = myPos.y + (playerPos.y - myPos.y) * 0.3;

            this.scene.tweens.add({
                targets: this.container,
                x: lungeX,
                y: lungeY,
                duration: 100,
                yoyo: true,
                ease: 'Power2',
                onComplete: () => {
                    // Deal damage
                    this.scene.damagePlayer(this.damage);
                    this.scene.showDamageText(
                        playerPos.x,
                        playerPos.y - 30,
                        `-${this.damage}`
                    );

                    // Return to position
                    this.container.x = myPos.x;
                    this.container.y = myPos.y;
                    this.startIdleAnimation();

                    // Small delay before resolving
                    this.scene.time.delayedCall(200, resolve);
                }
            });
        });
    }

    /**
     * Get distance to player
     */
    getDistanceToPlayer() {
        return this.scene.hexGrid.getDistance(
            this.pos.q, this.pos.r,
            this.scene.playerPos.q, this.scene.playerPos.r
        );
    }

    /**
     * Check if can attack player from current position
     * For ranged enemies, also checks line of sight
     */
    canReachPlayerWithAttack() {
        const dist = this.getDistanceToPlayer();
        if (dist > this.range) return false;

        // Ranged enemies need line of sight
        if (this.aiType === 'ranged') {
            return this.hasLineOfSightToPlayer();
        }

        return true;
    }

    /**
     * Check line of sight to player (walls block, traps don't)
     */
    hasLineOfSightToPlayer() {
        // Get wall positions (only walls block LOS, not traps)
        const walls = (this.scene.obstacles || [])
            .filter(o => o.type === 'wall')
            .map(o => ({ q: o.q, r: o.r }));

        return this.scene.hexGrid.hasLineOfSight(
            this.pos.q, this.pos.r,
            this.scene.playerPos.q, this.scene.playerPos.r,
            walls
        );
    }

    /**
     * Get all obstacles for pathfinding (walls + other enemies + player)
     */
    getObstacles() {
        const obstacles = [...(this.scene.obstacles || [])];

        // Add other enemies as obstacles
        for (const enemy of this.scene.enemies) {
            if (enemy !== this && enemy.isAlive) {
                obstacles.push({ q: enemy.pos.q, r: enemy.pos.r, type: 'enemy' });
            }
        }

        // Add player as obstacle (can't walk through)
        obstacles.push({
            q: this.scene.playerPos.q,
            r: this.scene.playerPos.r,
            type: 'player'
        });

        return obstacles;
    }

    /**
     * Execute AI turn
     * @returns {Promise} Resolves when turn is complete
     */
    async executeTurn() {
        if (!this.isAlive) return;

        if (this.aiType === 'melee') {
            await this.executeMeleeTurn();
        } else {
            await this.executeRangedTurn();
        }
    }

    /**
     * Melee AI: Chase player and attack
     */
    async executeMeleeTurn() {
        // Keep acting while we have AP
        while (this.ap > 0 && this.isAlive && !this.scene.battleOver) {
            const distToPlayer = this.getDistanceToPlayer();

            // If adjacent to player and can attack
            if (distToPlayer === 1 && this.canAttack()) {
                await this.attackPlayer();
                continue;
            }

            // Try to move closer
            if (this.ap >= 1) {
                const moved = await this.moveTowardPlayer();
                if (!moved) break; // Can't move, end turn
            } else {
                break;
            }
        }
    }

    /**
     * Ranged AI: Maintain preferred distance and attack
     * Ideal pattern: move 1 hex in → attack → move back to preferred distance
     */
    async executeRangedTurn() {
        // Phase 1: Get into attack position if too far or no LOS
        let dist = this.getDistanceToPlayer();
        let hasLOS = this.hasLineOfSightToPlayer();

        // If too far to attack or no line of sight, move closer
        while ((dist > this.range || !hasLOS) && this.ap >= 1 && this.isAlive && !this.scene.battleOver) {
            const moved = await this.moveTowardPlayer();
            if (!moved) break;
            dist = this.getDistanceToPlayer();
            hasLOS = this.hasLineOfSightToPlayer();
        }

        // Phase 2: Attack phase - attack if in range AND has line of sight
        // Only attack once, don't prioritize multiple attacks
        if (this.canAttack() && dist <= this.range && hasLOS && this.isAlive && !this.scene.battleOver) {
            await this.attackPlayer();
            dist = this.getDistanceToPlayer();
        }

        // Phase 3: Retreat to preferred distance if too close
        while (dist < this.preferredDistance && this.ap >= 1 && this.isAlive && !this.scene.battleOver) {
            const moved = await this.moveAwayFromPlayer();
            if (!moved) break; // Can't retreat further
            dist = this.getDistanceToPlayer();
        }
    }

    /**
     * Move one hex toward player
     * @returns {Promise<boolean>} True if moved successfully
     */
    async moveTowardPlayer() {
        const obstacles = this.getObstacles();

        // Find path to player (excluding player position itself)
        const pathObstacles = obstacles.filter(o => o.type !== 'player');
        const path = this.scene.hexGrid.findPath(
            this.pos.q, this.pos.r,
            this.scene.playerPos.q, this.scene.playerPos.r,
            pathObstacles
        );

        if (path && path.length > 1) {
            // Move to first hex in path (path[0] is next step, not destination)
            const nextHex = path[0];

            // Make sure we're not stepping on another enemy
            const occupied = this.scene.enemies.some(e =>
                e !== this && e.isAlive &&
                e.pos.q === nextHex.q && e.pos.r === nextHex.r
            );

            if (!occupied) {
                await this.moveTo(nextHex.q, nextHex.r);
                return true;
            }
        }

        return false;
    }

    /**
     * Move one hex away from player
     * @returns {Promise<boolean>} True if moved successfully
     */
    async moveAwayFromPlayer() {
        const neighbors = this.scene.hexGrid.getNeighbors(this.pos.q, this.pos.r);
        const obstacles = this.getObstacles();

        // Filter valid neighbors
        const validNeighbors = neighbors.filter(n => {
            // Check if valid hex
            if (!this.scene.hexGrid.isValidHex(n.q, n.r)) return false;

            // Check if blocked
            const blocked = obstacles.some(o => o.q === n.q && o.r === n.r);
            if (blocked) return false;

            return true;
        });

        if (validNeighbors.length === 0) return false;

        // Find neighbor that maximizes distance from player
        let bestNeighbor = null;
        let bestDist = this.getDistanceToPlayer();

        for (const neighbor of validNeighbors) {
            const dist = this.scene.hexGrid.getDistance(
                neighbor.q, neighbor.r,
                this.scene.playerPos.q, this.scene.playerPos.r
            );
            if (dist > bestDist) {
                bestDist = dist;
                bestNeighbor = neighbor;
            }
        }

        if (bestNeighbor) {
            await this.moveTo(bestNeighbor.q, bestNeighbor.r);
            return true;
        }

        return false;
    }
}
