export function createOnlineDictionarySupplementLifecycle({ providerId, supplements, controller, render }) {
  if (!providerId || !supplements || !controller || typeof render !== "function") throw new TypeError("Supplement lifecycle dependencies are required.");

  let actionPromise = null;
  let actionName = null;
  const exclusive = (name, task) => {
    if (actionPromise) return actionPromise;
    actionName = name;
    actionPromise = Promise.resolve().then(task).finally(() => { actionPromise = null; actionName = null; });
    return actionPromise;
  };
  async function display(term) { return controller.display(term); }

  function save(term, entry) { return exclusive("save", async () => {
    if (!entry) throw new TypeError("A transient entry is required before saving.");
    if (!supplements.canPersist(providerId)) {
      const state = { status: "success", entry, saveError: { category: "persistence_not_permitted", message: "Saving this source is not permitted by the current provider policy." } };
      render(state);
      return state;
    }
    try {
      await supplements.save(entry);
      return await display(term);
    } catch (error) {
      const state = { status: "success", entry, saveError: { category: error?.category ?? "save_failed", message: "The additional definition could not be saved." } };
      render(state);
      return state;
    }
  }); }

  function remove(term) { return exclusive("remove", async () => {
    try {
      await supplements.remove(term, providerId);
      return await display(term);
    } catch (error) {
      const record = await supplements.get(term, providerId).catch(() => null);
      const state = record
        ? { status: "saved", entry: record.entry, removeError: { category: "remove_failed", message: "The saved definition could not be removed." } }
        : { status: "error", error: { category: "remove_failed", message: "The saved definition could not be removed." } };
      render(state);
      return state;
    }
  }); }

  function refresh(term) { return exclusive("refresh", async () => {
    const previous = await supplements.get(term, providerId).catch(() => null);
    const result = await controller.refresh(term);
    if (result.status !== "success") {
      if (previous?.entry) {
        const state = { status: "saved", entry: previous.entry, refreshError: { category: result.error?.category ?? result.status, message: "Refresh failed; the saved definition was kept." } };
        render(state);
        return state;
      }
      return result;
    }
    try {
      await supplements.save(result.entry);
      return await display(term);
    } catch (error) {
      const state = previous?.entry
        ? { status: "saved", entry: previous.entry, refreshError: { category: error?.category ?? "save_failed", message: "Refresh failed; the saved definition was kept." } }
        : { status: "success", entry: result.entry, saveError: { category: error?.category ?? "save_failed", message: "The refreshed definition could not be saved." } };
      render(state);
      return state;
    }
  }); }

  return Object.freeze({ display, save, remove, refresh, activeAction: () => actionName });
}
