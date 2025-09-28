import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";

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

type CompareHighlights = {
  lowestNa?: { id: string; brand: string; name: string; value: number };
  highestHCO3?: { id: string; brand: string; name: string; value: number };
  highestMg?: { id: string; brand: string; name: string; value: number };
  highestCa?: { id: string; brand: string; name: string; value: number };
  lowestNO3?: { id: string; brand: string; name: string; value: number };
  closestPH?: { id: string; brand: string; name: string; value: number; target: number };
  highestTDS?: { id: string; brand: string; name: string; value: number };
};

export default function TabHome() {
  const [rows, setRows] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [compLoading, setCompLoading] = useState(false);
  const [highlights, setHighlights] = useState<CompareHighlights | null>(null);

  // Listeyi çek
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(
          `${BASE}/products` +
          toQS({ profile: "sodiumRestricted", sortBy: "composition.na", sortDir: "asc", page: 1, pageSize: 20 })
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setRows(data.items ?? []);
      } catch (e: any) {
        setErr(e?.message ?? "Hata");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Seçimi aç/kapat
  const toggleSelect = (id: string) => {
    setHighlights(null);
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter(x => x !== id) : (prev.length < 6 ? [...prev, id] : prev)
    );
  };

  // Karşılaştır çağrısı
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
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Üst Bilgi + Buton */}
      <View style={styles.toolbar}>
        <Text style={styles.toolbarText}>{selectionInfo}</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable
            onPress={() => { setSelectedIds([]); setHighlights(null); }}
            style={({ pressed }) => [styles.btnGhost, pressed && { opacity: 0.8 }]}
          >
            <Text style={styles.btnGhostText}>Temizle</Text>
          </Pressable>
          <Pressable
            onPress={doCompare}
            style={({ pressed }) => [styles.btn, pressed && { opacity: 0.8 }]}
          >
            <Text style={styles.btnText}>{compLoading ? "Karşılaştırılıyor…" : "Karşılaştır"}</Text>
          </Pressable>
        </View>
      </View>

      {/* Liste */}
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const active = selectedIds.includes(item.id);
          return (
            <Pressable onPress={() => toggleSelect(item.id)} style={[styles.row, active && styles.rowActive]}>
              <Text style={styles.title}>
                {active ? "✓ " : ""}{item.brand} · {item.name}
              </Text>
              <Text style={styles.line}>
                Na: {item.composition.na ?? "-"}  ·  Mg: {item.composition.mg ?? "-"}  ·  Ca: {item.composition.ca ?? "-"}
              </Text>
              <Text style={styles.line}>
                HCO₃: {item.composition.hco3 ?? "-"}  ·  TDS: {item.composition.tds ?? "-"}  ·  pH: {item.composition.ph ?? "-"}
              </Text>
            </Pressable>
          );
        }}
        ListEmptyComponent={<Text style={{ padding: 16 }}>Veri bulunamadı.</Text>}
        ListFooterComponent={
          highlights ? (
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
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  toolbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: "#ddd" },
  toolbarText: { color: "#333" },
  btn: { backgroundColor: "#0ea5e9", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  btnText: { color: "white", fontWeight: "600" },
  btnGhost: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: "#bbb" },
  btnGhostText: { color: "#333" },
  list: { padding: 16 },
  row: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: "#ccc" },
  rowActive: { backgroundColor: "#eefaff" },
  title: { fontWeight: "600", marginBottom: 4 },
  line: { color: "#333" },
  highlights: { paddingTop: 16 },
  hTitle: { fontWeight: "700", marginBottom: 8 },
  hLine: { marginTop: 4, color: "#222" },
});
