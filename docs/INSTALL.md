# fnOS 安装与使用说明

> 当前仓库未提供可下载的完整 FPK。以下为一台 fnOS x86_64 NAS 的实际部署步骤，不能视为所有机型的兼容保证。

## 1. 前提条件

- 飞牛 fnOS x86_64，Docker 可用；构建时需要 fnpack 1.2.4 或兼容版本
- PanSou 作为独立服务运行
- MoviCloud 的 TMDB 和网盘账号由使用者自行合法配置

## 2. 启动 PanSou

若没有现成实例，可参考 [PanSou 官方说明](https://github.com/fish2018/pansou)；以下命令为本项目验证过的容器形态：

```bash
sudo docker run -d --name pansou-web --restart unless-stopped \
  -p 8088:80 ghcr.io/fish2018/pansou-web
```

已有 PanSou 的用户请勿重复创建同名容器。检查：

```bash
sudo docker ps --filter name=pansou
curl -sS -o /tmp/pansou-search.json \
  -w 'HTTP:%{http_code} time:%{time_total}s\n' \
  --max-time 90 -X POST http://127.0.0.1:8088/api/search \
  -H 'Content-Type: application/json' \
  -d '{"kw":"测试关键词"}'
```

## 3. 安装融合 FPK（发行包待发布）

经许可证和安全检查后，未来可在 Releases 下载 `movicloud-pansou.fpk`，从飞牛应用中心「手动安装」。当前**没有发布版下载地址**，请勿信任冒名安装包。

测试实例使用端口 15079；如果被已有服务占用，修改 FPK 的 manifest、`app/ui/config`、`cmd/main` 三处并重新打包。只用不同 appname 无法自动避免端口冲突。

FPK 中的 `cmd/main` 需要包含：

```bash
export NODE_ENV=production
export NITRO_HOST=0.0.0.0
export NITRO_PORT=15079
export PANSOU_API_URL=http://127.0.0.1:8088
export MOV_DATA_DIR="${TRIM_PKGVAR}/data"
```

如果 FPK 和 PanSou **位于不同机器或 Docker 网络**，请调整 `PANSOU_API_URL`，`127.0.0.1` 并非跨主机服务地址。

## 4. 首次使用

1. 打开 `http://NAS_IP:15079/`（以实际端口为准）。
2. 完成 MoviCloud 安装向导，设置管理员与 TMDB 配置。
3. 在网盘设置中绑定自己的夸克或 UC 账号。不要在 GitHub Issue 中发布 Cookie 或密钥。
4. 进入电影/电视剧详情，点击「下载资源」。
5. 选择网盘类型、打开原分享链接。夸克（及符合条件的 UC）资源可通过云朵按钮进入原有转存弹窗；具体功能取决于账号有效性和分享链接状态。

## 5. 验证与安全

```bash
sudo ss -lntp | grep ':15079'
curl -I --max-time 10 http://127.0.0.1:15079/
```

首次转存前确认登录的是自己的网盘，目标目录正确。卸载前备份应用数据，尤其是账号配置和数据库。不要用测试版直接覆盖仍需保留数据的原版。
