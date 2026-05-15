const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const axisLimits = [
  [-180, 180],
  [-120, 120],
  [-160, 160],
  [-180, 180],
  [-120, 120],
  [-360, 360],
];

const namedPoses = {
  home: [0, -28, 62, 0, 36, 0],
  ready: [18, -42, 76, -18, 28, 0],
  offer: [38, -34, 92, 24, -18, 28],
  retract: [-24, -18, 48, -36, 48, -60],
  high: [12, -66, 108, 32, -48, 90],
};

const state = {
  joints: [...namedPoses.home],
  target: [...namedPoses.home],
  speed: 90,
  gripper: 'closed',
  lastCommand: 'home',
  mode: 'idle',
  log: [],
};

const clients = new Set();

function pushLog(type, text) {
  state.log.unshift({
    type,
    text,
    time: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
  });
  state.log = state.log.slice(0, 24);
}

function snapshot() {
  return {
    ...state,
    joints: [...state.joints],
    target: [...state.target],
    log: [...state.log],
    limits: axisLimits,
  };
}

function broadcast() {
  const payload = `data: ${JSON.stringify(snapshot())}\n\n`;
  for (const res of clients) res.write(payload);
}

function setPose(values, mode, command) {
  state.target = values.map((value, index) => clamp(value, axisLimits[index][0], axisLimits[index][1]));
  state.joints = [...state.target];
  state.mode = mode;
  state.lastCommand = command;
}

function parseCommand(rawCommand) {
  const command = rawCommand.trim();
  if (!command) return { ok: false, error: '请输入指令。' };
  const normalized = command.toLowerCase();
  const chineseAliases = {
    回零: 'home',
    复位: 'home',
    准备: 'ready',
    递给我: 'serve',
    递出: 'serve',
    递过去: 'serve',
    躲开: 'tease',
    调戏: 'tease',
    打开: 'open',
    松开: 'open',
    闭合: 'close',
    抓住: 'close',
  };

  if (chineseAliases[normalized]) {
    return parseCommand(chineseAliases[normalized]);
  }

  if (namedPoses[normalized]) {
    setPose(namedPoses[normalized], `pose:${normalized}`, command);
    return { ok: true, message: `切换到 ${normalized} 姿态。` };
  }

  if (normalized === 'open' || normalized === 'close') {
    state.gripper = normalized === 'open' ? 'open' : 'closed';
    state.mode = `gripper:${state.gripper}`;
    state.lastCommand = command;
    return { ok: true, message: `夹爪已${state.gripper === 'open' ? '打开' : '闭合'}。` };
  }

  if (normalized === 'tease') {
    setPose([42, -48, 104, -48, -28, 130], 'macro:tease', command);
    return { ok: true, message: '执行调戏式侧躲动作。' };
  }

  if (normalized === 'serve') {
    setPose([26, -36, 88, 8, -12, 18], 'macro:serve', command);
    return { ok: true, message: '执行递出动作。' };
  }

  const speedMatch = normalized.match(/^speed\s+(-?\d+(?:\.\d+)?)$/);
  if (speedMatch) {
    state.speed = clamp(Number(speedMatch[1]), 5, 240);
    state.lastCommand = command;
    state.mode = 'speed';
    return { ok: true, message: `速度设为 ${state.speed} deg/s。` };
  }

  const target = [...state.target];
  const axisPattern = /(?:j|axis)\s*([1-6])\s*(?:=|:|\s)\s*(-?\d+(?:\.\d+)?)/gi;
  let match;
  let changed = 0;
  while ((match = axisPattern.exec(command)) !== null) {
    const index = Number(match[1]) - 1;
    target[index] = clamp(Number(match[2]), axisLimits[index][0], axisLimits[index][1]);
    changed += 1;
  }

  if (changed > 0) {
    setPose(target, `manual:${changed}`, command);
    return { ok: true, message: `已更新 ${changed} 个轴。` };
  }

  const sixNumbers = normalized
    .replace(/^move\s+/, '')
    .split(/[,\s]+/)
    .filter(Boolean)
    .map(Number);
  if (sixNumbers.length === 6 && sixNumbers.every(Number.isFinite)) {
    setPose(sixNumbers, 'manual:6', command);
    return { ok: true, message: '已按 J1-J6 设置完整姿态。' };
  }

  return {
    ok: false,
    error: '无法解析。例：J1 30 J2 -45、move 0 -30 60 0 45 0、home、ready、serve、tease、open。',
  };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1e6) reject(new Error('request body too large'));
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

export default {
  server: {
    host: '127.0.0.1',
  },
  plugins: [
    {
      name: 'gofa-command-api',
      configureServer(server) {
        pushLog('system', 'GoFa command API ready.');

        server.middlewares.use('/api/events', (req, res) => {
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
          });
          clients.add(res);
          res.write(`data: ${JSON.stringify(snapshot())}\n\n`);
          req.on('close', () => clients.delete(res));
        });

        server.middlewares.use('/api/state', (_req, res) => {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(snapshot()));
        });

        server.middlewares.use('/api/command', async (req, res) => {
          if (req.method !== 'POST') {
            res.statusCode = 405;
            res.end('Method Not Allowed');
            return;
          }

          try {
            const body = JSON.parse(await readBody(req) || '{}');
            const command = String(body.command || '');
            const result = parseCommand(command);
            pushLog(result.ok ? 'ok' : 'error', result.ok ? `${command} -> ${result.message}` : `${command} -> ${result.error}`);
            broadcast();
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = result.ok ? 200 : 400;
            res.end(JSON.stringify({ ...result, state: snapshot() }));
          } catch (error) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: false, error: error.message }));
          }
        });
      },
    },
  ],
};
