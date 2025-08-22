
// Sunucuya bağlan
const socket = io();

// Add connection event handlers for debugging
socket.on('connect', () => {
  console.log('Connected to server with ID:', socket.id);
});

socket.on('disconnect', () => {
  console.log('Disconnected from server');
});

socket.on('error', (error) => {
  console.error('Socket error:', error);
  alert('Error: ' + error);
});

function joinRoomFromInput() {
  const code = (document.getElementById('joincode')?.value || '').toUpperCase().trim();
  if (!code) return;
  setPlayerName();
  socket.emit('room:join', { code });
}

// Oda/oyun mesajları
socket.on('rooms:list', (rooms) => {
  const panel = document.querySelector('.room-scroll-panel');
  if (!panel) return;
  panel.innerHTML = '';
  rooms.forEach(r => {
    const btn = document.createElement('button');
    btn.className = 'room-entry-item';
    btn.innerHTML = `<span>${r.name} (${r.code})</span>
      <div><i class="bi bi-person-fill"></i><span>${r.count}/${r.capacity}</span></div>`;
    btn.onclick = () => socket.emit('room:join', { code: r.code });
    panel.appendChild(btn);
  });
});


let currentRoomCode = null;

// Sunucudan "oda oluşturuldu" cevabı gelince Waiting Room'a geç
socket.on('room:created', ({ code, room }) => {
  const label = document.querySelector('.jersey-text');
  if (label) label.textContent = 'ROOM CODE: ' + code;
  showScreen('screen-waiting-room');
});


// room:update render'ını genişlet
socket.on('room:update', (room) => {
 
  const panel = document.querySelector('.player-scroll-panel');
  if (panel) {
    panel.innerHTML = '';
    room.players.forEach(p => {
  const div = document.createElement('div');
  div.className = 'player-waiting';
  div.innerHTML = `<i class="bi bi-person-fill"></i><span>${p.name}</span>`;

  //  Renk bilgisini border’a uygula
  if (p.color) {
    div.style.boxShadow = `inset 0 0 0 4px ${p.color}`;
  }

  panel.appendChild(div);
  const header = document.querySelector('.waiting-room-header');
  if (header) {
    header.textContent = `ROOM: ${room.name} (${room.isPrivate ? "PRIVATE" : "NON-PRIVATE"})`;
  }
});
  }

  // kapasite
  const capEl = document.getElementById('capacity');
  if (capEl) capEl.textContent = `${room.players.length}/${room.capacity}`;

  //  renk karelerini güncelle
  const myId = socket.id;
  const my = room.players.find(p => p.id === myId);
  const usedColors = new Set(room.players.map(p => p.color).filter(Boolean));

  document.querySelectorAll('.color-element').forEach(el => {
    const color = el.dataset.color;
    el.classList.remove('taken', 'selected');

    // başka biri kullanıyorsa 'taken'
    if (usedColors.has(color)) el.classList.add('taken');
    // ben kullanıyorsam 'selected' (ve seçiliyken 'taken' görünümünü iptal et)
    if (my && my.color === color) {
      el.classList.add('selected');
      el.classList.remove('taken');
    }
  });
});


// Handle successful room join
// odaya ilk katıldığında verilen otomatik rengi ve kodu göstermek için
socket.on('room:joined', (room) => {
  const label = document.querySelector('.jersey-text');
  if (label) label.textContent = 'ROOM CODE: ' + room.code;
  showScreen('screen-waiting-room');
  wireColorPickers();

  const header = document.querySelector('.waiting-room-header');
  if (header) {
    header.textContent = `ROOM: ${room.name} (${room.isPrivate ? "PRIVATE" : "NON-PRIVATE"})`;
  }
});

// Sunucu state'i ilk kez geldiğinde
socket.on('game:init', ({ state }) => {
  console.log('Game initialized with state:', state);
  if (Array.isArray(state.landData) && state.landData.length > 0) {
    window.landData = state.landData; // sunucuda harita varsa onu al
  } // else: yereldeki harita kalsın
  if (window.drawMap) window.drawMap();
});

socket.on('game:update', (patch) => {
  console.log('Game updated:', patch);
  if (patch.landData) window.landData = patch.landData;
  if (window.drawMap) window.drawMap();
});
function wireColorPickers() {
    document.querySelectorAll('.color-element').forEach(el => {
      el.addEventListener('click', () => {
        const color = el.dataset.color;
        // rezerve edilmişse tıklama işleme
        if (el.classList.contains('taken') && !el.classList.contains('selected')) return;
        socket.emit('room:pickColor', { color });
      });
    });
  }
// Login ekranında oyuncu adını gönder
function setPlayerName() {
  const name = document.getElementById('username')?.value || 'Player';
  socket.emit('login:setName', name);
}

// "JOIN THE ROOM" tıklanınca
function goJoinRooms() {
  setPlayerName();
  socket.emit('rooms:list');
  showScreen('screen-join-room');
}

// "CREATE ROOM" tıklanınca
function createRoom() {
  setPlayerName();
  const roomName = document.getElementById('roomname')?.value || 'ROOM';
  const capacity = parseInt(document.getElementById('capacity-value')?.innerText || '4', 10);
  const isPrivate = document.querySelector('.checkbox-box')?.classList.contains('active');

  socket.emit('room:create', { roomName, capacity, isPrivate });
}
function leaveRoom() {
  socket.emit('room:leave');
  showScreen('screen-login');
}

// Bekleme odasında START
function startGame() {
  console.log('Starting game...');
  // İlk elde server'a haritayı bir kez yolla (server boşsa set ediyor)
  socket.emit('game:start', { landData: window.landData });
  showScreen('screen-game');
}

function showScreen(screenId) {
  console.log('Switching to screen:', screenId);
  // Tüm ekranlardan "active" sınıfını kaldır
  const screens = document.querySelectorAll('.screen');
  screens.forEach(screen => screen.classList.remove('active'));

  // Sadece istenen ekrana "active" sınıfı ekle
  const targetScreen = document.getElementById(screenId);
  if (targetScreen) {
    targetScreen.classList.add('active');
  } else {
    console.error('Screen not found:', screenId);
  }
}
window.showScreen = showScreen;

let capacity = 4;

