// Clinkit mobile (Expo). Buyer compare + Runner mode share the same API/WS as web.
import { useState } from 'react';
import { SafeAreaView, StatusBar, Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import CompareScreen from './screens/CompareScreen';
import RunnerScreen from './screens/RunnerScreen';

export default function App() {
  const [tab, setTab] = useState('buy');
  return (
    <SafeAreaView style={s.root}>
      <StatusBar barStyle="dark-content" />
      <View style={s.header}>
        <Text style={s.brand}>⚡ Clink<Text style={{ color: '#16a34a' }}>it</Text></Text>
      </View>
      {tab === 'buy' ? <CompareScreen /> : <RunnerScreen />}
      <View style={s.tabs}>
        {[['buy', '🛒 Buy'], ['run', '🏃 Run']].map(([k, label]) => (
          <TouchableOpacity key={k} style={[s.tab, tab === k && s.tabActive]} onPress={() => setTab(k)}>
            <Text style={[s.tabText, tab === k && { color: '#16a34a' }]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f8fafc' },
  header: { padding: 16, paddingBottom: 8 },
  brand: { fontSize: 22, fontWeight: '800', color: '#0f172a' },
  tabs: { flexDirection: 'row', borderTopWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff' },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12, minHeight: 44 },
  tabActive: { borderTopWidth: 2, borderColor: '#16a34a' },
  tabText: { fontSize: 15, fontWeight: '600', color: '#64748b' },
});
