"use client";

import { useMemo, useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import { Subtitle } from "@leafygreen-ui/typography";
import ExpandableSection from "@/components/ExpandableSection/ExpandableSection";
import L from "leaflet";

// Fix for default marker icon in react-leaflet
// This is needed because webpack doesn't properly handle Leaflet's icon paths
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Create a rotating arrow icon for navigation mode using arrow.png
const createNavigationArrow = (heading = 0, size = 48) => {
  const arrowHtml = `
    <div style="
      width: ${size}px;
      height: ${size}px;
      display: flex;
      align-items: center;
      justify-content: center;
      transform: rotate(${heading}deg);
    ">
      <img 
        src="/arrow.png" 
        style="
          width: ${size}px;
          height: ${size}px;
          filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
        " 
        alt="Vehicle direction"
      />
    </div>
  `;

  return L.divIcon({
    html: arrowHtml,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
    className: "navigation-arrow-marker smooth-marker-transition",
  });
};

// GPS heading is unreliable below this speed (km/h); freeze the arrow
// instead of letting the gauge flick around on a parked vehicle.
const STATIONARY_SPEED_KPH = 1;

// Component to smoothly update marker rotation.
//
// Why a cumulative rotation? CSS interpolates `transform: rotate(...)`
// between absolute angles, so going from 350° → 10° (a 20° clockwise
// turn) animates as -340° — the long way around — producing a visible
// near-full spin. By accumulating the shortest signed delta on every
// update, the applied angle is monotonic and CSS always animates the
// short way across the 0/360 seam.
function MarkerRotation({ heading, isMoving, markerRef }) {
  const rotationRef = useRef(0);
  const lastHeadingRef = useRef(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!markerRef.current) return;
    if (!Number.isFinite(heading)) return;

    const markerElement = markerRef.current.getElement();
    if (!markerElement) return;

    const arrowContainer = markerElement.querySelector("div > div");
    if (!arrowContainer) return;

    const normalized = ((heading % 360) + 360) % 360;

    if (!initializedRef.current) {
      // Snap to the first known heading without animating from 0°.
      rotationRef.current = normalized;
      lastHeadingRef.current = normalized;
      arrowContainer.style.transition = "none";
      arrowContainer.style.transform = `rotate(${normalized}deg)`;
      arrowContainer.offsetHeight; // force reflow
      arrowContainer.style.transition = "transform 1s linear";
      initializedRef.current = true;
      return;
    }

    if (isMoving === false) return;
    if (lastHeadingRef.current === normalized) return;

    // Shortest signed delta in (-180, 180].
    const delta =
      ((normalized - lastHeadingRef.current + 540) % 360) - 180;

    rotationRef.current += delta;
    lastHeadingRef.current = normalized;
    arrowContainer.style.transform = `rotate(${rotationRef.current}deg)`;
  }, [heading, isMoving, markerRef]);

  return null;
}

