/**
 * CanvasRenderer.js - Handles all drawing operations (maps, units, animations)
 */

export class CanvasRenderer {
  constructor(canvas, gameState, utils, animationSystem) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.gameState = gameState;
    this.utils = utils;
    this.animationSystem = animationSystem;
    
    // Camera properties
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    
    // Drawing configuration
    this.tileSize = utils.tileSize;
    this.hexHeight = utils.hexHeight;
    
    // Animation for reachable tiles (one-time fade-in)
    this.fadeStartTime = null;
    this.fadeDuration = 300; // 300ms fade-in
    this.isAnimatingFade = false;
    
    if (!this.ctx) {
      console.error('Canvas context not found');
    }
  }

  /**
   * Main drawing function
   */
  drawMap() {
    if (!this.ctx) return;
    
    this.gameState.recomputeProtection();
    
    // Clear canvas
    this.ctx.fillStyle = '#0C666C';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw land tiles
    this.drawLandTiles();
    
    // Draw units
    this.drawUnits();
    
    // Draw animated circles
    this.animationSystem.drawAnimatedCircles(this.ctx);
  }

  /**
   * Draw all land tiles with proper highlighting
   */
  drawLandTiles() {
    let selectedRenderInfo = null;
    let selectedObj = null;

    this.gameState.landData.forEach(line => {
      const [row, col, player, obj] = line.split(' ');
      const r = parseInt(row);
      const c = parseInt(col);
      const { x, y } = this.utils.hexToPixel(r, c);
      const centerX = x * this.scale + this.offsetX;
      const centerY = y * this.scale + this.offsetY;

      const fillColor = this.utils.colors[player % this.utils.colors.length];
      const isSelected = this.gameState.selectedTile && 
                        this.gameState.selectedTile.row === r && 
                        this.gameState.selectedTile.col === c;

      if (isSelected) {
        // Store selected tile info for later rendering
        selectedRenderInfo = { x: centerX, y: centerY, fillColor };
        selectedObj = obj;
        
        // Draw reachable area indicator
        const inRange = this.gameState.reachableTiles.some(tile =>
          tile.row === r && tile.col === c
        );
        
        if (inRange) {
          this.ctx.beginPath();
          this.ctx.strokeStyle = 'red';
          this.ctx.lineWidth = 2;
          this.ctx.arc(centerX, centerY, this.tileSize * this.scale * 0.45, 0, Math.PI * 2);
          this.ctx.stroke();
        }
      } else {
        // Draw normal tile
        this.drawHex(centerX, centerY, fillColor, '#0C666C', 5);
        
        // Draw tactical indicators
        this.drawTacticalIndicators(r, c, centerX, centerY);
      }

      // Draw object if present
      if (typeof obj !== 'undefined') {
        this.drawObject(obj, centerX, centerY);
      }

      // Draw protection level indicator
      this.drawProtectionIndicator(r, c, centerX, centerY);
    });

    // Draw selected tile last (on top)
    if (selectedRenderInfo) {
      this.drawHex(selectedRenderInfo.x, selectedRenderInfo.y, 
                   selectedRenderInfo.fillColor, 'yellow', 5);
      if (selectedObj) {
        this.drawObject(selectedObj, selectedRenderInfo.x, selectedRenderInfo.y);
      }
    }

    // Draw reachable tiles overlay
    this.drawReachableTiles();
  }

  /**
   * Draw tactical indicators (capturable lands, attackable units)
   */
  drawTacticalIndicators(row, col, centerX, centerY) {
    if (!this.gameState.selectedUnit) return;

    // Calculate fade-in opacity if animation is active
    let opacity = 1.0;
    if (this.isAnimatingFade && this.fadeStartTime) {
      const currentTime = Date.now();
      const elapsed = currentTime - this.fadeStartTime;
      
      if (elapsed < this.fadeDuration) {
        opacity = elapsed / this.fadeDuration;
      } else {
        this.isAnimatingFade = false;
        opacity = 1.0;
      }
    }

    const attackerOwner = this.gameState.getUnitOwner(this.gameState.selectedUnit);
    const cellOwner = this.gameState.getLandOwner({ row, col });

    // Show capturable enemy land
    const isCapturable = 
      cellOwner !== null &&
      cellOwner !== attackerOwner &&
      this.utils.getNeighbors({ row, col }).some(nb =>
        this.gameState.edgeTiles.some(t => t.row === nb.row && t.col === nb.col)
      );

    if (isCapturable) {
      const canCaptureByPower = this.gameState.canCaptureLand(
        this.gameState.selectedUnit, 
        { row, col }
      );

      if (canCaptureByPower) {
        this.ctx.beginPath();
        this.ctx.strokeStyle = `rgba(255, 0, 0, ${opacity})`;
        this.ctx.lineWidth = 6;
        this.ctx.arc(centerX, centerY, this.tileSize * this.scale * 0.45, 0, Math.PI * 2);
        this.ctx.stroke();
      }
    }

    // Show attackable enemy units
    const enemyUnit = this.gameState.unitData.find(line => {
      const [ur, uc] = line.split(' ');
      return parseInt(ur) === row && parseInt(uc) === col;
    });

    if (enemyUnit && attackerOwner !== cellOwner) {
      const canAttack = this.gameState.canAttackUnit(
        this.gameState.selectedUnit,
        { row, col }
      );

      if (canAttack) {
        this.ctx.beginPath();
        this.ctx.strokeStyle = `rgba(255, 165, 0, ${opacity})`; // Orange for unit attacks
        this.ctx.lineWidth = 4;
        this.ctx.arc(centerX, centerY, this.tileSize * this.scale * 0.6, 0, Math.PI * 2);
        this.ctx.stroke();
      }
    }
  }

  /**
   * Draw protection level indicator
   */
  drawProtectionIndicator(row, col, centerX, centerY) {
    const protection = this.gameState.getLandProtection({ row, col });
    if (protection > 0) {
      this.ctx.fillStyle = 'white';
      this.ctx.font = `${12 * this.scale}px Arial`;
      this.ctx.textAlign = 'center';
      this.ctx.fillText(
        protection.toString(),
        centerX + this.tileSize * this.scale * 0.6,
        centerY - this.tileSize * this.scale * 0.6
      );
    }
  }

  /**
   * Draw reachable tiles overlay with one-time fade-in animation
   */
  drawReachableTiles() {
    if (this.gameState.reachableTiles.length === 0) return;
    
    let opacity = 1.0; // Default full opacity
    
    // Calculate fade-in opacity if animation is active
    if (this.isAnimatingFade && this.fadeStartTime) {
      const currentTime = Date.now();
      const elapsed = currentTime - this.fadeStartTime;
      
      if (elapsed < this.fadeDuration) {
        // Fade from 0 to 1 over fadeDuration
        opacity = elapsed / this.fadeDuration;
      } else {
        // Animation complete
        this.isAnimatingFade = false;
        opacity = 1.0;
      }
    }
    
    this.gameState.reachableTiles.forEach(tile => {
      const { x, y } = this.utils.hexToPixel(tile.row, tile.col);
      const centerX = x * this.scale + this.offsetX;
      const centerY = y * this.scale + this.offsetY;

      this.ctx.beginPath();
      this.ctx.strokeStyle = `rgba(255, 0, 0, ${opacity})`;
      this.ctx.lineWidth = 8;
      this.ctx.arc(centerX, centerY, this.tileSize * this.scale * 0.5, 0, Math.PI * 2);
      this.ctx.stroke();
    });
  }

  /**
   * Draw hexagon
   */
  drawHex(x, y, fillColor, strokeColor = '#0C666C', lineWidth = 5) {
    this.ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = Math.PI / 3 * i;
      const px = x + this.tileSize * this.scale * Math.cos(angle);
      const py = y + this.tileSize * this.scale * Math.sin(angle);
      if (i === 0) this.ctx.moveTo(px, py);
      else this.ctx.lineTo(px, py);
    }
    this.ctx.closePath();
    
    this.ctx.fillStyle = fillColor;
    this.ctx.fill();

    this.ctx.lineWidth = lineWidth;
    this.ctx.strokeStyle = strokeColor;
    this.ctx.stroke();

    // Reset to default
    this.ctx.lineWidth = 5;
    this.ctx.strokeStyle = '#0C666C';
  }

  /**
   * Draw units with animation support
   */
  drawUnits() {
    this.gameState.unitData.forEach(line => {
      const [row, col, player, type] = line.trim().split(/\s+/);
      const r = parseInt(row);
      const c = parseInt(col);

      // Check if unit is animating
      const animPos = this.animationSystem.getUnitAnimationPosition(r, c);
      
      let centerX, centerY;
      
      if (animPos) {
        // Use animated position
        centerX = animPos.x;
        centerY = animPos.y;
      } else {
        // Use normal position
        const { x, y } = this.utils.hexToPixel(r, c);
        centerX = x * this.scale + this.offsetX;
        centerY = y * this.scale + this.offsetY;
      }

      this.drawUnit(centerX, centerY, type);
    });
  }

  /**
   * Draw a single unit
   */
  drawUnit(x, y, type) {
    const img = this.gameState.unitImages[type];
    if (!img || !img.complete) return;

    const baseSize = this.utils.unitSizes[type] || 32;
    const size = baseSize * this.scale;

    this.ctx.drawImage(img, x - size / 2, y - size / 2, size, size);
  }

  /**
   * Draw a building/object
   */
  drawObject(obj, x, y) {
    const img = this.gameState.objectImages[obj];
    if (!img || !img.complete) return;

    const baseSize = this.utils.objectSizes[obj] || 32;
    const size = baseSize * this.scale;

    this.ctx.drawImage(img, x - size / 2, y - size / 2, size, size);
  }

  /**
   * Get hex tile at screen coordinates
   */
  getHexAt(x, y) {
    const worldX = (x - this.offsetX) / this.scale;
    const worldY = (y - this.offsetY) / this.scale;

    for (let line of this.gameState.landData) {
      const [row, col] = line.trim().split(/\s+/);
      const { x: hx, y: hy } = this.utils.hexToPixel(parseInt(row), parseInt(col));

      const dx = worldX - hx;
      const dy = worldY - hy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < this.tileSize * 0.9) {
        return { row: parseInt(row), col: parseInt(col) };
      }
    }

    return null;
  }

  /**
   * Center camera on the map
   */
  centerCameraOnMap() {
    if (!Array.isArray(this.gameState.landData) || this.gameState.landData.length === 0) return;

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    this.gameState.landData.forEach(line => {
      const [row, col] = line.trim().split(/\s+/).map(Number);
      if (Number.isNaN(row) || Number.isNaN(col)) return;
      
      const { x, y } = this.utils.hexToPixel(row, col);
      if (x < minX) minX = x; 
      if (x > maxX) maxX = x;
      if (y < minY) minY = y; 
      if (y > maxY) maxY = y;
    });

    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;

    this.offsetX = this.canvas.width / 2 - midX * this.scale;
    this.offsetY = this.canvas.height / 2 - midY * this.scale;
  }

  /**
   * Set camera position and scale
   */
  setCameraTransform(offsetX, offsetY, scale) {
    this.offsetX = offsetX;
    this.offsetY = offsetY;
    this.scale = scale;
  }

  /**
   * Get camera transform
   */
  getCameraTransform() {
    return {
      offsetX: this.offsetX,
      offsetY: this.offsetY,
      scale: this.scale
    };
  }

  /**
   * Convert screen coordinates to world coordinates
   */
  screenToWorld(screenX, screenY) {
    return {
      x: (screenX - this.offsetX) / this.scale,
      y: (screenY - this.offsetY) / this.scale
    };
  }

  /**
   * Convert world coordinates to screen coordinates
   */
  worldToScreen(worldX, worldY) {
    return {
      x: worldX * this.scale + this.offsetX,
      y: worldY * this.scale + this.offsetY
    };
  }

  /**
   * Update scale with bounds checking
   */
  updateScale(newScale) {
    this.scale = Math.min(Math.max(0.3, newScale), 3);
  }

  /**
   * Get canvas dimensions
   */
  getCanvasDimensions() {
    return {
      width: this.canvas.width,
      height: this.canvas.height
    };
  }

  /**
   * Start one-time fade-in animation for tactical indicators
   */
  startFadeInAnimation() {
    this.fadeStartTime = Date.now();
    this.isAnimatingFade = true;
    
    // Start animation loop for the duration of the fade
    const animate = () => {
      this.drawMap();
      
      if (this.isAnimatingFade) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  }

  /**
   * Stop fade-in animation (for cleanup)
   */
  stopFadeInAnimation() {
    this.isAnimatingFade = false;
    this.fadeStartTime = null;
    // Redraw once more to ensure final state
    this.drawMap();
  }
}