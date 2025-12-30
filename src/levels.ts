// Level data configuration
// Each level has obstacles, game mode (gravity or wave), and settings

export interface Obstacle {
    x: number;          // X position (in world coordinates)
    y: number;          // Y position (as percentage of playable height, 0-1)
    width: number;      // Width of obstacle
    height: number;     // Height of obstacle
    type: 'spike' | 'block' | 'gap' | 'moving';
    moveSpeed?: number; // For moving obstacles
    moveRange?: number; // For moving obstacles
}

export interface LevelConfig {
    id: number;
    name: string;
    mode: 'gravity' | 'wave';      // Gravity = Geometry Dash style, Wave = flappy bird linear flight
    speed: number;                  // Scroll speed
    gravity: number;                // Gravity strength (for gravity mode)
    jumpForce: number;              // Jump/fly force
    bgColor1: number;               // Background gradient color 1
    bgColor2: number;               // Background gradient color 2
    obstacleColor: number;          // Color for obstacles
    playerColor: number;            // Color for player
    obstacles: Obstacle[];
    length: number;                 // Level length in pixels
    musicTempo: number;             // BPM for music
    musicKey: string;               // Musical key
}

// Generate obstacles procedurally based on difficulty
function generateObstacles(difficulty: number, length: number, mode: 'gravity' | 'wave'): Obstacle[] {
    const obstacles: Obstacle[] = [];
    const spacing = Math.max(200 - difficulty * 10, 100); // Closer obstacles at higher difficulty
    const gapSize = Math.max(0.4 - difficulty * 0.015, 0.2); // Smaller gaps at higher difficulty
    
    let x = 600; // Start after some initial space
    
    while (x < length - 200) {
        const rand = Math.random();
        
        if (mode === 'gravity') {
            // Geometry Dash style obstacles
            if (rand < 0.4) {
                // Spike
                obstacles.push({
                    x,
                    y: 1, // Ground level
                    width: 40 + difficulty * 2,
                    height: 50 + difficulty * 3,
                    type: 'spike'
                });
            } else if (rand < 0.7) {
                // Block to jump over
                obstacles.push({
                    x,
                    y: 1,
                    width: 60 + difficulty * 3,
                    height: 60 + difficulty * 4,
                    type: 'block'
                });
            } else {
                // Gap in floor
                obstacles.push({
                    x,
                    y: 1,
                    width: 80 + difficulty * 5,
                    height: 100,
                    type: 'gap'
                });
            }
        } else {
            // Wave Runner style - gaps to fly through
            const gapY = 0.2 + Math.random() * 0.6; // Random gap position
            const actualGapSize = gapSize + Math.random() * 0.1;
            
            // Top obstacle
            obstacles.push({
                x,
                y: 0,
                width: 60 + difficulty * 2,
                height: gapY - actualGapSize / 2,
                type: 'block'
            });
            
            // Bottom obstacle
            obstacles.push({
                x,
                y: gapY + actualGapSize / 2,
                width: 60 + difficulty * 2,
                height: 1 - (gapY + actualGapSize / 2),
                type: 'block'
            });
        }
        
        x += spacing + Math.random() * 100;
    }
    
    return obstacles;
}

// Bright, beautiful color palettes
const colorPalettes = [
    { bg1: 0x667eea, bg2: 0x764ba2, obstacle: 0xff6b6b, player: 0xffd93d }, // Purple dream
    { bg1: 0x11998e, bg2: 0x38ef7d, obstacle: 0xff4757, player: 0xffa502 }, // Mint fresh
    { bg1: 0xfe8c00, bg2: 0xf83600, obstacle: 0x2d3436, player: 0x00cec9 }, // Sunset fire
    { bg1: 0x6dd5fa, bg2: 0x2980b9, obstacle: 0xe74c3c, player: 0xf1c40f }, // Ocean blue
    { bg1: 0xf093fb, bg2: 0xf5576c, obstacle: 0x2c3e50, player: 0x1abc9c }, // Pink sunset
    { bg1: 0x4776e6, bg2: 0x8e54e9, obstacle: 0xe91e63, player: 0x00bcd4 }, // Royal purple
    { bg1: 0x00c6ff, bg2: 0x0072ff, obstacle: 0xff5722, player: 0xffeb3b }, // Sky blue
    { bg1: 0xf12711, bg2: 0xf5af19, obstacle: 0x1a1a2e, player: 0x16a085 }, // Fire orange
    { bg1: 0x7f00ff, bg2: 0xe100ff, obstacle: 0x2ecc71, player: 0xf39c12 }, // Neon purple
    { bg1: 0x00d2d3, bg2: 0x54a0ff, obstacle: 0xee5a24, player: 0xffc312 }, // Aqua splash
    { bg1: 0x20bf6b, bg2: 0x26de81, obstacle: 0xeb3b5a, player: 0xf7b731 }, // Green meadow
    { bg1: 0xff6b81, bg2: 0xee5a52, obstacle: 0x2d3436, player: 0x00d2d3 }, // Coral pink
    { bg1: 0xa55eea, bg2: 0x8854d0, obstacle: 0x20bf6b, player: 0xfed330 }, // Grape purple
    { bg1: 0x1dd1a1, bg2: 0x10ac84, obstacle: 0xff6b6b, player: 0xfeca57 }, // Emerald
    { bg1: 0xff9ff3, bg2: 0xf368e0, obstacle: 0x341f97, player: 0x00d2d3 }, // Bubblegum
];

export const levels: LevelConfig[] = [];

// Generate 15 levels of increasing difficulty
for (let i = 0; i < 15; i++) {
    const difficulty = i + 1;
    const palette = colorPalettes[i];
    // Alternate between gravity and wave modes
    const mode: 'gravity' | 'wave' = i % 2 === 0 ? 'gravity' : 'wave';
    const length = 3000 + difficulty * 500; // Longer levels at higher difficulty
    
    if (!palette) continue;
    
    levels.push({
        id: i + 1,
        name: `Level ${i + 1}`,
        mode,
        speed: 180 + difficulty * 15, // Faster at higher levels but still playable
        gravity: mode === 'gravity' ? 800 + difficulty * 30 : 0,
        jumpForce: mode === 'gravity' ? -350 - difficulty * 10 : -200 - difficulty * 8,
        bgColor1: palette.bg1,
        bgColor2: palette.bg2,
        obstacleColor: palette.obstacle,
        playerColor: palette.player,
        obstacles: generateObstacles(difficulty, length, mode),
        length,
        musicTempo: 110 + difficulty * 5,
        musicKey: 'C'
    });
}
