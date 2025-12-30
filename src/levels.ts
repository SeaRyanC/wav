// Level data configuration
// Each level has obstacles, game mode (gravity or wave), and settings
// NEW: Levels are generated using "jump windows" - windows in time/space where
// the player must jump to avoid death

export interface Obstacle {
    x: number;          // X position (in world coordinates)
    y: number;          // Y position (as percentage of playable height, 0-1)
    width: number;      // Width of obstacle
    height: number;     // Height of obstacle
    type: 'spike' | 'block' | 'gap' | 'moving';
    moveSpeed?: number; // For moving obstacles
    moveRange?: number; // For moving obstacles
}

// A JumpWindow represents a window where the player must jump to avoid an obstacle
export interface JumpWindow {
    startX: number;     // X position where the jump window starts (earliest safe jump point)
    endX: number;       // X position where the jump window ends (latest safe jump point)
    type: 'tap' | 'hold'; // 'tap' = quick jump, 'hold' = must hold jump for duration
    holdDuration?: number; // For 'hold' type, how long to hold in ms
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
    jumpWindows: JumpWindow[];      // Jump windows for floor coloring
    length: number;                 // Level length in pixels
    musicTempo: number;             // BPM for music
    musicKey: string;               // Musical key
}

// Physics constants matching GameScene
const GROUND_HEIGHT = 50;
const PLAYABLE_TOP = 60;
const SCREEN_HEIGHT = 768;
const PLAYABLE_HEIGHT = SCREEN_HEIGHT - PLAYABLE_TOP - GROUND_HEIGHT;
const GROUND_Y = SCREEN_HEIGHT - GROUND_HEIGHT;
const PLAYER_SIZE = 40;
const PLAYER_GROUND_Y = GROUND_Y - PLAYER_SIZE / 2;
const GROUND_DETECTION_THRESHOLD = 5; // Tolerance for detecting ground contact during held jumps

// Simulate a jump trajectory and return positions at each time step
// Returns array of {x, y, t} positions
function simulateJump(
    startX: number,
    jumpForce: number,
    gravity: number,
    speed: number,
    holdDuration: number = 0  // Time in seconds to keep reapplying jump force
): { x: number; y: number; t: number }[] {
    const positions: { x: number; y: number; t: number }[] = [];
    const dt = 1 / 60; // 60 FPS simulation
    
    let x = startX;
    let y = PLAYER_GROUND_Y;
    let vy = jumpForce;
    let t = 0;
    let isHolding = holdDuration > 0;
    let holdTimeRemaining = holdDuration;
    
    // Simulate until we land back on ground
    // Use < instead of <= to avoid edge case where y equals ground with zero velocity
    while (y < PLAYER_GROUND_Y || vy < 0) {
        positions.push({ x, y, t });
        
        // Apply gravity
        vy += gravity * dt;
        
        // If holding and still in hold window, keep applying upward force at ground
        // In the game, holding while on ground triggers a jump
        // For held jumps, we simulate multiple consecutive jump applications
        if (isHolding && holdTimeRemaining > 0) {
            // When player touches ground while holding, they immediately jump again
            if (y >= PLAYER_GROUND_Y - GROUND_DETECTION_THRESHOLD && vy >= 0) {
                vy = jumpForce;
            }
            holdTimeRemaining -= dt;
            if (holdTimeRemaining <= 0) {
                isHolding = false;
            }
        }
        
        // Update position
        y += vy * dt;
        x += speed * dt;
        t += dt;
        
        // Ceiling collision
        if (y < PLAYABLE_TOP + PLAYER_SIZE / 2) {
            y = PLAYABLE_TOP + PLAYER_SIZE / 2;
            vy = 0;
        }
        
        // Ground collision (end of jump)
        if (y >= PLAYER_GROUND_Y && vy > 0 && !isHolding) {
            y = PLAYER_GROUND_Y;
            positions.push({ x, y, t });
            break;
        }
        
        // Safety: prevent infinite loops
        if (t > 10) break;
    }
    
    return positions;
}

