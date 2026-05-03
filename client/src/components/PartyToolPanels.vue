<template>
  <div class="tool-panels">
    <!-- Timer Panel -->
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

    <!-- Vote Panel -->
    <div class="tool-panel vote-panel">
      <h4>🗳 Vote</h4>

      <div v-if="userId === roomState.leader" class="poll-management-compact">
        <h5 class="poll-mgmt-compact-title">Poll Management</h5>
        <button type="button" @click="createNewPoll" class="command-button success-button poll-mgmt-new">
          New Poll
        </button>
        <div
          v-for="poll in roomState.polls.filter((p) => p.phase === 'creation' || p.phase === 'voting')"
          :key="poll.id"
          class="poll-mgmt-mini"
        >
          <div v-if="poll.phase === 'creation'" class="poll-mgmt-mini-creation">
            <div v-for="(option, idx) in poll.options" :key="option.id" class="poll-mgmt-option-row">
              <input
                v-model="option.text"
                type="text"
                class="poll-option-input-mgmt poll-option-input-compact"
                @input="updatePollOption(poll.id, idx, $event.target.value)"
              />
              <button type="button" @click="removePollOption(poll.id, idx)" class="compact-delete">×</button>
            </div>
            <button type="button" @click="addPollOption(poll.id)" class="mini-btn">+ Option</button>
            <label class="mini-toggle">
              <input
                type="checkbox"
                :checked="poll.allowMultiple"
                @change="setPollAllowMultiple(poll.id, $event.target.checked)"
              />
              Multi-vote
            </label>
            <div class="poll-mgmt-mini-actions">
              <button type="button" @click="startPoll(poll.id)" class="mini-btn success">Start</button>
              <button type="button" @click="deletePoll(poll.id)" class="mini-btn danger">Delete</button>
            </div>
          </div>
          <div v-else-if="poll.phase === 'voting'" class="poll-mgmt-mini-voting">
            <p class="poll-mgmt-voting-meta">
              投票中: {{ getPollVotedCount(poll) }} / {{ roomState.members.length }}
            </p>
            <button type="button" @click="endPoll(poll.id)" class="mini-btn success">Results</button>
          </div>
        </div>
      </div>

      <div
        v-if="roomState.polls.filter((p) => p.phase === 'voting' || p.phase === 'results').length === 0"
        class="no-data"
      >
        投票なし
      </div>
      <div
        v-for="poll in roomState.polls.filter((p) => p.phase === 'voting' || p.phase === 'results')"
        :key="`vote-${poll.id}`"
        class="poll-compact"
      >
        <div v-if="poll.phase === 'voting'" class="poll-voting-compact">
          <div v-for="(option, idx) in poll.options" :key="option.id" class="poll-option-compact">
            <label>
              <input
                :type="poll.allowMultiple ? 'checkbox' : 'radio'"
                :value="idx"
                @change="votePoll(poll.id, idx, poll.allowMultiple)"
                :name="`poll-${poll.id}`"
              />
              {{ option.text }}
            </label>
            <span class="vote-count">({{ option.count }}票)</span>
          </div>
        </div>
        <div v-else-if="poll.phase === 'results'" class="poll-results-compact">
          <div v-for="(option, idx) in poll.options" :key="option.id" class="poll-result-compact">
            <span>{{ option.text }}: {{ option.count }}票</span>
          </div>
          <button
            v-if="userId === roomState.leader"
            type="button"
            @click="deletePoll(poll.id)"
            class="mini-btn danger poll-results-close"
          >
            Close
          </button>
        </div>
      </div>
    </div>

    <!-- Dice Panel -->
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
  </div>
</template>

<script setup>
import { inject, onMounted, onUnmounted, ref } from "vue";
import { PARTY_TOOL_PANELS_KEY } from "./partyToolPanelsKeys.js";

const p = inject(PARTY_TOOL_PANELS_KEY);
if (!p) {
  throw new Error("PartyToolPanels: missing provide(PARTY_TOOL_PANELS_KEY)");
}

const roomState = p.roomState;
const userId = p.userId;
const timerMinutes = p.timerMinutes;
const timerSeconds = p.timerSeconds;
const timerName = p.timerName;
const createTimer = p.createTimer;
const deleteTimer = p.deleteTimer;
const formatTimerDisplay = p.formatTimerDisplay;
const createNewPoll = p.createNewPoll;
const startPoll = p.startPoll;
const endPoll = p.endPoll;
const deletePoll = p.deletePoll;
const addPollOption = p.addPollOption;
const removePollOption = p.removePollOption;
const updatePollOption = p.updatePollOption;
const setPollAllowMultiple = p.setPollAllowMultiple;
const votePoll = p.votePoll;
const getPollVotedCount = p.getPollVotedCount;
const diceCount = p.diceCount;
const diceType = p.diceType;
const rollDice = p.rollDice;
const clearDices = p.clearDices;
const getTimerRemaining = p.getTimerRemaining;

const timerRefresh = ref(0);
const timerRefreshInterval = ref(null);

function reverseItems(items) {
  return items.slice().reverse();
}

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
