# App 端技术设计

> 详细参考：`docs/app-build-tasks.md`（含数据库表清单/API路由/文件结构等）

## 技术栈

| 层 | 技术 |
|---|------|
| 数据库 | SQLite (better-sqlite3) |
| 后端 | Express + TypeScript |
| App | React Native + Expo (Expo Router) |
| Web | React + Ant Design（已有） |

## 架构

- 后端 `server/` 同时服务 Web 和 App
- App 通过 REST API 连接后端（JWT 认证）
- 任务流驱动架构：首页展示可操作任务卡片
- 5 Tab 底部导航 + 中央凸起扫码按钮
- 3 个角色：SALES / WAREHOUSE_CN / WAREHOUSE_US
