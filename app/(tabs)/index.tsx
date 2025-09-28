// app/(tabs)/index.tsx
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";

const BASE = process.env.EXPO_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

function toQS(params: Record<string, unknown>) {
  const pairs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return pairs.length ? `?${pairs.join("&")}` : "";
}

type Item = {
  id: string;
  name: string;
  brand: string;
  source?: string;
  composition: {
    na?: number; mg?: number; ca?: number; hco3?: number; tds?: number; ph?: number;
  };
};

type Profile = { key: string; label: string; };

type CompareHighlights = {
  lowestNa?: { id: string; brand: string; name: string; value: number };
  highestHCO3?: { id: string; brand: string; name: string; value: number };
  highestMg?: { id: string; brand: string; name: string; value: number };
  highestCa?: { id: string; brand: string; name: string; value: number };
  lowestNO3?: { id: string; brand: string; name: string; value: number };
  closestPH?: { id: string; brand: string; name: string; value: number; target: number };
  highestTDS?: { id: string; brand: string; name: string; value: number };
};

const FALLBACK_PROFILES: Profile[] = [
  { key: "sodiumRestricted", label: "Düşük Sodyum" },
  { key: "bicarbonateRich",  label: "Yüksek HCO₃" },
  { key: "magnesiumRich",    label: "Yüksek Mg" },
  { key: "calciumRich",      label: "Yüksek Ca" },
  { key: "lowNitrate",       label: "Düşük NO₃" },
];

