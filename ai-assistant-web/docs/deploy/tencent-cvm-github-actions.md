# 使用 GitHub Actions 自动部署到腾讯云 CVM

这份文档面向第一次接触部署流程的人写。你不需要先理解所有 DevOps 术语，只要按顺序做，就能把这个前端项目自动发布到你的腾讯云服务器上。

## 1. 这套方案到底在做什么

这个项目是一个 Vite 静态前端。

注意当前仓库结构：

- 顶层 Git 仓库是 `ai-assistant`
- 真正的前端项目代码在 `ai-assistant-web/` 子目录
- GitHub Actions 工作流必须定义在顶层仓库根目录 `.github/workflows/`

它的部署逻辑不是“把 React 应用在服务器上跑起来”，而是：

1. GitHub Actions 在云端帮你执行 `npm ci`、`npm run lint`、`npm test`、`npm run build`
2. 构建出 `dist/` 静态文件
3. 把 `dist/` 上传到你的腾讯云服务器
4. 让服务器上的 Nginx 容器直接对外提供这些静态文件

这样做的好处是：

- 服务器上不需要安装 Node 来构建前端
- 发布速度快
- 回滚简单
- 对这个 Vite 项目最自然

## 2. 目录结构为什么这样设计

服务器上建议使用下面这套目录：

```bash
/srv/www/ai-assistant/
├─ current                # 当前线上版本，Nginx 实际读取这里
├─ releases/              # 每次发布的独立版本目录
│  ├─ <git-sha-1>/
│  ├─ <git-sha-2>/
│  └─ ...
├─ shared/                # 预留目录，当前静态站点暂时不会用到
└─ tmp/                   # GitHub Actions 上传压缩包和脚本的临时目录
```

核心思路：

- 新版本先解压到 `releases/<git-sha>`
- 校验成功后，再把 `current` 切到这个新版本
- 如果新版本有问题，你只要把 `current` 指回旧目录即可完成回滚

## 3. 第一次准备腾讯云服务器

下面假设你的服务器是 Linux，并且已经装好了 Docker，也已经有一个 Nginx 容器。

### 3.1 创建部署用户

建议不要直接用 `root` 部署，单独创建一个部署用户更安全。

```bash
sudo adduser deploy
```

### 3.2 创建部署目录并授权

```bash
sudo mkdir -p /srv/www/ai-assistant/{releases,shared,tmp}
sudo chown -R deploy:deploy /srv/www/ai-assistant
```

### 3.3 让部署用户可以执行 docker exec

如果你的 Nginx 容器由 Docker 管理，部署用户需要能执行：

```bash
docker exec <你的-nginx-容器名> nginx -s reload
```

通常做法是把部署用户加入 docker 组：

```bash
sudo usermod -aG docker deploy
```

然后重新登录服务器，让权限生效。

### 3.4 准备 SSH 公钥登录

你的 GitHub Actions 会用 SSH 私钥登录服务器，所以服务器上要提前放好对应公钥。

如果本地还没有专门给部署用的密钥，可以先生成一对：

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy"
```

然后把公钥内容追加到服务器上 `deploy` 用户的 `~/.ssh/authorized_keys`：

```bash
mkdir -p ~/.ssh
chmod 700 ~/.ssh
cat >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

把本地生成的 `id_ed25519.pub` 内容粘贴进去。

### 3.5 本地先手动测一次 SSH

在真正接 GitHub Actions 之前，先在你自己的电脑上测试：

```bash
ssh deploy@<你的服务器公网IP>
```

如果这一步都还没通，GitHub Actions 也一定不会成功。

## 4. Nginx 容器应该怎么接这个站点

你当前是“已有 Nginx 容器”，所以推荐方式是：

- 宿主机目录 `/srv/www/ai-assistant/current`
- 挂载到容器里的 `/usr/share/nginx/html`

举例：

```bash
docker run -d \
  --name my-nginx \
  -p 80:80 \
  -v /srv/www/ai-assistant/current:/usr/share/nginx/html:ro \
  -v /etc/nginx/conf.d:/etc/nginx/conf.d:ro \
  nginx:stable
```

如果你的容器已经存在，就只要确认它的站点根确实挂载到了 `current`。

## 5. SPA 必备的 Nginx 配置

因为这是前端单页应用，刷新如 `/chat`、`/settings` 这类路径时，Nginx 需要回退到 `index.html`。

建议配置片段如下：

```nginx
server {
    listen 80;
    server_name _;

    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|svg|ico|woff2?)$ {
        expires 7d;
        add_header Cache-Control "public, max-age=604800, immutable";
        try_files $uri =404;
    }
}
```

改完配置后，记得 reload Nginx：

```bash
docker exec <你的-nginx-容器名> nginx -s reload
```

## 6. GitHub 里要配置哪些 Secrets

进入你的 GitHub 仓库：

`Settings -> Secrets and variables -> Actions -> New repository secret`

然后按下表配置：

