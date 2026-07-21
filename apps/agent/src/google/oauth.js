/**
 * Gerenciador OAuth 2.0 do Google Workspace.
 */
function getAuthUrl() {
  return "https://accounts.google.com/o/oauth2/v2/auth?scope=gmail.readonly%20calendar";
}

async function handleCallback(code) {
  console.log("[GoogleOAuth] Processando callback com autorização...");
  return { ok: true, accessToken: "mock_access_token" };
}

module.exports = {
  getAuthUrl,
  handleCallback,
};
