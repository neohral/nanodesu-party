import { ref, watch } from "vue";

const STORAGE_KEY = "nanodesu-stock";

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function useStock(socket, roomId) {
  const stockItems = ref(loadFromStorage());
  const stockUrl = ref("");
  const stockSeekTo = ref(0);
  const stockLoading = ref(false);

  watch(
    stockItems,
    (items) => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    },
    { deep: true },
  );

  function resolveVideos(input) {
    return new Promise((resolve) => {
      socket.emit("resolve-videos", { input }, (response) => {
        resolve(response?.items || []);
      });
    });
  }

  async function addToStock() {
    const input = stockUrl.value.trim();
    if (!input || stockLoading.value) return;

    stockLoading.value = true;
    try {
      const items = await resolveVideos(input);
      if (items.length === 0) return;

      let seekTo = stockSeekTo.value;
      for (const info of items) {
        stockItems.value.push({
          id: crypto.randomUUID(),
          videoId: info.videoId,
          title: info.title,
          thumbnail: info.thumbnail,
          seekTo,
        });
        seekTo = 0;
      }
      stockUrl.value = "";
      stockSeekTo.value = 0;
    } finally {
      stockLoading.value = false;
    }
  }

  function removeFromStock(id) {
    stockItems.value = stockItems.value.filter((item) => item.id !== id);
  }

  function addStockToQueue(item) {
    socket.emit("add-video", {
      roomId,
      videoId: item.videoId,
      seekTo: item.seekTo ?? 0,
    });
  }

  return {
    stockItems,
    stockUrl,
    stockSeekTo,
    stockLoading,
    addToStock,
    removeFromStock,
    addStockToQueue,
  };
}
