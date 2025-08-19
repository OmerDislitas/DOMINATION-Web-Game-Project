document.addEventListener('DOMContentLoaded', () => {
  let animatingUnits = new Map(); // key: "row,col", value: animation data
  let animationId = null;

  // Animation configuration
  const ANIMATION_DURATION = 300; // milliseconds
  const EASING_FACTOR = 0.15; // for smooth easing (lower = smoother, higher = faster)

  const canvas = document.getElementById('myCanvas');
  const ctx = canvas.getContext('2d');
  let reachableTiles = [];
  let edgeTiles = []; // 4 adımının 3'ünü kendi topraçında atabileçeğin kenar seti
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
    tower: new Image(),
    strong_tower: new Image()
  };

  objectImages.house.src = 'assets/img/house.png';
  objectImages.tower.src = 'assets/img/tower.png';
  objectImages.strong_tower.src = 'assets/img/strong_tower.png';

  let dragStartX = 0;
  let dragStartY = 0;
  let hasDragged = false;

  const objectSizes = {
    house: 48,
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
  // En üste yakın bir yerde:
  const BUILDING_PROT = { tower: 2, strong_tower: 3 };

  // Bu yardımcıyı ekleyin:
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
  buildMenu.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn || !selectedTile) return;

    const obj = btn.dataset.object; // "house" | "tower" | "strong_tower"
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
  // Easing function for smooth animation
  function easeOutQuad(t) {
    return t * (2 - t);
  }

  // Function to start unit animation
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
          window.landData.forEach((line, i) => {
            const [r, c, p, ...rest] = line.trim().split(/\s+/);
            if (parseInt(r) === clickedTile.row && parseInt(c) === clickedTile.col) {
              window.landData[i] = `${r} ${c} ${attackerOwner} ${rest.join(' ')}`.trim();
            }
          });

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

    drawMap();
  });

  // Ekran yüklendiğinde çiz
  window.addEventListener('DOMContentLoaded', () => {
    updateAllLandProtections(); // Initialize protections
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

  // Move these functions inside the event listener scope or make them access global unitData
  function setLandOwner(tile, newOwner) {
    window.landData.forEach((line, i) => {
      const [r, c, p, ...rest] = line.trim().split(/\s+/);
      if (parseInt(r) === tile.row && parseInt(c) === tile.col) {
        window.landData[i] = `${r} ${c} ${newOwner} ${rest.join(' ')}`.trim();
      }
    });
  }

});

function showScreen(screenId) {
  // Tüm ekranlardan "active" sınıfını kaldır
  const screens = document.querySelectorAll('.screen');
  screens.forEach(screen => screen.classList.remove('active'));

  // Sadece istenen ekrana "active" sınıfı ekle
  document.getElementById(screenId).classList.add('active');
}

let capacity = 4;

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

// (Varsa) saldırı/move sonrası tile owner güncellemek için:
function setLandOwner(tile, newOwner) {
  window.landData.forEach((line, i) => {
    const [r, c, p, ...rest] = line.trim().split(/\s+/);
    if (parseInt(r) === tile.row && parseInt(c) === tile.col) {
      window.landData[i] = `${r} ${c} ${newOwner} ${rest.join(' ')}`.trim();
    }
  });
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

    // Debug logging
    console.log(`Processing unit: ${ut} at (${ur},${uc}) player ${up} power ${power}`);

    // Handle unknown unit types
    if (!power && window.unitPower?.[ut] === undefined) {
      console.warn('Unknown unit type:', ut, 'in line:', line);
    }

    // Check all neighbors of this unit
    const neighbors = getNeighbors({ row: ur, col: uc });
    neighbors.forEach(nb => {
      const neighborOwner = getLandOwner(nb);

      // Debug logging
      console.log(`  Checking neighbor (${nb.row},${nb.col}): owner=${neighborOwner}, unit_player=${up}`);

      // ONLY protect lands owned by the same player as the unit
      if (neighborOwner !== null && neighborOwner === up) {
        const key = `${nb.row},${nb.col}`;
        const currentProtection = map[key] ?? 0;
        if (power > currentProtection) {
          console.log(`    Updating protection from ${currentProtection} to ${power}`);
          map[key] = power;
        }
      }
    });
  });

  // ADDITIONAL CHECK: Special handling for level 1 (peasant) and level 4 (knight) soldiers
  console.log("=== ADDITIONAL LEVEL 1 & 4 CHECK ===");
  window.unitData.forEach(line => {
    const parts = line.trim().split(/\s+/);
    const ur = +parts[0], uc = +parts[1];
    const up = parseInt(parts[2]);    // unit player
    const ut = parts[3];              // type
    const power = Number(window.unitPower?.[ut] ?? 0);

    // Only check for level 1 (peasant) and level 4 (knight) units
    if (power === 1 || power === 4) {
      console.log(`SPECIAL CHECK: ${ut} (power ${power}) at (${ur},${uc}) player ${up}`);

      const neighbors = getNeighbors({ row: ur, col: uc });
      neighbors.forEach(nb => {
        const neighborOwner = getLandOwner(nb);

        console.log(`  SPECIAL: Checking neighbor (${nb.row},${nb.col}): owner=${neighborOwner}, unit_player=${up}`);

        // Force update if same owner
        if (neighborOwner !== null && neighborOwner === up) {
          const key = `${nb.row},${nb.col}`;
          const currentProtection = map[key] ?? 0;

          // Force set the protection level
          if (power > currentProtection) {
            console.log(`    SPECIAL UPDATE: Setting protection to ${power} (was ${currentProtection})`);
            map[key] = power;
          } else {
            console.log(`    SPECIAL: Already protected at level ${currentProtection}, not changing`);
          }
        }
      });
    }
  });

  window.protectedMap = map;

  // Debug: log final protection map
  console.log('Final protection map:', window.protectedMap);
}

function getProtectionAt(tile) {
  const protection = window.protectedMap[`${tile.row},${tile.col}`] ?? 0;
  console.log(`Getting protection for (${tile.row},${tile.col}): ${protection}`);
  return protection;
}
