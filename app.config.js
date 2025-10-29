module.exports = {
  expo: {
    name: "bolt-expo-nativewind",
    slug: "bolt-expo-nativewind",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "urbanbeauty",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.urbanbeauty.app",
      infoPlist: {
        NSMicrophoneUsageDescription: "Приложението се нуждае от достъп до микрофона за гласови резервации",
        NSCameraUsageDescription: "Приложението се нуждее от достъп до камерата за качване на снимки",
        NSSpeechRecognitionUsageDescription: "Allow $(PRODUCT_NAME) to use speech recognition."
      }
    },
    android: {
      package: "com.urbanbeauty.app",
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON || "./google-services.json",
      permissions: [
        "RECORD_AUDIO",
        "CAMERA",
        "READ_EXTERNAL_STORAGE",
        "WRITE_EXTERNAL_STORAGE",
        "android.permission.RECORD_AUDIO"
      ],
      softwareKeyboardLayoutMode: "pan"
    },
    web: {
      bundler: "metro",
      output: "single",
      favicon: "./assets/images/favicon.png"
    },
    plugins: [
      "expo-router",
      "expo-font",
      "expo-web-browser"
    ],
    experiments: {
      typedRoutes: true
    },
    extra: {
      router: {},
      eas: {
        projectId: "b606c6b6-082c-4c40-813d-c90ffc88b756"
      }
    }
  }
};
