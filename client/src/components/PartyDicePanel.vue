<template>
  <div class="tool-panel dice-panel">
    <h4>🎲 Dice</h4>
    <div class="dice-input-group-compact">
      <input v-model.number="diceCount" type="number" placeholder="個数" class="dice-input-compact" min="1" />
      <select v-model.number="diceType" class="dice-select-compact">
        <option :value="6">1d6</option>
        <option :value="10">1d10</option>
        <option :value="20">1d20</option>
        <option :value="100">1d100</option>
      </select>
      <button type="button" @click="rollDice" class="dice-button-compact">Roll</button>
      <button
        v-if="userId === roomState.leader"
        type="button"
        @click="clearDices"
        class="dice-clear-btn-compact"
      >
        Clear
      </button>
    </div>
    <div class="dices-compact">
      <div v-for="dice in reverseItems(roomState.dices)" :key="dice.id" class="dice-result-compact">
        <span class="dice-user">{{ dice.userName }}</span>
        <span class="dice-rolls">{{ dice.rolls.join(", ") }}</span>
        <span class="dice-total">= {{ dice.total }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import "@/styles/party-dice-panel.css";
import { usePartyToolPanelsContext } from "./usePartyToolPanelsContext.js";

const p = usePartyToolPanelsContext();

const roomState = p.roomState;
const userId = p.userId;
const diceCount = p.diceCount;
const diceType = p.diceType;
const rollDice = p.rollDice;
const clearDices = p.clearDices;

function reverseItems(items) {
  return items.slice().reverse();
}
</script>
