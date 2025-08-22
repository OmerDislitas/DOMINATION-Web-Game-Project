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
  return { landData: [], started: false };
}



function setLandOwner(state, tile, newOwner) {
  state.landData = state.landData.map(line => {
    const parts = ('' + line).trim().split(/\s+/);
    const [r, c, oldOwner, ...rest] = parts;
    if (+r === tile.row && +c === tile.col) {
      const filtered = rest.filter(tok => tok !== 'castle' && tok !== 'house');
      return `${r} ${c} ${newOwner} ${filtered.join(' ')}`.trim();
    }
    return line;
  });
}



io.on('connection', (socket) => {
  console.log('client connected', socket.id);

  // TÜM gelen eventleri logla: debug kolay olsun
  socket.onAny((ev, ...args) => console.log('[in]', ev, args));

  // oyuncu adı
  socket.on('login:setName', (name) => {
    socket.data.name = (name || 'Player').slice(0, 20);
    console.log("2");
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
      state: { landData: [], started: false },
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
      if (Array.isArray(landData) && landData.length) {
        room.state.landData = landData;
      }
      room.state.started = true;
      io.to(code).emit('game:init', { state: room.state });
    } else {
      socket.emit('game:init', { state: room.state });
    }
  });
  // odadan çık
  socket.on('room:leave', () => {
    console.log("room leave çalıştı");
    const code = socket.data.roomCode;
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;

    socket.leave(code);
    room.players = room.players.filter(p => p.id !== socket.id);
    console.log(room.players);
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
    setLandOwner(room.state, { row, col }, owner);
    io.to(code).emit('game:update', { landData: room.state.landData });
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