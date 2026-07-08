import { Outlet, Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { Cloud, House, TrendingUpDown, Trophy, History, LogOut, Menu, X, Globe, User } from 'lucide-react';
import { useState } from 'react';

function Layout() {
  const { t, i18n } = useTranslation();
  const { user, isAuthenticated, logout } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === 'es' ? 'en' : 'es');
  };

  const navItems = [
    { path: '/', label: t('nav.home'), icon: House },
    { path: '/forecast', label: t('nav.forecast'), icon: TrendingUpDown, protected: true },
    { path: '/leaderboard', label: t('nav.leaderboard'), icon: Trophy },
    { path: '/history', label: t('nav.history'), icon: History, protected: true }
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 to-blue-100">
      <header className="bg-white shadow-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="flex items-center space-x-2">
              <Cloud className="w-9 h-9 text-brand-500" />
              <span className="font-bold text-xl text-brand-900 hidden sm:block">Forecast Game</span>
            </Link>

            <nav className="hidden md:flex items-center space-x-4">
              {navItems.map((item) => {
                if (item.protected && !isAuthenticated) return null;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center space-x-1 px-3 py-2 rounded-lg transition-colors ${
                      isActive(item.path) ? 'bg-brand-100 text-brand-700' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="flex items-center space-x-2">
              <button
                onClick={toggleLanguage}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                title={i18n.language === 'es' ? 'Switch to English' : 'Cambiar a Español'}
              >
                <Globe className="w-5 h-5" />
                <span className="sr-only">{i18n.language === 'es' ? 'EN' : 'ES'}</span>
              </button>

              {isAuthenticated ? (
                <div className="flex items-center space-x-2">
                  <div className="hidden sm:flex items-center space-x-2 px-3 py-1 bg-brand-50 rounded-lg">
                    <User className="w-4 h-4 text-brand-600" />
                    <span className="text-sm font-medium text-brand-700">{user?.username}</span>
                    <span className="text-xs bg-brand-200 text-brand-800 px-2 py-0.5 rounded-full">
                      {user?.totalPoints || 0} pts
                    </span>
                  </div>
                  <button
                    onClick={logout}
                    className="p-2 text-gray-600 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors"
                    title={t('nav.logout')}
                  >
                    <LogOut className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <div className="hidden sm:flex items-center space-x-2">
                  <Link to="/login" className="px-4 py-2 text-brand-600 hover:bg-brand-50 rounded-lg transition-colors">
                    {t('nav.login')}
                  </Link>
                  <Link to="/register" className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors">
                    {t('nav.register')}
                  </Link>
                </div>
              )}

              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t bg-white">
            <nav className="px-4 py-2 space-y-1">
              {navItems.map((item) => {
                if (item.protected && !isAuthenticated) return null;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center space-x-2 px-3 py-2 rounded-lg ${
                      isActive(item.path) ? 'bg-brand-100 text-brand-700' : 'text-gray-600'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}

              {!isAuthenticated && (
                <div className="pt-2 border-t space-y-1">
                  <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 text-brand-600">
                    {t('nav.login')}
                  </Link>
                  <Link
                    to="/register"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block px-3 py-2 bg-brand-500 text-white rounded-lg text-center"
                  >
                    {t('nav.register')}
                  </Link>
                </div>
              )}
            </nav>
          </div>
        )}
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>

      <footer className="bg-white border-t mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row justify-between items-center text-sm text-gray-500">
            <p>© 2026 Forecast Game</p>
            <p className="mt-2 sm:mt-0">{t('app.tagline')} · {t('app.dataSource')}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Layout;
