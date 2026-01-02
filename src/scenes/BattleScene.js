/**
 * BattleScene - Main battle arena with hex grid
 */
class BattleScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BattleScene' });
    }

    /**
     * Called on every start/restart - resets all game state
     */
    init() {
        this.hexGrid = null;
        this.playerRobot = null;
        this.hexGraphics = null;
        this.hoveredHex = null;
        this.selectedHex = null;
        this.currentPath = null;
        this.isMoving = false;

        // Player robot position (axial coordinates)
        this.playerPos = { q: 0, r: 0 };

        // Action points
        this.actionPoints = 3;
        this.maxActionPoints = 3;

        // Player health
        this.playerHP = 20;
        this.playerMaxHP = 20;

        // Player attack
        this.playerDamage = 2;
        this.playerAttackCost = 1;

        // Enemies
        this.enemies = [];

        // Obstacles
        this.obstacles = [];

        // Turn management
        this.currentPhase = 'player';
        this.isProcessingTurn = false;
        this.battleOver = false;
    }

    create() {
        const { width, height } = this.cameras.main;

        // Create hex grid (6 hexes radius, centered on screen)
        const hexSize = 36;
        const gridRadius = 5; // 0-5 = 6 hexes from center to edge
        this.hexGrid = new HexGrid(hexSize, gridRadius, width / 2, height / 2);

        // Graphics object for drawing hexes
        this.hexGraphics = this.add.graphics();

        // Draw the initial grid
        this.drawHexGrid();

        // Create player robot
        this.createPlayerRobot();

        // Create UI
        this.createUI();

        // Input handling
        this.input.on('pointermove', this.onPointerMove, this);
        this.input.on('pointerdown', this.onPointerDown, this);

        // Generate random obstacles
        this.generateObstacles();

        // Spawn enemies
        this.spawnEnemies(3);

        // Redraw with obstacles and enemies
        this.drawHexGrid();
    }

    generateObstacles() {
        // Random number of walls (2-4) and traps (2-4)
        const numWalls = 2 + Math.floor(Math.random() * 3);  // 2-4 walls
        const numTraps = 2 + Math.floor(Math.random() * 3);  // 2-4 traps

        this.obstacles = [];

        // Helper: Check if hex is on the edge (has fewer than 6 valid neighbors)
        const isEdgeHex = (q, r) => {
            const neighbors = this.hexGrid.getNeighbors(q, r);
            return neighbors.length < 6;
        };

        // Helper: Count adjacent walls
        const countAdjacentWalls = (q, r) => {
            const neighbors = this.hexGrid.getNeighbors(q, r);
            return neighbors.filter(n =>
                this.obstacles.some(o => o.type === 'wall' && o.q === n.q && o.r === n.r)
            ).length;
        };

        // Helper: Check if position is valid for a wall
        const isValidWallPosition = (q, r) => {
            // Not player position or too close
            if (q === 0 && r === 0) return false;
            const dist = this.hexGrid.getDistance(q, r, 0, 0);
            if (dist < 2) return false;

            // Not on edge
            if (isEdgeHex(q, r)) return false;

            // Not already occupied
            if (this.obstacles.some(o => o.q === q && o.r === r)) return false;

            // Must not have 2+ adjacent walls
            if (countAdjacentWalls(q, r) >= 2) return false;

            return true;
        };

        // Get all valid wall positions (not edge, not near player)
        let validWallPositions = this.hexGrid.hexes.filter(hex =>
            isValidWallPosition(hex.q, hex.r)
        );

        // Place walls with adjacency preference
        for (let i = 0; i < numWalls && validWallPositions.length > 0; i++) {
            // Separate positions by adjacency
            const adjacentToWall = validWallPositions.filter(h => countAdjacentWalls(h.q, h.r) === 1);
            const notAdjacentToWall = validWallPositions.filter(h => countAdjacentWalls(h.q, h.r) === 0);

            let chosen;
            if (i === 0 || adjacentToWall.length === 0) {
                // First wall or no adjacent options: pick random from non-adjacent
                const pool = notAdjacentToWall.length > 0 ? notAdjacentToWall : validWallPositions;
                chosen = pool[Math.floor(Math.random() * pool.length)];
            } else {
                // Prefer adjacent positions (70% chance if available)
                if (Math.random() < 0.7 && adjacentToWall.length > 0) {
                    chosen = adjacentToWall[Math.floor(Math.random() * adjacentToWall.length)];
                } else if (notAdjacentToWall.length > 0) {
                    chosen = notAdjacentToWall[Math.floor(Math.random() * notAdjacentToWall.length)];
                } else {
                    chosen = adjacentToWall[Math.floor(Math.random() * adjacentToWall.length)];
                }
            }

            this.obstacles.push({ q: chosen.q, r: chosen.r, type: 'wall' });

            // Recalculate valid positions (adjacency counts changed)
            validWallPositions = this.hexGrid.hexes.filter(hex =>
                isValidWallPosition(hex.q, hex.r)
            );
        }

        // Get valid positions for traps (not player, not too close, not occupied)
        let validTrapPositions = this.hexGrid.hexes.filter(hex => {
            if (hex.q === 0 && hex.r === 0) return false;
            const dist = this.hexGrid.getDistance(hex.q, hex.r, 0, 0);
            if (dist < 2) return false;
            if (this.obstacles.some(o => o.q === hex.q && o.r === hex.r)) return false;
            return true;
        });

        // Shuffle trap positions
        for (let i = validTrapPositions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [validTrapPositions[i], validTrapPositions[j]] = [validTrapPositions[j], validTrapPositions[i]];
        }

        // Place traps
        for (let i = 0; i < numTraps && i < validTrapPositions.length; i++) {
            const pos = validTrapPositions[i];
            this.obstacles.push({ q: pos.q, r: pos.r, type: 'trap' });
        }
    }

    spawnEnemies(count) {
        // Generate enemy types (at least 1 melee, 1 ranged)
        const enemyTypes = generateEnemySpawnList(count, {
            minMelee: 1,
            minRanged: 1
        });

        // Get valid spawn positions (not player, not obstacles, not too close)
        const validSpawns = this.hexGrid.hexes.filter(hex => {
            // Not player position
            if (hex.q === 0 && hex.r === 0) return false;

            // Not too close to player (at least 2 hexes away)
            const dist = this.hexGrid.getDistance(hex.q, hex.r, 0, 0);
            if (dist < 2) return false;

            // Not on obstacle
            const isObstacle = this.obstacles?.some(o =>
                o.q === hex.q && o.r === hex.r
            );
            if (isObstacle) return false;

            return true;
        });

        // Shuffle spawn positions
        for (let i = validSpawns.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [validSpawns[i], validSpawns[j]] = [validSpawns[j], validSpawns[i]];
        }

        // Spawn enemies
        this.enemies = [];
        for (let i = 0; i < count && i < validSpawns.length; i++) {
            const spawnHex = validSpawns[i];
            const enemy = new Enemy(this, enemyTypes[i], spawnHex.q, spawnHex.r);
            this.enemies.push(enemy);
        }
    }

    createPlayerRobot() {
        const pos = this.hexGrid.hexToPixel(this.playerPos.q, this.playerPos.r);

        // Create robot container
        this.playerRobot = this.add.container(pos.x, pos.y);

        // Robot body (chunky pixel style - using rectangles)
        const graphics = this.add.graphics();

        // Main body - large pixels
        graphics.fillStyle(0x5588aa, 1);
        graphics.fillRect(-12, -16, 24, 28);

        // Head
        graphics.fillStyle(0x77aacc, 1);
        graphics.fillRect(-8, -24, 16, 10);

        // Eye visor
        graphics.fillStyle(0xffcc00, 1);
        graphics.fillRect(-6, -22, 12, 4);

        // Legs
        graphics.fillStyle(0x446688, 1);
        graphics.fillRect(-10, 12, 6, 10);
        graphics.fillRect(4, 12, 6, 10);

        // Steam vents (shoulders)
        graphics.fillStyle(0x888888, 1);
        graphics.fillRect(-16, -12, 4, 8);
        graphics.fillRect(12, -12, 4, 8);

        // Gear decoration
        graphics.fillStyle(0xcc8844, 1);
        graphics.fillRect(-4, -8, 8, 8);

        this.playerRobot.add(graphics);

        // Add a subtle bounce animation
        this.tweens.add({
            targets: this.playerRobot,
            y: pos.y - 3,
            duration: 1000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
    }

    drawHexGrid() {
        this.hexGraphics.clear();

        // Draw each hex
        for (const hex of this.hexGrid.hexes) {
            const corners = this.hexGrid.getHexCorners(hex.q, hex.r);

            // Check if this hex has an obstacle
            const obstacle = this.obstacles?.find(o => o.q === hex.q && o.r === hex.r);

            // Determine fill color
            let fillColor = 0x2a2a4a; // Default dark blue-gray
            let fillAlpha = 0.6;

            if (obstacle) {
                if (obstacle.type === 'wall') {
                    fillColor = 0x4a4a4a;
                    fillAlpha = 0.9;
                } else if (obstacle.type === 'trap') {
                    fillColor = 0x8b4513;
                    fillAlpha = 0.7;
                }
            }

            // Check if hex is in the current path
            const isInPath = this.currentPath?.some(p => p.q === hex.q && p.r === hex.r);
            const pathIndex = this.currentPath?.findIndex(p => p.q === hex.q && p.r === hex.r);

            // Check if we have enough AP for this path
            const canAffordPath = this.currentPath ? this.actionPoints >= this.currentPath.length : false;

            // Highlight path hexes
            if (isInPath && !obstacle) {
                if (canAffordPath) {
                    // Valid path - green/blue colors
                    if (pathIndex === this.currentPath.length - 1) {
                        fillColor = 0x4a8a6a; // Green tint for destination
                        fillAlpha = 0.9;
                    } else {
                        fillColor = 0x3a5a7a; // Subtle blue for path
                        fillAlpha = 0.7;
                    }
                } else {
                    // Can't afford - red colors
                    if (pathIndex === this.currentPath.length - 1) {
                        fillColor = 0x8a4a4a; // Red tint for destination
                        fillAlpha = 0.9;
                    } else {
                        fillColor = 0x6a3a3a; // Darker red for path
                        fillAlpha = 0.7;
                    }
                }
            }

            // Check if there's an enemy on this hex
            const enemyOnHex = this.enemies?.find(e =>
                e.isAlive && e.pos.q === hex.q && e.pos.r === hex.r
            );

            if (enemyOnHex) {
                // Check if adjacent (attackable)
                const distToPlayer = this.hexGrid.getDistance(
                    hex.q, hex.r,
                    this.playerPos.q, this.playerPos.r
                );
                const canAttack = distToPlayer === 1 && this.actionPoints >= this.playerAttackCost;

                if (canAttack) {
                    fillColor = 0x8a4a4a; // Red highlight for attackable
                    fillAlpha = 0.9;
                } else {
                    fillColor = 0x5a3a3a; // Dim red for enemy hex
                    fillAlpha = 0.7;
                }
            }

            // Highlight hovered hex (destination) - even brighter
            if (this.hoveredHex && this.hoveredHex.q === hex.q && this.hoveredHex.r === hex.r && !obstacle) {
                if (enemyOnHex) {
                    // Hovering over an enemy
                    const distToPlayer = this.hexGrid.getDistance(
                        hex.q, hex.r,
                        this.playerPos.q, this.playerPos.r
                    );
                    const canAttack = distToPlayer === 1 && this.actionPoints >= this.playerAttackCost;
                    fillColor = canAttack ? 0xaa5555 : 0x6a3a3a; // Bright red if attackable
                    fillAlpha = 0.95;
                } else if (canAffordPath) {
                    fillColor = 0x5a9a7a; // Green for valid
                    fillAlpha = 0.9;
                } else {
                    fillColor = 0x9a5a5a; // Red for invalid
                    fillAlpha = 0.9;
                }
            }

            // Draw filled hex
            this.hexGraphics.fillStyle(fillColor, fillAlpha);
            this.hexGraphics.beginPath();
            this.hexGraphics.moveTo(corners[0].x, corners[0].y);
            for (let i = 1; i < 6; i++) {
                this.hexGraphics.lineTo(corners[i].x, corners[i].y);
            }
            this.hexGraphics.closePath();
            this.hexGraphics.fillPath();

            // Draw hex border
            let borderColor = 0x5a5a8a;
            if (obstacle?.type === 'trap') {
                borderColor = 0xff6600;
            }

            this.hexGraphics.lineStyle(2, borderColor, 0.8);
            this.hexGraphics.beginPath();
            this.hexGraphics.moveTo(corners[0].x, corners[0].y);
            for (let i = 1; i < 6; i++) {
                this.hexGraphics.lineTo(corners[i].x, corners[i].y);
            }
            this.hexGraphics.closePath();
            this.hexGraphics.strokePath();

            // Draw trap spikes
            if (obstacle?.type === 'trap') {
                const center = this.hexGrid.hexToPixel(hex.q, hex.r);
                this.hexGraphics.fillStyle(0xff4400, 1);
                // Draw small triangles as spikes
                for (let i = 0; i < 3; i++) {
                    const angle = (i * 120) * Math.PI / 180;
                    const x = center.x + Math.cos(angle) * 10;
                    const y = center.y + Math.sin(angle) * 10;
                    this.hexGraphics.fillTriangle(
                        x, y - 6,
                        x - 4, y + 4,
                        x + 4, y + 4
                    );
                }
            }

            // Draw wall blocks
            if (obstacle?.type === 'wall') {
                const center = this.hexGrid.hexToPixel(hex.q, hex.r);
                this.hexGraphics.fillStyle(0x666666, 1);
                this.hexGraphics.fillRect(center.x - 12, center.y - 12, 24, 24);
                this.hexGraphics.fillStyle(0x555555, 1);
                this.hexGraphics.fillRect(center.x - 10, center.y - 10, 8, 8);
                this.hexGraphics.fillRect(center.x + 2, center.y + 2, 8, 8);
            }
        }
    }

    createUI() {
        const { width, height } = this.cameras.main;

        // Title
        this.add.text(width / 2, 25, 'COG & SALVAGE', {
            fontSize: '28px',
            fontFamily: 'Courier New',
            color: '#ffcc00',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5);

        // Player HP Bar (top left)
        this.add.text(20, 20, 'HP', {
            fontSize: '16px',
            fontFamily: 'Courier New',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 2
        });

        // HP bar background
        this.hpBarBg = this.add.graphics();
        this.hpBarBg.fillStyle(0x333333, 1);
        this.hpBarBg.fillRect(50, 18, 150, 20);
        this.hpBarBg.lineStyle(2, 0x666666, 1);
        this.hpBarBg.strokeRect(50, 18, 150, 20);

        // HP bar fill
        this.hpBarFill = this.add.graphics();
        this.updateHPBar();

        // HP text
        this.hpText = this.add.text(125, 28, '', {
            fontSize: '14px',
            fontFamily: 'Courier New',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0.5);
        this.updateHPText();

        // Action Points display
        this.apText = this.add.text(20, 50, '', {
            fontSize: '20px',
            fontFamily: 'Courier New',
            color: '#ffcc00',
            stroke: '#000000',
            strokeThickness: 3
        });
        this.updateAPDisplay();

        // Instructions
        this.instructionText = this.add.text(20, height - 40, 'Click to move/attack | TAB = end turn | R = restart | SPACE = reset AP (debug)', {
            fontSize: '13px',
            fontFamily: 'Courier New',
            color: '#aaaaaa'
        });

        // Reset AP on spacebar (for testing - easily removable)
        // TODO: Remove this for final game
        this.input.keyboard.on('keydown-SPACE', () => {
            if (this.currentPhase === 'player' && !this.isMoving && !this.battleOver) {
                this.actionPoints = this.maxActionPoints;
                this.updateAPDisplay();
            }
        });

        // Tab key to end player turn
        this.input.keyboard.on('keydown-TAB', (event) => {
            event.preventDefault(); // Prevent browser tab switching
            if (this.currentPhase === 'player' && !this.isMoving && !this.battleOver) {
                this.endPlayerTurn();
            }
        });

        // R key to restart game (debug)
        // TODO: Remove this for final game
        this.input.keyboard.on('keydown-R', () => {
            this.scene.restart();
        });

        // Create End Turn button
        this.createEndTurnButton();

        // Show initial player phase banner after a short delay
        this.time.delayedCall(500, () => {
            this.showPhaseBanner('PLAYER PHASE', '#44aaff');
        });
    }

    updateHPBar() {
        this.hpBarFill.clear();
        const hpPercent = this.playerHP / this.playerMaxHP;
        const barWidth = 146 * hpPercent;

        // Color based on health
        let color = 0x44aa44; // Green
        if (hpPercent <= 0.25) {
            color = 0xaa4444; // Red
        } else if (hpPercent <= 0.5) {
            color = 0xaaaa44; // Yellow
        }

        this.hpBarFill.fillStyle(color, 1);
        this.hpBarFill.fillRect(52, 20, barWidth, 16);
    }

    updateHPText() {
        this.hpText.setText(`${this.playerHP}/${this.playerMaxHP}`);
    }

    damagePlayer(amount) {
        this.playerHP = Math.max(0, this.playerHP - amount);
        this.updateHPBar();
        this.updateHPText();

        // Camera shake for feedback
        this.cameras.main.shake(100, 0.01);

        // Check for player death
        if (this.playerHP <= 0) {
            this.endBattle(false);
        }
    }

    // ==================== TURN MANAGEMENT ====================

    createEndTurnButton() {
        const { width, height } = this.cameras.main;

        // End Turn button background
        this.endTurnButton = this.add.graphics();
        this.endTurnButtonBg = { x: width - 130, y: height - 60, width: 110, height: 40 };
        this.drawEndTurnButton(false);

        // End Turn button text
        this.endTurnText = this.add.text(
            this.endTurnButtonBg.x + this.endTurnButtonBg.width / 2,
            this.endTurnButtonBg.y + this.endTurnButtonBg.height / 2,
            'END TURN',
            {
                fontSize: '16px',
                fontFamily: 'Courier New',
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 2
            }
        ).setOrigin(0.5);

        // Make button interactive
        this.endTurnZone = this.add.zone(
            this.endTurnButtonBg.x + this.endTurnButtonBg.width / 2,
            this.endTurnButtonBg.y + this.endTurnButtonBg.height / 2,
            this.endTurnButtonBg.width,
            this.endTurnButtonBg.height
        ).setInteractive();

        this.endTurnZone.on('pointerover', () => {
            if (this.currentPhase === 'player' && !this.isMoving) {
                this.drawEndTurnButton(true);
            }
        });

        this.endTurnZone.on('pointerout', () => {
            this.drawEndTurnButton(false);
        });

        this.endTurnZone.on('pointerdown', () => {
            if (this.currentPhase === 'player' && !this.isMoving && !this.battleOver) {
                this.endPlayerTurn();
            }
        });
    }

    drawEndTurnButton(hovered) {
        this.endTurnButton.clear();
        const { x, y, width, height } = this.endTurnButtonBg;

        // Background
        const bgColor = hovered ? 0x6a6a9a : 0x4a4a7a;
        this.endTurnButton.fillStyle(bgColor, 1);
        this.endTurnButton.fillRoundedRect(x, y, width, height, 8);

        // Border
        this.endTurnButton.lineStyle(2, 0x8a8aba, 1);
        this.endTurnButton.strokeRoundedRect(x, y, width, height, 8);
    }

    showPhaseBanner(text, color, callback) {
        const { width, height } = this.cameras.main;

        // Create banner background
        const banner = this.add.graphics();
        banner.fillStyle(0x000000, 0.7);
        banner.fillRect(0, height / 2 - 40, width, 80);

        // Create banner text
        const bannerText = this.add.text(width / 2, height / 2, text, {
            fontSize: '32px',
            fontFamily: 'Courier New',
            color: color,
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5);

        // Animate in
        banner.alpha = 0;
        bannerText.alpha = 0;

        this.tweens.add({
            targets: [banner, bannerText],
            alpha: 1,
            duration: 200,
            onComplete: () => {
                // Hold for a moment then fade out
                this.time.delayedCall(800, () => {
                    this.tweens.add({
                        targets: [banner, bannerText],
                        alpha: 0,
                        duration: 200,
                        onComplete: () => {
                            banner.destroy();
                            bannerText.destroy();
                            if (callback) callback();
                        }
                    });
                });
            }
        });
    }

    startPlayerPhase() {
        this.currentPhase = 'player';
        this.actionPoints = this.maxActionPoints;
        this.updateAPDisplay();

        this.showPhaseBanner('PLAYER PHASE', '#44aaff');

        // Update button visibility
        if (this.endTurnText) {
            this.endTurnText.setAlpha(1);
            this.drawEndTurnButton(false);
        }
    }

    endPlayerTurn() {
        if (this.currentPhase !== 'player' || this.isMoving) return;

        // Clear any hover state
        this.hoveredHex = null;
        this.currentPath = null;
        this.drawHexGrid();

        // Dim the end turn button
        if (this.endTurnText) {
            this.endTurnText.setAlpha(0.5);
        }

        // Start enemy phase
        this.startEnemyPhase();
    }

    async startEnemyPhase() {
        this.currentPhase = 'enemy';
        this.isProcessingTurn = true;

        this.showPhaseBanner('ENEMY PHASE', '#ff4444', async () => {
            // Process each enemy turn sequentially
            for (const enemy of this.enemies) {
                if (!enemy.isAlive || this.battleOver) continue;

                enemy.resetTurn();
                await enemy.executeTurn();

                // Small delay between enemies
                await this.delay(300);
            }

            this.isProcessingTurn = false;

            // Check win condition
            if (!this.battleOver) {
                this.checkWinCondition();
            }

            // Start player phase if battle not over
            if (!this.battleOver) {
                this.startPlayerPhase();
            }
        });
    }

    delay(ms) {
        return new Promise(resolve => this.time.delayedCall(ms, resolve));
    }

    checkWinCondition() {
        const allEnemiesDead = this.enemies.every(e => !e.isAlive);
        if (allEnemiesDead) {
            this.endBattle(true);
        }
    }

    endBattle(victory) {
        if (this.battleOver) return;

        this.battleOver = true;
        this.currentPhase = 'none';

        const { width, height } = this.cameras.main;

        // Darken screen
        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0.8);
        overlay.fillRect(0, 0, width, height);
        overlay.alpha = 0;

        // Result panel
        const panelWidth = 300;
        const panelHeight = 200;
        const panelX = width / 2 - panelWidth / 2;
        const panelY = height / 2 - panelHeight / 2;

        const panel = this.add.graphics();
        panel.fillStyle(victory ? 0x224422 : 0x442222, 1);
        panel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 16);
        panel.lineStyle(4, victory ? 0x44aa44 : 0xaa4444, 1);
        panel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 16);
        panel.alpha = 0;

        // Result text
        const resultText = this.add.text(
            width / 2,
            panelY + 50,
            victory ? 'VICTORY!' : 'DEFEAT',
            {
                fontSize: '36px',
                fontFamily: 'Courier New',
                color: victory ? '#44ff44' : '#ff4444',
                stroke: '#000000',
                strokeThickness: 4
            }
        ).setOrigin(0.5);
        resultText.alpha = 0;

        // Subtitle
        const subtitle = this.add.text(
            width / 2,
            panelY + 90,
            victory ? 'All enemies defeated!' : 'Your robot was destroyed...',
            {
                fontSize: '16px',
                fontFamily: 'Courier New',
                color: '#cccccc'
            }
        ).setOrigin(0.5);
        subtitle.alpha = 0;

        // Play Again button
        const buttonWidth = 150;
        const buttonHeight = 40;
        const buttonX = width / 2 - buttonWidth / 2;
        const buttonY = panelY + panelHeight - 60;

        const button = this.add.graphics();
        button.fillStyle(0x4a4a7a, 1);
        button.fillRoundedRect(buttonX, buttonY, buttonWidth, buttonHeight, 8);
        button.lineStyle(2, 0x8a8aba, 1);
        button.strokeRoundedRect(buttonX, buttonY, buttonWidth, buttonHeight, 8);
        button.alpha = 0;

        const buttonText = this.add.text(
            width / 2,
            buttonY + buttonHeight / 2,
            'PLAY AGAIN',
            {
                fontSize: '18px',
                fontFamily: 'Courier New',
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 2
            }
        ).setOrigin(0.5);
        buttonText.alpha = 0;

        // Button interaction zone
        const buttonZone = this.add.zone(
            width / 2,
            buttonY + buttonHeight / 2,
            buttonWidth,
            buttonHeight
        ).setInteractive();
        buttonZone.alpha = 0;

        buttonZone.on('pointerover', () => {
            button.clear();
            button.fillStyle(0x6a6a9a, 1);
            button.fillRoundedRect(buttonX, buttonY, buttonWidth, buttonHeight, 8);
            button.lineStyle(2, 0xaaaacc, 1);
            button.strokeRoundedRect(buttonX, buttonY, buttonWidth, buttonHeight, 8);
        });

        buttonZone.on('pointerout', () => {
            button.clear();
            button.fillStyle(0x4a4a7a, 1);
            button.fillRoundedRect(buttonX, buttonY, buttonWidth, buttonHeight, 8);
            button.lineStyle(2, 0x8a8aba, 1);
            button.strokeRoundedRect(buttonX, buttonY, buttonWidth, buttonHeight, 8);
        });

        buttonZone.on('pointerdown', () => {
            // Restart the scene
            this.scene.restart();
        });

        // Animate in
        this.tweens.add({
            targets: [overlay, panel, resultText, subtitle, button, buttonText],
            alpha: 1,
            duration: 500,
            ease: 'Power2'
        });
    }

    updateAPDisplay() {
        const apPips = '⚙'.repeat(this.actionPoints) + '○'.repeat(this.maxActionPoints - this.actionPoints);
        this.apText.setText(`Action Points: ${apPips}`);
    }

    onPointerMove(pointer) {
        // Don't update hover during movement or enemy phase
        if (this.isMoving || this.currentPhase !== 'player' || this.battleOver) return;

        const hex = this.hexGrid.pixelToHex(pointer.x, pointer.y);

        if (this.hexGrid.isValidHex(hex.q, hex.r)) {
            // Check if it's a wall - don't highlight walls
            const obstacle = this.obstacles?.find(o => o.q === hex.q && o.r === hex.r);
            if (obstacle?.type === 'wall') {
                if (this.hoveredHex) {
                    this.hoveredHex = null;
                    this.currentPath = null;
                    this.drawHexGrid();
                }
                return;
            }

            // Check if there's an enemy on this hex
            const enemyOnHex = this.enemies?.find(e =>
                e.isAlive && e.pos.q === hex.q && e.pos.r === hex.r
            );
            if (enemyOnHex) {
                // Set hovered for attack highlighting, but no path
                if (!this.hoveredHex || this.hoveredHex.q !== hex.q || this.hoveredHex.r !== hex.r) {
                    this.hoveredHex = hex;
                    this.currentPath = null;
                    this.drawHexGrid();
                }
                return;
            }

            if (!this.hoveredHex || this.hoveredHex.q !== hex.q || this.hoveredHex.r !== hex.r) {
                this.hoveredHex = hex;

                // Calculate path using A*
                // Treat walls as obstacles always
                // Treat traps as obstacles UNLESS the trap is the destination
                // Treat enemies as obstacles always
                const obstacles = this.obstacles?.filter(o => {
                    if (o.type === 'wall') return true;
                    if (o.type === 'trap') {
                        // Only treat as obstacle if NOT the destination
                        return !(o.q === hex.q && o.r === hex.r);
                    }
                    return false;
                }) || [];

                // Add enemies as obstacles
                for (const enemy of this.enemies || []) {
                    if (enemy.isAlive) {
                        obstacles.push({ q: enemy.pos.q, r: enemy.pos.r, type: 'enemy' });
                    }
                }

                this.currentPath = this.hexGrid.findPath(
                    this.playerPos.q, this.playerPos.r,
                    hex.q, hex.r,
                    obstacles
                );

                this.drawHexGrid();
            }
        } else {
            if (this.hoveredHex) {
                this.hoveredHex = null;
                this.currentPath = null;
                this.drawHexGrid();
            }
        }
    }

    onPointerDown(pointer) {
        // Don't allow clicks during movement, enemy phase, or after battle
        if (this.isMoving || this.currentPhase !== 'player' || this.battleOver) return;

        const hex = this.hexGrid.pixelToHex(pointer.x, pointer.y);

        if (!this.hexGrid.isValidHex(hex.q, hex.r)) return;

        // Check if it's a wall
        const obstacle = this.obstacles?.find(o => o.q === hex.q && o.r === hex.r);
        if (obstacle?.type === 'wall') return;

        // Check if clicking on an enemy (for attack)
        const enemyOnHex = this.enemies?.find(e =>
            e.isAlive && e.pos.q === hex.q && e.pos.r === hex.r
        );

        if (enemyOnHex) {
            // Try to attack
            this.attackEnemy(enemyOnHex);
            return;
        }

        // Must have a valid path and enough AP for movement
        if (!this.currentPath || this.currentPath.length === 0) return;
        if (this.actionPoints < this.currentPath.length) return;

        // Execute movement along the path
        this.moveAlongPath();
    }

    attackEnemy(enemy) {
        // Check if adjacent (range 1 for melee)
        const distance = this.hexGrid.getDistance(
            this.playerPos.q, this.playerPos.r,
            enemy.pos.q, enemy.pos.r
        );

        if (distance > 1) {
            // Not adjacent - show feedback
            this.showDamageText(
                this.hexGrid.hexToPixel(enemy.pos.q, enemy.pos.r).x,
                this.hexGrid.hexToPixel(enemy.pos.q, enemy.pos.r).y - 40,
                'Too far!'
            );
            return;
        }

        // Check AP cost
        if (this.actionPoints < this.playerAttackCost) {
            this.showDamageText(
                this.hexGrid.hexToPixel(enemy.pos.q, enemy.pos.r).x,
                this.hexGrid.hexToPixel(enemy.pos.q, enemy.pos.r).y - 40,
                'No AP!'
            );
            return;
        }

        // Execute attack
        this.isMoving = true;
        this.actionPoints -= this.playerAttackCost;
        this.updateAPDisplay();

        // Stop idle animation
        this.tweens.killTweensOf(this.playerRobot);

        const playerPixel = this.hexGrid.hexToPixel(this.playerPos.q, this.playerPos.r);
        const enemyPixel = this.hexGrid.hexToPixel(enemy.pos.q, enemy.pos.r);

        // Lunge toward enemy
        const lungeX = playerPixel.x + (enemyPixel.x - playerPixel.x) * 0.3;
        const lungeY = playerPixel.y + (enemyPixel.y - playerPixel.y) * 0.3;

        this.tweens.add({
            targets: this.playerRobot,
            x: lungeX,
            y: lungeY,
            duration: 100,
            yoyo: true,
            ease: 'Power2',
            onComplete: () => {
                // Deal damage to enemy
                enemy.takeDamage(this.playerDamage);

                // Return to position
                this.playerRobot.x = playerPixel.x;
                this.playerRobot.y = playerPixel.y;

                // Resume idle animation
                this.tweens.add({
                    targets: this.playerRobot,
                    y: playerPixel.y - 3,
                    duration: 1000,
                    yoyo: true,
                    repeat: -1,
                    ease: 'Sine.easeInOut'
                });

                this.isMoving = false;

                // Check win condition
                this.checkWinCondition();

                // Redraw grid
                this.drawHexGrid();
            }
        });
    }

    moveAlongPath() {
        if (!this.currentPath || this.currentPath.length === 0) return;

        this.isMoving = true;

        // Store the path and clear the visual
        const pathToFollow = [...this.currentPath];
        this.currentPath = null;
        this.hoveredHex = null;

        // Stop idle animation
        this.tweens.killTweensOf(this.playerRobot);

        // Move through each hex in sequence
        this.moveToNextHex(pathToFollow, 0);
    }

    moveToNextHex(path, index) {
        if (index >= path.length) {
            // Movement complete
            this.isMoving = false;

            // Resume idle animation
            const finalPos = this.hexGrid.hexToPixel(this.playerPos.q, this.playerPos.r);
            this.tweens.add({
                targets: this.playerRobot,
                y: finalPos.y - 3,
                duration: 1000,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });

            this.drawHexGrid();
            return;
        }

        const nextHex = path[index];
        const nextPos = this.hexGrid.hexToPixel(nextHex.q, nextHex.r);

        // Update player position and AP
        this.playerPos = { q: nextHex.q, r: nextHex.r };
        this.actionPoints -= 1;
        this.updateAPDisplay();
        this.drawHexGrid();

        // Animate to next hex
        this.tweens.add({
            targets: this.playerRobot,
            x: nextPos.x,
            y: nextPos.y,
            duration: 150,
            ease: 'Power2',
            onComplete: () => {
                // Check for trap at this hex
                const obstacle = this.obstacles?.find(o =>
                    o.q === nextHex.q && o.r === nextHex.r
                );

                if (obstacle?.type === 'trap') {
                    this.damagePlayer(1);
                    this.showDamageText(nextPos.x, nextPos.y - 30, '-1');
                }

                // Move to next hex in path
                this.moveToNextHex(path, index + 1);
            }
        });
    }

    showDamageText(x, y, text) {
        const dmgText = this.add.text(x, y, text, {
            fontSize: '18px',
            fontFamily: 'Courier New',
            color: '#ff4444',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0.5);

        this.tweens.add({
            targets: dmgText,
            y: y - 30,
            alpha: 0,
            duration: 800,
            ease: 'Power2',
            onComplete: () => dmgText.destroy()
        });
    }
}
