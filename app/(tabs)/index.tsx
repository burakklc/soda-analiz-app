import { useState } from "react";
import { Button, Text, View } from "react-native";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

export default function Index() {
  const [msg, setMsg] = useState("");

  const load = async () => {
    const res = await fetch(`${API_URL}/hello`);
    const data = await res.json();
    setMsg(data.message);
  };

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Button title="Backend'den mesaj al" onPress={load} />
      {msg ? <Text style={{ marginTop: 12 }}>{msg}</Text> : null}
    </View>
  );
}
