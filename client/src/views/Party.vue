<template>
  <div class="container">
    <div class="main-content">
      <div class="player-wrapper">
        <div ref="playerContainer" class="player"></div>
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
        <button @click="activeTab = 'timer'" :class="{ active: activeTab === 'timer' }" class="tab-button">
          Timer
        </button>
        <button @click="activeTab = 'vote'" :class="{ active: activeTab === 'vote' }" class="tab-button">
          Vote
        </button>
        <button @click="activeTab = 'dice'" :class="{ active: activeTab === 'dice' }" class="tab-button">
          Dice
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

        <!-- Timer Tab -->
        <div v-if="activeTab === 'timer'" class="tab-content">
          <div class="timer-section">
            <h4>Timers</h4>
            <div class="timer-input-group">
              <input v-model.number="timerSeconds" type="number" placeholder="秒数" class="timer-input" min="1" />
              <input v-model="timerName" type="text" placeholder="タイマー名" class="timer-name-input" />
              <button @click="createTimer" class="timer-button">Set</button>
            </div>
            <div class="timers-list">
              <div v-for="timer in roomState.timers" :key="timer.id" class="timer-item">
                <div class="timer-info">
                  <span class="timer-name">{{ timer.name }}</span>
                  <span class="timer-user">{{ getRoomMemberName(timer.startedBy) }}</span>
                  <span class="timer-remaining">残り時間: {{ (timerRefresh, getTimerRemaining(timer)) }}秒</span>
                </div>
                <button @click="deleteTimer(timer.id)" class="timer-delete-btn">×</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Vote Tab -->
        <div v-if="activeTab === 'vote'" class="tab-content">
          <div class="vote-section">
            <h4>Voting</h4>
            <div v-if="roomState.polls.length === 0" class="no-polls">
              <p>投票がありません</p>
            </div>
            <div v-for="poll in roomState.polls" :key="poll.id" class="poll-container">
              <!-- Creation Phase -->
              <div v-if="poll.phase === 'creation' && userId === roomState.leader" class="poll-creation">
                <h5>投票を作成中</h5>
                <div class="poll-options-edit">
                  <div v-for="(option, idx) in poll.options" :key="option.id" class="poll-option-edit">
                    <input v-model="option.text" type="text" class="poll-option-input" />
                    <button @click="removePollOption(poll.id, idx)" class="delete-btn">×</button>
                  </div>
                </div>
                <button @click="addPollOption(poll.id)" class="poll-add-option-btn">選択肢を追加</button>
                <div class="poll-options-toggle">
                  <label>
                    <input type="checkbox" v-model="poll.allowMultiple" />
                    複数選択を許可
                  </label>
                </div>
                <div class="poll-phase-buttons">
                  <button @click="startPoll(poll.id)" class="poll-start-btn">投票開始</button>
                  <button @click="deletePoll(poll.id)" class="poll-delete-btn">削除</button>
                </div>
              </div>

              <!-- Voting Phase -->
              <div v-else-if="poll.phase === 'voting'" class="poll-voting">
                <h5>投票中</h5>
                <div class="poll-options-voting">
                  <div v-for="(option, idx) in poll.options" :key="option.id" class="poll-option-voting">
                    <label class="poll-option-label">
                      <input 
                        :type="poll.allowMultiple ? 'checkbox' : 'radio'" 
                        :value="idx"
                        @change="votePoll(poll.id, idx, poll.allowMultiple, $event)"
                        :name="`poll-${poll.id}`"
                        class="poll-input"
                      />
                      {{ option.text }}
                    </label>
                  </div>
                </div>
                <div v-if="userId === roomState.leader" class="poll-voting-info">
                  <p>投票済み: {{ getPollVotedCount(poll) }} / {{ roomState.members.length }}</p>
                  <button @click="endPoll(poll.id)" class="poll-end-btn">結果発表</button>
                </div>
              </div>

              <!-- Results Phase -->
              <div v-else-if="poll.phase === 'results'" class="poll-results">
                <h5>投票結果</h5>
                <div class="poll-results-display">
                  <div v-for="(option, idx) in poll.options" :key="option.id" class="poll-result-item">
                    <div class="result-label">{{ option.text }}: {{ option.count }}票</div>
                    <div class="result-voters">
                      <span v-for="voterId in option.votes" :key="voterId" class="voter-name">
                        {{ getRoomMemberName(voterId) }}
                      </span>
                    </div>
                  </div>
                </div>
                <div v-if="userId === roomState.leader" class="poll-result-buttons">
                  <button @click="deletePoll(poll.id)" class="poll-delete-btn">削除</button>
                </div>
              </div>
            </div>

            <div v-if="userId === roomState.leader" class="create-new-poll">
              <button @click="createNewPoll" class="new-poll-btn">新しい投票を作成</button>
            </div>
          </div>
        </div>

        <!-- Dice Tab -->
        <div v-if="activeTab === 'dice'" class="tab-content">
          <div class="dice-section">
            <h4>Dice Roller</h4>
            <div class="dice-input-group">
              <input v-model.number="diceCount" type="number" placeholder="個数" class="dice-input" min="1" />
              <select v-model.number="diceType" class="dice-select">
                <option :value="6">1d6</option>
                <option :value="10">1d10</option>
                <option :value="20">1d20</option>
                <option :value="100">1d100</option>
              </select>
              <button @click="rollDice" class="dice-button">Roll</button>
            </div>
            <div v-if="userId === roomState.leader" class="dice-clear">
              <button @click="clearDices" class="dice-clear-btn">履歴をクリア</button>
            </div>
            <div class="dices-history">
              <div v-for="dice in roomState.dices" :key="dice.id" class="dice-result">
                <div class="dice-result-header">
                  <span class="dice-user">{{ dice.userName }}</span>
                  <span class="dice-notation">{{ dice.diceCounts }}d{{ dice.diceType }}</span>
                </div>
                <div class="dice-rolls">
                  <span v-for="(roll, idx) in dice.rolls" :key="idx" class="dice-roll">{{ roll }}</span>
                </div>
                <div class="dice-total">合計: {{ dice.total }}</div>
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
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import '@/styles/nanodesu.css'
import { ref, onMounted, watch, onUnmounted } from "vue";
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
  stateChange,
  timerSeconds,
  timerName,
  createTimer,
  deleteTimer,
  pollCount,
  createNewPoll,
  startPoll,
  endPoll,
  deletePoll,
  addPollOption,
  removePollOption,
  votePoll,
  getPollVotedCount,
  diceCount,
  diceType,
  rollDice,
  clearDices,
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
  if (timerRefreshInterval.value) {
    clearInterval(timerRefreshInterval.value);
  }
});
</script>
