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
  messageId?: string;
}

interface TypingData {
  senderId: string;
  receiverId: string;
  chatId: string;
  text: string;
}

interface ReadReceiptData {
  messageId: string;
  chatId: string;
  readerId: string;
  senderId: string;
}

const users: User[] = [];

// Add user to users array
const addUser = (userId: string, socketId: string) => {
  const existingUser = users.some((user) => user.userId === userId);
  if (!existingUser) {
    users.push({ userId, socketId });
  } else {
    // Update socket ID for existing user
    const index = users.findIndex((user) => user.userId === userId);
    users[index].socketId = socketId;
  }
};

// Remove user from users array
const removeUser = (socketId: string) => {
  const index = users.findIndex((user) => user.socketId === socketId);
  if (index !== -1) {
    users.splice(index, 1);
  }
};

// Get user by userId
const getUser = (userId: string) => {
  return users.find((user) => user.userId === userId);
};

io.on('connection', (socket: any) => {
  // When a user connects
  socket.on('addUser', (userId: string) => {
    addUser(userId, socket.id);
    io.emit('getUsers', users);
  });

  // Send and get message
  socket.on('sendMessage', ({ senderId, receiverId, text, chatId, messageId }: MessageData) => {
    const user = getUser(receiverId);
    if (user) {
      io.to(user.socketId).emit('getMessage', {
        senderId,
        text,
        chatId,
        messageId,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Handle typing state
  socket.on('typing', ({ senderId, receiverId, chatId, text }: TypingData) => {
    const user = getUser(receiverId);
    if (user) {
      io.to(user.socketId).emit('userTyping', {
        senderId,
        chatId,
        text
      });
    }
  });

  // Handle stop typing
  socket.on('stop-typing', ({ senderId, receiverId, chatId }: MessageData) => {
    const user = getUser(receiverId);
    if (user) {
      io.to(user.socketId).emit('userStopTyping', {
        senderId,
        chatId
      });
    }
  });

  // Handle message read receipt
  socket.on('messageRead', ({ messageId, chatId, readerId, senderId }: ReadReceiptData) => {
    console.log('📤 Read receipt from:', readerId, 'to:', senderId);
    const user = getUser(senderId);
    if (user) {
      // Emit only messageRead event
      io.to(user.socketId).emit('messageRead', {
        messageId,
        chatId,
        readerId
      });
      console.log('📨 Emitted read receipt to:', user.socketId);
    } else {
      console.log('❌ Message sender not found:', senderId);
    }
  });

  // When user disconnects
  socket.on('disconnect', () => {
    removeUser(socket.id);
    io.emit('getUsers', users);
  });
});

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 