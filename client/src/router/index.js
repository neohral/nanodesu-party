
import { createRouter, createWebHistory } from 'vue-router'
import Party from '../views/Party.vue'
import RoomSelect from '../views/RoomSelect.vue'

const routes = [
  { path: '/', component: RoomSelect },
  { path: '/party/:roomId', component: Party }
]

export default createRouter({
  history: createWebHistory('/murder/'),
  routes
})
