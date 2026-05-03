<template>
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
</template>

<script setup>
import "@/styles/party-vote-panel.css";
import { usePartyToolPanelsContext } from "./usePartyToolPanelsContext.js";

const p = usePartyToolPanelsContext();

const roomState = p.roomState;
const userId = p.userId;
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
</script>
