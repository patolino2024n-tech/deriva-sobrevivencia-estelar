const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('.'));

const salas = {};

io.on('connection', (socket) => {
  socket.on('criar_sala', ({ nomeSala, senha, matchTime }) => {
    if (salas[nomeSala]) {
      socket.emit('erro', 'Essa sala já existe.');
      return;
    }
    const tempoPartida = matchTime || 5;
    salas[nomeSala] = { senha, jogadores: [socket.id], matchTime: tempoPartida };
    socket.join(nomeSala);
    socket.data.nomeSala = nomeSala;
    socket.emit('sala_criada', { nomeSala, matchTime: tempoPartida });
    io.emit('lista_salas', Object.keys(salas));
  });

  socket.on('entrar_sala', ({ nomeSala, senha }) => {
    const sala = salas[nomeSala];
    if (!sala) {
      socket.emit('erro', 'Sala não encontrada.');
      return;
    }
    if (sala.senha !== senha) {
      socket.emit('erro', 'Senha incorreta.');
      return;
    }
    sala.jogadores.push(socket.id);
    socket.join(nomeSala);
    socket.data.nomeSala = nomeSala;
    socket.emit('entrou_na_sala', { nomeSala, matchTime: sala.matchTime || 5 });
    io.to(nomeSala).emit('jogador_entrou', { id: socket.id });
  });

  // Repassa a posição (e estado de atordoado/morto) do jogador para os outros da mesma sala
  socket.on('atualizarPosicao', ({ x, z, rotY, dizzy, dead }) => {
    const nomeSala = socket.data.nomeSala;
    if (!nomeSala) return;
    socket.to(nomeSala).emit('posicaoJogador', { id: socket.id, x, z, rotY, dizzy: !!dizzy, dead: !!dead });
  });

  // Chute
  socket.on('chutar_jogador', ({ targetId }) => {
    const nomeSala = socket.data.nomeSala;
    if (!nomeSala || !targetId) return;
    io.to(targetId).emit('fui_chutado', { by: socket.id });
  });

  // Investigar (caçador pergunta o papel do alvo)
  socket.on('investigar_jogador', ({ targetId }) => {
    const nomeSala = socket.data.nomeSala;
    if (!nomeSala || !targetId) return;
    io.to(targetId).emit('foi_investigado', { by: socket.id });
  });
  socket.on('resposta_investigacao', ({ to, role }) => {
    if (!to) return;
    io.to(to).emit('resultado_investigacao', { role, from: socket.id });
  });

  // Eliminar (impostor mata o alvo)
  socket.on('eliminar_jogador', ({ targetId }) => {
    const nomeSala = socket.data.nomeSala;
    if (!nomeSala || !targetId) return;
    io.to(targetId).emit('fui_eliminado', { by: socket.id });
  });

  socket.on('disconnect', () => {
    const nomeSala = socket.data.nomeSala;
    if (nomeSala) {
      io.to(nomeSala).emit('jogador_saiu', { id: socket.id });
    }
    for (const nomeSala2 in salas) {
      salas[nomeSala2].jogadores = salas[nomeSala2].jogadores.filter(id => id !== socket.id);
      if (salas[nomeSala2].jogadores.length === 0) delete salas[nomeSala2];
    }
    io.emit('lista_salas', Object.keys(salas));
  });
});

const listener = server.listen(process.env.PORT, () => {
  console.log('Servidor rodando na porta ' + listener.address().port);
});
