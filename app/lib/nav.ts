import type { Router } from 'expo-router';

/**
 * 安全返回：如果有历史栈则返回，否则回到任务流首页。
 * 解决直接通过 URL 打开页面时 router.back() 无效的问题。
 */
export function safeBack(router: Router, fallback: string = '/(tabs)/tasks'): void {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace(fallback as never);
  }
}
