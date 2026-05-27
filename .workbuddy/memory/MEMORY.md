# 闪卡记忆项目 Memory

## 技术架构
- 单文件 HTML 应用（index.html），CSS/JS 全内联，约 750+ 行
- 部署于 GitHub Pages：https://liuyan4561.github.io/flashcards/
- Git 仓库：liuyan4561/flashcards，分支 main
- 数据存储：localStorage（flashcards_data / flashcards_records / flashcards_settings）
- 认证：GitHub PAT token（用户提供的 ghp_ 开头 token，存在 git remote URL 中）

## 已实现功能
- 首页：统计展示 + 3个入口（添加闪卡、开始闪卡、闪卡设置）
- 添加闪卡：手动输入单词+释义，自动查询释义，网络图片搜索，本地图片上传
- 批量导入：CSV/TXT 文件导入，支持逗号/Tab/竖线分隔，自动去重
- 学习闪卡：遗忘曲线（SM-2简化版），新卡/旧卡分类，每日上限设置
- 闪卡设置：新卡每日上限（默认20）、旧卡每日上限（默认60），弹窗修改
- 发音：Web Speech API + Google Translate TTS 降级（安卓兼容）
- 图片选择：Unsplash API 搜索 + 本地图片上传

## 已修复 Bug
- closeImgDialog 函数名不一致导致 App undefined
- 安卓手机 Web Speech API 静默失败，添加 Google TTS 降级方案
- 首页按钮不可点击：容器缺少 max-width 和 overflow

## 踩坑经验
- GitHub Pages build_type 需设为 legacy，不能用 workflow（除非有 Actions 配置）
- 安卓 Chrome 的 speechSynthesis.speak() 必须同步调用，不能包在 setTimeout 里
- Edit 工具匹配失败时，用 node -e 脚本做字符串替换更可靠
- 网络经常断（github.com 443 连接超时），代码先 commit 本地，网络恢复后再 push
