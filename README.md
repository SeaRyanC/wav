# Wave Runner 🎮

A Geometry Dash / Wave Runner style HTML5 game built with TypeScript and Phaser 3.

![Menu Screenshot](https://github.com/user-attachments/assets/a9f84e17-67b7-440c-a64f-b7d5d836b585)

![Gameplay Screenshot](https://github.com/user-attachments/assets/5dff1cd0-82f6-4e79-8c7c-f0557ab49fae)

## Features

- 🎯 **15 Levels** of increasing difficulty
- 🎮 **Two Game Modes**: 
  - Gravity mode (Geometry Dash style) - press/hold to jump
  - Wave mode (Flappy Bird style) - hold to fly up, release to descend
- 🎵 **Procedural Music** using WebMIDI (with Web Audio fallback)
- 🌈 **Beautiful Visuals** with gradient backgrounds and particle effects
- 📱 **Responsive Controls** - keyboard (spacebar) or touch/tap
- 👶 **Kid-Friendly** - designed for ages 4-8 with forgiving gameplay
- ⚡ **60fps Performance** optimized for iPad and mobile devices

## How to Play

1. Press **SPACE** or **tap the screen** to start
2. In **Gravity Mode**: Press/hold to jump over obstacles
3. In **Wave Mode**: Hold to fly up, release to go down - navigate through gaps
4. Avoid obstacles and complete all 15 levels!

## Development

### Prerequisites

- Node.js 18+
- npm

### Setup

```bash
# Install dependencies
npm install

# Build the game (production)
npm run build

# Build with source maps (development)
npm run build:dev

# Watch mode for development
npm run watch

# Type check
npm run typecheck
```

### Tech Stack

- **TypeScript 5.9** with strict mode
- **Phaser 3.80** game engine
- **esbuild** for fast bundling
- **WebMIDI** for procedural music generation

### Project Structure

```
src/
├── main.ts              # Game entry point and configuration
├── levels.ts            # Level data and obstacle generation
├── music.ts             # WebMIDI and Web Audio music generator
└── scenes/
    ├── MenuScene.ts     # Main menu with PLAY button
    └── GameScene.ts     # Main gameplay scene
docs/
├── index.html           # Game HTML page
└── game.js              # Bundled game (generated)
```

## Deployment

The game deploys to GitHub Pages from the `/docs` folder. After building, the `docs/` folder contains:
- `index.html` - The game page
- `game.js` - The bundled game code

## License

ISC