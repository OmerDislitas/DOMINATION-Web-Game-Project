/**
 * AnimationSystem.js - Manages unit movement animations and visual effects
 */

export class AnimationSystem {
  constructor(utils) {
    this.utils = utils;
    this.animatingUnits = new Map(); // key: "row,col", value: animation data
    this.animatingCircles = new Map(); // key: unique ID, value: circle animation data
    this.animationId = null;
    this.circleIdCounter = 0;
    
    // Animation configuration
    this.ANIMATION_DURATION = 300; // milliseconds
    this.CIRCLE_FADE_DURATION = 300; // milliseconds for circle fade-in
    this.EASING_FACTOR = 0.15; // for smooth easing (lower = smoother, higher = faster)
  }

  /**
   * Easing function for smooth animation
   */
  easeOutQuad(t) {
    return t * (2 - t);
  }

  /**
   * Start the animation loop
   */
  startAnimationLoop() {
    const animate = () => {
      if (this.animatingUnits.size > 0 || this.animatingCircles.size > 0) {
        // Trigger a redraw
        if (window.drawMap) window.drawMap();
        this.animationId = requestAnimationFrame(animate);
      } else {
        this.animationId = null;
      }
    };
    
    if (!this.animationId) {
      this.animationId = requestAnimationFrame(animate);
    }
  }

  /**
   * Animate unit movement from one tile to another
   */
  animateUnitMovement(fromTile, toTile, unitType, scale, offsetX, offsetY) {
    const fromPos = this.utils.hexToPixel(fromTile.row, fromTile.col);
    const toPos = this.utils.hexToPixel(toTile.row, toTile.col);

    const startX = fromPos.x * scale + offsetX;
    const startY = fromPos.y * scale + offsetY;
    const endX = toPos.x * scale + offsetX;
    const endY = toPos.y * scale + offsetY;

    const unitKey = `${toTile.row},${toTile.col}`;

    this.animatingUnits.set(unitKey, {
      startTime: Date.now(),
      startX: startX,
      startY: startY,
      endX: endX,
      endY: endY,
      type: unitType
    });

    this.startAnimationLoop();
  }

  /**
   * Create an animated circle effect
   */
  createAnimatedCircle(x, y, radius = 20, animationType = 'pulse', duration = null, color = null, withStroke = false) {
    const circleId = ++this.circleIdCounter;

    this.animatingCircles.set(circleId, {
      x: x,
      y: y,
      radius: radius,
      animationType: animationType, // 'fadeIn', 'fadeOut', 'pulse'
      duration: duration || this.CIRCLE_FADE_DURATION,
      color: color || [255, 0, 0], // RGB array
      stroke: withStroke,
      strokeWidth: 2,
      startTime: Date.now()
    });

    this.startAnimationLoop();
    return circleId;
  }

  /**
   * Create a circle at a specific tile
   */
  createCircleAtTile(tile, radius = 20, withStroke = false, scale = 1, offsetX = 0, offsetY = 0) {
    const { x, y } = this.utils.hexToPixel(tile.row, tile.col);
    const screenX = x * scale + offsetX;
    const screenY = y * scale + offsetY;

    return this.createAnimatedCircle(screenX, screenY, radius, 'pulse', null, [255, 0, 0], withStroke);
  }

  /**
   * Get current animation position for a unit
   */
  getUnitAnimationPosition(row, col) {
    const unitKey = `${row},${col}`;
    const animData = this.animatingUnits.get(unitKey);
    
    if (!animData) return null;

    const currentTime = Date.now();
    if (currentTime - animData.startTime >= this.ANIMATION_DURATION) {
      // Animation complete, clean up
      this.animatingUnits.delete(unitKey);
      return null;
    }

    // Calculate interpolated position
    const progress = (currentTime - animData.startTime) / this.ANIMATION_DURATION;
    const easedProgress = this.easeOutQuad(progress);

    return {
      x: animData.startX + (animData.endX - animData.startX) * easedProgress,
      y: animData.startY + (animData.endY - animData.startY) * easedProgress,
      type: animData.type
    };
  }

