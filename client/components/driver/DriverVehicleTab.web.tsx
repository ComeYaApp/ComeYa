import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { useToast } from "@/contexts/ToastContext";
import { apiRequest } from "@/lib/query-client";

const GREEN  = "#16A34A";
const AMBER  = "#F59E0B";
const BLUE   = "#3B82F6";
const RED    = "#EF4444";
const PURPLE = "#8B5CF6";

const VEHICLE_TYPES = [
  { id: "bicycle",    label: "Bicicleta",  emoji: "🚲", license: "No requiere",  itv: "No requiere" },
  { id: "motorcycle", label: "Moto",       emoji: "🛵", license: "A1 / A2 / A", itv: "Obligatoria" },
  { id: "car",        label: "Coche",      emoji: "🚗", license: "B",            itv: "Obligatoria" },
  { id: "scooter",    label: "Patinete",   emoji: "🛴", license: "No requiere",  itv: "No requiere" },
];

interface DocUpload {
  label: string;
  key: string;
  icon: string;
  color: string;
  hint: string;
  required: boolean;
}

const DOCS: DocUpload[] = [
  { label: "Foto de matrícula",         key: "platePhoto",    icon: "camera",     color: BLUE,   hint: "Foto clara de la matrícula del vehículo",                    required: true  },
  { label: "ITV en vigor",              key: "itvPhoto",      icon: "check-square", color: GREEN, hint: "Foto del documento ITV vigente (motos y coches)",           required: false },
  { label: "Seguro de responsabilidad", key: "insurancePhoto",icon: "shield",     color: PURPLE, hint: "Foto de la póliza o recibo del seguro en vigor",             required: false },
  { label: "Permiso de conducir",       key: "licensePhoto",  icon: "credit-card",color: AMBER,  hint: "Foto del carnet de conducir (anverso y reverso en 1 imagen)", required: false },
];

