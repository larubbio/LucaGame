/**
 * Cog & Salvage - Main Game Configuration
 * A steampunk robot battler roguelike
 */

const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    width: 900,
    height: 700,
    backgroundColor: '#1a1a2e',
    scene: [BattleScene],
    pixelArt: true, // Enable pixel art mode (no anti-aliasing)
    roundPixels: true,
    physics: {
        default: 'arcade',
        arcade: {
            debug: false
        }
    },
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    }
};

// Create the game instance
const game = new Phaser.Game(config);

// Log startup
console.log('🤖 Cog & Salvage initialized!');
console.log('⚙️ Steampunk Robot Battler');
