const STORAGE_KEY = "earth-online-quest-deck-v1";
const DAY = 24 * 60 * 60 * 1000;
const TIMER_MODES = {
  focus: 25 * 60,
  short: 5 * 60,
  long: 15 * 60,
};

const todayKey = () => new Date().toISOString().slice(0, 10);
const addDays = (dateKey, days) => {
  const d = new Date(`${dateKey}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

const defaultState = {
  player: {
    coins: 80,
    xp: 40,
    level: 1,
    streak: 0,
    lastActiveDay: "",
  },
  filter: "due",
  timerMode: "focus",
  activeQuestId: "",
  todayPomos: {},
  quests: [
    {
      id: crypto.randomUUID(),
      title: "30 分钟整理今日待办",
      type: "habit",
      interval: 1,
      coins: 20,
      xp: 28,
      pomos: 1,
      donePomos: 0,
      completedAt: "",
      nextDue: todayKey(),
      createdAt: todayKey(),
    },
    {
      id: crypto.randomUUID(),
      title: "推进一个主线项目",
      type: "deep",
      interval: 0,
      coins: 60,
      xp: 85,
      pomos: 3,
      donePomos: 0,
      completedAt: "",
      nextDue: todayKey(),
      createdAt: todayKey(),
    },
    {
      id: crypto.randomUUID(),
      title: "每 2 天做一次身体维护",
      type: "habit",
      interval: 2,
      coins: 35,
      xp: 46,
      pomos: 1,
      donePomos: 0,
      completedAt: "",
      nextDue: todayKey(),
      createdAt: todayKey(),
    },
  ],
  tracks: [
    {
      id: crypto.randomUUID(),
      title: "Pixel focus slot",
      url: "",
      note: "给没有音频链接时占位用，可以换成自己的歌单链接。",
    },
    {
      id: crypto.randomUUID(),
      title: "Boss fight sprint",
      url: "",
      note: "适合深度任务，开始前点一下就算进入状态。",
    },
  ],
};

let state = loadState();
let timer = {
  remaining: TIMER_MODES[state.timerMode] || TIMER_MODES.focus,
  running: false,
  intervalId: null,
};

const $ = (selector) => document.querySelector(selector);

const els = {
  level: $("#level"),
  xpFill: $("#xpFill"),
  xpText: $("#xpText"),
  coins: $("#coins"),
  questForm: $("#questForm"),
  questList: $("#questList"),
  questTemplate: $("#questTemplate"),
  taskTitle: $("#taskTitle"),
  taskType: $("#taskType"),
  taskInterval: $("#taskInterval"),
  taskCoins: $("#taskCoins"),
  taskPomos: $("#taskPomos"),
  activeQuest: $("#activeQuest"),
  activeQuestLabel: $("#activeQuestLabel"),
  timer: $("#timer"),
  startPauseBtn: $("#startPauseBtn"),
  resetTimerBtn: $("#resetTimerBtn"),
  finishPomoBtn: $("#finishPomoBtn"),
  todayPomos: $("#todayPomos"),
  streak: $("#streak"),
  nextLevel: $("#nextLevel"),
  resetDayBtn: $("#resetDayBtn"),
  trackForm: $("#trackForm"),
  trackTitle: $("#trackTitle"),
  trackUrl: $("#trackUrl"),
  trackList: $("#trackList"),
  trackTemplate: $("#trackTemplate"),
  audioPlayer: $("#audioPlayer"),
  nowPlaying: $("#nowPlaying"),
  clearTrackBtn: $("#clearTrackBtn"),
  closeViewBtn: $("#closeViewBtn"),
};

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return structuredClone(defaultState);
  try {
    return { ...structuredClone(defaultState), ...JSON.parse(saved) };
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function xpNeeded(level = state.player.level) {
  return 120 + (level - 1) * 60;
}

function normalizePlayer() {
  while (state.player.xp >= xpNeeded()) {
    state.player.xp -= xpNeeded();
    state.player.level += 1;
    state.player.coins += 50;
  }
}

function isDue(quest) {
  if (!quest.nextDue) return true;
  return quest.nextDue <= todayKey();
}

function isDoneToday(quest) {
  return quest.completedAt === todayKey();
}

function typeLabel(type) {
  return {
    todo: "一次",
    habit: "习惯",
    deep: "深度",
  }[type] || "任务";
}

function visibleQuests() {
  const items = [...state.quests].sort((a, b) => {
    if (isDue(a) !== isDue(b)) return isDue(a) ? -1 : 1;
    return a.createdAt.localeCompare(b.createdAt);
  });
  if (state.filter === "due") return items.filter((q) => isDue(q) && !isDoneToday(q));
  if (state.filter === "done") return items.filter((q) => isDoneToday(q));
  return items;
}

function questDetail(quest) {
  const cadence = quest.interval > 0 ? `每 ${quest.interval} 天刷新` : "一次性任务";
  const pomo = `${quest.donePomos || 0}/${quest.pomos} 番茄`;
  const due = isDue(quest) ? "今日可做" : `${quest.nextDue} 再刷新`;
  return `${cadence} · ${pomo} · ${due}`;
}

function updateStreakOnActivity() {
  const today = todayKey();
  if (state.player.lastActiveDay === today) return;
  const yesterday = addDays(today, -1);
  state.player.streak = state.player.lastActiveDay === yesterday ? state.player.streak + 1 : 1;
  state.player.lastActiveDay = today;
}

function rewardQuest(quest) {
  updateStreakOnActivity();
  state.player.coins += Number(quest.coins);
  state.player.xp += Number(quest.xp);
  normalizePlayer();
}

function completeQuest(id) {
  const quest = state.quests.find((q) => q.id === id);
  if (!quest) return;
  rewardQuest(quest);
  quest.completedAt = todayKey();
  quest.donePomos = quest.pomos;
  if (quest.interval > 0) {
    quest.nextDue = addDays(todayKey(), quest.interval);
  }
  saveState();
  render();
}

function recordPomodoro() {
  const quest = state.quests.find((q) => q.id === state.activeQuestId);
  updateStreakOnActivity();
  state.todayPomos[todayKey()] = (state.todayPomos[todayKey()] || 0) + 1;
  state.player.coins += 8;
  state.player.xp += 12;
  if (quest) {
    quest.donePomos = Math.min((quest.donePomos || 0) + 1, quest.pomos);
    if (quest.donePomos >= quest.pomos && !isDoneToday(quest)) {
      rewardQuest(quest);
      quest.completedAt = todayKey();
      if (quest.interval > 0) {
        quest.nextDue = addDays(todayKey(), quest.interval);
      }
    }
  }
  normalizePlayer();
  saveState();
  render();
}

function renderPlayer() {
  const need = xpNeeded();
  els.level.textContent = state.player.level;
  els.coins.textContent = state.player.coins;
  els.xpText.textContent = `${state.player.xp} / ${need}`;
  els.xpFill.style.width = `${Math.min(100, (state.player.xp / need) * 100)}%`;
  els.todayPomos.textContent = state.todayPomos[todayKey()] || 0;
  els.streak.textContent = state.player.streak;
  els.nextLevel.textContent = `${need - state.player.xp} XP`;
}

function renderQuests() {
  els.questList.replaceChildren();
  const quests = visibleQuests();
  if (!quests.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = state.filter === "due" ? "今日副本清空。可以加一个小任务，或者去休息。" : "这个列表暂时为空。";
    els.questList.append(empty);
    return;
  }

  quests.forEach((quest) => {
    const node = els.questTemplate.content.firstElementChild.cloneNode(true);
    node.classList.toggle("done", isDoneToday(quest));
    node.querySelector("h3").textContent = quest.title;
    node.querySelector(".tag").textContent = typeLabel(quest.type);
    node.querySelector("p").textContent = questDetail(quest);
    node.querySelector(".mini-meter div").style.width = `${Math.min(100, ((quest.donePomos || 0) / quest.pomos) * 100)}%`;
    node.querySelector(".quest-reward strong").textContent = `+${quest.coins}G / +${quest.xp}XP`;
    node.querySelector(".complete-btn").addEventListener("click", () => completeQuest(quest.id));
    node.querySelector(".small-btn").addEventListener("click", () => {
      state.activeQuestId = quest.id;
      saveState();
      render();
    });
    node.querySelector(".delete-btn").addEventListener("click", () => {
      state.quests = state.quests.filter((q) => q.id !== quest.id);
      if (state.activeQuestId === quest.id) state.activeQuestId = "";
      saveState();
      render();
    });
    els.questList.append(node);
  });
}

function renderActiveQuest() {
  const activeOptions = state.quests.filter((q) => isDue(q) && !isDoneToday(q));
  els.activeQuest.replaceChildren();
  const placeholder = new Option("无任务", "");
  els.activeQuest.append(placeholder);
  activeOptions.forEach((quest) => {
    els.activeQuest.append(new Option(quest.title, quest.id));
  });
  if (!activeOptions.some((q) => q.id === state.activeQuestId)) {
    state.activeQuestId = activeOptions[0]?.id || "";
  }
  els.activeQuest.value = state.activeQuestId;
  const quest = state.quests.find((q) => q.id === state.activeQuestId);
  els.activeQuestLabel.textContent = quest ? `${quest.title} · ${quest.donePomos || 0}/${quest.pomos} 番茄` : "选择一个任务开始本轮副本";
}

function renderTracks() {
  els.trackList.replaceChildren();
  if (!state.tracks.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "播放队列为空。";
    els.trackList.append(empty);
    return;
  }

  state.tracks.forEach((track) => {
    const node = els.trackTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector("h3").textContent = track.title;
    node.querySelector("p").textContent = track.url || track.note || "未绑定音频链接";
    node.querySelector(".play-btn").addEventListener("click", () => playTrack(track));
    node.querySelector(".delete-btn").addEventListener("click", () => {
      state.tracks = state.tracks.filter((item) => item.id !== track.id);
      saveState();
      renderTracks();
    });
    els.trackList.append(node);
  });
}

function renderTimer() {
  const minutes = String(Math.floor(timer.remaining / 60)).padStart(2, "0");
  const seconds = String(timer.remaining % 60).padStart(2, "0");
  els.timer.textContent = `${minutes}:${seconds}`;
  els.startPauseBtn.textContent = timer.running ? "Ⅱ 暂停" : "▶ 开始";
  document.querySelectorAll(".mode").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.mode === state.timerMode);
  });
}

function renderTabs() {
  document.querySelectorAll(".tab").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.filter === state.filter);
  });
}

function render() {
  renderPlayer();
  renderTabs();
  renderQuests();
  renderActiveQuest();
  renderTracks();
  renderTimer();
}

function switchMode(mode) {
  state.timerMode = mode;
  timer.remaining = TIMER_MODES[mode];
  pauseTimer();
  saveState();
  renderTimer();
}

function pauseTimer() {
  timer.running = false;
  if (timer.intervalId) clearInterval(timer.intervalId);
  timer.intervalId = null;
}

function tick() {
  timer.remaining -= 1;
  if (timer.remaining <= 0) {
    timer.remaining = TIMER_MODES[state.timerMode];
    pauseTimer();
    if (state.timerMode === "focus") recordPomodoro();
  }
  renderTimer();
}

function toggleTimer() {
  if (timer.running) {
    pauseTimer();
  } else {
    timer.running = true;
    timer.intervalId = setInterval(tick, 1000);
  }
  renderTimer();
}

function resetTimer() {
  pauseTimer();
  timer.remaining = TIMER_MODES[state.timerMode];
  renderTimer();
}

function playTrack(track) {
  els.nowPlaying.textContent = track.title;
  if (track.url) {
    els.audioPlayer.src = track.url;
    els.audioPlayer.play().catch(() => {});
  } else {
    els.audioPlayer.removeAttribute("src");
    els.audioPlayer.load();
  }
}

els.questForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const pomos = Number(els.taskPomos.value);
  const coins = Number(els.taskCoins.value);
  const quest = {
    id: crypto.randomUUID(),
    title: els.taskTitle.value.trim(),
    type: els.taskType.value,
    interval: Number(els.taskInterval.value),
    coins,
    xp: Math.max(12, Math.round(coins * 1.35 + pomos * 8)),
    pomos,
    donePomos: 0,
    completedAt: "",
    nextDue: todayKey(),
    createdAt: todayKey(),
  };
  state.quests.unshift(quest);
  state.activeQuestId = quest.id;
  els.questForm.reset();
  els.taskInterval.value = "0";
  els.taskCoins.value = "25";
  els.taskPomos.value = "1";
  saveState();
  render();
});

els.trackForm.addEventListener("submit", (event) => {
  event.preventDefault();
  state.tracks.unshift({
    id: crypto.randomUUID(),
    title: els.trackTitle.value.trim(),
    url: els.trackUrl.value.trim(),
    note: "自定义曲目",
  });
  els.trackForm.reset();
  saveState();
  renderTracks();
});

els.activeQuest.addEventListener("change", () => {
  state.activeQuestId = els.activeQuest.value;
  saveState();
  renderActiveQuest();
});

els.startPauseBtn.addEventListener("click", toggleTimer);
els.resetTimerBtn.addEventListener("click", resetTimer);
els.finishPomoBtn.addEventListener("click", recordPomodoro);

els.resetDayBtn.addEventListener("click", () => {
  state.quests.forEach((quest) => {
    if (quest.interval > 0 && quest.nextDue < todayKey()) quest.nextDue = todayKey();
    if (quest.completedAt !== todayKey() && quest.donePomos >= quest.pomos) quest.donePomos = 0;
  });
  saveState();
  render();
});

els.clearTrackBtn.addEventListener("click", () => {
  state.tracks = [];
  els.audioPlayer.removeAttribute("src");
  els.audioPlayer.load();
  els.nowPlaying.textContent = "未选择";
  saveState();
  renderTracks();
});

document.querySelectorAll(".tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    state.filter = btn.dataset.filter;
    saveState();
    render();
  });
});

document.querySelectorAll(".mode").forEach((btn) => {
  btn.addEventListener("click", () => switchMode(btn.dataset.mode));
});

function openView(view) {
  if (view === "player") {
    document.querySelector(".topbar")?.classList.add("pulse-status");
    setTimeout(() => document.querySelector(".topbar")?.classList.remove("pulse-status"), 900);
    return;
  }
  document.body.dataset.view = view;
}

function closeView() {
  delete document.body.dataset.view;
}

document.querySelectorAll("[data-open-view]").forEach((hotspot) => {
  hotspot.addEventListener("click", () => openView(hotspot.dataset.openView));
});

els.closeViewBtn.addEventListener("click", closeView);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeView();
});

render();
