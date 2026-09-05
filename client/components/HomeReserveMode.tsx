// Modo "Reservar mesa" de la Home: buscador con fecha, hora y comensales,
// secciones 🔥 Últimas mesas / 📍 Ahora / ⚡ Flash, 🎲 Sorpréndeme y el
// asistente 🤖 "Pregúntale a ComeYa". Todo con disponibilidad real del backend.
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import {
  Spacing,
  BorderRadius,
  ComeYaColors,
  Shadows,
} from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

const TIME_OPTIONS = [
  "13:00", "13:30", "14:00", "14:30", "15:00",
  "20:00", "20:30", "21:00", "21:30", "22:00",
];

const STATUS_META: Record<string, { label: string; color: string }> = {
  available: { label: "Mesa disponible", color: "#10B981" },
  last: { label: "Últimas mesas", color: "#F59E0B" },
  full: { label: "Completo", color: "#EF4444" },
};

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function nowHHmm(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function HomeReserveMode() {
  const navigation = useNavigation();
  const { theme } = useTheme();

  const today = toDateStr(new Date());
  const [view, setView] = useState<"search" | "last" | "now">("search");
  const [date, setDate] = useState(today);
  const [time, setTime] = useState<string | null>(null);
  const [party, setParty] = useState(2);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Flash / Sorpréndeme / IA
  const [flashes, setFlashes] = useState<any[]>([]);
  const [surprise, setSurprise] = useState<any>(null);
  const [surpriseLoading, setSurpriseLoading] = useState(false);
  const [aiQuery, setAiQuery] = useState("");
  const [aiOptions, setAiOptions] = useState<any[] | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(Date.now() + i * 24 * 60 * 60 * 1000);
    return {
      value: toDateStr(d),
      label:
        i === 0
          ? "Hoy"
          : i === 1
            ? "Mañana"
            : d.toLocaleDateString("es-ES", { weekday: "short", day: "numeric" }),
    };
  });

  const loadTables = useCallback(async () => {
    setLoading(true);
    try {
      if (view === "search") {
        const qs = `date=${date}&partySize=${party}${time ? `&time=${time}` : ""}`;
        const res = await apiRequest("GET", `/api/reservations/search?${qs}`);
        const data = await res.json();
        setResults(data.success ? data.businesses || [] : []);
      } else {
        // "Últimas mesas" (fecha elegida) o "Ahora" (hoy desde ya)
        const d = view === "now" ? today : date;
        const from = view === "now" ? nowHHmm() : "";
        const res = await apiRequest(
          "GET",
          `/api/reservations/last-tables?date=${d}&partySize=${party}${from ? `&from=${from}` : ""}`,
        );
        const data = await res.json();
        setResults(data.success ? data.tables || [] : []);
        // Mesas flash activas para esa fecha
        try {
          const fRes = await apiRequest(
            "GET",
            `/api/reservations/flash?date=${d}`,
          );
          const fData = await fRes.json();
          setFlashes(fData.success ? fData.flashes || [] : []);
        } catch {
          setFlashes([]);
        }
      }
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [view, date, time, party, today]);

  useEffect(() => {
    setAiOptions(null);
    loadTables();
  }, [loadTables]);

  const rollSurprise = async () => {
    setSurpriseLoading(true);
    setSurprise(null);
    try {
      const res = await apiRequest(
        "GET",
        `/api/reservations/surprise?date=${date}&partySize=${party}`,
      );
      const data = await res.json();
      setSurprise(data.success ? data.suggestion : null);
    } catch {
    } finally {
      setSurpriseLoading(false);
    }
  };

  const askAI = async () => {
    if (!aiQuery.trim()) return;
    setAiLoading(true);
    setAiOptions(null);
    try {
      const res = await apiRequest("POST", "/api/reservations/ai-recommend", {
        query: aiQuery.trim(),
        date,
        partySize: party,
      });
      const data = await res.json();
      setAiOptions(data.success ? data.options || [] : []);
    } catch {
    } finally {
      setAiLoading(false);
    }
  };

  const openBusiness = (id: string) =>
    (navigation as any).navigate("BusinessDetail", { businessId: id });

  const dateLabel = new Date(`${date}T12:00:00`).toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  // ── Tarjeta de resultado: dos formas (búsqueda por negocio / tabla por hora)
  const ResultCard = ({ item }: { item: any }) => {
    const meta = STATUS_META[item.availability?.status || item.status] || STATUS_META.available;
    return (
      <Pressable
        onPress={() => openBusiness(item.id || item.businessId)}
        style={[styles.card, { backgroundColor: theme.card }, Shadows.sm]}
      >
        <Image
          source={{
            uri:
              item.image ||
              "https://res.cloudinary.com/dkuj3vq57/image/upload/v1/comeya/placeholder-food.jpg",
          }}
          style={styles.cardImage}
          contentFit="cover"
        />
        <View style={styles.cardBody}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <ThemedText style={{ fontWeight: "700", flexShrink: 1 }} numberOfLines={1}>
              {item.name || item.businessName}
            </ThemedText>
            {item.time ? (
              <View
                style={[styles.timeChip, { backgroundColor: `${meta.color}20` }]}
              >
                <ThemedText type="caption" style={{ color: meta.color, fontWeight: "800" }}>
                  {item.time}
                </ThemedText>
              </View>
            ) : null}
          </View>
          <ThemedText
            type="caption"
            style={{ color: theme.textSecondary, marginTop: 2 }}
            numberOfLines={1}
          >
            {item.address || ""}
          </ThemedText>
          <View style={styles.cardMetaRow}>
            <Feather name="star" size={12} color="#F59E0B" />
            <ThemedText type="caption" style={{ marginLeft: 3 }}>
              {((item.rating || 0) / 10).toFixed(1)} ({item.totalRatings || 0})
            </ThemedText>
          </View>
          <View style={[styles.availBadge, { backgroundColor: `${meta.color}18` }]}>
            <View style={[styles.availDot, { backgroundColor: meta.color }]} />
            <ThemedText
              type="caption"
              style={{ color: meta.color, marginLeft: 5, fontWeight: "700" }}
            >
              {meta.label}
            </ThemedText>
          </View>
        </View>
        <Feather name="chevron-right" size={20} color={theme.textSecondary} style={{ alignSelf: "center" }} />
      </Pressable>
    );
  };

  return (
    <View>
      <ThemedText type="h1" style={styles.title}>
        ¿Dónde quieres comer?
      </ThemedText>
      <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: Spacing.md }}>
        Elige día, hora y comensales: te mostramos mesas reales.
      </ThemedText>

      {/* Vista rápida: Buscar / Últimas mesas / Ahora */}
      <View style={styles.viewRow}>
        {(
          [
            { id: "search", label: "🔎 Buscar", hint: "" },
            { id: "last", label: "🔥 Últimas mesas", hint: "" },
            { id: "now", label: "📍 Ahora", hint: "" },
          ] as const
        ).map((v) => (
          <Pressable
            key={v.id}
            onPress={() => setView(v.id)}
            style={[
              styles.viewChip,
              { backgroundColor: view === v.id ? ComeYaColors.primary : theme.backgroundSecondary },
            ]}
          >
            <ThemedText
              type="small"
              style={{ color: view === v.id ? "#FFF" : theme.text, fontWeight: "700" }}
            >
              {v.label}
            </ThemedText>
          </Pressable>
        ))}
        <Pressable
          onPress={() => (navigation as any).navigate("ComeYaPlan")}
          style={[styles.viewChip, { backgroundColor: theme.backgroundSecondary }]}
        >
          <ThemedText type="small" style={{ color: theme.text, fontWeight: "700" }}>
            🗓️ Plan de noche
          </ThemedText>
        </Pressable>
        <Pressable
          onPress={rollSurprise}
          disabled={surpriseLoading}
          style={[styles.viewChip, { backgroundColor: theme.backgroundSecondary }]}
        >
          {surpriseLoading ? (
            <ActivityIndicator size="small" color={ComeYaColors.primary} />
          ) : (
            <ThemedText type="small" style={{ color: theme.text, fontWeight: "700" }}>
              🎲 Sorpréndeme
            </ThemedText>
          )}
        </Pressable>
      </View>

      {view === "search" ? (
        <>
          <ThemedText type="small" style={[styles.label, { color: theme.textSecondary }]}>
            Día · <ThemedText type="small" style={{ textTransform: "capitalize" }}>{dateLabel}</ThemedText>
          </ThemedText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.xs, paddingBottom: Spacing.sm }}>
            {days.map((d) => {
              const active = d.value === date;
              return (
                <Pressable
                  key={d.value}
                  onPress={() => setDate(d.value)}
                  style={[
                    styles.chip,
                    { backgroundColor: active ? ComeYaColors.primary : theme.card, borderColor: active ? ComeYaColors.primary : theme.border },
                  ]}
                >
                  <ThemedText type="small" style={{ color: active ? "#FFF" : theme.text, fontWeight: "600", textTransform: "capitalize" }}>
                    {d.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </ScrollView>

          <ThemedText type="small" style={[styles.label, { color: theme.textSecondary }]}>Hora</ThemedText>
          <View style={styles.rowWrap}>
            <Pressable onPress={() => setTime(null)} style={[styles.chip, { backgroundColor: time === null ? ComeYaColors.primary : theme.card, borderColor: time === null ? ComeYaColors.primary : theme.border }]}>
              <ThemedText type="small" style={{ color: time === null ? "#FFF" : theme.text, fontWeight: "600" }}>Cualquiera</ThemedText>
            </Pressable>
            {TIME_OPTIONS.map((t) => {
              const active = time === t;
              return (
                <Pressable key={t} onPress={() => setTime(t)} style={[styles.chip, { backgroundColor: active ? ComeYaColors.primary : theme.card, borderColor: active ? ComeYaColors.primary : theme.border }]}>
                  <ThemedText type="small" style={{ color: active ? "#FFF" : theme.text, fontWeight: "600" }}>{t}</ThemedText>
                </Pressable>
              );
            })}
          </View>

          <ThemedText type="small" style={[styles.label, { color: theme.textSecondary }]}>Comensales</ThemedText>
          <View style={styles.partyRow}>
            <Pressable onPress={() => setParty((p) => Math.max(1, p - 1))} style={[styles.partyBtn, { backgroundColor: theme.backgroundSecondary }]}>
              <Feather name="minus" size={16} color={theme.text} />
            </Pressable>
            <View style={styles.partyValue}>
              <Feather name="users" size={16} color={ComeYaColors.primary} />
              <ThemedText type="h4" style={{ marginLeft: 6 }}>{party} {party === 1 ? "persona" : "personas"}</ThemedText>
            </View>
            <Pressable onPress={() => setParty((p) => Math.min(20, p + 1))} style={[styles.partyBtn, { backgroundColor: ComeYaColors.primary }]}>
              <Feather name="plus" size={16} color="#FFF" />
            </Pressable>
          </View>
        </>
      ) : (
        <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: Spacing.md }}>
          {view === "now"
            ? "Restaurantes abiertos ahora mismo con mesa libre para hoy."
            : "Mesas que quedan libres para el día elegido, ordenadas por hora."}
        </ThemedText>
      )}

      {/* 🎲 Sorpréndeme */}
      {surprise ? (
        <Pressable onPress={() => openBusiness(surprise.id)} style={[styles.surpriseCard, { backgroundColor: theme.card }, Shadows.sm]}>
          <View style={[styles.surpriseIcon, { backgroundColor: `${ComeYaColors.primary}15` }]}>
            <ThemedText style={{ fontSize: 26 }}>🍝</ThemedText>
          </View>
          <View style={{ flex: 1, marginLeft: Spacing.md }}>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              Hoy te recomendamos
            </ThemedText>
            <ThemedText style={{ fontWeight: "800", fontSize: 17 }}>{surprise.name}</ThemedText>
            <ThemedText type="caption" style={{ color: theme.textSecondary, marginTop: 2 }}>
              {((surprise.rating || 0) / 10).toFixed(1)} ★ · {surprise.categories || surprise.address}
            </ThemedText>
            <View style={[styles.availBadge, { backgroundColor: "#10B98118", marginTop: 6 }]}>
              <Feather name="check-circle" size={12} color="#10B981" />
              <ThemedText type="caption" style={{ color: "#10B981", marginLeft: 5, fontWeight: "700" }}>
                Mesa a las {surprise.suggestedTime}
              </ThemedText>
            </View>
          </View>
          <Feather name="chevron-right" size={20} color={theme.textSecondary} />
        </Pressable>
      ) : null}

      {/* 🤖 Pregúntale a ComeYa */}
      <View style={[styles.aiBox, { backgroundColor: theme.card, borderColor: theme.border }, Shadows.sm]}>
        <ThemedText type="small" style={{ fontWeight: "700" }}>
          🤖 Pregúntale a ComeYa
        </ThemedText>
        <View style={[styles.aiRow, { marginTop: Spacing.sm }]}>
          <TextInput
            value={aiQuery}
            onChangeText={setAiQuery}
            placeholder='Ej.: "somos 5, comida mexicana, 25 € por persona"'
            placeholderTextColor={theme.textSecondary}
            style={[styles.aiInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundSecondary }]}
            onSubmitEditing={askAI}
          />
          <Pressable onPress={askAI} disabled={aiLoading} style={[styles.aiBtn, { opacity: aiLoading ? 0.6 : 1 }]}>
            {aiLoading ? <ActivityIndicator size="small" color="#FFF" /> : <Feather name="send" size={16} color="#FFF" />}
          </Pressable>
        </View>
        {aiOptions !== null ? (
          <View style={{ marginTop: Spacing.sm, gap: Spacing.sm }}>
            {aiOptions.length === 0 ? (
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                No encontré mesas que encajen con eso hoy. Prueba otra búsqueda.
              </ThemedText>
            ) : (
              aiOptions.map((o) => (
                <Pressable key={o.id} onPress={() => openBusiness(o.id)} style={[styles.aiOption, { backgroundColor: theme.backgroundSecondary }]}>
                  <View style={{ flex: 1 }}>
                    <ThemedText type="small" style={{ fontWeight: "800" }}>{o.name}</ThemedText>
                    <ThemedText type="caption" style={{ color: theme.textSecondary, marginTop: 2 }}>
                      {o.reason} · Mesa {o.suggestedTime}
                    </ThemedText>
                  </View>
                  <Feather name="calendar" size={16} color={ComeYaColors.primary} />
                </Pressable>
              ))
            )}
          </View>
        ) : null}
      </View>

      {/* ⚡ Mesas flash */}
      {flashes.length > 0 ? (
        <View style={{ marginTop: Spacing.md }}>
          <ThemedText type="h4" style={{ marginBottom: Spacing.sm }}>
            ⚡ Mesas flash
          </ThemedText>
          {flashes.map((f) => (
            <Pressable key={f.id} onPress={() => openBusiness(f.businessId)} style={[styles.flashCard, Shadows.sm]}>
              <View style={styles.flashTag}>
                <ThemedText type="caption" style={{ color: "#FFF", fontWeight: "800" }}>⚡ FLASH</ThemedText>
              </View>
              <View style={{ flex: 1, marginLeft: Spacing.md }}>
                <ThemedText style={{ fontWeight: "800" }}>{f.businessName}</ThemedText>
                <ThemedText type="caption" style={{ color: theme.textSecondary, marginTop: 2 }}>
                  {f.partySize} {f.partySize === 1 ? "persona" : "personas"} · hoy {f.time}
                  {f.note ? ` · ${f.note}` : ""}
                </ThemedText>
              </View>
              <Feather name="chevron-right" size={20} color={theme.textSecondary} />
            </Pressable>
          ))}
        </View>
      ) : null}

      {/* Resultados */}
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={ComeYaColors.primary} />
          <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.sm }}>
            Buscando mesas disponibles...
          </ThemedText>
        </View>
      ) : results.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Feather name="calendar" size={48} color={theme.textSecondary} />
          <ThemedText type="h4" style={{ color: theme.textSecondary, marginTop: Spacing.md }}>
            Sin restaurantes con reserva
          </ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.xs, textAlign: "center" }}>
            Prueba otra fecha u hora. Si un restaurante está completo, entra y
            activa el aviso 🔔 para que te notifiquemos si se libera una mesa.
          </ThemedText>
        </View>
      ) : (
        <View style={{ marginTop: Spacing.md, gap: Spacing.md }}>
          {results.map((b) => (
            <ResultCard key={b.id || `${b.businessId}-${b.time}`} item={b} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26 },
  label: { marginBottom: Spacing.xs, marginTop: Spacing.sm },
  viewRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.xs, marginBottom: Spacing.md },
  viewChip: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: BorderRadius.full },
  chip: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: BorderRadius.full, borderWidth: 1 },
  rowWrap: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.xs },
  partyRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: Spacing.lg, marginTop: Spacing.xs, marginBottom: Spacing.md },
  partyBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  partyValue: { flexDirection: "row", alignItems: "center" },
  loadingWrap: { alignItems: "center", marginTop: Spacing["3xl"] },
  emptyWrap: { alignItems: "center", marginTop: Spacing["3xl"], paddingHorizontal: Spacing.lg },
  surpriseCard: { flexDirection: "row", alignItems: "center", borderRadius: BorderRadius.lg, padding: Spacing.md, marginTop: Spacing.sm },
  surpriseIcon: { width: 54, height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center" },
  aiBox: { borderRadius: BorderRadius.lg, padding: Spacing.md, marginTop: Spacing.md, borderWidth: 1 },
  aiRow: { flexDirection: "row", gap: Spacing.sm },
  aiInput: { flex: 1, borderWidth: 1, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontSize: 13 },
  aiBtn: { width: 42, borderRadius: BorderRadius.md, backgroundColor: ComeYaColors.primary, alignItems: "center", justifyContent: "center" },
  aiOption: { flexDirection: "row", alignItems: "center", borderRadius: BorderRadius.md, padding: Spacing.md },
  flashCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#F59E0B12", borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.sm, borderWidth: 1, borderColor: "#F59E0B55" },
  flashTag: { backgroundColor: "#F59E0B", borderRadius: BorderRadius.md, paddingHorizontal: Spacing.sm, paddingVertical: 6 },
  card: { flexDirection: "row", borderRadius: BorderRadius.lg, padding: Spacing.md, gap: Spacing.md },
  cardImage: { width: 72, height: 72, borderRadius: BorderRadius.md },
  cardBody: { flex: 1 },
  cardMetaRow: { flexDirection: "row", alignItems: "center", marginTop: 2 },
  timeChip: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.full },
  availBadge: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: BorderRadius.full, marginTop: 6 },
  availDot: { width: 7, height: 7, borderRadius: 4 },
});
