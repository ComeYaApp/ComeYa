import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { apiRequest, getApiUrl } from "@/lib/query-client";

const GREEN = "#16A34A";
const AMBER = "#F59E0B";
const BLUE = "#3B82F6";
const RED = "#EF4444";
const PURPLE = "#8B5CF6";

// ── Documentos personales ───────────────────────────────────────────────────────
interface DocUpload {
  label: string;
  key: string;
  icon: string;
  color: string;
  hint: string;
  required: boolean;
}

const PERSONAL_DOCS: DocUpload[] = [
  {
    label: "DNI/NIE (anverso)",
    key: "idDocumentUrl",
    icon: "credit-card",
    color: BLUE,
    hint: "Foto del anverso de tu DNI o NIE",
    required: true,
  },
  {
    label: "DNI/NIE (reverso)",
    key: "idDocumentBackUrl",
    icon: "credit-card",
    color: AMBER,
    hint: "Foto del reverso de tu DNI o NIE",
    required: true,
  },
  {
    label: "Alta de autónomo",
    key: "autonomoDocumentUrl",
    icon: "file-text",
    color: PURPLE,
    hint: "Certificado de alta en RETA o vida laboral",
    required: true,
  },
];

function resolveImg(img: string): string {
  if (!img) return "";
  if (img.startsWith("data:image/")) return img;
  const base = getApiUrl().replace(/\/+$/, "");
  if (/^https?:\/\//i.test(img)) return img;
  return `${base}${img.startsWith("/") ? "" : "/"}${img}`;
}

// ── Sección reutilizable ──────────────────────────────────────────────────────
function Section({
  title,
  icon,
  color,
  children,
}: {
  title: string;
  icon: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <View style={sec.wrap}>
      <View style={sec.header}>
        <View style={[sec.iconWrap, { backgroundColor: color + "18" }]}>
          <Feather name={icon as any} size={16} color={color} />
        </View>
        <Text style={sec.title}>{title}</Text>
      </View>
      {children}
    </View>
  );
}
const sec = StyleSheet.create({
  wrap: { marginBottom: 24 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  title: { fontSize: 15, fontWeight: "800" },
});

// ── Campo de formulario ───────────────────────────────────────────────────────
function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  hint,
  required,
  disabled,
  card,
  border,
  sub,
  text,
  inputBg,
}: any) {
  return (
    <View style={f.wrap}>
      <Text style={[f.label, { color: sub }]}>
        {label}
        {required && <Text style={{ color: RED }}> *</Text>}
      </Text>
      <TextInput
        style={
          [
            f.input,
            {
              backgroundColor: disabled ? card : inputBg,
              color: text,
              borderColor: border,
              opacity: disabled ? 0.6 : 1,
            },
          ] as any
        }
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={sub}
        editable={!disabled}
        secureTextEntry={type === "password"}
        keyboardType={
          type === "phone"
            ? "phone-pad"
            : type === "email"
              ? "email-address"
              : "default"
        }
        autoCapitalize={
          type === "email" || type === "password" ? "none" : "sentences"
        }
      />
      {hint && <Text style={[f.hint, { color: sub }]}>{hint}</Text>}
    </View>
  );
}
const f = StyleSheet.create({
  wrap: { marginBottom: 14 },
  label: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginBottom: 6,
    textTransform: "uppercase",
  },
  input: {
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 14,
  },
  hint: { fontSize: 11, marginTop: 4, lineHeight: 16 },
});

