// Tarjetas de los planes de suscripción ComeYa — arte SVG con volumen.
// Nada de bandas de color planas: cada plan tiene fondo con capas, esferas
// con efecto 3D (luz/sombra radial), motivo propio y el logo ComeYa en un
// borde pequeño. Se usa en la pantalla de Suscripciones (app y web).
import React from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import Svg, {
  Defs,
  LinearGradient,
  RadialGradient,
  Stop,
  Rect,
  Circle,
  Path,
  Polygon,
  Ellipse,
} from "react-native-svg";

const W = 340;
const H = 150;

type PlanArtKey =
  | "impulso_local"
  | "top_soria"
  | "premium_soria"
  | "soria_local"
  | "comeya_pass";

interface PlanArtDef {
  colors: [string, string, string];
  sphere: [string, string]; // [luz, sombra] de las esferas 3D
}

const ART: Record<PlanArtKey, PlanArtDef> = {
  impulso_local: {
    colors: ["#1E3A8A", "#4338CA", "#7C3AED"],
    sphere: ["#93C5FD", "#1D4ED8"],
  },
  top_soria: {
    colors: ["#7C2D12", "#B91C1C", "#F59E0B"],
    sphere: ["#FDE68A", "#B45309"],
  },
  premium_soria: {
    colors: ["#0A0A0A", "#292524", "#B8860B"],
    sphere: ["#FDE68A", "#78350F"],
  },
  soria_local: {
    colors: ["#065F46", "#059669", "#6EE7B7"],
    sphere: ["#A7F3D0", "#047857"],
  },
  comeya_pass: {
    colors: ["#831843", "#DB2777", "#F472B6"],
    sphere: ["#FBCFE8", "#BE185D"],
  },
};

/** Esfera con volumen: gradiente radial desplazado hacia la luz. */
function Sphere({
  cx,
  cy,
  r,
  colors,
  id,
}: {
  cx: number;
  cy: number;
  r: number;
  colors: [string, string];
  id: string;
}) {
  return (
    <>
      <Defs>
        <RadialGradient id={id} cx="0.32" cy="0.28" r="0.95">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.95" />
          <Stop offset="0.25" stopColor={colors[0]} />
          <Stop offset="1" stopColor={colors[1]} />
        </RadialGradient>
      </Defs>
      <Circle cx={cx} cy={cy} r={r} fill={`url(#${id})`} />
      {/* sombra de contacto para asentarla en el fondo */}
      <Ellipse
        cx={cx}
        cy={cy + r * 0.95}
        rx={r * 0.75}
        ry={r * 0.18}
        fill="#000000"
        opacity={0.18}
      />
    </>
  );
}