// Calculate where player needs to be in the air to clear an obstacle
function calculateClearanceWindow(
    obstacleX: number,
    obstacleWidth: number,
    obstacleHeight: number,
    jumpForce: number,
    gravity: number,
    speed: number
): { earliestJumpX: number; latestJumpX: number; needsHold: boolean; holdDuration: number } {
    // We need to find the range of jump start positions that would clear this obstacle
    // The player's hitbox is PLAYER_SIZE, and they need to clear the obstacle height
    
    const obstacleTopY = GROUND_Y - obstacleHeight;
    const playerBottomClearance = PLAYER_SIZE / 2 + 10; // Extra margin for safety
    const requiredPlayerY = obstacleTopY - playerBottomClearance;
    
    // Simulate a normal tap jump starting at x=0
    const tapPositions = simulateJump(0, jumpForce, gravity, speed, 0);
    
    // Find the first and last X positions where player is above the required height
    let peakY = PLAYER_GROUND_Y;
    let firstAboveX = -1;
    let lastAboveX = -1;
    
    for (let i = 0; i < tapPositions.length; i++) {
        const pos = tapPositions[i];
        if (!pos) continue;
        if (pos.y < peakY) peakY = pos.y;
        if (pos.y <= requiredPlayerY) {
            if (firstAboveX < 0) firstAboveX = pos.x;
            lastAboveX = pos.x;
        }
    }
    
    // Check if a tap jump can clear this obstacle
    let needsHold = false;
    let holdDuration = 0;
    
    if (peakY > requiredPlayerY || firstAboveX < 0) {
        // Tap jump doesn't reach high enough, need a held jump
        needsHold = true;
        
        // Try increasing hold durations until we can clear
        for (let hd = 0.1; hd <= 1.0; hd += 0.1) {
            const holdPositions = simulateJump(0, jumpForce, gravity, speed, hd);
            let holdPeakY = PLAYER_GROUND_Y;
            for (const pos of holdPositions) {
                if (pos.y < holdPeakY) holdPeakY = pos.y;
            }
            if (holdPeakY <= requiredPlayerY) {
                holdDuration = hd;
                // Recalculate clearance window with held jump
                firstAboveX = -1;
                lastAboveX = -1;
                for (const pos of holdPositions) {
                    if (pos.y <= requiredPlayerY) {
                        if (firstAboveX < 0) firstAboveX = pos.x;
                        lastAboveX = pos.x;
                    }
                }
                break;
            }
        }
    }
    
    // If we still can't calculate valid positions, use reasonable defaults
    if (firstAboveX < 0) firstAboveX = 50;
    if (lastAboveX < 0) lastAboveX = 150;
    
    // The clearance distance is how far horizontally the player travels while above the obstacle
    const clearanceDistance = lastAboveX - firstAboveX;
    
    // To clear the obstacle:
    // - Player starts jump at jumpX
    // - Player becomes "above" obstacle height at jumpX + firstAboveX
    // - Player drops below obstacle height at jumpX + lastAboveX
    // 
    // For a successful clear:
    // - jumpX + firstAboveX <= obstacleX (player is above before reaching obstacle)
    // - jumpX + lastAboveX >= obstacleX + obstacleWidth (player stays above until past obstacle)
    
    // Latest possible jump: player just barely reaches required height before obstacle
    // jumpX + firstAboveX = obstacleX => jumpX = obstacleX - firstAboveX
    const latestJumpX = obstacleX - firstAboveX;
    
    // Earliest possible jump: player descends just after passing obstacle
    // jumpX + lastAboveX = obstacleX + obstacleWidth => jumpX = obstacleX + obstacleWidth - lastAboveX
    const earliestJumpX = obstacleX + obstacleWidth - lastAboveX;
    
    // Use min/max to ensure we always return a valid range even if the obstacle
    // is wider than the clearance distance (which would make earliestJumpX > latestJumpX).
    // In such cases, we still return a valid window representing the best possible timing.
    return {
        earliestJumpX: Math.min(earliestJumpX, latestJumpX),
        latestJumpX: Math.max(earliestJumpX, latestJumpX),
        needsHold,
        holdDuration
    };
}

