// Runner mode: GPS online toggle, live request feed over WS, bid + delivery progression.
// expo-location supplies real coordinates; expo-image-picker captures receipt/door photos
// (uploaded via presigned S3 PUT in production — mocked URL here).
import { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, Alert } from 'react-native';
import * as Location from 'expo-location';
import { io } from 'socket.io-client';
import { api, fmt, getToken, setToken, API_URL } from '../lib/api';

const NEXT = {
  matched: ['shopping', 'Start shopping'],
  shopping: ['purchased', 'Purchased — snap receipt'],
  purchased: ['enroute', 'On my way'],
  enroute: ['delivered', 'Delivered — snap door photo'],
};

export default function RunnerScreen() {
  const [online, setOnline] = useState(false);
  const [feed, setFeed] = useState([]);
  const [active, setActive] = useState(null);
  const socketRef = useRef(null);

  async function goOnline() {
    try {
      if (!getToken()) {
        const r = await api('/auth/register', {
          method: 'POST',
          body: { email: `r+${Date.now()}@clinkit.app`, password: 'password123', fullName: 'Mobile Runner', role: 'runner' },
        });
        setToken(r.token);
      }
      const { status } = await Location.requestForegroundPermissionsAsync();
      const pos = status === 'granted'
        ? (await Location.getCurrentPositionAsync({})).coords
        : { latitude: 37.742, longitude: -121.43 };
      await api('/runners/online', { method: 'POST', body: { lat: pos.latitude, lng: pos.longitude } });
      setFeed((await api('/runners/feed')).orders);
      const s = io(API_URL, { auth: { token: getToken() } });
      socketRef.current = s;
      s.on('order:new', (o) => setFeed((prev) => [o, ...prev]));
      setOnline(true);
    } catch (e) { Alert.alert('Failed to go online', e.message); }
  }

  async function bid(orderId) {
    try {
      await api(`/orders/${orderId}/bids`, { method: 'POST', body: { markupPct: 10, etaMin: 25 } });
      socketRef.current?.emit('order:join', { orderId });
      socketRef.current?.on('order:matched', async ({ orderId: oid }) => {
        const o = await api(`/orders/${oid}`).catch(() => null);
        if (o?.status === 'matched') { setActive(o); setFeed((f) => f.filter((x) => x.orderId !== oid)); }
      });
      Alert.alert('Bid placed', 'Waiting for the buyer to accept.');
    } catch (e) { Alert.alert('Bid failed', e.message); }
  }

  async function advance() {
    const [next] = NEXT[active.status];
    const body = { status: next };
    if (next === 'purchased') body.receiptPhotoUrl = 's3://demo/receipt.jpg';
    if (next === 'delivered') body.deliveryPhotoUrl = 's3://demo/door.jpg';
    try {
      const updated = await api(`/orders/${active.id}/status`, { method: 'POST', body });
      if (updated.status === 'completed') { Alert.alert('Delivered 🎉', `Payout ${fmt(updated.totals.runnerPayoutCents)}`); setActive(null); }
      else setActive(updated);
    } catch (e) { Alert.alert('Update failed', e.message); }
  }

  return (
    <View style={s.wrap}>
      {!online && (
        <TouchableOpacity style={s.btn} onPress={goOnline}>
          <Text style={s.btnText}>Go online</Text>
        </TouchableOpacity>
      )}
      {active ? (
        <View style={[s.card, { borderColor: '#16a34a', borderWidth: 2 }]}>
          <Text style={s.storeName}>{active.storeName} → {active.dropoff.address}</Text>
          <Text style={s.note}>
            Status {active.status} · earn {fmt(active.totals.runnerEarningsCents)} + reimbursed {fmt(active.totals.itemsBaseCents)}
          </Text>
          {NEXT[active.status] && (
            <TouchableOpacity style={s.btn} onPress={advance}>
              <Text style={s.btnText}>{NEXT[active.status][1]}</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : online && (
        <FlatList
          data={feed}
          keyExtractor={(o) => o.orderId}
          ListEmptyComponent={<Text style={s.note}>No open requests nearby — you'll get pinged.</Text>}
          renderItem={({ item: o }) => (
            <View style={s.card}>
              <Text style={s.storeName}>{o.storeName} · {o.itemCount} items</Text>
              <View style={s.rowBetween}>
                <Text style={s.note}>earn ~{fmt(o.estEarningsCents)}{o.surge > 1 ? ` · ⚡${o.surge}×` : ''}</Text>
                <TouchableOpacity style={s.btnSm} onPress={() => bid(o.orderId)}>
                  <Text style={s.btnText}>Bid 10%</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, padding: 16, paddingTop: 4 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  btn: { backgroundColor: '#16a34a', borderRadius: 12, padding: 14, alignItems: 'center', marginVertical: 10, minHeight: 44 },
  btnSm: { backgroundColor: '#16a34a', borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10, minHeight: 44, justifyContent: 'center' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 14, marginBottom: 10 },
  storeName: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  note: { fontSize: 12, color: '#64748b', marginTop: 2 },
});
