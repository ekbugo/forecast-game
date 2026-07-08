import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { stationAPI, leaderboardAPI } from '../utils/api';
import { Cloud, Trophy, Clock, ArrowRight, Thermometer, Wind, Droplets, Star, Info } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import StationLabel from '../components/StationLabel';

function Home() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const [current, setCurrent] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [currentRes, statsRes] = await Promise.all([
          stationAPI.getCurrent().catch(() => null),
          leaderboardAPI.getStats().catch(() => null)
        ]);
        setCurrent(currentRes?.data);
        setStats(statsRes?.data?.stats);
      } catch (err) {
        console.error('Error fetching home data:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) return <LoadingSpinner message={t('common.loading')} />;

  const station = current?.station;

  return (
    <div className="space-y-8">
      <div className="bg-gradient-to-r from-brand-600 to-brand-800 rounded-2xl p-8 text-white">
        <div className="max-w-2xl">
          <h1 className="text-3xl sm:text-4xl font-bold mb-4">{t('app.title')}</h1>
          <p className="text-brand-100 text-lg mb-6">{t('app.tagline')} · {t('app.dataSource')}</p>
          {!isAuthenticated ? (
            <div className="flex flex-wrap gap-4">
              <Link to="/register" className="px-6 py-3 bg-white text-brand-700 font-semibold rounded-lg hover:bg-brand-50 transition-colors">
                {t('nav.register')}
              </Link>
              <Link to="/leaderboard" className="px-6 py-3 border-2 border-white text-white font-semibold rounded-lg hover:bg-white/10 transition-colors">
                {t('nav.leaderboard')}
              </Link>
            </div>
          ) : (
            <Link to="/forecast" className="inline-flex items-center px-6 py-3 bg-white text-brand-700 font-semibold rounded-lg hover:bg-brand-50 transition-colors">
              {t('nav.forecast')}
              <ArrowRight className="ml-2 w-5 h-5" />
            </Link>
          )}
        </div>
      </div>

      {station && (
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('forecast.currentStation')}</h2>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <StationLabel station={station} className="text-brand-700" />
            {current?.isOpen ? (
              <div className="flex items-center space-x-2 text-green-600">
                <Clock className="w-5 h-5" />
                <span className="font-medium">
                  {t('forecast.closesLocal', { tz: current.stationTimezone || station.timezone })}
                </span>
              </div>
            ) : (
              <span className="text-gray-400">{t('forecast.closed')}</span>
            )}
          </div>
          {station.precipReported === false && (
            <p className="mt-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 flex items-start">
              <Info className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
              {t('station.naTooltip')}
            </p>
          )}
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label={t('stats.totalPoints')} value={stats.totalPoints?.toLocaleString()} icon={<Trophy className="w-10 h-10 text-yellow-500" />} />
          <StatCard label={t('stats.forecastsMade')} value={stats.totalForecasts?.toLocaleString()} icon={<Cloud className="w-10 h-10 text-brand-500" />} />
          <StatCard label={t('stats.avgScore')} value={stats.averageScore} icon={<Thermometer className="w-10 h-10 text-red-500" />} />
          <StatCard label={t('stats.perfectForecasts')} value={stats.perfectForecasts} icon={<Star className="w-10 h-10 text-purple-500" />} />
        </div>
      )}

      <div className="bg-white rounded-xl shadow-md p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">{t('home.howItWorks')}</h2>
        <div className="grid md:grid-cols-4 gap-6">
          <Step icon={<Thermometer className="w-6 h-6 text-brand-600" />} title={t('home.step1Title')} desc={t('home.step1Desc')} />
          <Step icon={<Clock className="w-6 h-6 text-brand-600" />} title={t('home.step2Title')} desc={t('home.step2Desc')} />
          <Step icon={<Cloud className="w-6 h-6 text-brand-600" />} title={t('home.step3Title')} desc={t('home.step3Desc')} />
          <Step icon={<Trophy className="w-6 h-6 text-brand-600" />} title={t('home.step4Title')} desc={t('home.step4Desc')} />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-md p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">{t('home.scoringSystem')}</h2>
        <div className="grid md:grid-cols-3 gap-6">
          <ScoreTable
            title={t('home.temperature')}
            icon={<Thermometer className="w-5 h-5 mr-2 text-red-500" />}
            rows={[
              [`${t('home.exact')} (0°F)`, '5 pts'],
              ['±1°F', '4 pts'],
              ['±2°F', '3 pts'],
              ['±3°F', '2 pts'],
              ['±4°F', '1 pt'],
              [`±5°F ${t('home.orMore')}`, '0 pts']
            ]}
          />
          <ScoreTable
            title={t('home.windGust')}
            icon={<Wind className="w-5 h-5 mr-2 text-blue-500" />}
            rows={[
              [`${t('home.exact')} (0-1 mph)`, '5 pts'],
              ['±2-3 mph', '4 pts'],
              ['±4-5 mph', '3 pts'],
              ['±6-9 mph', '2 pts'],
              ['±10-13 mph', '1 pt'],
              [`±14 mph ${t('home.orMore')}`, '0 pts']
            ]}
          />
          <ScoreTable
            title={t('home.precipitation')}
            icon={<Droplets className="w-5 h-5 mr-2 text-blue-400" />}
            rows={[
              [`0 ${t('home.rangesDiff')}`, '5 pts'],
              [`1 ${t('home.rangeDiff')}`, '4 pts'],
              [`2 ${t('home.rangesDiff')}`, '3 pts'],
              [`3 ${t('home.rangesDiff')}`, '2 pts'],
              [`4 ${t('home.rangesDiff')}`, '1 pt'],
              [`5+ ${t('home.rangesDiff')}`, '0 pts']
            ]}
          />
        </div>

        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <h4 className="font-semibold text-blue-900 mb-3 flex items-center">
            <Droplets className="w-5 h-5 mr-2 text-blue-600" />
            {t('home.precipRangesTitle')}
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-blue-800">
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <div key={n} className={n === 7 ? 'md:col-span-2' : ''}>
                <span className="font-medium">{t('home.range')} {n}:</span> {t(`forecast.precipRanges.${n}`)}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 p-4 bg-purple-50 rounded-lg">
          <div className="flex items-center">
            <Star className="w-6 h-6 text-purple-500 mr-2" />
            <span className="font-semibold text-purple-700">{t('home.perfectBonusTitle')}</span>
          </div>
          <p className="text-sm text-purple-600 mt-1">{t('home.perfectBonusDesc')}</p>
        </div>

        <div className="mt-4 p-4 bg-amber-50 rounded-lg">
          <div className="flex items-center">
            <Info className="w-6 h-6 text-amber-500 mr-2" />
            <span className="font-semibold text-amber-700">{t('home.precipNaTitle')}</span>
          </div>
          <p className="text-sm text-amber-600 mt-1">{t('home.precipNaDesc')}</p>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon }) {
  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
        {icon}
      </div>
    </div>
  );
}

function Step({ icon, title, desc }) {
  return (
    <div className="text-center">
      <div className="w-12 h-12 bg-brand-100 rounded-full flex items-center justify-center mx-auto mb-3">{icon}</div>
      <h3 className="font-semibold mb-2">{title}</h3>
      <p className="text-sm text-gray-500">{desc}</p>
    </div>
  );
}

function ScoreTable({ title, icon, rows }) {
  return (
    <div>
      <h3 className="font-semibold mb-3 flex items-center">
        {icon}
        {title}
      </h3>
      <table className="w-full text-sm">
        <tbody>
          {rows.map(([label, pts], i) => (
            <tr key={i} className={i < rows.length - 1 ? 'border-b' : ''}>
              <td className="py-1">{label}</td>
              <td className="text-right font-medium">{pts}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Home;
