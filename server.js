const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

let users = {}; 
let isLocked = false;
let timerValue = 60;
let timerInterval = null;

io.on('connection', (socket) => {
    // 接続時に現在の状態（ロック、タイマー）を送信
    socket.emit('init_state', { isLocked, timerValue });

    socket.on('join', (data) => {
        const index = Object.keys(users).length; 
        users[socket.id] = { name: data.name, index: index % 6 };
        socket.emit('assigned', { index: users[socket.id].index });
        io.emit('update_users', users);
    });

    socket.on('draw', (data) => {
        if (!isLocked) {
            io.emit('render', { index: data.index, image: data.image });
        }
    });

    // 管理者操作: ロック切替
    socket.on('set_lock', (locked) => {
        isLocked = locked;
        io.emit('lock_update', isLocked);
    });

    // 管理者操作: タイマー
    socket.on('start_timer', (duration) => {
        clearInterval(timerInterval);
        timerValue = duration;
        io.emit('timer_update', timerValue);
        
        timerInterval = setInterval(() => {
            if (timerValue > 0) {
                timerValue--;
                io.emit('timer_update', timerValue);
            } else {
                clearInterval(timerInterval);
            }
        }, 1000);
    });

    socket.on('reset_timer', (duration) => {
        clearInterval(timerInterval);
        timerValue = duration;
        io.emit('timer_update', timerValue);
    });

    socket.on('disconnect', () => {
        delete users[socket.id];
        io.emit('update_users', users);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
