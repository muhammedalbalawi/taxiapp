import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { useApp } from './AppContext';

export type Marker = { lat: number; lng: number; color?: string; label?: string; pulse?: boolean };

type Props = {
  center: { lat: number; lng: number };
  markers?: Marker[];
  zoom?: number;
  style?: any;
  onPickLocation?: (loc: { lat: number; lng: number }) => void;
};

const buildHTML = (center: any, markers: Marker[], zoom: number, dark: boolean, pickable: boolean) => {
  const tile = dark
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'
    : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png';
  return `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
  html,body,#map{height:100%;margin:0;padding:0;background:${dark ? '#050505' : '#F7F8FA'};}
  .leaflet-control-attribution{display:none !important;}
  .pin{width:22px;height:22px;border-radius:50%;border:3px solid #fff;box-shadow:0 4px 14px rgba(0,0,0,0.35);}
  .pulse{width:14px;height:14px;border-radius:50%;background:#0066FF;box-shadow:0 0 0 0 rgba(0,102,255,0.6);animation:pulse 1.8s infinite;}
  @keyframes pulse{0%{box-shadow:0 0 0 0 rgba(0,102,255,0.6);}70%{box-shadow:0 0 0 26px rgba(0,102,255,0);}100%{box-shadow:0 0 0 0 rgba(0,102,255,0);}}
</style></head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  const map = L.map('map',{zoomControl:false,attributionControl:false}).setView([${center.lat},${center.lng}],${zoom});
  L.tileLayer('${tile}',{maxZoom:19}).addTo(map);
  const markers = ${JSON.stringify(markers)};
  markers.forEach(m => {
    const html = m.pulse
      ? '<div class="pulse"></div>'
      : '<div class="pin" style="background:'+(m.color||'#0066FF')+';"></div>';
    L.marker([m.lat,m.lng],{icon:L.divIcon({className:'',html,iconSize:[22,22],iconAnchor:[11,11]})}).addTo(map);
  });
  if (markers.length >= 2) {
    const coords = markers.map(m=>[m.lat,m.lng]);
    L.polyline(coords,{color:'#0066FF',weight:4,opacity:0.85}).addTo(map);
    map.fitBounds(coords,{padding:[60,60]});
  }
  ${pickable ? `
  map.on('click', (e) => {
    const msg = JSON.stringify({ type:'pick', lat:e.latlng.lat, lng:e.latlng.lng });
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(msg);
    else window.parent && window.parent.postMessage(msg, '*');
  });` : ''}
</script>
</body></html>`;
};

export default function MapView({ center, markers = [], zoom = 13, style, onPickLocation }: Props) {
  const { mode } = useApp();
  const html = buildHTML(center, markers, zoom, mode === 'dark', !!onPickLocation);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || !onPickLocation) return;
    const handler = (e: MessageEvent) => {
      try {
        const d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        if (d?.type === 'pick') onPickLocation({ lat: d.lat, lng: d.lng });
      } catch {}
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onPickLocation]);

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.container, style]}>
        {/* eslint-disable-next-line */}
        <iframe ref={iframeRef as any} srcDoc={html} style={{ border: 0, width: '100%', height: '100%' }} title="map" />
      </View>
    );
  }
  return (
    <View style={[styles.container, style]}>
      <WebView
        originWhitelist={['*']}
        source={{ html }}
        style={{ flex: 1, backgroundColor: 'transparent' }}
        javaScriptEnabled domStorageEnabled
        onMessage={(e) => {
          try {
            const d = JSON.parse(e.nativeEvent.data);
            if (d?.type === 'pick') onPickLocation?.({ lat: d.lat, lng: d.lng });
          } catch {}
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({ container: { flex: 1, overflow: 'hidden' } });
