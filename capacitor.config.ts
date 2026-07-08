import { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.buildhub.app",
  appName: "BuildHub",
  webDir: "dist",
  plugins: {
    PushNotifications: {
      presentationOptions: ["sound", "alert", "banner", "list"],
    },
    LocalNotifications: {
      smallIcon: "ic_stat_icon_config_sample",
      iconColor: "#2563EB",
    },
    SocialLogin: {
      google: {
        webClientId: "997514086528-6g3c05853170ioct0ijo2b43oall9sem.apps.googleusercontent.com",
      },
    },
  },
};

export default config;
