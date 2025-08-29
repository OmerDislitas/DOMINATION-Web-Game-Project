# DOMINATION Web Game - Modular Architecture

## Overview

The DOMINATION Web Game has been refactored from a single 1900-line `main.js` file into a modular architecture with separate classes for different responsibilities. This improves code maintainability, readability, and debugging.

## Module Structure

### Core Modules

#### 1. **Utils.js** - Utility Functions
- **Purpose**: Hex math, coordinate conversion, game calculations
- **Key Features**:
  - Hex-to-pixel coordinate conversion
  - Cube/offset coordinate system conversion
  - Neighbor calculation for hex tiles
  - Land/unit data access helpers
  - Protection level calculations
  - Game constants and configurations

#### 2. **GameState.js** - Game Data Management
- **Purpose**: Manages all game state data
- **Key Features**:
  - Land data (terrain, ownership, buildings)
  - Unit data (positions, types, ownership)
  - Selection state (selected tiles, units)
  - Protection system management
  - Castle distribution system
  - Data validation and integrity

#### 3. **NetworkManager.js** - Network Communication
- **Purpose**: Handles all socket.io communications
- **Key Features**:
  - Server connection management
  - Room creation and joining
  - Game state synchronization
  - Player actions (move, attack, capture)
  - Error handling and reconnection

#### 4. **UIManager.js** - User Interface Management
- **Purpose**: Screen transitions, menus, UI interactions
- **Key Features**:
  - Screen management (login, rooms, game)
  - Menu handling (build, unit menus)
  - Player list and room status updates
  - Capacity controls and settings
  - Color picker management

#### 5. **CanvasRenderer.js** - Rendering System
- **Purpose**: All drawing operations on the canvas
- **Key Features**:
  - Map rendering (hexes, terrain)
  - Unit and building rendering
  - Animation integration
  - Tactical indicators (attack ranges, reachable areas)
  - Protection level display
  - Camera management

#### 6. **AnimationSystem.js** - Animation Management
- **Purpose**: Unit movements and visual effects
- **Key Features**:
  - Smooth unit movement animations
  - Combat and capture effects
  - Circle animations (movement indicators)
  - Animation timing and easing
  - Performance optimization

#### 7. **GameLogic.js** - Game Rules and Logic
- **Purpose**: Game rules, movement validation, combat
- **Key Features**:
  - Turn-based game mechanics
  - Movement validation and pathfinding
  - Combat resolution
  - Land capture mechanics
  - Action validation and execution

#### 8. **InputHandler.js** - Input Management
- **Purpose**: Mouse/keyboard events and camera controls
- **Key Features**:
  - Mouse click handling
  - Drag and zoom camera controls
  - Touch support for mobile devices
  - Keyboard shortcuts
  - Input state management

## Architecture Benefits

### 1. **Separation of Concerns**
Each module has a single, well-defined responsibility, making the code easier to understand and maintain.

### 2. **Modularity**
Components can be developed, tested, and debugged independently. Changes to one module don't affect others.

### 3. **Reusability**
Modules can be reused in different contexts or extended for new features.

### 4. **Maintainability**
Smaller, focused files are easier to navigate and modify. Bug fixes and feature additions are more straightforward.

### 5. **Testing**
Individual modules can be unit tested in isolation, improving code quality and reliability.

## File Structure

```
public/
├── assets/
│   ├── main.js                 (Main coordinator - 240 lines)
│   └── js/                     (Module directory)
│       ├── Utils.js            (Utility functions - 280 lines)
│       ├── GameState.js        (Game data management - 320 lines)
│       ├── NetworkManager.js   (Network communications - 150 lines)
│       ├── UIManager.js        (UI management - 250 lines)
│       ├── CanvasRenderer.js   (Rendering system - 350 lines)
│       ├── AnimationSystem.js  (Animation management - 280 lines)
│       ├── GameLogic.js        (Game rules and logic - 400 lines)
│       └── InputHandler.js     (Input handling - 350 lines)
├── index.html                  (Updated for ES6 modules)
└── editor.html
```

## Usage

### Initialization
The game automatically initializes when the DOM loads. All modules are imported and coordinated through the main `DominationGame` class.

### Global Access
For debugging and backward compatibility, key functions and data are available globally:
- `window.game` - Main game instance
- `window.drawMap()` - Redraw the map
- `window.landData` - Land data array
- `window.unitData` - Unit data array
- `window.DEBUG_PROT` - Debug protection system

### Module Communication
Modules communicate through:
1. **Direct references**: Passed during initialization
2. **Event system**: NetworkManager events
3. **Shared state**: GameState as central data store

## Development Guidelines

### Adding New Features
1. Identify the appropriate module for the feature
2. Add methods to the relevant class
3. Update inter-module communication if needed
4. Test the feature in isolation

### Debugging
1. Use browser developer tools with source maps
2. Each module can be debugged independently
3. Use `window.game` to access any module from console
4. Enable `DEBUG_PROT` for protection system debugging

### Performance Considerations
- Animation system automatically manages rendering loops
- Input handling is optimized for smooth interaction
- Game state updates trigger minimal redraws
- Network communication is efficient and event-driven

## Migration Notes

All original functionality has been preserved. The refactoring maintains:
- Complete game compatibility
- All existing features
- Original user interface
- Network protocol compatibility
- Save game data formats

The modular architecture provides a solid foundation for future enhancements and maintenance.