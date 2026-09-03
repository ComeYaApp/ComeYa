import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { apiRequest } from "@/lib/query-client";

const PRIMARY = "#E60000";
const W = 520;
const H = 140;
const PAD_L = 48;
const PAD_R = 16;
const PAD_T = 12;
const PAD_B = 28;
const BAR_W = 36;

function fmt(cents: number) {
  if (cents >= 100_000) return `${(cents / 100 / 1_000).toFixed(1)} €K`;
  return `${(cents / 100).toFixed(0)} €`;
}

const DAYS_ES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export function SalesChart() {
  const { isDark } = useTheme();
  const [data, setData] = useState<{ date: string; amount: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest("GET", "/api/admin/finance/earnings-chart?days=7")
      .then((r) => r.json())
      .then((res) => {
        if (res?.chartData?.length) {
          setData(res.chartData.slice(-7));
        } else {
          // fallback: últimos 7 días vacíos
          const days = Array.from({ length: 7 }, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - (6 - i));
            return { date: d.toISOString().split("T")[0], amount: 0 };
          });
          setData(days);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const bg = isDark ? "#1a1a1a" : "#fff";
  const border = isDark ? "#2a2a2a" : "#f0f0f0";
  const text = isDark ? "#fff" : "#111";
  const sub = isDark ? "#555" : "#ddd";
  const subTxt = isDark ? "#666" : "#aaa";

  const maxVal = Math.max(...data.map((d) => d.amount), 1);
  const total = data.reduce((s, d) => s + d.amount, 0);
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;
  const step = chartW / Math.max(data.length, 1);
  const todayIdx = data.length - 1;

  // Y-axis labels (3 levels)
  const yLabels = [0, 0.5, 1].map((f) => ({
    y: PAD_T + chartH * (1 - f),
    val: maxVal * f,
  }));

  return (
    <View style={[chart.card, { backgroundColor: bg, borderColor: border }]}>
      {/* Header */}
      <View style={chart.header}>
        <View style={[chart.iconWrap, { backgroundColor: PRIMARY + "15" }]}>
          <Feather name="bar-chart-2" size={15} color={PRIMARY} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[chart.title, { color: text }]}>
            Ingresos últimos 7 días
          </Text>
          <Text style={[chart.sub, { color: subTxt }]}>
            Comisiones ComeYa · total {fmt(total)}
          </Text>
        </View>
        {loading && <ActivityIndicator size="small" color={PRIMARY} />}
      </View>

      {/* SVG chart */}
      <View style={chart.svgWrap}>
        {/* @ts-ignore — svg es válido en web */}
        <svg
          width="100%"
          viewBox={`0 0 ${W} ${H}`}
          style={{ display: "block" }}
        >
          {/* Grid lines */}
          {yLabels.map((yl, i) => (
            <g key={i}>
              <line
                x1={PAD_L}
                y1={yl.y}
                x2={W - PAD_R}
                y2={yl.y}
                stroke={isDark ? "#2a2a2a" : "#f0f0f0"}
                strokeWidth="1"
              />
              <text
                x={PAD_L - 6}
                y={yl.y + 4}
                textAnchor="end"
                fontSize="9"
                fill={isDark ? "#555" : "#bbb"}
              >
                {fmt(yl.val)}
              </text>
            </g>
          ))}

          {/* Bars */}
          {data.map((d, i) => {
            const barH = Math.max((d.amount / maxVal) * chartH, 2);
            const x = PAD_L + i * step + (step - BAR_W) / 2;
            const y = PAD_T + chartH - barH;
            const isToday = i === todayIdx;
            const color = isToday ? PRIMARY : isDark ? "#3a3a3a" : "#e8e8e8";
            const labelColor = isToday ? PRIMARY : isDark ? "#555" : "#bbb";
            const dayName = DAYS_ES[new Date(d.date + "T12:00:00").getDay()];

            return (
              <g key={d.date}>
                {/* Bar */}
                <rect
                  x={x}
                  y={y}
                  width={BAR_W}
                  height={barH}
                  rx="6"
                  fill={color}
                  opacity={isToday ? 1 : 0.7}
                />
                {/* Value on top */}
                {d.amount > 0 && (
                  <text
                    x={x + BAR_W / 2}
                    y={y - 4}
                    textAnchor="middle"
                    fontSize="9"
                    fontWeight="700"
                    fill={labelColor}
                  >
                    {fmt(d.amount)}
                  </text>
                )}
                {/* Day label */}
                <text
                  x={x + BAR_W / 2}
                  y={H - 6}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight={isToday ? "700" : "400"}
                  fill={labelColor}
                >
                  {dayName}
                </text>
              </g>
            );
          })}
        </svg>
      </View>
    </View>
  );
}

const chart = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, padding: 20, marginBottom: 16 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  title: { fontSize: 14, fontWeight: "700" },
  sub: { fontSize: 11, marginTop: 2 },
  svgWrap: { width: "100%", minHeight: H },
});
