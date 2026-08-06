const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('.'));

const salas = {};

io.on('connection', (socket) => {
  socket.on('criar_sala', ({ nomeSala, senha }) => {
    if (salas[nomeSala]) {
      socket.emit('erro', 'Essa sala já existe.');
      return;
    }
    salas[nomeSala] = { senha, jogadores: [socket.id] };
    socket.join(nomeSala);
    socket.emit('sala_criada', { nomeSala });
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
    socket.emit('entrou_na_sala', { nomeSala });
    io.to(nomeSala).emit('jogador_entrou', { id: socket.id });
  });

  socket.on('disconnect', () => {
    for (const nomeSala in salas) {
      salas[nomeSala].jogadores = salas[nomeSala].jogadores.filter(id => id !== socket.id);
      if (s
