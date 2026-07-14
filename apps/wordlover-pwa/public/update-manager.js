const RELEASE_SCHEMA_VERSION = 1;
const DEFAULT_TIMEOUT_MS = 10000;

export function validateReleaseManifest(value, { deployed = false } = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Release manifest must be an object.");
  if (value.schemaVersion !== RELEASE_SCHEMA_VERSION) throw new Error(`Unsupported release schema: ${value.schemaVersion ?? "missing"}.`);
  for (const field of ["appVersion", "buildId", "commit", "shellCache", "userDataFormatVersion", "publishedAt"]) {
    if (typeof value[field] !== "string" || !value[field].trim()) throw new Error(`Release manifest field ${field} is required.`);
  }
  if (deployed && !/^[0-9a-f]{40}$/i.test(value.commit)) throw new Error("Deployed release commit must be a full Git SHA.");
  if (value.commit !== "dev" && !/^[0-9a-f]{40}$/i.test(value.commit)) throw new Error("Release commit must be dev or a full Git SHA.");
  if (value.publishedAt !== "dev" && !Number.isFinite(Date.parse(value.publishedAt))) throw new Error("Release publishedAt must be an ISO-8601 timestamp.");
  return Object.freeze({ ...value });
}

export function compareReleaseState(state) {
  if (!state?.server) return state?.network?.errorKind === "release-invalid" ? "release-invalid" : "server-unreachable";
  if (state.phase === "activating") return "activating";
  if (state.phase === "downloading") return "downloading";
  if (state.workerError) return state.workerError;
  if (state.waitingWorker) return "update-ready";
  if (state.activeWorker && (state.activeWorker.appVersion !== state.page.appVersion || state.activeWorker.cacheName !== state.page.shellCache)) return "page-worker-mismatch";
  if (state.server.appVersion !== state.page.appVersion || state.server.shellCache !== state.page.shellCache || state.server.buildId !== state.page.buildId) return "update-available";
  return "up-to-date";
}

const identity = (label, value, worker = false) => {
  if (!value) return `${label}: None`;
  const details = [value.appVersion, value.buildId, worker ? value.cacheName : value.shellCache].filter(Boolean).join(" · ");
  return `${label}: ${details}`;
};

export function formatUpdateStatus(state) {
  const outcome = compareReleaseState(state);
  const lines = [
    identity("App page", state.page),
    identity("Active offline worker", state.activeWorker, true),
    identity("Waiting update", state.waitingWorker, true),
    identity("Live server", state.server),
  ];
  const messages = {
    "up-to-date": "WordFan is up to date.",
    "update-available": "A newer live release is available.",
    downloading: "Downloading update…",
    "update-ready": "Update ready. Apply it when you are ready to reload.",
    activating: "Applying update…",
    "page-worker-mismatch": "The app page and offline worker do not match. Repair the app shell if checking again does not resolve it.",
    "server-unreachable": "Could not contact the app server to check the live release. The installed offline version remains available.",
    "release-invalid": "The live release manifest is invalid. No update was attempted.",
    "worker-update-failed": "The live release was found, but the offline worker update failed.",
    "worker-install-failed": "The live release was found, but the new offline shell could not be installed.",
    "activation-failed": "The downloaded update could not be activated. The current offline version remains available.",
    unsupported: "Service workers are unavailable on this device.",
  };
  return `${messages[outcome] ?? "Update state is unavailable."}\n${lines.join("\n")}`;
}

export function shellCacheNamesToDelete(names) {
  return names.filter((name) => name.startsWith("wordlover-shell-"));
}

function withTimeout(promiseFactory, timeoutMs, label) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return promiseFactory(controller.signal).catch((error) => {
    if (error?.name === "AbortError") throw new Error(`${label} timed out.`);
    throw error;
  }).finally(() => clearTimeout(timer));
}

function workerInfo(worker, timeoutMs) {
  if (!worker) return Promise.resolve(null);
  return withTimeout((signal) => new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    channel.port1.onmessage = (event) => resolve(event.data);
    worker.postMessage({ type: "GET_RELEASE_INFO" }, [channel.port2]);
  }), timeoutMs, "Worker identity request").catch(() => null);
}

