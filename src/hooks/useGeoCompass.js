import { useCallback, useEffect, useRef, useState } from 'react';
import { deleteCarPoint, loadCarPoint, saveCarPoint } from '../app/local-points.js';
import { publishCompassHeading } from './compass-heading.js';

export function normalizeGeolocationCoords(coords, extras = {}) {
  if (!coords) return null;
  return {
    latitude: Number(coords.latitude),
    longitude: Number(coords.longitude),
    accuracy: Number(coords.accuracy),
    altitude: coords.altitude == null ? null : Number(coords.altitude),
    altitudeAccuracy: coords.altitudeAccuracy == null ? null : Number(coords.altitudeAccuracy),
    heading: coords.heading == null ? null : Number(coords.heading),
    speed: coords.speed == null ? null : Number(coords.speed),
    ...extras,
  };
}

export function useGeoCompass({ selectedPoint, setSelectedPoint, setNavStatus }) {
  const [carPoint, setCarPoint] = useState(() => loadCarPoint());
  const [userPos, setUserPos] = useState(null);
  const [geoStatus, setGeoStatus] = useState('Геопозиция ещё не запрашивалась.');
  const [geoClass, setGeoClass] = useState('');
  const [compassEnabled, setCompassEnabled] = useState(false);
  const geoWatchRef = useRef(null);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoStatus('Геолокация не поддерживается этим браузером.');
      return;
    }
    if (geoWatchRef.current != null) {
      navigator.geolocation.clearWatch?.(geoWatchRef.current);
      geoWatchRef.current = null;
      setUserPos(null);
      setGeoStatus('Геопозиция выключена.');
      setGeoClass('');
      return;
    }
    setGeoStatus('Запрашиваю доступ к геопозиции…');
    let first = true;
    geoWatchRef.current = navigator.geolocation.watchPosition(
      pos => {
        setUserPos(normalizeGeolocationCoords(pos.coords, { __center: first }));
        setGeoStatus(`Геопозиция включена · точность ±${Math.round(pos.coords.accuracy || 0)} м`);
        setGeoClass('geo-ok');
        first = false;
      },
      error => {
        geoWatchRef.current = null;
        setGeoStatus(
          error.code === 1
            ? 'Доступ к геопозиции запрещён. Разреши его в настройках сайта.'
            : `Геолокация недоступна: ${error.message}`,
        );
        setGeoClass('geo-error');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 3000 },
    );
  }, []);

  const saveCar = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoStatus('Геолокация не поддерживается.');
      return;
    }
    setGeoStatus('Определяю координаты машины…');
    navigator.geolocation.getCurrentPosition(
      pos => {
        const coords = pos.coords;
        setUserPos(normalizeGeolocationCoords(coords));
        setCarPoint(saveCarPoint({ lat: coords.latitude, lon: coords.longitude, name: 'Машина' }));
        setGeoStatus(`Геопозиция включена · точность ±${Math.round(coords.accuracy || 0)} м`);
        setGeoClass('geo-ok');
      },
      error => {
        setGeoStatus(`Не удалось сохранить машину: ${error.message}`);
        setGeoClass('geo-error');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }, []);

  const removeCar = useCallback(() => {
    deleteCarPoint();
    setCarPoint(null);
    if (['Машина', '🚗 Машина'].includes(selectedPoint?.name)) setSelectedPoint(null);
  }, [selectedPoint, setSelectedPoint]);

  useEffect(() => {
    if (!compassEnabled) return undefined;
    const handler = event => {
      let heading = null;
      if (Number.isFinite(event.webkitCompassHeading)) heading = event.webkitCompassHeading;
      else if (Number.isFinite(event.alpha)) heading = (360 - event.alpha) % 360;
      if (Number.isFinite(heading)) publishCompassHeading(heading);
    };
    window.addEventListener('deviceorientationabsolute', handler, true);
    window.addEventListener('deviceorientation', handler, true);
    return () => {
      window.removeEventListener('deviceorientationabsolute', handler, true);
      window.removeEventListener('deviceorientation', handler, true);
    };
  }, [compassEnabled]);

  useEffect(
    () => () => {
      if (geoWatchRef.current != null) navigator.geolocation?.clearWatch?.(geoWatchRef.current);
    },
    [],
  );

  const enableCompass = useCallback(async () => {
    try {
      if (
        typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function'
      ) {
        const permission = await DeviceOrientationEvent.requestPermission();
        if (permission !== 'granted') throw new Error('доступ к датчику не разрешён');
      }
      setCompassEnabled(true);
      if (!userPos) requestLocation();
    } catch (error) {
      setNavStatus(`Компас недоступен: ${error.message}`);
    }
  }, [requestLocation, userPos, setNavStatus]);

  return {
    carPoint,
    saveCar,
    removeCar,
    userPos,
    requestLocation,
    geoStatus,
    geoClass,
    compassEnabled,
    enableCompass,
  };
}
