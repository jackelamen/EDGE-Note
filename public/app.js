const statusEndpoint = "/api/config";

async function hydrateConfig() {
  try {
    const response = await fetch(statusEndpoint);
    if (!response.ok) return;
    const config = await response.json();
    document.documentElement.dataset.ai = config.aiEnabled ? "enabled" : "disabled";
  } catch {
    document.documentElement.dataset.ai = "offline";
  }
}

hydrateConfig();