export function DriverVehicleTab() {
  const { isDark } = useTheme();
  const { showToast } = useToast();

  const bg      = isDark ? "#0d0d0d" : "#f2f3f5";
  const card    = isDark ? "#1a1a1a" : "#fff";
  const border  = isDark ? "#2a2a2a" : "#ebebeb";
  const text    = isDark ? "#fff"    : "#111";
  const sub     = isDark ? "#666"    : "#aaa";
  const inputBg = isDark ? "#222"    : "#f8f8f8";
  const chipBg  = isDark ? "#222"    : "#f0f0f0";

  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [msg, setMsg]           = useState<{ ok: boolean; text: string } | null>(null);

  // Datos vehículo
  const [vehicleType,  setVehicleType]  = useState("");
  const [plate,        setPlate]        = useState("");
  const [brand,        setBrand]        = useState("");
  const [model,        setModel]        = useState("");
  const [color,        setColor]        = useState("");
  const [year,         setYear]         = useState("");

  // Fotos de documentos (base64 o URL)
  const [docs, setDocs] = useState<Record<string, string | null>>({
    platePhoto: null, itvPhoto: null, insurancePhoto: null, licensePhoto: null,
  });
  const [uploading, setUploading] = useState<string | null>(null);

  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const flash = (ok: boolean, t: string) => {
    setMsg({ ok, text: t });
    setTimeout(() => setMsg(null), 4000);
  };

  useEffect(() => {
    apiRequest("GET", "/api/users/profile/full")
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setVehicleType(d.vehicleType  ?? "");
          setPlate(d.vehiclePlate       ?? "");
          setBrand(d.vehicleBrand       ?? "");
          setModel(d.vehicleModel       ?? "");
          setColor(d.vehicleColor       ?? "");
          setYear(d.vehicleYear         ?? "");
          setDocs({
            platePhoto:    d.vehiclePlatePhoto    ?? null,
            itvPhoto:      d.vehicleItvPhoto      ?? null,
            insurancePhoto:d.vehicleInsurancePhoto?? null,
            licensePhoto:  d.vehicleLicensePhoto  ?? null,
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleDocUpload = async (key: string, file: File) => {
    setUploading(key);
    try {
      const reader = new FileReader();
      const b64: string = await new Promise((res, rej) => {
        reader.onloadend = () => res(reader.result as string);
        reader.onerror = rej;
        reader.readAsDataURL(file);
      });
      if (Math.ceil(b64.length * 0.75) > 5 * 1024 * 1024) {
        flash(false, "El archivo supera 5MB"); return;
      }
      // Guardar localmente para preview — se envía al guardar
      setDocs(prev => ({ ...prev, [key]: b64 }));
      flash(true, "Imagen cargada — pulsa Guardar para confirmar");
    } catch { flash(false, "Error al cargar imagen"); }
    finally { setUploading(null); }
  };

  const handleSave = async () => {
    if (!vehicleType) { flash(false, "Selecciona el tipo de vehículo"); return; }
    if (!plate.trim()) { flash(false, "La matrícula es obligatoria"); return; }
    if (!docs.platePhoto) { flash(false, "La foto de matrícula es obligatoria"); return; }

    setSaving(true);
    try {
      const res  = await apiRequest("PUT", "/api/users/vehicle", {
        vehicleType,
        vehiclePlate:         plate.trim().toUpperCase(),
        vehicleBrand:         brand.trim() || undefined,
        vehicleModel:         model.trim() || undefined,
        vehicleColor:         color.trim() || undefined,
        vehicleYear:          year.trim()  || undefined,
        vehiclePlatePhoto:    docs.platePhoto    ?? undefined,
        vehicleItvPhoto:      docs.itvPhoto      ?? undefined,
        vehicleInsurancePhoto:docs.insurancePhoto?? undefined,
        vehicleLicensePhoto:  docs.licensePhoto  ?? undefined,
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      flash(true, "Datos del vehículo guardados correctamente");
    } catch (err: any) {
      flash(false, err.message ?? "Error al guardar");
    } finally { setSaving(false); }
  };

  const selectedType = VEHICLE_TYPES.find(v => v.id === vehicleType);

  if (loading) return (
    <View style={[s.root, { backgroundColor: bg, justifyContent: "center", alignItems: "center" }]}>
      <ActivityIndicator size="large" color={GREEN} />
    </View>
  );

  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      {/* Header */}
      <View style={[s.header, { backgroundColor: card, borderBottomColor: border }]}>
        <Text style={[s.title, { color: text }]}>Mi vehículo</Text>
        <Text style={[s.subtitle, { color: sub }]}>Datos y documentación del vehículo de reparto</Text>
      </View>

      {/* Feedback */}
      {msg && (
        <View style={[s.msgBar, { backgroundColor: msg.ok ? "#16A34A15" : "#EF444415" }]}>
          <Feather name={msg.ok ? "check-circle" : "alert-circle"} size={14} color={msg.ok ? GREEN : RED} />
          <Text style={[s.msgTxt, { color: msg.ok ? GREEN : RED }]}>{msg.text}</Text>
        </View>
      )}

      <ScrollView style={{ flex: 1 }} contentContainerStyle={[s.content, { backgroundColor: bg }]} showsVerticalScrollIndicator={false}>

        {/* ── Tipo de vehículo ── */}
        <View style={[s.card, { backgroundColor: card, borderColor: border }]}>
          <Text style={[s.sectionTitle, { color: text }]}>Tipo de vehículo</Text>
          <View style={s.typeGrid}>
            {VEHICLE_TYPES.map(v => {
              const active = vehicleType === v.id;
              return (
                <TouchableOpacity
                  key={v.id}
                  onPress={() => setVehicleType(v.id)}
                  style={[s.typeCard, {
                    backgroundColor: active ? GREEN + "15" : chipBg,
                    borderColor: active ? GREEN : border,
                    borderWidth: active ? 2 : 1,
                  }]}
                >
                  <Text style={s.typeEmoji}>{v.emoji}</Text>
                  <Text style={[s.typeLabel, { color: active ? GREEN : text }]}>{v.label}</Text>
                  <Text style={[s.typeSub, { color: sub }]}>Carnet: {v.license}</Text>
                  <Text style={[s.typeSub, { color: sub }]}>ITV: {v.itv}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Info normativa según tipo */}
          {selectedType && (
            <View style={[s.typeInfo, { backgroundColor: BLUE + "10", borderColor: BLUE + "30" }]}>
              <Feather name="info" size={13} color={BLUE} />
              <Text style={[s.typeInfoTxt, { color: text }]}>
                <Text style={{ fontWeight: "700" }}>{selectedType.label}: </Text>
                Permiso de conducir: <Text style={{ fontWeight: "700" }}>{selectedType.license}</Text> · ITV: <Text style={{ fontWeight: "700" }}>{selectedType.itv}</Text>
                {selectedType.id === "motorcycle" && "\n⚠️ En Soria, las motos de más de 50cc requieren permiso A1 mínimo y seguro obligatorio de RC."}
                {selectedType.id === "car" && "\n⚠️ El coche debe tener ITV en vigor, seguro de RC y permiso B. Recuerda el distintivo ambiental."}
              </Text>
            </View>
          )}
        </View>

        {/* ── Datos del vehículo ── */}
        <View style={[s.card, { backgroundColor: card, borderColor: border }]}>
          <Text style={[s.sectionTitle, { color: text }]}>Datos del vehículo</Text>

          {/* Matrícula */}
          <View style={s.field}>
            <Text style={[s.fieldLabel, { color: sub }]}>MATRÍCULA <Text style={{ color: RED }}>*</Text></Text>
            <TextInput
              style={[s.input, { backgroundColor: inputBg, color: text, borderColor: border }] as any}
              value={plate}
              onChangeText={t => setPlate(t.toUpperCase())}
              placeholder="1234 ABC"
              placeholderTextColor={sub}
              autoCapitalize="characters"
            />
            <Text style={[s.fieldHint, { color: sub }]}>Formato español: 4 dígitos + 3 letras (ej: 1234 ABC)</Text>
          </View>

          <View style={s.row}>
            <View style={[s.field, { flex: 1 }]}>
              <Text style={[s.fieldLabel, { color: sub }]}>MARCA</Text>
              <TextInput style={[s.input, { backgroundColor: inputBg, color: text, borderColor: border }] as any}
                value={brand} onChangeText={setBrand} placeholder="Honda, Yamaha..." placeholderTextColor={sub} />
            </View>
            <View style={[s.field, { flex: 1 }]}>
              <Text style={[s.fieldLabel, { color: sub }]}>MODELO</Text>
              <TextInput style={[s.input, { backgroundColor: inputBg, color: text, borderColor: border }] as any}
                value={model} onChangeText={setModel} placeholder="PCX 125..." placeholderTextColor={sub} />
            </View>
          </View>

          <View style={s.row}>
            <View style={[s.field, { flex: 1 }]}>
              <Text style={[s.fieldLabel, { color: sub }]}>COLOR</Text>
              <TextInput style={[s.input, { backgroundColor: inputBg, color: text, borderColor: border }] as any}
                value={color} onChangeText={setColor} placeholder="Rojo, Negro..." placeholderTextColor={sub} />
            </View>
            <View style={[s.field, { flex: 1 }]}>
              <Text style={[s.fieldLabel, { color: sub }]}>AÑO</Text>
              <TextInput style={[s.input, { backgroundColor: inputBg, color: text, borderColor: border }] as any}
                value={year} onChangeText={setYear} placeholder="2020" placeholderTextColor={sub}
                keyboardType="numeric" />
            </View>
          </View>
        </View>

        {/* ── Documentación ── */}
        <View style={[s.card, { backgroundColor: card, borderColor: border }]}>
          <Text style={[s.sectionTitle, { color: text }]}>Documentación</Text>
          <Text style={[s.sectionSub, { color: sub }]}>
            Sube fotos claras de los documentos. Serán revisados por el equipo de ComeYa antes de activar tu cuenta.
          </Text>

          {DOCS.map(doc => {
            const hasDoc = !!docs[doc.key];
            const isUploading = uploading === doc.key;

            return (
              <View key={doc.key} style={[s.docRow, { borderBottomColor: border }]}>
                {/* Hidden input */}
                <input
                  ref={el => { fileRefs.current[doc.key] = el; }}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={e => {
                    const file = e.target?.files?.[0];
                    if (file) handleDocUpload(doc.key, file);
                  }}
                />

                <View style={[s.docIcon, { backgroundColor: doc.color + "15" }]}>
                  <Feather name={doc.icon as any} size={18} color={doc.color} />
                </View>

                <View style={{ flex: 1 }}>
                  <View style={s.docTitleRow}>
                    <Text style={[s.docLabel, { color: text }]}>{doc.label}</Text>
                    {doc.required && (
                      <View style={[s.reqBadge, { backgroundColor: RED + "15" }]}>
                        <Text style={[s.reqTxt, { color: RED }]}>Obligatorio</Text>
                      </View>
                    )}
                    {hasDoc && (
                      <View style={[s.reqBadge, { backgroundColor: GREEN + "15" }]}>
                        <Feather name="check" size={10} color={GREEN} />
                        <Text style={[s.reqTxt, { color: GREEN }]}>Subido</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[s.docHint, { color: sub }]}>{doc.hint}</Text>

                  {/* Preview */}
                  {hasDoc && docs[doc.key]?.startsWith("data:image/") && (
                    <img
                      src={docs[doc.key]!}
                      style={{ width: 120, height: 80, objectFit: "cover", borderRadius: 8, marginTop: 8 } as any}
                      alt={doc.label}
                    />
                  )}
                </View>

                <TouchableOpacity
                  onPress={() => fileRefs.current[doc.key]?.click()}
                  disabled={isUploading}
                  style={[s.docBtn, { backgroundColor: hasDoc ? GREEN + "15" : doc.color + "15", borderColor: hasDoc ? GREEN + "40" : doc.color + "40" }]}
                >
                  {isUploading
                    ? <ActivityIndicator size="small" color={doc.color} />
                    : <Feather name={hasDoc ? "refresh-cw" : "upload"} size={14} color={hasDoc ? GREEN : doc.color} />
                  }
                  <Text style={[s.docBtnTxt, { color: hasDoc ? GREEN : doc.color }]}>
                    {hasDoc ? "Cambiar" : "Subir"}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>

        {/* ── Aviso legal ── */}
        <View style={[s.legalBox, { backgroundColor: AMBER + "10", borderColor: AMBER + "30" }]}>
          <Feather name="alert-triangle" size={15} color={AMBER} />
          <Text style={[s.legalTxt, { color: text }]}>
            <Text style={{ fontWeight: "700" }}>Importante: </Text>
            Toda la documentación debe estar en vigor. ComeYa puede suspender tu cuenta si se detecta documentación caducada o falsa. En caso de accidente, el seguro del vehículo es responsabilidad exclusiva del repartidor.
          </Text>
        </View>

        {/* ── Guardar ── */}
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          style={[s.saveBtn, { backgroundColor: GREEN, opacity: saving ? 0.7 : 1 }]}
        >
          {saving
            ? <ActivityIndicator size="small" color="#fff" />
            : <Feather name="save" size={16} color="#fff" />
          }
          <Text style={s.saveBtnTxt}>{saving ? "Guardando..." : "Guardar datos del vehículo"}</Text>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:         { flex: 1 },
  header:       { paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1 },
  title:        { fontSize: 20, fontWeight: "800" },
  subtitle:     { fontSize: 12, marginTop: 2 },
  msgBar:       { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 20, paddingVertical: 10 },
  msgTxt:       { fontSize: 13, fontWeight: "600" },
  content:      { padding: 20, gap: 0, paddingBottom: 40 },
  card:         { borderRadius: 14, borderWidth: 1, padding: 20, marginBottom: 16 },
  sectionTitle: { fontSize: 15, fontWeight: "800", marginBottom: 6 },
  sectionSub:   { fontSize: 12, marginBottom: 14, lineHeight: 17 },
  typeGrid:     { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 12 },
  typeCard:     { width: "47%", borderRadius: 12, padding: 14, alignItems: "center", gap: 4 },
  typeEmoji:    { fontSize: 28 },
  typeLabel:    { fontSize: 13, fontWeight: "700" },
  typeSub:      { fontSize: 10 },
  typeInfo:     { flexDirection: "row", alignItems: "flex-start", gap: 8, borderRadius: 8, borderWidth: 1, padding: 10 },
  typeInfoTxt:  { fontSize: 12, lineHeight: 17, flex: 1 },
  field:        { marginBottom: 12 },
  fieldLabel:   { fontSize: 10, fontWeight: "700", letterSpacing: 0.5, marginBottom: 5, textTransform: "uppercase" },
  fieldHint:    { fontSize: 11, marginTop: 3 },
  input:        { height: 46, borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, fontSize: 14 },
  row:          { flexDirection: "row", gap: 12 },
  docRow:       { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 14, borderBottomWidth: 1 },
  docIcon:      { width: 38, height: 38, borderRadius: 10, justifyContent: "center", alignItems: "center", flexShrink: 0 },
  docTitleRow:  { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 3 },
  docLabel:     { fontSize: 13, fontWeight: "700" },
  reqBadge:     { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  reqTxt:       { fontSize: 9, fontWeight: "700" },
  docHint:      { fontSize: 11, lineHeight: 15 },
  docBtn:       { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, flexShrink: 0 },
  docBtnTxt:    { fontSize: 12, fontWeight: "700" },
  legalBox:     { flexDirection: "row", alignItems: "flex-start", gap: 10, borderRadius: 10, borderWidth: 1, padding: 14, marginBottom: 16 },
  legalTxt:     { fontSize: 12, lineHeight: 18, flex: 1 },
  saveBtn:      { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 12 },
  saveBtnTxt:   { fontSize: 15, fontWeight: "700", color: "#fff" },
});
