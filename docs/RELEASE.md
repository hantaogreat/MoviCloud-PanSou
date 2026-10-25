# 准备 GitHub Release（私有仓库）

已在用户的飞牛设备生成 FPK，且 GitHub **v1.0.6-pansou.1 Pre-release 已发布**，FPK 二进制已上传。当前仓库仍为 **Private**；公开分发须先核对 MoviCloud 源码授权、Node.js 随包许可及个人数据安全。

## 1. 检查本地最终安装包

```bash
FPK=/vol1/1000/Docker/movicloud-build/movicloud-pansou/movicloud-pansou.fpk
ls -lh "$FPK"
sha256sum "$FPK"
```

保存输出的 SHA-256，供未来 Release 校验。不要将 Cookie、Token、数据库、账号配置或硬编码的个人 NAS 地址打进公开包。项目目前的 `cmd/main` 曾使用本机 PanSou 地址 `127.0.0.1:8088`，仅适用于 PanSou 与 FPK 同宿主机的部署形态；其他部署需配置可达地址。

## 2. 私有仓库中进行内部测试

在 GitHub 仓库的 Releases 页面建立 Draft：
- Tag（建议）：`v1.0.6-pansou.1`
- Title：`MoviCloud PanSou v1.0.6 测试版`
- 上传已核对的 `movicloud-pansou.fpk`
- 附上 `RELEASE-NOTES-TEMPLATE.md` 中的已验证功能与限制
- 不要勾选自动公开仓库；Release 可见性受仓库权限限制

**用户已通过 GitHub 网页创建 Pre-release 并上传 FPK。** 仓库仍为 Private。当前 Release 正文仅有指向模板的占位文字，应通过 GitHub 的 Edit release 替换成正式说明。

## 3. 公开之前

- 审阅原项目许可证、Notice、README 附加限制与上游授权范围
- 检查 FPK 和 Git 历史是否存在敏感信息
- 验证在干净的 fnOS 设备上可安装、登录、搜索、转存、卸载和备份恢复
- 比较 `useMoviCloudAPI.ts` 中的 `CLIENT_VERSION` 与 v1.0.6 的一致性
- 根据测试结果完善完整的安装截图和已知限制
- 由仓库拥有者明确决定是否将 Private 改成 Public

致谢：[MoviCloud](https://github.com/MoviCloud-com/movicloud-app) / [PanSou](https://github.com/fish2018/pansou)。

## 本次 fnOS 本地构建与功能验收记录

- 目标版本：`v1.0.6-pansou.1`（发行命名建议，并非已发布 Tag）
- FPK 文件：`movicloud-pansou.fpk`
- `fnpack build` 输出：`Packing successfully`
- SHA-256：`70cb447febd48f3bbb64629314ae24f55dd18cd95746476d2f9d9d27b2c6063c`
- 来源：用户在 fnOS NAS 上执行编译和打包后提供的终端输出；助手尚未取得该二进制做独立校验
- 状态：**本地构建完成；用户确认 8/8 项安装与功能回归测试通过；GitHub Pre-release 已由用户发布**

安装/升级、15079 端口、初始化或数据加载、电影搜索、电视剧搜索、夸克转存、UC 转存和重启后的功能测试均已通过（用户实测反馈）。上线前仍建议对准备上传的 FPK 附件重新计算 SHA-256，确认与本记录一致。此测试结果不等于跨设备或安全审计通过。

## GitHub Release 实际核验

- Release：[v1.0.6-pansou.1](https://github.com/hantaogreat/MoviCloud-PanSou/releases/tag/v1.0.6-pansou.1)
- `draft=false`，`prerelease=true`；仓库 `Private`
- 附件 `movicloud-pansou.fpk`：上传完成，文件大小 138089982 字节
- GitHub 记录的附件 digest：`sha256:70cb447febd48f3bbb64629314ae24f55dd18cd95746476d2f9d9d27b2c6063c`，与 NAS 记录一致
- Release 网页 Description 仍为 `使用仓库中的 RELEASE-NOTES-TEMPLATE.md`，需编辑成完整发行说明
