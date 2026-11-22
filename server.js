const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(express.static("public"));

// كل اختيار بيكسب مين؟
const BEATS = { rock: "scissors", paper: "rock", scissors: "paper" };

// غرف حجر ورقة مقص: كود الغرفة -> { players: [{id, name, pick, score}], draws }
const rooms = {};
// غرف إكس أو
const xoRooms = {};
// غرف سباق العربيات
const raceRooms = {};
const RACE_TARGET = 50; // عدد الضغطات اللي توصّل العربية لخط النهاية

function newCode() {
  let c;
  do { c = String(Math.floor(1000 + Math.random() * 9000)); } while (rooms[c] || xoRooms[c] || raceRooms[c]);
  return c;
}

const status = room => room.players.map(p => !!p.pick); // مين اختار (من غير ما نقول اختار إيه)

// ---------- إكس أو ----------
const XO_LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
function xoCheck(b) {
  for (const l of XO_LINES) {
    if (b[l[0]] !== null && b[l[0]] === b[l[1]] && b[l[0]] === b[l[2]]) return { w: b[l[0]], line: l };
  }
  return b.every(x => x !== null) ? { w: 2, line: [] } : null;
}
const xoState = r => ({ board: r.board, turn: r.turn, over: r.over, winner: r.winner, line: r.line, scores: r.scores });

// ---------- سباق العربيات ----------
const raceState = r => ({ pos: r.pos, over: r.over, winner: r.winner, scores: r.scores, target: RACE_TARGET });
function raceRound(code, r) {
  r.pos = [0, 0]; r.over = false; r.winner = null;
  r.startAt = Date.now() + 3500; // السيرفر مبيقبلش ضغطات قبل ما العد التنازلي يخلص
  io.to(code).emit("race:round", { startIn: 3500 });
  io.to(code).emit("race:state", raceState(r));
}

