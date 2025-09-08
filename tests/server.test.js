const request = require('supertest');
const app = require('../server');

describe('Hair Trend API Tests', () => {
  
  // 헬스체크 테스트
  describe('GET /api/health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);
      
      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  // 트렌드 조회 테스트
  describe('GET /api/trends', () => {
    it('should return trends list', async () => {
      const response = await request(app)
        .get('/api/trends')
        .expect(200);
      
      expect(response.body).toHaveProperty('trends');
      expect(Array.isArray(response.body.trends)).toBe(true);
    });

    it('should filter trends by platform', async () => {
      const response = await request(app)
        .get('/api/trends?platform=instagram')
        .expect(200);
      
      expect(response.body.trends.every(t => t.platform === 'instagram')).toBe(true);
    });

    it('should limit results', async () => {
      const response = await request(app)
        .get('/api/trends?limit=5')
        .expect(200);
      
      expect(response.body.trends.length).toBeLessThanOrEqual(5);
    });
  });

  // 대본 생성 테스트
  describe('POST /api/generate-script', () => {
    it('should generate script for valid topic', async () => {
      const response = await request(app)
        .post('/api/generate-script')
        .send({ topic: '레이어드컷 튜토리얼' })
        .expect(200);
      
      expect(response.body).toHaveProperty('script');
      expect(typeof response.body.script).toBe('string');
      expect(response.body.script.length).toBeGreaterThan(100);
    });

    it('should return error for empty topic', async () => {
      await request(app)
        .post('/api/generate-script')
        .send({ topic: '' })
        .expect(400);
    });
  });

  // 트렌드 수집 테스트
  describe('POST /api/collect-trends', () => {
    it('should start trend collection', async () => {
      const response = await request(app)
        .post('/api/collect-trends')
        .send({
          platforms: ['instagram'],
          keywords: ['단발머리']
        })
        .expect(200);
      
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('jobId');
    });
  });

  // 통계 조회 테스트
  describe('GET /api/stats', () => {
    it('should return dashboard statistics', async () => {
      const response = await request(app)
        .get('/api/stats')
        .expect(200);
      
      expect(response.body).toHaveProperty('totalTrends');
      expect(response.body).toHaveProperty('highPotential');
      expect(response.body).toHaveProperty('avgScore');
      expect(response.body).toHaveProperty('topCategories');
    });
  });

  // 에러 처리 테스트
  describe('Error Handling', () => {
    it('should return 404 for unknown endpoint', async () => {
      await request(app)
        .get('/api/unknown')
        .expect(404);
    });

    it('should handle invalid JSON', async () => {
      await request(app)
        .post('/api/generate-script')
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);
    });
  });

  // Rate Limiting 테스트
  describe('Rate Limiting', () => {
    it('should enforce rate limits', async () => {
      const requests = Array(101).fill().map(() => 
        request(app).get('/api/trends')
      );
      
      const responses = await Promise.all(requests);
      const tooManyRequests = responses.some(r => r.status === 429);
      
      expect(tooManyRequests).toBe(true);
    });
  });
});

// 통합 테스트
describe('Integration Tests', () => {
  it('should complete full workflow', async () => {
    // 1. 트렌드 수집
    const collectResponse = await request(app)
      .post('/api/collect-trends')
      .send({
        platforms: ['instagram'],
        keywords: ['레이어드컷']
      })
      .expect(200);
    
    const jobId = collectResponse.body.jobId;
    expect(jobId).toBeDefined();
    
    // 2. 트렌드 조회
    const trendsResponse = await request(app)
      .get('/api/trends')
      .expect(200);
    
    expect(trendsResponse.body.trends).toBeDefined();
    
    // 3. 대본 생성
    if (trendsResponse.body.trends.length > 0) {
      const trend = trendsResponse.body.trends[0];
      const scriptResponse = await request(app)
        .post('/api/generate-script')
        .send({ topic: trend.keyword })
        .expect(200);
      
      expect(scriptResponse.body.script).toBeDefined();
    }
  });
});

// 성능 테스트
describe('Performance Tests', () => {
  it('should respond within acceptable time', async () => {
    const start = Date.now();
    
    await request(app)
      .get('/api/trends')
      .expect(200);
    
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(1000); // 1초 이내
  });
  
  it('should handle concurrent requests', async () => {
    const requests = Array(10).fill().map(() => 
      request(app).get('/api/trends')
    );
    
    const responses = await Promise.all(requests);
    const allSuccessful = responses.every(r => r.status === 200);
    
    expect(allSuccessful).toBe(true);
  });
});