// Generate obstacles and jump windows using the jump window algorithm
function generateJumpWindowLevel(
    difficulty: number,
    length: number,
    mode: 'gravity' | 'wave',
    speed: number,
    jumpForce: number,
    gravity: number
): { obstacles: Obstacle[]; jumpWindows: JumpWindow[] } {
    const obstacles: Obstacle[] = [];
    const jumpWindows: JumpWindow[] = [];
    
    if (mode === 'wave') {
        // Wave mode uses different mechanics - keep simpler generation
        return generateWaveObstacles(difficulty, length);
    }
    
    // Jump window width scales down with difficulty
    // At level 1: ~208px window, at level 15: 60px window
    const baseWindowWidth = Math.max(220 - difficulty * 12, 60);
    
    // Spacing between obstacles (affects rest time between jumps)
    // At level 1: lots of rest, at level 15: less rest
    const minSpacing = Math.max(400 - difficulty * 15, 180);
    const maxSpacing = minSpacing + 150;
    
    // Obstacle heights scale with difficulty (taller = harder to clear)
    const baseObstacleHeight = 45 + difficulty * 3;
    const obstacleHeightVariation = 15;
    
    // Probability of held jump obstacles increases with difficulty
    const holdJumpProbability = Math.min(0.1 + difficulty * 0.04, 0.5);
    
    let x = 600; // Start after initial safe zone
    let obstacleCount = 0;
    
    while (x < length - 400) {
        // Determine obstacle type and height
        const rand = Math.random();
        const isHoldJump = rand < holdJumpProbability && difficulty >= 3;
        
        let obstacleHeight: number;
        let obstacleWidth: number;
        let obstacleType: 'spike' | 'block' | 'gap';
        
        if (isHoldJump) {
            // Taller obstacle requiring held jump
            obstacleHeight = baseObstacleHeight + 30 + Math.random() * 20;
            obstacleWidth = 50 + difficulty * 2;
            obstacleType = 'block';
        } else if (rand < 0.5) {
            // Standard spike
            obstacleHeight = baseObstacleHeight + Math.random() * obstacleHeightVariation;
            obstacleWidth = 35 + difficulty * 2;
            obstacleType = 'spike';
        } else if (rand < 0.85) {
            // Standard block
            obstacleHeight = baseObstacleHeight - 10 + Math.random() * obstacleHeightVariation;
            obstacleWidth = 50 + difficulty * 3;
            obstacleType = 'block';
        } else {
            // Gap - special case, not based on jump windows
            obstacleWidth = 70 + difficulty * 4;
            obstacleHeight = 100;
            obstacleType = 'gap';
        }
        
        // Calculate the jump window for this obstacle
        const clearance = calculateClearanceWindow(
            x,
            obstacleWidth,
            obstacleType === 'gap' ? 0 : obstacleHeight,
            jumpForce,
            gravity,
            speed
        );
        
        // For gaps, the jump window is simply over the gap
        if (obstacleType === 'gap') {
            // Create gap obstacle
            obstacles.push({
                x,
                y: 1,
                width: obstacleWidth,
                height: obstacleHeight,
                type: 'gap'
            });
            
            // Jump window for gap: must be airborne over the gap
            const gapJumpWindow: JumpWindow = {
                startX: x - 120,  // Jump before the gap
                endX: x - 20,     // Latest point to jump
                type: 'tap'
            };
            jumpWindows.push(gapJumpWindow);
        } else {
            // Constrain the jump window to the target width
            let windowStart = clearance.earliestJumpX;
            let windowEnd = clearance.latestJumpX;
            const actualWindowWidth = windowEnd - windowStart;
            
            // If the natural window is larger than our target, shrink it
            if (actualWindowWidth > baseWindowWidth) {
                // Center the constrained window
                const excess = actualWindowWidth - baseWindowWidth;
                windowStart += excess * 0.3;  // Shift start forward
                windowEnd -= excess * 0.7;    // Shift end backward (less forgiving on late jumps)
            }
            
            // Make sure window is valid
            if (windowEnd < windowStart) {
                windowEnd = windowStart + 30;  // Minimum window
            }
            
            // Add the obstacle
            obstacles.push({
                x,
                y: 1,
                width: obstacleWidth,
                height: obstacleHeight,
                type: obstacleType
            });
            
            // Add the jump window
            const jumpWindow: JumpWindow = {
                startX: windowStart,
                endX: windowEnd,
                type: clearance.needsHold ? 'hold' : 'tap',
                holdDuration: clearance.needsHold ? clearance.holdDuration * 1000 : undefined
            };
            jumpWindows.push(jumpWindow);
        }
        
        // Move to next obstacle position
        const spacing = minSpacing + Math.random() * (maxSpacing - minSpacing);
        x += obstacleWidth + spacing;
        obstacleCount++;
    }
    
    return { obstacles, jumpWindows };
}

