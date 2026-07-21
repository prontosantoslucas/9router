const cfg = require("../config");
const { fetchGithubPersonality } = require("./githubFetcher");
const { saveCachedPersonality, getCachedPersonality } = require("./personalityCache");

let activePersonality = getCachedPersonality();

async function syncNow(url, token) {
  const targetUrl = url || cfg.GITHUB_PERSONALITY_URL;
  if (!targetUrl) return activePersonality;

  try {
    const content = await fetchGithubPersonality(targetUrl, token);
    if (content) {
      activePersonality = content;
      saveCachedPersonality(content);
      console.log("[PersonalityPoller] Personalidade do Lucas atualizada do GitHub com sucesso!");
    }
  } catch (err) {
    console.error("[PersonalityPoller] Falha ao sincronizar personalidade do GitHub:", err.message);
  }

  return activePersonality;
}

function getActivePersonality() {
  return activePersonality;
}

module.exports = {
  syncNow,
  getActivePersonality,
};
