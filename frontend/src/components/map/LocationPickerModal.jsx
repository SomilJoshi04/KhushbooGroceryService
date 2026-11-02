/**
 * Reusable Location Picker Modal with Leaflet Map and OpenStreetMap Nominatim.
 *
 * Provider-Independent:
 * - Search autocomplete with 350ms debouncing.
 * - Interactive Leaflet map container with panning/zooming.
 * - Draggable location marker with reverse geocode on change.
 * - Confirmed address return payload with structured fields.
 *
 * @module components/map/LocationPickerModal
 */

import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import {
  Search,
  MapPin,
  X,
  Check,
  Loader2,
  Navigation,
  AlertCircle,
  Compass,
} from 'lucide-react';
import {
  searchPlaces,
  reverseGeocode,
  DEFAULT_MAP_CENTER,
} from '../../services/mapProvider.js';

// Custom SVG map marker pin in Khushboo deep forest green
const createCustomPinIcon = () => {
  const svgString = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="36" height="36" fill="#245C43">
      <path d="M12 0C7.58 0 4 3.58 4 8c0 5.25 7.15 14.33 7.45 14.72a.75.75 0 0 0 1.1 0C12.85 22.33 20 13.25 20 8c0-4.42-3.58-8-8-8zm0 11.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z"/>
    </svg>
  `;
  return L.divIcon({
    html: svgString,
    className: 'khushboo-custom-pin',
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -36],
  });
};

export function LocationPickerModal({
  isOpen,
  onClose,
  onLocationSelect,
  initialCoordinates,
  title = 'Select Location on Map',
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Initial coordinates or default Indore
  const initialLat = initialCoordinates?.lat || DEFAULT_MAP_CENTER.lat;
  const initialLng = initialCoordinates?.lng || DEFAULT_MAP_CENTER.lng;

  // Initialize or update map when modal opens
  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => {
      if (!mapContainerRef.current) return;

      // Clean up previous instance if any
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      const map = L.map(mapContainerRef.current, {
        center: [initialLat, initialLng],
        zoom: 14,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      const pinIcon = createCustomPinIcon();
      const marker = L.marker([initialLat, initialLng], {
        icon: pinIcon,
        draggable: true,
      }).addTo(map);

      markerRef.current = marker;
      mapInstanceRef.current = map;

      // Perform initial reverse geocode for current position
      handleMarkerMoved(initialLat, initialLng);

      // Handle marker drag end
      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        handleMarkerMoved(pos.lat, pos.lng);
      });

      // Handle map click to reposition marker
      map.on('click', (e) => {
        marker.setLatLng(e.latlng);
        handleMarkerMoved(e.latlng.lat, e.latlng.lng);
      });
    }, 150);

    return () => {
      clearTimeout(timer);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [isOpen]);

  // Marker reposition & reverse geocode handler
  const handleMarkerMoved = async (lat, lng) => {
    setIsGeocoding(true);
    setErrorMsg('');
    try {
      const geoResult = await reverseGeocode(lat, lng);
      if (geoResult) {
        setSelectedLocation(geoResult);
      }
    } catch {
      setErrorMsg('Could not resolve street address for this pin position. You can manually enter details.');
    } finally {
      setIsGeocoding(false);
    }
  };

  // Debounced search autocomplete
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchPlaces(searchQuery);
        setSuggestions(results);
      } catch {
        setSuggestions([]);
      } finally {
        setIsSearching(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Handle suggestion selection
  const handleSelectSuggestion = (place) => {
    setSearchQuery('');
    setSuggestions([]);
    setSelectedLocation(place);

    if (mapInstanceRef.current && markerRef.current) {
      const { lat, lng } = place.coordinates;
      mapInstanceRef.current.setView([lat, lng], 16, { animate: true });
      markerRef.current.setLatLng([lat, lng]);
    }
  };

  // Locate user using browser geolocation
  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      setErrorMsg('Geolocation is not supported by your browser.');
      return;
    }

    setIsGeocoding(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        if (mapInstanceRef.current && markerRef.current) {
          mapInstanceRef.current.setView([latitude, longitude], 16, { animate: true });
          markerRef.current.setLatLng([latitude, longitude]);
        }
        handleMarkerMoved(latitude, longitude);
      },
      () => {
        setIsGeocoding(false);
        setErrorMsg('Could not detect location. Please search your colony or landmark.');
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const handleConfirm = () => {
    if (!selectedLocation) return;
    onLocationSelect(selectedLocation);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-text-main/50 backdrop-blur-xs animate-fadeIn">
      <div className="bg-surface rounded-2xl border border-border-neutral shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-border-neutral flex items-center justify-between bg-surface-subtle">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand/10 text-brand flex items-center justify-center">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold font-heading text-text-main leading-tight">{title}</h3>
              <p className="text-[11px] text-text-muted">Drag the green pin or search your colony in Indore</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-main hover:bg-surface transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search Bar with Autocomplete suggestions */}
        <div className="p-3 border-b border-border-neutral bg-surface relative z-20">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search colony, street, or landmark (e.g. Vijay Nagar, Geeta Bhawan, Rau)..."
                className="w-full pl-9 pr-8 py-2 bg-primary-bg border border-border-neutral rounded-xl text-xs text-text-main placeholder:text-text-muted focus:outline-none focus:border-brand"
              />
              {isSearching && (
                <Loader2 className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-brand animate-spin" />
              )}
            </div>

            <button
              type="button"
              onClick={handleLocateMe}
              className="px-3 py-2 bg-surface hover:bg-surface-subtle border border-border-neutral rounded-xl text-xs font-semibold text-brand flex items-center gap-1.5 transition shadow-xs"
              title="Use current GPS location"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Locate Me</span>
            </button>
          </div>

          {/* Autocomplete dropdown */}
          {suggestions.length > 0 && (
            <div className="absolute left-3 right-3 top-full mt-1 bg-surface border border-border-neutral rounded-xl shadow-lg max-h-56 overflow-y-auto z-30 divide-y divide-border-neutral">
              {suggestions.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectSuggestion(item)}
                  className="w-full px-3.5 py-2.5 text-left text-xs hover:bg-surface-subtle transition flex items-start gap-2.5 group"
                >
                  <MapPin className="w-3.5 h-3.5 text-brand shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-text-main block">{item.name}</span>
                    <span className="text-[11px] text-text-muted block truncate max-w-md">
                      {item.formattedAddress}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Map Container */}
        <div className="relative flex-1 min-h-[300px] sm:min-h-[340px] bg-primary-bg">
          <div ref={mapContainerRef} className="w-full h-full" />

          {/* Geocoding / Loading Overlay pill */}
          {isGeocoding && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 bg-surface/90 backdrop-blur-xs border border-border-neutral px-3 py-1 rounded-full text-xs font-medium text-brand flex items-center gap-1.5 shadow-sm">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Fetching street address...</span>
            </div>
          )}
        </div>

        {/* Location Summary and Action Buttons */}
        <div className="p-4 border-t border-border-neutral bg-surface space-y-3">
          {errorMsg && (
            <div className="p-2.5 bg-status-error/10 border border-status-error/20 rounded-xl text-xs text-status-error flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {selectedLocation ? (
            <div className="p-3 bg-surface-subtle border border-border-neutral rounded-xl flex items-start gap-2.5">
              <Compass className="w-4 h-4 text-brand shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-brand block">
                  Selected Position
                </span>
                <p className="text-xs font-semibold text-text-main line-clamp-2">
                  {selectedLocation.formattedAddress}
                </p>
                <div className="flex flex-wrap gap-2 text-[10px] text-text-muted mt-1 font-mono">
                  <span>Lat: {selectedLocation.coordinates?.lat?.toFixed(5)}</span>
                  <span>•</span>
                  <span>Lng: {selectedLocation.coordinates?.lng?.toFixed(5)}</span>
                  {selectedLocation.pincode && (
                    <>
                      <span>•</span>
                      <span className="font-semibold text-brand">PIN: {selectedLocation.pincode}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-surface-subtle border border-border-neutral rounded-xl text-xs text-text-muted">
              Click or drag the pin marker on the map to choose your doorstep delivery location.
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-border-neutral text-xs font-semibold text-text-muted hover:text-text-main rounded-xl hover:bg-surface-subtle transition"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!selectedLocation || isGeocoding}
              onClick={handleConfirm}
              className="px-5 py-2 bg-brand hover:bg-brand-hover text-white text-xs font-bold rounded-xl transition shadow-xs flex items-center gap-1.5 disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Use This Location</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
