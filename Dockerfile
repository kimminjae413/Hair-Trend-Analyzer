# 멀티 스테이지 빌드를 사용하여 이미지 크기 최적화

# Stage 1: 빌드 단계
FROM node:18-alpine AS builder

# 작업 디렉토리 설정
WORKDIR /app

# package.json과 package-lock.json 복사
COPY package*.json ./

# 의존성 설치
RUN npm ci --only=production

# 소스 코드 복사
COPY . .

# React 앱 빌드
RUN npm run build

# Stage 2: 실행 단계
FROM node:18-alpine

# 작업 디렉토리 설정
WORKDIR /app

# PM2 글로벌 설치
RUN npm install -g pm2

# 빌드된 파일들 복사
COPY --from=builder /app/build ./build
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/server.js ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/src ./src

# 환경 변수 설정
ENV NODE_ENV=production
ENV PORT=3001

# 포트 노출
EXPOSE 3000 3001

# 헬스체크
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/api/health', (r) => {r.statusCode === 200 ? process.exit(0) : process.exit(1)})"

# 앱 실행
CMD ["pm2-runtime", "start", "server.js", "--name", "hair-trend-api"]
