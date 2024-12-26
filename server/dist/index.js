"use strict";
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
const users = [];
// Add user to users array
const addUser = (userId, socketId) => {
    !users.some((user) => user.userId === userId) &&
        users.push({ userId, socketId });
};
// Remove user from users array
const removeUser = (socketId) => {
    const index = users.findIndex((user) => user.socketId === socketId);
    if (index !== -1) {
        users.splice(index, 1);
    }
};
// Get user by userId
const getUser = (userId) => {
    return users.find((user) => user.userId === userId);
};
io.on('connection', (socket) => {
    console.log('A user connected');
    // When a user connects
    socket.on('addUser', (userId) => {
        addUser(userId, socket.id);
        io.emit('getUsers', users);
    });
    // Send and get message
    socket.on('sendMessage', ({ senderId, receiverId, text, chatId }) => {
        const user = getUser(receiverId);
        if (user) {
            io.to(user.socketId).emit('getMessage', {
                senderId,
                text,
                chatId,
                timestamp: new Date()
            });
        }
    });
    // Handle typing state
    socket.on('typing', ({ senderId, receiverId, chatId, text }) => {
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
    socket.on('stopTyping', ({ senderId, receiverId, chatId }) => {
        const user = getUser(receiverId);
        if (user) {
            io.to(user.socketId).emit('userStopTyping', {
                senderId,
                chatId
            });
        }
    });
    // When user disconnects
    socket.on('disconnect', () => {
        console.log('A user disconnected');
        removeUser(socket.id);
        io.emit('getUsers', users);
    });
});
const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
