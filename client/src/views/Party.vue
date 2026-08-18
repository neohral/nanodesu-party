<template>
  <div class="container">
    <div class="main-content">
      <!-- Player Section -->
      <div class="player-wrapper">
        <div ref="playerContainer" class="player"></div>
      </div>

      <PartyToolPanels v-if="isMurder"/>
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
            <input v-model="videoUrl" placeholder="URL / プレイリスト / 検索ワード" class="url-input" />
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
                  <button
                    v-if="canRemoveFromQueue(element)"
                    @click.stop="removeFromQueue(element.id)"
                    class="stock-action-button danger"
                  >
                    削除
                  </button>
                </div>
              </template>
            </draggable>

            <div v-if="roomState.historyQueue.length > 0" class="history-section">
              <div class="history-section-header">
                <h4>再生履歴</h4>
                <button @click="copyHistoryToClipboard" class="history-copy-button">
                  {{ historyCopied ? "コピーしました" : "一覧をコピー" }}
                </button>
              </div>
              <div class="history-queue-container">
                <div v-for="element in [...roomState.historyQueue].reverse()" :key="`history-${element.id}`" class="queue-item">
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

          <div class="stock-section">
            <h4>Stock</h4>
            <div class="input-section">
              <input v-model="stockUrl" placeholder="URL / プレイリスト / 検索ワード" class="url-input" />
              <input v-model.number="stockSeekTo" type="number" placeholder="開始時間（秒）" class="seek-input" min="0" />
              <button @click="addToStock" class="add-button" :disabled="stockLoading">
                {{ stockLoading ? "..." : "Add" }}
              </button>
            </div>
            <div class="queue-display">
              <draggable v-model="stockItems" item-key="id" class="queue-container">
                <template #item="{ element }">
                  <div class="queue-item stock-item">
                    <img :src="element.thumbnail" width="80" />
                    <div class="queue-item-info">
                      <div class="queue-item-title">{{ element.title }}</div>
                      <div v-if="element.seekTo > 0" class="queue-item-user">{{ element.seekTo }}秒から</div>
                    </div>
                    <div class="stock-item-actions">
                      <button @click="addStockToQueue(element)" class="stock-action-button">Queue</button>
                      <button @click="removeFromStock(element.id)" class="stock-action-button danger">削除</button>
                    </div>
                  </div>
                </template>
              </draggable>
              <p v-if="stockItems.length === 0" class="stock-empty">Stockは空です</p>
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
import { ref, onMounted, onUnmounted, provide } from "vue";
import { useRoute } from "vue-router";
import { io } from "socket.io-client";
import draggable from "vuedraggable";
import PartyToolPanels from "../components/PartyToolPanels.vue";
import { PARTY_TOOL_PANELS_KEY } from "../components/partyToolPanelsKeys.js";
import { useRoom } from "../composables/room";
import { useStock } from "../composables/useStock";
import { usePartyToolPanels } from "../composables/usePartyToolPanels";

const props = defineProps({
  isMurder: Boolean
})

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
  canRemoveFromQueue,
  removeFromQueue,
  copyHistoryToClipboard,
  historyCopied,
  addVideo,
  startPlayback,
  skipToNextVideo,
  eventRegister,
  toggleOpacity,
  toggleHideQueue,
  toggleLoop,
  endLoop,
  stateChange,
} = useRoom(socket, roomId, roomState, playerRef, changeOpacity);

const {
  stockItems,
  stockUrl,
  stockSeekTo,
  stockLoading,
  addToStock,
  removeFromStock,
  addStockToQueue,
} = useStock(socket, roomId);

const {
  registerPartyToolSocketHandlers,
  ...partyToolProvide
} = usePartyToolPanels(socket, roomId, roomState);

eventRegister(io, socket, roomState);
registerPartyToolSocketHandlers(socket, roomState);

provide(PARTY_TOOL_PANELS_KEY, {
  roomState,
  userId,
  ...partyToolProvide,
});

socket.on("prepare-video", ({ videoId, seekTo }) => {
  partyState.value = "preparing";
  currentVideoSeekTo.value = seekTo
  player.cueVideoById(videoId, currentVideoSeekTo.value);
});

onMounted(() => {
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
          iframe.style.width = "100%";
          iframe.style.height = "100%";
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
      iframe.style.width = "100%";
      iframe.style.height = "100%";
    }
  });
});

onUnmounted(() => {
  partyToolProvide.stopAlarm();
});
</script>
