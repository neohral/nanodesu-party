const crypto = require("crypto")

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

module.exports = { pollRegister }
