import { ref, nextTick } from "vue";

/**
 * Watch Party 左パネル（Timer / Vote / Dice）用の状態と Socket 連携。
 * `Party.vue` のみで利用し、`registerPartyToolSocketHandlers` を `eventRegister` と同じ socket に対して呼ぶ。
 */
export function usePartyToolPanels(socket, roomId, roomStateRef) {
  const timerMinutes = ref(10);
  const timerSeconds = ref(0);
  const timerName = ref("");
  const diceCount = ref(1);
  const diceType = ref(6);
  const currentAlarmAudio = ref(null);

  function stopAlarm() {
    const a = currentAlarmAudio.value;
    if (a) {
      a.pause();
      a.currentTime = 0;
      currentAlarmAudio.value = null;
    }
  }

  function formatTimerDisplay(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  }

  function createTimer() {
    const minutes = timerMinutes.value || 0;
    const seconds = timerSeconds.value || 0;
    const totalSeconds = minutes * 60 + seconds;
    const name =
      timerName.value ||
      `Timer ${(roomStateRef.value.timers || []).length + 1}`;
    if (totalSeconds <= 0) return;
    socket.emit("create-timer", { roomId, seconds: totalSeconds, name });
    timerMinutes.value = 0;
    timerSeconds.value = 30;
    timerName.value = "";
  }

  function deleteTimer(timerId) {
    stopAlarm();
    roomStateRef.value.timers = (roomStateRef.value.timers || []).filter(
      (t) => t.id !== timerId,
    );
    socket.emit("delete-timer", { roomId, timerId });
  }

  function getTimerRemaining(timer) {
    const elapsed = (Date.now() - timer.startedAt) / 1000;
    return Math.max(0, Math.ceil(timer.seconds - elapsed));
  }

  function createNewPoll() {
    const options = [];
    for (let i = 0; i < roomStateRef.value.members.length; i++) {
      const member = roomStateRef.value.members[i];
      options.push(member ? member.name : `選択肢${i + 1}`);
    }
    socket.emit("create-poll", { roomId, options, allowMultiple: false });
  }

  function startPoll(pollId) {
    const poll = roomStateRef.value.polls.find((p) => p.id === pollId);
    socket.emit("start-poll", {
      roomId,
      pollId,
      allowMultiple: !!poll?.allowMultiple,
    });
  }

  function updatePollOption(pollId, optionIndex, newText) {
    const poll = roomStateRef.value.polls.find((p) => p.id === pollId);
    if (poll?.options[optionIndex]) {
      poll.options[optionIndex].text = newText;
    }
    socket.emit("update-poll-option", {
      roomId,
      pollId,
      optionIndex,
      newText,
    });
  }

  function setPollAllowMultiple(pollId, allowMultiple) {
    const poll = roomStateRef.value.polls.find((p) => p.id === pollId);
    if (poll) {
      poll.allowMultiple = !!allowMultiple;
    }
    socket.emit("update-poll-allow-multiple", {
      roomId,
      pollId,
      allowMultiple,
    });
  }

  function endPoll(pollId) {
    socket.emit("end-poll", { roomId, pollId });
  }

  function deletePoll(pollId) {
    socket.emit("delete-poll", { roomId, pollId });
  }

  function addPollOption(pollId) {
    const poll = roomStateRef.value.polls.find((p) => p.id === pollId);
    if (!poll) return;
    socket.emit("add-poll-option", {
      roomId,
      pollId,
      optionText: `選択肢${poll.options.length + 1}`,
    });
  }

  function removePollOption(pollId, optionIndex) {
    socket.emit("remove-poll-option", { roomId, pollId, optionIndex });
  }

  function votePoll(pollId, optionIndex, allowMultiple) {
    const poll = roomStateRef.value.polls.find((p) => p.id === pollId);
    if (!poll || poll.phase !== "voting") return;

    const emitVote = () => {
      let optionIds = [];
      if (allowMultiple) {
        const checkboxes = document.querySelectorAll(
          `input[name="poll-${pollId}"]:checked`,
        );
        optionIds = Array.from(checkboxes).map((cb) => Number(cb.value));
      } else {
        optionIds = [optionIndex];
      }
      socket.emit("vote-poll", { roomId, pollId, optionIds });
    };

    if (allowMultiple) {
      nextTick(emitVote);
    } else {
      emitVote();
    }
  }

  function getPollVotedCount(poll) {
    const votedUsers = new Set();
    poll.options.forEach((opt) => {
      opt.votes.forEach((vote) => votedUsers.add(vote));
    });
    return votedUsers.size;
  }

  function rollDice() {
    if (diceCount.value <= 0) return;
    socket.emit("roll-dice", {
      roomId,
      diceCounts: diceCount.value,
      diceType: diceType.value,
    });
  }

  function clearDices() {
    roomStateRef.value.dices = [];
    socket.emit("clear-dices", { roomId });
  }

  function registerPartyToolSocketHandlers(socket, roomState) {
    socket.on("timers-updated", ({ timers }) => {
      roomState.value.timers = timers;
    });
    socket.on("timer-completed", () => {
      stopAlarm();
      const audio = new Audio(
        new URL("../aseets/sounds/alarm.mp3", import.meta.url).href,
      );
      currentAlarmAudio.value = audio;
      audio.play().catch((err) => console.log("Audio play error:", err));
    });
    socket.on("polls-updated", ({ polls }) => {
      roomState.value.polls = polls;
    });
    socket.on("poll-vote-count", ({ pollId, counts }) => {
      const poll = roomState.value.polls.find((p) => p.id === pollId);
      if (poll) {
        counts.forEach(({ optionId, count }) => {
          if (poll.options[optionId]) {
            poll.options[optionId].count = count;
          }
        });
      }
    });
    socket.on("dices-updated", ({ dices }) => {
      roomState.value.dices = dices;
    });
  }

  return {
    timerMinutes,
    timerSeconds,
    timerName,
    diceCount,
    diceType,
    createTimer,
    deleteTimer,
    stopAlarm,
    formatTimerDisplay,
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
    rollDice,
    clearDices,
    getTimerRemaining,
    registerPartyToolSocketHandlers,
  };
}