export function createUpdateManager(options) {
  const {
    pageRelease,
    onState = () => {},
    persist = async () => {},
    confirmRepair = () => Promise.resolve(false),
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = options;
  const state = { page: { ...pageRelease }, activeWorker: null, waitingWorker: null, server: null, network: { online: navigator.onLine, errorKind: null, message: null }, phase: "idle", workerError: null };
  const publish = () => { state.outcome = compareReleaseState(state); onState({ ...state }); return { ...state }; };
  const registration = () => navigator.serviceWorker.getRegistration();

  async function collectWorkers(reg) {
    state.activeWorker = await workerInfo(reg?.active ?? navigator.serviceWorker.controller, timeoutMs);
    state.waitingWorker = await workerInfo(reg?.waiting, timeoutMs);
  }

  async function fetchRelease() {
    try {
      const response = await withTimeout((signal) => fetch(`/release.json?check=${Date.now()}`, { cache: "no-store", signal }), timeoutMs, "Release check");
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      state.server = validateReleaseManifest(await response.json());
      state.network = { online: true, errorKind: null, message: null };
    } catch (error) {
      state.server = null;
      const invalid = error instanceof SyntaxError || /manifest|schema|field|commit|publishedAt/i.test(error?.message ?? "");
      state.network = { online: navigator.onLine, errorKind: invalid ? "release-invalid" : "server-unreachable", message: error?.message ?? String(error) };
    }
  }

  async function check({ install = true } = {}) {
    if (!("serviceWorker" in navigator)) { state.workerError = "unsupported"; return publish(); }
    state.phase = "checking"; state.workerError = null; publish();
    const reg = await registration() ?? await navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" });
    await Promise.all([fetchRelease(), collectWorkers(reg)]);
    if (install && state.server && compareReleaseState(state) === "update-available") {
      state.phase = "downloading"; publish();
      try {
        await reg.update();
        await new Promise((resolve) => {
          if (reg.waiting) return resolve();
          const timer = setTimeout(resolve, timeoutMs);
          const watch = () => {
            const worker = reg.installing;
            if (!worker) return;
            worker.addEventListener("statechange", () => {
              if (["installed", "redundant"].includes(worker.state)) { clearTimeout(timer); resolve(); }
            });
          };
          reg.addEventListener("updatefound", watch, { once: true });
          watch();
        });
        await collectWorkers(reg);
        if (!reg.waiting) state.workerError = reg.installing?.state === "redundant" ? "worker-install-failed" : "worker-update-failed";
      } catch (error) {
        state.workerError = "worker-update-failed";
        state.network.message = error?.message ?? String(error);
      }
    }
    state.phase = "idle";
    return publish();
  }

  async function apply({ reload = true } = {}) {
    const reg = await registration();
    if (!reg?.waiting) return publish();
    state.phase = "activating"; publish();
    try {
      await persist();
      const changed = new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("Service-worker activation timed out.")), timeoutMs);
        navigator.serviceWorker.addEventListener("controllerchange", () => { clearTimeout(timer); resolve(); }, { once: true });
      });
      reg.waiting.postMessage({ type: "SKIP_WAITING", explicit: true });
      await changed;
      await collectWorkers(await registration());
      if (state.server && state.activeWorker && (state.activeWorker.appVersion !== state.server.appVersion || state.activeWorker.cacheName !== state.server.shellCache)) {
        throw new Error("The activated worker does not match the live release.");
      }
      state.phase = "reloading";
      if (reload) {
        const marker = `wordfan-update-reload:${state.server?.buildId ?? state.activeWorker?.buildId ?? "unknown"}`;
        if (sessionStorage.getItem(marker) !== "1") {
          sessionStorage.setItem(marker, "1");
          location.reload();
        }
      }
    } catch (error) {
      state.phase = "error";
      state.workerError = "activation-failed";
      state.network.message = error?.message ?? String(error);
    }
    return publish();
  }

  async function repair() {
    await fetchRelease();
    if (!state.server) return publish();
    if (!(await confirmRepair(state))) return publish();
    await persist();
    for (const reg of await navigator.serviceWorker.getRegistrations()) {
      if (reg.scope.startsWith(location.origin)) await reg.unregister();
    }
    const names = await caches.keys();
    await Promise.all(shellCacheNamesToDelete(names).map((name) => caches.delete(name)));
    location.assign(`/?fresh=${encodeURIComponent(state.server.buildId)}-${Date.now()}`);
    return publish();
  }

  return { state, check, apply, repair, fetchRelease };
}
