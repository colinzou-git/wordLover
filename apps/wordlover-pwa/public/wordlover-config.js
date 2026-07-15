window.WORDLOVER_CONFIG = {
  googleDriveFileName: "wordlover-user-data.json",
  googleScopes: [
    "https://www.googleapis.com/auth/drive.appdata",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
  ],
  geminiApiKey: "",
  geminiModel: "gemini-2.5-flash",
  localDevelopmentPassphrase: "",
  youdaoGatewayUrl: "https://vps-ee890919.vps.ovh.us",
  // The user has authorized saved Youdao definitions to participate in local persistence,
  // sync, backup/import, and explicit personal export.
  youdaoPersistenceAllowed: true,
  youdaoPortabilityAllowed: true,
};

// The fallback waits for WordFan's local and full dictionary lookups to finish,
// then reuses the existing Gemini settings dialog and native Add-to-dictionary flow.
void import("/online-dictionary-bridge.js?v=20260715-2");
