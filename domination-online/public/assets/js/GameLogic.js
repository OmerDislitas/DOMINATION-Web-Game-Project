/**
 * GameLogic.js - Handles game rules, movement validation, combat, and land capture
 */

export class GameLogic {
  constructor(gameState, utils, animationSystem, canvasRenderer, networkManager) {
    this.gameState = gameState;
    this.utils = utils;
    this.animationSystem = animationSystem;
    this.canvasRenderer = canvasRenderer;
    this.networkManager = networkManager;
  }

  /**
   * Handle tile click logic
   */
  handleTileClick(clickedTile) {
    // Recompute protection before any action
    this.gameState.recomputeProtection();

    if (!clickedTile) {
      this.clearSelection();
      return;
    }

    // Debug protection if enabled
    if (window.DEBUG_PROT) {
      this.utils.debugProtectionFor(clickedTile, this.gameState.landData, this.gameState.unitData);
    }

    const unitOnTile = this.gameState.getUnitAt(clickedTile);
    const thereIsUnit = !!unitOnTile;

    // If a unit is already selected, try to perform actions
    if (this.gameState.selectedUnit) {
      const actionPerformed = this.handleSelectedUnitAction(clickedTile, thereIsUnit, unitOnTile);
      if (actionPerformed) return;
    }

    // Select new unit or tile
    this.handleSelection(clickedTile, thereIsUnit);
  }

  /**
   * Handle actions when a unit is already selected
   */
  handleSelectedUnitAction(clickedTile, thereIsUnit, unitOnTile) {
    const attackerOwner = this.gameState.getUnitOwner(this.gameState.selectedUnit);

    // Handle movement to empty tile
    if (!thereIsUnit) {
      return this.handleMovement(clickedTile, attackerOwner);
    }

    // Handle combat with enemy unit
    if (unitOnTile) {
      const targetOwner = this.gameState.getUnitOwner(clickedTile);
      
      if (targetOwner !== attackerOwner) {
        return this.handleCombat(clickedTile, attackerOwner);
      } else {
        // Same owner - switch selection to this unit
        this.selectUnit(clickedTile);
        return true;
      }
    }

    return false;
  }

  /**
   * Handle unit movement
   */
  handleMovement(clickedTile, attackerOwner) {
    const targetOwner = this.gameState.getLandOwner(clickedTile);

    if (targetOwner === attackerOwner) {
      // Normal movement within own territory
      const canMove = this.gameState.reachableTiles.some(t => 
        t.row === clickedTile.row && t.col === clickedTile.col
      );
      
      if (!canMove) return false;

      return this.executeMovement(clickedTile);
    } else {
      // Land capture
      return this.handleLandCapture(clickedTile, attackerOwner);
    }
  }

  /**
   * Execute unit movement
   */
  executeMovement(clickedTile) {
    const unitType = this.gameState.getUnitTypeAt(this.gameState.selectedUnit);
    
    // Start animation
    this.animationSystem.animateUnitMovement(
      this.gameState.selectedUnit, 
      clickedTile, 
      unitType,
      this.canvasRenderer.scale,
      this.canvasRenderer.offsetX,
      this.canvasRenderer.offsetY
    );

    // Create movement effect
    this.animationSystem.createCircleAtTile(
      clickedTile, 
      25, 
      true,
      this.canvasRenderer.scale,
      this.canvasRenderer.offsetX,
      this.canvasRenderer.offsetY
    );

    // Update game state
    this.gameState.moveUnit(this.gameState.selectedUnit, clickedTile);
    
    // Notify network
    this.networkManager.sendUnitMove(this.gameState.selectedUnit, clickedTile, unitType);

    this.completeAction();
    return true;
  }

  /**
   * Handle land capture
   */
  handleLandCapture(clickedTile, attackerOwner) {
    const canCaptureByPath = this.utils.getNeighbors(clickedTile).some(nb =>
      this.gameState.edgeTiles.some(t => t.row === nb.row && t.col === nb.col)
    );
    
    if (!canCaptureByPath) return false;

    if (!this.gameState.canCaptureLand(this.gameState.selectedUnit, clickedTile)) {
      const attackerType = this.gameState.getUnitTypeAt(this.gameState.selectedUnit);
      const attackerPower = this.utils.unitPower[attackerType] || 0;
      const landProtection = this.gameState.getLandProtection(clickedTile);
      
      console.log(`Attack blocked: ${attackerType} (power ${attackerPower}) cannot capture land with protection ${landProtection}`);
      return false;
    }

    return this.executeLandCapture(clickedTile, attackerOwner);
  }

