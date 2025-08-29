// server.js — oda sistemiyle
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const publicDir = path.join(__dirname, 'public');
console.log('Serving static from:', publicDir, 'exists?', fs.existsSync(publicDir));
app.use(express.static(publicDir));
app.get('/', (_, res) => res.sendFile(path.join(publicDir, 'index.html')));

// ---- oda veri modeli ----
/**
 * rooms: code -> {
 *   code, name, capacity, isPrivate,
 *   state: { landData: string[], started: boolean },
 *   players: [{id, name}]
 * }
 */
const rooms = new Map();
// en üste ekleyebilirsin
const ROOM_COLORS = ['red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple', 'pink'];



const MAPS_DIR = path.join(__dirname, 'maps');

// mapsByCapacity: { 2: [ [line,line,...], [line,...] ], 3: [...], ... }
const mapsByCapacity = new Map();

function parseMapFile(text) {
  // boş satırları at
  return text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
}

function loadAllMaps() {
  mapsByCapacity.clear();
  if (!fs.existsSync(MAPS_DIR)) {
    console.warn('Maps dir not found:', MAPS_DIR);
    return;
  }
  const files = fs.readdirSync(MAPS_DIR).filter(f => /\.txt$/i.test(f));

  files.forEach(fname => {
    // baştaki oyuncu sayısını yakala: "3p_*.txt"
    const m = fname.match(/^(\d+)p_/i);
    if (!m) return;
    const cap = parseInt(m[1], 10);
    const full = path.join(MAPS_DIR, fname);
    const raw = fs.readFileSync(full, 'utf8');
    const arr = parseMapFile(raw);
    if (!mapsByCapacity.has(cap)) mapsByCapacity.set(cap, []);
    mapsByCapacity.get(cap).push(arr);
  });

  console.log('Loaded maps:', [...mapsByCapacity.entries()].map(([k,v]) => `${k}p=${v.length}`).join(', '));
}

// sunucu açılırken yükle
loadAllMaps();

// Function to select appropriate map based on player count
function selectMapForPlayerCount(playerCount) {
  console.log(`[MAP SELECTION] Selecting map for ${playerCount} players`);
  
  // First try to find maps for exact player count
  if (mapsByCapacity.has(playerCount) && mapsByCapacity.get(playerCount).length > 0) {
    const mapsForCount = mapsByCapacity.get(playerCount);
    const randomIndex = Math.floor(Math.random() * mapsForCount.length);
    const selectedMap = mapsForCount[randomIndex];
    console.log(`[MAP SELECTION] Found ${mapsForCount.length} maps for ${playerCount}p, selected map ${randomIndex + 1}`);
    return selectedMap;
  }
  
  // If no exact match, try to find a map with higher capacity
  const availableCapacities = Array.from(mapsByCapacity.keys()).sort((a, b) => a - b);
  console.log(`[MAP SELECTION] Available capacities: ${availableCapacities.join(', ')}`);
  
  for (const capacity of availableCapacities) {
    if (capacity >= playerCount && mapsByCapacity.get(capacity).length > 0) {
      const mapsForCount = mapsByCapacity.get(capacity);
      const randomIndex = Math.floor(Math.random() * mapsForCount.length);
      const selectedMap = mapsForCount[randomIndex];
      console.log(`[MAP SELECTION] Fallback: Using ${capacity}p map for ${playerCount} players, selected map ${randomIndex + 1}`);
      return selectedMap;
    }
  }
  
  // If still no map found, use default map (first available)
  const firstAvailable = availableCapacities[0];
  if (firstAvailable && mapsByCapacity.get(firstAvailable).length > 0) {
    const defaultMap = mapsByCapacity.get(firstAvailable)[0];
    console.log(`[MAP SELECTION] Emergency fallback: Using ${firstAvailable}p map for ${playerCount} players`);
    return defaultMap;
  }
  
  console.warn(`[MAP SELECTION] No maps available! Using empty land data.`);
  return [];
}

// publicRoom() içinde player'ların rengi de dönsün
function publicRoom(room) {
  return {
    code: room.code,
    name: room.name,
    capacity: room.capacity,
    isPrivate: room.isPrivate,
    players: room.players.map(p => ({ id: p.id, name: p.name, color: p.color })), // <- eklendi
    colors: ROOM_COLORS
  };
}

