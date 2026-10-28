> V1.1 已将下述同步验证改为后台任务，接口返回任务状态并逐批发布有效结果；当前行为与升级要求见 [V1.1](V1.1.md)。以下保留为历史说明。

# 搜索结果精简、有效链接过滤与 fnOS 原位升级（待实机验证）

## 1. 搜索列表
搜索结果卡片只显示网盘名称、**文件大小**和操作按钮，不再显示原始文件名、评分、分辨率及音视频编码。文件大小可能来自标题推断或选中分享目录文件后的回填；没有数据则显示“未知”，不能当作已实际探测。

## 2. 链接有效性
PanSou 新增了 `POST /api/check/links` 接口。融合接口将搜索结果按每批最多 40 条提交检测，只保留 `state=ok` 的结果。

- `bad`、`locked`、`uncertain`、`unsupported` 暂不显示，以严格满足“只展示确认为有效的链接”。
- 如果 PanSou 当前镜像没有此接口或检测服务无法访问，融合搜索会返回 503，而不是未经验证地显示全部结果。
- 对于需要提取码或风控验证的链接，可能发生误排除。链接状态是检测时的快照，不能保证后来一定可访问。
- 建议先在 NAS 上检查 PanSou 版本与接口是否存在：

```bash
curl -i --max-time 25 -H 'Content-Type: application/json' \
  -d '{"items":[{"disk_type":"quark","url":"https://pan.quark.cn/s/EXAMPLE_INVALID_ID"}]}' \
  http://127.0.0.1:8088/api/check/links
```

`EXAMPLE_INVALID_ID` 是故意的占位地址，只用于确认接口有无。若启用了 PanSou API 鉴权，请在本机安全地加上对应凭证，不要将凭证贴到聊天或代码仓库。

## 3. fnOS 原位升级

fnOS 判断本地安装包升级的关键是 **相同的 manifest appname + 更高的 manifest version**。保留当前 `appname=movicloud-pansou`、服务端口及数据目录 `MOV_DATA_DIR`，不要靠改 appname 制作新版本。

查看旧版 FPK 工程版本：

```bash
cd /vol1/1000/Docker/movicloud-build
grep -E '^(appname|version|service_port)[[:space:]]*=' movicloud-pansou-v3-fpk/manifest
```

在**新的独立 FPK 工程副本**中构建，第三个参数指定高于本机已安装版本的版本号，示例（必须按真实版本调整）：

```bash
bash MoviCloud-PanSou/scripts/pack-fnos.sh \
  movicloud-pansou-v4 \
  movicloud-pansou-v4-fpk \
  1.0.7
```

脚本只校验其工程原 manifest 的版本，并不能读取 NAS 当前安装版本；安装前需自行检查目标版本是否大于 **已安装应用版本**。

升级之前先备份 `/vol1/@appdata/movicloud-pansou` 中持久化数据（目录是否存在及内容需先检查），以及旧 FPK。**不要先卸载旧版本。** 通过 fnOS 应用中心的“手动安装”选择新 FPK，确认界面是升级而非新应用安装或卸载。升级保留数据仍必须实机验证。

如果 fnOS 提示不允许覆盖升级、要删除现有安装、版本相同或版本较低，应停止操作，先核实旧包和新包的 manifest；不要为了继续安装删除正在使用的应用。

本轮改动**仅提交源码和构建脚本**，未构建、未安装、未上传新 FPK，GitHub 既有 Release 保持不变。
