# 准备 GitHub Release（私有仓库）

当前仓库**尚未发布 Release**。已在用户的飞牛设备生成过可安装 FPK，但其二进制尚未上传仓库；公开分发须先核对 MoviCloud 源码授权、Node.js 随包许可及个人数据安全。

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

**本仓库目前并未由助手创建 Release 或上传 FPK**；请勿把草稿说明视为现成下载文件。

## 3. 公开之前

- 审阅原项目许可证、Notice、README 附加限制与上游授权范围
- 检查 FPK 和 Git 历史是否存在敏感信息
- 验证在干净的 fnOS 设备上可安装、登录、搜索、转存、卸载和备份恢复
- 比较 `useMoviCloudAPI.ts` 中的 `CLIENT_VERSION` 与 v1.0.6 的一致性
- 根据测试结果完善完整的安装截图和已知限制
- 由仓库拥有者明确决定是否将 Private 改成 Public

致谢：[MoviCloud](https://github.com/MoviCloud-com/movicloud-app) / [PanSou](https://github.com/fish2018/pansou)。

## 本次 fnOS 本地构建记录（待安装验证）

- 目标版本：`v1.0.6-pansou.1`（发行命名建议，并非已发布 Tag）
- FPK 文件：`movicloud-pansou.fpk`
- `fnpack build` 输出：`Packing successfully`
- SHA-256：`70cb447febd48f3bbb64629314ae24f55dd18cd95746476d2f9d9d27b2c6063c`
- 来源：用户在 fnOS NAS 上执行编译和打包后提供的终端输出；助手尚未取得该二进制做独立校验
- 状态：**本地构建完成；新版安装、实际搜索与转存回归测试待做；GitHub Release 尚未创建**

安装测试之前建议另存当前正常运行版本的 FPK；如果安装工具是覆盖升级，应先备份应用数据并确认是否支持回滚。待升级测试通过后，再核对安装包 SHA-256 与本记录相同。
