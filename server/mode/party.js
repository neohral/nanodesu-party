const crypto = require("crypto")
const { fetchVideoInfo } = require("../common/youtube")
const {startPlayback } =
  require("../common/videoSync")

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
    dices: []
}
function videoRegister(io, socket, roomState) {
    socket.on("add-video", async ({ roomId, videoId, seekTo }) => {
        const room = roomState[roomId]
        const info = await fetchVideoInfo(videoId)
        if (!info) return

        const member = room.members.find(m => m.id === socket.id)
        if (!member) return

        const video = {
            id: crypto.randomUUID(),
            user: socket.id,
            userName: member.name,
            seekTo: seekTo,
            ...info
        }

        room.queue.push(video)
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
        if(room.endLoop){
            next = room.historyQueue.pop()
        }else{
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
    io.to(roomId).emit("prepare-video", { videoId: next.videoId, seekTo: room.currentVideoSeekTo, })
    io.to(roomId).emit("queue-updated", { queue: room.queue, historyQueue: room.historyQueue })

    room.timeoutId = setTimeout(() => startPlayback(io, roomId, roomState), 5000)
}

/** roomId:timerId -> completion timeout (not serialized to clients) */
const timerCompletionHandles = new Map()

function timerHandleKey(roomId, timerId) {
    return `${roomId}\0${timerId}`
}

module.exports = {
    initroom,
    mode,
    videoRegister,
    prepareVideo,
    timerRegister,
    pollRegister,
    diceRegister
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

function pollRegister(io, socket, roomState) {
    socket.on("create-poll", ({ roomId, options, allowMultiple }) => {
        const room = roomState[roomId]
        if (socket.id !== room.leader) return

        const poll = {
            id: crypto.randomUUID(),
            options: options.map((opt, idx) => ({
                id: idx,
                text: opt,
                votes: [],
                count: 0
            })),
            allowMultiple: allowMultiple || false,
            phase: "creation",
            createdAt: Date.now()
        }
        room.polls.push(poll)
        io.to(roomId).emit("polls-updated", { polls: room.polls })
    })

    socket.on("update-poll-option", ({ roomId, pollId, optionIndex, newText }) => {
        if (socket.id !== roomState[roomId].leader) return
        const room = roomState[roomId]
        const poll = room.polls.find(p => p.id === pollId)
        if (!poll || poll.phase !== "creation") return
        if (poll.options[optionIndex]) {
            poll.options[optionIndex].text = newText
            io.to(roomId).emit("polls-updated", { polls: room.polls })
        }
    })

    socket.on("update-poll-allow-multiple", ({ roomId, pollId, allowMultiple }) => {
        if (socket.id !== roomState[roomId].leader) return
        const room = roomState[roomId]
        const poll = room.polls.find(p => p.id === pollId)
        if (!poll || poll.phase !== "creation") return
        poll.allowMultiple = !!allowMultiple
        io.to(roomId).emit("polls-updated", { polls: room.polls })
    })

    socket.on("add-poll-option", ({ roomId, pollId, optionText }) => {
        if (socket.id !== roomState[roomId].leader) return
        const room = roomState[roomId]
        const poll = room.polls.find(p => p.id === pollId)
        if (!poll || poll.phase !== "creation") return
        poll.options.push({
            id: poll.options.length,
            text: optionText,
            votes: [],
            count: 0
        })
        io.to(roomId).emit("polls-updated", { polls: room.polls })
    })

    socket.on("remove-poll-option", ({ roomId, pollId, optionIndex }) => {
        if (socket.id !== roomState[roomId].leader) return
        const room = roomState[roomId]
        const poll = room.polls.find(p => p.id === pollId)
        if (!poll || poll.phase !== "creation") return
        poll.options.splice(optionIndex, 1)
        io.to(roomId).emit("polls-updated", { polls: room.polls })
    })

    socket.on("start-poll", ({ roomId, pollId, allowMultiple }) => {
        if (socket.id !== roomState[roomId].leader) return
        const room = roomState[roomId]
        const poll = room.polls.find(p => p.id === pollId)
        if (!poll) return
        if (typeof allowMultiple === "boolean") {
            poll.allowMultiple = allowMultiple
        }
        poll.phase = "voting"
        io.to(roomId).emit("polls-updated", { polls: room.polls })
    })

    socket.on("vote-poll", ({ roomId, pollId, optionIds }) => {
        const room = roomState[roomId]
        const poll = room.polls.find(p => p.id === pollId)
        if (!poll || poll.phase !== "voting") return

        const optionIdsArray = (Array.isArray(optionIds) ? optionIds : [optionIds])
            .map((id) => Number(id))
            .filter((id) => Number.isInteger(id) && id >= 0 && id < poll.options.length)

        if (poll.allowMultiple) {
            poll.options.forEach((opt, idx) => {
                const want = optionIdsArray.includes(idx)
                const has = opt.votes.includes(socket.id)
                if (want && !has) {
                    opt.votes.push(socket.id)
                } else if (!want && has) {
                    opt.votes = opt.votes.filter(id => id !== socket.id)
                }
                opt.count = opt.votes.length
            })
        } else {
            poll.options.forEach(opt => {
                opt.votes = opt.votes.filter(id => id !== socket.id)
                opt.count = opt.votes.length
            })
            optionIdsArray.forEach(optionId => {
                const option = poll.options[optionId]
                if (option && !option.votes.includes(socket.id)) {
                    option.votes.push(socket.id)
                    option.count = option.votes.length
                }
            })
        }

        io.to(roomId).emit("polls-updated", { polls: room.polls })
    })

    socket.on("end-poll", ({ roomId, pollId }) => {
        if (socket.id !== roomState[roomId].leader) return
        const room = roomState[roomId]
        const poll = room.polls.find(p => p.id === pollId)
        if (!poll) return
        poll.phase = "results"
        io.to(roomId).emit("polls-updated", { polls: room.polls })
    })

    socket.on("delete-poll", ({ roomId, pollId }) => {
        if (socket.id !== roomState[roomId].leader) return
        const room = roomState[roomId]
        room.polls = room.polls.filter(p => p.id !== pollId)
        io.to(roomId).emit("polls-updated", { polls: room.polls })
    })
}

function diceRegister(io, socket, roomState) {
    socket.on("roll-dice", ({ roomId, diceCounts, diceType }) => {
        const room = roomState[roomId]
        const member = room.members.find(m => m.id === socket.id)
        if (!member) return

        const rolls = []
        for (let i = 0; i < diceCounts; i++) {
            rolls.push(Math.floor(Math.random() * diceType) + 1)
        }

        const diceResult = {
            id: crypto.randomUUID(),
            userId: socket.id,
            userName: member.name,
            diceCounts: diceCounts,
            diceType: diceType,
            rolls: rolls,
            total: rolls.reduce((a, b) => a + b, 0),
            timestamp: Date.now()
        }

        room.dices.push(diceResult)
        io.to(roomId).emit("dices-updated", { dices: room.dices })
    })

    socket.on("clear-dices", ({ roomId }) => {
        if (socket.id !== roomState[roomId].leader) return
        const room = roomState[roomId]
        room.dices = []
        io.to(roomId).emit("dices-updated", { dices: room.dices })
    })
}