// oda oluştururken paleti tutmana gerek yok ama istersen ekleyebilirsin
// state tarafını değiştirmiyoruz

// joinRoom() içinde, oyuncuya boş renk ata
function joinRoom(socket, code) {
  const room = rooms.get(code);
  if (!room || room.players.length >= room.capacity) {
    console.log(`Join failed: room ${code} not found or full`);
    return false;
  }

  // önce mevcut odadan çıkar vs... (sende zaten var)

  socket.join(code);
  socket.data.roomCode = code;

  // kullanılmayan ilk rengi bul
  const used = new Set(room.players.map(p => p.color).filter(Boolean));
  const freeColor = ROOM_COLORS.find(c => !used.has(c)) || null;

  const player = { id: socket.id, name: socket.data.name || 'Player', color: freeColor };

  // reconnect durumunu koru
  if (!room.players.find(p => p.id === player.id)) {
    room.players.push(player);
    console.log(`Player ${player.name} joined room ${code} with color ${player.color}`);
  }

  return true;
}

// oyuncu renk seçmek istediğinde
io.on('connection', (socket) => {
  // ... mevcut handler'ların yanına:
  socket.on('room:pickColor', ({ color }) => {
    const code = socket.data.roomCode;
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;

    // geçerli renk mi ve boş mu?
    if (!ROOM_COLORS.includes(color)) return;
    const usedByOthers = room.players.some(p => p.id !== socket.id && p.color === color);
    if (usedByOthers) return;

    // bu soketin player'ına ata
    const me = room.players.find(p => p.id === socket.id);
    if (!me) return;
    me.color = color;

    io.to(code).emit('room:update', publicRoom(room));
  });

  // ... diğer eventler
});

function createInitialState() {
  return { landData: [], unitData: [], started: false };
}



function setLandOwner(state, tile, newOwner) {
  state.landData = state.landData.map(line => {
    const parts = ('' + line).trim().split(/\s+/);
    const [r, c, oldOwner, ...rest] = parts;
    if (+r === tile.row && +c === tile.col) {
      // Preserve ALL building types during land ownership changes
      // Only change the owner, keep all buildings and objects intact
      return `${r} ${c} ${newOwner} ${rest.join(' ')}`.trim();
    }
    return line;
  });
  
  // Trigger castle redistribution after ownership change
  console.log(`[CASTLE] Triggering castle redistribution after ownership change at (${tile.row}, ${tile.col})`);
  distributeCastles(state);
}

