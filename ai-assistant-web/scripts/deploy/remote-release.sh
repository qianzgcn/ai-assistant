#!/usr/bin/env bash

# 开启严格模式：
# -E: 让 ERR trap 在函数和子 shell 中也能传播
# -e: 任意命令失败就立即退出
# -u: 使用未定义变量时直接报错
# -o pipefail: 管道中任一命令失败都视为失败
set -Eeuo pipefail

# 统一日志输出格式，方便在 GitHub Actions 日志里快速定位阶段。
log() {
  printf '[deploy] %s\n' "$1"
}

# 任何未处理错误都会落到这里，帮助新手更快知道“是在哪一步挂的”。
on_error() {
  local line_number="$1"
  log "部署失败，出错位置在脚本第 ${line_number} 行。"
}

trap 'on_error "${LINENO}"' ERR

# 读取必需环境变量。这里用 : "${VAR:?message}" 的写法，
# 如果变量没有传进来，会直接报出更明确的错误原因。
: "${DEPLOY_PATH:?DEPLOY_PATH 未设置}"
: "${RELEASE_NAME:?RELEASE_NAME 未设置}"
: "${ARCHIVE_NAME:?ARCHIVE_NAME 未设置}"
: "${NGINX_CONTAINER_NAME:?NGINX_CONTAINER_NAME 未设置}"
: "${KEEP_RELEASES:=5}"

# 约定好的目录结构：
# releases: 每次发布的独立版本目录
# shared:   预留给未来共享文件使用，这个静态站点当前不会写入这里
# tmp:      GitHub Actions 上传压缩包和脚本的临时目录
# current:  Nginx 实际对外提供服务的当前版本软链接
RELEASES_DIR="${DEPLOY_PATH}/releases"
SHARED_DIR="${DEPLOY_PATH}/shared"
TMP_DIR="${DEPLOY_PATH}/tmp"
CURRENT_LINK="${DEPLOY_PATH}/current"
RELEASE_DIR="${RELEASES_DIR}/${RELEASE_NAME}"
ARCHIVE_PATH="${TMP_DIR}/${ARCHIVE_NAME}"

log "开始准备部署目录。"
mkdir -p "${RELEASES_DIR}" "${SHARED_DIR}" "${TMP_DIR}"

# 每次发布都使用全新的 release 目录。
# 如果同一个 SHA 的目录已经存在，先删除，避免混入上一次的残留文件。
log "开始准备本次 release 目录：${RELEASE_DIR}"
rm -rf "${RELEASE_DIR}"
mkdir -p "${RELEASE_DIR}"

# 确认构建产物压缩包已经上传到服务器。
if [[ ! -f "${ARCHIVE_PATH}" ]]; then
  log "未找到构建产物压缩包：${ARCHIVE_PATH}"
  exit 1
fi

# 解压 dist 产物到本次 release 目录。
# 注意：压缩包里存放的是 dist 目录内部内容，而不是 dist 目录本身。
log "开始解压构建产物到 release 目录。"
tar -xzf "${ARCHIVE_PATH}" -C "${RELEASE_DIR}"

# 发布前强制校验 index.html。
# 这是最基本的“这是个可访问前端站点”的信号，如果没有它就绝不切换 current。
if [[ ! -f "${RELEASE_DIR}/index.html" ]]; then
  log "release 目录中缺少 index.html，停止切换 current。"
  exit 1
fi

# 使用 ln -sfn 原子更新软链接。
# 这样 Nginx 始终指向一个完整目录，不会出现“先删旧目录再传新目录”的空窗期。
log "开始切换 current 软链接到新版本。"
ln -sfn "${RELEASE_DIR}" "${CURRENT_LINK}"

# reload 现有 Nginx 容器，让它重新读取 current 指向的内容。
# 这里不重建容器，适合已经存在的线上 Nginx。
log "开始 reload Nginx 容器：${NGINX_CONTAINER_NAME}"
docker exec "${NGINX_CONTAINER_NAME}" nginx -s reload

# 发布成功后删除临时压缩包，避免 tmp 目录越来越大。
log "清理临时压缩包。"
rm -f "${ARCHIVE_PATH}"

# 只保留最近 KEEP_RELEASES 个版本，旧版本自动删除。
# 这里用时间倒序排序，确保最新版本排在前面。
log "开始清理旧版本，只保留最近 ${KEEP_RELEASES} 个 release。"
mapfile -t OLD_RELEASES < <(find "${RELEASES_DIR}" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' | sort -rn | awk "NR>${KEEP_RELEASES} {print \$2}")

if [[ "${#OLD_RELEASES[@]}" -gt 0 ]]; then
  for old_release in "${OLD_RELEASES[@]}"; do
    log "删除旧 release：${old_release}"
    rm -rf "${old_release}"
  done
fi

log "部署完成，当前版本为 ${RELEASE_NAME}。"
