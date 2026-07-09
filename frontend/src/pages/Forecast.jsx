import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { stationAPI, forecastAPI } from '../utils/api';
import { Thermometer, Wind, Droplets, Clock, CheckCircle, AlertCircle, Send, Info } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import StationLabel from '../components/StationLabel';

function Forecast() {
  const { t } = useTranslation();

  const [current, setCurrent] = useState(null); // { station, forecastDate, isOpen, closesAt, remainingMinutes, stationTimezone }
  const [status, setStatus] = useState(null); // { precipRanges, ... }
  const [existingForecast, setExistingForecast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({ maxTemp: '', minTemp: '', windGust: '', precipRange: 1 });

  useEffect(() => {
    async function fetchData() {
      try {
        const [currentRes, statusRes, todayRes] = await Promise.all([
          stationAPI.getCurrent(),
          forecastAPI.getStatus(),
          forecastAPI.getToday()
        ]);
        setCurrent(currentRes.data);
        setStatus(statusRes.data);
        setExistingForecast(todayRes.data.forecast);
      } catch (err) {
        console.error('Error fetching forecast data:', err);
        setError(t('errors.server'));
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [t]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value === '' ? '' : parseInt(value) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    if (formData.minTemp !== '' && formData.maxTemp !== '' && formData.minTemp >= formData.maxTemp) {
      setError('Min temperature must be less than max temperature');
      setSubmitting(false);
      return;
    }

    try {
      const response = await forecastAPI.submit(formData);
      setExistingForecast(response.data.forecast);
    } catch (err) {
      setError(err.response?.data?.error || t('errors.server'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingSpinner message={t('common.loading')} />;

  const station = current?.station;
  const precipNotReported = station && station.precipReported === false;

  // Already submitted view
  if (existingForecast) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl shadow-md p-8 text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('forecast.submitted')}</h1>
          <p className="text-gray-500 mb-6">{t('forecast.alreadySubmitted')}</p>

          <div className="bg-gray-50 rounded-lg p-6 text-left">
            <h3 className="font-semibold mb-4">
              {t('forecast.yourForecastFor')} {existingForecast.forecastDate?.split('T')[0]} · {existingForecast.station}
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <Stat icon={<Thermometer className="w-5 h-5 text-red-500 mr-2" />} label={t('forecast.maxTemp')} value={`${existingForecast.maxTemp}°F`} />
              <Stat icon={<Thermometer className="w-5 h-5 text-blue-500 mr-2" />} label={t('forecast.minTemp')} value={`${existingForecast.minTemp}°F`} />
              <Stat icon={<Wind className="w-5 h-5 text-gray-500 mr-2" />} label={t('forecast.windGust')} value={`${existingForecast.windGust} mph`} />
              <Stat icon={<Droplets className="w-5 h-5 text-blue-400 mr-2" />} label={t('forecast.precipitation')} value={existingForecast.precipRangeDesc} />
            </div>
            <p className="text-xs text-gray-400 mt-4">
              {t('forecast.submittedAt')}: {new Date(existingForecast.submittedAt).toLocaleString()}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // No station scheduled
  if (!station) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl shadow-md p-8 text-center">
          <Clock className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('forecast.noStation')}</h1>
          <p className="text-gray-500">{t('forecast.noStationDesc')}</p>
        </div>
      </div>
    );
  }

  // Window closed
  if (!current?.isOpen) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl shadow-md p-8 text-center">
          <Clock className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('forecast.closed')}</h1>
          <p className="text-gray-500">
            {t('forecast.closesLocal', { tz: current?.stationTimezone || station.timezone })}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="bg-brand-600 text-white p-6">
          <h1 className="text-2xl font-bold">{t('forecast.title')}</h1>
          <p className="text-brand-100 text-sm mt-1">{t('forecast.currentStation')}</p>
          <StationLabel station={station} className="mt-2 text-white" />

          <div className="flex items-center mt-3">
            <Clock className="w-4 h-4 mr-1" />
            <span>{t('forecast.forDate')}: {current.forecastDate}</span>
          </div>

          <div className="mt-3 text-sm bg-brand-500 rounded px-3 py-1 inline-block">
            {t('forecast.remaining')}: {current.remainingMinutes} {t('forecast.minutes')}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center text-red-700">
              <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <NumberField
            icon={<Thermometer className="w-5 h-5 mr-2 text-red-500" />}
            label={`${t('forecast.maxTemp')} (°F)`}
            name="maxTemp"
            value={formData.maxTemp}
            onChange={handleChange}
            min={-60}
            max={140}
          />
          <NumberField
            icon={<Thermometer className="w-5 h-5 mr-2 text-blue-500" />}
            label={`${t('forecast.minTemp')} (°F)`}
            name="minTemp"
            value={formData.minTemp}
            onChange={handleChange}
            min={-80}
            max={120}
          />
          <NumberField
            icon={<Wind className="w-5 h-5 mr-2 text-gray-500" />}
            label={`${t('forecast.windGust')} (mph)`}
            name="windGust"
            value={formData.windGust}
            onChange={handleChange}
            min={0}
            max={250}
          />

          <div>
            <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
              <Droplets className="w-5 h-5 mr-2 text-blue-400" />
              {t('forecast.precipBucket')}
            </label>
            <select
              name="precipRange"
              value={formData.precipRange}
              onChange={handleChange}
              required
              disabled={precipNotReported}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent text-lg disabled:bg-gray-100 disabled:text-gray-400"
            >
              {status?.precipRanges?.map((range) => (
                <option key={range.value} value={range.value}>
                  {t('home.range')} {range.value}: {range.label}
                </option>
              ))}
            </select>
            {precipNotReported && (
              <p className="mt-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 flex items-start">
                <Info className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                {t('station.naTooltip')}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-4 bg-brand-500 text-white font-semibold rounded-lg hover:bg-brand-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {submitting ? (
              t('common.loading')
            ) : (
              <>
                <Send className="w-5 h-5 mr-2" />
                {t('forecast.submit')}
              </>
            )}
          </button>

          <p className="text-xs text-gray-500 text-center">{t('forecast.oncePerDay')}</p>
        </form>
      </div>
    </div>
  );
}

function Stat({ icon, label, value }) {
  return (
    <div className="flex items-center">
      {icon}
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="font-semibold">{value}</p>
      </div>
    </div>
  );
}

function NumberField({ icon, label, name, value, onChange, min, max }) {
  return (
    <div>
      <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
        {icon}
        {label}
      </label>
      <input
        type="number"
        name={name}
        value={value}
        onChange={onChange}
        min={min}
        max={max}
        required
        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent text-lg"
      />
      <div className="mt-2 flex justify-between text-xs text-gray-500">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

export default Forecast;
