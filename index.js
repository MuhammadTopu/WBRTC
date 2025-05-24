const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true
  }
});

// Set up EJS and HBS views 
app.set('views', path.join(__dirname, 'views'));  // Define where your views are located

// Set up EJS/hbs as the view engine
app.set('view engine', 'hbs'); 


// Set up HBS as an additional engine
app.engine('hbs', require('hbs').__express);
app.engine('html', require('hbs').__express);

// Register HBS partials
let hbs = require('hbs');
hbs.registerPartials(path.join(__dirname, '/views/partials'), {
  rename: function (name) {
    return name.replace(/\W/g, '_'); 
  }
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get('/', (req, res) => res.send('Server is working'));
app.get('/videochat', (req, res) => res.render('videochat', { someData: 'value' }));
app.get('/chat_with_me', (req, res) => res.render('chat_with_me', { someData: 'value' }));
app.get('/try', (req, res) => res.render('try', { someData: 'value' }));


const userIdToSocketId = {}; // user-defined ID to socket.id map

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);


  socket.emit('socket_id', socket.id);

  // Store custom user ID from client
  socket.on('set-user-id', (userId) => {
    userIdToSocketId[userId] = socket.id;
    socket.userId = userId; // Save for reverse lookup or cleanup
    console.log(`Mapped user ID ${userId} to socket ID ${socket.id}`);
  });

  // Join room
  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    console.log(`User ${socket.id} joined room ${roomId}`);
  });

  // Group chat
  socket.on('group-message', ({ roomId, name, message }) => {
    io.to(roomId).emit('receive-group-message', {
      socketId: socket.id,
      name,
      message
    });
  });

  // Global broadcast
  socket.on('sendData', (msg) => {
    const dataWithSocketId = {
      ...msg,
      socketId: socket.id
    };
    io.emit('receiveData', dataWithSocketId);
  });

  // Private messaging using custom user IDs
  socket.on('private-message', ({ toUserId, name, message }) => {
    const toSocketId = userIdToSocketId[toUserId];
    if (toSocketId) {
      socket.to(toSocketId).emit('receive-private-message', {
        fromUserId: socket.userId,
        name,
        message
      });
    } else {
      socket.emit('error', { message: `User ${toUserId} not found.` });
    }
  });

  // WebRTC Signaling using custom user IDs
  
  socket.on('user', ({ targetId, offer }) => {
    socket.to(targetId).emit('incoming-call', { offer, from: socket.id });
  });
  // when one client makes an offer…
  socket.on('offer', ({ targetId, offer }) => {
    console.log(`Forwarding offer from ${socket.id} to ${targetId}`);
    socket.to(targetId).emit('offer', { offer, from: socket.id });
  });

  // when the other client sends back an answer…
  socket.on('answer', ({ targetId, answer }) => {
    console.log(`Forwarding answer from ${socket.id} to ${targetId}`);
    socket.to(targetId).emit('answer', { answer });
  });

  // ICE candidates
  socket.on('ice-candidate', ({ targetId, candidate }) => {
    socket.to(targetId).emit('ice-candidate', { candidate });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});



// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
