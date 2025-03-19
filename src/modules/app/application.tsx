import React, { useEffect, useRef, useState } from "react";
import "./application.css";
import { useGeographic } from "ol/proj";
import { MapboxVectorLayer } from "ol-mapbox-style";

import "ol/ol.css";
import Map from "ol/Map.js";
import View from "ol/View.js";
import { FeedMessage } from "../../../generated/gtfs-realtime";
import { Feature, Overlay } from "ol";
import { LineString, Point } from "ol/geom";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import { Style, Circle, Fill, Stroke, Text } from "ol/style";

useGeographic();

const backgroundLayer = new MapboxVectorLayer({
  styleUrl: "mapbox://styles/mapbox/bright-v9",
  accessToken:
    "pk.eyJ1Ijoic2ViYXN0aWFubWRhaGwiLCJhIjoiY204ZnZyaHNuMGN3NDJrc2p3NGs3bHFhdSJ9.j_FCm7ue8q-Wugzv4BR6xg",
});

// Here we create a Map object. Make sure you `import { Map } from "ol"`. Otherwise, the standard Javascript
//  map data structure will be used
const historyLayer = new VectorLayer({
  source: new VectorSource(),
  style: new Style({
    stroke: new Stroke({
      color: "red",
      width: 2,
    }),
  }),
});

const vehicleLayer = new VectorLayer({
  style: (feature) =>
    new Style({
      image: new Circle({
        radius: 8,
        fill: new Fill({ color: "blue" }),
        stroke: new Stroke({ color: "white", width: 2 }),
      }),
      text: new Text({
        text: feature.get("routeId") || "",
      }),
    }),
});

const map = new Map({
  layers: [backgroundLayer, vehicleLayer, historyLayer],
  view: new View({ center: [10.9, 59.9], zoom: 10 }),
  // map tile images will be from the Open Street Map (OSM) tile layer
});
const overlay = new Overlay({
  positioning: "top-center",
});

function SelectedFeaturesOverlay({ features }: { features: Feature[] }) {
  return (
    <>
      Clicked on {features.length} features
      <pre>
        {JSON.stringify(
          features
            .map((f) => f.getProperties())
            .map(({ geometry, ...properties }) => properties),
          null,
          2,
        )}
      </pre>
    </>
  );
}

export function Application() {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [selectedFeatures, setSelectedFeatures] = useState<Feature[]>([]);
  const [vehiclePositions, setVehiclePositions] = useState<
    Record<string, Point[]>
  >({});
  useEffect(() => {
    map.setTarget(mapRef.current!);
    overlay.setElement(overlayRef.current!);
    map.addOverlay(overlay);
    map.on("click", (e) => {
      overlay.setPosition(e.coordinate);
      const selectedFeatures = map.getFeaturesAtPixel(e.pixel, {
        layerFilter: (l) => l === vehicleLayer,
      });
      setSelectedFeatures(selectedFeatures as Feature[]);
      if (selectedFeatures.length === 0) {
        overlay.setPosition(undefined);
      } else {
        overlay.setPosition(e.coordinate);
      }
    });
  }, []);

  async function loadTransitFeed() {
    const res = await fetch(
      "https://api.entur.io/realtime/v1/gtfs-rt/vehicle-positions",
    );
    const messages = FeedMessage.decode(
      new Uint8Array(await res.arrayBuffer()),
    );
    console.log("Received vehicle data:", messages.entity.length, "vehicles");

    setVehiclePositions((prevPositions) => {
      const newPositions: Record<string, Point[]> = { ...prevPositions };

      messages.entity.forEach((entity) => {
        const position = entity.vehicle?.position!;
        const { latitude, longitude } = position;
        const vehicleId = entity.vehicle?.vehicle?.id || "Unknown";

        // Store position history
        if (!newPositions[vehicleId]) {
          newPositions[vehicleId] = [];
        }
        newPositions[vehicleId].push(new Point([longitude, latitude]));

        console.log(
          "Tracking vehicle:",
          vehicleId,
          "| Total positions stored:",
          newPositions[vehicleId].length,
        );
        // Limit history length to avoid performance issues
        if (newPositions[vehicleId].length > 50) {
          newPositions[vehicleId].shift(); // Remove oldest position
        }
      });

      return newPositions;
    });

    const features = messages.entity.map((entity) => {
      const position = entity.vehicle?.position!;
      const { latitude, longitude } = position;
      const routeId = entity.vehicle?.trip?.routeId || "Unknown";

      return new Feature({
        geometry: new Point([longitude, latitude]),
        properties: entity!.vehicle,
        routeId,
      });
    });

    vehicleLayer.setSource(new VectorSource({ features }));
  }

  useEffect(() => {
    if (Object.keys(vehiclePositions).length === 0) {
      console.log("No vehicle positions available yet.");
      return;
    } //

    // ✅ FIX: Make sure historyLines appear immediately when vehicles move
    const historyFeatures = Object.keys(vehiclePositions)
      .map((vehicleId) => {
        if (vehiclePositions[vehicleId].length > 1) {
          return new Feature({
            geometry: new LineString(
              vehiclePositions[vehicleId].map((point) =>
                point.getCoordinates(),
              ), // ✅ Ensure each vehicle has its own history
            ),
          });
        }
        return null;
      })
      .filter((feature) => feature !== null); // ✅ Remove empty entries

    console.log(
      "Updating history layer with",
      historyFeatures.length,
      "vehicles",
    ); // ✅ Debugging line

    historyLayer.setSource(new VectorSource({ features: historyFeatures })); // ✅ Ensure all paths are added
  }, [vehiclePositions]); // ✅ Make sure this updates when positions change

  useEffect(() => {
    loadTransitFeed();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      console.log("Fetching updated vehicle positions...");
      loadTransitFeed(); // ✅ Fetch new data every 30 seconds
    }, 30000);

    return () => clearInterval(interval); // ✅ Cleanup interval when component unmounts
  }, []);

  return (
    <div ref={mapRef}>
      <div ref={overlayRef}>
        <SelectedFeaturesOverlay features={selectedFeatures} />
      </div>
    </div>
  );
  function SelectedFeaturesOverlay({ features }: { features: Feature[] }) {
    return (
      <>
        Clicked on {features.length} features
        <pre>
          {JSON.stringify(
            features
              .map((f) => f.getProperties())
              .map(({ geometry, ...properties }) => properties),
            null,
            2,
          )}
        </pre>
      </>
    );
  }
}
