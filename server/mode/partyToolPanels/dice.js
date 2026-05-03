const crypto = require("crypto")

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

module.exports = { diceRegister }
