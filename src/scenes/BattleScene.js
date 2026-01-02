/**
 * BattleScene - Main battle arena with hex grid
 */
class BattleScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BattleScene' });

        this.hexGrid = null;
        this.playerRobot = null;
        this.hexGraphics = null;
        this.hoveredHex = null;
        this.selectedHex = null;

        // Player robot position (axial coordinates)
        this.playerPos = { q: 0, r: 0 };

        // Action points
        this.actionPoints = 3;
        this.maxActionPoints = 3;
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

        // Add some example obstacles
        this.obstacles = [
            { q: 2, r: -1, type: 'wall' },
            { q: -2, r: 2, type: 'wall' },
            { q: 1, r: 2, type: 'trap' },
            { q: -1, r: -2, type: 'trap' }
        ];

        // Redraw with obstacles
        this.drawHexGrid();
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

            // Highlight hovered hex
            if (this.hoveredHex && this.hoveredHex.q === hex.q && this.hoveredHex.r === hex.r) {
                fillColor = 0x4a6a8a;
                fillAlpha = 0.8;
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

        // Action Points display
        this.apText = this.add.text(20, 20, '', {
            fontSize: '20px',
            fontFamily: 'Courier New',
            color: '#ffcc00',
            stroke: '#000000',
            strokeThickness: 3
        });
        this.updateAPDisplay();

        // Instructions
        this.add.text(20, height - 40, 'Click a hex to move (costs 1 AP) | SPACE to reset AP', {
            fontSize: '14px',
            fontFamily: 'Courier New',
            color: '#aaaaaa'
        });

        // Title
        this.add.text(width / 2, 25, 'COG & SALVAGE', {
            fontSize: '28px',
            fontFamily: 'Courier New',
            color: '#ffcc00',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5);

        // Reset AP on spacebar
        this.input.keyboard.on('keydown-SPACE', () => {
            this.actionPoints = this.maxActionPoints;
            this.updateAPDisplay();
        });
    }

    updateAPDisplay() {
        const apPips = '⚙'.repeat(this.actionPoints) + '○'.repeat(this.maxActionPoints - this.actionPoints);
        this.apText.setText(`Action Points: ${apPips}`);
    }

    onPointerMove(pointer) {
        const hex = this.hexGrid.pixelToHex(pointer.x, pointer.y);

        if (this.hexGrid.isValidHex(hex.q, hex.r)) {
            if (!this.hoveredHex || this.hoveredHex.q !== hex.q || this.hoveredHex.r !== hex.r) {
                this.hoveredHex = hex;
                this.drawHexGrid();
            }
        } else {
            if (this.hoveredHex) {
                this.hoveredHex = null;
                this.drawHexGrid();
            }
        }
    }

    onPointerDown(pointer) {
        const hex = this.hexGrid.pixelToHex(pointer.x, pointer.y);

        if (!this.hexGrid.isValidHex(hex.q, hex.r)) return;

        // Check if it's an obstacle
        const obstacle = this.obstacles?.find(o => o.q === hex.q && o.r === hex.r);
        if (obstacle?.type === 'wall') return; // Can't move to walls

        // Check if adjacent and have AP
        const distance = this.hexGrid.getDistance(
            this.playerPos.q, this.playerPos.r,
            hex.q, hex.r
        );

        if (distance === 1 && this.actionPoints > 0) {
            this.movePlayerTo(hex.q, hex.r);
        } else if (distance > 1 && this.actionPoints >= distance) {
            // Allow moving multiple hexes if you have enough AP
            this.movePlayerTo(hex.q, hex.r, distance);
        }
    }

    movePlayerTo(q, r, cost = 1) {
        // Check for trap
        const obstacle = this.obstacles?.find(o => o.q === q && o.r === r);

        this.playerPos = { q, r };
        this.actionPoints -= cost;
        this.updateAPDisplay();

        const newPos = this.hexGrid.hexToPixel(q, r);

        // Stop current animation and move
        this.tweens.killTweensOf(this.playerRobot);

        this.tweens.add({
            targets: this.playerRobot,
            x: newPos.x,
            y: newPos.y,
            duration: 200 * cost,
            ease: 'Power2',
            onComplete: () => {
                // Resume idle animation
                this.tweens.add({
                    targets: this.playerRobot,
                    y: newPos.y - 3,
                    duration: 1000,
                    yoyo: true,
                    repeat: -1,
                    ease: 'Sine.easeInOut'
                });

                // Trap damage effect
                if (obstacle?.type === 'trap') {
                    this.cameras.main.shake(100, 0.01);
                    this.showDamageText(newPos.x, newPos.y - 30, '-1 HP');
                }
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
