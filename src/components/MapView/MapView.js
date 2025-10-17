"use client";

import { useMemo, useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import { Subtitle } from "@leafygreen-ui/typography";
import Badge from "@leafygreen-ui/badge";
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
const createNavigationArrow = (heading = 0) => {
  const arrowHtml = `
    <div style="
      width: 48px;
      height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
      transform: rotate(${heading}deg);
    ">
      <img 
        src="/arrow.png" 
        style="
          width: 48px;
          height: 48px;
          filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
        " 
        alt="Vehicle direction"
      />
    </div>
  `;

  return L.divIcon({
    html: arrowHtml,
    iconSize: [48, 48],
    iconAnchor: [24, 24],
    popupAnchor: [0, -24],
    className: "navigation-arrow-marker smooth-marker-transition",
  });
};

// Component to smoothly update marker rotation
function MarkerRotation({ location, markerRef }) {
  const prevHeadingRef = useRef(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (markerRef.current && location?.heading !== undefined) {
      const markerElement = markerRef.current.getElement();
      if (markerElement) {
        const arrowContainer = markerElement.querySelector("div > div");
        if (arrowContainer) {
          // On first load, set rotation immediately without transition
          if (!initializedRef.current) {
            arrowContainer.style.transition = "none";
            arrowContainer.style.transform = `rotate(${location.heading}deg)`;
            // Force reflow to ensure transition is disabled
            arrowContainer.offsetHeight;
            // Re-enable transition for future updates
            arrowContainer.style.transition = "transform 1s linear";
            initializedRef.current = true;
            prevHeadingRef.current = location.heading;
          } else if (prevHeadingRef.current !== location.heading) {
            // Smoothly rotate the arrow to the new heading
            arrowContainer.style.transform = `rotate(${location.heading}deg)`;
            prevHeadingRef.current = location.heading;
          }
        }
      }
    }
  }, [location?.heading, markerRef]);

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
        if (enableMapRotation && location.heading !== undefined) {
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
  isLoading,
  isExpanded = true,
  onToggleExpand,
}) {
  const markerRef = useRef(null);

  // Extract location and heading from vehicle status
  const location = useMemo(() => {
    if (!vehicleStatus?.Vehicle?.CurrentLocation) {
      return null;
    }

    const currentLocation = vehicleStatus.Vehicle.CurrentLocation;
    const lat = currentLocation.Latitude;
    const lng = currentLocation.Longitude;
    const heading = currentLocation.Heading || 0; // Vehicle heading in degrees

    if (
      typeof lat === "number" &&
      typeof lng === "number" &&
      !isNaN(lat) &&
      !isNaN(lng)
    ) {
      return { lat, lng, heading };
    }

    return null;
  }, [vehicleStatus]);

  // Create navigation arrow icon once (rotation will be updated via DOM)
  const navigationIcon = useMemo(() => {
    return createNavigationArrow(0); // Start at 0, will be updated by MarkerRotation
  }, []); // Only create once

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

  return (
    <ExpandableSection
      title="Map View"
      isExpanded={isExpanded}
      onToggleExpand={onToggleExpand}
    >
      <div className="flex-1 min-h-0 overflow-hidden mt-4">
        {isLoading && !location ? (
          <div className="flex items-center justify-center h-full">
            <Subtitle>Loading location data...</Subtitle>
          </div>
        ) : !location ? (
          <div className="flex items-center justify-center h-full">
            <Subtitle>No location data available</Subtitle>
          </div>
        ) : (
          <div className="h-full w-full rounded-lg overflow-hidden relative">
            {/* Speed Badge Overlay */}
            {/* <div className="absolute top-4 right-4 z-[1000] speed-badge-overlay rounded-lg">
              <Badge variant="blue">
                {Math.round(vehicleStatus?.Vehicle?.Speed || 0)} km/h
              </Badge>
            </div> */}

            {/* Removed key prop - map stays mounted, only marker and view update */}
            <MapContainer
              center={[location.lat, location.lng]}
              zoom={16}
              minZoom={14}
              maxZoom={18}
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
                minZoom={14}
                maxZoom={18}
              />

              {/* Component that smoothly updates map position and handles resize */}
              {/* Set enableMapRotation={true} to enable GPS-style navigation mode where the map rotates with the vehicle */}
              <MapUpdater
                location={location}
                isExpanded={isExpanded}
                enableMapRotation={false}
              />

              {/* Component that smoothly updates marker rotation */}
              <MarkerRotation location={location} markerRef={markerRef} />

              <Marker
                ref={markerRef}
                position={[location.lat, location.lng]}
                icon={navigationIcon}
              >
                <Popup>
                  <div>
                    <strong>Vehicle Location</strong>
                    <br />
                    Lat: {location.lat.toFixed(6)}
                    <br />
                    Lng: {location.lng.toFixed(6)}
                    <br />
                    Heading: {location.heading.toFixed(1)}°
                    <br />
                    Speed: {vehicleStatus?.Vehicle?.Speed?.toFixed(1) || 0} km/h
                  </div>
                </Popup>
              </Marker>
            </MapContainer>
          </div>
        )}
      </div>
    </ExpandableSection>
  );
}
