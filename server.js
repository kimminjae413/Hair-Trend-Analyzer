// server.js - 헤어 트렌드 분석 웹앱 백엔드
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { OpenAI } = require('openai');
const axios = require('axios');
const cron = require('node-cron');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// ================================
// 미들웨어 설정
// ================================

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

app.use(compression());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://hairtrend.ai', 'https://www.hairtrend.ai']
    : ['http://localhost:3000'],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15분
  max: 100, // 최대 100 요청
  message: {
    error: '너무 많은 요청입니다. 잠시 후 다시 시도해주세요.',
    retryAfter: 15 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api', limiter);

// ================================
// OpenAI 및 서비스 초기화
// ================================

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// 구글 시트 인증 설정
const serviceAccountAuth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
});

// ================================
// 헤어 트렌드 분석 클래스
// ================================

class HairTrendAnalyzer {
  constructor() {
    this.instagramHashtags = [
      '헤어스타일', '헤어트렌드', '머리스타일', '헤어컬러',
      '단발머리', '긴머리', '펌스타일', '염색', '하이라이트', 
      '뱅스타일', '레이어드컷', '보브컷', '시스루뱅', '허쉬컷', 
      '울프컷', '투블럭', '다운펌', '디지털펌', '매직스트레이트',
      '볼륨펌', '옴브레', '발레아쥬', '그라데이션', '애쉬컬러',
      '핑크컬러', '헤어케어', '탈모', '모발관리', '헤어오일', '트리트먼트'
    ];
    
    this.youtubeKeywords = [
      '헤어 튜토리얼', '헤어 자르기', '염색 방법', '헤어 스타일링',
      '살롱 브이로그', '헤어 변신', '셀프 헤어컷', '홈 염색',
      '헤어 망가졌을때', '헤어 복구', '모발 손상', '헤어 케어',
      '앞머리 자르기', '레이어 컷', '보브 컷팅', '펌 과정',
      '헤어 컬러링', '브리치', '탈색', '헤어 드라이'
    ];
    
    this.cache = new Map();
    this.lastAnalysis = null;
  }

  // 인스타그램 데이터 수집
  async collectInstagramData() {
    try {
      console.log('📸 인스타그램 데이터 수집 시작...');
      
      const response = await axios.post(
        'https://api.apify.com/v2/acts/apify~instagram-hashtag-scraper/run-sync-get-dataset-items',
        {
          hashtags: this.instagramHashtags,
          resultsLimit: 1000,
          addParentData: false,
          enhanceUserSearchWithFacebookPage: false,
          isUserReelFeedURL: false,
          isUserTaggedFeedURL: false,
          searchType: 'hashtag'
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.APIFY_API_KEY}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );
      
      console.log(`✅ 인스타그램 데이터 ${response.data.length}개 수집 완료`);
      return response.data;
    } catch (error) {
      console.error('❌ 인스타그램 데이터 수집 오류:', error.message);
      return [];
    }
  }

  // 유튜브 데이터 수집
  async collectYouTubeData() {
    try {
      console.log('🎥 유튜브 데이터 수집 시작...');
      
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      
      const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
        params: {
          part: 'snippet',
          q: this.youtubeKeywords.join(' OR '),
          type: 'video',
          order: 'relevance',
          publishedAfter: oneWeekAgo.toISOString(),
          maxResults: 100,
          regionCode: 'KR',
          relevanceLanguage: 'ko',
          key: process.env.YOUTUBE_API_KEY
        }
      });
      
