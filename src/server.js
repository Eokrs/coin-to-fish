const http = require('http');
const fs = require('fs');
const path = require('path');
const {
  registerOrLogin,
  getDashboard,
  placeFishInAquarium,
  collect,
  feedFish,
  upgradeFish,
  upgradeAquarium,
  getUserByLogin,
} = require('./game');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('JSON inválido'));
      }
    });
  });
}

function serveStatic(req, res) {
  const reqPath = req.url === '/' ? '/index.html' : req.url;
  const safePath = path.normalize(reqPath).replace(/^\.+/, '');
  const fullPath = path.join(PUBLIC_DIR, safePath);

  if (!fullPath.startsWith(PUBLIC_DIR) || !fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) {
    res.writeHead(404);
    res.end('Not Found');
    return;
  }

  const ext = path.extname(fullPath);
  const type = ext === '.css' ? 'text/css' : ext === '.js' ? 'application/javascript' : 'text/html';
  res.writeHead(200, { 'Content-Type': `${type}; charset=utf-8` });
  res.end(fs.readFileSync(fullPath));
}

async function handleApi(req, res) {
  try {
    if (req.method === 'POST' && req.url === '/api/auth') {
      const body = await parseBody(req);
      return sendJson(res, 200, { ok: true, data: registerOrLogin(body) });
    }

    if (req.method === 'GET' && req.url.startsWith('/api/dashboard/')) {
      const login = decodeURIComponent(req.url.replace('/api/dashboard/', ''));
      const user = getUserByLogin(login);
      if (!user) throw new Error('Usuário não encontrado');
      return sendJson(res, 200, { ok: true, data: getDashboard(user.id) });
    }

    if (req.method === 'POST' && req.url === '/api/place-fish') {
      const { login, fishId, aquariumId } = await parseBody(req);
      const user = getUserByLogin(login);
      if (!user) throw new Error('Usuário não encontrado');
      placeFishInAquarium({ userId: user.id, fishId, aquariumId });
      return sendJson(res, 200, { ok: true, data: getDashboard(user.id) });
    }

    if (req.method === 'POST' && req.url === '/api/collect') {
      const { login } = await parseBody(req);
      const user = getUserByLogin(login);
      if (!user) throw new Error('Usuário não encontrado');
      return sendJson(res, 200, { ok: true, data: collect(user.id) });
    }

    if (req.method === 'POST' && req.url === '/api/feed') {
      const { login, fishId } = await parseBody(req);
      const user = getUserByLogin(login);
      if (!user) throw new Error('Usuário não encontrado');
      feedFish({ userId: user.id, fishId });
      return sendJson(res, 200, { ok: true, data: getDashboard(user.id) });
    }

    if (req.method === 'POST' && req.url === '/api/upgrade-fish') {
      const { login, fishId } = await parseBody(req);
      const user = getUserByLogin(login);
      if (!user) throw new Error('Usuário não encontrado');
      upgradeFish({ userId: user.id, fishId });
      return sendJson(res, 200, { ok: true, data: getDashboard(user.id) });
    }

    if (req.method === 'POST' && req.url === '/api/upgrade-aquarium') {
      const { login, aquariumId } = await parseBody(req);
      const user = getUserByLogin(login);
      if (!user) throw new Error('Usuário não encontrado');
      upgradeAquarium({ userId: user.id, aquariumId });
      return sendJson(res, 200, { ok: true, data: getDashboard(user.id) });
    }

    sendJson(res, 404, { ok: false, error: 'Rota não encontrada' });
  } catch (error) {
    sendJson(res, 400, { ok: false, error: error.message });
  }
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/api/')) {
    handleApi(req, res);
    return;
  }
  serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`Coin to Fish MVP rodando em http://localhost:${PORT}`);
});
