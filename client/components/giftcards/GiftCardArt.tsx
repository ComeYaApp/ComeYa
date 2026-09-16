// Tarjetas regalo ComeYa — diseños SVG animados profesionales.
// Cada diseño tiene gradiente propio, motivos decorativos únicos y una capa
// de movimiento (Reanimated): brillo que recorre la tarjeta, confeti que
// late, globos que ascienden… El logo de ComeYa va siempre en un borde
// pequeño (chip blanco) en la esquina inferior izquierda.
// El diseño "gold" es el exclusivo de la zona premium.
import React, { useMemo } from "react";
import { View, Text, Image, StyleSheet, Platform } from "react-native";
import Svg, {
  Defs,
  LinearGradient,
  RadialGradient,
  Stop,
  Rect,
  Circle,
  Path,
  Polygon,
} from "react-native-svg";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { GIFT_CARD_DESIGNS, GiftCardDesignKey } from "./designs";

const W = 340;
const H = 200;

function useLoop(duration: number, reverse = true) {
  const v = useSharedValue(0);
  React.useEffect(() => {
    v.value = withRepeat(
      withTiming(1, { duration, easing: Easing.inOut(Easing.ease) }),
      -1,
      reverse,
    );
  }, [duration, reverse, v]);
  return v;
}

// Confeti: puntos que laten en posiciones fijas
const CONFETTI = [
  { x: 30, y: 34, c: "#FFE066", r: 4, d: 900 },
  { x: 70, y: 150, c: "#FF8FA3", r: 3, d: 1100 },
  { x: 120, y: 44, c: "#74C0FC", r: 3.5, d: 1000 },
  { x: 200, y: 160, c: "#B2F2BB", r: 4, d: 1200 },
  { x: 250, y: 30, c: "#FFC9C9", r: 3, d: 950 },
  { x: 300, y: 120, c: "#D0BFFF", r: 4.5, d: 1050 },
  { x: 160, y: 100, c: "#FFF3BF", r: 2.5, d: 1150 },
];

function Confetti({ tint }: { tint: string[] }) {
  return (
    <>
      {CONFETTI.map((p, i) => (
        <Circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={p.r}
          fill={tint[i % tint.length]}
          opacity={0.55}
        />
      ))}
    </>
  );
}

// Cenefa de almenas (castillo de Soria) para el diseño local
function Crenellation({ y, fill }: { y: number; fill: string }) {
  const teeth = [];
  for (let x = 0; x < W; x += 22) {
    teeth.push(
      <Rect key={x} x={x} y={y} width={12} height={10} fill={fill} opacity={0.18} />,
    );
  }
  return (
    <>
      {teeth}
      <Rect x={0} y={y + 10} width={W} height={2} fill={fill} opacity={0.12} />
    </>
  );
}

