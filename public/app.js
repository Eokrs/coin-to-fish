const state = { login: null, dashboard: null };

const $ = (id) => document.getElementById(id);

function setStatus(message, isError = false) {
  const el = $('status');
  el.textContent = message;
  el.style.color = isError ? '#b91c1c' : '#166534';
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const body = await response.json();
  if (!body.ok) throw new Error(body.error);
  return body.data;
}

async function loadDashboard() {
  const data = await api(`/api/dashboard/${encodeURIComponent(state.login)}`);
  state.dashboard = data;
  render();
}

function render() {
  const data = state.dashboard;
  if (!data) return;

  $('game-area').classList.remove('hidden');
  $('player-info').textContent = `Jogador: ${data.user.username} (${data.user.email})`;
  $('resources').textContent = `Moedas: ${Math.floor(data.state.coins)} | Comida Simples: ${data.state.fish_food}`;

  $('aquariums').innerHTML = data.aquariums
    .map((aq) => `
      <div class="aq">
        <strong>${aq.type.toUpperCase()}</strong><br />
        Slots: ${aq.slots} | Bônus: ${aq.production_bonus}x<br />
        <button onclick="upgradeAquarium('${aq.id}')">Upgrade Aquário</button>
      </div>`)
    .join('');

  $('fish-list').innerHTML = data.fish
    .map((fish) => `
      <div class="fish">
        <strong>${fish.name}</strong> (${fish.rarity})<br />
        Nível ${fish.level} | Produção base ${fish.production_base}/min<br />
        Energia: ${Math.floor(fish.energy_current)}/${fish.energy_max}<br />
        Em aquário: ${fish.aquarium_id ? 'Sim' : 'Não'}<br />
        ${!fish.aquarium_id ? `<button onclick="placeFish('${fish.id}')">Colocar no aquário</button>` : ''}
        <button onclick="feedFish('${fish.id}')">Usar Comida Simples</button>
        <button onclick="upgradeFish('${fish.id}')">Upgrade Peixe</button>
      </div>`)
    .join('');

  const missions = [
    ['Colocar 1 peixe no aquário', data.missions.placeFish],
    ['Coletar produção pela primeira vez', data.missions.collectProduction],
    ['Upar um peixe para nível 2', data.missions.upgradeFishTo2],
  ];

  $('missions').innerHTML = missions.map(([name, done]) => `<li>${done ? '✅' : '⬜'} ${name}</li>`).join('');
}

$('auth-btn').addEventListener('click', async () => {
  const username = $('username').value.trim();
  const email = $('email').value.trim();
  try {
    const user = await api('/api/auth', {
      method: 'POST',
      body: JSON.stringify({ username, email }),
    });
    state.login = user.username;
    await loadDashboard();
    setStatus('Login realizado!');
  } catch (error) {
    setStatus(error.message, true);
  }
});

$('collect-btn').addEventListener('click', async () => {
  try {
    await api('/api/collect', { method: 'POST', body: JSON.stringify({ login: state.login }) });
    await loadDashboard();
    setStatus('Produção coletada!');
  } catch (error) {
    setStatus(error.message, true);
  }
});

window.placeFish = async (fishId) => {
  try {
    const firstAquarium = state.dashboard.aquariums[0];
    await api('/api/place-fish', {
      method: 'POST',
      body: JSON.stringify({ login: state.login, fishId, aquariumId: firstAquarium.id }),
    });
    await loadDashboard();
    setStatus('Peixe colocado no aquário!');
  } catch (error) {
    setStatus(error.message, true);
  }
};

window.feedFish = async (fishId) => {
  try {
    await api('/api/feed', { method: 'POST', body: JSON.stringify({ login: state.login, fishId }) });
    await loadDashboard();
    setStatus('Energia recuperada!');
  } catch (error) {
    setStatus(error.message, true);
  }
};

window.upgradeFish = async (fishId) => {
  try {
    await api('/api/upgrade-fish', {
      method: 'POST',
      body: JSON.stringify({ login: state.login, fishId }),
    });
    await loadDashboard();
    setStatus('Peixe upado!');
  } catch (error) {
    setStatus(error.message, true);
  }
};

window.upgradeAquarium = async (aquariumId) => {
  try {
    await api('/api/upgrade-aquarium', {
      method: 'POST',
      body: JSON.stringify({ login: state.login, aquariumId }),
    });
    await loadDashboard();
    setStatus('Aquário melhorado!');
  } catch (error) {
    setStatus(error.message, true);
  }
};
