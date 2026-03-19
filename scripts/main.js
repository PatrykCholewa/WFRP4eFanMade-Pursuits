const MODULE_ID = "wfrp4e-pod-bronia-poscigi";
const BOARD_SCENE_NAME = "Plansza poscigu";
const BOARD_WIDTH = 2200;
const BOARD_HEIGHT = 1400;
const TOKEN_SIZE = 80;
const TRACKER_FLAG = `${MODULE_ID}.tracker`;
const BOARD_POSITIONS = [
  { x: 1100, y: 240 }, { x: 1297, y: 256 }, { x: 1480, y: 302 }, { x: 1634, y: 375 },
  { x: 1748, y: 470 }, { x: 1813, y: 581 }, { x: 1830, y: 700 }, { x: 1813, y: 819 },
  { x: 1748, y: 930 }, { x: 1634, y: 1025 }, { x: 1480, y: 1098 }, { x: 1297, y: 1144 },
  { x: 1100, y: 1160 }, { x: 903, y: 1144 }, { x: 720, y: 1098 }, { x: 566, y: 1025 },
  { x: 452, y: 930 }, { x: 387, y: 819 }, { x: 370, y: 700 }, { x: 387, y: 581 },
  { x: 452, y: 470 }, { x: 566, y: 375 }, { x: 720, y: 302 }, { x: 903, y: 256 }
];

function getTrackerData() {
  return game.settings.get(MODULE_ID, "tracker") || { participants: [] };
}

async function setTrackerData(data) {
  return game.settings.set(MODULE_ID, "tracker", data);
}

function getNearestBoardIndex(x, y) {
  let best = 0;
  let bestDist = Infinity;
  BOARD_POSITIONS.forEach((pos, idx) => {
    const dx = pos.x - (x + TOKEN_SIZE / 2);
    const dy = pos.y - (y + TOKEN_SIZE / 2);
    const d = dx * dx + dy * dy;
    if (d < bestDist) {
      bestDist = d;
      best = idx;
    }
  });
  return best;
}

function coordsForIndex(index) {
  const pos = BOARD_POSITIONS[((index % BOARD_POSITIONS.length) + BOARD_POSITIONS.length) % BOARD_POSITIONS.length];
  return { x: pos.x - TOKEN_SIZE / 2, y: pos.y - TOKEN_SIZE / 2 };
}

async function ensureBoardScene() {
  let scene = game.scenes.getName(BOARD_SCENE_NAME);
  if (scene) return scene;
  const img = `modules/${MODULE_ID}/assets/chase-board.svg`;
  scene = await Scene.create({
    name: BOARD_SCENE_NAME,
    navName: BOARD_SCENE_NAME,
    width: BOARD_WIDTH,
    height: BOARD_HEIGHT,
    padding: 0,
    grid: { type: 0, size: 100, distance: 1, units: "pole" },
    tokenVision: false,
    background: { src: img },
    initial: { x: BOARD_WIDTH / 2, y: BOARD_HEIGHT / 2, scale: 0.8 }
  });
  return scene;
}

async function openBoard() {
  const scene = await ensureBoardScene();
  await scene.view();
}

async function moveTokenToIndex(scene, tokenDoc, index) {
  const { x, y } = coordsForIndex(index);
  await tokenDoc.update({ x, y });
}

async function syncParticipantFromToken(tokenDoc) {
  const tracker = getTrackerData();
  const part = tracker.participants.find(p => p.sceneId === tokenDoc.parent?.id && p.tokenId === tokenDoc.id);
  if (!part) return;
  part.position = getNearestBoardIndex(tokenDoc.x, tokenDoc.y) + 1;
  await setTrackerData(tracker);
  if (ui.wfrpChaseTracker?.rendered) ui.wfrpChaseTracker.render(true);
}