function Motif({ plan }: { plan: PlanArtKey }) {
  if (plan === "impulso_local") {
    // Cohete en despegue con estela
    return (
      <>
        <Path
          d={`M ${W - 74} 96 c 12 -22 34 -30 44 -30 c -2 14 -10 34 -30 42 z`}
          fill="#F8FAFC"
          opacity={0.95}
        />
        <Circle cx={W - 56} cy={80} r={5} fill="#1E3A8A" opacity={0.85} />
        <Polygon
          points={`${W - 66},108 ${W - 58},122 ${W - 76},116`}
          fill="#FB923C"
        />
        <Circle cx={W - 72} cy={124} r={3.5} fill="#FDBA74" opacity={0.9} />
        <Circle cx={W - 78} cy={134} r={2.5} fill="#FED7AA" opacity={0.8} />
        <Circle cx={44} cy={36} r={1.8} fill="#FFFFFF" opacity={0.9} />
        <Circle cx={110} cy={24} r={1.4} fill="#FFFFFF" opacity={0.7} />
        <Circle cx={150} cy={116} r={1.6} fill="#FFFFFF" opacity={0.8} />
      </>
    );
  }
  if (plan === "top_soria") {
    // Trofeo sobre pedestal con rayos
    return (
      <>
        <Polygon
          points={`40,20 52,44 28,44`}
          fill="#FDE68A"
          opacity={0.55}
        />
        <Polygon
          points={`${W - 40},18 ${W - 28},42 ${W - 52},42`}
          fill="#FDE68A"
          opacity={0.45}
        />
        <Path
          d={`M ${W - 92} 46 h 44 v 16 a 22 22 0 0 1 -44 0 z`}
          fill="#FDE68A"
        />
        <Path
          d={`M ${W - 92} 50 a 12 12 0 0 0 -10 12 a 12 12 0 0 0 12 10`}
          stroke="#FDE68A"
          strokeWidth={3}
          fill="none"
        />
        <Path
          d={`M ${W - 48} 50 a 12 12 0 0 1 10 12 a 12 12 0 0 1 -12 10`}
          stroke="#FDE68A"
          strokeWidth={3}
          fill="none"
        />
        <Rect x={W - 76} y={86} width={12} height={10} fill="#FDE68A" />
        <Rect x={W - 84} y={96} width={28} height={7} rx={2} fill="#FDE68A" />
      </>
    );
  }
  if (plan === "premium_soria") {
    // Corona dorada con destellos de 4 puntas
    const sparkle = (cx: number, cy: number, r: number, o: number) => (
      <Path
        key={`${cx}-${cy}`}
        d={`M ${cx} ${cy - r} L ${cx + r * 0.3} ${cy - r * 0.3} L ${cx + r} ${cy} L ${cx + r * 0.3} ${cy + r * 0.3} L ${cx} ${cy + r} L ${cx - r * 0.3} ${cy + r * 0.3} L ${cx - r} ${cy} L ${cx - r * 0.3} ${cy - r * 0.3} Z`}
        fill="#FDE68A"
        opacity={o}
      />
    );
    return (
      <>
        <Path
          d={`M ${W - 108} 92 l 6 -26 14 14 12 -22 12 22 14 -14 6 26 z`}
          fill="#FDE68A"
        />
        <Circle cx={W - 102} cy={62} r={3.5} fill="#FDE68A" />
        <Circle cx={W - 76} cy={52} r={3.5} fill="#FDE68A" />
        <Circle cx={W - 50} cy={62} r={3.5} fill="#FDE68A" />
        {sparkle(52, 36, 9, 0.9)}
        {sparkle(120, 112, 6, 0.7)}
        {sparkle(196, 26, 5, 0.8)}
      </>
    );
  }
  if (plan === "soria_local") {
    // Colinas de Soria con sol
    return (
      <>
        <Circle cx={W - 58} cy={44} r={16} fill="#FEF3C7" opacity={0.95} />
        <Circle cx={W - 58} cy={44} r={22} fill="#FEF3C7" opacity={0.25} />
        <Path
          d={`M 0 ${H - 30} Q 70 ${H - 62} 150 ${H - 34} T ${W} ${H - 40} L ${W} ${H} L 0 ${H} Z`}
          fill="#064E3B"
          opacity={0.55}
        />
        <Path
          d={`M 0 ${H - 16} Q 90 ${H - 44} 190 ${H - 20} T ${W} ${H - 24} L ${W} ${H} L 0 ${H} Z`}
          fill="#022C22"
          opacity={0.5}
        />
      </>
    );
  }
  // comeya_pass: portal con estrella central
  return (
    <>
      <Circle
        cx={W - 70}
        cy={72}
        r={34}
        stroke="#FBCFE8"
        strokeWidth={2.5}
        fill="none"
        opacity={0.8}
      />
      <Circle
        cx={W - 70}
        cy={72}
        r={24}
        stroke="#FBCFE8"
        strokeWidth={1.5}
        fill="none"
        opacity={0.5}
      />
      <Path
        d={`M ${W - 70} 56 l 5 11 12 1 -9 8 3 12 -11 -6 -11 6 3 -12 -9 -8 12 -1 z`}
        fill="#FDE68A"
      />
      <Circle cx={54} cy={34} r={1.8} fill="#FFFFFF" opacity={0.9} />
      <Circle cx={130} cy={118} r={1.6} fill="#FFFFFF" opacity={0.7} />
    </>
  );
}

export function PlanCardArt({
  plan,
  name,
  priceLabel,
  style,
}: {
  plan: PlanArtKey;
  name: string;
  priceLabel: string;
  style?: any;
}) {
  const cfg = ART[plan] ?? ART.soria_local;
  const sid = `s-${plan}`;
  const gid = `g-${plan}`;
  return (
    <View style={[styles.card, style]}>
      <Svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${W} ${H}`}
        style={StyleSheet.absoluteFill}
        preserveAspectRatio="xMidYMid slice"
      >
        <Defs>
          <LinearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={cfg.colors[0]} />
            <Stop offset="0.55" stopColor={cfg.colors[1]} />
            <Stop offset="1" stopColor={cfg.colors[2]} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={W} height={H} fill={`url(#${gid})`} />
        {/* halo de luz superior izquierda */}
        <Ellipse cx={60} cy={0} rx={180} ry={80} fill="#FFFFFF" opacity={0.10} />
        {/* esferas 3D decorativas */}
        <Sphere cx={38} cy={H - 26} r={22} colors={cfg.sphere} id={`${sid}-a`} />
        <Sphere cx={W - 30} cy={H - 14} r={30} colors={cfg.sphere} id={`${sid}-b`} />
        <Sphere cx={W - 132} cy={H + 6} r={18} colors={cfg.sphere} id={`${sid}-c`} />
        <Motif plan={plan} />
      </Svg>

      {/* Textos */}
      <View style={s.textWrap} pointerEvents="none">
        <Text style={s.name} numberOfLines={1}>
          {name}
        </Text>
        <Text style={s.price}>{priceLabel}</Text>
      </View>

      {/* Chip del logo ComeYa (borde pequeño, como en las gift cards) */}
      <View style={s.logoChip} pointerEvents="none">
        <Text style={s.logoText}>ComeYa</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    aspectRatio: 340 / 150,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#1E3A8A",
    justifyContent: "center",
  },
});

const s = StyleSheet.create({
  textWrap: { position: "absolute", left: 16, top: 14 },
  name: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "800",
    textShadowColor: "rgba(0,0,0,0.35)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  price: {
    color: "rgba(255,255,255,0.95)",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 3,
    textShadowColor: "rgba(0,0,0,0.3)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  logoChip: {
    position: "absolute",
    right: 10,
    top: 10,
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    ...Platform.select({ web: { boxShadow: "0 2px 6px rgba(0,0,0,0.25)" } }),
  },
  logoText: { fontSize: 11, fontWeight: "800", color: "#DC2626" },
});

export default PlanCardArt;
