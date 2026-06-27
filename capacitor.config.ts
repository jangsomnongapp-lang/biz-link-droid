import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.buildhub.app',
  appName: 'BuildHub',
  webDir: 'dist',
  plugins: {
    SocialLogin: {
      google: {
        webClientId: '997514086528-uaepk54496rgh00huddfdep2jbvosb0t.apps.googleusercontent.com'
      }
    }
  }
};

export default config;
