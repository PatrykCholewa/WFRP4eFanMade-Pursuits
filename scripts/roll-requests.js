const ROLL_REQUEST_FLAG = "rollRequest";
const CHASE_DIFFICULTIES = [
  { key: "veryEasy", label: "Bardzo latwy (+60)", modifier: 60 },
  { key: "easy", label: "Latwy (+40)", modifier: 40 },
  { key: "average", label: "Przecietny (+20)", modifier: 20 },
  { key: "challenging", label: "Wymagajacy (+0)", modifier: 0 },
  { key: "difficult", label: "Trudny (-10)", modifier: -10 },
  { key: "hard", label: "Bardzo trudny (-20)", modifier: -20 },
  { key: "veryHard", label: "Arcytrudny (-30)", modifier: -30 }
];

function escapeAttr(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function getParticipantOwners(actor, { activeOnly = false, includeGM = false } = {}) {
  return game.users.filter(user => {
    if (!actor) return false;
    if (!includeGM && user.isGM) return false;
    if (activeOnly && !user.active) return false;
    return actor.testUserPermission?.(user, "OWNER");
  });
}

function getActivePlayerActorEntries() {
  const entries = new Map();
  const activeUsers = game.users.filter(user => user.active && !user.isGM && user.character);

  for (const user of activeUsers) {
    const actor = user.character;
    if (!actor) continue;

    if (!entries.has(actor.id)) {
      entries.set(actor.id, {
        actorId: actor.id,
        sceneId: null,
        tokenId: null,
        name: actor.name,
        activeOwners: [user.name]
      });
      continue;
    }

    entries.get(actor.id).activeOwners.push(user.name);
  }

  return [...entries.values()];
}

function getSelectableParticipants(getTrackerData, getParticipantActor) {
  const tracker = getTrackerData();
  const trackerParticipants = tracker?.participants ?? [];
  const byActorId = new Map();
  const participants = [];

  for (const participant of trackerParticipants) {
    const actor = getParticipantActor(participant);
    if (!actor?.id || byActorId.has(actor.id)) continue;

    const activeOwners = getParticipantOwners(actor, { activeOnly: true }).map(user => user.name);
    const enriched = {
      ...participant,
      actorId: actor.id,
      name: participant.name || actor.name,
      activeOwners
    };

    byActorId.set(actor.id, enriched);
    participants.push(enriched);
  }

  for (const actorEntry of getActivePlayerActorEntries()) {
    if (byActorId.has(actorEntry.actorId)) {
      const existing = byActorId.get(actorEntry.actorId);
      existing.activeOwners = [...new Set([...(existing.activeOwners ?? []), ...actorEntry.activeOwners])];
      continue;
    }

    byActorId.set(actorEntry.actorId, actorEntry);
    participants.push(actorEntry);
  }

  return participants.map(participant => ({
    ...participant,
    activeOwnersLabel: participant.activeOwners?.length
      ? `Aktywni gracze: ${participant.activeOwners.join(", ")}`
      : "Brak aktywnych graczy"
  }));
}

function getDefaultSelectedParticipants(participants, getParticipantActor) {
  const selected = participants.map(participant => {
    const actor = getParticipantActor(participant);
    return getParticipantOwners(actor, { activeOnly: true }).length > 0;
  });

  return selected.some(Boolean) ? selected : participants.map(() => true);
}

function getParticipantSkillNames(participant, getParticipantActor) {
  const actor = getParticipantActor(participant);
  return (actor?.items ?? [])
    .filter(item => item?.type === "skill" && item?.name)
    .map(item => item.name)
    .sort((a, b) => a.localeCompare(b, "pl"));
}

function getSkillSuggestions(participants, getParticipantActor) {
  return [...new Set(participants.flatMap(participant => getParticipantSkillNames(participant, getParticipantActor)))];
}

function getActorSkill(actor, skillName) {
  if (!actor || !skillName) return null;
  const normalized = skillName.trim().toLocaleLowerCase("pl");
  const skills = (actor.items ?? []).filter(item => item?.type === "skill");
  return skills.find(item => item.name?.trim().toLocaleLowerCase("pl") === normalized)
    ?? skills.find(item => item.name?.trim().toLocaleLowerCase("pl").includes(normalized))
    ?? null;
}

function getRequestRecipients(actor) {
  const owners = getParticipantOwners(actor, { includeGM: false });
  if (owners.length) return owners.map(user => user.id);
  return game.users.filter(user => user.isGM).map(user => user.id);
}

function getFormFromDialogCallbackHtml(html) {
  if (!html) return null;
  if (html instanceof HTMLFormElement) return html;
  if (html instanceof HTMLElement) return html.querySelector("form");
  if (html[0] instanceof HTMLFormElement) return html[0];
  if (html[0] instanceof HTMLElement) return html[0].querySelector("form");
  return null;
}

function renderRollRequestContent(request) {
  const ownerNames = request.ownerNames?.length ? request.ownerNames.join(", ") : "GM";
  const rolledBy = request.rolledByName ? ` (${foundry.utils.escapeHTML(request.rolledByName)})` : "";
  const status = request.status === "rolled" ? `Rzut wykonany${rolledBy}` : "Oczekuje na rzut";

  return `
    <div class="wfrp-chase-roll-request" data-request-id="${escapeAttr(request.requestId)}">
      <h3>Prosba o test</h3>
      <div><strong>Uczestnik:</strong> ${foundry.utils.escapeHTML(request.participantName)}</div>
      <div><strong>Umiejetnosc:</strong> ${foundry.utils.escapeHTML(request.skillName)}</div>
      <div><strong>Trudnosc:</strong> ${foundry.utils.escapeHTML(request.difficultyLabel)}</div>
      <div><strong>Odbiorcy:</strong> ${foundry.utils.escapeHTML(ownerNames)}</div>
      <div><strong>Status:</strong> ${status}</div>
      <div class="roll-request-actions">
        <button type="button" data-action="prompt-roll">Rzuc test</button>
      </div>
    </div>
  `;
}

async function updateRollRequestMessage(moduleId, message, request) {
  if (!game.user?.isGM) return;
  await message.update({
    content: renderRollRequestContent(request),
    [`flags.${moduleId}.${ROLL_REQUEST_FLAG}`]: request
  });
}

async function finalizeRollAttempt(result) {
  if (result === undefined || result === null) return false;
  if (typeof result?.roll === "function") {
    await result.roll();
    return true;
  }
  if (typeof result?.start === "function") {
    await result.start();
    return true;
  }
  if (typeof result?.execute === "function") {
    await result.execute();
    return true;
  }
  return true;
}

async function runActorSkillTest(moduleId, actor, skill, request) {
  const options = {
    bypass: false,
    fields: {
      difficulty: request.difficultyKey
    },
    testData: {
      title: `Test: ${request.skillName}`,
      difficulty: request.difficultyKey,
      difficultyLabel: request.difficultyLabel,
      modifier: request.difficultyModifier
    }
  };

  const attempts = [
    async () => actor.setupSkill?.(skill?.name ?? request.skillName, options),
    async () => actor.setupSkill?.(skill, options),
    async () => actor.basicTest?.({
      type: "skill",
      item: skill,
      title: `Test: ${request.skillName}`,
      difficulty: request.difficultyKey
    }),
    async () => skill?.roll?.()
  ];

  for (const attempt of attempts) {
    try {
      const result = await attempt();
      if (await finalizeRollAttempt(result)) return true;
    } catch (error) {
      console.warn(`${moduleId} | nieudana proba uruchomienia testu`, error);
    }
  }

  return false;
}

async function openPlayerRollDialog(moduleId, message) {
  const request = foundry.utils.deepClone(message.getFlag(moduleId, ROLL_REQUEST_FLAG));
  if (!request) return;

  const actor = game.actors?.get(request.actorId);
  if (!actor) {
    ui.notifications.error("Nie znaleziono aktora dla tej prosby o rzut.");
    return;
  }

  const canRoll = game.user?.isGM || actor.testUserPermission?.(game.user, "OWNER");
  if (!canRoll) {
    ui.notifications.warn("Nie masz uprawnien do wykonania tego testu.");
    return;
  }

  const skill = getActorSkill(actor, request.skillName);
  if (!skill) {
    ui.notifications.error(`Aktor ${request.participantName} nie ma umiejetnosci ${request.skillName}.`);
    return;
  }

  const success = await runActorSkillTest(moduleId, actor, skill, request);
  if (!success) {
    ui.notifications.error("Nie udalo sie uruchomic testu systemowego. Potrzebna moze byc precyzyjniejsza integracja z WFRP4e lub WarhammerLibrary.");
    return;
  }

  if (game.user?.isGM) {
    request.status = "rolled";
    request.rolledBy = game.user.id;
    request.rolledByName = game.user.name;
    await updateRollRequestMessage(moduleId, message, request);
  }
}

async function sendRollRequests(moduleId, getParticipantActor, formData, participants) {
  const skillName = formData.get("skillName")?.toString().trim();
  const difficultyKey = formData.get("difficulty")?.toString();
  const difficulty = CHASE_DIFFICULTIES.find(entry => entry.key === difficultyKey) ?? CHASE_DIFFICULTIES[3];
  const selectedParticipants = participants.filter((_, index) => formData.get(`participant-${index}`));

  if (!skillName) {
    ui.notifications.warn("Wybierz albo wpisz umiejetnosc dla testu.");
    return false;
  }

  if (!selectedParticipants.length) {
    ui.notifications.warn("Wybierz przynajmniej jednego bohatera.");
    return false;
  }

  let createdCount = 0;

  for (const participant of selectedParticipants) {
    const actor = getParticipantActor(participant);
    if (!actor) continue;

    const recipients = getRequestRecipients(actor);
    const request = {
      requestId: foundry.utils.randomID(),
      actorId: actor.id,
      tokenId: participant.tokenId,
      sceneId: participant.sceneId,
      participantName: participant.name,
      skillName,
      difficultyKey: difficulty.key,
      difficultyLabel: difficulty.label,
      difficultyModifier: difficulty.modifier,
      ownerNames: recipients.map(userId => game.users.get(userId)?.name).filter(Boolean),
      status: "pending"
    };

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      whisper: recipients,
      content: renderRollRequestContent(request),
      flags: {
        [moduleId]: {
          [ROLL_REQUEST_FLAG]: request
        }
      }
    });
    createdCount += 1;
  }

  if (!createdCount) {
    ui.notifications.warn("Nie udalo sie znalezc zadnego aktora dla wybranych bohaterow.");
    return false;
  }

  ui.notifications.info("Wyslano prosby o testy.");
  return true;
}

