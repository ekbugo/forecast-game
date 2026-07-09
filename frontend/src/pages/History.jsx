import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { scoreAPI, authAPI } from '../utils/api';
import { History as HistoryIcon, Thermometer, Wind, Droplets, Star, ChevronDown, ChevronUp, Lock } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';

function History() {
  const { t } = useTranslation();

  const [scores, setScores] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    async function fetchScores() {
      try {
        const response = await scoreAPI.getMyScores({ limit: 50 });
        setScores(response.data.scores);
        setSummary(response.data.summary);
      } catch (err) {
        console.error('Error fetching scores:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchScores();
  }, []);

  const getScoreColor = (score, max = 5) => {
    const p = score / max;
    if (p === 1) return 'text-green-600 bg-green-100';
    if (p >= 0.8) return 'text-blue-600 bg-blue-100';
    if (p >= 0.6) return 'text-yellow-600 bg-yellow-100';
    if (p >= 0.4) return 'text-orange-600 bg-orange-100';
    return 'text-red-600 bg-red-100';
  };

  const formatDate = (raw) => {
    try {
      const dateStr = String(raw).split('T')[0];
      const [y, m, d] = dateStr.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      return dt.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return String(raw);
    }
  };

  const actualPrecipText = (actual) =>
    actual.precipReported === false ? 'N/A' : `${actual.precipTotal}"`;

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');
    if (newPassword !== confirmNewPassword) {
      setPasswordError(t('auth.passwordsMustMatch'));
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError(t('auth.passwordMin'));
      return;
    }
    setChangingPassword(true);
    try {
      await authAPI.changePassword({ currentPassword, newPassword });
      setPasswordSuccess(t('auth.passwordChanged'));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setTimeout(() => setShowChangePassword(false), 2000);
    } catch (err) {
      if (err.response?.status === 401) setPasswordError(t('auth.currentPasswordIncorrect'));
      else setPasswordError(err.response?.data?.error || t('errors.server'));
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) return <LoadingSpinner message={t('common.loading')} />;

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 flex items-center mb-6">
        <HistoryIcon className="w-7 h-7 mr-2 text-brand-500" />
        {t('scores.title')}
      </h1>

      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <SummaryCard label={t('stats.totalPoints')} value={summary.totalPoints} valueClass="text-brand-600" />
          <SummaryCard label={t('stats.forecastsMade')} value={summary.totalScores} />
          <SummaryCard label={t('stats.avgScore')} value={summary.averageScore} />
          <SummaryCard
            label={t('stats.perfectForecasts')}
            value={<span className="flex items-center">{summary.perfectForecasts}<Star className="w-5 h-5 ml-1 text-purple-500" /></span>}
            valueClass="text-purple-600"
          />
        </div>
      )}

      {scores.length === 0 ? (
        <div className="text-center py-12 text-gray-500 bg-white rounded-xl">{t('scores.noScores')}</div>
      ) : (
        <div className="space-y-4">
          {scores.map((score) => (
            <div key={score.id} className="bg-white rounded-xl shadow-md overflow-hidden">
              <div onClick={() => setExpandedId(expandedId === score.id ? null : score.id)} className="p-4 cursor-pointer hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">{formatDate(score.date)}</p>
                    <p className="text-sm text-gray-500">{score.station.name} · <span className="font-mono">{score.station.id}</span></p>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="hidden sm:flex items-center space-x-2">
                      <ScoreBadge cls={getScoreColor(score.scores.maxTemp.score)}>{score.scores.maxTemp.score}/5</ScoreBadge>
                      <ScoreBadge cls={getScoreColor(score.scores.minTemp.score)}>{score.scores.minTemp.score}/5</ScoreBadge>
                      <ScoreBadge cls={getScoreColor(score.scores.windGust.score)}>{score.scores.windGust.score}/5</ScoreBadge>
                      <ScoreBadge cls={getScoreColor(score.scores.precip.score)}>{score.scores.precip.score}/5</ScoreBadge>
                    </div>
                    {score.scores.perfectBonus > 0 && <Star className="w-5 h-5 text-purple-500" />}
                    <div className="text-right min-w-[60px]">
                      <p className="text-xl font-bold text-brand-600">{score.scores.total}</p>
                      <p className="text-xs text-gray-500">{t('common.points')}</p>
                    </div>
                    {expandedId === score.id ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                  </div>
                </div>
              </div>

              {expandedId === score.id && (
                <div className="border-t bg-gray-50 p-4">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-semibold mb-3 text-gray-700">{t('scores.comparison')}</h4>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-gray-500">
                            <th className="text-left py-1">{t('scores.parameter')}</th>
                            <th className="text-center py-1">{t('scores.forecast')}</th>
                            <th className="text-center py-1">{t('scores.actual')}</th>
                            <th className="text-center py-1">Pts</th>
                          </tr>
                        </thead>
                        <tbody>
                          <CompareRow icon={<Thermometer className="w-4 h-4 text-red-500 mr-1" />} label={t('scores.maxTemp')} f={`${score.forecast.maxTemp}°F`} a={`${score.actual.maxTemp}°F`} s={score.scores.maxTemp.score} cls={getScoreColor(score.scores.maxTemp.score)} />
                          <CompareRow icon={<Thermometer className="w-4 h-4 text-blue-500 mr-1" />} label={t('scores.minTemp')} f={`${score.forecast.minTemp}°F`} a={`${score.actual.minTemp}°F`} s={score.scores.minTemp.score} cls={getScoreColor(score.scores.minTemp.score)} />
                          <CompareRow icon={<Wind className="w-4 h-4 text-gray-500 mr-1" />} label={t('scores.windGust')} f={`${score.forecast.windGust} mph`} a={`${score.actual.windGust} mph`} s={score.scores.windGust.score} cls={getScoreColor(score.scores.windGust.score)} />
                          <CompareRow icon={<Droplets className="w-4 h-4 text-blue-400 mr-1" />} label={t('scores.precip')} f={score.forecast.precipRangeDesc} a={actualPrecipText(score.actual)} s={score.scores.precip.score} cls={getScoreColor(score.scores.precip.score)} />
                        </tbody>
                      </table>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-3 text-gray-700">{t('scores.breakdown')}</h4>
                      <div className="space-y-2">
                        <BreakdownRow label={t('scores.maxTemp')} value={`${score.scores.maxTemp.score} pts`} />
                        <BreakdownRow label={t('scores.minTemp')} value={`${score.scores.minTemp.score} pts`} />
                        <BreakdownRow label={t('scores.windGust')} value={`${score.scores.windGust.score} pts`} />
                        <BreakdownRow label={t('scores.precip')} value={`${score.scores.precip.score} pts`} />
                        {score.scores.perfectBonus > 0 && (
                          <div className="flex justify-between text-purple-600 font-medium pt-2 border-t">
                            <span className="flex items-center"><Star className="w-4 h-4 mr-1" />{t('scores.perfectBonus')}</span>
                            <span>+{score.scores.perfectBonus} pts</span>
                          </div>
                        )}
                        <div className="flex justify-between pt-2 border-t font-bold text-lg">
                          <span>{t('scores.total')}</span>
                          <span className="text-brand-600">{score.scores.total} pts</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-8">
        <button
          onClick={() => { setShowChangePassword(!showChangePassword); setPasswordError(''); setPasswordSuccess(''); }}
          className="flex items-center text-gray-600 hover:text-brand-600 font-medium transition-colors"
        >
          <Lock className="w-4 h-4 mr-2" />
          {t('auth.changePassword')}
          {showChangePassword ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
        </button>

        {showChangePassword && (
          <form onSubmit={handleChangePassword} className="bg-white rounded-xl shadow-md p-6 mt-3 max-w-md">
            {passwordError && <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">{passwordError}</div>}
            {passwordSuccess && <div className="mb-4 p-3 bg-green-50 text-green-600 rounded-lg text-sm">{passwordSuccess}</div>}
            <PasswordInput label={t('auth.currentPassword')} value={currentPassword} onChange={setCurrentPassword} />
            <PasswordInput label={t('auth.newPassword')} value={newPassword} onChange={setNewPassword} minLength={8} />
            <PasswordInput label={t('auth.confirmNewPassword')} value={confirmNewPassword} onChange={setConfirmNewPassword} minLength={8} />
            <div className="flex space-x-3">
              <button type="submit" disabled={changingPassword} className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors disabled:opacity-50">
                {changingPassword ? t('common.loading') : t('auth.changePassword')}
              </button>
              <button type="button" onClick={() => setShowChangePassword(false)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors">
                {t('common.cancel')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, valueClass = 'text-gray-900' }) {
  return (
    <div className="bg-white rounded-xl shadow-md p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`text-2xl font-bold ${valueClass}`}>{value}</p>
    </div>
  );
}

function ScoreBadge({ cls, children }) {
  return <span className={`px-2 py-1 rounded text-xs font-medium ${cls}`}>{children}</span>;
}

function CompareRow({ icon, label, f, a, s, cls }) {
  return (
    <tr className="border-t">
      <td className="py-2 flex items-center">{icon}{label}</td>
      <td className="text-center">{f}</td>
      <td className="text-center">{a}</td>
      <td className="text-center"><span className={`px-2 py-0.5 rounded ${cls}`}>{s}</span></td>
    </tr>
  );
}

function BreakdownRow({ label, value }) {
  return (
    <div className="flex justify-between">
      <span>{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function PasswordInput({ label, value, onChange, minLength }) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        minLength={minLength}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
      />
    </div>
  );
}

export default History;
