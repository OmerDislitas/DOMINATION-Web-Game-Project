/**
 * UIManager.js - Handles screen transitions, menus, and UI interactions
 */

export class UIManager {
  constructor(gameState, networkManager) {
    this.gameState = gameState;
    this.networkManager = networkManager;
    this.capacity = 4;
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Build menu event listener
    const buildMenu = document.getElementById('build-menu');
    if (buildMenu) {
      buildMenu.addEventListener('click', (e) => {
        this.handleBuildMenuClick(e);
      });
    }

    // Unit menu event listener
    const unitMenu = document.getElementById('unit-menu');
    if (unitMenu) {
      unitMenu.addEventListener('click', (e) => {
        this.handleUnitMenuClick(e);
      });
    }

    // Make functions globally available for HTML onclick handlers
    window.createRoom = () => this.createRoom();
    window.goJoinRooms = () => this.goJoinRooms();
    window.joinRoomFromInput = () => this.joinRoomFromInput();
    window.startGame = () => this.startGame();
    window.leaveRoom = () => this.leaveRoom();
    window.increaseCapacity = () => this.increaseCapacity();
    window.decreaseCapacity = () => this.decreaseCapacity();
    window.toggleCheckbox = (el) => this.toggleCheckbox(el);
    window.showScreen = (screenId) => this.showScreen(screenId);
  }

