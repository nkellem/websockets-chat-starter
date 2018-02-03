const http = require('http');
const fs = require('fs');
const socketio = require('socket.io');

const PORT = process.env.PORT || process.env.NODE_PORT || 3000;

const index = fs.readFileSync(`${__dirname}/../client/client.html`);

const onRequest = (request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/html' });
  response.write(index);
  response.end();
};

const app = http.createServer(onRequest).listen(PORT);

console.log(`Listening on localhost:${PORT}`);

//pass in the http server into socketio and grab the websocket sever as io
const io = socketio(app);

//object to hold all of our users
const users = {};

const onJoined = (sock) => {
  const socket = sock;

  socket.on('join', data => {
    //check to see if the username has already been taken
    let userNameTaken = false;
    Object.keys(users).forEach(user => {
      if (users[user].toLowerCase() === data.name.toLowerCase()) {
        socket.emit('msg', { name: 'server', msg: 'Username already taken' });
        userNameTaken = true;
        return;
      }
    });

    //if username is taken, bail out
    if (userNameTaken) {
      return;
    }

    //add new user to the users object
    users[data.name] = data.name;

    console.dir(users);

    //message back to new user
    const joinMsg = {
      name: 'server',
      msg: `There are ${Object.keys(users).length} users online`,
    };

    socket.name = data.name;
    socket.emit('msg', joinMsg);

    socket.join('room1');

    //announcement to everyone in the room
    const response = {
      name: 'server',
      msg: `${data.name} has joined the room`,
    };
    socket.broadcast.to('room1').emit('msg', response);

    console.log(`${data.name} joined`);
    //success message back to new user
    socket.emit('msg', { name: 'server', msg: 'You joined the room' });
  });
};

const onMsg = (sock) => {
  const socket = sock;

  socket.on('msgToServer', data => {
    const action = data.msg.split(' ');
    const name = socket.name;
    if (action[0] === '/me') {
      io.sockets.in('room1').emit('msg', { name: 'server', msg: `${name} ${data.msg.substring(data.msg.indexOf(' ')+1)}` });
    } else if (data.msg === 'time') {
      let date = new Date();
      socket.emit('msg', { name: 'server', msg: `The time is ${date.getHours()}:${date.getMinutes()}` });
    } else {
      io.sockets.in('room1').emit('msg', { name, msg: data.msg });
    }
  });
};

const onDisconnect = (sock) => {
  const socket = sock;
  socket.on('disconnect', () => {
    let name = socket.name;

    io.sockets.in('room1').emit('msg', { name: 'server', msg: `${name} has left the room`});
    socket.leave('room1');

    Object.keys(users).forEach(user => {
      if (users[user] === name) {
        delete users[user];
        return;
      }
    });
  });
};

io.sockets.on('connection', socket => {
  console.log('started');

  onJoined(socket);
  onMsg(socket);
  onDisconnect(socket);
});

console.log('Websocket server started');
