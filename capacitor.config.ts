import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.qilin.errornotebook',
  appName: '沪学错题本',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
}

export default config
