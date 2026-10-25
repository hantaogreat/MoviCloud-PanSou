# 常见问题

## 点击「下载资源」没反应

登录后在浏览器 F12 → Network 查看 `/api/pansou/search`。没有请求时检查前端按钮；401 时检查 MoviCloud 登录状态；502 时检查 PanSou 上游是否连通。

## 401 Unauthorized

未登录的 curl 请求可能被 MoviCloud 的 API 认证中间件拦截。不要直接将搜索接口设为公开白名单。请在正常登录后通过浏览器检查请求状态；勿分享 Cookie/Token。

## 502 PanSou search failed

先测试同一台 fnOS 主机的两条路径：

```bash
curl -sS -o /dev/null -w 'HTTP:%{http_code} time:%{time_total}s\n' \
  --connect-timeout 5 --max-time 20 http://127.0.0.1:8088/
curl -sS -o /dev/null -w 'HTTP:%{http_code} time:%{time_total}s\n' \
  --connect-timeout 5 --max-time 20 http://NAS_IP:8088/
```

实际部署曾出现 127.0.0.1 返回 200、局域网 IP 连接超时的情况。由于 FPK 直接在 NAS 宿主机运行，调整其 `PANSOU_API_URL=http://127.0.0.1:8088` 后搜索恢复。修改打包目录后要重新构建 FPK 并安装更新才能生效。

## 编译后没有 .output

执行 `npm run build:fnOS` 时查看 `dist/fnOS/server/index.mjs`，不要查默认 `.output`。日志出现 `Build complete!` 并且 Docker 退出码为 0 可作为构建成功的初步依据。

## npm ci EUSAGE / commander 冲突

`package-lock.json` 与 `package.json` 不一致时会失败。可在独立工作树使用 `npm install --no-audit --no-fund` 更新依赖；审查锁文件变化，谨慎提交。

## 端口占用

```bash
sudo ss -lntp | grep ':15079'
```

如为原版 MoviCloud 占用，不要直接 kill。为融合版修改端口并同步 manifest、入口配置和启动脚本，或在备份后卸载原版。

## 只有打开链接，没有云朵转存按钮

MoviCloud 原版转存流程仅对支持的网盘类型及有效绑定账号显示入口。当前可复用夸克/UC；迅雷、115、123 不能通过单纯显示按钮实现转存。
