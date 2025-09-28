import { useEffect, useState } from "react";
import { Button, FlatList, StyleSheet, Text, View } from "react-native";

type Product = {
  id: number;
  brand: string;
  name: string;
  na_mg_l: number;
  mg_mg_l: number;
};

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

export default function Index() {
  const [msg, setMsg] = useState("");
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  const loadHello = async () => {
    const r = await fetch(`${API_URL}/hello`);
    const d = await r.json();
    setMsg(d.message);
  };

  const loadProducts = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API_URL}/products`);
      const d = await r.json();
      setItems(d);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  return (
    <View style={styles.container}>
      <Button title="Backend'den mesaj al" onPress={loadHello} />
      {!!msg && <Text style={styles.title}>{msg}</Text>}

      <Text style={styles.section}>Ürünler</Text>
      <FlatList
        style={{ width: "90%" }}
        data={items}
        keyExtractor={(x) => String(x.id)}
        refreshing={loading}
        onRefresh={loadProducts}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              {item.brand} — {item.name}
            </Text>
            <Text>Sodyum: {item.na_mg_l} mg/L</Text>
            <Text>Magnezyum: {item.mg_mg_l} mg/L</Text>
          </View>
        )}
        ListEmptyComponent={
          <Text style={{ marginTop: 12 }}>Liste yükleniyor ya da boş…</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", paddingTop: 60 },
  title: { marginTop: 12, fontSize: 16 },
  section: { marginTop: 24, fontWeight: "bold", fontSize: 16, marginBottom: 8 },
  card: { padding: 12, borderWidth: 1, borderRadius: 8, marginBottom: 10 },
  cardTitle: { fontWeight: "600", marginBottom: 4 } // <-- eksik olan stil eklendi
});
