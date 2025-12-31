import Phaser from 'phaser';
import { levels, LevelConfig } from '../levels';
import { AudioSynth, MusicGenerator } from '../music';

interface GameSceneData {
    level: number;
    synth: AudioSynth | null;
    midiGenerator: MusicGenerator | null;
    hasMidi: boolean;
}

export class GameScene extends Phaser.Scene {
    private player!: Phaser.GameObjects.Graphics;
    private obstacles: Phaser.GameObjects.Graphics[] = [];
    private currentLevel!: LevelConfig;
    private levelIndex: number = 0;
    private isHolding: boolean = false;
    private isDead: boolean = false;
    private worldX: number = 0;
    private ground!: Phaser.GameObjects.Graphics;
    private ceiling!: Phaser.GameObjects.Graphics;
    private synth: AudioSynth | null = null;
    private midiGenerator: MusicGenerator | null = null;
    private hasMidi: boolean = false;
    private levelText!: Phaser.GameObjects.Text;
    private particles: Phaser.GameObjects.Graphics[] = [];
    private bgGraphics!: Phaser.GameObjects.Graphics;
    private playableTop: number = 0;
    private playableHeight: number = 0;
    
    constructor() {
        super({ key: 'GameScene' });
    }
    
    init(data: GameSceneData): void {
        this.levelIndex = data.level - 1;
        this.synth = data.synth;
        this.midiGenerator = data.midiGenerator;
        this.hasMidi = data.hasMidi;
        this.isDead = false;
        this.isHolding = false;
        this.worldX = 0;
        this.obstacles = [];
        this.particles = [];
    }
    
