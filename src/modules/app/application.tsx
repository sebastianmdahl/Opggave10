import React, { useEffect, useRef, useState } from "react";
import "./application.css";
import { useGeographic } from "ol/proj";
import { MapboxVectorLayer } from "ol-mapbox-style";

import "ol/ol.css";
import Map from "ol/Map.js";
import View from "ol/View.js";
import { FeedMessage } from "../../../generated/gtfs-realtime";
import { Feature, Overlay } from "ol";
import { Point } from "ol/geom";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import { Style, Circle, Fill, Stroke } from "ol/style";

useGeographic();

const backgroundLayer = new MapboxVectorLayer({
  styleUrl: "mapbox://styles/mapbox/streets-v11",
  accessToken:
    "pk.eyJ1Ijoic2ViYXN0aWFubWRhaGwiLCJhIjoiY204ZnZyaHNuMGN3NDJrc2p3NGs3bHFhdSJ9.j_FCm7ue8q-Wugzv4BR6xg",
});

// Here we create a Map object. Make sure you `import { Map } from "ol"`. Otherwise, the standard Javascript
//  map data structure will be used
const vehicleLayer = new VectorLayer({
  style: new Style({
    image: new Circle({
      radius: 8,
      fill: new Fill({ color: "blue" }),
      stroke: new Stroke({ color: "white", width: 2 }),
    }),
  }),
});

const map = new Map({
  layers: [backgroundLayer, vehicleLayer],
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
          features.map((f) => f.getProperties()),
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
    const features = messages.entity.map((entity) => {
      const position = entity.vehicle?.position!;
      const { latitude, longitude } = position;
      return new Feature({
        geometry: new Point([longitude, latitude]),
        properties: entity!.vehicle,
      });
    });
    console.log(features);
    vehicleLayer.setSource(new VectorSource({ features }));
  }

  useEffect(() => {
    loadTransitFeed();
  }, []);

  return (
    <div ref={mapRef}>
      <div ref={overlayRef}>
        <SelectedFeaturesOverlay features={selectedFeatures} />
      </div>
    </div>
  );
}
