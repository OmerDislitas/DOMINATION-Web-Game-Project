/**
 * GameState.js - Manages all game state data
 */

export class GameState {
  constructor(utils) {
    this.utils = utils;
    this.reset();
  }

  reset() {
    // Core game data
    this.landData = this.getDefaultLandData();
    this.unitData = [];
    
    // Selection state
    this.selectedTile = null;
    this.selectedUnit = null;
    this.reachableTiles = [];
    this.edgeTiles = [];
    this.capturableTiles = [];
    
    // Protection system
    this.landProtection = new Map(); // key: "row,col", value: protection level
    this.protectedMap = {}; // "r,c" -> 0..4
    
    // Player state
    this.currentPlayer = 1;
    this.gameStarted = false;
    
    // Room state
    this.currentRoomCode = null;
    this.playerName = 'Player';
    this.capacity = 4;
    
    // Images
    this.unitImages = this.initializeUnitImages();
    this.objectImages = this.initializeObjectImages();
    
    this.updateAllLandProtections();
  }

  getDefaultLandData() {
    return `
7 -4 1
7 -3 0
8 -3 0
7 -2 0
6 -2 0
8 -2 0
7 -1 0
8 -1 0
7 0 0
6 1 0 tower
6 0 0
6 -1 0
5 -2 0
6 -3 0
6 -4 1
5 1 0
5 2 0
5 3 0
5 4 0
7 1 0
8 2 0
7 3 0
8 4 0
5 -1 0
4 0 0 strong_tower
3 1 0
3 2 0
2 3 0
3 4 0
3 6 0
9 0 0 strong_tower
9 1 0
10 2 0
10 3 0
10 4 0
10 6 0
5 -3 0
7 -5 0
6 -5 1
8 -4 0
5 5 0
5 6 0
7 5 0
8 6 0
5 7 0
5 8 0
7 7 0
8 8 0
2 7 0
3 5 0
9 5 0
10 7 0
10 8 0
3 8 0
2 9 0
3 10 0
3 11 0
3 12 0
2 13 0
3 14 0
3 15 0
4 16 0 strong_tower
4 17 0
5 9 0
5 10 0
5 11 0
5 12 0
5 13 0
5 14 0
5 15 0
6 16 0
7 9 0
8 10 0
7 11 0
8 12 0
7 13 0
8 14 0
6 15 0 tower
7 15 0
7 16 0
5 17 0
6 17 0
7 17 0
10 9 0
10 10 0
9 11 0
10 12 0
10 13 0
10 14 0
9 15 0
9 16 0 strong_tower
5 18 0
6 18 1
7 18 0
8 18 0
4 19 0
5 19 0
6 19 1
7 19 0
8 19 0
5 20 0
6 20 2
7 20 2
8 20 0
5 21 0
6 21 2
7 21 0
6 8 0
7 8 0
8 17 0
4 -1 0
4 -3 0
5 -4 0
5 -5 0
`.trim().split('\n');
  }

  initializeUnitImages() {
    const images = {
      peasant: new Image(),
      spearman: new Image(),
      swordsman: new Image(),
      knight: new Image()
    };

    images.peasant.src = 'assets/img/man1.png';
    images.spearman.src = 'assets/img/man2.png';
    images.swordsman.src = 'assets/img/man3.png';
    images.knight.src = 'assets/img/man4.png';

    return images;
  }

  initializeObjectImages() {
    const images = {
      house: new Image(),
      castle: new Image(),
      tower: new Image(),
      strong_tower: new Image()
    };

    images.house.src = 'assets/img/house.png';
    images.castle.src = 'assets/img/castle.png';
    images.tower.src = 'assets/img/tower.png';
    images.strong_tower.src = 'assets/img/strong_tower.png';

    return images;
  }

  // Selection management
  setSelectedTile(tile) {
    this.selectedTile = tile;
    this.updateReachableTiles();
  }

  setSelectedUnit(tile) {
    this.selectedUnit = tile;
    this.selectedTile = tile;
    this.updateReachableTiles();
  }

  clearSelection() {
    this.selectedTile = null;
    this.selectedUnit = null;
    this.reachableTiles = [];
    this.edgeTiles = [];
    this.capturableTiles = [];
  }

  updateReachableTiles() {
    if (this.selectedUnit) {
      const owner = this.utils.getUnitOwner(this.selectedUnit, this.landData);
      this.reachableTiles = this.utils.getReachableTiles(this.selectedUnit, 4, owner, this.landData);
      this.edgeTiles = this.utils.getReachableTiles(this.selectedUnit, 3, owner, this.landData);
      this.capturableTiles = this.utils.buildCapturable(this.selectedUnit, 4, owner, this.landData);
    } else {
      this.reachableTiles = [];
      this.edgeTiles = [];
      this.capturableTiles = [];
    }
  }

