import Phaser from 'phaser';
import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';

// Game configuration optimized for 60fps on iPad
const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent: 'game-container',
    width: 1024,
    height: 768,
    backgroundColor: '#1a1a2e',
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        min: {
            width: 320,
            height: 240
        },
        max: {
            width: 1920,
            height: 1080
        }
    },
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { x: 0, y: 0 },
            debug: false
        }
    },
    render: {
        antialias: true,
        pixelArt: false,
        roundPixels: true
    },
    fps: {
        target: 60,
        forceSetTimeOut: false
    },
    input: {
        activePointers: 3,
        touch: {
            capture: true
        }
    },
    scene: [MenuScene, GameScene]
};

// Start the game
const game = new Phaser.Game(config);

// Handle window resize
window.addEventListener('resize', () => {
    game.scale.refresh();
});

// Export for debugging
(window as typeof window & { game: Phaser.Game }).game = game;
