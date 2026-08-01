// Buyer flow: search basket → ranked store options → place order (mirrors web compare UI).
import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Alert } from 'react-native';
import { api, fmt, getToken, setToken } from '../lib/api';

export default function CompareScreen() {
  const [query, setQuery] = useState('milk, eggs, bread');
  const [zip, setZip] = useState('95376');
  const [quote, setQuote] = useState(null);
  const [busy, setBusy] = useState(false);

  async function compare() {
    setBusy(true);
    try {
      const items = query.split(',').map((s) => s.trim()).filter(Boolean);
      setQuote(await api('/quotes', { method: 'POST', body: { items, zip } }));
    } catch (e) { Alert.alert('Compare failed', e.message); }
    setBusy(false);
  }

  async function choose(option) {
    try {
      if (!getToken()) {
        const r = await api('/auth/register', {
          method: 'POST',
          body: { email: `m+${Date.now()}@zipnab.app`, password: 'password123', fullName: 'Mobile Buyer', zip },
        });
        setToken(r.token);
      }
      const order = await api('/orders', {
        method: 'POST',
        body: { quoteId: quote.id, storeName: option.storeName, dropoff: { lat: 37.7397, lng: -121.4252, address: '123 Main St, Tracy CA' } },
      });
      Alert.alert('Requested!', `Order ${order.id.slice(0, 8)} is collecting Runner bids.`);
    } catch (e) { Alert.alert('Order failed', e.message); }
  }

  return (
    <View style={s.wrap}>
      <View style={s.row}>
        <TextInput style={[s.input, { flex: 1 }]} value={query} onChangeText={setQuery} placeholder="milk, eggs…" />
        <TextInput style={[s.input, { width: 76 }]} value={zip} onChangeText={setZip} keyboardType="numeric" />
      </View>
      <TouchableOpacity style={s.btn} onPress={compare} disabled={busy}>
        <Text style={s.btnText}>{busy ? 'Comparing…' : 'Compare stores'}</Text>
      </TouchableOpacity>

      <FlatList
        data={quote?.options ?? []}
        keyExtractor={(o) => o.storeName}
        renderItem={({ item: o }) => (
          <View style={[s.card, o.isCheapest && s.cheapest]}>
            <Text style={s.storeName}>
              {o.isCheapest ? '🏆 ' : ''}{o.storeName} · {o.distanceMi} mi
            </Text>
            <Text style={s.note}>
              Items {fmt(o.totals.itemsBaseCents)} · +{o.totals.runnerMarkupPct}% · Delivery {fmt(o.totals.deliveryFeeCents)}
              {(o.totals.minFeeTopUpCents ?? 0) + (o.totals.smallOrderFeeCents ?? 0) > 0
                ? ` · Service ${fmt((o.totals.minFeeTopUpCents ?? 0) + (o.totals.smallOrderFeeCents ?? 0))}`
                : ''}
            </Text>
            <View style={s.rowBetween}>
              <View>
                <Text style={s.total}>{fmt(o.totals.buyerTotalCents)}</Text>
                <Text style={s.note}>⏱ {o.eta.lowMin}–{o.eta.highMin} min</Text>
              </View>
              <TouchableOpacity style={s.btnSm} onPress={() => choose(o)}>
                <Text style={s.btnText}>Choose</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListFooterComponent={quote?.savingsCents > 0 ? (
          <Text style={s.savings}>You save {fmt(quote.savingsCents)} at {quote.options[0].storeName} ✨</Text>
        ) : null}
      />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, padding: 16, paddingTop: 4 },
  row: { flexDirection: 'row', gap: 8 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 12, fontSize: 16 },
  btn: { backgroundColor: '#16a34a', borderRadius: 12, padding: 14, alignItems: 'center', marginVertical: 10, minHeight: 44 },
  btnSm: { backgroundColor: '#16a34a', borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10, minHeight: 44, justifyContent: 'center' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 14, marginBottom: 10 },
  cheapest: { borderColor: '#16a34a', borderWidth: 2 },
  storeName: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  note: { fontSize: 12, color: '#64748b', marginTop: 2 },
  total: { fontSize: 20, fontWeight: '800', color: '#0f172a' },
  savings: { textAlign: 'center', color: '#166534', fontWeight: '700', padding: 10 },
});
