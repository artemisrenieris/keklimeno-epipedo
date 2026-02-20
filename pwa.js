const APP_VERSION = "v3";

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(`./service-worker.js?${APP_VERSION}`, { updateViaCache: "none" })
      .then((registration) => {
        registration.update().catch(() => {});
      })
      .catch((error) => {
        console.warn("Service worker registration failed:", error);
      });
  });

  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) {
      return;
    }
    refreshing = true;
    window.location.reload();
  });
}