// Component to smoothly update map center without remounting
function MapUpdater({ location, isExpanded, enableMapRotation = false }) {
  const map = useMap();
  const prevLocationRef = useRef(null);

  // Handle map resize when expand/collapse changes
  useEffect(() => {
    // Call invalidateSize multiple times with increasing delays
    // to catch the CSS transition animation
    const timeouts = [
      setTimeout(() => map.invalidateSize(), 50),
      setTimeout(() => map.invalidateSize(), 150),
      setTimeout(() => map.invalidateSize(), 350),
    ];

    return () => {
      timeouts.forEach((timeout) => clearTimeout(timeout));
    };
  }, [isExpanded, map]);

  // Use ResizeObserver to detect container size changes
  useEffect(() => {
    const container = map.getContainer();

    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, [map]);

  useEffect(() => {
    if (location) {
      const newPos = [location.lat, location.lng];

      // Calculate distance to determine if we should move the map
      const shouldUpdate =
        !prevLocationRef.current ||
        prevLocationRef.current.lat !== location.lat ||
        prevLocationRef.current.lng !== location.lng;

      if (shouldUpdate) {
        // Always animate map movement to match marker's 1-second transition
        // This keeps the marker centered smoothly as it glides to new position
        map.panTo(newPos, {
          animate: true,
          duration: 1.0, // Match marker's 1-second CSS transition
          easeLinearity: 1.0, // Linear easing to match marker's linear transition
          noMoveStart: true, // Prevents map from firing movestart event repeatedly
        });

        // Optional: Rotate map to match vehicle heading (true navigation mode)
        // This makes the map behave like GPS navigation apps
        if (enableMapRotation && Number.isFinite(location.heading)) {
          const mapContainer = map.getContainer();
          mapContainer.style.transform = `rotate(${-location.heading}deg)`;

          // Counter-rotate controls to keep them upright
          const controls = mapContainer.querySelectorAll(".leaflet-control");
          controls.forEach((control) => {
            control.style.transform = `rotate(${location.heading}deg)`;
          });
        }

        prevLocationRef.current = location;
      }
    }
  }, [location, map, enableMapRotation]);

  return null;
}

export default function MapView({
  vehicleStatus,
  selectedVin,
  hasVehicles = false,
  isLoading,
  isExpanded = true,
  onToggleExpand,
  showHeader = true,
  initialZoom = 16,
  minZoom = 14,
  maxZoom = 18,
  arrowSize = 48,
  markerStyle = "arrow",
}) {
  const markerRef = useRef(null);

  // Extract location and heading from vehicle status. Heading is left as
  // `null` when missing/invalid so MarkerRotation can hold the previous
  // value rather than snapping the arrow back to North on a dropped frame.
  const location = useMemo(() => {
    const currentLocation = vehicleStatus?.Vehicle?.CurrentLocation;
    if (!currentLocation) return null;

    const lat = currentLocation.Latitude;
    const lng = currentLocation.Longitude;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    const heading = Number.isFinite(currentLocation.Heading)
      ? currentLocation.Heading
      : null;

    return { lat, lng, heading };
  }, [vehicleStatus]);

  // Treat the vehicle as moving when there is no speed signal so we don't
  // accidentally freeze the arrow when only Speed is missing.
  const speed = vehicleStatus?.Vehicle?.Speed;
  const isMoving = Number.isFinite(speed)
    ? speed > STATIONARY_SPEED_KPH
    : true;

  const usePin = markerStyle === "pin";

  // Create navigation arrow icon once (rotation will be updated via DOM).
  // Skipped entirely when in "pin" mode — we fall back to the default
  // Leaflet marker which already renders a static pin.
  const navigationIcon = useMemo(() => {
    if (usePin) return null;
    return createNavigationArrow(0, arrowSize);
  }, [arrowSize, usePin]);

  // Define bounds for the expected area (~10 sqkm around the vehicle)
  // This helps preload tiles in the area
  const mapBounds = useMemo(() => {
    if (!location) return null;

    // ~10 sqkm is roughly 0.025 degrees in each direction at this latitude
    const offset = 0.025;
    return [
      [location.lat - offset, location.lng - offset], // Southwest
      [location.lat + offset, location.lng + offset], // Northeast
    ];
  }, [location]);

  const mapContent = (
    <div
      className={`min-h-0 overflow-hidden map-view-stack ${
        showHeader ? "flex-1 mt-4" : "h-full w-full"
      }`}
    >
      {!selectedVin ? (
        <div className="flex items-center justify-center h-full">
          <Subtitle>
            {hasVehicles
              ? "Select a vehicle to view its location"
              : "No vehicles connected"}
          </Subtitle>
        </div>
      ) : isLoading && !location ? (
        <div className="flex items-center justify-center h-full">
          <Subtitle>Loading location data...</Subtitle>
        </div>
      ) : !location ? (
        <div className="flex items-center justify-center h-full">
          <Subtitle>No location data available for {selectedVin}</Subtitle>
        </div>
      ) : (
        <div className="h-full w-full rounded-lg overflow-hidden relative">
          <MapContainer
            center={[location.lat, location.lng]}
            zoom={initialZoom}
            minZoom={minZoom}
            maxZoom={maxZoom}
            maxBounds={mapBounds}
            maxBoundsViscosity={0.5}
            style={{ height: "100%", width: "100%" }}
            scrollWheelZoom={true}
            zoomControl={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              subdomains="abcd"
              keepBuffer={8}
              minZoom={minZoom}
              maxZoom={maxZoom}
            />

            <MapUpdater
              location={location}
              isExpanded={isExpanded}
              enableMapRotation={false}
            />

            {!usePin ? (
              <MarkerRotation
                heading={location.heading}
                isMoving={isMoving}
                markerRef={markerRef}
              />
            ) : null}

            <Marker
              ref={markerRef}
              position={[location.lat, location.lng]}
              {...(usePin ? {} : { icon: navigationIcon })}
            >
              <Popup>
                <div>
                  <strong>Vehicle Location</strong>
                  <br />
                  Lat: {location.lat.toFixed(6)}
                  <br />
                  Lng: {location.lng.toFixed(6)}
                  {!usePin && Number.isFinite(location.heading) ? (
                    <>
                      <br />
                      Heading: {location.heading.toFixed(1)}°
                    </>
                  ) : null}
                  <br />
                  Speed: {vehicleStatus?.Vehicle?.Speed?.toFixed(1) || 0} km/h
                </div>
              </Popup>
            </Marker>
          </MapContainer>
        </div>
      )}
    </div>
  );

  if (!showHeader) {
    return mapContent;
  }

  return (
    <ExpandableSection
      title="Map View"
      isExpanded={isExpanded}
      onToggleExpand={onToggleExpand}
    >
      {mapContent}
    </ExpandableSection>
  );
}
