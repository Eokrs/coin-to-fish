const crypto = require('crypto');
const { load, save } = require('./db');

const MINUTE_MS = 60_000;
const ENERGY_COST_PER_MINUTE = 2;

function nowIso() {
  return new Date().toISOString();
}

function persist(mutator) {
  const data = load();
  const result = mutator(data);
  save(data);
  return result;
}

function createStarterData(data, userId) {
  const aquariumId = crypto.randomUUID();
  const fishId = crypto.randomUUID();

  data.aquariums.push({
    id: aquariumId,
    user_id: userId,
    type: 'basico',
    slots: 1,
    production_bonus: 1,
  });

  data.fish.push({
    id: fishId,
    user_id: userId,
    name: 'Peixe Douradinho',
    rarity: 'comum',
    level: 1,
    production_base: 10,
    energy_max: 100,
    energy_current: 100,
    resting_until: null,
    aquarium_id: null,
  });

  data.playerState.push({
    user_id: userId,
    coins: 0,
    fish_food: 2,
    last_idle_calc_at: nowIso(),
    mission_place_fish_done: false,
    mission_collect_done: false,
    mission_upgrade_fish_done: false,
  });
}

function getUserByLogin(login) {
  const data = load();
  return data.users.find((u) => u.username === login || u.email === login) || null;
}

function registerOrLogin({ username, email }) {
  if (!username || !email) throw new Error('username e email são obrigatórios');

  return persist((data) => {
    let user = data.users.find((u) => u.username === username || u.email === email);
    if (!user) {
      user = {
        id: data.seq.userId++,
        username,
        email,
        created_at: nowIso(),
      };
      data.users.push(user);
      createStarterData(data, user.id);
    }
    return user;
  });
}

function calculateOfflineProduction(data, userId) {
  const player = data.playerState.find((p) => p.user_id === userId);
  if (!player) return;

  const lastCalc = player.last_idle_calc_at ? new Date(player.last_idle_calc_at).getTime() : Date.now();
  const now = Date.now();
  const elapsedMinutes = Math.floor((now - lastCalc) / MINUTE_MS);
  if (elapsedMinutes <= 0) return;

  const fishes = data.fish.filter((f) => f.user_id === userId && f.aquarium_id);
  let totalCoinsProduced = 0;

  for (const fish of fishes) {
    const aq = data.aquariums.find((a) => a.id === fish.aquarium_id && a.user_id === userId);
    if (!aq) continue;

    const possibleActiveMinutes = Math.floor(fish.energy_current / ENERGY_COST_PER_MINUTE);
    const activeMinutes = Math.min(elapsedMinutes, possibleActiveMinutes);
    if (activeMinutes > 0) totalCoinsProduced += activeMinutes * fish.production_base * aq.production_bonus;

    fish.energy_current = Math.max(0, fish.energy_current - elapsedMinutes * ENERGY_COST_PER_MINUTE);
  }

  player.coins += totalCoinsProduced;
  player.last_idle_calc_at = nowIso();
}

function getDashboard(userId) {
  return persist((data) => {
    calculateOfflineProduction(data, userId);
    const user = data.users.find((u) => u.id === userId);
    const fish = data.fish.filter((f) => f.user_id === userId);
    const aquariums = data.aquariums.filter((a) => a.user_id === userId);
    const state = data.playerState.find((p) => p.user_id === userId);

    if (!user || !state) throw new Error('Usuário não encontrado');

    return {
      user,
      fish,
      aquariums,
      state,
      missions: {
        placeFish: Boolean(state.mission_place_fish_done),
        collectProduction: Boolean(state.mission_collect_done),
        upgradeFishTo2: Boolean(state.mission_upgrade_fish_done),
      },
    };
  });
}

function placeFishInAquarium({ userId, fishId, aquariumId }) {
  persist((data) => {
    const fish = data.fish.find((f) => f.id === fishId && f.user_id === userId);
    const aquarium = data.aquariums.find((a) => a.id === aquariumId && a.user_id === userId);
    if (!fish || !aquarium) throw new Error('Peixe ou aquário inválido');

    const occupied = data.fish.filter((f) => f.user_id === userId && f.aquarium_id === aquariumId).length;
    if (occupied >= aquarium.slots) throw new Error('Aquário sem slots disponíveis');

    fish.aquarium_id = aquariumId;
    const state = data.playerState.find((p) => p.user_id === userId);
    state.mission_place_fish_done = true;
  });
}

function collect(userId) {
  return persist((data) => {
    calculateOfflineProduction(data, userId);
    const state = data.playerState.find((p) => p.user_id === userId);
    state.mission_collect_done = true;
    return { coins: state.coins };
  });
}

function feedFish({ userId, fishId }) {
  persist((data) => {
    const fish = data.fish.find((f) => f.id === fishId && f.user_id === userId);
    const state = data.playerState.find((p) => p.user_id === userId);
    if (!fish || !state) throw new Error('Dados inválidos');
    if (state.fish_food <= 0) throw new Error('Sem comida disponível');

    fish.energy_current = Math.min(fish.energy_max, fish.energy_current + fish.energy_max * 0.5);
    state.fish_food -= 1;
  });
}

function upgradeFish({ userId, fishId }) {
  persist((data) => {
    const fish = data.fish.find((f) => f.id === fishId && f.user_id === userId);
    const state = data.playerState.find((p) => p.user_id === userId);
    if (!fish || !state) throw new Error('Dados inválidos');

    const cost = fish.level * 100;
    if (state.coins < cost) throw new Error('Moedas insuficientes');

    fish.level += 1;
    fish.production_base = Number((fish.production_base * 1.2).toFixed(2));
    state.coins -= cost;
    if (fish.level >= 2) state.mission_upgrade_fish_done = true;
  });
}

function upgradeAquarium({ userId, aquariumId }) {
  persist((data) => {
    const aquarium = data.aquariums.find((a) => a.id === aquariumId && a.user_id === userId);
    const state = data.playerState.find((p) => p.user_id === userId);
    if (!aquarium || !state) throw new Error('Dados inválidos');

    const cost = aquarium.slots * 250;
    if (state.coins < cost) throw new Error('Moedas insuficientes');

    aquarium.slots += 1;
    aquarium.type = 'melhorado';
    state.coins -= cost;
  });
}

module.exports = {
  registerOrLogin,
  getDashboard,
  placeFishInAquarium,
  collect,
  feedFish,
  upgradeFish,
  upgradeAquarium,
  getUserByLogin,
};
