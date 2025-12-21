import { useState, useEffect } from 'react';
import './AdminDashboard.css';

interface Response {
  id: number;
  timestamp: string;
  country: string;
  country_code: string;
  city: string;
  age_group: string;
  gender: string;
  score: number;
  tier: string;
  yes_count: number;
  selected_language: string;
  device_type: string;
  answers: string;
  question_times: string;
  total_quiz_time: number;
  session_duration: number;
  completed: number;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
}

interface Summary {
  totalResponses: number;
  byCountry: { country: string; count: number }[];
  byAgeGroup: { age_group: string; count: number }[];
  byGender: { gender: string; count: number }[];
  byDevice: { device_type: string; count: number }[];
  byLanguage: { selected_language: string; count: number }[];
}

export const AdminDashboard = () => {
  const [responses, setResponses] = useState<Response[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'summary' | 'responses'>('summary');
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  const apiBase = import.meta.env.PROD ? '' : 'http://localhost:3000';

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, summaryRes] = await Promise.all([
        fetch(`${apiBase}/api/stats`),
        fetch(`${apiBase}/api/stats/summary`)
      ]);

      if (!statsRes.ok || !summaryRes.ok) {
        throw new Error('API 요청 실패');
      }

      const statsData = await statsRes.json();
      const summaryData = await summaryRes.json();

      setResponses(statsData.responses || []);
      setSummary(summaryData);
    } catch (err) {
      setError(err instanceof Error ? err.message : '데이터 로딩 실패');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (ms: number) => {
    if (!ms) return '-';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    if (minutes > 0) {
      return `${minutes}분 ${seconds % 60}초`;
    }
    return `${seconds}초`;
  };

  const parseAnswers = (answersStr: string): boolean[] => {
    try {
      return JSON.parse(answersStr);
    } catch {
      return [];
    }
  };

  if (loading) {
    return (
      <div className="admin-dashboard">
        <div className="admin-loading">데이터 로딩 중...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-dashboard">
        <div className="admin-error">
          <p>{error}</p>
          <button onClick={fetchData}>다시 시도</button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <header className="admin-header">
        <h1>관리자 대시보드</h1>
        <button className="refresh-btn" onClick={fetchData}>
          새로고침
        </button>
      </header>

      <div className="admin-tabs">
        <button
          className={`tab-btn ${activeTab === 'summary' ? 'active' : ''}`}
          onClick={() => setActiveTab('summary')}
        >
          요약 통계
        </button>
        <button
          className={`tab-btn ${activeTab === 'responses' ? 'active' : ''}`}
          onClick={() => setActiveTab('responses')}
        >
          응답 목록 ({summary?.totalResponses || 0})
        </button>
      </div>

      {activeTab === 'summary' && summary && (
        <div className="admin-summary">
          <div className="summary-card total">
            <h3>전체 응답</h3>
            <p className="big-number">{summary.totalResponses.toLocaleString()}</p>
          </div>

          <div className="summary-grid">
            <div className="summary-card">
              <h3>국가별</h3>
              <ul className="stat-list">
                {summary.byCountry.slice(0, 10).map((item, idx) => (
                  <li key={idx}>
                    <span className="stat-label">{item.country || '미확인'}</span>
                    <span className="stat-value">{item.count}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="summary-card">
              <h3>연령대별</h3>
              <ul className="stat-list">
                {summary.byAgeGroup.map((item, idx) => (
                  <li key={idx}>
                    <span className="stat-label">{item.age_group || '미선택'}</span>
                    <span className="stat-value">{item.count}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="summary-card">
              <h3>성별</h3>
              <ul className="stat-list">
                {summary.byGender.map((item, idx) => (
                  <li key={idx}>
                    <span className="stat-label">{item.gender || '미선택'}</span>
                    <span className="stat-value">{item.count}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="summary-card">
              <h3>기기 유형</h3>
              <ul className="stat-list">
                {summary.byDevice.map((item, idx) => (
                  <li key={idx}>
                    <span className="stat-label">{item.device_type || '미확인'}</span>
                    <span className="stat-value">{item.count}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="summary-card">
              <h3>언어별</h3>
              <ul className="stat-list">
                {summary.byLanguage.slice(0, 10).map((item, idx) => (
                  <li key={idx}>
                    <span className="stat-label">{item.selected_language || '미확인'}</span>
                    <span className="stat-value">{item.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'responses' && (
        <div className="admin-responses">
          <div className="table-container">
            <table className="responses-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>시간</th>
                  <th>국가</th>
                  <th>도시</th>
                  <th>연령</th>
                  <th>성별</th>
                  <th>점수</th>
                  <th>티어</th>
                  <th>Yes</th>
                  <th>언어</th>
                  <th>기기</th>
                  <th>소요시간</th>
                  <th>완료</th>
                </tr>
              </thead>
              <tbody>
                {responses.map((response) => (
                  <>
                    <tr
                      key={response.id}
                      className={expandedRow === response.id ? 'expanded' : ''}
                      onClick={() => setExpandedRow(expandedRow === response.id ? null : response.id)}
                    >
                      <td>{response.id}</td>
                      <td>{formatDate(response.timestamp)}</td>
                      <td>{response.country_code || response.country || '-'}</td>
                      <td>{response.city || '-'}</td>
                      <td>{response.age_group || '-'}</td>
                      <td>{response.gender || '-'}</td>
                      <td>{response.score?.toFixed(1) || '-'}</td>
                      <td>{response.tier || '-'}</td>
                      <td>{response.yes_count ?? '-'}</td>
                      <td>{response.selected_language || '-'}</td>
                      <td>{response.device_type || '-'}</td>
                      <td>{formatDuration(response.session_duration)}</td>
                      <td>{response.completed ? 'O' : 'X'}</td>
                    </tr>
                    {expandedRow === response.id && (
                      <tr className="detail-row">
                        <td colSpan={13}>
                          <div className="detail-content">
                            <div className="detail-section">
                              <h4>응답 상세</h4>
                              <div className="answers-grid">
                                {parseAnswers(response.answers).map((answer, idx) => (
                                  <span key={idx} className={`answer-badge ${answer ? 'yes' : 'no'}`}>
                                    Q{idx + 1}: {answer ? 'Yes' : 'No'}
                                  </span>
                                ))}
                              </div>
                            </div>
                            {(response.utm_source || response.utm_medium || response.utm_campaign) && (
                              <div className="detail-section">
                                <h4>UTM 파라미터</h4>
                                <p>
                                  {response.utm_source && <span>source: {response.utm_source} </span>}
                                  {response.utm_medium && <span>medium: {response.utm_medium} </span>}
                                  {response.utm_campaign && <span>campaign: {response.utm_campaign}</span>}
                                </p>
                              </div>
                            )}
                            <div className="detail-section">
                              <h4>퀴즈 소요시간</h4>
                              <p>총 {formatDuration(response.total_quiz_time)}</p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
          {responses.length === 0 && (
            <div className="no-data">아직 응답 데이터가 없습니다.</div>
          )}
        </div>
      )}
    </div>
  );
};