  // Screen management
  showScreen(screenId) {
    console.log('Switching to screen:', screenId);
    const screens = document.querySelectorAll('.screen');
    screens.forEach(screen => screen.classList.remove('active'));

    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
      targetScreen.classList.add('active');
    } else {
      console.error('Screen not found:', screenId);
    }
  }

  // Room management UI
  setRoomCode(code) {
    const label = document.querySelector('.jersey-text');
    if (label) label.textContent = 'ROOM CODE: ' + code;
  }

  updateWaitingRoomHeader(room) {
    const header = document.querySelector('.waiting-room-header');
    if (header) {
      header.textContent = `ROOM: ${room.name} (${room.isPrivate ? "PRIVATE" : "NON-PRIVATE"})`;
    }
  }

  updatePlayerList(room) {
    const panel = document.querySelector('.player-scroll-panel');
    if (!panel) return;

    panel.innerHTML = '';
    room.players.forEach(p => {
      const div = document.createElement('div');
      div.className = 'player-waiting';
      div.innerHTML = `<i class="bi bi-person-fill"></i><span>${p.name}</span>`;

      if (p.color) {
        div.style.boxShadow = `inset 0 0 0 4px ${p.color}`;
      }

      panel.appendChild(div);
    });
  }

  updateCapacity(room) {
    const capEl = document.getElementById('capacity');
    if (capEl) capEl.textContent = `${room.players.length}/${room.capacity}`;
  }

  updateColorPickers(room, mySocketId) {
    const my = room.players.find(p => p.id === mySocketId);
    const usedColors = new Set(room.players.map(p => p.color).filter(Boolean));

    document.querySelectorAll('.color-element').forEach(el => {
      const color = el.dataset.color;
      el.classList.remove('taken', 'selected');

      if (usedColors.has(color)) el.classList.add('taken');
      if (my && my.color === color) {
        el.classList.add('selected');
        el.classList.remove('taken');
      }
    });
  }

  updateRoomsList(rooms) {
    const panel = document.querySelector('.room-scroll-panel');
    if (!panel) return;

    panel.innerHTML = '';
    rooms.forEach(r => {
      const btn = document.createElement('button');
      btn.className = 'room-entry-item';
      btn.innerHTML = `<span>${r.name} (${r.code})</span>
        <div><i class="bi bi-person-fill"></i><span>${r.count}/${r.capacity}</span></div>`;
      btn.onclick = () => this.networkManager.joinRoom(r.code);
      panel.appendChild(btn);
    });
  }

  wireColorPickers() {
    document.querySelectorAll('.color-element').forEach(el => {
      el.addEventListener('click', () => {
        const color = el.dataset.color;
        if (el.classList.contains('taken') && !el.classList.contains('selected')) return;
        this.networkManager.pickColor(color);
      });
    });
  }

  // Menu handling
  handleBuildMenuClick(e) {
    console.log("girdi");
    const btn = e.target.closest('button');
    if (!btn || !this.gameState.selectedTile) {
      console.log('No button or selected tile for building');
      return;
    }

    const ownerId = this.gameState.getLandOwner(this.gameState.selectedTile);
    if (ownerId === null || ownerId === 0) {
      console.log('Cannot build on unowned or neutral tile');
      this.hideMenus();
      return;
    }

    const obj = btn.dataset.object;
    if (!obj) {
      console.log('No object type specified on button');
      return;
    }
    console.log("3");
    console.log(`Placing ${obj} on tile ${this.gameState.selectedTile.row},${this.gameState.selectedTile.col}`);

    // Check if tile already has a building
    const currentLine = this.gameState.landData.find(line => {
      const [r, c] = line.trim().split(/\s+/);
      return parseInt(r) === this.gameState.selectedTile.row && parseInt(c) === this.gameState.selectedTile.col;
    });

    if (currentLine) {
      console.log("7");
      const parts = currentLine.trim().split(/\s+/);
      const hasBuilding = parts.length > 3 && ['house', 'tower', 'strong_tower', 'castle'].includes(parts[3]);
      if (hasBuilding) {
        alert('This tile already has a building!');
        return;
      }
    }

    this.gameState.addObjectToTile(this.gameState.selectedTile, obj);

    // Notify network if needed
    this.networkManager.sendBuildingConstruct(this.gameState.selectedTile, obj);
    console.log("5");
    // Trigger redraw
    if (window.drawMap) window.drawMap();
    console.log("6");
    console.log(`Successfully placed ${obj}`);
  }

  handleUnitMenuClick(e) {
    const button = e.target.closest('button');
    if (!button || !this.gameState.selectedTile) return;

    const unitType = button.dataset.unit;
    if (!unitType) return;

    // Check if unit already exists
    const alreadyExists = this.gameState.unitData.some(line => {
      const [r, c] = line.split(' ');
      return parseInt(r) === this.gameState.selectedTile.row &&
        parseInt(c) === this.gameState.selectedTile.col;
    });

    if (alreadyExists) {
      alert("Bu tile'da zaten bir birim var.");
      return;
    }

    const ownerId = this.gameState.getLandOwner(this.gameState.selectedTile);
    if (ownerId === null || ownerId === 0) {
      this.hideMenus();
      return;
    }

    this.gameState.addUnit(this.gameState.selectedTile, ownerId, unitType);

    // Notify network
    this.networkManager.sendUnitBuild(this.gameState.selectedTile, unitType);

    // Trigger redraw
    if (window.drawMap) window.drawMap();
  }

  showMenus() {
    const unitMenu = document.getElementById('unit-menu');
    const buildMenu = document.getElementById('build-menu');
    const coinDisplay = document.getElementById('coin-display');
    const incomeDisplay = document.getElementById('income-display');

    if (unitMenu) unitMenu.classList.remove('hidden');
    if (buildMenu) buildMenu.classList.remove('hidden');
    if (coinDisplay) coinDisplay.classList.remove('hidden');
    if (incomeDisplay) incomeDisplay.classList.remove('hidden');
  }

  hideMenus() {
    const unitMenu = document.getElementById('unit-menu');
    const buildMenu = document.getElementById('build-menu');
    const coinDisplay = document.getElementById('coin-display');
    const incomeDisplay = document.getElementById('income-display');

    if (unitMenu) unitMenu.classList.add('hidden');
    if (buildMenu) buildMenu.classList.add('hidden');
    if (coinDisplay) coinDisplay.classList.add('hidden');
    if (incomeDisplay) incomeDisplay.classList.add('hidden');
  }

  // Login and room creation
  setPlayerName() {
    const name = document.getElementById('username')?.value || 'Player';
    this.networkManager.setPlayerName(name);
  }

  goJoinRooms() {
    this.setPlayerName();
    this.networkManager.requestRoomsList();
    this.showScreen('screen-join-room');
  }

  createRoom() {
    this.setPlayerName();
    const roomName = document.getElementById('roomname')?.value || 'ROOM';
    const capacity = parseInt(document.getElementById('capacity-value')?.innerText || '4', 10);
    const isPrivate = document.querySelector('.checkbox-box')?.classList.contains('active');

    this.networkManager.createRoom(roomName, capacity, isPrivate);
  }

  joinRoomFromInput() {
    const code = (document.getElementById('joincode')?.value || '').toUpperCase().trim();
    if (!code) return;
    this.setPlayerName();
    this.networkManager.joinRoom(code);
  }

  leaveRoom() {
    this.networkManager.leaveRoom();
    this.showScreen('screen-login');
  }

  startGame() {
    this.networkManager.startGame();
    this.showScreen('screen-game');
  }

  // Capacity controls
  increaseCapacity() {
    if (this.capacity < 6) {
      this.capacity++;
      const capacityElement = document.getElementById("capacity-value");
      if (capacityElement) {
        capacityElement.textContent = this.capacity;
      }
    }
  }

  decreaseCapacity() {
    if (this.capacity > 2) {
      this.capacity--;
      const capacityElement = document.getElementById("capacity-value");
      if (capacityElement) {
        capacityElement.textContent = this.capacity;
      }
    }
  }

  toggleCheckbox(el) {
    const box = el.querySelector('.checkbox-box');
    if (box) {
      box.classList.toggle('active');
      const isChecked = box.classList.contains('active');
      console.log("Private mode:", isChecked);
    }
  }

  // Utility methods
  getCapacity() {
    return this.capacity;
  }

  updateCapacityDisplay(value) {
    this.capacity = value;
    const capacityElement = document.getElementById("capacity-value");
    if (capacityElement) {
      capacityElement.textContent = this.capacity;
    }
  }
}