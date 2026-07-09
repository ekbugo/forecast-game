import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { leaderboardAPI } from '../utils/api';
import { Trophy, Medal, Award, User } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';

function Leaderboard() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const [leaderboard, setLeaderboard] = useState(null);
  const [type, setType] = useState('all-time');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchLeaderboard() {
      setLoading(true);
      try {
        const response = await leaderboardAPI.get({ type, limit: 50 });
        setLeaderboard(response.data);
      } catch (err) {
        console.error('Error fetching leaderboard:', err);
        setError(t('errors.server'));
      } finally {
        setLoading(false);
      }
    }
    fetchLeaderboard();
  }, [type, t]);

  const getRankIcon = (rank) => {
    switch (rank) {
      case 1:
        return <Trophy className="w-6 h-6 text-yellow-500" />;
      case 2:
        return <Medal className="w-6 h-6 text-gray-400" />;
      case 3:
        return <Award className="w-6 h-6 text-amber-600" />;
      default:
        return <span className="w-6 text-center font-bold text-gray-500">{rank}</span>;
    }
  };

  const getRankStyle = (rank) => {
    switch (rank) {
      case 1:
        return 'bg-gradient-to-r from-yellow-50 to-yellow-100 border-yellow-300';
      case 2:
        return 'bg-gradient-to-r from-gray-50 to-gray-100 border-gray-300';
      case 3:
        return 'bg-gradient-to-r from-amber-50 to-amber-100 border-amber-300';
      default:
        return 'bg-white border-gray-200';
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center">
          <Trophy className="w-7 h-7 mr-2 text-yellow-500" />
          {t('leaderboard.title')}
        </h1>

        <div className="mt-4 sm:mt-0 flex bg-gray-100 rounded-lg p-1">
          {['all-time', 'weekly', 'monthly'].map((option) => (
            <button
              key={option}
              onClick={() => setType(option)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                type === option ? 'bg-white text-brand-700 shadow' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {t(`leaderboard.${option === 'all-time' ? 'allTime' : option}`)}
            </button>
          ))}
        </div>
      </div>

      {leaderboard?.userRank && (
        <div className="bg-brand-50 border border-brand-200 rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <User className="w-5 h-5 text-brand-600 mr-2" />
              <span className="font-medium text-brand-800">{t('leaderboard.yourRank')}</span>
            </div>
            <div className="text-right">
              <span className="text-2xl font-bold text-brand-700">#{leaderboard.userRank.rank}</span>
              <span className="text-brand-600 ml-2">({user?.totalPoints || 0} {t('common.points')})</span>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <LoadingSpinner message={t('common.loading')} />
      ) : error ? (
        <div className="text-center py-8 text-red-600">{error}</div>
      ) : leaderboard?.rankings?.length === 0 ? (
        <div className="text-center py-12 text-gray-500">{t('leaderboard.noData')}</div>
      ) : (
        <div className="space-y-3">
          {leaderboard?.rankings?.map((entry) => (
            <div
              key={entry.id}
              className={`flex items-center p-4 rounded-xl border ${getRankStyle(entry.rank)} ${
                entry.id === user?.id ? 'ring-2 ring-brand-500' : ''
              }`}
            >
              <div className="flex items-center justify-center w-10">{getRankIcon(entry.rank)}</div>
              <div className="flex-1 ml-4">
                <span className={`font-medium ${entry.rank <= 3 ? 'text-lg' : ''}`}>{entry.username}</span>
                {entry.id === user?.id && (
                  <span className="ml-2 text-xs bg-brand-200 text-brand-700 px-2 py-0.5 rounded-full">
                    {t('leaderboard.you')}
                  </span>
                )}
              </div>
              <div className="text-right">
                <span className={`font-bold ${entry.rank <= 3 ? 'text-xl' : 'text-lg'}`}>
                  {entry.totalPoints.toLocaleString()}
                </span>
                <span className="text-gray-500 text-sm ml-1">{t('common.points')}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {leaderboard?.pagination && leaderboard.pagination.total > leaderboard.pagination.limit && (
        <div className="mt-6 text-center text-sm text-gray-500">
          {leaderboard.rankings.length} {t('common.of')} {leaderboard.pagination.total}
        </div>
      )}
    </div>
  );
}

export default Leaderboard;
