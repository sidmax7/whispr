const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

interface User {
  userId: string;
  socketId: string;
}

interface MessageData {
  senderId: string;
  receiverId: string;
  text: string;
  chatId: string;
}

interface TypingData {
  senderId: string;
  receiverId: string;
  chatId: string;
  text: string;
}

interface StopTypingData {
  senderId: string;
  receiverId: string;
  chatId: string;
}

const users: User[] = [];

// Add user to users array
const addUser = (userId: string, socketId: string) => {
  const existingUser = users.some((user) => user.userId === userId);
  if (!existingUser) {
    users.push({ userId, socketId });
    console.log('User added:', { userId, socketId });
    console.log('Current users:', users);
  } else {
    // Update socket ID for existing user
    const index = users.findIndex((user) => user.userId === userId);
    users[index].socketId = socketId;
    console.log('User socket updated:', { userId, socketId });
  }
};

// Remove user from users array
const removeUser = (socketId: string) => {
  const index = users.findIndex((user) => user.socketId === socketId);
  if (index !== -1) {
    const removedUser = users.splice(index, 1)[0];
    console.log('User removed:', removedUser);
    console.log('Current users:', users);
  }
};

// Get user by userId
const getUser = (userId: string) => {
  const user = users.find((user) => user.userId === userId);
  console.log('Getting user:', { userId, found: !!user });
  return user;
};

io.on('connection', (socket: any) => {
  console.log('A user connected with socket ID:', socket.id);

  // When a user connects
  socket.on('addUser', (userId: string) => {
    console.log('Add user event received:', { userId, socketId: socket.id });
    addUser(userId, socket.id);
    io.emit('getUsers', users);
  });

  // Send and get message
  socket.on('sendMessage', ({ senderId, receiverId, text, chatId }: MessageData) => {
    console.log('Send message event received:', { senderId, receiverId, text, chatId });
    const user = getUser(receiverId);
    if (user) {
      console.log('Emitting message to user:', user.socketId);
      io.to(user.socketId).emit('getMessage', {
        senderId,
        text,
        chatId,
        timestamp: new Date().toISOString()
      });
    } else {
      console.log('Recipient not found:', receiverId);
    }
  });

  // Handle typing state
  socket.on('typing', ({ senderId, receiverId, chatId, text }: TypingData) => {
    console.log('Typing event received:', { senderId, receiverId, chatId, text });
    const user = getUser(receiverId);
    if (user) {
      console.log('Emitting typing state to user:', user.socketId);
      io.to(user.socketId).emit('userTyping', {
        senderId,
        chatId,
        text
      });
    } else {
      console.log('Recipient not found:', receiverId);
    }
  });

  // Handle stop typing
  socket.on('stopTyping', ({ senderId, receiverId, chatId }: StopTypingData) => {
    console.log('Stop typing event received:', { senderId, receiverId, chatId });
    const user = getUser(receiverId);
    if (user) {
      console.log('Emitting stop typing to user:', user.socketId);
      io.to(user.socketId).emit('userStopTyping', {
        senderId,
        chatId
      });
    } else {
      console.log('Recipient not found:', receiverId);
    }
  });

  // When user disconnects
  socket.on('disconnect', () => {
    console.log('A user disconnected:', socket.id);
    removeUser(socket.id);
    io.emit('getUsers', users);
  });
});

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
}); 