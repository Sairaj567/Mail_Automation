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
                    sleep 5
                    curl -f "http://127.0.0.1:${APP_PORT}/" >/dev/null
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
