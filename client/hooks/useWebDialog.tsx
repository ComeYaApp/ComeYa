import React, { useState, useCallback } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";

interface DialogOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "info";
}

interface DialogState extends DialogOptions {
  resolve: (value: boolean) => void;
}

let _setDialog: ((d: DialogState | null) => void) | null = null;

export function confirm(opts: DialogOptions): Promise<boolean> {
  return new Promise(resolve => {
    _setDialog?.({ ...opts, resolve });
  });
}

export function WebDialogProvider({ children }: { children: React.ReactNode }) {
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const { isDark } = useTheme();

  _setDialog = setDialog;

  const handle = (value: boolean) => {
    dialog?.resolve(value);
    setDialog(null);
  };

  const card   = isDark ? "#1e1e1e" : "#fff";
  const text   = isDark ? "#fff"    : "#1a1a1a";
  const sub    = isDark ? "#aaa"    : "#666";
  const border = isDark ? "#333"    : "#e8e8e8";

  const variantColor = dialog?.variant === "danger" ? "#EF4444"
    : dialog?.variant === "warning" ? "#F59E0B"
    : "#3B82F6";

  const variantIcon: any = dialog?.variant === "danger" ? "trash-2"
    : dialog?.variant === "warning" ? "alert-triangle"
    : "info";

  return (
    <>
      {children}
      {dialog && (
        <View style={s.overlay}>
          <View style={[s.modal, { backgroundColor: card, borderColor: border }]}>
            <View style={[s.iconWrap, { backgroundColor: variantColor + "15" }]}>
              <Feather name={variantIcon} size={24} color={variantColor} />
            </View>
            <Text style={[s.title, { color: text }]}>{dialog.title}</Text>
            {dialog.message && <Text style={[s.message, { color: sub }]}>{dialog.message}</Text>}
            <View style={s.btns}>
              <Pressable onPress={() => handle(false)} style={[s.btn, { borderColor: border, borderWidth: 1 }]}>
                <Text style={[s.btnText, { color: text }]}>{dialog.cancelLabel || "Cancelar"}</Text>
              </Pressable>
              <Pressable onPress={() => handle(true)} style={[s.btn, { backgroundColor: variantColor }]}>
                <Text style={[s.btnText, { color: "#fff" }]}>{dialog.confirmLabel || "Confirmar"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </>
  );
}

const s = StyleSheet.create({
  overlay: {
    position: "absolute" as any,
    inset: 0,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 99999,
  },
  modal: {
    width: 400,
    borderRadius: 20,
    borderWidth: 1,
    padding: 32,
    alignItems: "center",
    gap: 12,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  title: { fontSize: 18, fontWeight: "700", textAlign: "center" },
  message: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  btns: { flexDirection: "row", gap: 10, marginTop: 8, width: "100%" as any },
  btn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: "center" },
  btnText: { fontSize: 14, fontWeight: "700" },
});