  /**
   * Execute land capture
   */
  executeLandCapture(clickedTile, attackerOwner) {
    const unitType = this.gameState.getUnitTypeAt(this.gameState.selectedUnit);
    
    // Store original owner before capture for territory split detection
    const originalOwner = this.gameState.getLandOwner(clickedTile);
    
    // Start animation
    this.animationSystem.animateUnitMovement(
      this.gameState.selectedUnit, 
      clickedTile, 
      unitType,
      this.canvasRenderer.scale,
      this.canvasRenderer.offsetX,
      this.canvasRenderer.offsetY
    );

    // Create capture effect
    this.animationSystem.createCaptureEffect(
      clickedTile,
      this.canvasRenderer.scale,
      this.canvasRenderer.offsetX,
      this.canvasRenderer.offsetY
    );

    // Update game state - use structure destruction for soldier captures
    this.gameState.captureLandWithStructureDestruction(clickedTile, attackerOwner);
    this.gameState.moveUnit(this.gameState.selectedUnit, clickedTile);
    
    // Handle territory splitting after land capture
    if (originalOwner && originalOwner !== attackerOwner) {
      this.handleTerritorySplit(clickedTile, originalOwner);
    }
    
    // Notify network
    this.networkManager.sendLandCapture(clickedTile, attackerOwner);
    this.networkManager.sendUnitMove(this.gameState.selectedUnit, clickedTile, unitType);

    this.completeAction();
    return true;
  }

  /**
   * Handle unit combat
   */
  handleCombat(clickedTile, attackerOwner) {
    const canReach = this.utils.getNeighbors(clickedTile).some(nb =>
      this.gameState.edgeTiles.some(t => t.row === nb.row && t.col === nb.col)
    );

    if (!canReach) return false;

    if (!this.gameState.canAttackUnit(this.gameState.selectedUnit, clickedTile)) {
      const attackerType = this.gameState.getUnitTypeAt(this.gameState.selectedUnit);
      const defenderType = this.gameState.getUnitTypeAt(clickedTile);
      const attackerPower = this.utils.unitPower[attackerType] || 0;
      const defenderPower = this.utils.unitPower[defenderType] || 0;
      
      console.log(`${attackerType} (power ${attackerPower}) cannot attack ${defenderType} (power ${defenderPower})`);
      return false;
    }

    return this.executeCombat(clickedTile, attackerOwner);
  }

  /**
   * Execute combat
   */
  executeCombat(clickedTile, attackerOwner) {
    const attackerType = this.gameState.getUnitTypeAt(this.gameState.selectedUnit);
    
    // Store original owner before capture for territory split detection
    const originalOwner = this.gameState.getLandOwner(clickedTile);
    
    // Start animation
    this.animationSystem.animateUnitMovement(
      this.gameState.selectedUnit, 
      clickedTile, 
      attackerType,
      this.canvasRenderer.scale,
      this.canvasRenderer.offsetX,
      this.canvasRenderer.offsetY
    );

    // Create combat effect
    this.animationSystem.createCombatEffect(
      clickedTile,
      this.canvasRenderer.scale,
      this.canvasRenderer.offsetX,
      this.canvasRenderer.offsetY
    );

    // Update game state
    this.gameState.removeUnit(clickedTile); // Remove enemy unit
    this.gameState.captureLandWithStructureDestruction(clickedTile, attackerOwner); // Capture land with structure destruction
    this.gameState.moveUnit(this.gameState.selectedUnit, clickedTile); // Move attacker

    // Handle territory splitting after land capture
    if (originalOwner && originalOwner !== attackerOwner) {
      this.handleTerritorySplit(clickedTile, originalOwner);
    }

    // Notify network
    this.networkManager.sendUnitAttack(this.gameState.selectedUnit, clickedTile, attackerType);
    this.networkManager.sendLandCapture(clickedTile, attackerOwner);

    this.completeAction();
    return true;
  }

  /**
   * Handle selection of units or tiles
   */
  handleSelection(clickedTile, thereIsUnit) {
    if (thereIsUnit) {
      this.selectUnit(clickedTile);
    } else {
      this.selectTile(clickedTile);
    }

    // Removed inappropriate castle redistribution call
    // Castle redistribution should only happen when territories are actually split
    this.canvasRenderer.drawMap();
  }

  /**
   * Select a unit
   */
  selectUnit(clickedTile) {
    this.gameState.setSelectedUnit(clickedTile);
    const owner = this.gameState.getUnitOwner(clickedTile);
    this.gameState.reachableTiles = this.utils.getReachableTiles(clickedTile, 4, owner, this.gameState.landData);
    this.gameState.edgeTiles = this.utils.getReachableTiles(clickedTile, 3, owner, this.gameState.landData);
    this.gameState.capturableTiles = this.utils.buildCapturable(clickedTile, 4, owner, this.gameState.landData);
    
    this.hideMenus();
    
    // Start one-time fade-in animation for all tactical indicators
    this.canvasRenderer.startFadeInAnimation();
  }

  /**
   * Select an empty tile
   */
  selectTile(clickedTile) {
    // Stop fade-in animation since no unit is selected
    this.canvasRenderer.stopFadeInAnimation();
    
    this.gameState.setSelectedTile(clickedTile);
    this.gameState.selectedUnit = null;
    this.gameState.reachableTiles = [];
    this.gameState.edgeTiles = [];
    
    const owner = this.gameState.getLandOwner(clickedTile);
    
    // Show menus only for owned land (not neutral)
    if (owner !== null && owner !== 0) {
      this.showMenus();
    } else {
      this.hideMenus();
    }
  }

