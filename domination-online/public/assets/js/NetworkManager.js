/**
 * NetworkManager.js - Handles all socket.io communications and room management
 */

export class NetworkManager {
  constructor(gameState, uiManager) {
    this.gameState = gameState;
    this.uiManager = uiManager;
    this.socket = io();
    this.setupSocketListeners();
  }

  setupSocketListeners() {
    // Connection events
    this.socket.on('connect', () => {
      console.log('Connected to server with ID:', this.socket.id);
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from server');
    });

    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
      alert('Error: ' + error);
    });

    // Room events
    this.socket.on('room:created', ({ code, room }) => {
      this.gameState.currentRoomCode = code;
      this.uiManager.setRoomCode(code);
      this.uiManager.showScreen('screen-waiting-room');
    });

    this.socket.on('room:joined', (room) => {
      this.gameState.currentRoomCode = room.code;
      this.uiManager.setRoomCode(room.code);
      this.uiManager.showScreen('screen-waiting-room');
      this.uiManager.wireColorPickers();
      this.uiManager.updateWaitingRoomHeader(room);
    });

    this.socket.on('room:update', (room) => {
      this.uiManager.updatePlayerList(room);
      this.uiManager.updateCapacity(room);
      this.uiManager.updateColorPickers(room, this.socket.id);
      this.uiManager.updateWaitingRoomHeader(room);
    });

    this.socket.on('rooms:list', (rooms) => {
      this.uiManager.updateRoomsList(rooms);
    });

    // Game events
    this.socket.on('game:start', () => {
      const code = this.socket.data?.roomCode;
      if (!code) return;
      
      // This event seems to be handled on server side for map selection
      // Client just receives game:init after this
    });

    this.socket.on('game:init', ({ state }) => {
      console.log('Game initialized with state:', state);
      if (Array.isArray(state.landData) && state.landData.length > 0) {
        this.gameState.landData = state.landData;
      }
      this.uiManager.showScreen('screen-game');
      // Trigger map redraw
      if (window.drawMap) window.drawMap();
    });

    this.socket.on('game:update', (patch) => {
      console.log('Game updated:', patch);
      if (patch.landData) {
        this.gameState.landData = patch.landData;
      }
      if (patch.unitData) {
        this.gameState.unitData = patch.unitData;
      }
      // Trigger map redraw
      if (window.drawMap) window.drawMap();
    });
  }

  // Login and player management
  setPlayerName(name) {
    this.gameState.playerName = name || 'Player';
    this.socket.emit('login:setName', this.gameState.playerName);
  }

  // Room management
  requestRoomsList() {
    this.setPlayerName();
    this.socket.emit('rooms:list');
  }

  createRoom(roomName, capacity, isPrivate) {
    this.setPlayerName();
    this.socket.emit('room:create', { 
      roomName: roomName || 'ROOM', 
      capacity: capacity || 4, 
      isPrivate: isPrivate || false 
    });
  }

  joinRoom(code) {
    this.setPlayerName();
    this.socket.emit('room:join', { code: code.toUpperCase().trim() });
  }

  leaveRoom() {
    this.socket.emit('room:leave');
  }

  pickColor(color) {
    this.socket.emit('room:pickColor', { color });
  }

  // Game actions
  startGame() {
    this.socket.emit('game:start', { landData: this.gameState.landData });
  }

  // Game state synchronization
  sendLandCapture(tile, newOwner) {
    this.socket.emit('action:capture', { 
      row: tile.row, 
      col: tile.col, 
      owner: newOwner 
    });
  }

  sendUnitMove(fromTile, toTile, unitType) {
    this.socket.emit('action:move', {
      from: { row: fromTile.row, col: fromTile.col },
      to: { row: toTile.row, col: toTile.col },
      unitType: unitType
    });
  }

  sendUnitAttack(attackerTile, targetTile, attackerType) {
    this.socket.emit('action:attack', {
      attacker: { row: attackerTile.row, col: attackerTile.col },
      target: { row: targetTile.row, col: targetTile.col },
      attackerType: attackerType
    });
  }

  sendUnitBuild(tile, unitType) {
    this.socket.emit('action:buildUnit', {
      row: tile.row,
      col: tile.col,
      unitType: unitType
    });
  }

  sendBuildingConstruct(tile, buildingType) {
    this.socket.emit('action:buildStructure', {
      row: tile.row,
      col: tile.col,
      buildingType: buildingType
    });
  }

  // Utility methods
  isConnected() {
    return this.socket.connected;
  }

  getSocketId() {
    return this.socket.id;
  }

  // Clean up
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
    }
  }
}