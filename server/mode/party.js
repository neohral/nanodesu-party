const crypto = require("crypto")
const { fetchVideoInfo, resolveVideoIds } = require("../common/youtube")
const { startPlayback } = require("../common/videoSync")
const {
    timerRegister,
    pollRegister,
    diceRegister,
} = require("./partyToolPanels")

const mode = "party"
const initroom = {
    members: [],
    currentVideoId: null,
    currentVideoStartTime: null,
    currentVideoTotalPauseTime: null,
    currentVideoStatus: "waiting",
    currentVideoChangeTime: null,
    currentVideoSeekTo: 0,
    queue: [],
    historyQueue: [],
    loadingUsers: [],
    expectedUsers: [],
    timeoutId: "",
    opacity: 1,
    hideQueue: false,
    endLoop: false,
    timers: [],
    polls: [],
    dices: [],
}

function videoRegister(io, socket, roomState) {
    socket.on("add-video", async ({ roomId, videoId, input, seekTo }) => {
        const room = roomState[roomId]
        const member = room.members.find(m => m.id === socket.id)
        if (!member) return

        let videoIds = []
        if (input) {
            videoIds = await resolveVideoIds(input)
        } else if (videoId) {
            videoIds = [videoId]
        }
        if (videoIds.length === 0) return

        let added = false
        for (const id of videoIds) {
            const info = await fetchVideoInfo(id)
            if (!info) continue

            room.queue.push({
                id: crypto.randomUUID(),
                user: socket.id,
                userName: member.name,
                seekTo: added ? 0 : seekTo,
                ...info,
            })
            added = true
        }

        if (!added) return

        io.to(roomId).emit("queue-updated", { queue: room.queue, historyQueue: room.historyQueue })

        if (!room.currentVideoId) {
            prepareVideo(io, roomId, roomState)
        }
    })
    socket.on("video-ended", ({ roomId }) => {
        if (socket.id != roomState[roomId].leader) return
        prepareVideo(io, roomId, roomState)
    })
    socket.on("toggle-loop", ({ roomId }) => {
        roomState[roomId].endLoop = !roomState[roomId].endLoop
        io.to(roomId).emit("sync-loop", { endLoop: roomState[roomId].endLoop })
    })
}

function prepareVideo(io, roomId, roomState) {
    const room = roomState[roomId]
    let next = room.queue.shift()
    if (!next) {
        if (room.endLoop) {
            next = room.historyQueue.pop()
        } else {
            room.currentVideoId = null
            room.currentVideoStatus = "waiting"
            room.currentVideoSeekTo = 0
            io.to(roomId).emit("queue-updated", { queue: room.queue, historyQueue: room.historyQueue })
            return
        }
    }
    room.historyQueue.push(next)
    room.currentVideoId = next.videoId
    const clients = io.sockets.adapter.rooms.get(roomId) || new Set()
    room.expectedUsers = Array.from(clients)
    room.loadingUsers = []
    room.currentVideoPauseStacks = 0
    room.currentVideoSeekTo = next.seekTo
    io.to(roomId).emit("prepare-video", { videoId: next.videoId, seekTo: room.currentVideoSeekTo })
    io.to(roomId).emit("queue-updated", { queue: room.queue, historyQueue: room.historyQueue })

    room.timeoutId = setTimeout(() => startPlayback(io, roomId, roomState), 5000)
}

module.exports = {
    initroom,
    mode,
    videoRegister,
    prepareVideo,
    timerRegister,
    pollRegister,
    diceRegister,
}
