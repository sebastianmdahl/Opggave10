import React, { useEffect, useRef } from "react";

import { useGeographic } from "ol/proj";
import { MapboxVectorLayer } from "ol-mapbox-style";

import "ol/ol.css";
import Map from "ol/Map.js";
import View from "ol/View.js";
import { FeedMessage } from "../../../generated/gtfs-realtime";

useGeographic();

const backgroundLayer = new MapboxVectorLayer({
  styleUrl: "mapbox://styles/mapbox/streets-v11",
  accessToken:
    "pk.eyJ1Ijoic2ViYXN0aWFubWRhaGwiLCJhIjoiY204ZnZyaHNuMGN3NDJrc2p3NGs3bHFhdSJ9.j_FCm7ue8q-Wugzv4BR6xg",
});

// Here we create a Map object. Make sure you `import { Map } from "ol"`. Otherwise, the standard Javascript
//  map data structure will be used
const map = new Map({
  layers: [backgroundLayer],
  view: new View({ center: [10.9, 59.9], zoom: 10 }),
  // map tile images will be from the Open Street Map (OSM) tile layer
});

export function Application() {
  const mapRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    map.setTarget(mapRef.current!);
  }, []);

  async function loadTranstitFeed() {
    const res = await fetch(
      "https://api.entur.io/realtime/v1/gtfs-rt/vehicle-positions",
    );
    const messages = FeedMessage.decode(
      new Uint8Array(await res.arrayBuffer()),
    );
    console.log(messages);
  }

  useEffect(() => {
    loadTranstitFeed();
  }, []);

  return <div ref={mapRef}></div>;
}