io.on("connection", socket => {
  // إنشاء غرفة
  socket.on("create", name => {
    if (socket.room) return;
    const c = newCode();
    rooms[c] = { players: [{ id: socket.id, name: String(name).slice(0, 12), pick: null, score: 0 }], draws: 0 };
    socket.join(c);
    socket.room = c;
    socket.emit("created", c);
  });

  // دخول غرفة بالكود
  socket.on("join", ({ code, name }) => {
    if (socket.room) return;
    const room = rooms[code];
    if (!room) return socket.emit("fail", "الكود غلط، راجعه تاني");
    if (room.players.length >= 2) return socket.emit("fail", "الغرفة دي فيها لاعبين خلاص");
    room.players.push({ id: socket.id, name: String(name).slice(0, 12), pick: null, score: 0 });
    socket.join(code);
    socket.room = code;
    io.to(code).emit("start", {
      names: room.players.map(p => p.name),
      ids: room.players.map(p => p.id),
    });
  });

  // اختيار لاعب
  socket.on("pick", choice => {
    const room = rooms[socket.room];
    if (!room || room.players.length < 2 || !BEATS[choice]) return;
    const me = room.players.find(p => p.id === socket.id);
    if (!me || me.pick) return;
    me.pick = choice;
    io.to(socket.room).emit("picked", status(room));

    const [a, b] = room.players;
    if (a.pick && b.pick) {
      // السيرفر هو اللي بيحدد الكسبان عشان محدش يغش
      const w = a.pick === b.pick ? 2 : BEATS[a.pick] === b.pick ? 0 : 1;
      if (w === 2) room.draws++; else room.players[w].score++;
      io.to(socket.room).emit("result", {
        picks: [a.pick, b.pick],
        winner: w,
        scores: [a.score, b.score, room.draws],
      });
      a.pick = b.pick = null;
    }
  });

  // جولة جديدة
  socket.on("again", () => {
    const room = rooms[socket.room];
    if (room) socket.emit("picked", status(room));
  });

  // ---------- إكس أو: إنشاء ودخول ----------
  socket.on("xo:create", name => {
    if (socket.xoRoom || socket.room) return;
    const c = newCode();
    xoRooms[c] = {
      players: [{ id: socket.id, name: String(name).slice(0, 12) }],
      board: Array(9).fill(null), turn: 0, starter: 0,
      over: false, winner: null, line: [], scores: [0, 0, 0],
    };
    socket.join(c);
    socket.xoRoom = c;
    socket.emit("xo:created", c);
  });

  socket.on("xo:join", ({ code, name }) => {
    if (socket.xoRoom || socket.room) return;
    const r = xoRooms[code];
    if (!r) return socket.emit("xo:fail", "الكود غلط، راجعه تاني");
    if (r.players.length >= 2) return socket.emit("xo:fail", "الغرفة دي فيها لاعبين خلاص");
    r.players.push({ id: socket.id, name: String(name).slice(0, 12) });
    socket.join(code);
    socket.xoRoom = code;
    io.to(code).emit("xo:start", {
      names: r.players.map(p => p.name),
      ids: r.players.map(p => p.id),
    });
    io.to(code).emit("xo:state", xoState(r));
  });

  // حركة لاعب
  socket.on("xo:move", i => {
    const r = xoRooms[socket.xoRoom];
    if (!r || r.players.length < 2 || r.over) return;
    const me = r.players.findIndex(p => p.id === socket.id);
    if (me !== r.turn || !Number.isInteger(i) || i < 0 || i > 8 || r.board[i] !== null) return;
    r.board[i] = me;
    const res = xoCheck(r.board);
    if (res) { r.over = true; r.winner = res.w; r.line = res.line; r.scores[res.w]++; }
    else r.turn = 1 - me;
    io.to(socket.xoRoom).emit("xo:state", xoState(r));
  });

  // جولة جديدة (البادئ بيتبدل كل مرة)
  socket.on("xo:again", () => {
    const r = xoRooms[socket.xoRoom];
    if (!r || !r.over) return;
    r.starter = 1 - r.starter;
    r.board = Array(9).fill(null);
    r.turn = r.starter;
    r.over = false; r.winner = null; r.line = [];
    io.to(socket.xoRoom).emit("xo:state", xoState(r));
  });

  // ---------- سباق العربيات ----------
  socket.on("race:create", name => {
    if (socket.raceRoom || socket.room || socket.xoRoom) return;
    const c = newCode();
    raceRooms[c] = {
      players: [{ id: socket.id, name: String(name).slice(0, 12), last: 0 }],
      pos: [0, 0], over: false, winner: null, scores: [0, 0], startAt: 0,
    };
    socket.join(c);
    socket.raceRoom = c;
    socket.emit("race:created", c);
  });

  socket.on("race:join", ({ code, name }) => {
    if (socket.raceRoom || socket.room || socket.xoRoom) return;
    const r = raceRooms[code];
    if (!r) return socket.emit("race:fail", "الكود غلط، راجعه تاني");
    if (r.players.length >= 2) return socket.emit("race:fail", "الغرفة دي فيها لاعبين خلاص");
    r.players.push({ id: socket.id, name: String(name).slice(0, 12), last: 0 });
    socket.join(code);
    socket.raceRoom = code;
    io.to(code).emit("race:start", {
      names: r.players.map(p => p.name),
      ids: r.players.map(p => p.id),
    });
    raceRound(code, r);
  });

  // ضغطة على الشاشة = العربية تتحرك خطوة
  socket.on("race:tap", () => {
    const r = raceRooms[socket.raceRoom];
    if (!r || r.players.length < 2 || r.over) return;
    const now = Date.now();
    if (now < r.startAt) return;
    const me = r.players.findIndex(p => p.id === socket.id);
    if (me < 0 || now - r.players[me].last < 40) return;
    r.players[me].last = now;
    r.pos[me]++;
    if (r.pos[me] >= RACE_TARGET) { r.over = true; r.winner = me; r.scores[me]++; }
    io.to(socket.raceRoom).emit("race:state", raceState(r));
  });

  socket.on("race:again", () => {
    const r = raceRooms[socket.raceRoom];
    if (r && r.over) raceRound(socket.raceRoom, r);
  });

  socket.on("disconnect", () => {
    if (socket.room && rooms[socket.room]) {
      socket.to(socket.room).emit("left");
      delete rooms[socket.room];
    }
    if (socket.xoRoom && xoRooms[socket.xoRoom]) {
      socket.to(socket.xoRoom).emit("xo:left");
      delete xoRooms[socket.xoRoom];
    }
    if (socket.raceRoom && raceRooms[socket.raceRoom]) {
      socket.to(socket.raceRoom).emit("race:left");
      delete raceRooms[socket.raceRoom];
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("اللعبة شغالة على المنفذ " + PORT));