export function initializeRollRequestSupport({ moduleId, getTrackerData, getParticipantActor }) {
  function openRollRequestDialog() {
    const participants = getSelectableParticipants(getTrackerData, getParticipantActor);
    if (!participants.length) {
      ui.notifications.warn("Brak aktywnych bohaterow graczy ani uczestnikow poscigu do wybrania.");
      return;
    }

    const selectedByDefault = getDefaultSelectedParticipants(participants, getParticipantActor);
    const skillSuggestions = getSkillSuggestions(participants, getParticipantActor);
    const skillOptions = skillSuggestions.map(skill => `<option value="${escapeAttr(skill)}"></option>`).join("");
    const participantOptions = participants.map((participant, index) => `
      <label class="participant-toggle">
        <input type="checkbox" name="participant-${index}" ${selectedByDefault[index] ? "checked" : ""}>
        <span>
          <strong>${foundry.utils.escapeHTML(participant.name)}</strong>
          <small>${foundry.utils.escapeHTML(participant.activeOwnersLabel)}</small>
        </span>
      </label>
    `).join("");
    const difficultyOptions = CHASE_DIFFICULTIES.map((difficulty, index) => `
      <option value="${difficulty.key}" ${index === 3 ? "selected" : ""}>${foundry.utils.escapeHTML(difficulty.label)}</option>
    `).join("");

    const content = `
      <form class="wfrp-chase-roll-request-form">
        <div class="form-group">
          <label for="chase-skill-name">Umiejetnosc</label>
          <input id="chase-skill-name" name="skillName" type="text" list="wfrp-chase-skills" placeholder="np. Jezdziectwo lub Atletyka">
          <datalist id="wfrp-chase-skills">${skillOptions}</datalist>
        </div>
        <div class="form-group">
          <label for="chase-difficulty">Trudnosc</label>
          <select id="chase-difficulty" name="difficulty">${difficultyOptions}</select>
        </div>
        <div class="form-group">
          <label>Aktorzy</label>
          <div class="participant-selection">${participantOptions}</div>
          <p class="notes">Domyslnie zaznaczeni sa bohaterowie aktywnych graczy.</p>
        </div>
      </form>
    `;

    new Dialog({
      title: "Popros o testy",
      content,
      buttons: {
        send: {
          label: "Wyslij prosby",
          callback: async (html) => {
            try {
              const form = getFormFromDialogCallbackHtml(html);
              if (!form) {
                ui.notifications.error("Nie udalo sie odczytac formularza prosby o testy.");
                return;
              }
              await sendRollRequests(moduleId, getParticipantActor, new FormData(form), participants);
            } catch (error) {
              console.error(`${moduleId} | blad przy wysylaniu prosb o testy`, error);
              ui.notifications.error("Nie udalo sie wyslac prosb o testy. Sprawdz konsole Foundry po szczegoly.");
            }
          }
        },
        cancel: {
          label: "Anuluj"
        }
      },
      default: "send"
    }).render(true);
  }

  Hooks.on("renderChatMessageHTML", (message, html) => {
    const request = message.getFlag(moduleId, ROLL_REQUEST_FLAG);
    if (!request) return;

    html.querySelectorAll("[data-action='prompt-roll']").forEach(button => button.addEventListener("click", async (event) => {
      event.preventDefault();
      await openPlayerRollDialog(moduleId, message);
    }));
  });

  return {
    openRollRequestDialog
  };
}
