import { createSSRApp } from 'vue'
import App from './App.vue'

// uni-app 使用这个工厂函数创建应用，后续仍可复用到小程序和 App。
export function createApp() {
  const app = createSSRApp(App)
  return { app }
}