// Wave mode obstacle generation (simpler, not based on jump windows)
function generateWaveObstacles(difficulty: number, length: number): { obstacles: Obstacle[]; jumpWindows: JumpWindow[] } {
    const obstacles: Obstacle[] = [];
    const jumpWindows: JumpWindow[] = [];
    
    const spacing = Math.max(180 - difficulty * 8, 100);
    const gapSize = Math.max(0.42 - difficulty * 0.015, 0.22);
    
    let x = 600;
    
    while (x < length - 200) {
        const gapY = 0.2 + Math.random() * 0.5;
        const actualGapSize = gapSize + Math.random() * 0.08;
        const obstacleWidth = 55 + difficulty * 2;
        
        // Top obstacle
        obstacles.push({
            x,
            y: 0,
            width: obstacleWidth,
            height: gapY - actualGapSize / 2,
            type: 'block'
        });
        
        // Bottom obstacle
        obstacles.push({
            x,
            y: gapY + actualGapSize / 2,
            width: obstacleWidth,
            height: 1 - (gapY + actualGapSize / 2),
            type: 'block'
        });
        
        // For wave mode, create a "window" indicating where to position
        // This is more of a target zone indicator
        jumpWindows.push({
            startX: x - 100,
            endX: x + obstacleWidth,
            type: gapY < 0.4 ? 'hold' : 'tap'  // Hold = fly up, tap = fly down
        });
        
        x += spacing + Math.random() * 80;
    }
    
    return { obstacles, jumpWindows };
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

// Generate 15 levels of increasing difficulty using jump window algorithm
for (let i = 0; i < 15; i++) {
    const difficulty = i + 1;
    const palette = colorPalettes[i];
    // Alternate between gravity and wave modes
    const mode: 'gravity' | 'wave' = i % 2 === 0 ? 'gravity' : 'wave';
    const length = 3000 + difficulty * 400; // Longer levels at higher difficulty
    
    if (!palette) continue;
    
    const speed = 180 + difficulty * 12; // Slightly slower progression for better gameplay
    const gravity = mode === 'gravity' ? 650 + difficulty * 20 : 0;
    const jumpForce = mode === 'gravity' ? -420 - difficulty * 6 : -200 - difficulty * 6;
    
    // Generate obstacles and jump windows using the new algorithm
    const { obstacles, jumpWindows } = generateJumpWindowLevel(
        difficulty,
        length,
        mode,
        speed,
        jumpForce,
        gravity
    );
    
    levels.push({
        id: i + 1,
        name: `Level ${i + 1}`,
        mode,
        speed,
        gravity,
        jumpForce,
        bgColor1: palette.bg1,
        bgColor2: palette.bg2,
        obstacleColor: palette.obstacle,
        playerColor: palette.player,
        obstacles,
        jumpWindows,
        length,
        musicTempo: 110 + difficulty * 5,
        musicKey: 'C'
    });
}
