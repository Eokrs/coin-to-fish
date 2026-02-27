const test = require('node:test');
const assert = require('node:assert/strict');
const {
  registerOrLogin,
  getDashboard,
  placeFishInAquarium,
  collect,
} = require('../src/game');

function uniqueUser() {
  const id = Date.now() + Math.floor(Math.random() * 10000);
  return { username: `user_${id}`, email: `user_${id}@mail.com` };
}

test('cria usuário novo com peixe e aquário inicial', () => {
  const userData = uniqueUser();
  const user = registerOrLogin(userData);
  const dashboard = getDashboard(user.id);

  assert.equal(dashboard.user.username, userData.username);
  assert.equal(dashboard.fish.length, 1);
  assert.equal(dashboard.aquariums.length, 1);
  assert.equal(dashboard.state.fish_food, 2);
});

test('consegue colocar peixe no aquário e coletar sem erro', () => {
  const userData = uniqueUser();
  const user = registerOrLogin(userData);
  const dashboard = getDashboard(user.id);

  placeFishInAquarium({
    userId: user.id,
    fishId: dashboard.fish[0].id,
    aquariumId: dashboard.aquariums[0].id,
  });

  const coins = collect(user.id);
  assert.ok(typeof coins.coins === 'number');
});
