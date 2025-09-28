import React, { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import { fetchProducts, Product } from "../constants/api";

export default function ProductsList() {
  const [rows, setRows] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const data = await fetchProducts({
          profile: "sodiumRestricted",
          sortBy: "composition.na",
          sortDir: "asc",
          page: 1,
          pageSize: 20,
        });
        setRows(data.items);
      } catch (e: any) {
        setErr(e?.message ?? "Hata");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={{ marginTop: 8 }}>Yükleniyor…</Text>
      </View>
    );
  }
  if (err) return <View style={styles.container}><Text style={{ color: "red" }}>{err}</Text></View>;

  return (
    <FlatList
      data={rows}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.container}
      renderItem={({ item }) => (
        <View style={styles.row}>
          <Text style={styles.title}>{item.brand} · {item.name}</Text>
          <Text style={styles.line}>
            Na: {item.composition.na ?? "-"}  ·  Mg: {item.composition.mg ?? "-"}  ·  Ca: {item.composition.ca ?? "-"}
          </Text>
          <Text style={styles.line}>
            HCO₃: {item.composition.hco3 ?? "-"}  ·  TDS: {item.composition.tds ?? "-"}  ·  pH: {item.composition.ph ?? "-"}
          </Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  row: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: "#ccc" },
  title: { fontWeight: "600", marginBottom: 4 },
  line: { color: "#333" },
});