      console.log(`✅ 유튜브 데이터 ${response.data.items.length}개 수집 완료`);
      return response.data.items;
    } catch (error) {
      console.error('❌ 유튜브 데이터 수집 오류:', error.message);
      return [];
    }
  }

  // AI 트렌드 분석
  async analyzeTrends(instagramData, youtubeData) {
    try {
      console.log('🤖 AI 트렌드 분석 시작...');
      
      const analysisPrompt = `
당신은 헤어 트렌드 분석 전문가이자 성공한 뷰티 컨설턴트입니다. 15년간 전 세계 헤어 트렌드를 분석하며 한국 헤어샵들에게 가장 수익성 높은 트렌드를 추천해왔습니다.

수집된 플랫폼 데이터:
인스타그램: ${JSON.stringify(instagramData.slice(0, 50))}
유튜브: ${JSON.stringify(youtubeData.slice(0, 20))}

분석 기준:
1. 상업적 실현 가능성 (실제 헤어샵 적용 가능)
2. 수익화 잠재력 (롱폼 콘텐츠 조회수)
3. 타겟 명확성 (구체적 고객층)
4. 차별화 요소 (경쟁사 대비)
5. 지속성 (일회성 vs 지속 가능)
6. 계절성 고려 (현재 ${new Date().getFullYear()}년 ${new Date().getMonth() + 1}월)

한국 시장 특성:
- K-뷰티, 아이돌 스타일 선호
- 관리 편의성 중시
- 직장인 라이프스타일 고려
- 4계절 변화 반영

다음 JSON 형식으로 분석 결과를 제공하세요:
{
  "analysis_summary": {
    "collection_time": "${new Date().toISOString()}",
    "data_quality": "높음/중간/낮음",
    "trend_velocity": "빠름/보통/느림",
    "market_sentiment": "긍정적/중립/부정적"
  },
  "top_trends": [
    {
      "trend_name": "구체적인 헤어 트렌드명",
      "popularity_score": 95,
      "target_audience": "20-30대 직장 여성",
      "commercial_viability": "매우 높음",
      "monetization_score": 88,
      "difficulty_level": "초급/중급/고급",
      "equipment_needed": ["필요 도구들"],
      "expected_views": "50만-200만",
      "best_upload_time": "요일 + 시간",
      "keywords": ["SEO 키워드들"],
      "why_trending": "트렌드 이유 상세 분석",
      "revenue_potential": "월 예상 수익 범위",
      "competition_level": "낮음/중간/높음",
      "seasonal_factor": "계절성 분석"
    }
  ],
  "emerging_trends": [
    {
      "trend_name": "신흥 트렌드명",
      "growth_rate": "+150%",
      "potential_score": 75,
      "time_to_peak": "예상 정점 시기"
    }
  ],
  "content_opportunities": [
    {
      "title_suggestion": "바이럴 가능 제목",
      "content_type": "튜토리얼/리뷰/비교/실패예방",
      "estimated_performance": "예상 성과",
      "hook_angle": "관심 끌기 각도",
      "monetization_angle": "수익화 포인트"
    }
  ]
}`;

      const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-4",
        messages: [{ role: "user", content: analysisPrompt }],
        temperature: parseFloat(process.env.OPENAI_TEMPERATURE) || 0.7,
        max_tokens: parseInt(process.env.OPENAI_MAX_TOKENS) || 4000
      });

      console.log('✅ AI 트렌드 분석 완료');
      return JSON.parse(completion.choices[0].message.content);
    } catch (error) {
      console.error('❌ AI 트렌드 분석 오류:', error.message);
      throw error;
    }
  }

  // 콘텐츠 기획 생성
  async generateContentPlans(selectedTrend) {
    try {
      console.log('💡 콘텐츠 기획 생성 시작...');
      
      const contentPrompt = `
선택된 최고 트렌드: ${selectedTrend.trend_name}
트렌드 상세 정보: ${JSON.stringify(selectedTrend)}

이 트렌드를 활용하여 헤어디자이너들이 월 1천만원 이상 수익을 올릴 수 있는 구체적인 롱폼 콘텐츠 기획안 5개를 만들어주세요.

각 기획안은 김창수님의 성공 모델을 벤치마킹하여:
- 8-12분 롱폼 위주
- 실용적이고 따라하기 쉬운 내용
- 자연스러운 제품 언급 가능
- 브랜드 협찬 연결 포인트
- 높은 시청 완주율 목표

JSON 형식으로 출력하세요.`;

      const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-4",
        messages: [{ role: "user", content: contentPrompt }],
        temperature: 0.8,
        max_tokens: 4000
      });

      console.log('✅ 콘텐츠 기획 생성 완료');
      return JSON.parse(completion.choices[0].message.content);
    } catch (error) {
      console.error('❌ 콘텐츠 기획 생성 오류:', error.message);
      throw error;
    }
  }

  // 구글시트에 데이터 저장
  async saveToGoogleSheets(trendData, contentData) {
    try {
      console.log('📊 구글시트 저장 시작...');
      
      const doc = new GoogleSpreadsheet(process.env.HAIR_TREND_SHEET_ID, serviceAccountAuth);
      await doc.loadInfo();

      // 트렌드 분석 시트
      let trendSheet;
      try {
        trendSheet = doc.sheetsByTitle['트렌드 분석'];
      } catch (error) {
        trendSheet = await doc.addSheet({
          title: '트렌드 분석',
          headerValues: [
            '수집일시', '데이터품질', '트렌드속도', '시장감정', '1위트렌드',
            '인기점수', '타겟고객', '상업성', '수익점수', '난이도',
            '예상조회수', '최적업로드', '키워드', '트렌드이유', '수익예상',
            '경쟁정도', '계절요인', '콘텐츠제안1', '콘텐츠제안2', '콘텐츠제안3'
          ]
        });
      }

      const topTrend = trendData.top_trends[0];
      await trendSheet.addRow({
        '수집일시': new Date().toLocaleString('ko-KR'),
        '데이터품질': trendData.analysis_summary.data_quality,
        '트렌드속도': trendData.analysis_summary.trend_velocity,
        '시장감정': trendData.analysis_summary.market_sentiment,
        '1위트렌드': topTrend.trend_name,
        '인기점수': topTrend.popularity_score,
        '타겟고객': topTrend.target_audience,
        '상업성': topTrend.commercial_viability,
        '수익점수': topTrend.monetization_score,
        '난이도': topTrend.difficulty_level,
        '예상조회수': topTrend.expected_views,
        '최적업로드': topTrend.best_upload_time,
        '키워드': topTrend.keywords.join(', '),
        '트렌드이유': topTrend.why_trending,
        '수익예상': topTrend.revenue_potential,
        '경쟁정도': topTrend.competition_level,
        '계절요인': topTrend.seasonal_factor,
        '콘텐츠제안1': trendData.content_opportunities[0]?.title_suggestion || '',
        '콘텐츠제안2': trendData.content_opportunities[1]?.title_suggestion || '',
        '콘텐츠제안3': trendData.content_opportunities[2]?.title_suggestion || ''
      });

      console.log('✅ 구글시트 저장 완료');
      return { success: true };
    } catch (error) {
      console.error('❌ 구글시트 저장 오류:', error.message);
      throw error;
    }
  }
}