function increaseCapacity() {
  if (capacity < 6) {
    capacity++;
    const capacityElement = document.getElementById("capacity-value");
    if (capacityElement) {
      capacityElement.textContent = capacity;
    }
  }
}

function decreaseCapacity() {
  if (capacity > 2) {
    capacity--;
    const capacityElement = document.getElementById("capacity-value");
    if (capacityElement) {
      capacityElement.textContent = capacity;
    }
  }
}

function toggleCheckbox(el) {
  const box = el.querySelector('.checkbox-box');
  if (box) {
    box.classList.toggle('active');
    const isChecked = box.classList.contains('active');
    console.log("Private mode:", isChecked);
  }
}

// Make functions globally available
window.createRoom = createRoom;
window.goJoinRooms = goJoinRooms;
window.joinRoomFromInput = joinRoomFromInput;
window.startGame = startGame;
window.increaseCapacity = increaseCapacity;
window.decreaseCapacity = decreaseCapacity;
window.toggleCheckbox = toggleCheckbox;

// Rest of your game code continues here...
document.addEventListener('DOMContentLoaded', () => {
  // Add these new variables at the top of your DOMContentLoaded event listener
  let animatingUnits = new Map(); // key: "row,col", value: animation data
  let animatingCircles = new Map(); // key: unique ID, value: circle animation data
  let animationId = null;
  let circleIdCounter = 0;

  // Animation configuration
  // Animation configuration
  const ANIMATION_DURATION = 300; // milliseconds
  const CIRCLE_FADE_DURATION = 300; // milliseconds for circle fade-in
  const EASING_FACTOR = 0.15; // for smooth easing (lower = smoother, higher = faster)

  const canvas = document.getElementById('myCanvas');
  const ctx = canvas?.getContext('2d');
  if (!ctx) {
    console.error('Canvas context not found');
    return;
  }

  let reachableTiles = [];
  let edgeTiles = []; // 4 adımının 3'ünü kendi toprağında atabileceğin kenar seti
  let capturableTiles = []; // ele geçirilebilir düşman land'ları
  const tileSize = 40; // Hex yarıçapı
  const hexHeight = Math.sqrt(3) * tileSize;
  let selectedTile = null; // Seçilen hex (örneğin { row: 1, col: 3 })
  let selectedUnit = null;

  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;
  let isDragging = false;
  let lastMouseX = 0;
  let lastMouseY = 0;

  const buildMenu = document.getElementById('build-menu');
  const unitMenu = document.getElementById('unit-menu');

  const unitImages = {
    peasant: new Image(),
    spearman: new Image(),
    swordsman: new Image(),
    knight: new Image()
  };

  // Dosya yolları
  unitImages.peasant.src = 'assets/img/man1.png';
  unitImages.spearman.src = 'assets/img/man2.png';
  unitImages.swordsman.src = 'assets/img/man3.png';
  unitImages.knight.src = 'assets/img/man4.png';

  const objectImages = {
    house: new Image(),
    castle: new Image(),
    tower: new Image(),
    strong_tower: new Image()
  };
  objectImages.house.src = 'assets/img/house.png';
  objectImages.castle.src = 'assets/img/castle.png';
  objectImages.tower.src = 'assets/img/tower.png';
  objectImages.strong_tower.src = 'assets/img/strong_tower.png';

  let dragStartX = 0;
  let dragStartY = 0;
  let hasDragged = false;

  const objectSizes = {
    house: 48,
    castle: 48,
    tower: 48,
    strong_tower: 48,
    peasant: 48,
    spearman: 48,
    swordsman: 48,
    knight: 48
  };
  const unitSizes = {
    peasant: 48,
    spearman: 48,
    swordsman: 48,
    knight: 48
  };

  // Örnek #land verisi
  window.landData = `
5 3 1
6 3 1
7 3 1 tower
8 3 1 
9 3 1

4 4 3
5 4 3 tower
6 4 1
7 4 1
8 4 1
9 4 1
10 4 0

3 5 3
4 5 3
5 5 3
6 5 3
7 5 1
8 5 1
9 5 0
10 5 0

2 6 3
3 6 3
4 6 3
5 6 3
6 6 3
7 6 2
8 6 0
9 6 0
10 6 0
11 6 0

2 7 3
3 7 3
4 7 3
5 7 3
6 7 2
7 7 2
8 7 0
9 7 0
10 7 0

3 8 3
4 8 3
5 8 2 tower
6 8 2 
7 8 2
8 8 2
9 8 0
10 8 0

4 9 2
5 9 2
6 9 2
7 9 2
8 9 2
9 9 2

5 10 2
6 10 2 tower
7 10 2
8 10 2 

`.trim().split('\n');

  // Move unitData outside or make it global
  window.unitData = `
4 4 3 peasant
4 5 3 spearman
`.trim().split('\n');

  window.hexDirections = [
    { q: 1, r: 0 },
    { q: 1, r: -1 },
    { q: 0, r: -1 },
    { q: -1, r: 0 },
    { q: -1, r: 1 },
    { q: 0, r: 1 }
  ];

  // Oyuncu renkleri
  const colors = ['#4CAF50', '#14BBC7', '#EE6B19', '#BC1EA7'];

  // Unit power levels
  window.unitPower = { peasant: 1, spearman: 2, swordsman: 3, knight: 4 };

  const BUILDING_PROT = { tower: 2, strong_tower: 3 };
  
  

  function getObjectAt(tile) {
    const line = window.landData.find(l => {
      const [r, c] = l.trim().split(/\s+/);
      return +r === tile.row && +c === tile.col;
    });
    if (!line) return null;
    const parts = line.trim().split(/\s+/);
    return parts[3] || null; // 4. token obje
  }
  // NEW: Land protection system
  window.landProtection = new Map(); // key: "row,col", value: protection level
  if (buildMenu) {
    buildMenu.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn || !selectedTile) return;

      const obj = btn.dataset.object; // "castle" | "tower" | "strong_tower"
      window.landData = window.landData.map(line => {
        const parts = line.trim().split(/\s+/);
        const [r, c, p] = parts;
        if (+r === selectedTile.row && +c === selectedTile.col) {
          return `${r} ${c} ${p} ${obj}`;
        }
        return line;
      });

      updateAllLandProtections(); // korumaları yenile
      drawMap();
    });
  }

  // NEW: Calculate protection level for a specific tile
  function calculateLandProtection(tile) {
    const landOwner = getLandOwner(tile);
    if (landOwner === null) return 0;

    let maxProtection = 0;

    // 1) Tile'ın KENDİSİNDEKİ bina (aynı renkteyse)
    const selfObj = getObjectAt(tile);
    const selfOwner = getLandOwner(tile);
    const selfVal = BUILDING_PROT[selfObj] || 0;
    if (selfVal && selfOwner === landOwner) {
      maxProtection = Math.max(maxProtection, selfVal);
    }

    // 2) KOMŞULARDAN gelen bina ve birim koruması (aynı renkteyse)
    const neighbors = getNeighbors(tile);
    neighbors.forEach(nb => {
      const nbOwner = getLandOwner(nb);
      if (nbOwner !== landOwner) return;

      // Bina koruması
      const nbObj = getObjectAt(nb);
      const nbVal = BUILDING_PROT[nbObj] || 0;
      if (nbVal) maxProtection = Math.max(maxProtection, nbVal);

      // Birim koruması (zaten vardı)
      const unit = getUnitAt(nb);
      if (unit && unit.player === landOwner) {
        const unitProtection = window.unitPower[unit.type] || 0;
        maxProtection = Math.max(maxProtection, unitProtection);
      }
    });

    return maxProtection;
  }

  // NEW: Update all land protections dynamically
  function updateAllLandProtections() {
    window.landProtection.clear();

    window.landData.forEach(line => {
      const [row, col] = line.trim().split(/\s+/);
      const tile = { row: parseInt(row), col: parseInt(col) };
      const protection = calculateLandProtection(tile);
      window.landProtection.set(`${tile.row},${tile.col}`, protection);
    });
  }

  // NEW: Get protection level for a tile
  function getLandProtection(tile) {
    return window.landProtection.get(`${tile.row},${tile.col}`) || 0;
  }

  window.onload = () => {
    updateAllLandProtections(); // Initialize protections
    initializecastleDistribution();
    drawMap();
  };

  function getUnitOwner(tile) {
    const landLine = window.landData.find(line => {
      const [r, c, player] = line.trim().split(/\s+/);
      return parseInt(r) === tile.row && parseInt(c) === tile.col;
    });

    if (!landLine) return null;

    const [, , playerId] = landLine.trim().split(/\s+/);
    return parseInt(playerId);
  }

  // Altıgen çizimi
  function drawHex(x, y, fillColor, strokeColor = '#0C666C', lineWidth = 5) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = Math.PI / 3 * i;
      const px = x + tileSize * scale * Math.cos(angle);
      const py = y + tileSize * scale * Math.sin(angle);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();

    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = strokeColor;
    ctx.stroke();

    ctx.lineWidth = 5;
    ctx.strokeStyle = '#0C666C';
  }

  // Satır/sütun -> pixel koordinatı (flat-top hex)
  function hexToPixel(row, col) {
    const x = tileSize * 1.5 * col;
    const y = hexHeight * (row + 0.5 * (col % 2));
    return { x, y };
  }

  // Haritayı çiz
  function drawMap() {
    recomputeProtection(); // <-- her çizim başında
    let selectedRenderInfo = null;
    let selectedObj = null;
    ctx.fillStyle = '#0C666C';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    window.landData.forEach(line => {
      const [row, col, player, obj] = line.split(' ');
      const r = parseInt(row);
      const c = parseInt(col);
      const { x, y } = hexToPixel(r, c);
      const centerX = x * scale + offsetX;
      const centerY = y * scale + offsetY;

      // Seçilen tile farklıysa normal şekilde çiz
      let fillColor = colors[player % colors.length];

      // Seçili tile ise farklı çizim uygula
      const isSelected = selectedTile && selectedTile.row === r && selectedTile.col === c;

      if (isSelected) {
        const inRange = reachableTiles.some(tile =>
          tile.row === r && tile.col === c
        );

        if (inRange) {
          ctx.beginPath();
          ctx.strokeStyle = 'red';
          ctx.lineWidth = 2;
          ctx.arc(centerX, centerY, tileSize * scale * 0.45, 0, Math.PI * 2);
          ctx.stroke();
        }

        selectedRenderInfo = { x: centerX, y: centerY, fillColor };
        selectedObj = obj;
        if (inRange) {
          ctx.beginPath();
          ctx.strokeStyle = 'red';
          ctx.lineWidth = 2;
          ctx.arc(centerX, centerY, tileSize * scale * 0.45, 0, Math.PI * 2);
          ctx.stroke();
        }
      } else {
        drawHex(centerX, centerY, fillColor, '#0C666C', 5); // normal kenar
        const attackerOwner = selectedUnit ? getUnitOwner(selectedUnit) : null;
        const cellOwner = getLandOwner({ row: r, col: c });

        // Show capturable enemy land (with power comparison AND protection check)
        const isCapturable =
          selectedUnit &&
          cellOwner !== null &&
          cellOwner !== attackerOwner &&
          getNeighbors({ row: r, col: c }).some(nb =>
            edgeTiles.some(t => t.row === nb.row && t.col === nb.col)
          );

        // Additional power check: only show as capturable if selected unit is stronger than defending unit AND protection level
        let canCaptureByPower = true;
        if (isCapturable) {
          const defendingUnit = getUnitAt({ row: r, col: c });
          const attackerType = getUnitTypeAt(selectedUnit);
          const attackerPower = window.unitPower[attackerType] || 0;

          // NEW: Check land protection level
          const landProtection = getLandProtection({ row: r, col: c });

          // Attacker must be stronger than both the defending unit AND the land protection
          let defenderPower = 0;
          if (defendingUnit) {
            defenderPower = window.unitPower[defendingUnit.type] || 0;
          }

          const effectiveDefense = Math.max(defenderPower, landProtection);
          canCaptureByPower = attackerPower > effectiveDefense;
        }

        if (isCapturable && canCaptureByPower) {
          ctx.beginPath();
          ctx.strokeStyle = 'red';
          ctx.lineWidth = 6;
          ctx.arc(centerX, centerY, tileSize * scale * 0.45, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Show attackable enemy units (power hierarchy applies)
        const enemyUnit = window.unitData.find(line => {
          const [ur, uc] = line.split(' ');
          return parseInt(ur) === r && parseInt(uc) === c;
        });

        if (selectedUnit && enemyUnit && attackerOwner !== cellOwner) {
          const attackerType = getUnitTypeAt(selectedUnit);
          const enemyType = enemyUnit.split(' ')[3];
          const attackerPower = window.unitPower[attackerType] || 0;
          const enemyPower = window.unitPower[enemyType] || 0;

          // Check if enemy unit is reachable and attacker is stronger
          const enemyReachable = getNeighbors({ row: r, col: c }).some(nb =>
            edgeTiles.some(t => t.row === nb.row && t.col === nb.col)
          );

          if (enemyReachable && attackerPower > enemyPower) {
            ctx.beginPath();
            ctx.strokeStyle = 'orange';
            ctx.lineWidth = 4;
            ctx.arc(centerX, centerY, tileSize * scale * 0.6, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
      }

      if (typeof obj !== 'undefined') {
        drawObject(obj, centerX, centerY);
      }

      // NEW: Draw protection level indicator
      const protection = getLandProtection({ row: r, col: c });
      if (protection > 0) {
        ctx.fillStyle = 'white';
        ctx.font = `${12 * scale}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText(
          protection.toString(),
          centerX + tileSize * scale * 0.6,
          centerY - tileSize * scale * 0.6 + 20 // 20px aşağı
        );
        ctx.fillText(protection.toString(), centerX + tileSize * scale * 0.6, centerY - tileSize * scale * 0.6);
      }
    });

    if (selectedRenderInfo) {
      drawHex(selectedRenderInfo.x, selectedRenderInfo.y, selectedRenderInfo.fillColor, 'yellow', 5);
    }
    if (selectedObj) {
      drawObject(selectedObj, selectedRenderInfo.x, selectedRenderInfo.y);
    }

    reachableTiles.forEach(tile => {
      const { x, y } = hexToPixel(tile.row, tile.col);
      const centerX = x * scale + offsetX;
      const centerY = y * scale + offsetY;

      ctx.beginPath();

      ctx.strokeStyle = 'rgba(255, 0, 0, 0.4)';
      ctx.lineWidth = 8;
      ctx.arc(centerX, centerY, tileSize * scale * 0.5, 0, Math.PI * 2);
      ctx.stroke();
    });

    drawUnits(); // 🔥 birimler en son çiziliyor (üstte dursun)
  }
  window.drawMap = drawMap;
  // Easing function for smooth animation
  function easeOutQuad(t) {
    return t * (2 - t);
  }

  function drawAnimatedCircles(currentTime) {
    const toDelete = [];

    animatingCircles.forEach((circleData, circleId) => {
      const elapsed = currentTime - circleData.startTime;

      if (elapsed >= circleData.duration) {
        // Animation complete, mark for deletion
        toDelete.push(circleId);
        return;
      }

      // Calculate opacity based on animation type
      const progress = elapsed / circleData.duration;
      let opacity;

      if (circleData.animationType === 'fadeIn') {
        opacity = easeOutQuad(progress); // 0 to 1
      } else if (circleData.animationType === 'fadeOut') {
        opacity = 1 - easeOutQuad(progress); // 1 to 0
      } else if (circleData.animationType === 'pulse') {
        // Fade in then fade out
        if (progress < 0.5) {
          opacity = easeOutQuad(progress * 2); // First half: 0 to 1
        } else {
          opacity = 1 - easeOutQuad((progress - 0.5) * 2); // Second half: 1 to 0
        }
      }

      // Apply color and opacity
      const color = circleData.color || [255, 0, 0]; // Default red
      ctx.beginPath();
      ctx.arc(circleData.x, circleData.y, circleData.radius * scale, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${opacity})`;
      ctx.fill();

      // Optional: Add a stroke
      if (circleData.stroke) {
        ctx.strokeStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${opacity * 0.8})`;
        ctx.lineWidth = circleData.strokeWidth || 2;
        ctx.stroke();
      }
    });

    // Clean up completed animations
    toDelete.forEach(id => animatingCircles.delete(id));
  }

  // Animation loop
  function startAnimationLoop() {
    function animate() {
      if (animatingUnits.size > 0) {
        drawMap();
        animationId = requestAnimationFrame(animate);
      } else {
        animationId = null;
      }
    }
    animationId = requestAnimationFrame(animate);
  }
  function drawUnits() {
    const currentTime = Date.now();

    // Draw animated circles first (so they appear behind units)


    window.unitData.forEach(line => {
      const [row, col, player, type] = line.trim().split(/\s+/);
      const r = parseInt(row);
      const c = parseInt(col);
      const unitKey = `${r},${c}`;

      // Check if this unit is currently animating
      const animData = animatingUnits.get(unitKey);

      let centerX, centerY;

      if (animData && currentTime - animData.startTime < ANIMATION_DURATION) {
        // Unit is animating - interpolate position
        const progress = (currentTime - animData.startTime) / ANIMATION_DURATION;
        const easedProgress = easeOutQuad(progress);

        centerX = animData.startX + (animData.endX - animData.startX) * easedProgress;
        centerY = animData.startY + (animData.endY - animData.startY) * easedProgress;
      } else {
        // Unit is not animating or animation is complete
        if (animData) {
          // Clean up completed animation
          animatingUnits.delete(unitKey);
        }

        // Use normal position
        const { x, y } = hexToPixel(r, c);
        centerX = x * scale + offsetX;
        centerY = y * scale + offsetY;
      }

      drawUnit(centerX, centerY, type);
    });
  }
  // Function to draw animated circles

  // Function to create an animated red circle
  function createAnimatedCircle(x, y, radius = 20, withStroke = false) {
    const circleId = ++circleIdCounter;

    animatingCircles.set(circleId, {
      x: x,
      y: y,
      radius: radius,
      stroke: withStroke,
      startTime: Date.now()
    });

    // Start animation loop if not already running
    if (!animationId) {
      startAnimationLoop();
    }

    return circleId; // Return ID in case you want to modify or cancel this specific circle
  }

  // Function to create a circle at a specific tile
  function createCircleAtTile(tile, radius = 20, withStroke = false) {
    const { x, y } = hexToPixel(tile.row, tile.col);
    const screenX = x * scale + offsetX;
    const screenY = y * scale + offsetY;

    return createAnimatedCircle(screenX, screenY, radius, withStroke);
  }


  function animateUnitMovement(fromTile, toTile, unitType) {
    const fromPos = hexToPixel(fromTile.row, fromTile.col);
    const toPos = hexToPixel(toTile.row, toTile.col);

    const startX = fromPos.x * scale + offsetX;
    const startY = fromPos.y * scale + offsetY;
    const endX = toPos.x * scale + offsetX;
    const endY = toPos.y * scale + offsetY;

    const unitKey = `${toTile.row},${toTile.col}`;

    animatingUnits.set(unitKey, {
      startTime: Date.now(),
      startX: startX,
      startY: startY,
      endX: endX,
      endY: endY,
      type: unitType
    });

    // Start animation loop if not already running
    if (!animationId) {
      startAnimationLoop();
    }
  }


  function drawUnit(x, y, type) {
    const img = unitImages[type];
    if (!img || !img.complete) return;

    const baseSize = unitSizes[type] || 32;
    const size = baseSize * scale;

    ctx.drawImage(img, x - size / 2, y - size / 2, size, size);
  }

  function drawObject(obj, x, y) {
    const img = objectImages[obj];
    if (!img || !img.complete) return;

    const baseSize = objectSizes[obj] || 32; // varsayılan 32px
    const size = baseSize * scale;

    ctx.drawImage(img, x - size / 2, y - size / 2, size, size);
  }

  unitMenu.addEventListener('click', (e) => {
    const button = e.target.closest('button');
    if (!button) return;
    const unitType = button.dataset.unit;

    if (!unitType || !selectedTile) {
      return;
    }

    // Zaten aynı tile'da bir birim varsa, bir şey yapma
    const alreadyExists = window.unitData.some(line => {
      const [r, c] = line.split(' ');
      return parseInt(r) === selectedTile.row && parseInt(c) === selectedTile.col;
    });

    if (alreadyExists) {
      alert("Bu tile'da zaten bir birim var.");
      return;
    }

    // Örnek: seçili tile'a oyuncu 1'e ait birim yerleştir
    // Birim, bulunduğu land'in sahibiyle aynı ID'yi almalı
    const ownerId = getLandOwner(selectedTile);
    if (ownerId === null) {
      alert("Sahibi olmayan bir hex'e birim yerleştirilemez.");
      return;
    }


    const newUnitLine = `${selectedTile.row} ${selectedTile.col} ${ownerId} ${unitType}`;
    window.unitData.push(newUnitLine);

    // Koruma değerlerini güncelle ve yeniden çiz
    updateAllLandProtections();
    drawMap();
  });

  canvas.addEventListener('click', (e) => {
    recomputeProtection(); // <-- etkileşimden hemen önce
    if (hasDragged) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const clickedTile = getHexAt(mouseX, mouseY);

    // Hiçbir tile yoksa temizle
    if (!clickedTile) {
      selectedTile = null;
      selectedUnit = null;
      reachableTiles = [];
      edgeTiles = [];
      buildMenu.classList.add('hidden');
      unitMenu.classList.add('hidden');
      drawMap();
      return;
    }

    // Tıklanan tile'da birim var mı?
    const unitOnTile = window.unitData.find(line => {
      const [r, c] = line.split(' ');
      return parseInt(r) === clickedTile.row && parseInt(c) === clickedTile.col;
    });

    const thereIsUnit = !!unitOnTile;

    // Eğer birim zaten seçiliyse, ÖNCE saldırı dene
    if (selectedUnit) {
      const attackerOwner = getUnitOwner(selectedUnit);
      if (selectedUnit && !thereIsUnit) {
        const attackerOwner = getUnitOwner(selectedUnit);
        const targetOwner = getLandOwner(clickedTile);

        if (targetOwner === attackerOwner) {
          // Normal movement: reachableTiles içinde mi?
          const canMove = reachableTiles.some(t => t.row === clickedTile.row && t.col === clickedTile.col);
          if (!canMove) return;

          // Get unit type for animation
          const unitType = getUnitTypeAt(selectedUnit);

          // Start animation before updating data
          animateUnitMovement(selectedUnit, clickedTile, unitType);

          // Create a red circle at the destination to show movement
          createCircleAtTile(clickedTile, 25, true);

          window.unitData = window.unitData.map(line => {
            const [r, c, p, t] = line.split(' ');
            if (+r === selectedUnit.row && +c === selectedUnit.col) {
              return `${clickedTile.row} ${clickedTile.col} ${p} ${t}`;
            }
            return line;
          });
        } else {
          // Land capture with animation
          const canCaptureByPath = getNeighbors(clickedTile).some(nb =>
            edgeTiles.some(t => t.row === nb.row && t.col === nb.col)
          );
          if (!canCaptureByPath) return;

          const attackerType = getUnitTypeAt(selectedUnit);
          const attackerPower = window.unitPower[attackerType] || 0;
          const landProtection = getLandProtection(clickedTile);

          if (attackerPower <= landProtection) {
            console.log(`Attack blocked: ${attackerType} (power ${attackerPower}) cannot capture land with protection ${landProtection}`);
            return;
          }

          // Start animation before updating data
          animateUnitMovement(selectedUnit, clickedTile, attackerType);

          // Capture land and move unit
          setLandOwner(clickedTile, attackerOwner);
          window.unitData = window.unitData.map(line => {
            const [r, c, p, t] = line.split(' ');
            if (+r === selectedUnit.row && +c === selectedUnit.col) {
              return `${clickedTile.row} ${clickedTile.col} ${p} ${t}`;
            }
            return line;
          });
        }

        // Update protections after movement/capture
        updateAllLandProtections();

        // Clean up selection
        selectedUnit = null;
        selectedTile = null;
        reachableTiles = [];
        edgeTiles = [];
        buildMenu.classList.add('hidden');
        unitMenu.classList.add('hidden');
        drawMap();
        return;
      }

      if (thereIsUnit) {
        const targetOwner = getUnitOwner(clickedTile);

        // Enemy combat
        if (targetOwner !== attackerOwner) {
          const reachable = getReachableTiles(selectedUnit, 4, attackerOwner);
          const edge = getReachableTiles(selectedUnit, 3, attackerOwner);

          const canReach = getNeighbors(clickedTile).some(nb =>
            edge.some(t => t.row === nb.row && t.col === nb.col)
          );

          if (!canReach) return;

          // Power check
          const attackerType = getUnitTypeAt(selectedUnit);
          const defenderType = getUnitTypeAt(clickedTile);
          const attackerPower = window.unitPower[attackerType] || 0;
          const defenderPower = window.unitPower[defenderType] || 0;

          if (attackerPower <= defenderPower) {
            console.log(`${attackerType} (power ${attackerPower}) cannot attack ${defenderType} (power ${defenderPower})`);
            return;
          }

          // Start animation before updating data
          animateUnitMovement(selectedUnit, clickedTile, attackerType);

          // 1) Remove enemy unit
          const enemyIndex = window.unitData.findIndex(line => {
            const [r, c] = line.split(' ');
            return parseInt(r) === clickedTile.row && parseInt(c) === clickedTile.col;
          });
          if (enemyIndex !== -1) window.unitData.splice(enemyIndex, 1);

          // 2) Change tile owner
          window.setLandOwner(clickedTile, attackerOwner);

          // 3) Move attacker to new tile
          window.unitData = window.unitData.map(line => {
            const [r, c, p, t] = line.split(' ');
            if (parseInt(r) === selectedUnit.row && parseInt(c) === selectedUnit.col) {
              return `${clickedTile.row} ${clickedTile.col} ${p} ${t}`;
            }
            return line;
          });

          // Update protections after combat
          updateAllLandProtections();

          // Clean up and redraw
          selectedUnit = null;
          selectedTile = null;
          reachableTiles = [];
          edgeTiles = [];
          buildMenu.classList.add('hidden');
          unitMenu.classList.add('hidden');
          drawMap();
          return;
        }
      }

      // Düşman yoksa ve hedef BOŞSA → HAREKET
      // In the final movement section for empty tiles:
      if (!thereIsUnit) {
        const reachable = getReachableTiles(selectedUnit, 4, attackerOwner);
        const canReach = reachable.some(t => t.row === clickedTile.row && t.col === clickedTile.col);
        if (!canReach) return;

        // Get unit type for animation
        const unitType = getUnitTypeAt(selectedUnit);

        // Start animation before updating data
        animateUnitMovement(selectedUnit, clickedTile, unitType);

        window.unitData = window.unitData.map(line => {
          const [r, c, p, t] = line.split(' ');
          if (parseInt(r) === selectedUnit.row && parseInt(c) === selectedUnit.col) {
            return `${clickedTile.row} ${clickedTile.col} ${p} ${t}`;
          }
          return line;
        });

        // Update protections after movement
        updateAllLandProtections();

        selectedUnit = null;
        selectedTile = null;
        reachableTiles = [];
        edgeTiles = [];
        buildMenu.classList.add('hidden');
        unitMenu.classList.add('hidden');
        drawMap();
        return;
      }

      // Aynı owner'ın birimi ise → SEÇİMİ o birime taşı
      if (thereIsUnit) {
        selectedUnit = { row: clickedTile.row, col: clickedTile.col };
        selectedTile = clickedTile;
        const owner = getUnitOwner(clickedTile);
        reachableTiles = getReachableTiles(clickedTile, 4, owner); // kendi land içinde

        edgeTiles = getReachableTiles(clickedTile, 3, owner); // son adım öncesi kenar
        capturableTiles = buildCapturable(clickedTile, 4, owner);      // komşu düşman/boş düşman
        buildMenu.classList.add('hidden');
        unitMenu.classList.add('hidden');
        drawMap();
        return;
      }
    }

    // Buraya geldiysek henüz birim seçili değildi
    if (thereIsUnit) {
      // Birim seç
      selectedUnit = { row: clickedTile.row, col: clickedTile.col };
      selectedTile = clickedTile;
      const owner = getUnitOwner(clickedTile);
      reachableTiles = getReachableTiles(clickedTile, 4, owner);
      edgeTiles = getReachableTiles(clickedTile, 3, owner); // Add this line
      buildMenu.classList.add('hidden');
      unitMenu.classList.add('hidden');
    } else {
      // Boş tile → menü aç
      selectedTile = clickedTile;
      selectedUnit = null;
      reachableTiles = [];
      edgeTiles = [];
      unitMenu.classList.remove('hidden');
      buildMenu.classList.remove('hidden');
    }
    initializecastleDistribution();
    drawMap();
  });

  // Ekran yüklendiğinde çiz
  window.addEventListener('DOMContentLoaded', () => {

    drawMap();

  });

  canvas.addEventListener('mousedown', function (e) {
    isDragging = true;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    hasDragged = false;
  });

  canvas.addEventListener('mousemove', function (e) {
    if (!isDragging) return;
    const dx = e.clientX - lastMouseX;
    const dy = e.clientY - lastMouseY;
    // Eğer fare biraz bile hareket ettiyse: dragging aktif
    if (Math.abs(e.clientX - dragStartX) > 5 || Math.abs(e.clientY - dragStartY) > 5) {
      hasDragged = true;
    }
    offsetX += dx;
    offsetY += dy;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
    drawMap();
  });

  canvas.addEventListener('mouseup', () => {
    isDragging = false;
  });
  canvas.addEventListener('mouseleave', () => {
    isDragging = false;
  });

  canvas.addEventListener('wheel', function (e) {
    e.preventDefault();

    const zoomFactor = 0.1;
    const delta = e.deltaY > 0 ? -zoomFactor : zoomFactor;
    const newScale = Math.min(Math.max(0.3, scale + delta), 3);

    // İmlecin canvas üzerindeki konumunu al
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Harita koordinatlarına göre düzeltme yap
    const worldX = (mouseX - offsetX) / scale;
    const worldY = (mouseY - offsetY) / scale;

    // Yeni scale'e göre offset ayarla
    offsetX = mouseX - worldX * newScale;
    offsetY = mouseY - worldY * newScale;

    scale = newScale;
    drawMap();
  });

  function getHexAt(x, y) {
    // Ekran (canvas) koordinatını harita (world) koordinatına dönüştür
    const worldX = (x - offsetX) / scale;
    const worldY = (y - offsetY) / scale;

    // Tüm hex'leri gez, en yakına bak
    for (let line of window.landData) {
      const [row, col] = line.trim().split(/\s+/);
      const { x: hx, y: hy } = hexToPixel(parseInt(row), parseInt(col));

      const dx = worldX - hx;
      const dy = worldY - hy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < tileSize * 0.9) {
        return { row: parseInt(row), col: parseInt(col) };
      }
    }

    return null;
  }




});

// Login ekranında oyuncu adını gönder
function setPlayerName() {
  const name = document.getElementById('username')?.value || 'Player';
  socket.emit('login:setName', name);
}

// "JOIN THE ROOM" tıklanınca
function goJoinRooms() {
  setPlayerName();
  socket.emit('rooms:list');
  showScreen('screen-join-room');
}
// "CREATE ROOM" tıklanınca



// Bekleme odasında START
function startGame() {
  // İlk elde server’a haritayı bir kez yolla (server boşsa set ediyor)
  socket.emit('game:start', { landData: window.landData });
}

function showScreen(screenId) {
  // Tüm ekranlardan "active" sınıfını kaldır
  const screens = document.querySelectorAll('.screen');
  screens.forEach(screen => screen.classList.remove('active'));

  // Sadece istenen ekrana "active" sınıfı ekle
  document.getElementById(screenId).classList.add('active');
} window.showScreen = showScreen;



function increaseCapacity() {
  if (capacity < 6) {
    capacity++;
    document.getElementById("capacity-value").textContent = capacity;
  }
}

function decreaseCapacity() {
  if (capacity > 2) {
    capacity--;
    document.getElementById("capacity-value").textContent = capacity;
  }
}

function toggleCheckbox(el) {
  const box = el.querySelector('.checkbox-box');
  box.classList.toggle('active');

  // Örnek: aktif mi kontrolü
  const isChecked = box.classList.contains('active');
  console.log("Private mode:", isChecked);
}

// ---- odd-q offset  <->  cube helpers ----
function offsetToCube(row, col) {
  const x = col;
  const z = row - ((col - (col & 1)) / 2);   // odd-q
  const y = -x - z;
  return { x, y, z };
}

function cubeToOffset(x, y, z) {
  const row = z + ((x - (x & 1)) / 2);       // odd-q
  const col = x;
  return { row, col };
}

const cubeDirs = [
  { x: 1, y: -1, z: 0 }, { x: 1, y: 0, z: -1 }, { x: 0, y: 1, z: -1 },
  { x: -1, y: 1, z: 0 }, { x: -1, y: 0, z: 1 }, { x: 0, y: -1, z: 1 }
];

// ---- DOǦRU komşu fonksiyonu ----
function getNeighbors(tile) {
  const c = offsetToCube(tile.row, tile.col);
  return cubeDirs.map(d => cubeToOffset(c.x + d.x, c.y + d.y, c.z + d.z));
}

// (opsiyonel) mesafe de doǧru olsun:
function hexDistance(a, b) {
  const ac = offsetToCube(a.row, a.col);
  const bc = offsetToCube(b.row, b.col);
  return Math.max(
    Math.abs(ac.x - bc.x),
    Math.abs(ac.y - bc.y),
    Math.abs(ac.z - bc.z)
  );
}

// ---- unit erişimleri
function getUnitAt(tile) {
  const line = window.unitData.find(l => {
    const [r, c] = l.trim().split(/\s+/);
    return +r === tile.row && +c === tile.col;
  });
  if (!line) return null;
  const [r, c, p, type] = line.trim().split(/\s+/);
  return { row: +r, col: +c, player: +p, type };
}

function getUnitTypeAt(tile) {
  const u = getUnitAt(tile);
  return u ? u.type : null;
}

// These functions need to be accessible globally, so define them outside the event listener
function getLandOwner(tile) {
  const line = window.landData.find(l => {
    const [r, c] = l.trim().split(/\s+/);
    return parseInt(r) === tile.row && parseInt(c) === tile.col;
  });
  if (!line) return null;
  const [, , p] = line.trim().split(/\s+/);
  return parseInt(p);
}
// GLOBAL: capture sırasında "castle" (ve eski 'house') otomatik silinir
function setLandOwner(tile, newOwner) {
  window.landData = window.landData.map(line => {
    const parts = line.trim().split(/\s+/);
    const [r, c, oldOwner, ...rest] = parts;
    if (+r === tile.row && +c === tile.col) {
      const filtered = rest.filter(tok => tok !== 'castle' && tok !== 'house');
      return `${r} ${c} ${newOwner} ${filtered.join(' ')}`.trim();
    }
    return line;
  });
}
window.setLandOwner = setLandOwner; // güvenli olsun diye window’a da bağla

function getReachableTiles(start, maxSteps, playerId) {
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

    const neighbors = getNeighbors(tile);

    neighbors.forEach(neighbor => {
      // landData'da aynı oyuncuya ait mi?
      const landLine = window.landData.find(line => {
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

function buildCapturable(start, maxSteps, ownerId) {
  // Kendi topraǧında (maxSteps-1) adım ilerleyebildiǧin "kenar" kümesi
  const edge = getReachableTiles(start, maxSteps - 1, ownerId);
  const seen = new Set();
  const out = [];

  edge.forEach(t => {
    getNeighbors(t).forEach(nb => {
      const key = `${nb.row},${nb.col}`;
      if (seen.has(key)) return;

      const p = getLandOwner(nb);
      if (p !== null && p !== ownerId) {
        seen.add(key);
        out.push(nb); // düşman veya nötr land → ele geçirilebilir
      }
    });
  });

  return out;
}


// ---- Protection system (FIXED with additional Level 1 & 4 check) ----
window.protectedMap = {}; // "r,c" -> 0..4

function recomputeProtection() {
  const map = {};

  // Initialize all lands with 0 protection
  window.landData.forEach(line => {
    const parts = line.trim().split(/\s+/);
    const r = +parts[0], c = +parts[1];
    map[`${r},${c}`] = 0;
  });

  // Each unit protects neighboring lands of the same player
  window.unitData.forEach(line => {
    const parts = line.trim().split(/\s+/);
    const ur = +parts[0], uc = +parts[1];
    const up = parseInt(parts[2]);    // unit player
    const ut = parts[3];              // type: peasant|spearman|...
    const power = Number(window.unitPower?.[ut] ?? 0);



    // Handle unknown unit types
    if (!power && window.unitPower?.[ut] === undefined) {
      console.warn('Unknown unit type:', ut, 'in line:', line);
    }

    // Check all neighbors of this unit
    const neighbors = getNeighbors({ row: ur, col: uc });
    neighbors.forEach(nb => {
      const neighborOwner = getLandOwner(nb);

    });
  });

  window.protectedMap = map;


}


function findConnectedRegions() {
  const visited = new Set();
  const regions = new Map(); // playerId -> [region1, region2, ...]

  window.landData.forEach(line => {
    const [row, col, player] = line.trim().split(/\s+/);
    const r = parseInt(row);
    const c = parseInt(col);
    const p = parseInt(player);
    const key = `${r},${c}`;

    if (visited.has(key)) return;

    // Find all tiles connected to this one with the same player
    const region = findConnectedTilesOfSamePlayer({ row: r, col: c }, p, visited);

    if (region.length >= 2) { // Only consider regions with at least 2 tiles
      if (!regions.has(p)) {
        regions.set(p, []);
      }
      regions.get(p).push(region);
    }
  });

  return regions;
}

// Helper function to find all tiles connected to a starting tile with the same player
function findConnectedTilesOfSamePlayer(startTile, targetPlayer, visited) {
  const region = [];
  const queue = [startTile];
  const regionVisited = new Set();

  while (queue.length > 0) {
    const current = queue.shift();
    const key = `${current.row},${current.col}`;

    if (regionVisited.has(key)) continue;
    regionVisited.add(key);
    visited.add(key);

    // Check if this tile belongs to the target player
    const owner = getLandOwner(current);
    if (owner !== targetPlayer) continue;

    region.push(current);

    // Add neighbors to queue
    const neighbors = getNeighbors(current);
    neighbors.forEach(neighbor => {
      const neighborKey = `${neighbor.row},${neighbor.col}`;
      if (!regionVisited.has(neighborKey)) {
        const neighborOwner = getLandOwner(neighbor);
        if (neighborOwner === targetPlayer) {
          queue.push(neighbor);
        }
      }
    });
  }

  return region;
}

// Function to check if a region already has a castle
function regionHascastle(region) {
  return region.some(tile => {
    const line = window.landData.find(l => {
      const [r, c] = l.trim().split(/\s+/);
      return parseInt(r) === tile.row && parseInt(c) === tile.col;
    });
    if (!line) return false;
    const parts = line.trim().split(/\s+/);
    return parts[3] === 'castle';
  });
}

// Function to assign a castle to a random tile in a region
function assigncastleToRegion(region) {
  // Filter out tiles that already have objects
  const availableTiles = region.filter(tile => {
    const line = window.landData.find(l => {
      const [r, c] = l.trim().split(/\s+/);
      return parseInt(r) === tile.row && parseInt(c) === tile.col;
    });
    if (!line) return false;
    const parts = line.trim().split(/\s+/);
    return parts.length <= 3; // No object assigned yet
  });

  if (availableTiles.length === 0) return false; // No available tiles

  // Pick a random tile from available tiles
  const randomIndex = Math.floor(Math.random() * availableTiles.length);
  const selectedTile = availableTiles[randomIndex];

  // Add castle to the selected tile
  window.landData = window.landData.map(line => {
    const parts = line.trim().split(/\s+/);
    const [r, c, p] = parts;
    if (parseInt(r) === selectedTile.row && parseInt(c) === selectedTile.col) {
      return `${r} ${c} ${p} castle`;
    }
    return line;
  });

  return true;
}

// Function to remove castles from regions that no longer exist or are too small
function removeInvalidcastles() {
  const validRegions = findConnectedRegions();
  const allValidTiles = new Set();

  // Collect all tiles that belong to valid regions
  validRegions.forEach(playerRegions => {
    playerRegions.forEach(region => {
      region.forEach(tile => {
        allValidTiles.add(`${tile.row},${tile.col}`);
      });
    });
  });

  // Remove castles from tiles that are not in valid regions
  window.landData = window.landData.map(line => {
    const parts = line.trim().split(/\s+/);
    const [r, c, p, obj] = parts;
    const key = `${r},${c}`;

    if (obj === 'castle' && !allValidTiles.has(key)) {
      // This castle is on an invalid tile, remove it
      return `${r} ${c} ${p}`;
    }
    return line;
  });
}

// Main function to distribute castles after each move
function distributecastles() {

  // First, remove any castles from invalid regions
  removeInvalidcastles();

  // Find all connected regions
  const regions = findConnectedRegions();

  regions.forEach((playerRegions, playerId) => {
    console.log(`Player ${playerId} has ${playerRegions.length} regions`);

    playerRegions.forEach((region, index) => {
      console.log(`  Region ${index + 1}: ${region.length} tiles`);

      // Check if this region already has a castle
      if (!regionHascastle(region)) {
        console.log(`    Assigning castle to region ${index + 1}`);
        const success = assigncastleToRegion(region);
        if (!success) {
          console.log(`    Failed to assign castle to region ${index + 1}`);
        }
      } else {
        console.log(`    Region ${index + 1} already has a castle`);
      }
    });
  });
}

// Function to handle territory splitting (call this after land capture)
function handleTerritoryBridge(capturedTile, originalOwner) {
  console.log(`Handling territory split at (${capturedTile.row}, ${capturedTile.col}) from player ${originalOwner}`);

  // Find all remaining regions of the original owner
  const regions = findConnectedRegions();
  const affectedPlayerRegions = regions.get(originalOwner) || [];

  // Check each region to see if it needs a castle
  affectedPlayerRegions.forEach((region, index) => {
    if (!regionHascastle(region) && region.length >= 2) {
      console.log(`Assigning castle to newly split region ${index + 1} of player ${originalOwner}`);
      assigncastleToRegion(region);
    }
  });
}

// Enhanced function to integrate castle distribution with existing game mechanics
function integratecastleDistribution() {
  // Call distributecastles after any land change
  const originalSetLandOwner = setLandOwner;

  window.setLandOwner = function (tile, newOwner) {
    socket.emit('action:capture', { row: tile.row, col: tile.col, owner: newOwner });
  };
}

// Initialize castle distribution system
function initializecastleDistribution() {
  console.log("Initializing castle distribution system...");
  // Distribute castles for the initial game state
  distributecastles();
  // Integrate with existing game mechanics
  integratecastleDistribution();
}