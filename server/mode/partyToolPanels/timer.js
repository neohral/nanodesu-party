const crypto = require("crypto")

/** roomId:timerId -> completion timeout (not serialized to clients) */
const timerCompletionHandles = new Map()

function timerHandleKey(roomId, timerId) {
    return `${roomId}\0${timerId}`
}

function timerRegister(io, socket, roomState) {
    socket.on("create-timer", ({ roomId, seconds, name }) => {
        const room = roomState[roomId]
        const timer = {
            id: crypto.randomUUID(),
            name: name || `Timer ${room.timers.length + 1}`,
            seconds: seconds,
            startedBy: socket.id,
            startedAt: Date.now(),
            isActive: true
        }
        room.timers.push(timer)
        io.to(roomId).emit("timers-updated", { timers: room.timers })

        const key = timerHandleKey(roomId, timer.id)
        const handle = setTimeout(() => {
            timerCompletionHandles.delete(key)
            room.timers = room.timers.filter(t => t.id !== timer.id)
            io.to(roomId).emit("timers-updated", { timers: room.timers })
            io.to(roomId).emit("timer-completed", { timerId: timer.id, timerName: timer.name })
        }, seconds * 1000)
        timerCompletionHandles.set(key, handle)
    })

    socket.on("delete-timer", ({ roomId, timerId }) => {
        const room = roomState[roomId]
        const key = timerHandleKey(roomId, timerId)
        const handle = timerCompletionHandles.get(key)
        if (handle) {
            clearTimeout(handle)
            timerCompletionHandles.delete(key)
        }
        room.timers = room.timers.filter(t => t.id !== timerId)
        io.to(roomId).emit("timers-updated", { timers: room.timers })
    })
}

module.exports = { timerRegister }
