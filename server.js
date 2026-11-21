const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(express.static("public"));

// كل اختيار بيكسب مين؟
const BEATS = { rock: "scissors", paper: "rock", scissors: "paper" };

// الغرف: كود الغرفة -> { players: [{id, name, pick, score}], draws }
const rooms = {};

function newCode() {
  let c;
  do { c = String(Math.floor(1000 + Math.random() * 9000)); } while (rooms[c]);
  return c;
}

const status = room => room.players.map(p => !!p.pick); // مين اختار (من غير ما نقول اختار إيه)

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

  socket.on("disconnect", () => {
    if (socket.room && rooms[socket.room]) {
      socket.to(socket.room).emit("left");
      delete rooms[socket.room];
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("اللعبة شغالة على المنفذ " + PORT));
