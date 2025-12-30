import Phaser from 'phaser';
import { AudioSynth, MusicGenerator } from '../music';

export class MenuScene extends Phaser.Scene {
    private synth: AudioSynth | null = null;
    private midiGenerator: MusicGenerator | null = null;
    private hasMidi: boolean = false;
    
    constructor() {
        super({ key: 'MenuScene' });
    }
    
    create(): void {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // Create gradient background
        const graphics = this.add.graphics();
        this.createGradientBackground(graphics, width, height, 0x667eea, 0x764ba2);
        
        // Title with glow effect
        const title = this.add.text(width / 2, height * 0.3, 'WAVE RUNNER', {
            fontFamily: 'Arial Black, sans-serif',
            fontSize: Math.min(width / 8, 72) + 'px',
            color: '#ffffff',
            stroke: '#ff6b6b',
            strokeThickness: 8,
            shadow: {
                offsetX: 4,
                offsetY: 4,
                color: '#000000',
                blur: 10,
                fill: true
            }
        }).setOrigin(0.5);
        
        // Animate title
        this.tweens.add({
            targets: title,
            y: height * 0.3 - 10,
            duration: 1000,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1
        });
        
        // Play button - big and friendly for kids
        const buttonWidth = Math.min(width * 0.5, 300);
        const buttonHeight = Math.min(height * 0.15, 100);
        
        const buttonBg = this.add.graphics();
        this.createRoundedRect(buttonBg, width / 2 - buttonWidth / 2, height * 0.55, buttonWidth, buttonHeight, 20, 0x4CAF50);
        
        const playText = this.add.text(width / 2, height * 0.55 + buttonHeight / 2, 'PLAY', {
            fontFamily: 'Arial Black, sans-serif',
            fontSize: Math.min(buttonHeight * 0.5, 48) + 'px',
            color: '#ffffff',
            stroke: '#2E7D32',
            strokeThickness: 4
        }).setOrigin(0.5);
        
        // Create interactive zone for button
        const buttonZone = this.add.zone(width / 2, height * 0.55 + buttonHeight / 2, buttonWidth, buttonHeight)
            .setInteractive({ useHandCursor: true });
        
        // Button hover effects
        buttonZone.on('pointerover', () => {
            buttonBg.clear();
            this.createRoundedRect(buttonBg, width / 2 - buttonWidth / 2, height * 0.55, buttonWidth, buttonHeight, 20, 0x66BB6A);
            playText.setScale(1.1);
        });
        
        buttonZone.on('pointerout', () => {
            buttonBg.clear();
            this.createRoundedRect(buttonBg, width / 2 - buttonWidth / 2, height * 0.55, buttonWidth, buttonHeight, 20, 0x4CAF50);
            playText.setScale(1);
        });
        
        buttonZone.on('pointerdown', () => {
            this.startGame();
        });
        
        // Keyboard support
        this.input.keyboard?.on('keydown-SPACE', () => {
            this.startGame();
        });
        
        this.input.keyboard?.on('keydown-ENTER', () => {
            this.startGame();
        });
        
        // Decorative floating shapes
        this.createFloatingShapes();
        
        // Instructions
        const instructionText = this.add.text(width / 2, height * 0.85, 'Press SPACE or tap to play!', {
            fontFamily: 'Arial, sans-serif',
            fontSize: Math.min(width / 25, 24) + 'px',
            color: '#ffffff'
        }).setOrigin(0.5).setAlpha(0.8);
        
        this.tweens.add({
            targets: instructionText,
            alpha: 0.4,
            duration: 800,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1
        });
        
        // Initialize audio
        this.initAudio();
    }
    
    private async initAudio(): Promise<void> {
        // Try MIDI first
        this.midiGenerator = new MusicGenerator();
        this.hasMidi = await this.midiGenerator.init();
        
        if (!this.hasMidi) {
            // Fall back to Web Audio
            this.synth = new AudioSynth();
            this.synth.init();
        }
    }
    
    private startGame(): void {
        // Start music
        if (this.hasMidi && this.midiGenerator) {
            this.midiGenerator.play();
        } else if (this.synth) {
            this.synth.play();
        }
        
        this.scene.start('GameScene', { 
            level: 1,
            synth: this.synth,
            midiGenerator: this.midiGenerator,
            hasMidi: this.hasMidi
        });
    }
    
    private createGradientBackground(graphics: Phaser.GameObjects.Graphics, width: number, height: number, color1: number, color2: number): void {
        const steps = 50;
        for (let i = 0; i < steps; i++) {
            const ratio = i / steps;
            const color = Phaser.Display.Color.Interpolate.ColorWithColor(
                Phaser.Display.Color.IntegerToColor(color1),
                Phaser.Display.Color.IntegerToColor(color2),
                steps,
                i
            );
            graphics.fillStyle(Phaser.Display.Color.GetColor(color.r, color.g, color.b));
            graphics.fillRect(0, (height / steps) * i, width, height / steps + 1);
        }
    }
    
    private createRoundedRect(graphics: Phaser.GameObjects.Graphics, x: number, y: number, width: number, height: number, radius: number, color: number): void {
        graphics.fillStyle(color);
        graphics.fillRoundedRect(x, y, width, height, radius);
        graphics.lineStyle(4, 0xffffff, 0.5);
        graphics.strokeRoundedRect(x, y, width, height, radius);
    }
    
    private createFloatingShapes(): void {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        const colors = [0xffd93d, 0xff6b6b, 0x00cec9, 0x6c5ce7, 0xfd79a8];
        
        for (let i = 0; i < 15; i++) {
            const x = Math.random() * width;
            const y = Math.random() * height;
            const size = 10 + Math.random() * 30;
            const color = colors[Math.floor(Math.random() * colors.length)] ?? 0xffd93d;
            
            const shape = this.add.graphics();
            shape.fillStyle(color, 0.3);
            
            if (Math.random() > 0.5) {
                shape.fillCircle(x, y, size);
            } else {
                shape.fillRect(x - size / 2, y - size / 2, size, size);
            }
            
            this.tweens.add({
                targets: shape,
                y: '+=' + (30 + Math.random() * 30),
                x: '+=' + (Math.random() * 20 - 10),
                duration: 2000 + Math.random() * 2000,
                ease: 'Sine.easeInOut',
                yoyo: true,
                repeat: -1
            });
        }
    }
}
