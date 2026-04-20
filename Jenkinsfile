pipeline {
    agent any

    options {
        timestamps()
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '20'))
    }

    parameters {
        booleanParam(name: 'SKIP_TESTS', defaultValue: true, description: 'Skip npm test during deployment')
        string(name: 'APP_NAME', defaultValue: 'mail-automation', description: 'Process name used by PM2')
        string(name: 'APP_PORT', defaultValue: '3345', description: 'Port used by health check endpoint')
        string(name: 'APP_BASE_URL', defaultValue: 'http://localhost:3345', description: 'Public base URL used in webhook payloads')
        string(name: 'N8N_RESUME_DRIVE_WEBHOOK_URL', defaultValue: '', description: 'Optional resume-drive webhook URL')
    }

    environment {
        NODE_ENV = 'production'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Verify Toolchain') {
            steps {
                sh 'node -v'
                sh 'npm -v'
            }
        }

        stage('Install Dependencies') {
            steps {
                sh 'npm ci'
            }
        }

        stage('Prepare Runtime Environment') {
            steps {
                withCredentials([
                    string(credentialsId: 'placement-session-secret', variable: 'SESSION_SECRET'),
                    string(credentialsId: 'placement-mongodb-uri', variable: 'MONGODB_URI'),
                    string(credentialsId: 'placement-n8n-webhook-secret', variable: 'N8N_WEBHOOK_SECRET'),
                    string(credentialsId: 'placement-n8n-job-application-url', variable: 'N8N_JOB_APPLICATION_WEBHOOK_URL')
                ]) {
                    sh '''
                        set -e
                        cat > .env <<EOF
PORT=${APP_PORT}
NODE_ENV=production
SESSION_SECRET=${SESSION_SECRET}
MONGODB_URI=${MONGODB_URI}
N8N_WEBHOOK_SECRET=${N8N_WEBHOOK_SECRET}
N8N_JOB_APPLICATION_WEBHOOK_URL=${N8N_JOB_APPLICATION_WEBHOOK_URL}
N8N_RESUME_DRIVE_WEBHOOK_URL=${N8N_RESUME_DRIVE_WEBHOOK_URL}
APP_BASE_URL=${APP_BASE_URL}
EOF
                    '''
                }
            }
        }

        stage('Run Tests') {
            when {
                expression { return !params.SKIP_TESTS }
            }
            steps {
                sh 'npm test'
            }
        }

        stage('Restart Application') {
            steps {
                sh '''
                    set -e

                    if command -v pm2 >/dev/null 2>&1; then
                      echo "PM2 found. Restarting managed process..."
                      if pm2 describe "${APP_NAME}" >/dev/null 2>&1; then
                        pm2 restart "${APP_NAME}" --update-env
                      else
                        pm2 start npm --name "${APP_NAME}" -- start
                      fi
                      pm2 save
                    else
                      echo "PM2 not found. Using fallback background start."
                      pkill -f "node server/server.js" || true
                      nohup npm start > app.log 2>&1 &
                    fi
                '''
            }
        }

        stage('Health Check') {
            steps {
                sh '''
                    set -e
                                        for i in $(seq 1 20); do
                                            if curl -fsS "http://127.0.0.1:${APP_PORT}/" >/dev/null; then
                                                echo "Health check passed on attempt $i"
                                                exit 0
                                            fi
                                            echo "Waiting for app startup... attempt $i/20"
                                            sleep 3
                                        done

                                        echo "Health check failed after retries"
                                        if command -v pm2 >/dev/null 2>&1; then
                                            pm2 list || true
                                            pm2 logs "${APP_NAME}" --lines 100 --nostream || true
                                        fi
                                        test -f app.log && tail -n 100 app.log || true
                                        exit 1
                '''
            }
        }
    }

    post {
        success {
            echo 'Deployment completed successfully.'
        }
        failure {
            echo 'Pipeline failed. Check stage logs for details.'
        }
        always {
            sh 'if command -v pm2 >/dev/null 2>&1; then pm2 list; fi'
            archiveArtifacts artifacts: 'app.log', allowEmptyArchive: true
        }
    }
}
