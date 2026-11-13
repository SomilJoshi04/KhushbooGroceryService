/**
 * Reusable Location Picker Modal with Multi-Provider Support (Google Maps Platform & Leaflet).
 *
 * Implements:
 * - Dynamic provider rendering: Google Maps JS SDK when configured, or Leaflet OSM fallback.
 * - Draggable pin marker with debounced reverse geocoding on drag-end.
 * - Search autocomplete with 350ms debouncing, minimum 2-character threshold, and stale-request cancellation.
 * - Reverse-geocode race condition protection using request sequence counter.
 * - GPS geolocation with accuracy telemetry, permission recovery, and manual adjustment notice.
 * - Explicit location confirmation step (search selection vs explicit confirmation).
 * - Safe coordinate validation: never defaults to 0,0 or fabricated locations.
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
  AlertTriangle,
} from 'lucide-react';
import {
  searchPlaces,
  reverseGeocode,
  getCurrentBrowserLocation,
  getActiveProvider,
  loadGoogleMapsSDK,
  DEFAULT_MAP_CENTER,
} from '../../services/mapProvider.js';
import { validateCoordinates } from '../../utils/coordinateValidator.js';

// Custom SVG map marker pin in Khushboo deep forest green (for Leaflet)
const createLeafletPinIcon = () => {
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
  const leafletMapRef = useRef(null);
  const leafletMarkerRef = useRef(null);
  const googleMapRef = useRef(null);
  const googleMarkerRef = useRef(null);
  const searchAbortRef = useRef(null);
  const reverseAbortRef = useRef(null);
  const activeReverseSeqRef = useRef(0);

  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [accuracyNotice, setAccuracyNotice] = useState('');

  // Validate initial coordinates safely
  const coordCheck = validateCoordinates(initialCoordinates);
  const initialLat = coordCheck.valid && coordCheck.normalized ? coordCheck.normalized.lat : DEFAULT_MAP_CENTER.lat;
  const initialLng = coordCheck.valid && coordCheck.normalized ? coordCheck.normalized.lng : DEFAULT_MAP_CENTER.lng;

  // Cleanup helper for both providers
  const destroyCurrentMap = () => {
    if (leafletMapRef.current) {
      leafletMapRef.current.remove();
      leafletMapRef.current = null;
      leafletMarkerRef.current = null;
    }
    if (googleMarkerRef.current) {
      googleMarkerRef.current.setMap(null);
      googleMarkerRef.current = null;
    }
    googleMapRef.current = null;
  };

  // Center & reposition map and marker across active provider
  const setMapPosition = (lat, lng, zoom = 16) => {
    if (googleMapRef.current && googleMarkerRef.current) {
      const pos = { lat, lng };
      googleMapRef.current.setCenter(pos);
      googleMapRef.current.setZoom(zoom);
      googleMarkerRef.current.setPosition(pos);
    } else if (leafletMapRef.current && leafletMarkerRef.current) {
      leafletMapRef.current.setView([lat, lng], zoom, { animate: true });
      leafletMarkerRef.current.setLatLng([lat, lng]);
    }
  };

  // Reverse geocode handler with race condition sequencing
  const handleMarkerMoved = async (lat, lng) => {
    const currentSeq = ++activeReverseSeqRef.current;
    if (reverseAbortRef.current) {
      reverseAbortRef.current.abort();
    }
    reverseAbortRef.current = new AbortController();

    setIsGeocoding(true);
    setErrorMsg('');

    try {
      const geoResult = await reverseGeocode(lat, lng, reverseAbortRef.current.signal);
      // Ignore if a newer movement was dispatched
      if (currentSeq !== activeReverseSeqRef.current) {
        return;
      }

      if (geoResult) {
        setSelectedLocation(geoResult);
      }
    } catch (err) {
      if (err.name !== 'AbortError' && currentSeq === activeReverseSeqRef.current) {
        setErrorMsg('Could not resolve street address for this pin position. You can manually enter details.');
      }
    } finally {
      if (currentSeq === activeReverseSeqRef.current) {
        setIsGeocoding(false);
      }
    }
  };

  // Initialize Map container when modal opens
  useEffect(() => {
    if (!isOpen) {
      destroyCurrentMap();
      setSuggestions([]);
      setSearchQuery('');
      setAccuracyNotice('');
      setErrorMsg('');
      return;
    }

    let isCancelled = false;
    const timer = setTimeout(async () => {
      if (!mapContainerRef.current || isCancelled) return;

      destroyCurrentMap();
      const provider = getActiveProvider();

      if (provider === 'google') {
        try {
          const maps = await loadGoogleMapsSDK();
          if (isCancelled || !mapContainerRef.current) return;

          const map = new maps.Map(mapContainerRef.current, {
            center: { lat: initialLat, lng: initialLng },
            zoom: 15,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
            gestureHandling: 'greedy',
          });

          const marker = new maps.Marker({
            position: { lat: initialLat, lng: initialLng },
            map,
            draggable: true,
            title: 'Khushboo Delivery Location',
          });

          marker.addListener('dragend', () => {
            const pos = marker.getPosition();
            if (pos) {
              handleMarkerMoved(pos.lat(), pos.lng());
            }
          });

          map.addListener('click', (e) => {
            if (e.latLng) {
              marker.setPosition(e.latLng);
              handleMarkerMoved(e.latLng.lat(), e.latLng.lng());
            }
          });

          googleMapRef.current = map;
          googleMarkerRef.current = marker;

          // Initial reverse geocode
          handleMarkerMoved(initialLat, initialLng);
          return;
        } catch (sdkErr) {
          console.warn('[LocationPickerModal] Google Maps failed to load, falling back to Leaflet:', sdkErr.message);
          // Fall through to Leaflet initialization
        }
      }

      // Leaflet Initialization
      if (isCancelled || !mapContainerRef.current) return;

      const map = L.map(mapContainerRef.current, {
        center: [initialLat, initialLng],
        zoom: 14,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      const pinIcon = createLeafletPinIcon();
      const marker = L.marker([initialLat, initialLng], {
        icon: pinIcon,
        draggable: true,
      }).addTo(map);

      leafletMarkerRef.current = marker;
      leafletMapRef.current = map;

      // Handle marker dragend
      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        handleMarkerMoved(pos.lat, pos.lng);
      });

      // Handle map click
      map.on('click', (e) => {
        marker.setLatLng(e.latlng);
        handleMarkerMoved(e.latlng.lat, e.latlng.lng);
      });

      // Initial reverse geocode
      handleMarkerMoved(initialLat, initialLng);
    }, 150);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
      if (searchAbortRef.current) searchAbortRef.current.abort();
      if (reverseAbortRef.current) reverseAbortRef.current.abort();
      destroyCurrentMap();
    };
  }, [isOpen]);

  // Debounced search autocomplete (350ms, >=2 chars, AbortController)
  useEffect(() => {
    const clean = searchQuery.trim();
    if (!clean || clean.length < 2) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      if (searchAbortRef.current) {
        searchAbortRef.current.abort();
      }
      searchAbortRef.current = new AbortController();

      setIsSearching(true);
      try {
        const results = await searchPlaces(clean, searchAbortRef.current.signal);
        setSuggestions(results);
      } catch (err) {
        if (err.name !== 'AbortError') {
          setSuggestions([]);
        }
      } finally {
        setIsSearching(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Handle autocomplete suggestion selection
  const handleSelectSuggestion = (place) => {
    if (!place?.coordinates) return;
    const { lat, lng } = place.coordinates;
    const coordCheck = validateCoordinates({ lat, lng });
    if (!coordCheck.valid || !coordCheck.normalized) {
      setErrorMsg('Selected location coordinates are invalid.');
      return;
    }

    setSearchQuery('');
    setSuggestions([]);
    setSelectedLocation(place);
    setAccuracyNotice('');
    setErrorMsg('');

    setMapPosition(coordCheck.normalized.lat, coordCheck.normalized.lng, 16);
  };

  // Browser Geolocation locate me
  const handleLocateMe = async () => {
    setErrorMsg('');
    setAccuracyNotice('');
    setIsGeocoding(true);

    try {
      const geo = await getCurrentBrowserLocation({ timeout: 10000, enableHighAccuracy: true });
      const { lat, lng } = geo.coordinates;

      setMapPosition(lat, lng, 16);

      if (geo.isLowAccuracy) {
        setAccuracyNotice(`GPS signal is approximate (±${geo.accuracyMeters}m). You can drag the pin for exact doorstep precision.`);
      }

      await handleMarkerMoved(lat, lng);
    } catch (err) {
      setErrorMsg(err.message || 'Could not detect your location. Please search your colony.');
      setIsGeocoding(false);
    }
  };

  // Location Confirmation
  const handleConfirm = () => {
    if (!selectedLocation || !selectedLocation.coordinates) {
      setErrorMsg('Please select a valid location on the map first.');
      return;
    }

    const coordCheck = validateCoordinates(selectedLocation.coordinates);
    if (!coordCheck.valid) {
      setErrorMsg('Invalid coordinates for selected location. Please reposition the pin.');
      return;
    }

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
              <p className="text-[11px] text-text-muted">Drag the pin or search your colony/landmark in Indore</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-main hover:bg-surface transition cursor-pointer"
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
              className="px-3 py-2 bg-surface hover:bg-surface-subtle border border-border-neutral rounded-xl text-xs font-semibold text-brand flex items-center gap-1.5 transition shadow-xs cursor-pointer"
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
                  className="w-full px-3.5 py-2.5 text-left text-xs hover:bg-surface-subtle transition flex items-start gap-2.5 group cursor-pointer"
                >
                  <MapPin className="w-3.5 h-3.5 text-brand shrink-0 mt-0.5" />
                  <div className="min-w-0">
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
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 bg-surface/90 backdrop-blur-xs border border-border-neutral px-3 py-1.5 rounded-full text-xs font-medium text-brand flex items-center gap-1.5 shadow-sm">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Resolving street address...</span>
            </div>
          )}
        </div>

        {/* Location Summary and Action Buttons */}
        <div className="p-4 border-t border-border-neutral bg-surface space-y-3">
          {accuracyNotice && (
            <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
              <span>{accuracyNotice}</span>
            </div>
          )}

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
              className="px-4 py-2 border border-border-neutral text-xs font-semibold text-text-muted hover:text-text-main rounded-xl hover:bg-surface-subtle transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!selectedLocation || isGeocoding}
              onClick={handleConfirm}
              className="px-5 py-2 bg-brand hover:bg-brand-hover text-white text-xs font-bold rounded-xl transition shadow-xs flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
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
