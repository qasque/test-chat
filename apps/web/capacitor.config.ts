import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.kosmosapp.support",
  appName: "Портал поддержки",
  webDir: "dist",
  server: {
    url: "https://msk.kosmosapp.ru",
    cleartext: false,
  },
  ios: {
    contentInset: "never",
    preferredContentMode: "mobile",
    backgroundColor: "#0f1419",
    allowsLinkPreview: false,
  },
  android: {
    allowMixedContent: false,
    backgroundColor: "#0f1419",
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 1500,
      backgroundColor: "#0f1419",
      showSpinner: false,
    },
    StatusBar: {
      overlaysWebView: true,
      style: "DARK",
      backgroundColor: "#0f1419",
    },
  },
};

export default config;