export function GiftCardArt({
  design = "fiesta",
  amount,
  selected = false,
  style,
  compact = false,
}: {
  design?: GiftCardDesignKey;
  amount?: string | null;
  selected?: boolean;
  style?: any;
  /** Miniatura: sin capa animada para ahorrar batería en listas */
  compact?: boolean;
}) {
  const cfg = useMemo(
    () => GIFT_CARD_DESIGNS.find((d) => d.key === design) ?? GIFT_CARD_DESIGNS[0],
    [design],
  );

  // Capa de brillo que barre la tarjeta de izquierda a derecha
  const shimmer = useLoop(2600, false);
  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: -140 + shimmer.value * (W + 160) },
      { rotate: "18deg" },
    ],
    opacity: 0.28 + shimmer.value * 0.14,
  }));

  // Latido de los adornos (premium late más despacio y elegante)
  const pulse = useLoop(1600);
  const pulseStyle = useAnimatedStyle(() => ({
    opacity: 0.75 + pulse.value * 0.25,
    transform: [{ scale: 0.97 + pulse.value * 0.06 }],
  }));

  const isWeb = Platform.OS === "web";

  return (
    <View
      style={[
        styles.card,
        style,
        selected && styles.selected,
      ]}
    >
      {/* Arte base SVG */}
      <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={`bg-${cfg.key}`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={cfg.colors[0]} />
            <Stop offset="0.55" stopColor={cfg.colors[1]} />
            <Stop offset="1" stopColor={cfg.colors[2]} />
          </LinearGradient>
          <RadialGradient id={`glow-${cfg.key}`} cx="0.2" cy="0.1" r="0.9">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.35" />
            <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0.05" />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </RadialGradient>
        </Defs>

        <Rect x={0} y={0} width={W} height={H} rx={18} fill={`url(#bg-${cfg.key})`} />
        <Rect x={0} y={0} width={W} height={H} rx={18} fill={`url(#glow-${cfg.key})`} />

        {/* Motivos del diseño */}
        {cfg.key === "fiesta" && (
          <>
            <Confetti tint={["#FFE066", "#FF8FA3", "#74C0FC", "#B2F2BB"]} />
            <Circle cx={W - 40} cy={36} r={26} fill="#FFFFFF" opacity={0.10} />
            <Circle cx={W - 70} cy={150} r={34} fill="#FFFFFF" opacity={0.08} />
            <Polygon points="40,166 46,150 52,166" fill="#FFFFFF" opacity={0.35} />
          </>
        )}

        {cfg.key === "gold" && (
          <>
            {/*Marco dorado premium */}
            <Rect
              x={8}
              y={8}
              width={W - 16}
              height={H - 16}
              rx={14}
              fill="none"
              stroke="#FFE08A"
              strokeWidth={1.5}
              opacity={0.7}
            />
            <Path
              d={`M ${W / 2 - 16} 148 l 6 -14 8 9 10 -13 10 13 8 -9 6 14 z`}
              fill="#FFE08A"
              opacity={0.85}
            />
            <Circle cx={40} cy={40} r={2} fill="#FFE08A" opacity={0.9} />
            <Circle cx={W - 34} cy={160} r={2} fill="#FFE08A" opacity={0.9} />
            <Circle cx={W - 52} cy={28} r={1.5} fill="#FFF7DB" opacity={0.9} />
          </>
        )}

        {cfg.key === "birthday" && (
          <>
            {/*Globos */}
            <Path
              d="M 56 52 c 0 -14 22 -14 22 0 c 0 10 -11 16 -11 24 m -11 -24 c 0 10 11 16 11 24"
              stroke="#FFFFFF"
              strokeWidth={1.4}
              fill="none"
              opacity={0.5}
            />
            <Circle cx={44} cy={46} r={14} fill="#FFFFFF" opacity={0.30} />
            <Circle cx={44} cy={46} r={14} fill="#FFD9A8" opacity={0.25} />
            <Circle cx={84} cy={58} r={10} fill="#FFFFFF" opacity={0.28} />
            <Circle cx={70} cy={164} r={16} fill="#FFFFFF" opacity={0.12} />
            <Circle cx={300} cy={40} r={18} fill="#FFFFFF" opacity={0.14} />
            <Confetti tint={["#FFF3BF", "#FFD8A8", "#A5D8FF", "#FFC9C9"]} />
          </>
        )}

        {cfg.key === "amor" && (
          <>
            <Path
              d="M 300 44 c -6 -12 -24 -6 -20 8 c 3 10 20 18 20 18 c 0 0 17 -8 20 -18 c 4 -14 -14 -20 -20 -8 z"
              fill="#FFFFFF"
              opacity={0.45}
            />
            <Path
              d="M 44 150 c -4 -8 -16 -4 -13 5 c 2 7 13 12 13 12 c 0 0 11 -5 13 -12 c 3 -9 -9 -13 -13 -5 z"
              fill="#FFFFFF"
              opacity={0.35}
            />
            <Circle cx={170} cy={170} r={22} fill="#FFFFFF" opacity={0.10} />
            <Confetti tint={["#FFC9C9", "#FFDEEB", "#FFE3E3"]} />
          </>
        )}

        {cfg.key === "soria" && (
          <>
            <Crenellation y={H - 34} fill="#FFFFFF" />
            {/* Silueta de torre */}
            <Rect x={W - 92} y={H - 78} width={26} height={48} fill="#FFFFFF" opacity={0.14} />
            <Polygon
              points={`${W - 96},${H - 78} ${W - 79},${H - 96} ${W - 62},${H - 78}`}
              fill="#FFFFFF"
              opacity={0.2}
            />
            <Circle cx={60} cy={44} r={20} fill="#FFFFFF" opacity={0.10} />
          </>
        )}

        {cfg.key === "gourmet" && (
          <>
            {/* Tenedor y cuchillo estilizados */}
            <Path
              d="M 292 30 v 26 m -6 -26 v 12 m 12 -12 v 12 m -18 -12 v 14 a 6 6 0 0 0 12 0"
              stroke="#FFFFFF"
              strokeWidth={2}
              fill="none"
              opacity={0.5}
              strokeLinecap="round"
            />
            <Path
              d="M 52 158 q 14 -18 26 -6 q 10 10 -4 22 z"
              fill="#FFFFFF"
              opacity={0.30}
            />
            <Circle cx={140} cy={150} r={3} fill="#FFFFFF" opacity={0.4} />
            <Circle cx={196} cy={42} r={3} fill="#FFFFFF" opacity={0.4} />
            <Circle cx={248} cy={158} r={3} fill="#FFFFFF" opacity={0.4} />
            <Confetti tint={["#FFE8CC", "#FFD8A8", "#FFE066"]} />
          </>
        )}

        {/* Fondo del importe */}
        {amount ? (
          <Rect x={W - 92} y={18} width={72} height={30} rx={15} fill="#FFFFFF" opacity={0.92} />
        ) : null}
      </Svg>

      {/* Importe (texto real encima del SVG para tipografía consistente) */}
      {amount ? (
        <View style={styles.amountChip} pointerEvents="none">
          <Text style={styles.amountText}>{amount}</Text>
        </View>
      ) : null}

      {/* Capa animada: brillo que recorre la tarjeta */}
      {!compact && (
        <View style={styles.shimmerClip} pointerEvents="none">
          <Animated.View style={[styles.shimmerBand, shimmerStyle]}>
            <View style={styles.shimmerGradient} />
          </Animated.View>
        </View>
      )}

      {/* Motivo grande animado (late suavemente) */}
      {!compact && (
        <Animated.View style={[styles.emojiWrap, pulseStyle]} pointerEvents="none">
          <Text style={styles.emoji}>{cfg.emoji}</Text>
        </Animated.View>
      )}

      {/* Chip del logo: borde pequeño con la marca, como pidió el cliente */}
      <View style={styles.logoChip} pointerEvents="none">
        <Image source={require("../../../assets/images/comeya-badge.png")} style={styles.logoImg} />
        <Text style={styles.logoText}>ComeYa</Text>
      </View>

      {/* Etiqueta premium */}
      {cfg.premium ? (
        <View style={styles.premiumTag} pointerEvents="none">
          <Text style={styles.premiumText}>✦ PREMIUM</Text>
        </View>
      ) : null}

      {/* Caption del diseño */}
      {!compact ? (
        <View style={styles.captionWrap} pointerEvents="none">
          <Text style={styles.caption}>{cfg.name.toUpperCase()}</Text>
          <Text style={styles.captionSub}>TARJETA REGALO</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    aspectRatio: 340 / 200,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#DC2626",
    justifyContent: "center",
  },
  selected: {
    borderWidth: 3,
    borderColor: "#FFFFFF",
    ...Platform.select({
      web: { boxShadow: "0 6px 20px rgba(0,0,0,0.25)" },
      default: {},
    }),
  },
  amountChip: {
    position: "absolute",
    top: 18,
    right: 20,
    backgroundColor: "rgba(255,255,255,0.94)",
    borderRadius: 15,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  amountText: { fontSize: 15, fontWeight: "800", color: "#1F2937" },
  shimmerClip: { ...StyleSheet.absoluteFillObject, overflow: "hidden", borderRadius: 18 },
  shimmerBand: {
    position: "absolute",
    top: -40,
    width: 90,
    height: H + 80,
  },
  shimmerGradient: {
    width: "100%",
    height: "100%",
    backgroundColor: "#FFFFFF",
    opacity: 0.35,
  },
  emojiWrap: {
    position: "absolute",
    right: 26,
    bottom: 40,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.22)",
    justifyContent: "center",
    alignItems: "center",
  },
  emoji: { fontSize: 30 },
  logoChip: {
    position: "absolute",
    left: 12,
    bottom: 12,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 6,
  },
  logoImg: { width: 18, height: 18, borderRadius: 4 },
  logoText: { fontSize: 12, fontWeight: "800", color: "#DC2626" },
  premiumTag: {
    position: "absolute",
    top: 10,
    left: 12,
    backgroundColor: "rgba(0,0,0,0.35)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  premiumText: { color: "#FFE08A", fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  captionWrap: {
    position: "absolute",
    left: 14,
    top: 14,
  },
  caption: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.5,
    textShadowColor: "rgba(0,0,0,0.25)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  captionSub: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 2,
    marginTop: 2,
  },
});

export default GiftCardArt;