class ChaseTrackerApp extends Application {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "wfrp-chase-tracker",
      classes: ["wfrp-chase-tracker"],
      title: "Tracker poscigu",
      width: 460,
      height: "auto",
      resizable: true,
      popOut: true,
      template: null
    });
  }

  getData() {
    const tracker = getTrackerData();
    return {
      participants: tracker.participants.map(p => ({ ...p }))
    };
  }

  async _renderInner() {
    const data = this.getData();
    const rows = data.participants.map((p, idx) => `
      <div class="participant" data-index="${idx}">
        <div class="participant-name">${foundry.utils.escapeHTML(p.name)}</div>
        <button type="button" class="minus">-</button>
        <div class="participant-pos">Pole ${p.position}</div>
        <button type="button" class="plus">+</button>
        <button type="button" class="remove">Usun</button>
      </div>
    `).join("");
    return $(
      `<div>
        <div class="tracker-actions">
          <button type="button" class="add-selected">Dodaj zaznaczone tokeny</button>
          <button type="button" class="sync">Synchronizuj z tokenami</button>
        </div>
        <div class="participants">${rows || "<p>Brak uczestnikow.</p>"}</div>
        <div class="tracker-footer">
          <button type="button" class="clear">Wyczysc tracker</button>
        </div>
      </div>`
    );
  }

  activateListeners(html) {
    super.activateListeners(html);
    html.find(".add-selected").on("click", () => this.addSelected());
    html.find(".sync").on("click", () => this.syncFromTokens());
    html.find(".clear").on("click", () => this.clearTracker());
    html.find(".participant .plus").on("click", ev => this.shiftParticipant(ev, 1));
    html.find(".participant .minus").on("click", ev => this.shiftParticipant(ev, -1));
    html.find(".participant .remove").on("click", ev => this.removeParticipant(ev));
  }

  async addSelected() {
    const tokens = canvas?.tokens?.controlled ?? [];
    if (!tokens.length) return ui.notifications.warn("Zaznacz tokeny na planszy poscigu.");
    const tracker = getTrackerData();
    for (const token of tokens) {
      if (tracker.participants.some(p => p.sceneId === token.document.parent?.id && p.tokenId === token.id)) continue;
      tracker.participants.push({
        sceneId: token.document.parent?.id,
        tokenId: token.id,
        actorId: token.actor?.id ?? null,
        name: token.name,
        position: getNearestBoardIndex(token.document.x, token.document.y) + 1
      });
    }
    await setTrackerData(tracker);
    this.render(true);
  }

  async syncFromTokens() {
    const tracker = getTrackerData();
    for (const part of tracker.participants) {
      const scene = game.scenes.get(part.sceneId);
      const token = scene?.tokens.get(part.tokenId);
      if (!token) continue;
      part.position = getNearestBoardIndex(token.x, token.y) + 1;
    }
    await setTrackerData(tracker);
    this.render(true);
  }

  async clearTracker() {
    await setTrackerData({ participants: [] });
    this.render(true);
  }

  async shiftParticipant(ev, delta) {
    const index = Number(ev.currentTarget.closest(".participant")?.dataset?.index);
    const tracker = getTrackerData();
    const part = tracker.participants[index];
    if (!part) return;
    const max = BOARD_POSITIONS.length;
    part.position = ((part.position - 1 + delta) % max + max) % max + 1;
    await setTrackerData(tracker);
    const scene = game.scenes.get(part.sceneId);
    const tokenDoc = scene?.tokens.get(part.tokenId);
    if (tokenDoc) await moveTokenToIndex(scene, tokenDoc, part.position - 1);
    this.render(true);
  }

  async removeParticipant(ev) {
    const index = Number(ev.currentTarget.closest(".participant")?.dataset?.index);
    const tracker = getTrackerData();
    tracker.participants.splice(index, 1);
    await setTrackerData(tracker);
    this.render(true);
  }
}

async function openTracker() {
  if (!ui.wfrpChaseTracker) ui.wfrpChaseTracker = new ChaseTrackerApp();
  ui.wfrpChaseTracker.render(true);
}

Hooks.once("init", async () => {
  game.wfrpChase = { openBoard, openTracker, ensureBoardScene };
  await game.settings.register(MODULE_ID, "tracker", {
    name: "Tracker poscigu",
    scope: "world",
    config: false,
    type: Object,
    default: { participants: [] }
  });
});

function addSceneControlTool(tokenControls, tool) {
  if (!tokenControls) return;
  const tools = tokenControls.tools;

  if (Array.isArray(tools)) {
    const exists = tools.some(t => t?.name === tool.name);
    if (!exists) tools.push(tool);
    return;
  }

  if (tools && typeof tools === "object") {
    tools[tool.name] = tool;
    return;
  }

  tokenControls.tools = [tool];
}

Hooks.on("getSceneControlButtons", (controls) => {
  const tokenControls = Array.isArray(controls)
    ? controls.find(c => c?.name === "token")
    : controls?.tokens ?? Object.values(controls ?? {}).find(c => c?.name === "token");

  if (!tokenControls) return;

  addSceneControlTool(tokenControls, {
    name: "wfrp-chase-board",
    title: "Plansza poscigu",
    icon: "fas fa-flag-checkered",
    button: true,
    onClick: () => game.wfrpChase.openBoard()
  });

  addSceneControlTool(tokenControls, {
    name: "wfrp-chase-tracker",
    title: "Tracker poscigu",
    icon: "fas fa-route",
    button: true,
    onClick: () => game.wfrpChase.openTracker()
  });
});

Hooks.on("updateToken", async (tokenDoc, change, _options, userId) => {
  if (userId !== game.user.id) return;
  if ((change.x === undefined) && (change.y === undefined)) return;
  if (tokenDoc.parent?.name !== BOARD_SCENE_NAME) return;
  await syncParticipantFromToken(tokenDoc);
});

Hooks.once("ready", async () => {
  if (game.user.isGM) {
    console.log(`${MODULE_ID} | gotowy`);
  }
});