  // Land and unit management
  addUnit(tile, playerId, unitType) {
    const newUnitLine = `${tile.row} ${tile.col} ${playerId} ${unitType}`;
    this.unitData.push(newUnitLine);
    this.updateAllLandProtections();
  }

  removeUnit(tile) {
    const index = this.unitData.findIndex(line => {
      const [r, c] = line.split(' ');
      return parseInt(r) === tile.row && parseInt(c) === tile.col;
    });
    if (index !== -1) {
      this.unitData.splice(index, 1);
      this.updateAllLandProtections();
    }
  }

  moveUnit(fromTile, toTile) {
    this.unitData = this.unitData.map(line => {
      const [r, c, p, t] = line.split(' ');
      if (+r === fromTile.row && +c === fromTile.col) {
        return `${toTile.row} ${toTile.col} ${p} ${t}`;
      }
      return line;
    });
    this.updateAllLandProtections();
  }

  setLandOwner(tile, newOwner) {
    this.landData = this.utils.setLandOwner(tile, newOwner, this.landData);
    this.updateAllLandProtections();
    
    // Trigger castle distribution after ownership change
    this.distributeCastles();
  }

  /**
   * Capture land with structure destruction for soldier-initiated captures
   * Destroys military structures (tower, strong_tower, castle) on captured tiles
   */
  captureLandWithStructureDestruction(tile, newOwner) {
    this.landData = this.utils.captureLandWithStructureDestruction(tile, newOwner, this.landData);
    this.updateAllLandProtections();
  }

  addObjectToTile(tile, objectType) {
    this.landData = this.landData.map(line => {
      const parts = line.trim().split(/\s+/);
      const [r, c, p] = parts;
      if (+r === tile.row && +c === tile.col) {
        return `${r} ${c} ${p} ${objectType}`;
      }
      return line;
    });
    this.updateAllLandProtections();
  }

  // Protection system
  updateAllLandProtections() {
    this.landProtection.clear();
    this.landData.forEach(line => {
      const [row, col] = line.trim().split(/\s+/);
      const tile = { row: parseInt(row), col: parseInt(col) };
      const protection = this.utils.calculateLandProtection(tile, this.landData, this.unitData);
      this.landProtection.set(`${tile.row},${tile.col}`, protection);
    });
  }

  getLandProtection(tile) {
    return this.landProtection.get(`${tile.row},${tile.col}`) || 0;
  }

  recomputeProtection() {
    const map = {};
    this.landData.forEach(line => {
      const [r, c] = line.trim().split(/\s+/).map(Number);
      map[`${r},${c}`] = 0;
    });

    (this.unitData || []).forEach(line => {
      if (!line || !line.trim()) return;
      const parts = line.trim().split(/\s+/);
      if (parts.length < 4) return;
      const ut = parts[3];
      const power = Number(this.utils.unitPower?.[ut] ?? 0);
      if (this.utils.unitPower?.[ut] === undefined) return;
    });

    this.protectedMap = map;
  }

  // Castle distribution system
  findConnectedRegions() {
    const visited = new Set();
    const regions = new Map();

    this.landData.forEach(line => {
      const [row, col, player] = line.trim().split(/\s+/);
      const r = parseInt(row);
      const c = parseInt(col);
      const p = parseInt(player);
      const key = `${r},${c}`;

      if (visited.has(key)) return;

      const region = this.findConnectedTilesOfSamePlayer({ row: r, col: c }, p, visited);

      if (region.length >= 2) {
        if (!regions.has(p)) {
          regions.set(p, []);
        }
        regions.get(p).push(region);
      }
    });

    return regions;
  }

  findConnectedTilesOfSamePlayer(startTile, targetPlayer, visited) {
    const region = [];
    const queue = [startTile];
    const regionVisited = new Set();

    while (queue.length > 0) {
      const current = queue.shift();
      const key = `${current.row},${current.col}`;

      if (regionVisited.has(key)) continue;
      regionVisited.add(key);
      visited.add(key);

      const owner = this.utils.getLandOwner(current, this.landData);
      if (owner !== targetPlayer) continue;

      region.push(current);

      const neighbors = this.utils.getNeighbors(current);
      neighbors.forEach(neighbor => {
        const neighborKey = `${neighbor.row},${neighbor.col}`;
        if (!regionVisited.has(neighborKey)) {
          const neighborOwner = this.utils.getLandOwner(neighbor, this.landData);
          if (neighborOwner === targetPlayer) {
            queue.push(neighbor);
          }
        }
      });
    }

    return region;
  }

