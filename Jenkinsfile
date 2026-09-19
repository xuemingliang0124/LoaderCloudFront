pipeline {
    agent any

    environment {
        REGISTRY   = 'registry.cn-beijing.aliyuncs.com/xml066'
        IMAGE_NAME = 'loader-cloud-frontend'
    }

    stages {
        stage('Checkout') {
            steps {
                // 使用 SSH 方式拉取；凭据 github-ssh 需在 Jenkins 中配置
                // （Kind: SSH Username with private key，私钥对应公钥已添加到 GitHub）
                // 注意：该仓库默认分支是 master，不是 main
                git branch: 'master',
                    credentialsId: 'github-ssh',
                    url: 'git@github.com:xuemingliang0124/LoaderCloudFront.git'
            }
        }

        stage('Build & Push') {
            steps {
                // 阿里云镜像仓库凭据（在 Jenkins 中添加 Username with password，ID 设为 aliyun-registry）
                withCredentials([usernamePassword(
                    credentialsId: 'aliyun-registry',
                    usernameVariable: 'REG_USER',
                    passwordVariable: 'REG_PASS'
                )]) {
                    sh '''
                        # 用 git commit short hash 作为镜像版本号，保证每次构建唯一可追溯
                        TAG=$(git rev-parse --short HEAD)
                        FULL_IMAGE="${REGISTRY}/${IMAGE_NAME}:${TAG}"
                        LATEST_IMAGE="${REGISTRY}/${IMAGE_NAME}:latest"

                        # docker login 只接受纯仓库域名，去掉命名空间 /xml066
                        REGISTRY_HOST="${REGISTRY%%/*}"

                        # 登录阿里云镜像仓库（HOME 指向 jenkins 家目录，确保 config.json 可写）
                        export HOME=/var/jenkins_home
                        echo "$REG_USER"
                        echo "$REG_PASS" | docker login --username "$REG_USER" --password-stdin "$REGISTRY_HOST"

                        # 构建镜像，同时打上 commit hash 和 latest 两个标签
                        docker build -t "$FULL_IMAGE" -t "$LATEST_IMAGE" .

                        # 推送到阿里云仓库
                        docker push "$FULL_IMAGE"
                        docker push "$LATEST_IMAGE"

                        # 镜像已推送到仓库，本地不再保留，立即删除刚构建的两个标签
                        docker rmi -f "$FULL_IMAGE" "$LATEST_IMAGE" 2>/dev/null || true

                        # 清理构建过程产生的 dangling 中间层
                        docker image prune -f
                    '''
                }
            }
        }

        stage('Deploy') {
            steps {
                sh '''
                    TAG=$(git rev-parse --short HEAD)

                    # ===== .env 生成策略 =====
                    # .env 已被 gitignore，Jenkins 拉取代码后工作区无 .env，
                    # 因此从仓库内的 .env.example（默认全量配置模板）生成 .env，
                    # 再用 Jenkins 构建参数覆盖需要差异化的项。
                    # 三层优先级：Jenkins 构建参数 > .env.example 默认值 > docker-compose.yml 默认值
                    cp .env.example .env

                    # Jenkins 参数非空时覆盖 .env 中对应配置（未配置则保留 .env.example 默认值）
                    # 后续新增环境配置：在 .env.example 加一行 + Jenkins 按需加同名 String Parameter 即可
                    [ -n "$BACKEND_HOST" ] && sed -i "s/^BACKEND_HOST=.*/BACKEND_HOST=$BACKEND_HOST/" .env
                    [ -n "$BACKEND_PORT" ] && sed -i "s/^BACKEND_PORT=.*/BACKEND_PORT=$BACKEND_PORT/" .env

                    # FRONTEND_TAG 必须用本次构建的 commit hash，强制覆盖
                    sed -i "s/^FRONTEND_TAG=.*/FRONTEND_TAG=$TAG/" .env

                    # 拉取刚推送的镜像并启动（docker compose 自动加载 .env）
                    docker compose -f docker-compose.yml pull frontend
                    # 强制移除同名旧容器（可能是早期手动部署、非本 compose 项目创建的），避免容器名冲突
                    docker rm -f loader-cloud-frontend 2>/dev/null || true
                    docker compose -f docker-compose.yml up -d frontend
                    # 清理所有未被容器使用的镜像（历史构建镜像已上传仓库，无需保留）
                    # 注意：-a 会扫描整个 docker host，正在运行的容器所依赖的镜像不受影响
                    docker image prune -af
                '''
            }
        }

        stage('Health Check') {
            steps {
                sh '''
                    # 前端容器映射的是宿主机 :80，但本脚本在 jenkins 容器内执行，
                    # localhost 指向 jenkins 自身无法访问到 frontend。
                    # 这里直接在 frontend 容器内执行 curl 验证 nginx 服务，不依赖网络。
                    CONTAINER=loader-cloud-frontend
                    for i in 1 2 3 4 5 6 7 8 9 10; do
                      if docker exec "$CONTAINER" curl -sf http://localhost/ >/dev/null 2>&1; then
                        echo "Frontend is up (attempt $i)"
                        exit 0
                      fi
                      echo "Frontend not ready yet, attempt $i/10, retry in 3s..."
                      sleep 3
                    done
                    echo "ERROR: Frontend health check failed after 10 retries"
                    docker logs --tail 30 "$CONTAINER"
                    exit 1
                '''
            }
        }
    }

    post {
        success { echo '部署成功' }
        failure { echo '部署失败' }
    }
}