  /**
   * Draw all animated circles
   */
  drawAnimatedCircles(ctx) {
    const currentTime = Date.now();
    const toDelete = [];

    this.animatingCircles.forEach((circleData, circleId) => {
      const elapsed = currentTime - circleData.startTime;

      if (elapsed >= circleData.duration) {
        toDelete.push(circleId);
        return;
      }

      // Calculate opacity based on animation type
      const progress = elapsed / circleData.duration;
      let opacity;

      switch (circleData.animationType) {
        case 'fadeIn':
          opacity = this.easeOutQuad(progress); // 0 to 1
          break;
        case 'fadeOut':
          opacity = 1 - this.easeOutQuad(progress); // 1 to 0
          break;
        case 'pulse':
        default:
          // Fade in then fade out
          if (progress < 0.5) {
            opacity = this.easeOutQuad(progress * 2); // First half: 0 to 1
          } else {
            opacity = 1 - this.easeOutQuad((progress - 0.5) * 2); // Second half: 1 to 0
          }
          break;
      }

      // Draw the circle
      const color = circleData.color || [255, 0, 0];
      ctx.beginPath();
      ctx.arc(circleData.x, circleData.y, circleData.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${opacity * 0.3})`;
      ctx.fill();

      // Optional stroke
      if (circleData.stroke) {
        ctx.strokeStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${opacity * 0.8})`;
        ctx.lineWidth = circleData.strokeWidth || 2;
        ctx.stroke();
      }
    });

    // Clean up completed animations
    toDelete.forEach(id => this.animatingCircles.delete(id));
  }

  /**
   * Check if a unit is currently animating
   */
  isUnitAnimating(row, col) {
    const unitKey = `${row},${col}`;
    const animData = this.animatingUnits.get(unitKey);
    
    if (!animData) return false;

    const currentTime = Date.now();
    return currentTime - animData.startTime < this.ANIMATION_DURATION;
  }

  /**
   * Clear all animations
   */
  clearAllAnimations() {
    this.animatingUnits.clear();
    this.animatingCircles.clear();
    
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  /**
   * Create a combat effect
   */
  createCombatEffect(tile, scale = 1, offsetX = 0, offsetY = 0) {
    const { x, y } = this.utils.hexToPixel(tile.row, tile.col);
    const screenX = x * scale + offsetX;
    const screenY = y * scale + offsetY;

    // Create multiple circles for combat effect
    this.createAnimatedCircle(screenX, screenY, 15, 'pulse', 200, [255, 100, 0], true); // Orange
    setTimeout(() => {
      this.createAnimatedCircle(screenX, screenY, 25, 'fadeOut', 300, [255, 0, 0], false); // Red
    }, 100);
  }

  /**
   * Create a capture effect
   */
  createCaptureEffect(tile, scale = 1, offsetX = 0, offsetY = 0) {
    const { x, y } = this.utils.hexToPixel(tile.row, tile.col);
    const screenX = x * scale + offsetX;
    const screenY = y * scale + offsetY;

    // Create a green capture effect
    this.createAnimatedCircle(screenX, screenY, 30, 'pulse', 400, [0, 255, 0], true);
  }

  /**
   * Create a movement trail effect
   */
  createMovementTrail(fromTile, toTile, scale = 1, offsetX = 0, offsetY = 0) {
    const fromPos = this.utils.hexToPixel(fromTile.row, fromTile.col);
    const toPos = this.utils.hexToPixel(toTile.row, toTile.col);

    const startX = fromPos.x * scale + offsetX;
    const startY = fromPos.y * scale + offsetY;
    const endX = toPos.x * scale + offsetX;
    const endY = toPos.y * scale + offsetY;

    // Create multiple small circles along the path
    const steps = 5;
    for (let i = 0; i <= steps; i++) {
      const progress = i / steps;
      const x = startX + (endX - startX) * progress;
      const y = startY + (endY - startY) * progress;
      
      setTimeout(() => {
        this.createAnimatedCircle(x, y, 8, 'fadeOut', 200, [100, 150, 255], false);
      }, i * 50);
    }
  }

  /**
   * Get animation status
   */
  getAnimationStatus() {
    return {
      animatingUnits: this.animatingUnits.size,
      animatingCircles: this.animatingCircles.size,
      isRunning: this.animationId !== null
    };
  }
}