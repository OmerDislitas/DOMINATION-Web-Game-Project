/**
 * Utils.js - Utility functions for hex math, coordinates, and game helpers
 */

export class Utils {
  constructor() {
    this.tileSize = 40;
    this.hexHeight = Math.sqrt(3) * this.tileSize;
    
    // Unit power levels
    this.unitPower = { peasant: 1, spearman: 2, swordsman: 3, knight: 4 };
    
    // Building protection levels
    this.BUILDING_PROT = { tower: 2, strong_tower: 3, castle: 1 };
    
    // Player colors
    this.colors = ['#2d2d2d', '#4CAF50', '#14BBC7', '#EE6B19', '#BC1EA7'];
    
    // Object and unit sizes for rendering
    this.objectSizes = {
      house: 48, castle: 48, tower: 48, strong_tower: 48,
      peasant: 48, spearman: 48, swordsman: 48, knight: 48
    };
    
    this.unitSizes = {
      peasant: 48, spearman: 48, swordsman: 48, knight: 48
    };
    
    // Hex direction vectors for cube coordinates
    this.cubeDirs = [
      { x: 1, y: -1, z: 0 }, { x: 1, y: 0, z: -1 }, { x: 0, y: 1, z: -1 },
      { x: -1, y: 1, z: 0 }, { x: -1, y: 0, z: 1 }, { x: 0, y: -1, z: 1 }
    ];
  }

  /**
   * Convert hex row/col to pixel coordinates (flat-top hex)
   */
  hexToPixel(row, col) {
    const parity = col & 1;
    const x = this.tileSize * 1.5 * col;
    const y = this.hexHeight * (row + 0.5 * parity);
    return { x, y };
  }

  /**
   * Convert offset coordinates to cube coordinates
   */
  offsetToCube(row, col) {
    const x = col;
    const z = row - ((col - (col & 1)) / 2);
    const y = -x - z;
    return { x, y, z };
  }

  /**
   * Convert cube coordinates to offset coordinates
   */
  cubeToOffset(x, y, z) {
    const row = z + ((x - (x & 1)) / 2);
    const col = x;
    return { row, col };
  }

  /**
   * Get neighboring hex tiles
   */
  getNeighbors(tile) {
    const c = this.offsetToCube(tile.row, tile.col);
    return this.cubeDirs.map(d => 
      this.cubeToOffset(c.x + d.x, c.y + d.y, c.z + d.z)
    );
  }

  /**
   * Calculate distance between two hex tiles
   */
  hexDistance(a, b) {
    const ac = this.offsetToCube(a.row, a.col);
    const bc = this.offsetToCube(b.row, b.col);
    return Math.max(
      Math.abs(ac.x - bc.x),
      Math.abs(ac.y - bc.y),
      Math.abs(ac.z - bc.z)
    );
  }

  /**
   * Get land owner from landData
   */
  getLandOwner(tile, landData) {
    const line = landData.find(l => {
      const [r, c] = l.trim().split(/\s+/);
      return parseInt(r) === tile.row && parseInt(c) === tile.col;
    });
    if (!line) return null;
    const [, , p] = line.trim().split(/\s+/);
    return parseInt(p);
  }

  /**
   * Set land owner in landData
   */
  setLandOwner(tile, newOwner, landData) {
    return landData.map(line => {
      const parts = line.trim().split(/\s+/);
      const [r, c, oldOwner, ...rest] = parts;
      if (+r === tile.row && +c === tile.col) {
        const filtered = rest.filter(tok => tok !== 'castle' && tok !== 'house');
        return `${r} ${c} ${newOwner} ${filtered.join(' ')}`.trim();
      }
      return line;
    });
  }

  /**
   * Capture land with structure destruction for soldier-initiated captures
   * Destroys military structures (tower, strong_tower, castle) on captured tiles
   */
  captureLandWithStructureDestruction(tile, newOwner, landData) {
    return landData.map(line => {
      const parts = line.trim().split(/\s+/);
      const [r, c, oldOwner, ...rest] = parts;
      if (+r === tile.row && +c === tile.col) {
        // Filter out all military structures during soldier capture
        const filtered = rest.filter(tok => 
          tok !== 'castle' && 
          tok !== 'tower' && 
          tok !== 'strong_tower' &&
          tok !== 'house'  // Keep house removal for consistency
        );
        return `${r} ${c} ${newOwner} ${filtered.join(' ')}`.trim();
      }
      return line;
    });
  }

  /**
   * Get object at tile from landData
   */
  getObjectAt(tile, landData) {
    const line = landData.find(l => {
      const [r, c] = l.trim().split(/\s+/);
      return +r === tile.row && +c === tile.col;
    });
    if (!line) return null;
    const parts = line.trim().split(/\s+/);
    return parts[3] || null;
  }

  /**
   * Get unit at tile from unitData
   */
  getUnitAt(tile, unitData) {
    const line = unitData.find(l => {
      const [r, c] = l.trim().split(/\s+/);
      return +r === tile.row && +c === tile.col;
    });
    if (!line) return null;
    const [r, c, p, type] = line.trim().split(/\s+/);
    return { row: +r, col: +c, player: +p, type };
  }

  /**
   * Get unit type at tile
   */
  getUnitTypeAt(tile, unitData) {
    const u = this.getUnitAt(tile, unitData);
    return u ? u.type : null;
  }