  /**
   * Clear all selections
   */
  clearSelection() {
    this.gameState.clearSelection();
    this.hideMenus();
    
    // Stop fade-in animation
    this.canvasRenderer.stopFadeInAnimation();
  }

  /**
   * Complete an action and clean up
   */
  completeAction() {
    this.gameState.updateAllLandProtections();
    
    // Stop fade-in animation before clearing selection
    this.canvasRenderer.stopFadeInAnimation();
    
    this.gameState.clearSelection();
    this.hideMenus();
  }

  /**
   * Show build and unit menus
   */
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

  /**
   * Hide build and unit menus
   */
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

  /**
   * Validate if a move is legal
   */
  isValidMove(fromTile, toTile) {
    if (!this.gameState.selectedUnit) return false;
    
    const reachable = this.utils.getReachableTiles(
      fromTile, 
      4, 
      this.gameState.getUnitOwner(fromTile),
      this.gameState.landData
    );
    
    return reachable.some(t => t.row === toTile.row && t.col === toTile.col);
  }

  /**
   * Check if a unit can attack another unit
   */
  canUnitAttack(attackerTile, targetTile) {
    const attackerOwner = this.gameState.getUnitOwner(attackerTile);
    const targetOwner = this.gameState.getUnitOwner(targetTile);
    
    if (attackerOwner === targetOwner) return false;

    const edgeTiles = this.utils.getReachableTiles(
      attackerTile, 
      3, 
      attackerOwner,
      this.gameState.landData
    );

    const canReach = this.utils.getNeighbors(targetTile).some(nb =>
      edgeTiles.some(t => t.row === nb.row && t.col === nb.col)
    );

    if (!canReach) return false;

    return this.gameState.canAttackUnit(attackerTile, targetTile);
  }

  /**
   * Calculate battle outcome
   */
  calculateBattleOutcome(attackerTile, defenderTile) {
    const attackerType = this.gameState.getUnitTypeAt(attackerTile);
    const defenderType = this.gameState.getUnitTypeAt(defenderTile);
    
    const attackerPower = this.utils.unitPower[attackerType] || 0;
    const defenderPower = this.utils.unitPower[defenderType] || 0;

    // Special rule: knight vs knight, attacker wins
    if (attackerType === 'knight' && defenderType === 'knight') {
      return 'attacker_wins';
    }

    if (attackerPower > defenderPower) {
      return 'attacker_wins';
    } else if (attackerPower < defenderPower) {
      return 'defender_wins';
    } else {
      return 'tie';
    }
  }

  /**
   * Handle territory splitting after land capture
   */
  handleTerritorySplit(capturedTile, originalOwner) {
    console.log(`Handling territory split at (${capturedTile.row}, ${capturedTile.col}) from player ${originalOwner}`);

    const regions = this.gameState.findConnectedRegions();
    const affectedPlayerRegions = regions.get(originalOwner) || [];

    affectedPlayerRegions.forEach((region, index) => {
      if (!this.gameState.regionHasCastle(region) && region.length >= 2) {
        console.log(`Assigning castle to newly split region ${index + 1} of player ${originalOwner}`);
        this.gameState.assignCastleToRegion(region);
      }
    });
  }

  /**
   * Get available actions for a selected unit
   */
  getAvailableActions(unitTile) {
    if (!unitTile) return [];

    const actions = [];
    const owner = this.gameState.getUnitOwner(unitTile);
    const reachable = this.utils.getReachableTiles(unitTile, 4, owner, this.gameState.landData);
    const edgeTiles = this.utils.getReachableTiles(unitTile, 3, owner, this.gameState.landData);

    // Movement actions
    reachable.forEach(tile => {
      const unitAtTile = this.gameState.getUnitAt(tile);
      if (!unitAtTile) {
        actions.push({
          type: 'move',
          target: tile,
          description: `Move to (${tile.row}, ${tile.col})`
        });
      }
    });

    // Attack actions
    this.gameState.unitData.forEach(line => {
      const [row, col] = line.split(' ');
      const targetTile = { row: parseInt(row), col: parseInt(col) };
      const targetOwner = this.gameState.getUnitOwner(targetTile);
      
      if (targetOwner !== owner && this.canUnitAttack(unitTile, targetTile)) {
        actions.push({
          type: 'attack',
          target: targetTile,
          description: `Attack unit at (${targetTile.row}, ${targetTile.col})`
        });
      }
    });

    // Capture actions
    const capturable = this.utils.buildCapturable(unitTile, 4, owner, this.gameState.landData);
    capturable.forEach(tile => {
      if (this.gameState.canCaptureLand(unitTile, tile)) {
        actions.push({
          type: 'capture',
          target: tile,
          description: `Capture land at (${tile.row}, ${tile.col})`
        });
      }
    });

    return actions;
  }
}