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
  // Disabled by default. Set only after deploying the approved server-side gateway.
  youdaoGatewayUrl: "",
  // Keep false unless Youdao has granted written permission for persistent storage.
  youdaoPersistenceAllowed: false,
};

// The fallback waits for WordFan's local and full dictionary lookups to finish,
// then reuses the existing Gemini settings dialog and native Add-to-dictionary flow.
void import("/online-dictionary-bridge.js?v=20260714-7");
