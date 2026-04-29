import React, { useState } from "react";
import { View, StyleSheet, ScrollView, Pressable, Text, TextInput, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { ComeYaColors, Spacing } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { useResponsive } from "@/hooks/useResponsive";
import { MobileSidebarWrapper } from "@/components/MobileSidebarWrapper";

const SPANISH_BANKS = [
  { code: "0049", name: "Santander" }, { code: "0075", name: "Banco Popular" },
  { code: "2100", name: "CaixaBank" }, { code: "0182", name: "BBVA" },
  { code: "0081", name: "Banco Sabadell" }, { code: "0128", name: "Bankinter" },
  { code: "2038", name: "Bankia / CaixaBank" }, { code: "0073", name: "Openbank" },
  { code: "1465", name: "ING Direct" }, { code: "0487", name: "Banco Mare Nostrum" },
  { code: "3058", name: "Cajamar" }, { code: "2085", name: "Ibercaja" },
  { code: "2095", name: "Kutxabank" }, { code: "2048", name: "Liberbank" },
  { code: "0239", name: "Unicaja" }, { code: "0019", name: "Deutsche Bank" },
];

export default function AddBankAccountScreen() {
  const navigation = useNavigation<any>();
  const { theme, isDark } = useTheme();
  const { token } = useAuth();
  const { isMobile } = useResponsive();

  const bg = isDark ? "#111" : "#f7f7f7";
  const card = isDark ? "#1e1e1e" : "#fff";
  const border = isDark ? "#333" : "#e8e8e8";
  const text = isDark ? "#fff" : "#1a1a1a";
  const sub = isDark ? "#aaa" : "#666";
  const inputBg = isDark ? "#2a2a2a" : "#f5f5f5";

  const [loading, setLoading] = useState(false);
  const [showBankPicker, setShowBankPicker] = useState(false);
  const [bankSearch, setBankSearch] = useState("");
  const [form, setForm] = useState({ bankCode: "", bankName: "", accountNumber: "", iban: "", accountHolderName: "", accountType: "checking" });

  const filteredBanks = SPANISH_BANKS.filter(b => {
    const q = bankSearch.toLowerCase();
    return !q || b.name.toLowerCase().includes(q) || b.code.includes(q);
  });

  const handleIBANChange = (t: string) => {
    const clean = t.replace(/\s/g, "").toUpperCase().slice(0, 24);
    setForm(p => ({ ...p, iban: clean }));
    if (clean.length >= 4) {
      const bankCode = clean.slice(4, 8);
      const match = SPANISH_BANKS.find(b => b.code === bankCode);
      if (match) setForm(p => ({ ...p, bankCode: match.code, bankName: match.name }));
    }
  };

  const handleSave = async () => {
    if (!form.bankName) { alert("Selecciona un banco"); return; }
    if (!form.iban || form.iban.length < 20) { alert("Introduce un IBAN válido (mínimo 20 caracteres)"); return; }
    if (!form.accountHolderName.trim()) { alert("Introduce el nombre del titular"); return; }

    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/bank-accounts", form);
      if (res.ok) {
        alert("Cuenta bancaria agregada correctamente");
        navigation.goBack();
      } else {
        const err = await res.json();
        alert(err.message || "Error al guardar la cuenta");
      }
    } catch { alert("Error de conexión"); }
    finally { setLoading(false); }
  };

  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      <MobileSidebarWrapper title="Cuenta Bancaria" sidebarStyle={[s.sidebar, { backgroundColor: card, borderRightColor: border }]}>
        <View style={[s.iconCircle, { backgroundColor: ComeYaColors.primary + "15" }]}>
          <Feather name="credit-card" size={28} color={ComeYaColors.primary} />
        </View>
        <Text style={[s.sideTitle, { color: text }]}>Cuenta Bancaria</Text>
        <Text style={[s.sideSub, { color: sub }]}>Agrega tu IBAN para recibir transferencias SEPA</Text>

        <View style={[s.infoCard, { backgroundColor: "#3B82F6" + "10", borderColor: "#3B82F6" + "30" }]}>
          <Feather name="info" size={18} color="#3B82F6" />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={[s.infoTitle, { color: text }]}>Información importante</Text>
            <Text style={[s.infoText, { color: sub }]}>
              • Tu cuenta será verificada antes de activarse{"\n"}
              • Solo transferencias SEPA (IBAN español){"\n"}
              • Los datos deben coincidir con tu DNI/NIE{"\n"}
              • Verificación en 1-2 días hábiles
            </Text>
          </View>
        </View>

        <Pressable onPress={() => navigation.goBack()} style={[s.backBtn, { backgroundColor: theme.backgroundSecondary }]}>
          <Feather name="arrow-left" size={16} color={text} />
          <Text style={[s.backBtnText, { color: text }]}>Volver</Text>
        </Pressable>
      </MobileSidebarWrapper>

      {/* Main */}
      <ScrollView style={s.main} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={[s.card, { backgroundColor: card, borderColor: border }]}>
          {/* Banco */}
          <Text style={[s.fieldLabel, { color: sub }]}>Banco *</Text>
          <Pressable onPress={() => setShowBankPicker(true)} style={[s.bankPicker, { backgroundColor: inputBg, borderColor: form.bankName ? ComeYaColors.primary : border }]}>
            <Text style={[s.bankPickerText, { color: form.bankName ? text : sub }]}>{form.bankName || "Seleccionar banco"}</Text>
            <Feather name="chevron-down" size={18} color={sub} />
          </Pressable>

          {/* IBAN */}
          <Text style={[s.fieldLabel, { color: sub }]}>IBAN *</Text>
          <TextInput style={[s.input, { backgroundColor: inputBg, color: text, borderColor: form.iban ? ComeYaColors.primary : border }]} value={form.iban} onChangeText={handleIBANChange} placeholder="ES00 0000 0000 0000 0000 0000" placeholderTextColor={sub} autoCapitalize="characters" />
          <Text style={[s.hint, { color: sub }]}>El banco se detecta automáticamente del IBAN</Text>

          {/* Número de cuenta (opcional) */}
          <Text style={[s.fieldLabel, { color: sub }]}>Número de cuenta (opcional)</Text>
          <TextInput style={[s.input, { backgroundColor: inputBg, color: text, borderColor: border }]} value={form.accountNumber} onChangeText={v => setForm(p => ({ ...p, accountNumber: v.replace(/\D/g, "").slice(0, 20) }))} placeholder="Número de cuenta" placeholderTextColor={sub} keyboardType="numeric" />

          {/* Titular */}
          <Text style={[s.fieldLabel, { color: sub }]}>Nombre del titular *</Text>
          <TextInput style={[s.input, { backgroundColor: inputBg, color: text, borderColor: form.accountHolderName ? ComeYaColors.primary : border }]} value={form.accountHolderName} onChangeText={v => setForm(p => ({ ...p, accountHolderName: v }))} placeholder="Nombre y apellidos" placeholderTextColor={sub} autoCapitalize="words" />

          {/* Tipo de cuenta */}
          <Text style={[s.fieldLabel, { color: sub }]}>Tipo de cuenta</Text>
          <View style={s.typeRow}>
            {[{ id: "checking", label: "Cuenta corriente" }, { id: "savings", label: "Cuenta de ahorros" }].map(t => (
              <Pressable key={t.id} onPress={() => setForm(p => ({ ...p, accountType: t.id }))} style={[s.typeChip, { backgroundColor: form.accountType === t.id ? ComeYaColors.primary + "15" : inputBg, borderColor: form.accountType === t.id ? ComeYaColors.primary : border }]}>
                <View style={[s.radio, { borderColor: form.accountType === t.id ? ComeYaColors.primary : sub }]}>
                  {form.accountType === t.id && <View style={[s.radioDot, { backgroundColor: ComeYaColors.primary }]} />}
                </View>
                <Text style={[s.typeChipText, { color: form.accountType === t.id ? ComeYaColors.primary : text }]}>{t.label}</Text>
              </Pressable>
            ))}
          </View>

          <Pressable onPress={handleSave} disabled={loading} style={[s.saveBtn, { backgroundColor: ComeYaColors.primary, opacity: loading ? 0.6 : 1 }]}>
            {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.saveBtnText}>Guardar cuenta</Text>}
          </Pressable>
        </View>
      </ScrollView>

      {/* Bank picker modal */}
      {showBankPicker && (
        <View style={s.pickerOverlay}>
          <View style={[s.pickerCard, { backgroundColor: card, borderColor: border }]}>
            <View style={s.pickerHeader}>
              <Text style={[s.pickerTitle, { color: text }]}>Seleccionar banco</Text>
              <Pressable onPress={() => setShowBankPicker(false)}><Feather name="x" size={22} color={text} /></Pressable>
            </View>
            <TextInput style={[s.searchInput, { backgroundColor: inputBg, color: text, borderColor: border }]} value={bankSearch} onChangeText={setBankSearch} placeholder="Buscar banco..." placeholderTextColor={sub} />
            <ScrollView style={{ maxHeight: 300 }}>
              {filteredBanks.map(b => (
                <Pressable key={b.code} onPress={() => { setForm(p => ({ ...p, bankCode: b.code, bankName: b.name })); setShowBankPicker(false); }} style={[s.bankRow, { borderBottomColor: border }]}>
                  <Text style={[s.bankName, { color: text }]}>{b.name}</Text>
                  <Text style={[s.bankCode, { color: sub }]}>{b.code}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, flexDirection: "row" },
  sidebar: { width: 280, minWidth: 280, maxWidth: 280, padding: 24, borderRightWidth: 1, paddingTop: 40 },
  iconCircle: { width: 72, height: 72, borderRadius: 36, justifyContent: "center", alignItems: "center", alignSelf: "center", marginBottom: 12 },
  sideTitle: { fontSize: 18, fontWeight: "800", textAlign: "center", marginBottom: 6 },
  sideSub: { fontSize: 12, textAlign: "center", marginBottom: 20, lineHeight: 18 },
  infoCard: { flexDirection: "row", alignItems: "flex-start", padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 20 },
  infoTitle: { fontSize: 13, fontWeight: "700", marginBottom: 6 },
  infoText: { fontSize: 12, lineHeight: 18 },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, justifyContent: "center" },
  backBtnText: { fontSize: 14, fontWeight: "600" },
  main: { flex: 1 },
  content: { padding: 32, maxWidth: 600 },
  card: { padding: 28, borderRadius: 16, borderWidth: 1 },
  fieldLabel: { fontSize: 12, fontWeight: "600", marginBottom: 8, textTransform: "uppercase", marginTop: 16 },
  bankPicker: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", height: 48, borderRadius: 10, borderWidth: 1.5, paddingHorizontal: 14 },
  bankPickerText: { fontSize: 15 },
  input: { height: 48, borderRadius: 10, borderWidth: 1.5, paddingHorizontal: 14, fontSize: 15 },
  hint: { fontSize: 11, marginTop: 4, marginBottom: 4 },
  typeRow: { flexDirection: "row", gap: 10, marginBottom: 4 },
  typeChip: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1.5 },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, justifyContent: "center", alignItems: "center" },
  radioDot: { width: 8, height: 8, borderRadius: 4 },
  typeChipText: { fontSize: 13, fontWeight: "600" },
  saveBtn: { paddingVertical: 14, borderRadius: 12, alignItems: "center", marginTop: 24 },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  pickerOverlay: { position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" } as any,
  pickerCard: { width: 440, borderRadius: 20, borderWidth: 1, overflow: "hidden" },
  pickerHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1 },
  pickerTitle: { fontSize: 18, fontWeight: "700" },
  searchInput: { margin: 16, height: 44, borderRadius: 10, borderWidth: 1.5, paddingHorizontal: 14, fontSize: 15 },
  bankRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
  bankName: { fontSize: 15 },
  bankCode: { fontSize: 13 },
});
