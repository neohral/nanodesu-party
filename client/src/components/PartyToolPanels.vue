<template>
  <div class="tool-panels">
    <PartyTimerPanel />
    <PartyVotePanel />
    <PartyDicePanel />
  </div>
</template>

<script setup>
import "@/styles/party-tool-panels.css";
import PartyDicePanel from "./PartyDicePanel.vue";
import PartyTimerPanel from "./PartyTimerPanel.vue";
import PartyVotePanel from "./PartyVotePanel.vue";
</script>
