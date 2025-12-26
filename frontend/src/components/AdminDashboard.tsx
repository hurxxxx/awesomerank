import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t, i18n } = useTranslation();
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
        throw new Error(t('API request failed'));
      }

      const statsData = await statsRes.json();
      const summaryData = await summaryRes.json();

      setResponses(statsData.responses || []);
      setSummary(summaryData);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Failed to load data'));
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString(i18n.language, {
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
      return t('{{minutes}} min {{seconds}} sec', { minutes, seconds: seconds % 60 });
    }
    return t('{{seconds}} sec', { seconds });
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
        <div className="admin-loading">{t('Loading data...')}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-dashboard">
        <div className="admin-error">
          <p>{error}</p>
          <button onClick={fetchData}>{t('Retry')}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <header className="admin-header">
        <h1>{t('Admin dashboard')}</h1>
        <button className="refresh-btn" onClick={fetchData}>
          {t('Refresh')}
        </button>
      </header>

      <div className="admin-tabs">
        <button
          className={`tab-btn ${activeTab === 'summary' ? 'active' : ''}`}
          onClick={() => setActiveTab('summary')}
        >
          {t('Summary')}
        </button>
        <button
          className={`tab-btn ${activeTab === 'responses' ? 'active' : ''}`}
          onClick={() => setActiveTab('responses')}
        >
          {t('Responses ({{count}})', { count: summary?.totalResponses || 0 })}
        </button>
      </div>

      {activeTab === 'summary' && summary && (
        <div className="admin-summary">
          <div className="summary-card total">
            <h3>{t('Total responses')}</h3>
            <p className="big-number">{summary.totalResponses.toLocaleString(i18n.language)}</p>
          </div>

          <div className="summary-grid">
            <div className="summary-card">
              <h3>{t('By country')}</h3>
              <ul className="stat-list">
                {summary.byCountry.slice(0, 10).map((item, idx) => (
                  <li key={idx}>
                    <span className="stat-label">{item.country || t('Unknown')}</span>
                    <span className="stat-value">{item.count.toLocaleString(i18n.language)}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="summary-card">
              <h3>{t('By age group')}</h3>
              <ul className="stat-list">
                {summary.byAgeGroup.map((item, idx) => (
                  <li key={idx}>
                    <span className="stat-label">{item.age_group || t('Not selected')}</span>
                    <span className="stat-value">{item.count.toLocaleString(i18n.language)}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="summary-card">
              <h3>{t('By gender')}</h3>
              <ul className="stat-list">
                {summary.byGender.map((item, idx) => (
                  <li key={idx}>
                    <span className="stat-label">{item.gender || t('Not selected')}</span>
                    <span className="stat-value">{item.count.toLocaleString(i18n.language)}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="summary-card">
              <h3>{t('By device')}</h3>
              <ul className="stat-list">
                {summary.byDevice.map((item, idx) => (
                  <li key={idx}>
                    <span className="stat-label">{item.device_type || t('Unknown')}</span>
                    <span className="stat-value">{item.count.toLocaleString(i18n.language)}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="summary-card">
              <h3>{t('By language')}</h3>
              <ul className="stat-list">
                {summary.byLanguage.slice(0, 10).map((item, idx) => (
                  <li key={idx}>
                    <span className="stat-label">{item.selected_language || t('Unknown')}</span>
                    <span className="stat-value">{item.count.toLocaleString(i18n.language)}</span>
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
                  <th>{t('ID')}</th>
                  <th>{t('Time')}</th>
                  <th>{t('Country')}</th>
                  <th>{t('City')}</th>
                  <th>{t('Age')}</th>
                  <th>{t('Gender')}</th>
                  <th>{t('Score')}</th>
                  <th>{t('Tier')}</th>
                  <th>{t('YES')}</th>
                  <th>{t('Language')}</th>
                  <th>{t('Device')}</th>
                  <th>{t('Session duration')}</th>
                  <th>{t('Completed')}</th>
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
                      <td>{response.completed ? t('YES') : t('NO')}</td>
                    </tr>
                    {expandedRow === response.id && (
                      <tr className="detail-row">
                        <td colSpan={13}>
                          <div className="detail-content">
                            <div className="detail-section">
                              <h4>{t('Response details')}</h4>
                              <div className="answers-grid">
                                {parseAnswers(response.answers).map((answer, idx) => (
                                  <span key={idx} className={`answer-badge ${answer ? 'yes' : 'no'}`}>
                                    Q{idx + 1}: {answer ? t('YES') : t('NO')}
                                  </span>
                                ))}
                              </div>
                            </div>
                            {(response.utm_source || response.utm_medium || response.utm_campaign) && (
                              <div className="detail-section">
                                <h4>{t('UTM parameters')}</h4>
                                <p>
                                  {response.utm_source && <span>{t('UTM source')}: {response.utm_source} </span>}
                                  {response.utm_medium && <span>{t('UTM medium')}: {response.utm_medium} </span>}
                                  {response.utm_campaign && <span>{t('UTM campaign')}: {response.utm_campaign}</span>}
                                </p>
                              </div>
                            )}
                            <div className="detail-section">
                              <h4>{t('Quiz duration')}</h4>
                              <p>{t('Total {{duration}}', { duration: formatDuration(response.total_quiz_time) })}</p>
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
            <div className="no-data">{t('No response data yet.')}</div>
          )}
        </div>
      )}
    </div>
  );
};
