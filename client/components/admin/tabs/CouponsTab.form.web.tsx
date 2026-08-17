import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { apiRequest } from "@/lib/query-client";
import { Coupon } from "./CouponsTab.web";

const PRIMARY = "#DC2626";
const PINK = "#EC4899";

const EMPTY = {
  code: "",
  discountType: "percentage" as "percentage" | "fixed",
  discountValue: "",
  minOrderAmount: "",
  maxUses: "",
  maxUsesPerUser: "1",
  expiresAt: "",
  isActive: true,
};

interface Props {
  coupon: Coupon | null; // null = crear nuevo
  isDark: boolean;
  onClose: () => void;
  onSaved: (c: Coupon, isNew: boolean) => void;
}

export function CouponForm({ coupon, isDark, onClose, onSaved }: Props) {
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const card = isDark ? "#1a1a1a" : "#fff";
  const border = isDark ? "#2a2a2a" : "#ebebeb";
  const text = isDark ? "#fff" : "#111";
  const sub = isDark ? "#666" : "#aaa";
  const inputBg = isDark ? "#222" : "#f8f8f8";

  useEffect(() => {
    if (coupon) {
      setForm({
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue:
          coupon.discountType === "percentage"
            ? String(coupon.discountValue)
            : (coupon.discountValue / 100).toFixed(2),
        minOrderAmount: coupon.minOrderAmount
          ? (coupon.minOrderAmount / 100).toFixed(2)
          : "",
        maxUses: coupon.maxUses ? String(coupon.maxUses) : "",
        maxUsesPerUser: coupon.maxUsesPerUser
          ? String(coupon.maxUsesPerUser)
          : "1",
        expiresAt: coupon.expiresAt ? coupon.expiresAt.split("T")[0] : "",
        isActive: coupon.isActive,
      });
    } else {
      setForm({ ...EMPTY });
    }
    setErr(null);
  }, [coupon]);

  const save = async () => {
    if (!form.code.trim()) {
      setErr("El código es requerido");
      return;
    }
    if (!form.discountValue.trim()) {
      setErr("El descuento es requerido");
      return;
    }

    const discVal =
      form.discountType === "percentage"
        ? parseInt(form.discountValue)
        : Math.round(parseFloat(form.discountValue) * 100);

    if (isNaN(discVal) || discVal <= 0) {
      setErr("Descuento inválido");
      return;
    }
    if (form.discountType === "percentage" && discVal > 100) {
      setErr("El porcentaje no puede superar 100%");
      return;
    }

    setSaving(true);
    setErr(null);
    try {
      const body = {
        code: form.code.toUpperCase().trim(),
        discountType: form.discountType,
        discountValue: discVal,
        minOrderAmount: form.minOrderAmount
          ? Math.round(parseFloat(form.minOrderAmount) * 100)
          : null,
        maxUses: form.maxUses ? parseInt(form.maxUses) : null,
        maxUsesPerUser: form.maxUsesPerUser ? parseInt(form.maxUsesPerUser) : 1,
        expiresAt: form.expiresAt
          ? new Date(form.expiresAt).toISOString()
          : null,
        isActive: form.isActive,
      };

      const res = coupon
        ? await apiRequest("PUT", `/api/coupons/admin/${coupon.id}`, body)
        : await apiRequest("POST", "/api/coupons/admin/create", body);
      const data = await res.json();

      if (data.success || res.ok) {
        onSaved(
          data.coupon ?? { ...coupon, ...body, id: coupon?.id ?? data.id },
          !coupon,
        );
      } else {
        setErr(data.error ?? "Error al guardar");
      }
    } catch {
      setErr("Error de conexión");
    } finally {
      setSaving(false);
    }
  };

  const isNew = !coupon;

  return (
    <View
      style={[fp.panel, { backgroundColor: card, borderLeftColor: border }]}
    >
      {/* Header */}
      <View style={[fp.header, { borderBottomColor: border }]}>
        <View style={[fp.iconWrap, { backgroundColor: PINK + "15" }]}>
          <Feather
            name={isNew ? "plus-circle" : "edit-2"}
            size={15}
            color={PINK}
          />
        </View>
        <Text style={[fp.title, { color: text }]}>
          {isNew ? "Nuevo cupón" : "Editar cupón"}
        </Text>
        <TouchableOpacity onPress={onClose}>
          <Feather name="x" size={18} color={sub} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 18, gap: 14 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Código */}
        <View>
          <Text style={[fp.label, { color: sub }]}>CÓDIGO *</Text>
          <TextInput
            style={[
              fp.input,
              { backgroundColor: inputBg, borderColor: border, color: text },
            ]}
            value={form.code}
            onChangeText={(v) =>
              setForm((p) => ({ ...p, code: v.toUpperCase() }))
            }
            placeholder="BIENVENIDA20"
            placeholderTextColor={sub}
            autoCapitalize="characters"
          />
          <Text style={[fp.hint, { color: sub }]}>
            Se convertirá a mayúsculas automáticamente
          </Text>
        </View>

        {/* Tipo de descuento */}
        <View>
          <Text style={[fp.label, { color: sub }]}>TIPO DE DESCUENTO *</Text>
          <View style={fp.typeRow}>
            {(
              [
                { id: "percentage", label: "Porcentaje (%)", icon: "percent" },
                { id: "fixed", label: "Monto fijo (€)", icon: "dollar-sign" },
              ] as const
            ).map((t) => (
              <TouchableOpacity
                key={t.id}
                onPress={() => setForm((p) => ({ ...p, discountType: t.id }))}
                style={[
                  fp.typeBtn,
                  {
                    backgroundColor:
                      form.discountType === t.id ? PINK + "15" : inputBg,
                    borderColor: form.discountType === t.id ? PINK : border,
                    flex: 1,
                  },
                ]}
              >
                <Feather
                  name={t.icon as any}
                  size={14}
                  color={form.discountType === t.id ? PINK : sub}
                />
                <Text
                  style={[
                    fp.typeTxt,
                    { color: form.discountType === t.id ? PINK : text },
                  ]}
                >
                  {t.label}
                </Text>
                {form.discountType === t.id && (
                  <Feather name="check" size={12} color={PINK} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Valor del descuento */}
        <View>
          <Text style={[fp.label, { color: sub }]}>
            {form.discountType === "percentage"
              ? "PORCENTAJE DE DESCUENTO *"
              : "MONTO DE DESCUENTO (€) *"}
          </Text>
          <TextInput
            style={[
              fp.input,
              { backgroundColor: inputBg, borderColor: border, color: text },
            ]}
            value={form.discountValue}
            onChangeText={(v) => setForm((p) => ({ ...p, discountValue: v }))}
            placeholder={form.discountType === "percentage" ? "20" : "5.00"}
            placeholderTextColor={sub}
            keyboardType="decimal-pad"
          />
          {form.discountType === "percentage" && (
            <Text style={[fp.hint, { color: sub }]}>Entre 1 y 100</Text>
          )}
        </View>

        {/* Pedido mínimo */}
        <View>
          <Text style={[fp.label, { color: sub }]}>PEDIDO MÍNIMO (€)</Text>
          <TextInput
            style={[
              fp.input,
              { backgroundColor: inputBg, borderColor: border, color: text },
            ]}
            value={form.minOrderAmount}
            onChangeText={(v) => setForm((p) => ({ ...p, minOrderAmount: v }))}
            placeholder="10.00 (vacío = sin mínimo)"
            placeholderTextColor={sub}
            keyboardType="decimal-pad"
          />
        </View>

        {/* Usos máximos */}
        <View style={fp.twoCol}>
          <View style={{ flex: 1 }}>
            <Text style={[fp.label, { color: sub }]}>USOS TOTALES MÁX.</Text>
            <TextInput
              style={[
                fp.input,
                { backgroundColor: inputBg, borderColor: border, color: text },
              ]}
              value={form.maxUses}
              onChangeText={(v) => setForm((p) => ({ ...p, maxUses: v }))}
              placeholder="∞ (vacío = ilimitado)"
              placeholderTextColor={sub}
              keyboardType="number-pad"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[fp.label, { color: sub }]}>USOS POR USUARIO</Text>
            <TextInput
              style={[
                fp.input,
                { backgroundColor: inputBg, borderColor: border, color: text },
              ]}
              value={form.maxUsesPerUser}
              onChangeText={(v) =>
                setForm((p) => ({ ...p, maxUsesPerUser: v }))
              }
              placeholder="1"
              placeholderTextColor={sub}
              keyboardType="number-pad"
            />
          </View>
        </View>

        {/* Fecha expiración */}
        <View>
          <Text style={[fp.label, { color: sub }]}>FECHA DE EXPIRACIÓN</Text>
          <TextInput
            style={[
              fp.input,
              { backgroundColor: inputBg, borderColor: border, color: text },
            ]}
            value={form.expiresAt}
            onChangeText={(v) => setForm((p) => ({ ...p, expiresAt: v }))}
            placeholder="YYYY-MM-DD (vacío = sin expiración)"
            placeholderTextColor={sub}
          />
        </View>

        {/* Preview */}
        {form.code.trim() && form.discountValue.trim() && (
          <View
            style={[
              fp.preview,
              { backgroundColor: PINK + "10", borderColor: PINK + "30" },
            ]}
          >
            <View style={[fp.previewCode, { backgroundColor: PINK + "20" }]}>
              <Text style={[fp.previewCodeTxt, { color: PINK }]}>
                {form.code.toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[fp.previewDiscount, { color: text }]}>
                {form.discountType === "percentage"
                  ? `${form.discountValue}% de descuento`
                  : `${parseFloat(form.discountValue || "0").toFixed(2)} € de descuento`}
              </Text>
              {form.minOrderAmount && (
                <Text style={[fp.previewSub, { color: sub }]}>
                  Mín. {form.minOrderAmount} €
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Activo */}
        <TouchableOpacity
          onPress={() => setForm((p) => ({ ...p, isActive: !p.isActive }))}
          style={[
            fp.toggleRow,
            {
              backgroundColor: form.isActive ? "#10B98115" : "#EF444415",
              borderColor: form.isActive ? "#10B981" : "#EF4444",
            },
          ]}
        >
          <View
            style={[
              fp.toggleDot,
              { backgroundColor: form.isActive ? "#10B981" : "#EF4444" },
            ]}
          />
          <Text
            style={[
              fp.toggleTxt,
              { color: form.isActive ? "#10B981" : "#EF4444" },
            ]}
          >
            {form.isActive ? "Cupón activo" : "Cupón inactivo"}
          </Text>
        </TouchableOpacity>

        {/* Error */}
        {err && (
          <View style={[fp.errBox, { backgroundColor: "#EF444415" }]}>
            <Feather name="alert-circle" size={13} color="#EF4444" />
            <Text style={[fp.errTxt, { color: "#EF4444" }]}>{err}</Text>
          </View>
        )}

        {/* Guardar */}
        <TouchableOpacity
          onPress={save}
          disabled={saving}
          style={[fp.saveBtn, { backgroundColor: saving ? sub : PINK }]}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Feather name="check" size={15} color="#fff" />
              <Text style={fp.saveTxt}>
                {isNew ? "Crear cupón" : "Guardar cambios"}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const fp = StyleSheet.create({
  panel: { width: 340, borderLeftWidth: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 16,
    borderBottomWidth: 1,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  title: { flex: 1, fontSize: 15, fontWeight: "700" },
  label: { fontSize: 9, fontWeight: "800", letterSpacing: 1, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  hint: { fontSize: 10, marginTop: 4 },
  typeRow: { flexDirection: "row", gap: 8 },
  typeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  typeTxt: { fontSize: 12, fontWeight: "600" },
  twoCol: { flexDirection: "row", gap: 10 },
  preview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  previewCode: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  previewCodeTxt: { fontSize: 14, fontWeight: "800", letterSpacing: 0.5 },
  previewDiscount: { fontSize: 13, fontWeight: "700" },
  previewSub: { fontSize: 11, marginTop: 2 },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  toggleDot: { width: 8, height: 8, borderRadius: 4 },
  toggleTxt: { fontSize: 13, fontWeight: "700" },
  errBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 8,
  },
  errTxt: { fontSize: 12, fontWeight: "600" },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 14,
    borderRadius: 12,
  },
  saveTxt: { color: "#fff", fontSize: 14, fontWeight: "700" },
});
