import { createRouter, createWebHistory } from "vue-router";
import Party from "../views/Party.vue";
import Intro from '../views/Intro.vue';
import RoomSelect from "../views/RoomSelect.vue";

const routes = [
  { path: "/", component: RoomSelect },
  { path: '/intro/:roomId', component: Intro },
  {
    path: "/party/:roomId",
    component: Party,
    props: {
      isMurder: false,
    },
  },
  {
    path: "/murder/:roomId",
    component: Party,
    props: {
      isMurder: true,
    },
  },
];

export default createRouter({
  history: createWebHistory("/nanodesu/"),
  routes,
});
