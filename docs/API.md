# 헤어 트렌드 분석 API 문서

## 기본 정보
- **Base URL**: `http://localhost:3001/api`
- **인증**: API Key (헤더: `X-API-Key`)
- **응답 형식**: JSON

## 엔드포인트

### 1. 헬스체크
```http
GET /api/health
```

**응답 예시:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

---

### 2. 트렌드 조회
```http
GET /api/trends
```

**쿼리 파라미터:**
- `platform` (선택): instagram, youtube, tiktok
- `category` (선택): 커트, 염색, 펌, 스타일링
- `limit` (선택): 결과 개수 (기본값: 20)

**응답 예시:**
```json
{
  "trends": [
    {
      "id": "trend_001",
      "keyword": "레이어드컷",
      "category": "커트",
      "platform": "instagram",
      "score": 85,
      "views": 150000,
      "likes": 12000,
      "comments": 800,
      "contentIdea": "20대 여성을 위한 레이어드컷 스타일링 가이드",
      "createdAt": "2024-01-01T10:00:00Z"
    }
  ],
  "total": 50,
  "page": 1
}
```

---

### 3. 트렌드 수집 실행
```http
POST /api/collect-trends
```

**요청 본문:**
```json
{
  "platforms": ["instagram", "youtube"],
  "keywords": ["단발머리", "레이어드컷", "애쉬브라운"]
}
```

**응답 예시:**
```json
{
  "message": "트렌드 수집이 시작되었습니다",
  "jobId": "job_123456",
  "estimatedTime": "5분"
}
```

---

### 4. AI 대본 생성
```http
POST /api/generate-script
```

**요청 본문:**
```json
{
  "topic": "2024 가을 단발머리 트렌드",
  "duration": 10,
  "style": "educational",
  "targetAudience": "20-30대 여성"
}
```

**응답 예시:**
```json
{
  "script": "안녕하세요, 김미연 원장입니다...",
  "duration": "10분",
  "structure": {
    "intro": "0:00-1:00",
    "main": "1:00-8:00",
    "outro": "8:00-10:00"
  },
  "keywords": ["단발머리", "가을헤어", "트렌드"],
  "estimatedViews": 50000
}
```

---

### 5. 트렌드 분석
```http
POST /api/analyze-trend
```

**요청 본문:**
```json
{
  "url": "https://www.instagram.com/reel/xxxxx",
  "platform": "instagram"
}
```

**응답 예시:**
```json
{
  "analysis": {
    "style": "레이어드 보브컷",
    "techniques": ["포인트 커팅", "텍스처 커트"],
    "difficulty": "중급",
    "targetCustomer": "20-30대 여성",
    "estimatedPrice": "80,000원",
    "trendScore": 88,
    "recommendations": [
      "얼굴형별 변형 스타일 제안",
      "홈케어 방법 추가"
    ]
  }
}
```

---

### 6. 대시보드 통계
```http
GET /api/stats
```

**응답 예시:**
```json
{
  "totalTrends": 245,
  "highPotential": 42,
  "avgScore": 72,
  "topCategories": [
    {"name": "커트", "count": 89},
    {"name": "염색", "count": 67},
    {"name": "펌", "count": 45}
  ],
  "weeklyGrowth": 15.3,
  "lastUpdate": "2024-01-01T12:00:00Z"
}
```

---

### 7. 콘텐츠 기획안 생성
```http
POST /api/content-plan
```

**요청 본문:**
```json
{
  "trendId": "trend_001",
  "contentType": "longform",
  "includeProducts": true
}
```

**응답 예시:**
```json
{
  "plan": {
    "title": "2024 레이어드컷 완벽 가이드",
    "hook": "5분만에 완성하는 살롱 스타일",
    "structure": [
      "인트로 (0-30초): 비포/애프터 공개",
      "준비물 소개 (30초-1분): 필요 도구",
      "시연 (1-7분): 단계별 커팅",
      "스타일링 (7-9분): 마무리 팁",
      "아웃트로 (9-10분): CTA"
    ],
    "products": [
      {
        "name": "프로페셔널 커팅가위",
        "price": "150,000원",
        "link": "https://..."
      }
    ],
    "hashtags": ["#레이어드컷", "#헤어트렌드2024"],
    "estimatedRevenue": "500만원/월"
  }
}
```

---

## 에러 코드

| 코드 | 설명 |
|------|------|
| 400 | 잘못된 요청 |
| 401 | 인증 실패 |
| 403 | 권한 없음 |
| 404 | 리소스를 찾을 수 없음 |
| 429 | 요청 한도 초과 |
| 500 | 서버 내부 오류 |

## Rate Limiting
- 시간당 1000개 요청
- 분당 100개 요청

## 웹소켓 이벤트

### 실시간 트렌드 업데이트
```javascript
socket.on('trend:new', (data) => {
  console.log('새로운 트렌드:', data);
});

socket.on('trend:update', (data) => {
  console.log('트렌드 업데이트:', data);
});
```

## SDK 사용 예시

### JavaScript
```javascript
const HairTrendAPI = require('hair-trend-sdk');

const api = new HairTrendAPI({
  apiKey: 'your-api-key',
  baseURL: 'https://api.hairtrend.ai'
});

// 트렌드 조회
const trends = await api.getTrends({
  platform: 'instagram',
  limit: 10
});

// 대본 생성
const script = await api.generateScript({
  topic: '단발머리 스타일링'
});
```