export default function TabHome() {
  // Veri & UI state
  const [rows, setRows] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Arama / Profil
  const [profiles, setProfiles] = useState<Profile[]>(FALLBACK_PROFILES);
  const [activeProfile, setActiveProfile] = useState<string>("sodiumRestricted");
  const [q, setQ] = useState<string>("");

  // Seçim & karşılaştırma
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [compLoading, setCompLoading] = useState(false);
  const [highlights, setHighlights] = useState<CompareHighlights | null>(null);

  // Profilleri çek (dinamik)
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${BASE}/profiles`);
        if (!res.ok) return; // fallback kullan
        const data = await res.json();
        if (Array.isArray(data?.profiles)) {
          const mapped: Profile[] = data.profiles.map((p: any) => ({ key: p.key, label: p.label }));
          if (mapped.length) setProfiles(mapped);
        }
      } catch {}
    })();
  }, []);

  // Ürünleri çek (profil/arama değişince)
  async function loadProducts(opts?: { silent?: boolean }) {
    try {
      if (!opts?.silent) setLoading(true);
      setErr(null);
      setHighlights(null);
      const res = await fetch(
        `${BASE}/products` + toQS({
          profile: activeProfile || undefined,
          q: q || undefined,
          sortBy: "composition.na",
          sortDir: "asc",
          page: 1, pageSize: 50,
        })
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRows(data.items ?? []);
    } catch (e: any) {
      setErr(e?.message ?? "Hata");
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }

  useEffect(() => { loadProducts(); /* ilk açılış */ }, []);
  useEffect(() => { loadProducts(); /* profil değişirse */ }, [activeProfile]);

  // Pull-to-refresh
  const onRefresh = async () => {
    setRefreshing(true);
    await loadProducts({ silent: true });
    setRefreshing(false);
  };

  // Seçim
  const toggleSelect = (id: string) => {
    setHighlights(null);
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter(x => x !== id) : (prev.length < 6 ? [...prev, id] : prev)
    );
  };

  // Karşılaştır
  const doCompare = async () => {
    if (selectedIds.length < 2) {
      Alert.alert("Karşılaştır", "En az 2 ürün seçmelisin.");
      return;
    }
    try {
      setCompLoading(true);
      setHighlights(null);
      const res = await fetch(`${BASE}/compare` + toQS({ ids: selectedIds.join(","), targetPh: 7.4 }));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setHighlights(data.highlights);
    } catch (e: any) {
      Alert.alert("Hata", e?.message ?? "Karşılaştırma başarısız");
    } finally {
      setCompLoading(false);
    }
  };

  const selectionInfo = useMemo(
    () => `${selectedIds.length} seçili · min 2, max 6`,
    [selectedIds.length]
  );

  // --- UI ---
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={{ marginTop: 8 }}>Yükleniyor…</Text>
      </View>
    );
  }
  if (err) {
    return (
      <View style={styles.container}>
        <Text style={{ color: "red" }}>Hata: {err}</Text>
        <Text style={{ marginTop: 6, color: "#555" }}>BASE = {BASE}</Text>
        <Pressable onPress={() => loadProducts()} style={[styles.btn, { marginTop: 12, alignSelf: "flex-start" }]}>
          <Text style={styles.btnText}>Tekrar Dene</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Başlık */}
      <View style={styles.header}>
        <Text style={styles.title}>Soda Analiz</Text>
        <Text style={styles.subtitle}>Maden sularını içeriğe göre karşılaştır</Text>
      </View>

      {/* Profil chip’leri */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsWrap}
      >
        {profiles.map((p) => {
          const active = p.key === activeProfile;
          return (
            <Pressable
              key={p.key}
              onPress={() => setActiveProfile(p.key)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{p.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Arama kutusu */}
      <View style={styles.searchRow}>
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Marka / ürün / kaynak ara"
          placeholderTextColor="#8b9aa5"
          style={styles.searchInput}
          returnKeyType="search"
          onSubmitEditing={() => loadProducts()}
        />
        <Pressable onPress={() => loadProducts()} style={styles.btn}>
          <Text style={styles.btnText}>Ara</Text>
        </Pressable>
      </View>

      {/* Liste */}
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={[styles.list, { paddingBottom: 96 /* alttaki bar için boşluk */ }]}
        renderItem={({ item }) => {
          const active = selectedIds.includes(item.id);
          return (
            <Pressable onPress={() => toggleSelect(item.id)} style={[styles.card, active && styles.cardActive]}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={styles.cardTitle}>
                  {active ? "✓ " : ""}{item.brand} · {item.name}
                </Text>
                {item.source ? <Text style={styles.source}>{item.source}</Text> : null}
              </View>
              <View style={styles.rowLine}>
                <Badge label="Na" value={item.composition.na} />
                <Badge label="Mg" value={item.composition.mg} />
                <Badge label="Ca" value={item.composition.ca} />
                <Badge label="HCO₃" value={item.composition.hco3} />
                <Badge label="TDS" value={item.composition.tds} />
                <Badge label="pH" value={item.composition.ph} />
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={<Text style={{ padding: 16 }}>Kayıt bulunamadı.</Text>}
      />

      {/* Öne Çıkanlar */}
      {highlights ? (
        <View style={styles.highlights}>
          <Text style={styles.hTitle}>Öne Çıkanlar</Text>
          {highlights.lowestNa && (
            <Text style={styles.hLine}>• En düşük Na: {highlights.lowestNa.brand} · {highlights.lowestNa.name} ({highlights.lowestNa.value} mg/L)</Text>
          )}
          {highlights.highestHCO3 && (
            <Text style={styles.hLine}>• En yüksek HCO₃: {highlights.highestHCO3.brand} · {highlights.highestHCO3.name} ({highlights.highestHCO3.value} mg/L)</Text>
          )}
          {highlights.highestMg && (
            <Text style={styles.hLine}>• En yüksek Mg: {highlights.highestMg.brand} · {highlights.highestMg.name} ({highlights.highestMg.value} mg/L)</Text>
          )}
          {highlights.highestCa && (
            <Text style={styles.hLine}>• En yüksek Ca: {highlights.highestCa.brand} · {highlights.highestCa.name} ({highlights.highestCa.value} mg/L)</Text>
          )}
          {highlights.lowestNO3 && (
            <Text style={styles.hLine}>• En düşük NO₃: {highlights.lowestNO3.brand} · {highlights.lowestNO3.name} ({highlights.lowestNO3.value} mg/L)</Text>
          )}
          {highlights.closestPH && (
            <Text style={styles.hLine}>• Hedef pH’a en yakın: {highlights.closestPH.brand} · {highlights.closestPH.name} (≈ {highlights.closestPH.value}, hedef {highlights.closestPH.target})</Text>
          )}
          {highlights.highestTDS && (
            <Text style={styles.hLine}>• En yüksek TDS: {highlights.highestTDS.brand} · {highlights.highestTDS.name} ({highlights.highestTDS.value} mg/L)</Text>
          )}
        </View>
      ) : null}

      {/* Sticky Karşılaştır barı */}
      <View style={styles.bottomBar}>
        <Text style={{ color: "#0f172a" }}>{selectionInfo}</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable onPress={() => { setSelectedIds([]); setHighlights(null); }} style={styles.btnGhost}>
            <Text style={styles.btnGhostText}>Temizle</Text>
          </Pressable>
          <Pressable onPress={doCompare} style={styles.btnPrimary}>
            <Text style={styles.btnPrimaryText}>{compLoading ? "..." : "Karşılaştır"}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

/** Küçük Badge bileşeni */
function Badge({ label, value }: { label: string; value?: number }) {
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeLabel}>{label}</Text>
      <Text style={styles.badgeVal}>{value ?? "-"}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  container: { padding: 16 },

  header: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 },
  title: { fontSize: 20, fontWeight: "700", color: "#0f172a" },
  subtitle: { color: "#475569", marginTop: 4 },

  chipsWrap: { paddingHorizontal: 12, paddingBottom: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: "#cbd5e1", marginRight: 8, backgroundColor: "white" },
  chipActive: { backgroundColor: "#e0f2fe", borderColor: "#7dd3fc" },
  chipText: { color: "#334155" },
  chipTextActive: { color: "#0369a1", fontWeight: "700" },

  searchRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
  searchInput: { flex: 1, backgroundColor: "white", borderColor: "#cbd5e1", borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, color: "#0f172a" },
  btn: { backgroundColor: "#0369a1", paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10 },
  btnText: { color: "white", fontWeight: "700" },

  list: { paddingHorizontal: 16, paddingTop: 8 },

  card: { backgroundColor: "white", borderRadius: 14, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: "#e2e8f0",
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  cardActive: { borderColor: "#7dd3fc", backgroundColor: "#f0f9ff" },
  cardTitle: { fontWeight: "700", color: "#0f172a", marginBottom: 6 },
  source: { color: "#475569" },
  rowLine: { flexDirection: "row", flexWrap: "wrap", gap: 8 },

  badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#e2e8f0" },
  badgeLabel: { fontSize: 12, color: "#64748b" },
  badgeVal: { fontWeight: "700", color: "#0f172a" },

  highlights: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 96 },
  hTitle: { fontWeight: "800", marginBottom: 6, color: "#0f172a" },
  hLine: { marginTop: 4, color: "#111827" },

  bottomBar: { position: "absolute", left: 16, right: 16, bottom: 16, backgroundColor: "white", borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: "#e2e8f0", flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  btnGhost: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: "#94a3b8" },
  btnGhostText: { color: "#334155", fontWeight: "600" },
  btnPrimary: { backgroundColor: "#0284c7", paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10 },
  btnPrimaryText: { color: "white", fontWeight: "800" },
});
