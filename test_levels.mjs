// Quick test to check obstacle/jump window generation
// Inline the generation code for testing

// Physics constants
const GROUND_HEIGHT = 50;
const PLAYABLE_TOP = 60;
const SCREEN_HEIGHT = 768;
const PLAYABLE_HEIGHT = SCREEN_HEIGHT - PLAYABLE_TOP - GROUND_HEIGHT;
const GROUND_Y = SCREEN_HEIGHT - GROUND_HEIGHT;
const PLAYER_SIZE = 40;
const PLAYER_GROUND_Y = GROUND_Y - PLAYER_SIZE / 2;
const GROUND_DETECTION_THRESHOLD = 5;

function simulateJump(startX, jumpForce, gravity, speed, holdDuration = 0) {
    const positions = [];
    const dt = 1 / 60;
    
    let x = startX;
    let y = PLAYER_GROUND_Y;
    let vy = jumpForce;
    let t = 0;
    let isHolding = holdDuration > 0;
    let holdTimeRemaining = holdDuration;
    
    while (y < PLAYER_GROUND_Y || vy < 0) {
        positions.push({ x, y, t });
        
        vy += gravity * dt;
        
        if (isHolding && holdTimeRemaining > 0) {
            if (y >= PLAYER_GROUND_Y - GROUND_DETECTION_THRESHOLD && vy >= 0) {
                vy = jumpForce;
            }
            holdTimeRemaining -= dt;
            if (holdTimeRemaining <= 0) {
                isHolding = false;
            }
        }
        
        y += vy * dt;
        x += speed * dt;
        t += dt;
        
        if (y < PLAYABLE_TOP + PLAYER_SIZE / 2) {
            y = PLAYABLE_TOP + PLAYER_SIZE / 2;
            vy = 0;
        }
        
        if (y >= PLAYER_GROUND_Y && vy > 0 && !isHolding) {
            y = PLAYER_GROUND_Y;
            positions.push({ x, y, t });
            break;
        }
        
        if (t > 10) break;
    }
    
    return positions;
}