    create(): void {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // Get current level
        const level = levels[this.levelIndex];
        if (!level) {
            // All levels completed - go back to menu
            this.scene.start('MenuScene');
            return;
        }
        this.currentLevel = level;
        
        // Update music tempo
        if (this.hasMidi && this.midiGenerator) {
            this.midiGenerator.setTempo(this.currentLevel.musicTempo);
        } else if (this.synth) {
            this.synth.setTempo(this.currentLevel.musicTempo);
        }
        
        // Set playable area (leave room for UI and ground)
        const groundHeight = 50;
        const topMargin = 60;
        this.playableTop = topMargin;
        this.playableHeight = height - topMargin - groundHeight;
        
        // Create gradient background
        this.bgGraphics = this.add.graphics();
        this.createGradientBackground(this.bgGraphics, width, height, this.currentLevel.bgColor1, this.currentLevel.bgColor2);
        
        // Create ground (for gravity mode) or boundaries (for wave mode)
        this.createBoundaries(width, height, groundHeight);
        
        // Create player
        this.createPlayer(width, height, groundHeight);
        
        // Create obstacles
        this.createObstacles();
        
        // Level indicator
        this.levelText = this.add.text(width / 2, 30, `Level ${this.currentLevel.id}`, {
            fontFamily: 'Arial Black, sans-serif',
            fontSize: '28px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5).setScrollFactor(0).setDepth(100);
        
        // Setup controls
        this.setupControls();
        
        // Camera follows player
        this.cameras.main.startFollow(this.player, true, 0.1, 0);
        this.cameras.main.setDeadzone(width * 0.3, height);
    }
    
    update(time: number, delta: number): void {
        if (this.isDead) return;
        
        const level = this.currentLevel;
        
        // Move world
        this.worldX += level.speed * (delta / 1000);
        
        // Update player physics based on game mode
        if (level.mode === 'gravity') {
            this.updateGravityMode(delta);
        } else {
            this.updateWaveMode(delta);
        }
        
        // Update player position (offset from left edge for better obstacle visibility)
        this.player.x = this.worldX + 200;
        
        // Check collisions
        this.checkCollisions();
        
        // Check level completion
        if (this.worldX > level.length) {
            this.completeLevel();
        }
        
        // Create trail particles
        this.createTrailParticle();
        this.updateParticles(delta);
    }
    
    private createGradientBackground(graphics: Phaser.GameObjects.Graphics, width: number, height: number, color1: number, color2: number): void {
        const steps = 50;
        for (let i = 0; i < steps; i++) {
            const color = Phaser.Display.Color.Interpolate.ColorWithColor(
                Phaser.Display.Color.IntegerToColor(color1),
                Phaser.Display.Color.IntegerToColor(color2),
                steps,
                i
            );
            graphics.fillStyle(Phaser.Display.Color.GetColor(color.r, color.g, color.b));
            graphics.fillRect(0, (height / steps) * i, width * 100, height / steps + 1); // Wide for scrolling
        }
    }
    
    private createBoundaries(width: number, height: number, groundHeight: number): void {
        const level = this.currentLevel;
        
        // Ground with jump window coloring
        this.ground = this.add.graphics();
        
        // Create colored ground segments based on jump windows
        this.createJumpWindowFloor(this.ground, height, groundHeight, level);
        
        // Ceiling (for wave mode)
        this.ceiling = this.add.graphics();
        this.ceiling.fillStyle(level.obstacleColor, 1);
        this.ceiling.fillRect(0, 0, level.length + width, this.playableTop);
    }
    
    private createJumpWindowFloor(
        graphics: Phaser.GameObjects.Graphics,
        height: number,
        groundHeight: number,
        level: LevelConfig
    ): void {
        const groundY = height - groundHeight;
        const totalWidth = level.length + 1024;
        
        // Define colors for different zones
        const normalColor = level.obstacleColor;
        const tapJumpColor = 0x00ff88;   // Bright green for tap jumps
        const holdJumpColor = 0xff8800;  // Orange for held jumps
        
        // Sort jump windows by startX
        const windows = [...level.jumpWindows].sort((a, b) => a.startX - b.startX);
        
        // Draw ground segments
        let currentX = 0;
        
        for (const window of windows) {
            // Draw normal ground up to this jump window
            if (currentX < window.startX) {
                graphics.fillStyle(normalColor, 1);
                graphics.fillRect(currentX, groundY, window.startX - currentX, groundHeight);
                
                // Add subtle decorative lines
                graphics.lineStyle(2, 0xffffff, 0.15);
                for (let x = currentX; x < window.startX; x += 40) {
                    graphics.lineBetween(x, groundY, x + 20, height);
                }
            }
            
            // Draw the jump window zone
            const jumpColor = window.type === 'hold' ? holdJumpColor : tapJumpColor;
            const windowWidth = window.endX - window.startX;
            
            // Main colored zone
            graphics.fillStyle(jumpColor, 0.7);
            graphics.fillRect(window.startX, groundY, windowWidth, groundHeight);
            
            // Add glow effect at top of jump zone
            graphics.fillStyle(jumpColor, 0.3);
            graphics.fillRect(window.startX, groundY - 8, windowWidth, 8);
            
            // Add pulsing markers/chevrons in the jump zone
            graphics.lineStyle(3, 0xffffff, 0.6);
            const chevronSpacing = 25;
            const chevronHeight = 12;
            for (let x = window.startX + 10; x < window.endX - 10; x += chevronSpacing) {
                // Draw upward-pointing chevron (^) to indicate "jump here"
                graphics.beginPath();
                graphics.moveTo(x, groundY + chevronHeight + 5);
                graphics.lineTo(x + 8, groundY + 5);
                graphics.lineTo(x + 16, groundY + chevronHeight + 5);
                graphics.strokePath();
            }
            
            // For held jumps, add additional indicator (double chevron or bar)
            if (window.type === 'hold') {
                graphics.lineStyle(2, 0xffffff, 0.5);
                for (let x = window.startX + 10; x < window.endX - 10; x += chevronSpacing) {
                    // Second chevron below
                    graphics.beginPath();
                    graphics.moveTo(x, groundY + chevronHeight + 15);
                    graphics.lineTo(x + 8, groundY + 15);
                    graphics.lineTo(x + 16, groundY + chevronHeight + 15);
                    graphics.strokePath();
                }
                
                // Add a "HOLD" indicator bar at the bottom
                graphics.fillStyle(0xffffff, 0.4);
                graphics.fillRect(window.startX + 5, height - 10, windowWidth - 10, 6);
            }
            
            // Border around jump zone
            graphics.lineStyle(2, 0xffffff, 0.4);
            graphics.strokeRect(window.startX, groundY, windowWidth, groundHeight);
            
            currentX = window.endX;
        }
        
        // Draw remaining ground after last jump window
        if (currentX < totalWidth) {
            graphics.fillStyle(normalColor, 1);
            graphics.fillRect(currentX, groundY, totalWidth - currentX, groundHeight);
            
            graphics.lineStyle(2, 0xffffff, 0.15);
            for (let x = currentX; x < totalWidth; x += 40) {
                graphics.lineBetween(x, groundY, x + 20, height);
            }
        }
    }
    
    private createPlayer(width: number, height: number, groundHeight: number): void {
        const level = this.currentLevel;
        const playerSize = 40;
        
        // Create player graphics
        this.player = this.add.graphics();
        this.player.fillStyle(level.playerColor, 1);
        this.player.lineStyle(3, 0xffffff, 0.8);
        
        // Draw player shape (cube with rounded corners)
        this.player.fillRoundedRect(-playerSize / 2, -playerSize / 2, playerSize, playerSize, 8);
        this.player.strokeRoundedRect(-playerSize / 2, -playerSize / 2, playerSize, playerSize, 8);
        
        // Add inner glow
        this.player.fillStyle(0xffffff, 0.3);
        this.player.fillRoundedRect(-playerSize / 4, -playerSize / 4, playerSize / 2, playerSize / 2, 4);
        
        // Position player
        this.player.x = 100;
        
        if (level.mode === 'gravity') {
            this.player.y = height - groundHeight - playerSize / 2;
        } else {
            this.player.y = height / 2;
        }
        
        // Store physics data on player object
        (this.player as Phaser.GameObjects.Graphics & { velocityY: number }).velocityY = 0;
    }
    
    private createObstacles(): void {
        const level = this.currentLevel;
        const height = this.cameras.main.height;
        const groundHeight = 50;
        
        for (const obstacle of level.obstacles) {
            const graphics = this.add.graphics();
            
            // Calculate actual position
            let obsY: number;
            let obsHeight: number;
            
            if (level.mode === 'gravity') {
                // For gravity mode, y=1 means ground level
                obsHeight = obstacle.height;
                obsY = height - groundHeight - obsHeight;
            } else {
                // For wave mode, y is percentage of playable area
                obsY = this.playableTop + obstacle.y * this.playableHeight;
                obsHeight = obstacle.height * this.playableHeight;
            }
            
            // Draw obstacle based on type
            if (obstacle.type === 'spike') {
                // Draw triangle spike
                graphics.fillStyle(level.obstacleColor, 1);
                graphics.lineStyle(2, 0xffffff, 0.5);
                graphics.beginPath();
                graphics.moveTo(obstacle.x, obsY + obsHeight);
                graphics.lineTo(obstacle.x + obstacle.width / 2, obsY);
                graphics.lineTo(obstacle.x + obstacle.width, obsY + obsHeight);
                graphics.closePath();
                graphics.fillPath();
                graphics.strokePath();
            } else if (obstacle.type === 'block') {
                graphics.fillStyle(level.obstacleColor, 1);
                graphics.lineStyle(2, 0xffffff, 0.5);
                graphics.fillRect(obstacle.x, obsY, obstacle.width, obsHeight);
                graphics.strokeRect(obstacle.x, obsY, obstacle.width, obsHeight);
                
                // Add decorative lines
                graphics.lineStyle(1, 0xffffff, 0.2);
                for (let i = 0; i < obsHeight; i += 15) {
                    graphics.lineBetween(obstacle.x, obsY + i, obstacle.x + obstacle.width, obsY + i);
                }
            } else if (obstacle.type === 'gap') {
                // Gap is an absence - draw pit markers on ground
                graphics.fillStyle(0x000000, 0.5);
                graphics.fillRect(obstacle.x, height - groundHeight, obstacle.width, groundHeight);
                
                // Add visual warning markers above the gap to indicate danger
                // Draw hazard stripes above the gap entrance
                graphics.lineStyle(3, 0xff0000, 0.8);
                graphics.fillStyle(0xff0000, 0.3);
                
                // Left edge warning
                graphics.fillRect(obstacle.x - 5, height - groundHeight - 80, 10, 80);
                graphics.beginPath();
                graphics.moveTo(obstacle.x - 15, height - groundHeight - 80);
                graphics.lineTo(obstacle.x + 5, height - groundHeight - 60);
                graphics.lineTo(obstacle.x + 5, height - groundHeight - 100);
                graphics.closePath();
                graphics.fillPath();
                graphics.strokePath();
                
                // Right edge warning
                graphics.fillRect(obstacle.x + obstacle.width - 5, height - groundHeight - 80, 10, 80);
                graphics.beginPath();
                graphics.moveTo(obstacle.x + obstacle.width + 15, height - groundHeight - 80);
                graphics.lineTo(obstacle.x + obstacle.width - 5, height - groundHeight - 60);
                graphics.lineTo(obstacle.x + obstacle.width - 5, height - groundHeight - 100);
                graphics.closePath();
                graphics.fillPath();
                graphics.strokePath();
                
                // Draw hazard stripes across the gap
                graphics.lineStyle(2, 0xffff00, 0.7);
                for (let i = 0; i < obstacle.width; i += 20) {
                    graphics.beginPath();
                    graphics.moveTo(obstacle.x + i, height - groundHeight - 10);
                    graphics.lineTo(obstacle.x + i + 10, height - groundHeight - 30);
                    graphics.strokePath();
                }
            }
            
            this.obstacles.push(graphics);
            
            // Store obstacle data for collision checking
            (graphics as Phaser.GameObjects.Graphics & { obstacleData: { x: number; y: number; width: number; height: number; type: string } }).obstacleData = {
                x: obstacle.x,
                y: obsY,
                width: obstacle.width,
                height: obsHeight,
                type: obstacle.type
            };
        }
    }
    
    private setupControls(): void {
        // Keyboard controls
        this.input.keyboard?.on('keydown-SPACE', () => {
            this.isHolding = true;
        });
        
        this.input.keyboard?.on('keyup-SPACE', () => {
            this.isHolding = false;
        });
        
        // Touch/mouse controls
        this.input.on('pointerdown', () => {
            this.isHolding = true;
        });
        
        this.input.on('pointerup', () => {
            this.isHolding = false;
        });
    }
    
    private updateGravityMode(delta: number): void {
        const level = this.currentLevel;
        const height = this.cameras.main.height;
        const groundHeight = 50;
        const groundY = height - groundHeight - 20; // Player bottom should be at ground
        
        const playerData = this.player as Phaser.GameObjects.Graphics & { velocityY: number };
        
        // Apply gravity
        playerData.velocityY += level.gravity * (delta / 1000);
        
        // Jump when holding and on ground
        if (this.isHolding && this.player.y >= groundY - 5) {
            playerData.velocityY = level.jumpForce;
        }
        
        // Apply velocity
        this.player.y += playerData.velocityY * (delta / 1000);
        
        // Ground collision
        if (this.player.y > groundY) {
            this.player.y = groundY;
            playerData.velocityY = 0;
        }
        
        // Ceiling collision
        if (this.player.y < this.playableTop + 20) {
            this.player.y = this.playableTop + 20;
            playerData.velocityY = 0;
        }
        
        // Rotate player based on velocity
        this.player.rotation = playerData.velocityY * 0.002;
    }
    
    private updateWaveMode(delta: number): void {
        const level = this.currentLevel;
        const height = this.cameras.main.height;
        const groundHeight = 50;
        
        const playerData = this.player as Phaser.GameObjects.Graphics & { velocityY: number };
        
        // Wave mode: hold to go up, release to go down
        const flySpeed = 300;
        
        if (this.isHolding) {
            playerData.velocityY = level.jumpForce; // Negative = up
        } else {
            playerData.velocityY = flySpeed; // Positive = down
        }
        
        // Apply velocity
        this.player.y += playerData.velocityY * (delta / 1000);
        
        // Boundary checks with forgiving margins
        const topBound = this.playableTop + 20;
        const bottomBound = height - groundHeight - 20;
        
        if (this.player.y < topBound) {
            this.player.y = topBound;
        }
        if (this.player.y > bottomBound) {
            this.player.y = bottomBound;
        }
        
        // Slight rotation based on velocity direction
        const targetRotation = this.isHolding ? -0.3 : 0.3;
        this.player.rotation = Phaser.Math.Linear(this.player.rotation, targetRotation, 0.1);
    }
    
    private checkCollisions(): void {
        const playerSize = 32; // Slightly smaller hitbox for forgiving gameplay
        const playerX = this.player.x;
        const playerY = this.player.y;
        
        for (const obstacle of this.obstacles) {
            const data = (obstacle as Phaser.GameObjects.Graphics & { obstacleData: { x: number; y: number; width: number; height: number; type: string } }).obstacleData;
            if (!data) continue;
            
            // Skip gaps for collision (they're just visual)
            if (data.type === 'gap') {
                // For gaps, check if player fell into the pit
                if (this.currentLevel.mode === 'gravity') {
                    const height = this.cameras.main.height;
                    const groundHeight = 50;
                    if (playerX > data.x && playerX < data.x + data.width && playerY > height - groundHeight - 10) {
                        this.die();
                        return;
                    }
                }
                continue;
            }
            
            // AABB collision with forgiving hitbox
            const collision = this.checkAABB(
                playerX - playerSize / 2,
                playerY - playerSize / 2,
                playerSize,
                playerSize,
                data.x,
                data.y,
                data.width,
                data.height
            );
            
            if (collision) {
                this.die();
                return;
            }
        }
        
        // Check ceiling/ground collision for wave mode
        if (this.currentLevel.mode === 'wave') {
            const height = this.cameras.main.height;
            const groundHeight = 50;
            
            if (playerY <= this.playableTop + 5 || playerY >= height - groundHeight - 5) {
                // Don't die on boundaries in wave mode - just constrain
            }
        }
    }
    
    private checkAABB(x1: number, y1: number, w1: number, h1: number, x2: number, y2: number, w2: number, h2: number): boolean {
        return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2;
    }
    
    private die(): void {
        if (this.isDead) return;
        this.isDead = true;
        
        // Death effect
        this.cameras.main.shake(300, 0.02);
        this.cameras.main.flash(200, 255, 100, 100);
        
        // Explosion particles
        this.createDeathParticles();
        
        // Hide player
        this.player.visible = false;
        
        // Restart level after delay
        this.time.delayedCall(1000, () => {
            this.scene.restart({
                level: this.levelIndex + 1,
                synth: this.synth,
                midiGenerator: this.midiGenerator,
                hasMidi: this.hasMidi
            });
        });
    }
    
    private createDeathParticles(): void {
        const colors = [this.currentLevel.playerColor, 0xffffff, 0xffff00, 0xff6600];
        
        for (let i = 0; i < 20; i++) {
            const particle = this.add.graphics();
            const color = colors[Math.floor(Math.random() * colors.length)] ?? 0xffffff;
            const size = 5 + Math.random() * 10;
            
            particle.fillStyle(color, 1);
            particle.fillCircle(0, 0, size);
            
            particle.x = this.player.x;
            particle.y = this.player.y;
            
            const angle = Math.random() * Math.PI * 2;
            const speed = 100 + Math.random() * 200;
            
            this.tweens.add({
                targets: particle,
                x: particle.x + Math.cos(angle) * speed,
                y: particle.y + Math.sin(angle) * speed,
                alpha: 0,
                scale: 0.1,
                duration: 500 + Math.random() * 500,
                ease: 'Power2',
                onComplete: () => particle.destroy()
            });
        }
    }
    
    private createTrailParticle(): void {
        if (this.isDead) return;
        if (Math.random() > 0.3) return; // Only create some particles
        
        const particle = this.add.graphics();
        const color = this.currentLevel.playerColor;
        const size = 3 + Math.random() * 5;
        
        particle.fillStyle(color, 0.6);
        particle.fillCircle(0, 0, size);
        
        particle.x = this.player.x - 20 + Math.random() * 10;
        particle.y = this.player.y + Math.random() * 10 - 5;
        (particle as Phaser.GameObjects.Graphics & { life: number }).life = 0;
        
        this.particles.push(particle);
    }
    
    private updateParticles(delta: number): void {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const particle = this.particles[i];
            if (!particle) continue;
            
            const particleData = particle as Phaser.GameObjects.Graphics & { life: number };
            particleData.life += delta / 1000;
            particle.alpha = Math.max(0, 1 - particleData.life * 2);
            particle.scale = Math.max(0.1, 1 - particleData.life);
            
            if (particleData.life > 0.5) {
                particle.destroy();
                this.particles.splice(i, 1);
            }
        }
    }
    
    private completeLevel(): void {
        // Stop current level
        this.isDead = true;
        
        // Victory effect
        this.cameras.main.flash(500, 100, 255, 100);
        
        // Show completion message
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        const completeText = this.add.text(width / 2, height / 2, 'LEVEL COMPLETE!', {
            fontFamily: 'Arial Black, sans-serif',
            fontSize: '48px',
            color: '#ffffff',
            stroke: '#4CAF50',
            strokeThickness: 8
        }).setOrigin(0.5).setScrollFactor(0).setDepth(200);
        
        this.tweens.add({
            targets: completeText,
            scale: 1.2,
            duration: 500,
            yoyo: true,
            repeat: 2
        });
        
        // Move to next level
        this.time.delayedCall(2000, () => {
            if (this.levelIndex + 1 >= levels.length) {
                // All levels complete!
                this.showVictoryScreen();
            } else {
                this.scene.restart({
                    level: this.levelIndex + 2,
                    synth: this.synth,
                    midiGenerator: this.midiGenerator,
                    hasMidi: this.hasMidi
                });
            }
        });
    }
    
    private showVictoryScreen(): void {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // Clear scene
        this.children.removeAll();
        
        // Victory background
        const bg = this.add.graphics();
        this.createGradientBackground(bg, width, height, 0xffd700, 0xff8c00);
        
        // Victory text
        const victoryText = this.add.text(width / 2, height * 0.3, '🎉 YOU WIN! 🎉', {
            fontFamily: 'Arial Black, sans-serif',
            fontSize: '64px',
            color: '#ffffff',
            stroke: '#ff6b6b',
            strokeThickness: 8
        }).setOrigin(0.5);
        
        this.tweens.add({
            targets: victoryText,
            scale: 1.1,
            duration: 500,
            yoyo: true,
            repeat: -1
        });
        
        const subText = this.add.text(width / 2, height * 0.5, 'All 15 levels completed!', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '32px',
            color: '#ffffff'
        }).setOrigin(0.5);
        
        // Play again button
        const buttonWidth = 250;
        const buttonHeight = 80;
        
        const buttonBg = this.add.graphics();
        buttonBg.fillStyle(0x4CAF50);
        buttonBg.fillRoundedRect(width / 2 - buttonWidth / 2, height * 0.65, buttonWidth, buttonHeight, 15);
        
        const playAgainText = this.add.text(width / 2, height * 0.65 + buttonHeight / 2, 'PLAY AGAIN', {
            fontFamily: 'Arial Black, sans-serif',
            fontSize: '28px',
            color: '#ffffff'
        }).setOrigin(0.5);
        
        const buttonZone = this.add.zone(width / 2, height * 0.65 + buttonHeight / 2, buttonWidth, buttonHeight)
            .setInteractive({ useHandCursor: true });
        
        buttonZone.on('pointerdown', () => {
            this.scene.start('MenuScene');
        });
        
        this.input.keyboard?.on('keydown-SPACE', () => {
            this.scene.start('MenuScene');
        });
    }
}
