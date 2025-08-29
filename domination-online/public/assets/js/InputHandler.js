/**
 * InputHandler.js - Handles mouse/keyboard events and camera controls
 */

export class InputHandler {
  constructor(canvas, canvasRenderer, gameLogic) {
    this.canvas = canvas;
    this.canvasRenderer = canvasRenderer;
    this.gameLogic = gameLogic;
    
    // Mouse/touch state
    this.isDragging = false;
    this.lastMouseX = 0;
    this.lastMouseY = 0;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.hasDragged = false;
    
    // Touch support
    this.lastTouchDistance = 0;
    this.isTouching = false;
    
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Mouse events
    this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
    this.canvas.addEventListener('mouseleave', (e) => this.handleMouseLeave(e));
    this.canvas.addEventListener('click', (e) => this.handleClick(e));
    this.canvas.addEventListener('wheel', (e) => this.handleWheel(e));

    // Touch events for mobile support
    this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e));
    this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e));
    this.canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e));

    // Keyboard events
    document.addEventListener('keydown', (e) => this.handleKeyDown(e));
    document.addEventListener('keyup', (e) => this.handleKeyUp(e));

    // Window events
    window.addEventListener('resize', () => this.handleResize());
  }

  /**
   * Handle mouse down event
   */
  handleMouseDown(e) {
    this.isDragging = true;
    this.lastMouseX = e.clientX;
    this.lastMouseY = e.clientY;
    this.dragStartX = e.clientX;
    this.dragStartY = e.clientY;
    this.hasDragged = false;
    
    // Prevent context menu on right click
    if (e.button === 2) {
      e.preventDefault();
    }
  }

  /**
   * Handle mouse move event
   */
  handleMouseMove(e) {
    if (!this.isDragging) return;

    const dx = e.clientX - this.lastMouseX;
    const dy = e.clientY - this.lastMouseY;

    // Check if mouse has moved enough to be considered dragging
    if (Math.abs(e.clientX - this.dragStartX) > 5 || Math.abs(e.clientY - this.dragStartY) > 5) {
      this.hasDragged = true;
    }

    // Update camera position
    const transform = this.canvasRenderer.getCameraTransform();
    this.canvasRenderer.setCameraTransform(
      transform.offsetX + dx,
      transform.offsetY + dy,
      transform.scale
    );

    this.lastMouseX = e.clientX;
    this.lastMouseY = e.clientY;

    // Redraw the map
    this.canvasRenderer.drawMap();
  }

  /**
   * Handle mouse up event
   */
  handleMouseUp(e) {
    this.isDragging = false;
  }

  /**
   * Handle mouse leave event
   */
  handleMouseLeave(e) {
    this.isDragging = false;
  }

  /**
   * Handle click event
   */
  handleClick(e) {
    // Don't process click if we were dragging
    if (this.hasDragged) return;

    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const clickedTile = this.canvasRenderer.getHexAt(mouseX, mouseY);
    
    // Handle right click differently
    if (e.button === 2) {
      this.handleRightClick(clickedTile, mouseX, mouseY);
      return;
    }

    // Handle left click
    this.gameLogic.handleTileClick(clickedTile);
  }

  /**
   * Handle right click (context menu)
   */
  handleRightClick(tile, mouseX, mouseY) {
    if (tile) {
      // Right click could show context menu or perform alternative action
      console.log(`Right clicked on tile (${tile.row}, ${tile.col})`);
      
      // For now, just clear selection
      this.gameLogic.clearSelection();
    }
  }

  /**
   * Handle mouse wheel for zooming
   */
  handleWheel(e) {
    e.preventDefault();

    const zoomFactor = 0.1;
    const delta = e.deltaY > 0 ? -zoomFactor : zoomFactor;
    const transform = this.canvasRenderer.getCameraTransform();
    const newScale = Math.min(Math.max(0.3, transform.scale + delta), 3);

    // Get mouse position for zoom center
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Calculate world coordinates at mouse position
    const worldX = (mouseX - transform.offsetX) / transform.scale;
    const worldY = (mouseY - transform.offsetY) / transform.scale;

    // Adjust offset to zoom towards mouse position
    const newOffsetX = mouseX - worldX * newScale;
    const newOffsetY = mouseY - worldY * newScale;

    this.canvasRenderer.setCameraTransform(newOffsetX, newOffsetY, newScale);
    this.canvasRenderer.drawMap();
  }

  /**
   * Handle touch start event
   */
  handleTouchStart(e) {
    e.preventDefault();
    
    if (e.touches.length === 1) {
      // Single touch - start dragging
      const touch = e.touches[0];
      this.isDragging = true;
      this.lastMouseX = touch.clientX;
      this.lastMouseY = touch.clientY;
      this.dragStartX = touch.clientX;
      this.dragStartY = touch.clientY;
      this.hasDragged = false;
    } else if (e.touches.length === 2) {
      // Two finger touch - start pinch zoom
      this.isDragging = false;
      this.isTouching = true;
      
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      
      this.lastTouchDistance = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) +
        Math.pow(touch2.clientY - touch1.clientY, 2)
      );
    }
  }

  /**
   * Handle touch move event
   */
  handleTouchMove(e) {
    e.preventDefault();
    
    if (e.touches.length === 1 && this.isDragging) {
      // Single finger drag
      const touch = e.touches[0];
      const dx = touch.clientX - this.lastMouseX;
      const dy = touch.clientY - this.lastMouseY;

      if (Math.abs(touch.clientX - this.dragStartX) > 5 || Math.abs(touch.clientY - this.dragStartY) > 5) {
        this.hasDragged = true;
      }

      const transform = this.canvasRenderer.getCameraTransform();
      this.canvasRenderer.setCameraTransform(
        transform.offsetX + dx,
        transform.offsetY + dy,
        transform.scale
      );

      this.lastMouseX = touch.clientX;
      this.lastMouseY = touch.clientY;
      this.canvasRenderer.drawMap();
      
    } else if (e.touches.length === 2 && this.isTouching) {
      // Two finger pinch zoom
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      
      const currentDistance = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) +
        Math.pow(touch2.clientY - touch1.clientY, 2)
      );

      if (this.lastTouchDistance > 0) {
        const scaleFactor = currentDistance / this.lastTouchDistance;
        const transform = this.canvasRenderer.getCameraTransform();
        const newScale = Math.min(Math.max(0.3, transform.scale * scaleFactor), 3);

        // Get center point between touches
        const centerX = (touch1.clientX + touch2.clientX) / 2;
        const centerY = (touch1.clientY + touch2.clientY) / 2;

        const rect = this.canvas.getBoundingClientRect();
        const canvasCenterX = centerX - rect.left;
        const canvasCenterY = centerY - rect.top;

        // Calculate world coordinates at center
        const worldX = (canvasCenterX - transform.offsetX) / transform.scale;
        const worldY = (canvasCenterY - transform.offsetY) / transform.scale;

        // Adjust offset to zoom towards touch center
        const newOffsetX = canvasCenterX - worldX * newScale;
        const newOffsetY = canvasCenterY - worldY * newScale;

        this.canvasRenderer.setCameraTransform(newOffsetX, newOffsetY, newScale);
        this.canvasRenderer.drawMap();
      }

      this.lastTouchDistance = currentDistance;
    }
  }

  /**
   * Handle touch end event
   */
  handleTouchEnd(e) {
    e.preventDefault();
    
    if (e.touches.length === 0) {
      // All touches ended
      if (!this.hasDragged && !this.isTouching) {
        // This was a tap, not a drag or pinch
        const touch = e.changedTouches[0];
        const rect = this.canvas.getBoundingClientRect();
        const touchX = touch.clientX - rect.left;
        const touchY = touch.clientY - rect.top;

        const clickedTile = this.canvasRenderer.getHexAt(touchX, touchY);
        this.gameLogic.handleTileClick(clickedTile);
      }
      
      this.isDragging = false;
      this.isTouching = false;
      this.lastTouchDistance = 0;
    } else if (e.touches.length === 1) {
      // One touch remaining, switch back to drag mode
      this.isTouching = false;
      this.lastTouchDistance = 0;
      
      const touch = e.touches[0];
      this.isDragging = true;
      this.lastMouseX = touch.clientX;
      this.lastMouseY = touch.clientY;
      this.hasDragged = false;
    }
  }

  /**
   * Handle keyboard events
   */
  handleKeyDown(e) {
    const transform = this.canvasRenderer.getCameraTransform();
    const moveSpeed = 50;
    
    switch (e.key) {
      case 'ArrowUp':
      case 'w':
      case 'W':
        this.canvasRenderer.setCameraTransform(
          transform.offsetX,
          transform.offsetY + moveSpeed,
          transform.scale
        );
        this.canvasRenderer.drawMap();
        e.preventDefault();
        break;
        
      case 'ArrowDown':
      case 's':
      case 'S':
        this.canvasRenderer.setCameraTransform(
          transform.offsetX,
          transform.offsetY - moveSpeed,
          transform.scale
        );
        this.canvasRenderer.drawMap();
        e.preventDefault();
        break;
        
      case 'ArrowLeft':
      case 'a':
      case 'A':
        this.canvasRenderer.setCameraTransform(
          transform.offsetX + moveSpeed,
          transform.offsetY,
          transform.scale
        );
        this.canvasRenderer.drawMap();
        e.preventDefault();
        break;
        
      case 'ArrowRight':
      case 'd':
      case 'D':
        this.canvasRenderer.setCameraTransform(
          transform.offsetX - moveSpeed,
          transform.offsetY,
          transform.scale
        );
        this.canvasRenderer.drawMap();
        e.preventDefault();
        break;
        
      case '+':
      case '=':
        this.zoomIn();
        e.preventDefault();
        break;
        
      case '-':
      case '_':
        this.zoomOut();
        e.preventDefault();
        break;
        
      case 'Escape':
        this.gameLogic.clearSelection();
        e.preventDefault();
        break;
        
      case ' ':
        this.centerCamera();
        e.preventDefault();
        break;
    }
  }

  /**
   * Handle key up events
   */
  handleKeyUp(e) {
    // Currently no specific key up handling needed
  }

  /**
   * Handle window resize
   */
  handleResize() {
    // Canvas resize should be handled by the main application
    // This is just to trigger a redraw if needed
    setTimeout(() => {
      this.canvasRenderer.drawMap();
    }, 100);
  }

  /**
   * Zoom in
   */
  zoomIn() {
    const transform = this.canvasRenderer.getCameraTransform();
    const newScale = Math.min(3, transform.scale + 0.1);
    
    // Zoom towards center of canvas
    const rect = this.canvas.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    const worldX = (centerX - transform.offsetX) / transform.scale;
    const worldY = (centerY - transform.offsetY) / transform.scale;
    
    const newOffsetX = centerX - worldX * newScale;
    const newOffsetY = centerY - worldY * newScale;
    
    this.canvasRenderer.setCameraTransform(newOffsetX, newOffsetY, newScale);
    this.canvasRenderer.drawMap();
  }

  /**
   * Zoom out
   */
  zoomOut() {
    const transform = this.canvasRenderer.getCameraTransform();
    const newScale = Math.max(0.3, transform.scale - 0.1);
    
    // Zoom towards center of canvas
    const rect = this.canvas.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    const worldX = (centerX - transform.offsetX) / transform.scale;
    const worldY = (centerY - transform.offsetY) / transform.scale;
    
    const newOffsetX = centerX - worldX * newScale;
    const newOffsetY = centerY - worldY * newScale;
    
    this.canvasRenderer.setCameraTransform(newOffsetX, newOffsetY, newScale);
    this.canvasRenderer.drawMap();
  }

  /**
   * Center camera on the map
   */
  centerCamera() {
    this.canvasRenderer.centerCameraOnMap();
    this.canvasRenderer.drawMap();
  }

  /**
   * Set camera to specific position
   */
  setCameraPosition(x, y, scale = null) {
    const transform = this.canvasRenderer.getCameraTransform();
    this.canvasRenderer.setCameraTransform(
      x,
      y,
      scale !== null ? scale : transform.scale
    );
    this.canvasRenderer.drawMap();
  }

  /**
   * Get current mouse/touch position
   */
  getCurrentPointerPosition() {
    return {
      x: this.lastMouseX,
      y: this.lastMouseY
    };
  }

  /**
   * Check if currently dragging
   */
  isDraggingCamera() {
    return this.isDragging;
  }

  /**
   * Enable/disable input handling
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    
    if (!enabled) {
      this.isDragging = false;
      this.isTouching = false;
    }
  }
}