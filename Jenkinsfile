// ======================================================
// Pipeline CI/CD - SouverainRecrut
// Déclenché à chaque commit (scan du job multibranche ou webhook GitHub)
//
//  1. Checkout          : récupération du code + calcul du tag d'image
//  2. CI                : install / build / tests backend et lint / build frontend (en parallèle)
//  3. Docker Build      : construction des images backend et frontend
//  4. Push Docker Hub   : publication des images (tag <branche>-<sha>, + "latest" sur main)
//  5. Deploy            : (main uniquement) déploiement via Docker Compose + smoke test
// ======================================================
pipeline {
    agent any

    options {
        timestamps()
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '10'))
        timeout(time: 30, unit: 'MINUTES')
    }

    environment {
        DOCKERHUB_CREDENTIALS = 'dockerhub-credentials'
        BACKEND_IMAGE_NAME    = 'souverainrecrut-backend'
        FRONTEND_IMAGE_NAME   = 'souverainrecrut-frontend'
        // URL de l'API vue par le navigateur, injectée dans le build Vite
        VITE_API_URL          = 'http://localhost:4000/v1'
        // Configuration Docker isolée par build (évite de laisser le login dans JENKINS_HOME)
        DOCKER_CONFIG         = "${WORKSPACE}/.docker"
    }

    stages {

        stage('Checkout') {
            steps {
                checkout scm
                script {
                    def branch = (env.BRANCH_NAME ?: 'main').replaceAll('[^a-zA-Z0-9_.-]', '-')
                    env.GIT_SHORT = sh(script: 'git rev-parse --short HEAD', returnStdout: true).trim()
                    env.IMAGE_TAG = "${branch}-${env.GIT_SHORT}"

                    withCredentials([usernamePassword(credentialsId: env.DOCKERHUB_CREDENTIALS,
                                                      usernameVariable: 'DH_USER',
                                                      passwordVariable: 'DH_TOKEN')]) {
                        env.BACKEND_IMAGE  = "${DH_USER}/${env.BACKEND_IMAGE_NAME}"
                        env.FRONTEND_IMAGE = "${DH_USER}/${env.FRONTEND_IMAGE_NAME}"
                    }
                }
                echo "Images : ${env.BACKEND_IMAGE}:${env.IMAGE_TAG} / ${env.FRONTEND_IMAGE}:${env.IMAGE_TAG}"
            }
        }

        stage('CI') {
            parallel {
                stage('Backend') {
                    steps {
                        dir('backend') {
                            sh 'npm ci --no-audit --no-fund'
                            sh 'npx prisma generate'
                            sh 'npm run build'
                            sh 'npm test'
                        }
                    }
                }
                stage('Frontend') {
                    steps {
                        dir('frontend') {
                            sh 'npm ci --no-audit --no-fund'
                            // Le lint signale les problèmes de qualité sans bloquer la livraison (build UNSTABLE)
                            catchError(buildResult: 'UNSTABLE', stageResult: 'UNSTABLE') {
                                sh 'npm run lint'
                            }
                            sh 'npm run build'
                        }
                    }
                }
            }
        }

        stage('Docker Build') {
            steps {
                sh '''
                    docker build -t "$BACKEND_IMAGE:$IMAGE_TAG" backend
                    docker build --build-arg VITE_API_URL="$VITE_API_URL" \
                                 -t "$FRONTEND_IMAGE:$IMAGE_TAG" frontend
                '''
            }
        }

        stage('Push Docker Hub') {
            steps {
                withCredentials([usernamePassword(credentialsId: env.DOCKERHUB_CREDENTIALS,
                                                  usernameVariable: 'DH_USER',
                                                  passwordVariable: 'DH_TOKEN')]) {
                    sh 'echo "$DH_TOKEN" | docker login -u "$DH_USER" --password-stdin'
                }
                sh '''
                    docker push "$BACKEND_IMAGE:$IMAGE_TAG"
                    docker push "$FRONTEND_IMAGE:$IMAGE_TAG"
                '''
                script {
                    if (env.BRANCH_NAME == 'main') {
                        sh '''
                            docker tag "$BACKEND_IMAGE:$IMAGE_TAG"  "$BACKEND_IMAGE:latest"
                            docker tag "$FRONTEND_IMAGE:$IMAGE_TAG" "$FRONTEND_IMAGE:latest"
                            docker push "$BACKEND_IMAGE:latest"
                            docker push "$FRONTEND_IMAGE:latest"
                        '''
                    }
                }
            }
            post {
                always {
                    sh 'docker logout || true'
                }
            }
        }

        stage('Deploy') {
            when {
                branch 'main'
            }
            steps {
                sh '''
                    docker compose -p souverainrecrut -f deploy/docker-compose.yml pull
                    docker compose -p souverainrecrut -f deploy/docker-compose.yml up -d --remove-orphans
                '''
                // Smoke test : l'API doit répondre sur /v1/health
                sh '''
                    for i in $(seq 1 20); do
                        if docker compose -p souverainrecrut -f deploy/docker-compose.yml exec -T backend \
                             wget -qO- http://localhost:4000/v1/health; then
                            echo ""; echo "Smoke test OK"; exit 0
                        fi
                        sleep 3
                    done
                    echo "Smoke test KO"
                    docker compose -p souverainrecrut -f deploy/docker-compose.yml logs backend
                    exit 1
                '''
            }
        }
    }

    post {
        always {
            // Supprime les images locales du build pour ne pas saturer le disque
            sh '''
                docker rmi "$BACKEND_IMAGE:$IMAGE_TAG" "$FRONTEND_IMAGE:$IMAGE_TAG" 2>/dev/null || true
                docker image prune -f || true
            '''
            cleanWs()
        }
        success {
            echo "Pipeline OK : ${env.BACKEND_IMAGE}:${env.IMAGE_TAG} et ${env.FRONTEND_IMAGE}:${env.IMAGE_TAG} publiées sur Docker Hub"
        }
        unstable {
            echo 'Pipeline UNSTABLE : images publiées, mais le lint frontend a remonté des erreurs'
        }
        failure {
            echo 'Pipeline en échec : consulter les logs de l\'étape en rouge'
        }
    }
}
