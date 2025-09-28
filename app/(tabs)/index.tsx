// app/(tabs)/index.tsx
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";

const BASE =
  (typeof process !== "undefined" && (process as any).env?.EXPO_PUBLIC_API_URL) ||
  "http://127.0.0.1:8000";

function toQS(params: Record<string, unknown>) {
  const pairs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return pairs.length ? `?${pairs.join("&")}` : "";
}

// ---------- Types ----------
type Item = {
  id: string;
  name: string;
  brand: string;
  source?: string;
  composition: {
    na?: number; mg?: number; ca?: number; hco3?: number; tds?: number; ph?: number; no3?: number;
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

// Helpers
const num = (s: string) => {
  const v = s.trim().replace(",", ".");
  if (!v) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

export default function TabHome() {
  // Veri & UI
  const [rows, setRows] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Profiller & arama
  const [profiles, setProfiles] = useState<Profile[]>(FALLBACK_PROFILES);
  const [activeProfile, setActiveProfile] = useState<string>("sodiumRestricted");
  const [q, setQ] = useState<string>("");

  // Seçim / karşılaştır
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [compLoading, setCompLoading] = useState(false);
  const [highlights, setHighlights] = useState<CompareHighlights | null>(null);

  // ---- Filtre Paneli state (metin olarak; gönderirken sayıya çeviriyoruz) ----
  const [fpOpen, setFpOpen] = useState(false);
  const [minNa, setMinNa] = useState(""); const [maxNa, setMaxNa] = useState("");
  const [minMg, setMinMg] = useState(""); const [maxMg, setMaxMg] = useState("");
  const [minCa, setMinCa] = useState(""); const [maxCa, setMaxCa] = useState("");
  const [minHCO3, setMinHCO3] = useState(""); const [maxHCO3, setMaxHCO3] = useState("");
  const [minPH, setMinPH] = useState(""); const [maxPH, setMaxPH] = useState("");
  const [minNO3, setMinNO3] = useState(""); const [maxNO3, setMaxNO3] = useState("");
  const [minTDS, setMinTDS] = useState(""); const [maxTDS, setMaxTDS] = useState("");

  const activeFiltersCount = useMemo(() => {
    const vals = [minNa,maxNa,minMg,maxMg,minCa,maxCa,minHCO3,maxHCO3,minPH,maxPH,minNO3,maxNO3,minTDS,maxTDS];
    return vals.filter(v => v.trim() !== "").length;
  }, [minNa,maxNa,minMg,maxMg,minCa,maxCa,minHCO3,maxHCO3,minPH,maxPH,minNO3,maxNO3,minTDS,maxTDS]);

  // Profilleri çek (opsiyonel, backend varsa)
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${BASE}/profiles`);
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data?.profiles)) {
          const mapped: Profile[] = data.profiles.map((p: any) => ({ key: p.key, label: p.label }));
          if (mapped.length) setProfiles(mapped);
        }
      } catch {}
    })();
  }, []);

  // Ürünleri çek
  async function loadProducts(opts?: { silent?: boolean }) {
    try {
      if (!opts?.silent) setLoading(true);
      setErr(null);
      setHighlights(null);

      const params: Record<string, unknown> = {
        profile: activeProfile || undefined,
        q: q || undefined,
        sortBy: "composition.na",
        sortDir: "asc",
        page: 1, pageSize: 50,
        // filtreler
        minNa: num(minNa), maxNa: num(maxNa),
        minMg: num(minMg), maxMg: num(maxMg),
        minCa: num(minCa), maxCa: num(maxCa),
        minHCO3: num(minHCO3), maxHCO3: num(maxHCO3),
        minPH: num(minPH), maxPH: num(maxPH),
        minNO3: num(minNO3), maxNO3: num(maxNO3),
        minTDS: num(minTDS), maxTDS: num(maxTDS),
      };

      const res = await fetch(`${BASE}/products` + toQS(params));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRows(data.items ?? []);
    } catch (e: any) {
      setErr(e?.message ?? "Hata");
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }

  useEffect(() => { loadProducts(); }, []);
  useEffect(() => { loadProducts(); }, [activeProfile]);

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
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsWrap}>
        {profiles.map((p) => {
          const active = p.key === activeProfile;
          return (
            <Pressable key={p.key} onPress={() => setActiveProfile(p.key)} style={[styles.chip, active && styles.chipActive]}>
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{p.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Arama + Filtre butonu */}
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
        <Pressable onPress={() => loadProducts()} style={[styles.btn, { marginLeft: 8 }]}>
          <Text style={styles.btnText}>Ara</Text>
        </Pressable>

        <Pressable onPress={() => setFpOpen(true)} style={[styles.btnGhost, { marginLeft: 8 }]}>
          <Text style={styles.btnGhostText}>Filtreler{activeFiltersCount ? ` (${activeFiltersCount})` : ""}</Text>
        </Pressable>
      </View>

      {/* Liste */}
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={[styles.list, { paddingBottom: 96 }]}
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
                <Badge label="NO₃" value={item.composition.no3} />
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
        <Text style={{ color: "#0f172a" }}>{`${selectedIds.length} seçili · min 2, max 6`}</Text>
        <View style={styles.rowActions}>
          <Pressable onPress={() => { setSelectedIds([]); setHighlights(null); }} style={styles.btnGhost}>
            <Text style={styles.btnGhostText}>Temizle</Text>
          </Pressable>
          <Pressable onPress={doCompare} style={[styles.btnPrimary, { marginLeft: 8 }]}>
            <Text style={styles.btnPrimaryText}>{compLoading ? "..." : "Karşılaştır"}</Text>
          </Pressable>
        </View>
      </View>

      {/* -------- Filtre Paneli (Modal Bottom Sheet) -------- */}
      <Modal visible={fpOpen} transparent animationType="slide" onRequestClose={() => setFpOpen(false)}>
        <View style={styles.fpBackdrop}>
          <View style={styles.fpSheet}>
            <View style={styles.fpHeader}>
              <Text style={styles.fpTitle}>Filtreler</Text>
              <Pressable onPress={() => { resetFilters(); setFpOpen(false); }} style={styles.btnGhostSm}>
                <Text style={styles.btnGhostText}>Temizle</Text>
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ paddingBottom: 12 }}>
              <FilterRow label="Sodyum (Na, mg/L)" min={minNa} setMin={setMinNa} max={maxNa} setMax={setMaxNa} />
              <FilterRow label="Magnezyum (Mg, mg/L)" min={minMg} setMin={setMinMg} max={maxMg} setMax={setMaxMg} />
              <FilterRow label="Kalsiyum (Ca, mg/L)" min={minCa} setMin={setMinCa} max={maxCa} setMax={setMaxCa} />
              <FilterRow label="Bikarbonat (HCO₃, mg/L)" min={minHCO3} setMin={setMinHCO3} max={maxHCO3} setMax={setMaxHCO3} />
              <FilterRow label="Nitrat (NO₃, mg/L)" min={minNO3} setMin={setMinNO3} max={maxNO3} setMax={setMaxNO3} />
              <FilterRow label="Toplam Çözünmüş Madde (TDS, mg/L)" min={minTDS} setMin={setMinTDS} max={maxTDS} setMax={setMaxTDS} />
              <FilterRow label="pH" min={minPH} setMin={setMinPH} max={maxPH} setMax={setMaxPH} placeholderMin="min (örn. 6.5)" placeholderMax="max (örn. 8.5)" />
              <Text style={styles.fpInfo}>* Boş bıraktığın alanlar filtrelenmez. Min {'>'} Max girilirse uyarır.</Text>
            </ScrollView>
            <View style={styles.fpFooter}>
              <Pressable onPress={() => setFpOpen(false)} style={styles.btnGhost}>
                <Text style={styles.btnGhostText}>Vazgeç</Text>
              </Pressable>
              <Pressable onPress={applyFilters} style={styles.btnPrimary}>
                <Text style={styles.btnPrimaryText}>Uygula</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );

  function resetFilters() {
    setMinNa(""); setMaxNa(""); setMinMg(""); setMaxMg(""); setMinCa(""); setMaxCa("");
    setMinHCO3(""); setMaxHCO3(""); setMinPH(""); setMaxPH(""); setMinNO3(""); setMaxNO3("");
    setMinTDS(""); setMaxTDS("");
  }

  function applyFilters() {
    // Basit min<=max validasyonu
    const pairs: [string, string, string][] = [
      ["Na", minNa, maxNa], ["Mg", minMg, maxMg], ["Ca", minCa, maxCa],
      ["HCO3", minHCO3, maxHCO3], ["NO3", minNO3, maxNO3],
      ["TDS", minTDS, maxTDS], ["pH", minPH, maxPH],
    ];
    const bad = pairs.filter(([key, lo, hi]) => {
      const nlo = num(lo); const nhi = num(hi);
      return nlo !== undefined && nhi !== undefined && nlo > nhi;
    });
    if (bad.length) {
      Alert.alert("Geçersiz Aralık", bad.map(([k]) => `• ${k}: min > max`).join("\n"));
      return;
    }
    setFpOpen(false);
    loadProducts();
  }
}

/** Badge */
function Badge({ label, value }: { label: string; value?: number }) {
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeLabel}>{label}</Text>
      <Text style={styles.badgeVal}>{value ?? "-"}</Text>
    </View>
  );
}

/** FilterRow: Min/Max numeric input çifti */
function FilterRow(props: {
  label: string;
  min: string; setMin: (s: string) => void;
  max: string; setMax: (s: string) => void;
  placeholderMin?: string; placeholderMax?: string;
}) {
  const { label, min, setMin, max, setMax, placeholderMin, placeholderMax } = props;
  return (
    <View style={styles.fRow}>
      <Text style={styles.fLabel}>{label}</Text>
      <View style={styles.fInputs}>
        <TextInput
          value={min}
          onChangeText={setMin}
          keyboardType="decimal-pad"
          placeholder={placeholderMin ?? "min"}
          placeholderTextColor="#94a3b8"
          style={styles.fInput}
        />
        <Text style={{ marginHorizontal: 6, color: "#64748b" }}>—</Text>
        <TextInput
          value={max}
          onChangeText={setMax}
          keyboardType="decimal-pad"
          placeholder={placeholderMax ?? "max"}
          placeholderTextColor="#94a3b8"
          style={styles.fInput}
        />
      </View>
    </View>
  );
}

// ---------- Styles ----------
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

  searchRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 8 },
  searchInput: { flex: 1, backgroundColor: "white", borderColor: "#cbd5e1", borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, color: "#0f172a" },
  btn: { backgroundColor: "#0369a1", paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10 },
  btnText: { color: "white", fontWeight: "700" },
  btnGhost: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: "#94a3b8" },
  btnGhostSm: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: "#94a3b8" },
  btnGhostText: { color: "#334155", fontWeight: "600" },

  list: { paddingHorizontal: 16, paddingTop: 8 },

  card: { backgroundColor: "white", borderRadius: 14, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: "#e2e8f0",
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  cardActive: { borderColor: "#7dd3fc", backgroundColor: "#f0f9ff" },
  cardTitle: { fontWeight: "700", color: "#0f172a", marginBottom: 6 },
  source: { color: "#475569" },
  rowLine: { flexDirection: "row", flexWrap: "wrap" },

  badge: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12,
    backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#e2e8f0",
    marginRight: 8, marginBottom: 8
  },
  badgeLabel: { fontSize: 12, color: "#64748b" },
  badgeVal: { fontWeight: "700", color: "#0f172a" },

  highlights: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 96 },
  hTitle: { fontWeight: "800", marginBottom: 6, color: "#0f172a" },
  hLine: { marginTop: 4, color: "#111827" },

  bottomBar: { position: "absolute", left: 16, right: 16, bottom: 16, backgroundColor: "white", borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: "#e2e8f0", flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  rowActions: { flexDirection: "row" },
  btnPrimary: { backgroundColor: "#0284c7", paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10 },
  btnPrimaryText: { color: "white", fontWeight: "800" },

  // --- Filter Panel ---
  fpBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },
  fpSheet: { backgroundColor: "white", borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16, maxHeight: "85%" },
  fpHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  fpTitle: { fontSize: 18, fontWeight: "800", color: "#0f172a" },
  fpInfo: { color: "#64748b", marginTop: 8 },
  fpFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 8 },

  fRow: { marginTop: 10 },
  fLabel: { fontWeight: "700", color: "#0f172a", marginBottom: 6 },
  fInputs: { flexDirection: "row", alignItems: "center" },
  fInput: { flex: 1, backgroundColor: "#f8fafc", borderColor: "#e2e8f0", borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, color: "#0f172a" },
});
