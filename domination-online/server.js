// server.js – oda sistemiyle
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

function createInitialState() {
  return { landData: [], started: false };
}

function publicRoom(room) {
  return {
    code: room.code,
    name: room.name,
    capacity: room.capacity,
    isPrivate: room.isPrivate,
    players: room.players.map(p => ({ id: p.id, name: p.name }))
  };
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

  socket.on('login:setName', (name) => {
    socket.data.name = (name || 'Player').slice(0, 20);
    console.log("2");
  });

  socket.on('rooms:list', () => {
    console.log("1");
    const list = Array.from(rooms.values()).map(r => ({
      
      code: r.code,
      name: r.name,
      capacity: r.capacity,
      count: r.players.length,
      isPrivate: r.isPrivate
    }));
    console.log(list);
    socket.emit('rooms:list', list);
  });

  socket.on('room:create', ({ roomName, capacity = 4, isPrivate = false }) => {
    const code = Math.random().toString(36).slice(2, 6).toUpperCase();
    const room = {
      code,
      name: roomName || 'ROOM',
      capacity: Math.max(2, Math.min(6, +capacity || 4)),
      isPrivate: !!isPrivate,
      state: createInitialState(),
      players: []
    };
    rooms.set(code, room);
    joinRoom(socket, code);
    socket.emit('room:created', { code, room: publicRoom(room) });
    io.to(code).emit('room:update', publicRoom(room));
  });

  socket.on('room:join', ({ code }) => {
    const ok = joinRoom(socket, (code || '').toUpperCase());
    if (!ok) return socket.emit('error', 'Room not found or full');
    const room = rooms.get(socket.data.roomCode);
    socket.emit('game:init', { state: room.state });
    io.to(room.code).emit('room:update', publicRoom(room));
  });

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

  function joinRoom(sock, code) {
    const room = rooms.get(code);
    if (!room || room.players.length >= room.capacity) return false;
    if (sock.data.roomCode) sock.leave(sock.data.roomCode);
    sock.join(code);
    sock.data.roomCode = code;
    const player = { id: sock.id, name: sock.data.name || 'Player' };
    if (!room.players.find(p => p.id === player.id)) {
      room.players.push(player);
    }
    return true;
  }
});

const PORT = 3000;
server.listen(PORT, () => console.log(`Server http://localhost:${PORT}`));