function calculateClearanceWindow(obstacleX, obstacleWidth, obstacleHeight, jumpForce, gravity, speed) {
    const obstacleTopY = GROUND_Y - obstacleHeight;
    const playerBottomClearance = PLAYER_SIZE / 2 + 10;
    const requiredPlayerY = obstacleTopY - playerBottomClearance;
    
    const tapPositions = simulateJump(0, jumpForce, gravity, speed, 0);
    
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
    
    let needsHold = false;
    let holdDuration = 0;
    
    if (peakY > requiredPlayerY || firstAboveX < 0) {
        needsHold = true;
        
        for (let hd = 0.1; hd <= 1.0; hd += 0.1) {
            const holdPositions = simulateJump(0, jumpForce, gravity, speed, hd);
            let holdPeakY = PLAYER_GROUND_Y;
            for (const pos of holdPositions) {
                if (pos.y < holdPeakY) holdPeakY = pos.y;
            }
            if (holdPeakY <= requiredPlayerY) {
                holdDuration = hd;
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
    
    if (firstAboveX < 0) firstAboveX = 50;
    if (lastAboveX < 0) lastAboveX = 150;
    
    const latestJumpX = obstacleX - firstAboveX;
    const earliestJumpX = obstacleX + obstacleWidth - lastAboveX;
    
    return {
        earliestJumpX: Math.min(earliestJumpX, latestJumpX),
        latestJumpX: Math.max(earliestJumpX, latestJumpX),
        needsHold,
        holdDuration
    };
}

function generateJumpWindowLevel(difficulty, length, speed, jumpForce, gravity) {
    const obstacles = [];
    const jumpWindows = [];
    
    const baseWindowWidth = Math.max(220 - difficulty * 12, 60);
    const minSpacing = Math.max(400 - difficulty * 15, 180);
    const maxSpacing = minSpacing + 150;
    const baseObstacleHeight = 45 + difficulty * 3;
    const obstacleHeightVariation = 15;
    const holdJumpProbability = Math.min(0.1 + difficulty * 0.04, 0.5);
    
    let x = 600;
    let obstacleCount = 0;
    let hasHadHeldJump = false;
    
    while (x < length - 400) {
        const rand = Math.random();
        const forceHeldForLevel1 = difficulty === 1 && !hasHadHeldJump && obstacleCount >= 2;
        const isHoldJump = forceHeldForLevel1 || (rand < holdJumpProbability && difficulty >= 2);
        
        let obstacleHeight;
        let obstacleWidth;
        let obstacleType;
        
        if (isHoldJump) {
            obstacleHeight = baseObstacleHeight + 30 + Math.random() * 20;
            obstacleWidth = 50 + difficulty * 2;
            obstacleType = 'block';
            hasHadHeldJump = true;
        } else if (rand < 0.5) {
            obstacleHeight = baseObstacleHeight + Math.random() * obstacleHeightVariation;
            obstacleWidth = 35 + difficulty * 2;
            obstacleType = 'spike';
        } else if (rand < 0.85) {
            obstacleHeight = baseObstacleHeight - 10 + Math.random() * obstacleHeightVariation;
            obstacleWidth = 50 + difficulty * 3;
            obstacleType = 'block';
        } else {
            obstacleWidth = 70 + difficulty * 4;
            obstacleHeight = 100;
            obstacleType = 'gap';
        }
        
        const clearance = calculateClearanceWindow(
            x,
            obstacleWidth,
            obstacleType === 'gap' ? 0 : obstacleHeight,
            jumpForce,
            gravity,
            speed
        );
        
        if (obstacleType === 'gap') {
            obstacles.push({ x, y: 1, width: obstacleWidth, height: obstacleHeight, type: 'gap' });
            jumpWindows.push({ startX: x - 120, endX: x - 20, type: 'tap' });
        } else {
            let windowStart = clearance.earliestJumpX;
            let windowEnd = clearance.latestJumpX;
            const actualWindowWidth = windowEnd - windowStart;
            
            if (actualWindowWidth > baseWindowWidth) {
                const excess = actualWindowWidth - baseWindowWidth;
                windowStart += excess * 0.3;
                windowEnd -= excess * 0.7;
            }
            
            if (windowEnd < windowStart) {
                windowEnd = windowStart + 30;
            }
            
            obstacles.push({ x, y: 1, width: obstacleWidth, height: obstacleHeight, type: obstacleType });
            jumpWindows.push({
                startX: windowStart,
                endX: windowEnd,
                type: isHoldJump || clearance.needsHold ? 'hold' : 'tap',
                holdDuration: (isHoldJump || clearance.needsHold) ? (clearance.holdDuration ?? 0.2) * 1000 : undefined
            });
        }
        
        const spacing = minSpacing + Math.random() * (maxSpacing - minSpacing);
        x += obstacleWidth + spacing;
        obstacleCount++;
    }
    
    return { obstacles, jumpWindows };
}

// Test gravity mode levels
console.log('Testing gravity mode level generation...\n');

for (let i = 1; i <= 15; i++) {
    // Only test gravity mode (odd levels: 1, 3, 5, ...)
    if (i % 2 === 0) continue; // Skip wave mode
    
    const difficulty = i;
    const length = 3000 + difficulty * 400;
    const speed = 180 + difficulty * 12;
    const gravity = 650 + difficulty * 20;
    const jumpForce = -420 - difficulty * 6;
    
    const { obstacles, jumpWindows } = generateJumpWindowLevel(difficulty, length, speed, jumpForce, gravity);
    
    console.log(`Level ${i} (gravity mode):`);
    console.log(`  Obstacles: ${obstacles.length}`);
    console.log(`  Jump Windows: ${jumpWindows.length}`);
    
    if (obstacles.length !== jumpWindows.length) {
        console.log(`  ⚠️  MISMATCH! Difference: ${Math.abs(jumpWindows.length - obstacles.length)}`);
    } else {
        console.log(`  ✓ Match!`);
    }
    console.log('');
}
