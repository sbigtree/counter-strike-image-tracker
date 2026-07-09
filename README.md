<h1 align="center">Counter-Strike Image Tracker</h1>

## Fetching Images

To get images, fetch the JSON file:

```bash
https://raw.githubusercontent.com/ByMykel/counter-strike-image-tracker/refs/heads/main/static/images.json
```

The JSON structure contains the `image_inventory` as the key and the official CDN image URL as the value:

```json
{
    "econ/stickers/cologne2014/titan_foil_1355_37": "https://cdn.steamstatic.com/apps/730/icons/econ/stickers/cologne2014/titan_foil_1355_37.3dbb3370f9e2351f2d025f4c50c08e8ae3285b20.png",
    "econ/stickers/cologne2014/titan_holo": "https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGJai0ki7VeTHjMmuOXSQ61MnpNagpU3uVRz_oZ7v8S0VuqX3PvE_eKKXXGaSxLgn5rhvFnC1lEsk4m7Tz4v9dXnEbFB2DMR3TflK7Ecql-bHIw",
    "econ/stickers/cologne2014/titan_holo_1355_37": "https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGJai0ki7VeTHjMmuOXSQ61MnpNagpU3uVRz_oZ7v8S1kvqH7PZs-d77GWmbAmOp3sbdrTSixwht04ziAwt6qcnyfPFUgXMN5QOMC4xG-k4e1Kaq8sFG6vUcn",
    "econ/stickers/cologne2014/virtuspro": "https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGJai0ki7VeTHjMmuOXSQ61MnpNagpU_uUwnkjYby8mxZuaqqPadvc6GXWjHEkbsltLZrFi-3xEp0sG3Um434dC_GbwIjCcFxW6dU5ZvHl6hL",
    "econ/stickers/cologne2014/virtuspro_1355_37": "https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGJai0ki7VeTHjMmuOXSQ61MnpNagpU_uUwnkjYby8h0KvKf7V_c6bqnHVzSVxb8isbBsGHHhlE5ysGnVwov6IniRbQAjWJN3E7MM4USxw4D5d7S1J6z3NXU",
    "econ/stickers/cologne2014/virtuspro_foil": "https://cdn.steamstatic.com/apps/730/icons/econ/stickers/cologne2014/virtuspro_foil.a82440c1d4aa3c55dd3b894e117793d8e696e63c.png",
    ...
}
```

docker compose up --build

## Fork 仓库 Actions 配置

本仓库的部分 workflow 会在图片数据更新后通过 `repository_dispatch` 通知 CSGO-API 仓库刷新数据。Fork 仓库默认没有上游仓库权限，因此未配置 `PAT_TOKEN` 时 workflow 会跳过该通知步骤，避免因为 GitHub CLI 缺少 `GH_TOKEN` 导致任务失败。

如果需要在 fork 中继续触发 CSGO-API 更新，请在 GitHub 仓库设置中添加：

| 配置名称              | 配置类型   | 当前说明                                                                               |
| --------------------- | ---------- | -------------------------------------------------------------------------------------- |
| `USERNAME`            | Secret     | Steam 登录账号，用于下载 CS2 游戏文件                                                  |
| `PASSWORD`            | Secret     | Steam 登录密码，用于下载 CS2 游戏文件                                                  |
| `SHARED_SECRET`       | Secret     | Steam 两步验证 shared secret；为空时按普通登录流程处理                                 |
| `PAT_TOKEN`           | Secret     | 用于调用目标仓库 `repository_dispatch` 的 GitHub Personal Access Token，需要目标仓库权限 |
| `CSGO_API_REPOSITORY` | Variable   | 可选，目标仓库名称，格式为 `owner/repo`；未配置时默认使用 `ByMykel/CSGO-API`            |

如果只是让 fork 自己下载和提交图片文件，不需要配置以上两项。
