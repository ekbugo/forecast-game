import { MapPin } from 'lucide-react';

/**
 * Shows a friendly city / airport label alongside the raw NWS station ID.
 * e.g. "Denver International Airport — Denver, CO"  ·  ID: KDEN
 */
function StationLabel({ station, className = '' }) {
  if (!station) return null;
  const place = [station.city, station.state].filter(Boolean).join(', ');
  return (
    <div className={className}>
      <div className="flex items-center">
        <MapPin className="w-4 h-4 mr-1 flex-shrink-0" />
        <span className="font-semibold">{station.name}</span>
      </div>
      <div className="text-sm opacity-80">
        {place && <span>{place} · </span>}
        <span className="font-mono">{station.id}</span>
      </div>
    </div>
  );
}

export default StationLabel;
