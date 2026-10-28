# MoviCloud × PanSou（fnOS 融合版）

> 非官方社区集成项目。基于 [MoviCloud](https://github.com/MoviCloud-com/movicloud-app) v1.0.6，接入 [PanSou](https://github.com/fish2018/pansou) 网盘聚合搜索。与上游项目维护团队无隶属关系。

已在一台 x86_64 飞牛 fnOS 上验证 FPK 安装、影视资源搜索、夸克资源打开与账号内分享转存。

## V1.1

详情页自动预搜索、30 分钟内存缓存、下载窗口立即打开、后台分批验证链接。升级与测试说明见 [V1.1](docs/V1.1.md)。

## 功能

- 保留 MoviCloud 的影视展示、TMDB 信息、个人网盘管理等原有功能
- 将影视详情页的资源搜索改为调用独立运行的 PanSou API
- 展示多来源网盘分享链接、提取码与分类
- 复用 MoviCloud 原有的夸克/UC 分享转存组件
- 通过 fnpack 构建 fnOS x86_64 的独立 FPK

| 功能 | 当前验证 |
|---|---|
| PanSou 搜索及分类 | 已验证 |
| 夸克分享链接打开和转存 | 已验证 |
| UC 原版转存代码 | 存在，融合版尚未单独实测 |
| 迅雷 / 115 / 123 的应用内分享转存 | 未实现 |
| 其他所有 PanSou 网盘类别 | 未全部适配 |
| fnOS x86_64 安装 | 在一台设备上验证 |

## 原理

```text
MoviCloud 影视详情页
 ├── TMDB 影视信息（原功能）
 ├── /api/pansou/search（Nuxt 服务端适配）
 │     └── PanSou /api/search（独立 Docker 服务）
 └── MoviCloud 原有网盘功能
       └── 夸克 / UC 分享转存（仅对应账户及有效分享）
```

## 安装与使用

1. 在飞牛 fnOS 的 Docker 中启动 PanSou，参考 [安装教程](docs/INSTALL.md)。本地案例使用 `8088:80`。
2. 用 `curl` 确认 `http://127.0.0.1:8088/api/search` 返回搜索结果。**PanSou 与 FPK 同在宿主机时优先使用 127.0.0.1；不同容器或主机要换为可达地址。**
3. 未来取得经过授权发布的 `.fpk` 后，在飞牛「应用中心 → 手动安装」安装。**目前仓库没有可下载的 FPK。**
4. 按安装向导填写 TMDB 配置、管理员账户；按需绑定支持的个人网盘账户。
5. 打开影视详情 →「下载资源」→ 选择网盘类别。点击外链图标打开分享链接；对有效的夸克账号及同类型分享，可以使用云朵转存按钮。

完整步骤：[安装与使用](docs/INSTALL.md) · [构建 FPK](docs/BUILD.md) · [故障排查](docs/TROUBLESHOOTING.md) · [Release 指南](docs/RELEASE.md) · [发布前检查](docs/PUBLISH.md)

## 致谢

特别感谢以下开源项目及贡献者：

- **[MoviCloud — MoviCloud-com/movicloud-app](https://github.com/MoviCloud-com/movicloud-app)**：提供影视浏览、TMDB 集成、网盘账号与分享转存能力。本项目的应用主体基于其 v1.0.6。
- **[PanSou — fish2018/pansou](https://github.com/fish2018/pansou)**：提供聚合网盘搜索、插件来源与 HTTP API。本项目通过独立 PanSou 服务取得资源索引。

请优先访问原作者仓库了解其许可证、更新与使用要求。此仓库不声称任何上游成果为本项目原创。

## 版权、隐私与免责声明

PanSou 仓库标示 MIT 许可证；MoviCloud 源码再分发条款**仍待独立核实**。本仓库先公开（当前实际上为私有）适配说明与自编文档，不代表已获准重新发布完整上游代码或 FPK。

不要将网盘 Cookie、Token、TMDB 密钥、数据库、用户配置或 NAS 内网信息提交到仓库。仅搜索、保存你有权使用的资源，尊重原内容的版权与各服务条款。
