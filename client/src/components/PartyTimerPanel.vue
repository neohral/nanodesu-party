<template>
  <div class="tool-panel timer-panel">
    <h4>⏱ Timer</h4>
    <div class="timer-input-group">
      <input
        v-model.number="timerMinutes"
        type="number"
        placeholder="分"
        class="timer-input timer-minutes"
        min="0"
      />
      <span class="timer-separator">:</span>
      <input
        v-model.number="timerSeconds"
        type="number"
        placeholder="秒"
        class="timer-input timer-secs"
        min="0"
        max="59"
      />
      <input v-model="timerName" type="text" placeholder="名前" class="timer-name-input" />
      <button type="button" @click="createTimer" class="timer-button">Set</button>
    </div>
    <div class="timers-list">
      <div v-for="timer in roomState.timers" :key="timer.id" class="timer-item-compact">
        <span class="timer-name">{{ timer.name }}</span>
        <span class="timer-remaining">{{ (timerRefresh, formatTimerDisplay(getTimerRemaining(timer))) }}</span>
        <button type="button" @click="deleteTimer(timer.id)" class="timer-delete-btn">×</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import "@/styles/party-timer-panel.css";
import { onMounted, onUnmounted, ref } from "vue";
import { usePartyToolPanelsContext } from "./usePartyToolPanelsContext.js";

const p = usePartyToolPanelsContext();

const roomState = p.roomState;
const timerMinutes = p.timerMinutes;
const timerSeconds = p.timerSeconds;
const timerName = p.timerName;
const createTimer = p.createTimer;
const deleteTimer = p.deleteTimer;
const formatTimerDisplay = p.formatTimerDisplay;
const getTimerRemaining = p.getTimerRemaining;

const timerRefresh = ref(0);
const timerRefreshInterval = ref(null);

onMounted(() => {
  timerRefreshInterval.value = setInterval(() => {
    timerRefresh.value += 1;
  }, 500);
});

onUnmounted(() => {
  if (timerRefreshInterval.value) {
    clearInterval(timerRefreshInterval.value);
  }
});
</script>
