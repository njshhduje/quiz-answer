const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

let users = {}; 
let isLocked = false;
let isVisible = false;
let timerValue = 60;
let timerInterval = null;

io.on('connection', (socket) => {
    socket.emit('init_state', { isLocked, isVisible, timerValue });

    socket.on('join', (data) => {
        const index = data.index !== undefined ? data.index : Object.keys(users).length % 6;
        users[socket.id] = { name: data.name, index: index };
        socket.emit('assigned', { index: index });
        io.emit('update_users', users);
    });

    socket.on('draw', (data) => {
        if (!isLocked) io.emit('render', { index: data.index, image: data.image });
    });

    socket.on('set_lock', (l) => { isLocked = l; io.emit('lock_update', l); });
    socket.on('set_visibility', (v) => { 
        isVisible = v; 
        io.emit('visibility_update', v); 
        // 「隠す」が押された（vがfalse）ならロック解除
        if (!v) {
            isLocked = false;
            io.emit('lock_update', false);
        }
    });

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
                // タイマー終了時に自動ロック
                isLocked = true;
                io.emit('lock_update', true);
                io.emit('timer_finished');
            }
        }, 1000);
    });

    socket.on('reset_timer', (duration) => {
        clearInterval(timerInterval);
        timerValue = duration;
        io.emit('timer_update', timerValue);
    });

    socket.on('judge', (results) => { io.emit('judge_results', results); });

    socket.on('clear_all', () => {
        for(let i=0; i<6; i++) {
            io.emit('render', { index: i, image: null });
            io.emit('remote_clear', i);
        }
        io.emit('judge_results', Array(6).fill(null)); // 判定もリセット
    });

    socket.on('disconnect', () => {
        delete users[socket.id];
        io.emit('update_users', users);
    });
});

server.listen(process.env.PORT || 3000);
