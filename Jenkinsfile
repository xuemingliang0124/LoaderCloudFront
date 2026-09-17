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

                        # 清理 dangling 镜像
                        docker image prune -f
                    '''
                }
            }
        }

        stage('Deploy') {
            steps {
                sh '''
                    TAG=$(git rev-parse --short HEAD)
                    # 拉取刚推送的镜像并启动（FRONTEND_TAG 覆盖 compose 里的默认 latest）
                    FRONTEND_TAG="$TAG" docker compose -f docker-compose.yml pull frontend
                    FRONTEND_TAG="$TAG" docker compose -f docker-compose.yml up -d frontend
                    # 清理旧镜像
                    docker image prune -f
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