| Secret 名称 | 含义 | 示例 |
| --- | --- | --- |
| `TENCENT_HOST` | 服务器公网 IP 或域名 | `43.x.x.x` |
| `TENCENT_PORT` | SSH 端口 | `22` |
| `TENCENT_USER` | 部署用户 | `deploy` |
| `TENCENT_SSH_KEY` | 私钥全文 | `-----BEGIN OPENSSH PRIVATE KEY----- ...` |
| `DEPLOY_PATH` | 服务器部署根目录 | `/srv/www/ai-assistant` |
| `NGINX_CONTAINER_NAME` | 现有 Nginx 容器名 | `my-nginx` |
| `KEEP_RELEASES` | 保留多少个历史版本，可选 | `5` |

注意：

- `TENCENT_SSH_KEY` 要填私钥内容，不是公钥
- 私钥通常是 `id_ed25519` 文件内容
- 不要在私钥前后额外加空格

## 7. 这次仓库里新增了什么

本仓库已经准备好：

- GitHub Actions 工作流：顶层仓库 `.github/workflows/deploy.yml`
- 远程发布脚本：`ai-assistant-web/scripts/deploy/remote-release.sh`

工作流的行为是：

1. push 到 `main`
2. 进入 `ai-assistant-web/` 子目录自动安装依赖
3. 在 `ai-assistant-web/` 子目录自动 lint
4. 在 `ai-assistant-web/` 子目录自动 test
5. 在 `ai-assistant-web/` 子目录自动 build
6. 上传 `dist`
7. 远程切换 `current`
8. reload Nginx 容器

## 8. 第一次发布怎么做

### 8.1 先确认服务器三件事

先在服务器上人工验证：

```bash
ssh deploy@<服务器IP>
ls -la /srv/www/ai-assistant
docker exec <你的-nginx-容器名> nginx -s reload
```

如果这三步都没问题，再进行下一步。

### 8.2 推一条 main 分支提交

只要向 `main` push 一次提交，GitHub Actions 就会自动触发。

### 8.3 在 GitHub 上看执行日志

进入：

`Actions -> Deploy To Tencent CVM -> 最新一次运行`

你应该能看到这些阶段：

- Checkout repository
- Setup Node.js
- Install dependencies
- Run lint
- Run tests
- Build project
- Archive dist
- Prepare SSH client
- Prepare remote directories
- Upload artifact and deploy script
- Execute remote release script

### 8.4 发布成功后验证

发布成功后，检查：

```bash
ssh deploy@<服务器IP>
ls -la /srv/www/ai-assistant/releases
ls -la /srv/www/ai-assistant/current
```

然后浏览器访问你的域名或服务器 IP，确认页面正常打开。

## 9. 怎么手动回滚

如果新版本上线后有问题，可以手动把 `current` 指回上一个 release。

先查看历史版本：

```bash
ls -lt /srv/www/ai-assistant/releases
```

假设你想回滚到某个旧版本：

```bash
ln -sfn /srv/www/ai-assistant/releases/<旧版本SHA> /srv/www/ai-assistant/current
docker exec <你的-nginx-容器名> nginx -s reload
```

这样就会立即切回旧版本。

## 10. 常见排查命令

### 10.1 检查 SSH 是否能登录

```bash
ssh -p 22 deploy@<服务器IP>
```

### 10.2 检查 current 指向了谁

```bash
readlink -f /srv/www/ai-assistant/current
```

### 10.3 检查 Nginx 容器是否还活着

```bash
docker ps
```

### 10.4 查看 Nginx 容器日志

```bash
docker logs <你的-nginx-容器名> --tail 100
```

### 10.5 查看服务器上的站点文件

```bash
find /srv/www/ai-assistant/current -maxdepth 2 -type f | head
```

## 11. 常见错误与解释

### 11.1 GitHub Actions 报 SSH 连接失败

通常是下面几种原因：

- `TENCENT_HOST` 写错
- `TENCENT_PORT` 写错
- `TENCENT_USER` 不存在
- 私钥不匹配
- 服务器安全组没放行 SSH 端口

### 11.2 上传成功但页面打不开

优先检查：

- `current` 是否真的指向了新 release
- Nginx 容器挂载的是不是 `/srv/www/ai-assistant/current`
- Nginx 配置有没有 `try_files $uri $uri/ /index.html;`

### 11.3 刷新子路由返回 404

这几乎总是因为没有配 SPA 回退：

```nginx
try_files $uri $uri/ /index.html;
```

### 11.4 docker exec 执行失败

通常说明部署用户没有权限执行 Docker。确认：

```bash
groups deploy
```

看输出里是否包含 `docker`。

## 12. 建议你上线前最后再做一次人工确认

在真正依赖自动发布前，建议你至少手动确认一次：

1. 本地能正常 `npm run build`
2. 服务器能正常 SSH 登录
3. 部署用户能正常 `docker exec <容器名> nginx -s reload`
4. Nginx 已经指向 `/srv/www/ai-assistant/current`
5. GitHub Secrets 已经全部填好

做到这五步，首次自动部署一般就会比较顺。
