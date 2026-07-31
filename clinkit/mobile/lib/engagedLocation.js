// Prop 22 engaged-time GPS tracker (Expo). Starts when a bid is accepted (order matched),
// stops at proof-of-delivery. Emits gps:ping every ~5 s / 25 m with the device's reported
// accuracy so the backend can filter low-quality fixes (server counts only pings with
// accuracyM <= 50 toward engaged miles; if the trail is too sparse the server falls back
// to a route estimate — the runner is never shorted miles for bad GPS).

import * as Location from 'expo-location';

let subscription = null;

/**
 * @param {import('socket.io-client').Socket} socket  authenticated runner socket
 * @param {string} orderId
 * @returns {Promise<{ok: boolean, reason?: string}>}
 */
export async function startEngagedTracking(socket, orderId) {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    // Engaged tracking is degraded, not blocked: server falls back to estimated miles.
    return { ok: false, reason: 'location-permission-denied' };
  }
  await stopEngagedTracking();
  subscription = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.High,   // GPS-grade fixes; balanced battery vs Prop 22 fidelity
      timeInterval: 5000,
      distanceInterval: 25,
    },
    (pos) => {
      const { latitude, longitude, accuracy } = pos.coords;
      socket.emit('gps:ping', {
        orderId,
        lat: latitude,
        lng: longitude,
        accuracyM: Number.isFinite(accuracy) ? Math.round(accuracy) : null,
      });
    },
  );
  return { ok: true };
}

export async function stopEngagedTracking() {
  if (subscription) {
    subscription.remove();
    subscription = null;
  }
}
