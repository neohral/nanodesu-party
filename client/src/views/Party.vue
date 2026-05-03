<template>
  <div class="container">
    <div class="main-content">
      <!-- Player Section -->
      <div class="player-wrapper">
        <div ref="playerContainer" class="player"></div>
      </div>

      <!-- Timer, Vote, Dice Panels -->
      <div class="tool-panels">
        <!-- Timer Panel -->
        <div class="tool-panel timer-panel">
          <h4>⏱ Timer</h4>
          <div class="timer-input-group">
            <input v-model.number="timerMinutes" type="number" placeholder="分" class="timer-input timer-minutes" min="0" />
            <span class="timer-separator">:</span>
            <input v-model.number="timerSeconds" type="number" placeholder="秒" class="timer-input timer-secs" min="0" max="59" />
            <input v-model="timerName" type="text" placeholder="名前" class="timer-name-input" />
            <button @click="createTimer" class="timer-button">Set</button>
          </div>
          <div class="timers-list">
            <div v-for="timer in roomState.timers" :key="timer.id" class="timer-item-compact">
              <span class="timer-name">{{ timer.name }}</span>
              <span class="timer-remaining">{{ (timerRefresh, formatTimerDisplay(getTimerRemaining(timer))) }}</span>
              <button @click="deleteTimer(timer.id)" class="timer-delete-btn">×</button>
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
              <span class="dice-rolls">{{ dice.rolls.join(', ') }}</span>
              <span class="dice-total">= {{ dice.total }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Toggle Button -->
    <button class="toggle-button" @click="sidebarOpen = !sidebarOpen">
      {{ sidebarOpen ? "✕" : "☰" }}
    </button>

    <!-- Name Input Modal -->
    <div v-if="showNameModal" class="modal-overlay">
      <div class="modal-dialog">
        <h3>あなたの名前を入力してください</h3>
        <input v-model="userName" type="text" placeholder="名前を入力" class="name-input" @keyup.enter="joinRoom" />
        <button @click="joinRoom" class="modal-button">参加</button>
      </div>
    </div>

    <!-- Sidebar -->
    <div class="sidebar" :class="{ open: sidebarOpen }">
      <div class="sidebar-header">
        <h3>
          {{ roomId }} watch party<span v-if="userId === roomState.leader">👑</span>
        </h3>
      </div>

      <!-- Tabs -->
      <div class="sidebar-tabs">
        <button @click="activeTab = 'queue'" :class="{ active: activeTab === 'queue' }" class="tab-button">
          Queue
        </button>
        <button @click="activeTab = 'settings'" :class="{ active: activeTab === 'settings' }" class="tab-button">
          Settings
        </button>
        <button v-if="userId === roomState.leader" @click="activeTab = 'leader'"
          :class="{ active: activeTab === 'leader' }" class="tab-button leader-tab">
          Commands
        </button>
      </div>

      <div class="sidebar-content">
        <!-- Queue Tab -->
        <div v-if="activeTab === 'queue'" class="tab-content">
          <div class="input-section">
            <input v-model="videoUrl" placeholder="YouTube URL" class="url-input" />
            <input v-model.number="videoSeekTo" type="number" placeholder="開始時間（秒）" class="seek-input" min="0" />
            <button @click="addVideo" class="add-button">Add</button>
          </div>
          <div v-if="!hideQueue" class="queue-display">
            <draggable v-model="roomState.queue" item-key="id" @end="onReorder" class="queue-container">
              <template #item="{ element }">
                <div class="queue-item">
                  <img :src="element.thumbnail" width="80" />
                  <div class="queue-item-info">
                    <div class="queue-item-title">{{ element.title }}</div>
                    <div class="queue-item-user">{{ element.userName }}</div>
                  </div>
                </div>
              </template>
            </draggable>

            <div v-if="roomState.historyQueue.length > 0" class="history-section">
              <h4>再生済み</h4>
              <div class="history-queue-container">
                <div v-for="element in roomState.historyQueue" :key="`history-${element.id}`" class="queue-item">
                  <img :src="element.thumbnail" width="80" />
                  <div class="queue-item-info">
                    <div class="queue-item-title">{{ element.title }}</div>
                    <div class="queue-item-user">{{ element.userName }}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="queue-hidden-message">
            <p>⚠️ Queue is hidden by the leader</p>
          </div>
        </div>

        <!-- Settings Tab -->
        <div v-if="activeTab === 'settings'" class="tab-content">
          <div class="members-section">
            <h4>Members ({{ roomState.members.length }})</h4>
            <div class="members-list">
              <div v-for="member in roomState.members" :key="member.id" class="member-item">
                <span>{{ member.name || "Anonymous" }}</span>
                <span v-if="member.id === roomState.leader" class="leader-badge">Leader</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Leader Commands Tab -->
        <div v-if="activeTab === 'leader' && userId === roomState.leader" class="tab-content">
          <div class="leader-commands">
            <h4>Leader Commands</h4>
            <button @click="skipToNextVideo" class="command-button danger-button">
              Skip to next video
            </button>
          </div>

          <div class="leader-settings">
            <h4>Leader Settings</h4>
            <div class="setting-item">
              <label>
                <input type="checkbox" v-model="hideQueue" @change="toggleHideQueue" />
                Hide queue
              </label>
            </div>
            <div class="setting-item">
              <label>
                <input type="checkbox" v-model="hideVideo" @change="toggleOpacity" />
                Hide video
              </label>
            </div>
            <div class="setting-item">
              <label>
                <input type="checkbox" v-model="endLoop" @change="toggleLoop" />
                 Empty loop
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import '@/styles/nanodesu.css'
import { ref, onMounted, onUnmounted } from "vue";
import { useRoute } from "vue-router";
import { io } from "socket.io-client";
import draggable from "vuedraggable";
import { useRoom } from "../composables/room";

const route = useRoute();
const roomId = route.params.roomId;
const socket = io(import.meta.env.VITE_SOCKET_PARTY_URL, {
  path: import.meta.env.VITE_SOCKET_PARTY_PATH
})

const roomState = ref({
  members: [],
  leader: null,
  currentVideoId: null,
  queue: [],
  historyQueue: [],
  timers: [],
  polls: [],
  dices: [],
});
const playerContainer = ref(null);
const sidebarOpen = ref(true);
const activeTab = ref("queue");
const playerRef = ref(null);
const changeOpacity = (opacity) => {
  const iframe = player.getIframe();
  iframe.style.opacity = opacity;
  // opacityが0の時にクリック不可にする
  iframe.style.pointerEvents =
    opacity === "0" || opacity === 0 ? "none" : "auto";
}


let player = null;
const {
  userId,
  currentVideoStartTime,
  currentVideoPauseTime,
  currentVideoSeekTo,
  videoSeekTo,
  userName,
  hideQueue,
  hideVideo,
  showNameModal,
  videoUrl,
  partyState,
  joinRoom,
  onReorder,
  addVideo,
  startPlayback,
  skipToNextVideo,
  eventRegister,
  toggleOpacity,
  toggleHideQueue,
  toggleLoop,
  endLoop,
  stateChange,
  timerMinutes,
  timerSeconds,
  timerName,
  createTimer,
  deleteTimer,
  formatTimerDisplay,
  pollCount,
  createNewPoll,
  startPoll,
  endPoll,
  deletePoll,
  addPollOption,
  removePollOption,
  updatePollOption,
  setPollAllowMultiple,
  votePoll,
  getPollVotedCount,
  diceCount,
  diceType,
  rollDice,
  clearDices,
  stopAlarm,
  getRoomMemberName,
  getTimerRemaining,
} = useRoom(socket, roomId, roomState, playerRef, changeOpacity);
eventRegister(io, socket, roomState);


socket.on("prepare-video", ({ videoId, seekTo }) => {
  partyState.value = "preparing";
  currentVideoSeekTo.value = seekTo
  player.cueVideoById(videoId, currentVideoSeekTo.value);
});

const timerRefresh = ref(0);
const timerRefreshInterval = ref(null);
const reverseItems = (items)=> {
      return items.slice().reverse();
    };
onMounted(() => {
  timerRefreshInterval.value = setInterval(() => {
    timerRefresh.value += 1;
  }, 500);

  const tag = document.createElement("script");
  tag.src = "https://www.youtube.com/iframe_api";
  document.body.appendChild(tag);

  window.onYouTubeIframeAPIReady = () => {
    player = new YT.Player(playerContainer.value, {
      videoId: "",
      playerVars: {
        rel: 0,
        modestbranding: 1,
      },
      events: {
        onReady: () => {
          playerRef.value = player;
          const iframe = player.getIframe();
          iframe.style.position = "absolute";
          iframe.style.top = "0";
          iframe.style.left = "0";
          showNameModal.value = true;
        },
        onStateChange: (event) => {
          stateChange(event)
          if (event.data === YT.PlayerState.ENDED) {
            socket.emit("video-ended", { roomId });
            partyState.value = "waiting";
          }
        },
      },
    });
  };

  window.addEventListener("resize", () => {
    if (player) {
      const iframe = player.getIframe();
    }
  });
});

onUnmounted(() => {
  stopAlarm();
  if (timerRefreshInterval.value) {
    clearInterval(timerRefreshInterval.value);
  }
});
</script>