  regionHasCastle(region) {
    return region.some(tile => {
      const line = this.landData.find(l => {
        const [r, c] = l.trim().split(/\s+/);
        return parseInt(r) === tile.row && parseInt(c) === tile.col;
      });
      if (!line) return false;
      const parts = line.trim().split(/\s+/);
      return parts[3] === 'castle';
    });
  }

  assignCastleToRegion(region) {
    const availableTiles = region.filter(tile => {
      const line = this.landData.find(l => {
        const [r, c] = l.trim().split(/\s+/);
        return parseInt(r) === tile.row && parseInt(c) === tile.col;
      });
      if (!line) return false;
      const parts = line.trim().split(/\s+/);
      return parts.length <= 3;
    });

    if (availableTiles.length === 0) return false;

    const randomIndex = Math.floor(Math.random() * availableTiles.length);
    const selectedTile = availableTiles[randomIndex];

    this.addObjectToTile(selectedTile, 'castle');
    return true;
  }

  removeInvalidCastles() {
    const validRegions = this.findConnectedRegions();
    const allValidTiles = new Set();

    validRegions.forEach(playerRegions => {
      playerRegions.forEach(region => {
        region.forEach(tile => {
          allValidTiles.add(`${tile.row},${tile.col}`);
        });
      });
    });

    this.landData = this.landData.map(line => {
      const parts = line.trim().split(/\s+/);
      const [r, c, p, obj] = parts;
      const key = `${r},${c}`;
      
      if (obj === 'castle' && (!allValidTiles.has(key) || +p === 0)) {
        return `${r} ${c} ${p}`;
      }
      return line;
    });
  }

  distributeCastles() {
    this.removeInvalidCastles();
    const regions = this.findConnectedRegions();

    regions.forEach((playerRegions, playerId) => {
      if (playerId === 0) return;

      playerRegions.forEach((region, index) => {
        if (!this.regionHasCastle(region)) {
          this.assignCastleToRegion(region);
        }
      });
    });
  }

  initializeCastleDistribution() {
    this.distributeCastles();
  }

  // Game state validation
  isValidMove(fromTile, toTile) {
    if (!this.selectedUnit) return false;
    return this.reachableTiles.some(t => t.row === toTile.row && t.col === toTile.col);
  }

  canCaptureLand(attackerTile, targetTile) {
    const attackerOwner = this.utils.getUnitOwner(attackerTile, this.landData);
    const targetOwner = this.utils.getLandOwner(targetTile, this.landData);
    
    if (targetOwner === attackerOwner || targetOwner === null) return false;

    const canReachByPath = this.utils.getNeighbors(targetTile).some(nb =>
      this.edgeTiles.some(t => t.row === nb.row && t.col === nb.col)
    );

    if (!canReachByPath) return false;

    const attackerType = this.utils.getUnitTypeAt(attackerTile, this.unitData);
    const attackerPower = this.utils.unitPower[attackerType] || 0;
    const landProtection = this.getLandProtection(targetTile);

    return attackerPower > landProtection || 
           (attackerType === 'knight' && landProtection === 4);
  }

  canAttackUnit(attackerTile, targetTile) {
    const attackerOwner = this.utils.getUnitOwner(attackerTile, this.landData);
    const targetOwner = this.utils.getUnitOwner(targetTile, this.landData);
    
    if (targetOwner === attackerOwner) return false;

    const canReach = this.utils.getNeighbors(targetTile).some(nb =>
      this.edgeTiles.some(t => t.row === nb.row && t.col === nb.col)
    );

    if (!canReach) return false;

    const attackerType = this.utils.getUnitTypeAt(attackerTile, this.unitData);
    const defenderType = this.utils.getUnitTypeAt(targetTile, this.unitData);
    const attackerPower = this.utils.unitPower[attackerType] || 0;
    const defenderPower = this.utils.unitPower[defenderType] || 0;

    return attackerPower > defenderPower || 
           (attackerType === 'knight' && defenderType === 'knight');
  }

  // Data access helpers
  getLandOwner(tile) {
    return this.utils.getLandOwner(tile, this.landData);
  }

  getUnitAt(tile) {
    return this.utils.getUnitAt(tile, this.unitData);
  }

  getUnitTypeAt(tile) {
    return this.utils.getUnitTypeAt(tile, this.unitData);
  }

  getObjectAt(tile) {
    return this.utils.getObjectAt(tile, this.landData);
  }

  getUnitOwner(tile) {
    return this.utils.getUnitOwner(tile, this.landData);
  }
}