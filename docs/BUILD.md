# 从源码构建 fnOS FPK

工作目录示例：`/vol1/1000/Docker/movicloud-build`。不要直接改动已安装应用的 `@appcenter` 目录。

## 1. 准备代码

下载 [MoviCloud v1.0.6](https://github.com/MoviCloud-com/movicloud-app/releases/tag/v1.0.6) 的原始源码，复制为独立工作树；对照差异集成已核对的 PanSou 适配代码：`composables/useMoviCloudAPI.ts`、`pages/[type]/[id].vue` 和 `server/api/pansou/search.post.ts`。**本仓库已提交三个核心融合文件**。可使用下面的脚本将它们复制到干净的 MoviCloud v1.0.6 工作树中。注意仓库不是完整上游源码，且脚本会覆盖目标工作树的两个上游文件。

执行示例（将仓库与上游源代码放在相邻目录）：

```bash
cd /vol1/1000/Docker/movicloud-build
bash MoviCloud-PanSou/scripts/apply-to-movicloud-1.0.6.sh movicloud-app-1.0.6
```

脚本检查 `package.json` 为 1.0.6，自动备份两个被覆盖的源码文件；**建议先复制一份官方源码作为工作树**，不要在原始目录直接打补丁。完成后检查差异，并确认个人网盘管理及 `SaveShareDialog.vue`、`useCloudFileManagement.ts` 等原有逻辑未受影响。

版本一致性：已核对 MoviCloud 官方 v1.0.6 源码，并把本仓库 `CLIENT_VERSION` 修正为 `1.0.6`。**在此修复前生成的 FPK 不包含该更改，需要重新编译与打包。**

## 2. Docker 编译

```bash
cd /vol1/1000/Docker/movicloud-build/movicloud-pansou-1.0.6
sudo docker run -d --name movicloud-build \
  -v "$PWD:/app" -w /app node:22-bookworm \
  sh -c 'set -e; npm install --no-audit --no-fund; npm run build:fnOS'
sudo docker logs -f movicloud-build
sudo docker inspect movicloud-build --format '{{.State.Status}} {{.State.ExitCode}}'
ls -lh dist/fnOS/server/index.mjs
```

如已有同名容器，确认已退出后再清理；网络断线不会中止 `-d` 方式的构建。原项目锁文件曾与依赖不一致，`npm ci` 返回 EUSAGE，改用 `npm install` 成功；务必审查更新后的 lockfile。fnOS 构建输出在 `dist/fnOS`，而非 `.output`。

## 3. 准备 FPK 工程

```bash
cd /vol1/1000/Docker/movicloud-build
fnpack create movicloud-pansou
mkdir -p movicloud-pansou/app/runtime movicloud-pansou/app/bin
cp -a movicloud-pansou-1.0.6/dist/fnOS movicloud-pansou/app/runtime/fnOS
```

上述 `fnpack create` 仅第一次使用。须把 Node.js 22 可执行文件放到 `app/bin/node`，在 NAS **宿主机**检查 `node -v`、`ldd node`。例如可以临时 `docker create` 一个 `node:22-bookworm` 容器并用 `docker cp` 提取运行文件；注意动态库兼容和后续安全更新。

必须人工配置：`manifest` 的独立 appname / service_port、`app/ui/config` 的入口端口、`cmd/main` 的 start/stop/status、`config/privilege` 及持久化数据目录。运行环境需设置 `PANSOU_API_URL` 和 `MOV_DATA_DIR="${TRIM_PKGVAR}/data"`。不要把登录凭证或 API Token 固化到 FPK 或仓库里。

## 4. 打包

```bash
cd /vol1/1000/Docker/movicloud-build/movicloud-pansou
bash -n cmd/main
fnpack build
ls -lh movicloud-pansou.fpk
```

`Packing successfully` 只说明格式打包成功；还需在 fnOS 中验证独立安装、首次初始化、登录、电影/电视剧搜索、夸克/UC 转存与卸载数据行为。