// ── Componente principal ──────────────────────────────────────────────────────
export function DriverProfileTab() {
  const { isDark } = useTheme();
  const { user, updateUser } = useAuth();
  const { showToast } = useToast();

  const bg = isDark ? "#0d0d0d" : "#f2f3f5";
  const card = isDark ? "#1a1a1a" : "#fff";
  const border = isDark ? "#2a2a2a" : "#ebebeb";
  const text = isDark ? "#fff" : "#111";
  const sub = isDark ? "#666" : "#aaa";
  const inputBg = isDark ? "#222" : "#f8f8f8";

  // ── Estado ──
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingPwd, setSavingPwd] = useState(false);
  const [uploadingImg, setUploadImg] = useState(false);
  const [profileImg, setProfileImg] = useState<string | null>(null);
  const [verStatus, setVerStatus] = useState("pending");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Datos personales
  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [email, setEmail] = useState((user as any)?.email ?? "");
  const [dni, setDni] = useState("");
  const [address, setAddress] = useState("");

  // Documentos personales (base64 o URL)
  const [personalDocs, setPersonalDocs] = useState<
    Record<string, string | null>
  >({
    idDocumentUrl: null,
    idDocumentBackUrl: null,
    autonomoDocumentUrl: null,
  });
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  const docFileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Contraseña
  const [curPwd, setCurPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confPwd, setConfPwd] = useState("");

  const fileRef = useRef<HTMLInputElement | null>(null);

  const flash = (ok: boolean, t: string) => {
    setMsg({ ok, text: t });
    setTimeout(() => setMsg(null), 4000);
  };

  // ── Carga inicial ──
  useEffect(() => {
    if (!user?.id) return;
    Promise.all([
      apiRequest("GET", `/api/users/${user.id}/verification-status`),
      apiRequest("GET", "/api/users/profile/full"),
    ])
      .then(([vr, pr]) => Promise.all([vr.json(), pr.json()]))
      .then(([vd, pd]) => {
        if (vd.success) setVerStatus(vd.verificationStatus ?? "pending");
        if (pd.success) {
          if (pd.dni) setDni(pd.dni);
          if (pd.address) setAddress(pd.address);
          // Cargar documentos personales
          setPersonalDocs({
            idDocumentUrl: pd.idDocumentUrl ?? null,
            idDocumentBackUrl: pd.idDocumentBackUrl ?? null,
            autonomoDocumentUrl: pd.autonomoDocumentUrl ?? null,
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    if (user.profileImage) setProfileImg(resolveImg(user.profileImage));
  }, [user?.id]);

  // ── Foto de perfil ──
  const handlePickPhoto = () => fileRef.current?.click();

  const handleFileChange = async (e: any) => {
    const file = e.target?.files?.[0];
    if (!file) return;
    setUploadImg(true);
    try {
      const reader = new FileReader();
      const b64: string = await new Promise((res, rej) => {
        reader.onloadend = () => res(reader.result as string);
        reader.onerror = rej;
        reader.readAsDataURL(file);
      });
      if (Math.ceil(b64.length * 0.75) > 2 * 1024 * 1024) {
        flash(false, "La imagen supera 2MB. Usa una foto más ligera.");
        return;
      }
      const r = await apiRequest("POST", "/api/users/profile-image", {
        image: b64,
      });
      const d = await r.json();
      if (d.success) {
        setProfileImg(resolveImg(d.profileImage));
        await updateUser({ profileImage: d.profileImage });
        flash(true, "Foto de perfil actualizada");
      } else {
        flash(false, d.error ?? "Error al subir imagen");
      }
    } catch {
      flash(false, "Error al subir imagen");
    } finally {
      setUploadImg(false);
    }
  };

  // ── Manejar carga de documentos personales ──
  const handleDocUpload = async (key: string, file: File) => {
    setUploadingDoc(key);
    try {
      const reader = new FileReader();
      const b64: string = await new Promise((res, rej) => {
        reader.onloadend = () => res(reader.result as string);
        reader.onerror = rej;
        reader.readAsDataURL(file);
      });
      if (Math.ceil(b64.length * 0.75) > 5 * 1024 * 1024) {
        flash(false, "El archivo supera 5MB");
        return;
      }
      setPersonalDocs((prev) => ({ ...prev, [key]: b64 }));
      flash(true, "Documento cargado — pulsa Guardar para confirmar");
    } catch {
      flash(false, "Error al cargar documento");
    } finally {
      setUploadingDoc(null);
    }
  };

  // ── Guardar documentos personales ──
  const handleSaveDocs = async () => {
    const missing = PERSONAL_DOCS.filter(
      (d) => d.required && !personalDocs[d.key],
    );
    if (missing.length > 0) {
      flash(
        false,
        `Faltan documentos obligatorios: ${missing.map((d) => d.label).join(", ")}`,
      );
      return;
    }
    setSaving(true);
    try {
      // Subir cada documento
      const updates: Record<string, string> = {};
      for (const doc of PERSONAL_DOCS) {
        const b64 = personalDocs[doc.key];
        if (b64?.startsWith("data:image/")) {
          const res = await apiRequest(
            "POST",
            "/api/users/verification-document",
            {
              key: doc.key,
              image: b64,
            },
          );
          const data = await res.json();
          if (data.url) updates[doc.key] = data.url;
        } else if (b64) {
          updates[doc.key] = b64;
        }
      }
      // Guardar en perfil
      const res = await apiRequest("PUT", "/api/users/personal-docs", updates);
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      // Reset verification status to trigger re-review
      setVerStatus("pending");
      flash(true, "Documentos guardados. Tu cuenta será revisada nuevamente.");
    } catch (err: any) {
      flash(false, err.message ?? "Error al guardar documentos");
    } finally {
      setSaving(false);
    }
  };

  // ── Guardar datos personales ──
  const handleSaveProfile = async () => {
    if (!name.trim()) {
      flash(false, "El nombre es obligatorio");
      return;
    }
    if (!dni.trim()) {
      flash(false, "El DNI/NIE es obligatorio para operar en España");
      return;
    }
    setSaving(true);
    try {
      const res = await apiRequest("PUT", "/api/users/profile", {
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        dni: dni.trim().toUpperCase(),
        address: address.trim() || undefined,
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      await updateUser({ name: name.trim(), phone: phone.trim() });
      flash(true, "Datos personales guardados correctamente");
    } catch (err: any) {
      flash(false, err.message ?? "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  // ── Cambiar contraseña ──
  const handleChangePwd = async () => {
    if (!curPwd || !newPwd || !confPwd) {
      flash(false, "Rellena todos los campos de contraseña");
      return;
    }
    if (newPwd.length < 8) {
      flash(false, "La nueva contraseña debe tener al menos 8 caracteres");
      return;
    }
    if (newPwd !== confPwd) {
      flash(false, "Las contraseñas no coinciden");
      return;
    }
    setSavingPwd(true);
    try {
      const res = await apiRequest("PUT", "/api/auth/change-password", {
        currentPassword: curPwd,
        newPassword: newPwd,
      });
      const data = await res.json();
      if (!data.success)
        throw new Error(data.error ?? "Contraseña actual incorrecta");
      setCurPwd("");
      setNewPwd("");
      setConfPwd("");
      flash(true, "Contraseña actualizada correctamente");
    } catch (err: any) {
      flash(false, err.message ?? "Error al cambiar contraseña");
    } finally {
      setSavingPwd(false);
    }
  };

  // ── Colores de verificación ──
  const verColor =
    verStatus === "verified" ? GREEN : verStatus === "rejected" ? RED : AMBER;
  const verLabel =
    verStatus === "verified"
      ? "Cuenta verificada"
      : verStatus === "rejected"
        ? "Verificación rechazada"
        : "Pendiente de verificación";
  const verIcon =
    verStatus === "verified"
      ? "check-circle"
      : verStatus === "rejected"
        ? "x-circle"
        : "clock";

  if (loading)
    return (
      <View
        style={[
          s.root,
          {
            backgroundColor: bg,
            justifyContent: "center",
            alignItems: "center",
          },
        ]}
      >
        <ActivityIndicator size="large" color={GREEN} />
      </View>
    );

  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      {/* ── Header ── */}
      <View
        style={[s.header, { backgroundColor: card, borderBottomColor: border }]}
      >
        <Text style={[s.title, { color: text }]}>Mi perfil</Text>
        <Text style={[s.subtitle, { color: sub }]}>
          Datos personales y configuración de cuenta
        </Text>
      </View>

      {/* ── Feedback ── */}
      {msg && (
        <View
          style={[
            s.msgBar,
            { backgroundColor: msg.ok ? "#16A34A15" : "#EF444415" },
          ]}
        >
          <Feather
            name={msg.ok ? "check-circle" : "alert-circle"}
            size={14}
            color={msg.ok ? GREEN : RED}
          />
          <Text style={[s.msgTxt, { color: msg.ok ? GREEN : RED }]}>
            {msg.text}
          </Text>
        </View>
      )}

      {/* ── Hidden file input ── */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[s.content, { backgroundColor: bg }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Avatar + estado ── */}
        <View
          style={[s.avatarCard, { backgroundColor: card, borderColor: border }]}
        >
          <TouchableOpacity
            onPress={handlePickPhoto}
            disabled={uploadingImg}
            style={s.avatarWrap}
          >
            {profileImg ? (
              <img
                src={profileImg}
                style={
                  {
                    width: 88,
                    height: 88,
                    borderRadius: 44,
                    objectFit: "cover",
                  } as any
                }
                alt="perfil"
              />
            ) : (
              <View
                style={[s.avatarPlaceholder, { backgroundColor: GREEN + "20" }]}
              >
                <Feather name="user" size={36} color={GREEN} />
              </View>
            )}
            <View style={[s.cameraBadge, { backgroundColor: GREEN }]}>
              {uploadingImg ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Feather name="camera" size={13} color="#fff" />
              )}
            </View>
          </TouchableOpacity>

          <View style={{ flex: 1 }}>
            <Text style={[s.avatarName, { color: text }]}>
              {user?.name ?? "Repartidor"}
            </Text>
            <Text style={[s.avatarPhone, { color: sub }]}>
              {user?.phone ?? ""}
            </Text>
            <View style={[s.verBadge, { backgroundColor: verColor + "18" }]}>
              <Feather name={verIcon as any} size={12} color={verColor} />
              <Text style={[s.verTxt, { color: verColor }]}>{verLabel}</Text>
            </View>
          </View>

          {/* Normativa española */}
          <View
            style={[
              s.normBox,
              { backgroundColor: BLUE + "10", borderColor: BLUE + "30" },
            ]}
          >
            <Feather name="info" size={14} color={BLUE} />
            <Text style={[s.normTxt, { color: text }]}>
              <Text style={{ fontWeight: "700" }}>
                Normativa España · Soria{"\n"}
              </Text>
              Para operar como repartidor autónomo en Soria debes estar dado de
              alta en el RETA (Régimen Especial de Trabajadores Autónomos),
              tener el DNI/NIE en vigor y el vehículo con ITV y seguro al día.
              ComeYa verifica estos datos antes de activar tu cuenta.
            </Text>
          </View>
        </View>

        {/* ── Datos personales ── */}
        <View style={[s.card, { backgroundColor: card, borderColor: border }]}>
          <Section title="Datos personales" icon="user" color={GREEN}>
            <Field
              label="Nombre completo"
              value={name}
              onChange={setName}
              placeholder="Nombre y apellidos"
              required
              card={card}
              border={border}
              sub={sub}
              text={text}
              inputBg={inputBg}
            />
            <Field
              label="DNI / NIE"
              value={dni}
              onChange={(t: string) => setDni(t.toUpperCase())}
              placeholder="12345678A"
              required
              hint="Obligatorio para operar como autónomo en España"
              card={card}
              border={border}
              sub={sub}
              text={text}
              inputBg={inputBg}
            />
            <Field
              label="Teléfono"
              value={phone}
              onChange={setPhone}
              placeholder="+34 6XX XXX XXX"
              type="phone"
              required
              card={card}
              border={border}
              sub={sub}
              text={text}
              inputBg={inputBg}
            />
            <Field
              label="Email"
              value={email}
              onChange={setEmail}
              placeholder="tu@email.com"
              type="email"
              card={card}
              border={border}
              sub={sub}
              text={text}
              inputBg={inputBg}
            />
            <Field
              label="Dirección en Soria"
              value={address}
              onChange={setAddress}
              placeholder="Calle Mayor 12, 42001 Soria"
              hint="Dirección fiscal para facturación"
              card={card}
              border={border}
              sub={sub}
              text={text}
              inputBg={inputBg}
            />

            <TouchableOpacity
              onPress={handleSaveProfile}
              disabled={saving}
              style={[
                s.saveBtn,
                { backgroundColor: GREEN, opacity: saving ? 0.7 : 1 },
              ]}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Feather name="save" size={15} color="#fff" />
              )}
              <Text style={s.saveBtnTxt}>
                {saving ? "Guardando..." : "Guardar datos personales"}
              </Text>
            </TouchableOpacity>
          </Section>
        </View>

        {/* ── Documentación personal ── */}
        <View style={[s.card, { backgroundColor: card, borderColor: border }]}>
          <Section title="Documentación personal" icon="file-text" color={BLUE}>
            <Text style={[s.docSectionSub, { color: sub }]}>
              Sube fotos claras de tus documentos. Serán revisados por ComeYa
              antes de aprobar tu cuenta como repartidor.
            </Text>

            {PERSONAL_DOCS.map((doc) => {
              const hasDoc = !!personalDocs[doc.key];
              const isUploading = uploadingDoc === doc.key;

              return (
                <View
                  key={doc.key}
                  style={[s.docRow, { borderBottomColor: border }]}
                >
                  {/* Hidden input */}
                  <input
                    ref={(el) => {
                      docFileRefs.current[doc.key] = el;
                    }}
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const file = e.target?.files?.[0];
                      if (file) handleDocUpload(doc.key, file);
                    }}
                  />

                  <View
                    style={[s.docIcon, { backgroundColor: doc.color + "15" }]}
                  >
                    <Feather
                      name={doc.icon as any}
                      size={18}
                      color={doc.color}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <View style={s.docTitleRow}>
                      <Text style={[s.docLabel, { color: text }]}>
                        {doc.label}
                      </Text>
                      {doc.required && (
                        <View
                          style={[s.reqBadge, { backgroundColor: RED + "15" }]}
                        >
                          <Text style={[s.reqTxt, { color: RED }]}>
                            Obligatorio
                          </Text>
                        </View>
                      )}
                      {hasDoc && (
                        <View
                          style={[
                            s.reqBadge,
                            { backgroundColor: GREEN + "15" },
                          ]}
                        >
                          <Feather name="check" size={10} color={GREEN} />
                          <Text style={[s.reqTxt, { color: GREEN }]}>
                            Subido
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={[s.docHint, { color: sub }]}>{doc.hint}</Text>

                    {/* Preview */}
                    {hasDoc &&
                      personalDocs[doc.key]?.startsWith("data:image/") && (
                        <img
                          src={personalDocs[doc.key]!}
                          style={
                            {
                              width: 120,
                              height: 80,
                              objectFit: "cover",
                              borderRadius: 8,
                              marginTop: 8,
                            } as any
                          }
                          alt={doc.label}
                        />
                      )}
                  </View>

                  <TouchableOpacity
                    onPress={() => docFileRefs.current[doc.key]?.click()}
                    disabled={isUploading}
                    style={[
                      s.docBtn,
                      {
                        backgroundColor: hasDoc
                          ? GREEN + "15"
                          : doc.color + "15",
                        borderColor: hasDoc ? GREEN + "40" : doc.color + "40",
                      },
                    ]}
                  >
                    {isUploading ? (
                      <ActivityIndicator size="small" color={doc.color} />
                    ) : (
                      <Feather
                        name={hasDoc ? "refresh-cw" : "upload"}
                        size={14}
                        color={hasDoc ? GREEN : doc.color}
                      />
                    )}
                    <Text
                      style={[
                        s.docBtnTxt,
                        { color: hasDoc ? GREEN : doc.color },
                      ]}
                    >
                      {hasDoc ? "Cambiar" : "Subir"}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}

            <TouchableOpacity
              onPress={handleSaveDocs}
              disabled={saving}
              style={[
                s.saveBtn,
                {
                  backgroundColor: BLUE,
                  opacity: saving ? 0.7 : 1,
                  marginTop: 12,
                },
              ]}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Feather name="save" size={15} color="#fff" />
              )}
              <Text style={s.saveBtnTxt}>
                {saving ? "Guardando..." : "Guardar documentación"}
              </Text>
            </TouchableOpacity>
          </Section>
        </View>

        {/* ── Cambiar contraseña ── */}
        <View style={[s.card, { backgroundColor: card, borderColor: border }]}>
          <Section title="Cambiar contraseña" icon="lock" color={PURPLE}>
            <View
              style={[
                s.pwdInfo,
                { backgroundColor: AMBER + "12", borderColor: AMBER + "30" },
              ]}
            >
              <Feather name="alert-triangle" size={13} color={AMBER} />
              <Text style={[s.pwdInfoTxt, { color: text }]}>
                Usa una contraseña de al menos 8 caracteres con letras y
                números. No la compartas con nadie.
              </Text>
            </View>
            <Field
              label="Contraseña actual"
              value={curPwd}
              onChange={setCurPwd}
              placeholder="••••••••"
              type="password"
              card={card}
              border={border}
              sub={sub}
              text={text}
              inputBg={inputBg}
            />
            <Field
              label="Nueva contraseña"
              value={newPwd}
              onChange={setNewPwd}
              placeholder="Mínimo 8 caracteres"
              type="password"
              card={card}
              border={border}
              sub={sub}
              text={text}
              inputBg={inputBg}
            />
            <Field
              label="Confirmar nueva contraseña"
              value={confPwd}
              onChange={setConfPwd}
              placeholder="Repite la contraseña"
              type="password"
              card={card}
              border={border}
              sub={sub}
              text={text}
              inputBg={inputBg}
            />

            {/* Indicador de fortaleza */}
            {newPwd.length > 0 && (
              <View style={s.strengthRow}>
                {[1, 2, 3, 4].map((i) => {
                  const strength = Math.min(Math.floor(newPwd.length / 3), 4);
                  const color =
                    strength >= 3 ? GREEN : strength >= 2 ? AMBER : RED;
                  return (
                    <View
                      key={i}
                      style={[
                        s.strengthBar,
                        { backgroundColor: i <= strength ? color : border },
                      ]}
                    />
                  );
                })}
                <Text style={[s.strengthTxt, { color: sub }]}>
                  {newPwd.length < 6
                    ? "Débil"
                    : newPwd.length < 9
                      ? "Media"
                      : newPwd.length < 12
                        ? "Fuerte"
                        : "Muy fuerte"}
                </Text>
              </View>
            )}

            <TouchableOpacity
              onPress={handleChangePwd}
              disabled={savingPwd}
              style={[
                s.saveBtn,
                { backgroundColor: PURPLE, opacity: savingPwd ? 0.7 : 1 },
              ]}
            >
              {savingPwd ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Feather name="lock" size={15} color="#fff" />
              )}
              <Text style={s.saveBtnTxt}>
                {savingPwd ? "Cambiando..." : "Cambiar contraseña"}
              </Text>
            </TouchableOpacity>
          </Section>
        </View>

        {/* ── Normativa autónomo Soria ── */}
        <View style={[s.card, { backgroundColor: card, borderColor: border }]}>
          <Section
            title="Normativa repartidor autónomo · Soria"
            icon="file-text"
            color={BLUE}
          >
            {[
              {
                icon: "user-check",
                color: GREEN,
                title: "Alta en RETA",
                body: "Debes estar dado de alta como autónomo en la Seguridad Social (RETA) para poder operar legalmente como repartidor en España.",
              },
              {
                icon: "credit-card",
                color: BLUE,
                title: "DNI/NIE en vigor",
                body: "Tu documento de identidad debe estar vigente. ComeYa lo verifica antes de activar tu cuenta.",
              },
              {
                icon: "truck",
                color: AMBER,
                title: "Vehículo homologado",
                body: "El vehículo debe tener ITV en vigor, seguro de responsabilidad civil y, si es moto, el permiso de conducir correspondiente (A1, A2 o A).",
              },
              {
                icon: "shield",
                color: PURPLE,
                title: "Seguro de accidentes",
                body: "Se recomienda contratar un seguro de accidentes personal. ComeYa no cubre accidentes laborales al ser autónomo.",
              },
              {
                icon: "file-text",
                color: RED,
                title: "Facturación",
                body: "Como autónomo debes emitir factura a ComeYa por tus servicios. Puedes usar el modelo simplificado si facturas menos de 3.000€/año a un mismo cliente.",
              },
              {
                icon: "map-pin",
                color: GREEN,
                title: "Zona de operación",
                body: "ComeYa opera en Soria capital y municipios del área metropolitana. Las entregas fuera de zona deben ser acordadas previamente.",
              },
            ].map((item, i) => (
              <View
                key={i}
                style={[
                  s.normItem,
                  {
                    borderBottomColor: border,
                    borderBottomWidth: i < 5 ? 1 : 0,
                  },
                ]}
              >
                <View
                  style={[s.normIcon, { backgroundColor: item.color + "15" }]}
                >
                  <Feather
                    name={item.icon as any}
                    size={16}
                    color={item.color}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.normTitle, { color: text }]}>
                    {item.title}
                  </Text>
                  <Text style={[s.normBody, { color: sub }]}>{item.body}</Text>
                </View>
              </View>
            ))}

            <View
              style={[
                s.legalNote,
                { backgroundColor: BLUE + "10", borderColor: BLUE + "30" },
              ]}
            >
              <Feather name="external-link" size={13} color={BLUE} />
              <Text style={[s.legalNoteTxt, { color: sub }]}>
                Para más información consulta la web de la{" "}
                <Text style={{ color: BLUE, fontWeight: "700" }}>
                  Seguridad Social
                </Text>{" "}
                o el{" "}
                <Text style={{ color: BLUE, fontWeight: "700" }}>
                  Ayuntamiento de Soria
                </Text>
                . ComeYa no es responsable de las obligaciones fiscales del
                autónomo.
              </Text>
            </View>
          </Section>
        </View>

        {/* ── Zona de peligro ── */}
        <View
          style={[
            s.card,
            { backgroundColor: card, borderColor: RED + "30", borderWidth: 1 },
          ]}
        >
          <Section title="Zona de peligro" icon="alert-triangle" color={RED}>
            <Text style={[s.dangerTxt, { color: sub }]}>
              Si deseas eliminar tu cuenta o tienes problemas con tu
              verificación, contacta con soporte. La eliminación de cuenta es
              irreversible y borrará todos tus datos y historial de entregas.
            </Text>
            <TouchableOpacity
              style={[s.dangerBtn, { borderColor: RED + "40" }]}
              onPress={() =>
                flash(
                  false,
                  "Contacta con soporte en support@comeya.es para eliminar tu cuenta.",
                )
              }
            >
              <Feather name="trash-2" size={14} color={RED} />
              <Text style={[s.dangerBtnTxt, { color: RED }]}>
                Solicitar eliminación de cuenta
              </Text>
            </TouchableOpacity>
          </Section>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1 },
  title: { fontSize: 20, fontWeight: "800" },
  subtitle: { fontSize: 12, marginTop: 2 },
  msgBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  msgTxt: { fontSize: 13, fontWeight: "600" },
  content: { padding: 20, gap: 0, paddingBottom: 40 },
  avatarCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 20,
    marginBottom: 16,
    gap: 14,
  },
  avatarWrap: { position: "relative" as any },
  avatarPlaceholder: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  cameraBadge: {
    position: "absolute" as any,
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  avatarName: { fontSize: 17, fontWeight: "800" },
  avatarPhone: { fontSize: 13, marginTop: 2, marginBottom: 8 },
  verBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: "flex-start",
  },
  verTxt: { fontSize: 11, fontWeight: "700" },
  normBox: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  normTxt: { fontSize: 12, lineHeight: 18, flex: 1 },
  card: { borderRadius: 14, borderWidth: 1, padding: 20, marginBottom: 16 },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderRadius: 10,
    marginTop: 6,
  },
  saveBtnTxt: { fontSize: 14, fontWeight: "700", color: "#fff" },
  pwdInfo: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
    marginBottom: 12,
  },
  pwdInfoTxt: { fontSize: 12, lineHeight: 17, flex: 1 },
  strengthRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 12,
  },
  strengthBar: { flex: 1, height: 4, borderRadius: 2 },
  strengthTxt: { fontSize: 11, marginLeft: 4 },
  normItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 12,
  },
  normIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  normTitle: { fontSize: 13, fontWeight: "700", marginBottom: 3 },
  normBody: { fontSize: 12, lineHeight: 17 },
  legalNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
    marginTop: 8,
  },
  legalNoteTxt: { fontSize: 11, lineHeight: 16, flex: 1 },
  dangerTxt: { fontSize: 13, lineHeight: 18, marginBottom: 14 },
  dangerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  dangerBtnTxt: { fontSize: 13, fontWeight: "700" },
  docSectionSub: { fontSize: 12, marginBottom: 14, lineHeight: 17 },
  docRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
  },
  docIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  docTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
    marginBottom: 3,
  },
  docLabel: { fontSize: 13, fontWeight: "700" },
  reqBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  reqTxt: { fontSize: 9, fontWeight: "700" },
  docHint: { fontSize: 11, lineHeight: 15 },
  docBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    flexShrink: 0,
  },
  docBtnTxt: { fontSize: 12, fontWeight: "700" },
});
