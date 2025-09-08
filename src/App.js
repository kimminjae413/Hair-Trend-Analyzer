import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [trends, setTrends] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [scriptInput, setScriptInput] = useState('');
  const [generatedScript, setGeneratedScript] = useState('');
  const [stats, setStats] = useState({
    totalTrends: 0,
    highPotential: 0,
    avgScore: 0,
    lastUpdate: null
  });

  // 트렌드 데이터 가져오기
  const fetchTrends = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:3001/api/trends');
      const data = await response.json();
      setTrends(data.trends || []);
      
      // 통계 계산
      const highPotentialCount = data.trends?.filter(t => t.score >= 80).length || 0;
      const avgScore = data.trends?.length > 0 
        ? Math.round(data.trends.reduce((acc, t) => acc + t.score, 0) / data.trends.length)
        : 0;
      
      setStats({
        totalTrends: data.trends?.length || 0,
        highPotential: highPotentialCount,
        avgScore: avgScore,
        lastUpdate: new Date().toLocaleString()
      });
    } catch (error) {
      console.error('트렌드 로딩 실패:', error);
    }
    setLoading(false);
  };

  // AI 대본 생성
  const generateScript = async () => {
    if (!scriptInput) {
      alert('주제를 입력해주세요!');
      return;
    }
    
    setLoading(true);
    try {
      const response = await fetch('http://localhost:3001/api/generate-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: scriptInput })
      });
      const data = await response.json();
      setGeneratedScript(data.script);
    } catch (error) {
      console.error('대본 생성 실패:', error);
      alert('대본 생성에 실패했습니다.');
    }
    setLoading(false);
  };

  // 트렌드 수집 실행
  const collectTrends = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:3001/api/collect-trends', {
        method: 'POST'
      });
      const data = await response.json();
      alert('트렌드 수집이 시작되었습니다!');
      setTimeout(fetchTrends, 5000); // 5초 후 새로고침
    } catch (error) {
      console.error('트렌드 수집 실패:', error);
      alert('트렌드 수집에 실패했습니다.');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTrends();
  }, []);

  return (
    <div className="App">
      {/* 헤더 */}
      <header className="header">
        <div className="header-content">
          <h1>💇‍♀️ 헤어 트렌드 AI 분석 시스템</h1>
          <p>실시간 헤어 트렌드 분석 & AI 대본 생성</p>
        </div>
      </header>

      {/* 네비게이션 */}
      <nav className="nav-tabs">
        <button 
          className={activeTab === 'dashboard' ? 'active' : ''}
          onClick={() => setActiveTab('dashboard')}
        >
          📊 대시보드
        </button>
        <button 
          className={activeTab === 'trends' ? 'active' : ''}
          onClick={() => setActiveTab('trends')}
        >
          🔥 트렌드
        </button>
        <button 
          className={activeTab === 'script' ? 'active' : ''}
          onClick={() => setActiveTab('script')}
        >
          ✍️ 대본 생성
        </button>
      </nav>

      {/* 메인 컨텐츠 */}
      <main className="main-content">
        {/* 대시보드 탭 */}
        {activeTab === 'dashboard' && (
          <div className="dashboard">
            <div className="stats-grid">
              <div className="stat-card">
                <h3>총 트렌드</h3>
                <p className="stat-number">{stats.totalTrends}</p>
              </div>
              <div className="stat-card">
                <h3>고잠재력</h3>
                <p className="stat-number">{stats.highPotential}</p>
              </div>
              <div className="stat-card">
                <h3>평균 점수</h3>
                <p className="stat-number">{stats.avgScore}점</p>
              </div>
              <div className="stat-card">
                <h3>마지막 업데이트</h3>
                <p className="stat-time">{stats.lastUpdate || '-'}</p>
              </div>
            </div>

            <div className="action-buttons">
              <button onClick={collectTrends} disabled={loading} className="btn-primary">
                {loading ? '수집 중...' : '🔄 트렌드 수집 시작'}
              </button>
              <button onClick={fetchTrends} disabled={loading} className="btn-secondary">
                {loading ? '로딩 중...' : '🔄 새로고침'}
              </button>
            </div>

            {/* 최근 고잠재력 트렌드 */}
            <div className="recent-trends">
              <h2>🔥 최근 고잠재력 트렌드 (80점 이상)</h2>
              <div className="trend-list">
                {trends
                  .filter(t => t.score >= 80)
                  .slice(0, 5)
                  .map((trend, index) => (
                    <div key={index} className="trend-item">
                      <span className="trend-rank">#{index + 1}</span>
                      <div className="trend-info">
                        <h4>{trend.keyword}</h4>
                        <p>{trend.category} | 조회수: {trend.views?.toLocaleString() || 0}</p>
                      </div>
                      <span className="trend-score">{trend.score}점</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* 트렌드 탭 */}
        {activeTab === 'trends' && (
          <div className="trends-page">
            <h2>📈 실시간 헤어 트렌드 분석</h2>
            
            {loading ? (
              <div className="loading">분석 중...</div>
            ) : (
              <div className="trends-grid">
                {trends.map((trend, index) => (
                  <div key={index} className="trend-card">
                    <div className="trend-header">
                      <span className="trend-category">{trend.category}</span>
                      <span className={`trend-badge ${trend.score >= 80 ? 'hot' : ''}`}>
                        {trend.score >= 80 ? '🔥 HOT' : '📊 일반'}
                      </span>
                    </div>
                    <h3>{trend.keyword}</h3>
                    <div className="trend-stats">
                      <div>플랫폼: {trend.platform}</div>
                      <div>조회수: {trend.views?.toLocaleString() || 0}</div>
                      <div>좋아요: {trend.likes?.toLocaleString() || 0}</div>
                      <div>댓글: {trend.comments?.toLocaleString() || 0}</div>
                    </div>
                    <div className="trend-score-bar">
                      <div 
                        className="score-fill" 
                        style={{width: `${trend.score}%`}}
                      ></div>
                      <span className="score-text">{trend.score}점</span>
                    </div>
                    <div className="trend-tips">
                      <h4>💡 활용 팁</h4>
                      <p>{trend.contentIdea}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 대본 생성 탭 */}
        {activeTab === 'script' && (
          <div className="script-page">
            <h2>🤖 AI 헤어 콘텐츠 대본 생성</h2>
            
            <div className="script-generator">
              <div className="input-section">
                <label>헤어 콘텐츠 주제</label>
                <input
                  type="text"
                  placeholder="예: 2024 가을 단발머리 트렌드"
                  value={scriptInput}
                  onChange={(e) => setScriptInput(e.target.value)}
                />
                <button 
                  onClick={generateScript} 
                  disabled={loading}
                  className="btn-generate"
                >
                  {loading ? '생성 중...' : '✨ 대본 생성'}
                </button>
              </div>

              {generatedScript && (
                <div className="script-output">
                  <h3>생성된 대본</h3>
                  <div className="script-content">
                    <pre>{generatedScript}</pre>
                  </div>
                  <div className="script-actions">
                    <button onClick={() => navigator.clipboard.writeText(generatedScript)}>
                      📋 복사
                    </button>
                    <button onClick={() => setGeneratedScript('')}>
                      🗑️ 초기화
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="script-templates">
              <h3>🎬 인기 대본 템플릿</h3>
              <div className="template-grid">
                <button onClick={() => setScriptInput('2024 트렌디한 레이어드컷')}>
                  레이어드컷 튜토리얼
                </button>
                <button onClick={() => setScriptInput('탈색 없이 애쉬브라운 염색하기')}>
                  염색 가이드
                </button>
                <button onClick={() => setScriptInput('5분 완성 출근 헤어스타일링')}>
                  간단 스타일링
                </button>
                <button onClick={() => setScriptInput('곱슬머리 관리 꿀팁')}>
                  헤어케어 팁
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 푸터 */}
      <footer className="footer">
        <p>© 2024 Hair Trend Analyzer | Powered by AI</p>
      </footer>
    </div>
  );
}

export default App;
