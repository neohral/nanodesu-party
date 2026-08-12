/**
 * Watch Party 左パネル（Timer / Vote / Dice）向け Socket ハンドラ。
 * `serverParty.js` は従来どおり `party.js` 経由でこれらを読み込む。
 */
const { timerRegister } = require("./timer")
const { pollRegister } = require("./poll")
const { diceRegister } = require("./dice")

module.exports = {
    timerRegister,
    pollRegister,
    diceRegister,
}
