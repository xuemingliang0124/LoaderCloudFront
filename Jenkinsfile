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
                git branch: 'main',
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

                        # 登录阿里云镜像仓库
                        echo "$REG_PASS" | docker login --username "$REG_USER" --password-stdin ${REGISTRY}

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
                    sleep 3
                    curl -sf http://localhost/ || exit 1
                    echo "Frontend is up"
                '''
            }
        }
    }

    post {
        success { echo '部署成功' }
        failure { echo '部署失败' }
    }
}
