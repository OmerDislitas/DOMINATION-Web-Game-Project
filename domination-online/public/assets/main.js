/**
 * main.js - Modular DOMINATION Web Game
 * 
 * This file coordinates all the game modules and initializes the application.
 */

// Import all modules
import { Utils } from './js/Utils.js';
import { GameState } from './js/GameState.js';
import { NetworkManager } from './js/NetworkManager.js';
import { UIManager } from './js/UIManager.js';
import { AnimationSystem } from './js/AnimationSystem.js';
import { CanvasRenderer } from './js/CanvasRenderer.js';
import { GameLogic } from './js/GameLogic.js';
import { InputHandler } from './js/InputHandler.js';

// Global game instance
let game = null;

/**
 * Main Game Class - Coordinates all modules
 */
class DominationGame {
  constructor() {
    this.canvas = null;
    this.utils = null;
    this.gameState = null;
    this.networkManager = null;
    this.uiManager = null;
    this.animationSystem = null;
    this.canvasRenderer = null;
    this.gameLogic = null;
    this.inputHandler = null;
    
    this.initialized = false;
  }

  /**
   * Initialize the game
   */
  async initialize() {
    console.log('Initializing DOMINATION Web Game...');
    
    try {
      // Get canvas element
      this.canvas = document.getElementById('myCanvas');
      if (!this.canvas) {
        throw new Error('Canvas element not found');
      }
      
      // Initialize modules in dependency order
      this.utils = new Utils();
      this.gameState = new GameState(this.utils);
      this.animationSystem = new AnimationSystem(this.utils);
      this.canvasRenderer = new CanvasRenderer(this.canvas, this.gameState, this.utils, this.animationSystem);
      
      // Initialize UI and Network managers (they need references to each other)
      this.uiManager = new UIManager(this.gameState, null); // NetworkManager will be set later
      this.networkManager = new NetworkManager(this.gameState, this.uiManager);
      
      // Update UIManager with NetworkManager reference
      this.uiManager.networkManager = this.networkManager;
      
      // Initialize game logic
      this.gameLogic = new GameLogic(
        this.gameState, 
        this.utils, 
        this.animationSystem, 
        this.canvasRenderer, 
        this.networkManager
      );
      
      // Initialize input handler
      this.inputHandler = new InputHandler(this.canvas, this.canvasRenderer, this.gameLogic);
      
      // Set up global functions for backward compatibility
      this.setupGlobalFunctions();
      
      // Initial setup
      this.gameState.updateAllLandProtections();
      this.gameState.initializeCastleDistribution();
      
      // Center camera and draw initial map
      this.canvasRenderer.centerCameraOnMap();
      this.canvasRenderer.drawMap();
      
      this.initialized = true;
      console.log('DOMINATION Web Game initialized successfully!');
      
    } catch (error) {
      console.error('Failed to initialize game:', error);
      throw error;
    }
  }
  
  /**
   * Set up global functions for backward compatibility with HTML
   */
  setupGlobalFunctions() {
    // Essential global functions for the game
    window.drawMap = () => this.canvasRenderer?.drawMap();
    window.centerCameraOnMap = () => {
      this.canvasRenderer?.centerCameraOnMap();
      this.canvasRenderer?.drawMap();
    };
    
    // Game data access for modules
    window.landData = this.gameState.landData;
    window.unitData = this.gameState.unitData;
    window.setLandOwner = (tile, newOwner) => this.gameState.setLandOwner(tile, newOwner);
    
    // Utility functions
    window.hexDirections = this.utils.cubeDirs;
    window.unitPower = this.utils.unitPower;
  }
  
  /**
   * Get game state for external access
   */
  getGameState() {
    return this.gameState;
  }
  
  /**
   * Get utils for external access
   */
  getUtils() {
    return this.utils;
  }
  
  /**
   * Get canvas renderer for external access
   */
  getRenderer() {
    return this.canvasRenderer;
  }
  
  /**
   * Clean up resources
   */
  destroy() {
    if (this.networkManager) {
      this.networkManager.disconnect();
    }
    
    if (this.animationSystem) {
      this.animationSystem.clearAllAnimations();
    }
    
    this.initialized = false;
  }
}

/**
 * Initialize game when DOM is loaded
 */
function initializeGame() {
  game = new DominationGame();
  game.initialize().catch(error => {
    console.error('Game initialization failed:', error);
    alert('Failed to initialize game. Please refresh the page.');
  });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeGame);
} else {
  initializeGame();
}

// Make game instance globally available for debugging
window.game = game;

// Legacy global functions for HTML compatibility - consolidated
const globalFunctions = {
  joinRoomFromInput: () => game?.uiManager?.joinRoomFromInput(),
  setPlayerName: () => game?.uiManager?.setPlayerName(),
  wireColorPickers: () => game?.uiManager?.wireColorPickers(),
  goJoinRooms: () => game?.uiManager?.goJoinRooms(),
  createRoom: () => game?.uiManager?.createRoom(),
  leaveRoom: () => game?.uiManager?.leaveRoom(),
  startGame: () => game?.uiManager?.startGame(),
  showScreen: (screenId) => game?.uiManager?.showScreen(screenId),
  increaseCapacity: () => game?.uiManager?.increaseCapacity(),
  decreaseCapacity: () => game?.uiManager?.decreaseCapacity(),
  toggleCheckbox: (el) => game?.uiManager?.toggleCheckbox(el)
};

// Attach functions to window object
Object.assign(window, globalFunctions);