// ================================
// API 라우트들
// ================================

// 헬스체크
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// 헤어 트렌드 분석기 인스턴스
const hairAnalyzer = new HairTrendAnalyzer();

// 트렌드 분석 실행
app.post('/api/analyze-trends', async (req, res) => {
  try {
    console.log('🎨 트렌드 분석 API 호출됨');
    
    // 데이터 수집
    const [instagramData, youtubeData] = await Promise.all([
      hairAnalyzer.collectInstagramData(),
      hairAnalyzer.collectYouTubeData()
    ]);

    // AI 분석
    const trendAnalysis = await hairAnalyzer.analyzeTrends(instagramData, youtubeData);
    
    // 콘텐츠 기획 생성
    const contentPlans = await hairAnalyzer.generateContentPlans(trendAnalysis.top_trends[0]);
    
    // 구글시트 저장
    await hairAnalyzer.saveToGoogleSheets(trendAnalysis, contentPlans);

    res.json({
      success: true,
      data: {
        trends: trendAnalysis,
        content_plans: contentPlans,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ 트렌드 분석 API 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message || '트렌드 분석 중 오류가 발생했습니다.'
    });
  }
});

// 저장된 트렌드 데이터 조회
app.get('/api/trends', async (req, res) => {
  try {
    const doc = new GoogleSpreadsheet(process.env.HAIR_TREND_SHEET_ID, serviceAccountAuth);
    await doc.loadInfo();
    
    const trendSheet = doc.sheetsByTitle['트렌드 분석'];
    if (!trendSheet) {
      return res.json({ success: true, data: [] });
    }

    const rows = await trendSheet.getRows();
    const trends = rows.map(row => ({
      수집일시: row.get('수집일시'),
      트렌드명: row.get('1위트렌드'),
      인기점수: row.get('인기점수'),
      타겟고객: row.get('타겟고객'),
      예상조회수: row.get('예상조회수'),
      수익예상: row.get('수익예상'),
      키워드: row.get('키워드')
    })).reverse().slice(0, 20);

    res.json({ success: true, data: trends });
  } catch (error) {
    console.error('❌ 트렌드 조회 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// AI 대본 생성
app.post('/api/generate-script', async (req, res) => {
  try {
    const { title, target_audience, keywords } = req.body;

    if (!title || !target_audience) {
      return res.status(400).json({
        success: false,
        error: '제목과 타겟 고객은 필수 입력 항목입니다.'
      });
    }

    const scriptPrompt = `
당신은 '김미연' 원장입니다.

【김미연 원장 프로필】
- 나이: 38세
- 경력: 서울 강남에서 15년간 헤어샵 운영
- 전문 분야: 트렌드 헤어, 얼굴형 분석, 헤어 컬러링
- 성격: 전문적이면서도 친근함, 언니 같은 따뜻함

제목: ${title}
타겟: ${target_audience}
키워드: ${keywords || ''}

10분 분량의 롱폼 대본을 김미연 원장의 톤앤매너로 작성해주세요.

구조:
[0:00-0:30] 강력한 오프닝 훅
[0:30-2:00] 문제 상황 공감 + 해결책 예고  
[2:00-7:00] 단계별 실제 시연 과정
[7:00-8:30] 추가 팁 + 제품 추천
[8:30-10:00] 마무리 + 액션 유도

출력 형식:
[타임코드] 대사 내용
`;

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4",
      messages: [{ role: "user", content: scriptPrompt }],
      temperature: 0.8,
      max_tokens: 4000
    });

    res.json({
      success: true,
      script: completion.choices[0].message.content
    });

  } catch (error) {
    console.error('❌ 대본 생성 오류:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || '대본 생성 중 오류가 발생했습니다.'
    });
  }
});

// ================================
// 자동 크론잡 설정
// ================================

// 자동 트렌드 분석 (하루 3회: 9시, 15시, 21시)
const cronSchedule = process.env.CRON_TREND_ANALYSIS || '0 9,15,21 * * *';

cron.schedule(cronSchedule, async () => {
  console.log('⏰ 자동 트렌드 분석 시작:', new Date().toLocaleString('ko-KR'));
  
  try {
    const [instagramData, youtubeData] = await Promise.all([
      hairAnalyzer.collectInstagramData(),
      hairAnalyzer.collectYouTubeData()
    ]);

    const trendAnalysis = await hairAnalyzer.analyzeTrends(instagramData, youtubeData);
    const contentPlans = await hairAnalyzer.generateContentPlans(trendAnalysis.top_trends[0]);
    
    await hairAnalyzer.saveToGoogleSheets(trendAnalysis, contentPlans);
    
    console.log('✅ 자동 트렌드 분석 완료');
    
    // 고잠재력 트렌드 알림 (텔레그램)
    if (trendAnalysis.top_trends[0]?.popularity_score >= 90 && process.env.TELEGRAM_BOT_TOKEN) {
      // 텔레그램 알림 로직 (선택사항)
    }
    
  } catch (error) {
    console.error('❌ 자동 트렌드 분석 오류:', error);
  }
}, {
  scheduled: true,
  timezone: "Asia/Seoul"
});

// ================================
// 에러 핸들링
// ================================

app.use((error, req, res, next) => {
  console.error('🚨 서버 오류:', error);
  
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' 
      ? '서버 내부 오류가 발생했습니다.' 
      : error.message,
    timestamp: new Date().toISOString()
  });
});

// 404 핸들링
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: '요청하신 리소스를 찾을 수 없습니다.',
    path: req.originalUrl
  });
});

// ================================
// 서버 시작
// ================================

app.listen(PORT, () => {
  console.log(`🚀 헤어 트렌드 분석 서버가 포트 ${PORT}에서 실행 중입니다.`);
  console.log(`📊 API 상태: http://localhost:${PORT}/api/health`);
  console.log(`🌍 환경: ${process.env.NODE_ENV || 'development'}`);
  console.log(`⏰ 자동 분석 스케줄: ${cronSchedule}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('👋 서버 종료 중...');
  process.exit(0);
});

module.exports = app;
