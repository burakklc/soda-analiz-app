// soda-analiz-app/constants/api.ts
type Params = Record<string, string | number | boolean | undefined>;

// EXPO_PUBLIC_ ile başlayan değişkenleri .env'den okur
const BASE =
  (process.env as any).EXPO_PUBLIC_API_URL || "http://127.0.0.1:8000";

function toQS(params: Params) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) qs.append(k, String(v));
  });
  const s = qs.toString();
  return s ? `?${s}` : "";
}

export type Product = {
  id: string;
  name: string;
  brand: string;
  source?: string;
  composition: {
    na?: number; mg?: number; ca?: number; hco3?: number; tds?: number; ph?: number;
  };
};

export async function fetchProducts(params: Params = {}) {
  const res = await fetch(`${BASE}/products${toQS(params)}`);
  if (!res.ok) throw new Error(`Products fetch failed: ${res.status}`);
  return res.json() as Promise<{ items: Product[] }>;
}

export async function fetchProfiles() {
  const res = await fetch(`${BASE}/profiles`);
  if (!res.ok) throw new Error(`Profiles fetch failed: ${res.status}`);
  return res.json();
}

export async function compare(ids: string[], targetPh?: number) {
  const params: Params = { ids: ids.join(",") };
  if (targetPh !== undefined) params.targetPh = targetPh;
  const res = await fetch(`${BASE}/compare${toQS(params)}`);
  if (!res.ok) throw new Error(`Compare fetch failed: ${res.status}`);
  return res.json();
}
