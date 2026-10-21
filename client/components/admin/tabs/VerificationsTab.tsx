import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Image,
  Modal,
  Alert,
  Switch,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import {
  ComeYaColors,
  Spacing,
  BorderRadius,
  Shadows,
} from "../../../constants/theme";
import {
  apiRequest,
  ApiError,
  getApiErrorMessage,
} from "@/lib/query-client";
import {
  getAllBusinesses,
  getMissingSummary,
  isBusinessUser,
  isDriverUser,
  roleLabel,
  statusMeta,
} from "@/utils/verification";
import { normalizeVerificationStatus } from "@shared/verification";

interface Props {
  theme: any;
  showToast: (msg: string, type?: "success" | "error" | "info") => void;
}

export const VerificationsTab: React.FC<Props> = ({ theme, showToast }) => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<
    "all" | "pending" | "verified" | "rejected"
  >("pending");
  const [selected, setSelected] = useState<any | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [roleFilter, setRoleFilter] = useState<"all" | "business" | "driver">(
    "all",
  );
  const [selectedBusinessId, setSelectedBusinessId] = useState<string | null>(
    null,
  );
  const [override, setOverride] = useState(false);
  const [requestingDocs, setRequestingDocs] = useState(false);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiRequest("GET", "/api/admin/verifications/pending");
      const data = await res.json();
      setUsers(
        (data.users || []).map((u: any) => ({
          ...u,
          verificationStatus: normalizeVerificationStatus(
            u.verificationStatus,
          ),
        })),
      );
    } catch (error) {
      showToast(
        getApiErrorMessage(error, "Error al cargar verificaciones"),
        "error",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (
    action: "approve" | "reject" | "reset",
  ) => {
    if (!selected) return;
    const missing = getMissingSummary(
      selected,
      selectedBusinessId,
    ).missing;

    if (action === "approve" && missing.length > 0 && !override) {
      Alert.alert(
        "Faltan documentos",
        `${missing.join("\n")}\n\nActiva "Aprobar con excepción" y escribe el motivo para continuar.`,
      );
      return;
    }
    if (
      action === "approve" &&
      override &&
      notes.trim().length < 5
    ) {
      showToast(
        "Escribe el motivo de la excepción (mínimo 5 caracteres)",
        "error",
      );
      return;
    }

    setSaving(true);
    try {
      const res = await apiRequest(
        "PUT",
        `/api/admin/verifications/${selected.id}`,
        {
          action,
          notes,
          businessId: selectedBusinessId || undefined,
          overrideMissingDocs: override,
          overrideReason: override ? notes : undefined,
        },
      );
      const data = await res.json();
      if (data.success) {
        showToast(
          action === "approve"
            ? "Usuario aprobado ✓"
            : action === "reject"
              ? "Usuario rechazado"
              : "Verificación reenviada a revisión",
          action === "reject" ? "error" : "success",
        );
        setSelected(null);
        setNotes("");
        setOverride(false);
        setSelectedBusinessId(null);
        load();
      } else {
        showToast(data.error || "Error", "error");
      }
    } catch (error) {
      if (
        error instanceof ApiError &&
        Array.isArray(error.body?.missing) &&
        error.body.missing.length > 0
      ) {
        showToast(`Faltan: ${error.body.missing.join(", ")}`, "error");
      } else {
        showToast(getApiErrorMessage(error, "Error"), "error");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleRequestDocuments = async () => {
    if (!selected) return;
    setRequestingDocs(true);
    try {
      const res = await apiRequest(
        "POST",
        `/api/admin/verifications/${selected.id}/request-documents`,
        {
          message: notes,
          businessId: selectedBusinessId || undefined,
        },
      );
      const data = await res.json();
      if (data.success) {
        showToast(
          data.push?.noTokens
            ? "Solicitud guardada. El usuario no tiene token push; la verá al abrir la app."
            : "Solicitud enviada y push avisado.",
          "success",
        );
      } else {
        showToast(data.error || "Error", "error");
      }
    } catch (error) {
      showToast(getApiErrorMessage(error, "Error"), "error");
    } finally {
      setRequestingDocs(false);
    }
  };

  // Generar y compartir un PDF con toda la documentación del usuario
  const handleDownloadPdf = async (u: any) => {
    setGeneratingPdf(true);
    try {
      const img = (url?: string, alt = "No subido") =>
        url
          ? `<div><img src="${url}" style="width:100%;max-width:340px;margin:8px 0;border-radius:8px;border:1px solid #ddd;" /></div>`
          : `<div style="color:#999;margin:8px 0;">${alt}</div>`;
      const vehicle =
        isDriverUser(u)
          ? `<h2>Vehículo</h2>
             <p><b>Tipo:</b> ${u.deliveryDriver?.vehicleType || "—"}</p>
             <p><b>Matrícula:</b> ${u.deliveryDriver?.vehiclePlate || "—"}</p>
             <p>Foto del vehículo</p>${img(u.deliveryDriver?.vehiclePhoto)}
             <p>Permiso de circulación</p>${img(u.deliveryDriver?.vehicleLicensePhoto)}
             <p>ITV</p>${img(u.deliveryDriver?.vehicleItvPhoto)}
             <p>Seguro</p>${img(u.deliveryDriver?.vehicleInsurancePhoto)}
             <p>Foto matrícula</p>${img(u.deliveryDriver?.vehiclePlatePhoto)}`
          : "";
      const business =
        isBusinessUser(u)
          ? `<h2>Negocio</h2>
             <p><b>Nombre:</b> ${u.business?.name || "—"}</p>
             <p><b>Dirección:</b> ${u.business?.address || "—"}</p>
             <p><b>Teléfono:</b> ${u.business?.phone || "—"}</p>
             <p>Certificado de autónomo/empresa</p>${img(u.autonomoDocumentUrl)}`
          : "";
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Documentación</title></head>
        <body style="font-family:sans-serif;padding:24px;color:#111;">
          <h1>Documentación — ${u.name}</h1>
          <p><b>Rol:</b> ${roleLabel(u)}</p>
          <p><b>Teléfono:</b> ${u.phone || "—"}</p>
          <p><b>Email:</b> ${u.email || "—"}</p>
          <p><b>DNI/NIE:</b> ${u.dni || "—"}</p>
          <p><b>Dirección:</b> ${u.address || "—"}</p>
          ${vehicle}
          ${business}
          <h2>Documentos personales</h2>
          <p>DNI/NIE (anverso)</p>${img(u.idDocumentUrl)}
          <p>DNI/NIE (reverso)</p>${img(u.idDocumentBackUrl)}
          <p>Autónomo/empresa</p>${img(u.autonomoDocumentUrl)}
        </body></html>`;
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: "application/pdf",
          dialogTitle: "Documentación de verificación",
        });
      } else {
        showToast("PDF generado", "success");
      }
    } catch {
      showToast("No se pudo generar el PDF", "error");
    } finally {
      setGeneratingPdf(false);
    }
  };

  const filtered = users.filter((u) => {
    const status = normalizeVerificationStatus(u.verificationStatus);
    const statusOk = filter === "all" || status === filter;
    const roleOk =
      roleFilter === "all" ||
      (roleFilter === "driver" ? isDriverUser(u) : isBusinessUser(u));
    return statusOk && roleOk;
  });

  const counts = {
    all: users.length,
    pending: users.filter(
      (u) => normalizeVerificationStatus(u.verificationStatus) === "pending",
    ).length,
    verified: users.filter(
      (u) => normalizeVerificationStatus(u.verificationStatus) === "verified",
    ).length,
    rejected: users.filter(
      (u) => normalizeVerificationStatus(u.verificationStatus) === "rejected",
    ).length,
  };

  const roleCounts = {
    all: users.length,
    business: users.filter(isBusinessUser).length,
    driver: users.filter(isDriverUser).length,
  };

  const selectedBusinesses = selected ? getAllBusinesses(selected) : [];
  const activeBusiness =
    selectedBusinesses.find(
      (b: any) => String(b.id) === String(selectedBusinessId),
    ) ||
    selected?.business ||
    selectedBusinesses[0] ||
    null;
  const selectedMissing = selected
    ? getMissingSummary(selected, selectedBusinessId).missing
    : [];
  const selectedStatus = statusMeta(selected?.verificationStatus);

  if (loading) {
    return (
      <View style={[s.centered, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={ComeYaColors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Filtros */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.filterRow}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
      >
        {(["pending", "verified", "rejected", "all"] as const).map((f) => (
          <Pressable
            key={f}
            onPress={() => setFilter(f)}
            style={[
              s.filterChip,
              {
                backgroundColor:
                  filter === f
                    ? ComeYaColors.primary
                    : theme.backgroundSecondary,
                borderColor: filter === f ? ComeYaColors.primary : theme.border,
              },
            ]}
          >
            <Text
              style={{
                color: filter === f ? "#FFF" : theme.text,
                fontWeight: "600",
                fontSize: 13,
              }}
            >
              {f === "all"
                ? "Todos"
                : f === "pending"
                  ? "Pendientes"
                  : f === "verified"
                    ? "Aprobados"
                    : "Rechazados"}{" "}
              ({counts[f]})
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Filtro por tipo de perfil */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.filterRow}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
      >
        {(["all", "business", "driver"] as const).map((rf) => (
          <Pressable
            key={rf}
            onPress={() => setRoleFilter(rf)}
            style={[
              s.filterChip,
              {
                backgroundColor:
                  roleFilter === rf
                    ? "#6366F1"
                    : theme.backgroundSecondary,
                borderColor:
                  roleFilter === rf ? "#6366F1" : theme.border,
              },
            ]}
          >
            <Text
              style={{
                color: roleFilter === rf ? "#FFF" : theme.text,
                fontWeight: "600",
                fontSize: 12,
              }}
            >
              {rf === "all"
                ? "Todos los perfiles"
                : rf === "business"
                  ? "Negocios"
                  : "Repartidores"}{" "}
              ({roleCounts[rf]})
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
        showsVerticalScrollIndicator={false}
      >
        {filtered.length === 0 ? (
          <View style={[s.empty, { backgroundColor: theme.card }]}>
            <Feather name="user-check" size={48} color={theme.textSecondary} />
            <Text style={[s.emptyText, { color: theme.textSecondary }]}>
              {filter === "pending"
                ? "No hay solicitudes pendientes"
                : "Sin resultados"}
            </Text>
          </View>
        ) : (
          filtered.map((u) => {
            const cfg = statusMeta(u.verificationStatus);
            const missing = getMissingSummary(u).missing;
            return (
              <Pressable
                key={u.id}
                onPress={() => {
                  setSelected(u);
                  setNotes(u.verificationNotes || "");
                  setSelectedBusinessId(
                    getAllBusinesses(u)[0]?.id ?? null,
                  );
                  setOverride(false);
                }}
                style={[s.card, { backgroundColor: theme.card }, Shadows.sm]}
              >
                {/* Avatar */}
                <View
                  style={[
                    s.avatar,
                    { backgroundColor: ComeYaColors.primary + "20" },
                  ]}
                >
                  {u.profileImage ? (
                    <Image
                      source={{ uri: u.profileImage }}
                      style={s.avatarImg}
                    />
                  ) : (
                    <Feather
                      name="user"
                      size={22}
                      color={ComeYaColors.primary}
                    />
                  )}
                </View>

                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[s.name, { color: theme.text }]}>{u.name}</Text>
                  <Text style={[s.sub, { color: theme.textSecondary }]}>
                    {u.phone}
                  </Text>
                  <View style={{ flexDirection: "row", gap: 6, marginTop: 4 }}>
                    <View
                      style={[s.badge, { backgroundColor: "#6366F1" + "20" }]}
                    >
                      <Text
                        style={{
                          color: "#6366F1",
                          fontSize: 11,
                          fontWeight: "600",
                        }}
                      >
                        {roleLabel(u)}
                      </Text>
                    </View>
                    <View
                      style={[s.badge, { backgroundColor: cfg.color + "20" }]}
                    >
                      <Feather
                        name={cfg.icon as any}
                        size={11}
                        color={cfg.color}
                      />
                      <Text
                        style={{
                          color: cfg.color,
                          fontSize: 11,
                          fontWeight: "600",
                          marginLeft: 3,
                        }}
                      >
                        {cfg.label}
                      </Text>
                    </View>
                  </View>
                  {/* Documentos y completitud */}
                  <View
                    style={{
                      flexDirection: "row",
                      gap: 6,
                      marginTop: 6,
                      flexWrap: "wrap",
                    }}
                  >
                    <View
                      style={[
                        s.badge,
                        {
                          backgroundColor:
                            (missing.length === 0 ? "#10B981" : "#F59E0B") +
                            "20",
                        },
                      ]}
                    >
                      <Feather
                        name={
                          missing.length === 0
                            ? "check-circle"
                            : "alert-circle"
                        }
                        size={11}
                        color={missing.length === 0 ? "#10B981" : "#F59E0B"}
                      />
                      <Text
                        style={{
                          color:
                            missing.length === 0 ? "#10B981" : "#F59E0B",
                          fontSize: 11,
                          fontWeight: "600",
                          marginLeft: 3,
                        }}
                      >
                        {missing.length === 0
                          ? "Docs completos"
                          : `Faltan ${missing.length}`}
                      </Text>
                    </View>
                    <DocBadge
                      label="DNI/NIE"
                      has={!!u.idDocumentUrl}
                      theme={theme}
                    />
                    <DocBadge
                      label="DNI/NIE reverso"
                      has={!!u.idDocumentBackUrl}
                      theme={theme}
                    />
                    {isBusinessUser(u) && (
                      <DocBadge
                        label="Autónomo/empresa"
                        has={!!u.autonomoDocumentUrl}
                        theme={theme}
                      />
                    )}
                    {isDriverUser(u) && (
                      <>
                        <DocBadge
                          label="Permiso circulación"
                          has={!!u.deliveryDriver?.vehicleLicensePhoto}
                          theme={theme}
                        />
                        <DocBadge
                          label="Matrícula"
                          has={!!u.deliveryDriver?.vehiclePlate}
                          theme={theme}
                        />
                        <DocBadge
                          label="Seguro"
                          has={!!u.deliveryDriver?.vehicleInsurancePhoto}
                          theme={theme}
                        />
                        <DocBadge
                          label="Foto vehículo"
                          has={!!u.deliveryDriver?.vehiclePhoto}
                          theme={theme}
                        />
                      </>
                    )}
                  </View>

                  {/* Status de la revisión: qué falta por subir */}
                  {missing.length > 0 ? (
                    <Text
                      numberOfLines={2}
                      style={{
                        color: "#F59E0B",
                        fontSize: 11,
                        marginTop: 6,
                        fontWeight: "600",
                      }}
                    >
                      Falta: {missing.join(", ")}
                    </Text>
                  ) : (
                    <Text
                      style={{
                        color: "#10B981",
                        fontSize: 11,
                        marginTop: 6,
                        fontWeight: "600",
                      }}
                    >
                      Todo completo — listo para revisar ✓
                    </Text>
                  )}
                </View>

                <Feather
                  name="chevron-right"
                  size={20}
                  color={theme.textSecondary}
                />
              </Pressable>
            );
          })
        )}
      </ScrollView>

      {/* Modal detalle */}
      <Modal
        visible={!!selected}
        transparent
        animationType="slide"
        onRequestClose={() => setSelected(null)}
      >
        <View style={s.overlay}>
          {/* Fondo táctil para cerrar (capa separada: no envuelve el scroll) */}
          <Pressable
            style={StyleSheet.absoluteFillObject}
            onPress={() => setSelected(null)}
          />

          {/* Hoja: View normal, sin Pressable que robe el gesto al ScrollView */}
          <View style={[s.sheet, { backgroundColor: theme.card }]}>
            <View style={s.sheetHandle} />

            <ScrollView
              style={{ flex: 1 }}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
            >
              {selected && (
                <>
                  {/* Cabecera */}
                  <View style={s.sheetHeader}>
                    <View
                      style={[
                        s.avatarLg,
                        { backgroundColor: ComeYaColors.primary + "20" },
                      ]}
                    >
                      {selected.profileImage ? (
                        <Image
                          source={{ uri: selected.profileImage }}
                          style={s.avatarLgImg}
                        />
                      ) : (
                        <Feather
                          name="user"
                          size={32}
                          color={ComeYaColors.primary}
                        />
                      )}
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text
                        style={[s.name, { color: theme.text, fontSize: 18 }]}
                      >
                        {selected.name}
                      </Text>
                      <Text style={[s.sub, { color: theme.textSecondary }]}>
                        {selected.phone}
                      </Text>
                      <Text style={[s.sub, { color: theme.textSecondary }]}>
                        {selected.email || "Sin email"}
                      </Text>
                    </View>
                  </View>

                  {/* Datos personales */}
                  <Section title="Datos personales" theme={theme}>
                    <Row
                      label="Rol"
                      value={roleLabel(selected)}
                      theme={theme}
                    />
                    <Row
                      label="DNI/NIE"
                      value={selected.dni || "No proporcionado"}
                      theme={theme}
                    />
                    <Row
                      label="Dirección"
                      value={
                        selected.address ||
                        (isBusinessUser(selected)
                          ? activeBusiness?.address
                          : null) ||
                        "No proporcionada"
                      }
                      theme={theme}
                    />
                    <Row
                      label="Registrado"
                      value={new Date(selected.createdAt).toLocaleDateString(
                        "es-ES",
                      )}
                      theme={theme}
                    />
                  </Section>

                  {/* Foto de perfil (REPARTIDORES) */}
                  {isDriverUser(selected) && (
                    <Section title="Foto de perfil" theme={theme}>
                      {selected.profileImage ? (
                        <Pressable
                          onPress={() => setPreviewImage(selected.profileImage)}
                        >
                          <Image
                            source={{ uri: selected.profileImage }}
                            style={s.docImage}
                            resizeMode="cover"
                          />
                        </Pressable>
                      ) : (
                        <View
                          style={[
                            s.noDoc,
                            { backgroundColor: theme.backgroundRoot },
                          ]}
                        >
                          <Feather
                            name="user"
                            size={32}
                            color={theme.textSecondary}
                          />
                          <Text
                            style={{
                              color: theme.textSecondary,
                              fontSize: 13,
                              marginTop: 8,
                            }}
                          >
                            Sin foto de perfil
                          </Text>
                        </View>
                      )}
                    </Section>
                  )}

                  {/* Información del vehículo (REPARTIDORES) */}
                  {isDriverUser(selected) && (
                    <>
                      <Section title="Información del vehículo" theme={theme}>
                        <Row
                          label="Tipo"
                          value={
                            selected.deliveryDriver?.vehicleType ||
                            "No especificado"
                          }
                          theme={theme}
                        />
                        {selected.deliveryDriver && (
                          <>
                            <Row
                              label="Matrícula"
                              value={
                                selected.deliveryDriver.vehiclePlate ||
                                "No proporcionada"
                              }
                              theme={theme}
                            />
                            <Row
                              label="Marca"
                              value={
                                selected.deliveryDriver.vehicleBrand ||
                                "No proporcionada"
                              }
                              theme={theme}
                            />
                            <Row
                              label="Modelo"
                              value={
                                selected.deliveryDriver.vehicleModel ||
                                "No proporcionado"
                              }
                              theme={theme}
                            />
                            <Row
                              label="Color"
                              value={
                                selected.deliveryDriver.vehicleColor ||
                                "No proporcionado"
                              }
                              theme={theme}
                            />
                            <Row
                              label="Año"
                              value={
                                selected.deliveryDriver.vehicleYear
                                  ? String(
                                      selected.deliveryDriver.vehicleYear,
                                    )
                                  : "No proporcionado"
                              }
                              theme={theme}
                            />
                            <Row
                              label="Categoría de licencia"
                              value={
                                selected.deliveryDriver
                                  .drivingLicenseCategory ||
                                "No proporcionada"
                              }
                              theme={theme}
                            />
                            <Row
                              label="Vence licencia"
                              value={
                                selected.deliveryDriver.drivingLicenseExpiry ||
                                "No proporcionada"
                              }
                              theme={theme}
                            />
                          </>
                        )}
                      </Section>

                      {/* Foto del vehículo */}
                      <Section title="Foto del vehículo" theme={theme}>
                        {selected.deliveryDriver?.vehiclePhoto ? (
                          <Pressable
                            onPress={() =>
                              setPreviewImage(
                                selected.deliveryDriver.vehiclePhoto,
                              )
                            }
                          >
                            <Image
                              source={{
                                uri: selected.deliveryDriver.vehiclePhoto,
                              }}
                              style={s.docImage}
                              resizeMode="cover"
                            />
                          </Pressable>
                        ) : (
                          <View
                            style={[
                              s.noDoc,
                              { backgroundColor: theme.backgroundRoot },
                            ]}
                          >
                            <Feather
                              name="truck"
                              size={32}
                              color={theme.textSecondary}
                            />
                            <Text
                              style={{
                                color: theme.textSecondary,
                                fontSize: 13,
                                marginTop: 8,
                              }}
                            >
                              Sin foto del vehículo
                            </Text>
                          </View>
                        )}
                      </Section>

                      {/* Documentos del vehículo (solo motorcycle/car) */}
                      {selected.deliveryDriver &&
                        ["motorcycle", "car"].includes(
                          selected.deliveryDriver.vehicleType,
                        ) && (
                          <Section title="Documentos del vehículo" theme={theme}>
                            <DocRow
                              label="Permiso de circulación"
                              url={
                                selected.deliveryDriver.vehicleLicensePhoto ||
                                null
                              }
                              theme={theme}
                              onPreview={setPreviewImage}
                            />
                            <DocRow
                              label="ITV"
                              url={
                                selected.deliveryDriver.vehicleItvPhoto || null
                              }
                              theme={theme}
                              onPreview={setPreviewImage}
                            />
                            <DocRow
                              label="Seguro"
                              url={
                                selected.deliveryDriver.vehicleInsurancePhoto ||
                                null
                              }
                              theme={theme}
                              onPreview={setPreviewImage}
                            />
                            <DocRow
                              label="Matrícula"
                              url={
                                selected.deliveryDriver.vehiclePlatePhoto || null
                              }
                              theme={theme}
                              onPreview={setPreviewImage}
                            />
                          </Section>
                        )}
                    </>
                  )}

                  {/* Información del negocio (BUSINESS_OWNER) */}
                  {isBusinessUser(selected) && activeBusiness && (
                    <Section title="Información del negocio" theme={theme}>
                      {selectedBusinesses.length > 1 && (
                        <View style={{ marginBottom: 10 }}>
                          <Text
                            style={{
                              color: theme.textSecondary,
                              fontSize: 12,
                              marginBottom: 6,
                            }}
                          >
                            Negocio a revisar ({selectedBusinesses.length})
                          </Text>
                          <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={{ gap: 8 }}
                          >
                            {selectedBusinesses.map((biz: any) => {
                              const active =
                                String(biz.id) ===
                                String(selectedBusinessId);
                              return (
                                <Pressable
                                  key={biz.id}
                                  onPress={() => {
                                    setSelectedBusinessId(String(biz.id));
                                    setOverride(false);
                                  }}
                                  style={{
                                    paddingHorizontal: 10,
                                    paddingVertical: 6,
                                    borderRadius: 999,
                                    borderWidth: 1,
                                    borderColor: active
                                      ? ComeYaColors.primary
                                      : theme.border,
                                    backgroundColor: active
                                      ? ComeYaColors.primary + "15"
                                      : theme.backgroundSecondary,
                                  }}
                                >
                                  <Text
                                    style={{
                                      color: active
                                        ? ComeYaColors.primary
                                        : theme.text,
                                      fontSize: 12,
                                      fontWeight: "600",
                                    }}
                                  >
                                    {biz.name}
                                  </Text>
                                </Pressable>
                              );
                            })}
                          </ScrollView>
                        </View>
                      )}
                      <Row
                        label="Nombre"
                        value={activeBusiness.name || "No proporcionado"}
                        theme={theme}
                      />
                      <Row
                        label="Tipo"
                        value={activeBusiness.type || "No especificado"}
                        theme={theme}
                      />
                      <Row
                        label="Dirección"
                        value={activeBusiness.address || "No proporcionada"}
                        theme={theme}
                      />
                      <Row
                        label="Teléfono"
                        value={activeBusiness.phone || "No proporcionado"}
                        theme={theme}
                      />
                    </Section>
                  )}

                  {/* Documentos */}
                  <Section title="Documentos personales" theme={theme}>
                    <DocRow
                      label="Foto del DNI/NIE (anverso)"
                      url={selected.idDocumentUrl}
                      theme={theme}
                      onPreview={setPreviewImage}
                    />
                    <DocRow
                      label="Foto del DNI/NIE (reverso)"
                      url={selected.idDocumentBackUrl}
                      theme={theme}
                      onPreview={setPreviewImage}
                    />
                    {isBusinessUser(selected) && (
                      <DocRow
                        label="Certificado de autónomo/empresa"
                        url={selected.autonomoDocumentUrl}
                        theme={theme}
                        onPreview={setPreviewImage}
                      />
                    )}
                  </Section>

                  {isBusinessUser(selected) && activeBusiness && (
                    <Section title="Datos del negocio" theme={theme}>
                      <Row
                        label="Dirección"
                        value={activeBusiness.address || "No proporcionada"}
                        theme={theme}
                      />
                      <Row
                        label="Teléfono"
                        value={activeBusiness.phone || "No proporcionado"}
                        theme={theme}
                      />
                    </Section>
                  )}

                  {/* Documentos que faltan */}
                  <Section title="Documentos pendientes" theme={theme}>
                    {selectedMissing.length === 0 ? (
                      <View style={{ flexDirection: "row", alignItems: "center" }}>
                        <Feather
                          name="check-circle"
                          size={16}
                          color="#10B981"
                        />
                        <Text
                          style={{
                            color: "#10B981",
                            fontWeight: "700",
                            marginLeft: 8,
                            flex: 1,
                          }}
                        >
                          Documentación completa
                        </Text>
                      </View>
                    ) : (
                      <>
                        <Text
                          style={{
                            color: "#F59E0B",
                            fontWeight: "700",
                            marginBottom: 6,
                          }}
                        >
                          Faltan {selectedMissing.length} documento(s):
                        </Text>
                        {selectedMissing.map((doc) => (
                          <View
                            key={doc}
                            style={{
                              flexDirection: "row",
                              alignItems: "flex-start",
                              marginBottom: 4,
                            }}
                          >
                            <Feather
                              name="alert-circle"
                              size={13}
                              color="#F59E0B"
                              style={{ marginTop: 2 }}
                            />
                            <Text
                              style={{
                                color: theme.textSecondary,
                                fontSize: 13,
                                marginLeft: 6,
                                flex: 1,
                              }}
                            >
                              {doc}
                            </Text>
                          </View>
                        ))}
                      </>
                    )}
                  </Section>

                  {selectedMissing.length > 0 &&
                    selectedStatus.label !== "Verificado" && (
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 10,
                          padding: 12,
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: "#F59E0B55",
                          backgroundColor: "#F59E0B12",
                          marginHorizontal: 16,
                          marginBottom: 12,
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text
                            style={{
                              color: theme.text,
                              fontWeight: "700",
                              fontSize: 13,
                            }}
                          >
                            Aprobar con excepción
                          </Text>
                          <Text
                            style={{
                              color: theme.textSecondary,
                              fontSize: 11,
                              marginTop: 2,
                            }}
                          >
                            Requiere una nota con el motivo. Queda registrado en
                            auditoría.
                          </Text>
                        </View>
                        <Switch
                          value={override}
                          onValueChange={setOverride}
                          trackColor={{
                            false: theme.border,
                            true: "#F59E0B",
                          }}
                          thumbColor={override ? "#FFF" : undefined}
                        />
                      </View>
                    )}

                  {/* Estado actual */}
                  <Section title="Estado de verificación" theme={theme}>
                    <View
                      style={[
                        s.statusBox,
                        {
                          backgroundColor: selectedStatus.color + "15",
                          borderColor: selectedStatus.color + "40",
                        },
                      ]}
                    >
                      <Feather
                        name={selectedStatus.icon as any}
                        size={18}
                        color={selectedStatus.color}
                      />
                      <Text
                        style={{
                          color: selectedStatus.color,
                          fontWeight: "700",
                          marginLeft: 8,
                        }}
                      >
                        {selectedStatus.label}
                      </Text>
                    </View>
                    {selected.verificationNotes ? (
                      <Text
                        style={[
                          s.sub,
                          { color: theme.textSecondary, marginTop: 8 },
                        ]}
                      >
                        Nota: {selected.verificationNotes}
                      </Text>
                    ) : null}
                    {selected.documentRequestedAt ? (
                      <Text
                        style={[
                          s.sub,
                          { color: "#F59E0B", marginTop: 8 },
                        ]}
                      >
                        Documentos solicitados el{" "}
                        {new Date(
                          selected.documentRequestedAt,
                        ).toLocaleString("es-ES")}
                        {selected.documentRequestNote
                          ? ` · ${selected.documentRequestNote}`
                          : ""}
                      </Text>
                    ) : null}
                  </Section>

                  {/* Nota del admin */}
                  <Section title="Nota (opcional)" theme={theme}>
                    <TextInput
                      style={[
                        s.notesInput,
                        {
                          backgroundColor: theme.backgroundSecondary,
                          color: theme.text,
                          borderColor: theme.border,
                        },
                      ]}
                      value={notes}
                      onChangeText={setNotes}
                      placeholder="Motivo de rechazo o comentario..."
                      placeholderTextColor={theme.textSecondary}
                      multiline
                      numberOfLines={3}
                    />
                  </Section>
                </>
              )}
            </ScrollView>

            {/* Acciones fijas (siempre visibles, fuera del scroll) */}
            {selected && (
              <View style={s.footer}>
                {/* Descargar toda la documentación en PDF */}
                <Pressable
                  onPress={() => handleDownloadPdf(selected)}
                  disabled={generatingPdf}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    paddingVertical: 10,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: theme.border,
                    marginBottom: 10,
                    opacity: generatingPdf ? 0.6 : 1,
                  }}
                >
                  {generatingPdf ? (
                    <ActivityIndicator size="small" color={theme.text} />
                  ) : (
                    <Feather name="download" size={16} color={theme.text} />
                  )}
                  <Text
                    style={{
                      color: theme.text,
                      fontWeight: "600",
                      marginLeft: 8,
                    }}
                  >
                    Descargar documentación (PDF)
                  </Text>
                </Pressable>
                {selectedMissing.length > 0 ? (
                  <Text
                    style={{
                      color: "#F59E0B",
                      fontSize: 12,
                      fontWeight: "600",
                      marginBottom: 8,
                    }}
                  >
                    ⚠️ Faltan documentos: {selectedMissing.join(", ")}
                  </Text>
                ) : (
                  <Text
                    style={{
                      color: "#10B981",
                      fontSize: 12,
                      fontWeight: "600",
                      marginBottom: 8,
                    }}
                  >
                    ✓ Documentos completos — puede aprobarse
                  </Text>
                )}

                {selectedMissing.length > 0 && (
                  <Pressable
                    onPress={handleRequestDocuments}
                    disabled={requestingDocs || saving}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      paddingVertical: 10,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: "#F59E0B",
                      backgroundColor: "#F59E0B12",
                      marginBottom: 10,
                      opacity: requestingDocs || saving ? 0.6 : 1,
                    }}
                  >
                    {requestingDocs ? (
                      <ActivityIndicator size="small" color="#F59E0B" />
                    ) : (
                      <Feather name="file-plus" size={16} color="#F59E0B" />
                    )}
                    <Text
                      style={{
                        color: "#F59E0B",
                        fontWeight: "700",
                        marginLeft: 8,
                      }}
                    >
                      Solicitar documentos por push
                    </Text>
                  </Pressable>
                )}

                {(selectedStatus.label === "Verificado" ||
                  selectedStatus.label === "Rechazado") && (
                  <Pressable
                    onPress={() => handleAction("reset")}
                    disabled={saving}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      paddingVertical: 9,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: theme.border,
                      marginBottom: 10,
                      opacity: saving ? 0.6 : 1,
                    }}
                  >
                    <Feather name="rotate-ccw" size={15} color={theme.text} />
                    <Text
                      style={{
                        color: theme.text,
                        fontWeight: "600",
                        marginLeft: 8,
                      }}
                    >
                      Volver a revisión
                    </Text>
                  </Pressable>
                )}

                <View style={s.actions}>
                  <Pressable
                    onPress={() => handleAction("reject")}
                    disabled={saving}
                    style={[
                      s.actionBtn,
                      {
                        backgroundColor: "#EF4444",
                        opacity: saving ? 0.6 : 1,
                      },
                    ]}
                  >
                    {saving ? (
                      <ActivityIndicator color="#FFF" size="small" />
                    ) : (
                      <>
                        <Feather name="x-circle" size={18} color="#FFF" />
                        <Text style={s.actionBtnText}>Rechazar</Text>
                      </>
                    )}
                  </Pressable>
                  <Pressable
                    onPress={() => handleAction("approve")}
                    disabled={saving}
                    style={[
                      s.actionBtn,
                      {
                        backgroundColor: override ? "#F59E0B" : "#10B981",
                        opacity: saving ? 0.6 : 1,
                      },
                    ]}
                  >
                    {saving ? (
                      <ActivityIndicator color="#FFF" size="small" />
                    ) : (
                      <>
                        <Feather name="check-circle" size={18} color="#FFF" />
                        <Text style={s.actionBtnText}>
                          {override ? "Aprobar con excepción" : "Aprobar"}
                        </Text>
                      </>
                    )}
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Visor de imagen a pantalla completa */}
      <Modal
        visible={!!previewImage}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewImage(null)}
      >
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.96)" }}>
          <Pressable
            onPress={() => setPreviewImage(null)}
            style={{
              position: "absolute",
              top: 48,
              right: 20,
              zIndex: 10,
              backgroundColor: "rgba(255,255,255,0.15)",
              borderRadius: 20,
              padding: 8,
            }}
          >
            <Feather name="x" size={26} color="#FFF" />
          </Pressable>
          {previewImage && (
            <Image
              source={{ uri: previewImage }}
              style={{ flex: 1 }}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </View>
  );
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function Section({ title, children, theme }: any) {
  return (
    <View style={{ marginBottom: Spacing.md }}>
      <Text
        style={{
          color: theme.textSecondary,
          fontSize: 12,
          fontWeight: "700",
          textTransform: "uppercase",
          marginBottom: 8,
          letterSpacing: 0.5,
        }}
      >
        {title}
      </Text>
      <View
        style={[
          {
            backgroundColor: theme.backgroundSecondary,
            borderRadius: BorderRadius.md,
            padding: Spacing.md,
          },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

function Row({ label, value, theme }: any) {
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        paddingVertical: 5,
      }}
    >
      <Text style={{ color: theme.textSecondary, fontSize: 13 }}>{label}</Text>
      <Text
        style={{
          color: theme.text,
          fontSize: 13,
          fontWeight: "600",
          flex: 1,
          textAlign: "right",
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function DocRow({ label, url, theme, onPreview }: any) {
  const resolved = url
    ? /^https?:\/\//i.test(url)
      ? url
      : null
    : null;
  return (
    <View style={{ paddingVertical: 6 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
          {label}
        </Text>
        {url ? (
          <View
            style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
          >
            <Feather name="check-circle" size={14} color="#10B981" />
            <Text
              style={{ color: "#10B981", fontSize: 12, fontWeight: "600" }}
            >
              Subido
            </Text>
          </View>
        ) : (
          <View
            style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
          >
            <Feather name="alert-circle" size={14} color="#F59E0B" />
            <Text
              style={{ color: "#F59E0B", fontSize: 12, fontWeight: "600" }}
            >
              Pendiente
            </Text>
          </View>
        )}
      </View>
      {/* Vista previa del documento: toca para verla a pantalla completa */}
      {resolved && (
        <Pressable onPress={() => onPreview && onPreview(resolved)}>
          <Image
            source={{ uri: resolved }}
            style={{
              width: "100%",
              height: 140,
              borderRadius: BorderRadius.md,
              marginTop: 6,
              backgroundColor: theme.backgroundRoot,
            }}
            resizeMode="cover"
          />
          <Text
            style={{
              color: ComeYaColors.primary,
              fontSize: 11,
              fontWeight: "600",
              marginTop: 4,
              textAlign: "center",
            }}
          >
            Toca para ver en pantalla completa
          </Text>
        </Pressable>
      )}
    </View>
  );
}

function DocBadge({ label, has, theme }: any) {
  return (
    <View
      style={[
        s.badge,
        { backgroundColor: has ? "#10B981" + "20" : "#F59E0B" + "20" },
      ]}
    >
      <Feather
        name={has ? "file-text" : "alert-circle"}
        size={10}
        color={has ? "#10B981" : "#F59E0B"}
      />
      <Text
        style={{
          color: has ? "#10B981" : "#F59E0B",
          fontSize: 10,
          fontWeight: "600",
          marginLeft: 3,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  filterRow: { maxHeight: 52, marginBottom: 8 },
  filterChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  avatarImg: { width: 48, height: 48, borderRadius: 24 },
  name: { fontSize: 15, fontWeight: "700" },
  sub: { fontSize: 13, marginTop: 1 },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 6,
  },
  empty: { padding: 40, borderRadius: 14, alignItems: "center", gap: 12 },
  emptyText: { fontSize: 15, fontWeight: "600" },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    // Altura fija: el ScrollView interno hace flex:1 y es el que scrollea.
    // Con maxHeight el scroll no se activaba (el contenido medía su tamaño
    // completo y quedaba recortado sin poder desplazarse).
    height: "90%",
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#ccc",
    alignSelf: "center",
    marginBottom: 16,
  },
  sheetHeader: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  avatarLg: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  avatarLgImg: { width: 64, height: 64, borderRadius: 32 },
  statusBox: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  notesInput: {
    borderWidth: 1.5,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: "top",
  },
  actions: { flexDirection: "row", gap: 12, marginTop: 8, marginBottom: 20 },
  footer: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(128,128,128,0.2)",
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
    borderRadius: 12,
    gap: 8,
  },
  actionBtnText: { color: "#FFF", fontWeight: "700", fontSize: 15 },
  docImage: { width: "100%", height: 200, borderRadius: 10 },
  noDoc: {
    width: "100%",
    height: 200,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
});