// Capture land with structure destruction for soldier-initiated captures
// Destroys military structures (tower, strong_tower, castle) on captured tiles
function captureLandWithStructureDestruction(state, tile, newOwner) {
  state.landData = state.landData.map(line => {
    const parts = ('' + line).trim().split(/\s+/);
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

// Server-side castle distribution functions
function getNeighbors(tile) {
  // Hex direction vectors for cube coordinates
  const cubeDirs = [
    { x: 1, y: -1, z: 0 }, { x: 1, y: 0, z: -1 }, { x: 0, y: 1, z: -1 },
    { x: -1, y: 1, z: 0 }, { x: -1, y: 0, z: 1 }, { x: 0, y: -1, z: 1 }
  ];
  
  // Convert offset to cube coordinates
  const x = tile.col;
  const z = tile.row - ((tile.col - (tile.col & 1)) / 2);
  const y = -x - z;
  
  // Get neighbors and convert back to offset
  return cubeDirs.map(d => {
    const nx = x + d.x;
    const ny = y + d.y;
    const nz = z + d.z;
    const row = nz + ((nx - (nx & 1)) / 2);
    const col = nx;
    return { row, col };
  });
}

function getLandOwner(tile, landData) {
  const line = landData.find(l => {
    const [r, c] = ('' + l).trim().split(/\s+/);
    return parseInt(r) === tile.row && parseInt(c) === tile.col;
  });
  if (!line) return null;
  const [, , p] = ('' + line).trim().split(/\s+/);
  return parseInt(p);
}

function findConnectedRegions(state) {
  const visited = new Set();
  const regions = new Map();

  state.landData.forEach(line => {
    const [row, col, player] = ('' + line).trim().split(/\s+/);
    const r = parseInt(row);
    const c = parseInt(col);
    const p = parseInt(player);
    const key = `${r},${c}`;

    if (visited.has(key)) return;

    const region = findConnectedTilesOfSamePlayer({ row: r, col: c }, p, visited, state.landData);

    if (region.length >= 2) {
      if (!regions.has(p)) {
        regions.set(p, []);
      }
      regions.get(p).push(region);
    }
  });

  return regions;
}

function findConnectedTilesOfSamePlayer(startTile, targetPlayer, visited, landData) {
  const region = [];
  const queue = [startTile];
  const regionVisited = new Set();

  while (queue.length > 0) {
    const current = queue.shift();
    const key = `${current.row},${current.col}`;

    if (regionVisited.has(key)) continue;
    regionVisited.add(key);
    visited.add(key);

    const owner = getLandOwner(current, landData);
    if (owner !== targetPlayer) continue;

    region.push(current);

    const neighbors = getNeighbors(current);
    neighbors.forEach(neighbor => {
      const neighborKey = `${neighbor.row},${neighbor.col}`;
      if (!regionVisited.has(neighborKey)) {
        const neighborOwner = getLandOwner(neighbor, landData);
        if (neighborOwner === targetPlayer) {
          queue.push(neighbor);
        }
      }
    });
  }

  return region;
}

function regionHasCastle(region, landData) {
  return region.some(tile => {
    const line = landData.find(l => {
      const [r, c] = ('' + l).trim().split(/\s+/);
      return parseInt(r) === tile.row && parseInt(c) === tile.col;
    });
    if (!line) return false;
    const parts = ('' + line).trim().split(/\s+/);
    return parts[3] === 'castle';
  });
}

function assignCastleToRegion(region, state) {
  const availableTiles = region.filter(tile => {
    const line = state.landData.find(l => {
      const [r, c] = ('' + l).trim().split(/\s+/);
      return parseInt(r) === tile.row && parseInt(c) === tile.col;
    });
    if (!line) return false;
    const parts = ('' + line).trim().split(/\s+/);
    return parts.length <= 3;
  });

  if (availableTiles.length === 0) return false;

  const randomIndex = Math.floor(Math.random() * availableTiles.length);
  const selectedTile = availableTiles[randomIndex];

  // Add castle to the selected tile
  state.landData = state.landData.map(line => {
    const parts = ('' + line).trim().split(/\s+/);
    const [r, c, p] = parts;
    if (+r === selectedTile.row && +c === selectedTile.col) {
      return `${r} ${c} ${p} castle`;
    }
    return line;
  });
  
  return true;
}

function removeInvalidCastles(state) {
  const validRegions = findConnectedRegions(state);
  const allValidTiles = new Set();

  validRegions.forEach(playerRegions => {
    playerRegions.forEach(region => {
      region.forEach(tile => {
        allValidTiles.add(`${tile.row},${tile.col}`);
      });
    });
  });

  state.landData = state.landData.map(line => {
    const parts = ('' + line).trim().split(/\s+/);
    const [r, c, p, obj] = parts;
    const key = `${r},${c}`;
    
    if (obj === 'castle' && (!allValidTiles.has(key) || +p === 0)) {
      return `${r} ${c} ${p}`;
    }
    return line;
  });
}

function distributeCastles(state) {
  removeInvalidCastles(state);
  const regions = findConnectedRegions(state);

  regions.forEach((playerRegions, playerId) => {
    if (playerId === 0) return; // Skip neutral player

    playerRegions.forEach((region, index) => {
      if (!regionHasCastle(region, state.landData)) {
        assignCastleToRegion(region, state);
      }
    });
  });
}

function initializeCastleDistribution(state) {
  distributeCastles(state);
}

io.on('connection', (socket) => {
  console.log('client connected', socket.id);

  // oyuncu adı
  socket.on('login:setName', (name) => {
    socket.data.name = (name || 'Player').slice(0, 20);
  });

  // oda listesi
  socket.on('rooms:list', () => {
    const list = Array.from(rooms.values())
      .filter(r => !r.isPrivate) // 🔥 sadece public odaları göster
      .map(r => ({
        code: r.code,
        name: r.name,
        capacity: r.capacity,
        count: r.players.length,
        isPrivate: r.isPrivate
      }));
    socket.emit('rooms:list', list);
  });
  // oda oluştur
  socket.on('room:create', ({ roomName, capacity = 4, isPrivate = false }) => {
    console.log('Room creation requested:', { roomName, capacity, isPrivate });
    const code = Math.random().toString(36).slice(2, 6).toUpperCase(); // örn: AB3F
    const room = {
      code,
      name: roomName || 'ROOM',
      capacity: Math.max(2, Math.min(6, +capacity || 4)),
      isPrivate: !!isPrivate,
      state: { landData: [], unitData: [], started: false },
      players: [],
    };
    rooms.set(code, room);
    joinRoom(socket, code);
    socket.emit('room:created', { code, room: publicRoom(room) });
     socket.emit('room:joined', publicRoom(room));
    io.to(code).emit('room:update', publicRoom(room));
  });

  // odaya katıl
  socket.on('room:join', ({ code }) => {
    const ok = joinRoom(socket, (code || '').toUpperCase());
    if (!ok) return socket.emit('error', 'Room not found or full');
    const room = rooms.get(socket.data.roomCode);

    // Bu kullanıcıya mevcut state
    socket.emit('game:init', { state: room.state });

    // 🔥 Bu satırı ekle → client "room:joined" eventini alsın
    socket.emit('room:joined', publicRoom(room));

    io.to(room.code).emit('room:update', publicRoom(room));
  });

  // oyunu başlat (yalnızca o odanın state'i)
  socket.on('game:start', ({ landData }) => {
    const code = socket.data.roomCode;
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;

    if (!room.state.started) {
      const playerCount = room.players.length;
      console.log(`[GAME START] Starting game in room ${code} with ${playerCount} players`);
      
      // Select appropriate map based on player count
      const selectedMap = selectMapForPlayerCount(playerCount);
      
      if (selectedMap && selectedMap.length > 0) {
        room.state.landData = selectedMap;
        console.log(`[GAME START] Loaded map with ${selectedMap.length} tiles for ${playerCount} players`);
      } else if (Array.isArray(landData) && landData.length) {
        // Fallback to client-provided landData if available
        room.state.landData = landData;
        console.log(`[GAME START] Using client-provided landData as fallback`);
      } else {
        console.warn(`[GAME START] No map data available, using empty state`);
        room.state.landData = [];
      }
      
      // Initialize castle distribution after map is loaded
      if (room.state.landData && room.state.landData.length > 0) {
        console.log(`[GAME START] Initializing castle distribution for room ${code}`);
        initializeCastleDistribution(room.state);
        console.log(`[GAME START] Castle distribution completed for room ${code}`);
      }
      
      room.state.started = true;
      console.log(`[GAME START] Broadcasting game initialization to room ${code}`);
      io.to(code).emit('game:init', { state: room.state });
    } else {
      console.log(`[GAME START] Game already started in room ${code}, sending current state to player`);
      socket.emit('game:init', { state: room.state });
    }
  });
  // odadan çık
  socket.on('room:leave', () => {
    const code = socket.data.roomCode;
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;

    socket.leave(code);
    room.players = room.players.filter(p => p.id !== socket.id);
    
    if (room.players.length === 0) {
      rooms.delete(code);
      console.log(`Room ${code} deleted (empty)`);
    } else {
      io.to(code).emit('room:update', publicRoom(room));
    }

    socket.data.roomCode = null;
  });
  // capture (oda bazlı)
  socket.on('action:capture', ({ row, col, owner }) => {
    const code = socket.data.roomCode;
    const room = rooms.get(code);
    if (!room || !room.state.started) return;
    
    console.log(`Land capture: (${row}, ${col}) changing to owner ${owner}`);
    // Use structure destruction function for soldier-initiated land capture
    captureLandWithStructureDestruction(room.state, { row, col }, owner);
    
    // Trigger castle redistribution after ownership change
    console.log(`[CASTLE] Triggering castle redistribution after land capture at (${row}, ${col})`);
    distributeCastles(room.state);
    
    io.to(code).emit('game:update', { landData: room.state.landData });
  });

  // building construction (towers, houses, etc.)
  socket.on('action:buildStructure', ({ row, col, buildingType }) => {
    const code = socket.data.roomCode;
    const room = rooms.get(code);
    if (!room || !room.state.started) return;
    
    console.log(`Building construction: ${buildingType} at (${row}, ${col})`);
    
    // Add building to the specified tile
    room.state.landData = room.state.landData.map(line => {
      const parts = ('' + line).trim().split(/\s+/);
      const [r, c, owner, ...rest] = parts;
      if (+r === row && +c === col) {
        // Remove any existing building and add the new one
        const filtered = rest.filter(tok => 
          tok !== 'castle' && tok !== 'house' && tok !== 'tower' && tok !== 'strong_tower'
        );
        return `${r} ${c} ${owner} ${buildingType} ${filtered.join(' ')}`.trim();
      }
      return line;
    });
    
    io.to(code).emit('game:update', { landData: room.state.landData });
  });

  // unit building
  socket.on('action:buildUnit', ({ row, col, unitType }) => {
    const code = socket.data.roomCode;
    const room = rooms.get(code);
    if (!room || !room.state.started) return;
    
    console.log(`Building unit ${unitType} at ${row},${col}`);
    
    // Initialize unitData if it doesn't exist
    if (!room.state.unitData) {
      room.state.unitData = [];
    }
    
    // Add unit to the specified tile
    const unitEntry = `${row} ${col} 1 ${unitType}`; // owner=1 for now, should be dynamic
    room.state.unitData.push(unitEntry);
    
    io.to(code).emit('game:update', { 
      landData: room.state.landData,
      unitData: room.state.unitData
    });
  });

  // unit movement
  socket.on('action:move', ({ from, to, unitType }) => {
    const code = socket.data.roomCode;
    const room = rooms.get(code);
    if (!room || !room.state.started) return;
    
    console.log(`Moving unit from ${from.row},${from.col} to ${to.row},${to.col}`);
    
    // Initialize unitData if it doesn't exist
    if (!room.state.unitData) {
      room.state.unitData = [];
    }
    
    // Update unit position
    room.state.unitData = room.state.unitData.map(line => {
      const [r, c, owner, type] = line.trim().split(/\s+/);
      if (parseInt(r) === from.row && parseInt(c) === from.col) {
        return `${to.row} ${to.col} ${owner} ${type}`;
      }
      return line;
    });
    
    io.to(code).emit('game:update', { 
      landData: room.state.landData,
      unitData: room.state.unitData
    });
  });

  // unit attack
  socket.on('action:attack', ({ attacker, target, attackerType }) => {
    const code = socket.data.roomCode;
    const room = rooms.get(code);
    if (!room || !room.state.started) return;
    
    console.log(`Unit attack from ${attacker.row},${attacker.col} to ${target.row},${target.col}`);
    
    // Initialize unitData if it doesn't exist
    if (!room.state.unitData) {
      room.state.unitData = [];
    }
    
    // Remove the target unit (defender is defeated)
    room.state.unitData = room.state.unitData.filter(line => {
      const [r, c] = line.trim().split(/\s+/);
      return !(parseInt(r) === target.row && parseInt(c) === target.col);
    });
    
    // Move the attacker to the target position
    room.state.unitData = room.state.unitData.map(line => {
      const [r, c, owner, type] = line.trim().split(/\s+/);
      if (parseInt(r) === attacker.row && parseInt(c) === attacker.col) {
        return `${target.row} ${target.col} ${owner} ${type}`;
      }
      return line;
    });
    
    io.to(code).emit('game:update', { 
      landData: room.state.landData,
      unitData: room.state.unitData
    });
  });

  socket.on('disconnect', () => {
    const code = socket.data.roomCode;
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;
    room.players = room.players.filter(p => p.id !== socket.id);
    io.to(code).emit('room:update', publicRoom(room));
    if (room.players.length === 0) rooms.delete(code);
  });

  
});


const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log('Room system initialized');
});