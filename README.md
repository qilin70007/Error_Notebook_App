# 沪学错题本

面向上海初中生的跨平台智能错题分析软件。采用一套 React + TypeScript 代码，同时支持 Windows 桌面应用、Android APK 和浏览器运行。

## 已实现功能

- 语文、数学、英语三科错题录入，支持题目文字和手机拍照上传。
- 自动判断学科、知识点和错误类型；无网络、无 AI 配置时也能使用本地规则完成整理。
- AI 深度分析：定位第一次出错的位置、讲解正确思路、给出可执行改进建议，并生成 2 道带提示和答案的同类变式题。
- 错题筛选、搜索、编辑、删除、掌握状态和薄弱知识点统计。
- 主动重做模式：先隐藏答案，学生自评后记录复习次数；连续答对 2 次自动标记为“已掌握”。
- 导出 `.docx` 重做卷：前半部分只放题目和答题区，后半部分集中放答案、正确思路与错因分析，适合 A4 打印。
- JSON 完整备份与恢复。
- 本地优先存储，AI 未配置或请求失败不影响基本功能。

首次运行会显示三道示例错题，便于理解完整流程。可以编辑或删除这些示例。

## 本地开发

需要 Node.js 22 或更高版本。

```bash
npm install
npm run dev
```

质量检查：

```bash
npm test
npm run build
```

## Windows 桌面端

开发运行：

```bash
npm run desktop:dev
```

在 Windows 环境生成安装包：

```bash
npm run desktop:build
```

安装包输出到 `release/`。GitHub Actions 也会在每次主分支构建或手动运行时生成 Windows 安装包供下载。

## Android APK

首次创建原生工程（仓库中已经创建，无需重复执行）：

```bash
npm run android:add
```

同步网页代码并打开 Android Studio：

```bash
npm run android:sync
npm run android:open
```

也可以在 `android/` 目录执行：

```bash
./gradlew assembleDebug
```

调试 APK 位于 `android/app/build/outputs/apk/debug/app-debug.apk`。GitHub Actions 会自动构建并上传 APK artifact。

## AI 配置

在应用的“设置与备份”页面：

1. 开启“AI 自动分析”。
2. 保持默认 Responses API 地址，或填写自有兼容代理地址。
3. 填写可用模型名称，默认使用 `gpt-5.6-luna`。
4. 填写 API Key 后录入或重新分析错题。

AI 返回值使用严格 JSON Schema 约束，避免字段缺失导致页面无法使用。在线请求失败时，新录入错题会自动降级为本地规则分析。

> 安全说明：API Key 只保存在当前应用会话的 `sessionStorage`，不会写入错题数据、备份文件或仓库。面向多人发布时，应将 AI 请求迁移到自有服务端代理，不能在客户端内置公共密钥。

## 数据说明

- 错题数据当前保存在设备本地浏览器存储中，Windows 与 Android 各自独立。
- 换设备前请先导出 JSON 备份，在新设备中恢复。
- 题目图片会包含在本地数据和 JSON 备份中；避免上传包含学生姓名、学校或其他个人信息的图片。

## 项目结构

```text
src/
  lib/ai.ts             OpenAI Responses API 结构化分析
  lib/classifier.ts     三科本地分类与离线分析
  lib/exportDocx.ts     DOCX 重做卷生成
  lib/storage.ts        本地存储、备份与恢复
  App.tsx               完整交互流程
electron/               Windows 桌面包装
android/                Capacitor Android 原生工程
.github/workflows/      Windows 与 APK 自动构建
```

## 下一阶段建议

- 加入服务端账号与 Windows/Android 跨设备同步。
- 增加 OCR 文字校对页，允许学生确认照片识别结果。
- 按上海中考知识体系维护更细的年级—单元—知识点树。
- 增加间隔复习算法、周报和家长打印报告。