  /**
   * Get unit owner
   */
  getUnitOwner(tile, landData) {
    const landLine = landData.find(line => {
      const [r, c, player] = line.trim().split(/\s+/);
      return parseInt(r) === tile.row && parseInt(c) === tile.col;
    });

    if (!landLine) return null;
    const [, , playerId] = landLine.trim().split(/\s+/);
    return parseInt(playerId);
  }

  /**
   * Get reachable tiles within maxSteps for a player
   */
  getReachableTiles(start, maxSteps, playerId, landData) {
    const visited = new Set();
    const queue = [{ tile: start, steps: 0 }];
    const reachable = [];

    while (queue.length > 0) {
      const { tile, steps } = queue.shift();
      const key = `${tile.row},${tile.col}`;

      if (visited.has(key)) continue;
      visited.add(key);
      reachable.push(tile);

      if (steps >= maxSteps) continue;

      const neighbors = this.getNeighbors(tile);

      neighbors.forEach(neighbor => {
        const landLine = landData.find(line => {
          const [r, c, p] = line.trim().split(/\s+/);
          return parseInt(r) === neighbor.row && parseInt(c) === neighbor.col && parseInt(p) === playerId;
        });

        if (landLine) {
          queue.push({ tile: neighbor, steps: steps + 1 });
        }
      });
    }

    return reachable;
  }

  /**
   * Build capturable tiles list
   */
  buildCapturable(start, maxSteps, ownerId, landData) {
    const edge = this.getReachableTiles(start, maxSteps - 1, ownerId, landData);
    const seen = new Set();
    const out = [];

    edge.forEach(t => {
      this.getNeighbors(t).forEach(nb => {
        const key = `${nb.row},${nb.col}`;
        if (seen.has(key)) return;

        const p = this.getLandOwner(nb, landData);
        if (p !== null && p !== ownerId) {
          seen.add(key);
          out.push(nb);
        }
      });
    });

    return out;
  }

  /**
   * Calculate land protection level
   */
  calculateLandProtection(tile, landData, unitData) {
    const landOwner = this.getLandOwner(tile, landData);
    if (landOwner === null) return 0;

    let maxProtection = 0;

    // Check building on the tile itself
    const selfObj = this.getObjectAt(tile, landData);
    const selfOwner = this.getLandOwner(tile, landData);
    const selfVal = this.BUILDING_PROT[selfObj] || 0;
    if (selfVal && selfOwner === landOwner) {
      maxProtection = Math.max(maxProtection, selfVal);
    }

    // Check neighboring buildings and units
    const neighbors = this.getNeighbors(tile);
    neighbors.forEach(nb => {
      const nbOwner = this.getLandOwner(nb, landData);
      if (nbOwner !== landOwner) return;

      // Building protection
      const nbObj = this.getObjectAt(nb, landData);
      const nbVal = this.BUILDING_PROT[nbObj] || 0;
      if (nbVal) maxProtection = Math.max(maxProtection, nbVal);

      // Unit protection
      const unit = this.getUnitAt(nb, unitData);
      if (unit && unit.player === landOwner) {
        const unitProtection = this.unitPower[unit.type] || 0;
        maxProtection = Math.max(maxProtection, unitProtection);
      }
    });

    return maxProtection;
  }

  /**
   * Easing function for smooth animations
   */
  easeOutQuad(t) {
    return t * (2 - t);
  }

  /**
   * Debug protection for a specific tile
   */
  debugProtectionFor(tile, landData, unitData) {
    const owner = this.getLandOwner(tile, landData);
    const selfObj = this.getObjectAt(tile, landData);
    const selfVal = (this.BUILDING_PROT[selfObj] || 0);
    const neighbors = this.getNeighbors(tile);

    console.groupCollapsed(
      `[PROT] Tile (${tile.row},${tile.col}) owner=${owner} ` +
      `selfObj=${selfObj || '-'} selfVal=${selfVal}`
    );

    const rows = [];
    let maxProt = selfVal;

    // Self contribution
    rows.push({
      source: 'SELF',
      row: tile.row, col: tile.col,
      owner,
      obj: selfObj || '-',
      objVal: selfVal || 0,
      unit: '-',
      unitPow: 0,
      contributes: selfVal > 0 ? 'YES' : 'no (0)'
    });

    // Neighbors
    neighbors.forEach(nb => {
      const nbOwner = this.getLandOwner(nb, landData);
      const sameSide = (nbOwner === owner);

      const nbObj = this.getObjectAt(nb, landData);
      const nbObjVal = this.BUILDING_PROT[nbObj] || 0;

      const unit = this.getUnitAt(nb, unitData);
      const unitPow = unit ? (this.unitPower[unit.type] || 0) : 0;

      const best = sameSide ? Math.max(nbObjVal, unitPow) : 0;
      if (best > maxProt) maxProt = best > maxProt ? best : maxProt;

      rows.push({
        source: 'NEIGHBOR',
        row: nb.row, col: nb.col,
        owner: nbOwner,
        obj: nbObj || '-',
        objVal: nbObjVal,
        unit: unit ? unit.type : '-',
        unitPow,
        contributes: sameSide ? (best > 0 ? `YES (${best})` : 'sameSide but 0') : 'no (enemy/neutral)'
      });
    });

    console.table(rows);
    console.log(`[PROT] RESULT for (${tile.row},${tile.col}) = ${maxProt}`);
    console.groupEnd();
  }
}