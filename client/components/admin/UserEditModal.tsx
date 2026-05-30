import React, { useState } from "react";
import { View, Modal, Pressable, TextInput, Alert } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { AdminUser } from "@/components/admin/types/admin.types";

interface UserEditModalProps {
  visible: boolean;
  user: AdminUser | null;
  onClose: () => void;
  onSave: (user: AdminUser) => void;
  onDelete: (userId: string) => void;
}

export const UserEditModal: React.FC<UserEditModalProps> = ({
  visible,
  user,
  onClose,
  onSave,
  onDelete,
}) => {
  const [editedUser, setEditedUser] = useState<AdminUser | null>(user);

  React.useEffect(() => {
    setEditedUser(user);
  }, [user]);

  if (!editedUser) return null;

  const handleSave = () => {
    onSave(editedUser);
    onClose();
  };

  const handleDelete = () => {
    Alert.alert(
      "Eliminar Usuario",
      `¿Estás seguro de eliminar a ${editedUser.name}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: () => {
            onDelete(editedUser.id);
            onClose();
          },
        },
      ],
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <View style={{ flex: 1, backgroundColor: "white", paddingTop: 50 }}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            padding: 20,
            borderBottomWidth: 1,
            borderBottomColor: "#ccc",
          }}
        >
          <ThemedText type="h2">Editar Usuario</ThemedText>
          <Pressable onPress={onClose}>
            <ThemedText style={{ fontSize: 18 }}>✕</ThemedText>
          </Pressable>
        </View>

        <View style={{ padding: 20 }}>
          <View style={{ marginBottom: 15 }}>
            <ThemedText style={{ marginBottom: 5, fontWeight: "600" }}>
              Nombre:
            </ThemedText>
            <TextInput
              style={{
                borderWidth: 1,
                borderColor: "#ccc",
                padding: 10,
                borderRadius: 5,
              }}
              value={editedUser.name}
              onChangeText={(text) =>
                setEditedUser({ ...editedUser, name: text })
              }
            />
          </View>

          <View style={{ marginBottom: 15 }}>
            <ThemedText style={{ marginBottom: 5, fontWeight: "600" }}>
              Email:
            </ThemedText>
            <TextInput
              style={{
                borderWidth: 1,
                borderColor: "#ccc",
                padding: 10,
                borderRadius: 5,
              }}
              value={editedUser.email || ""}
              onChangeText={(text) =>
                setEditedUser({ ...editedUser, email: text })
              }
            />
          </View>

          <View style={{ marginBottom: 15 }}>
            <ThemedText style={{ marginBottom: 5, fontWeight: "600" }}>
              Teléfono:
            </ThemedText>
            <TextInput
              style={{
                borderWidth: 1,
                borderColor: "#ccc",
                padding: 10,
                borderRadius: 5,
              }}
              value={editedUser.phone}
              onChangeText={(text) =>
                setEditedUser({ ...editedUser, phone: text })
              }
            />
          </View>

          <View style={{ marginBottom: 15 }}>
            <ThemedText style={{ marginBottom: 5, fontWeight: "600" }}>
              Rol:
            </ThemedText>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              {["customer", "business", "delivery_driver", "admin"].map(
                (role) => (
                  <Pressable
                    key={role}
                    style={{
                      padding: 10,
                      borderRadius: 5,
                      backgroundColor:
                        editedUser.role === role ? "#3b82f6" : "#f3f4f6",
                      borderWidth: 1,
                      borderColor:
                        editedUser.role === role ? "#3b82f6" : "#d1d5db",
                    }}
                    onPress={() =>
                      setEditedUser({ ...editedUser, role: role as any })
                    }
                  >
                    <ThemedText
                      style={{
                        color: editedUser.role === role ? "white" : "black",
                      }}
                    >
                      {role}
                    </ThemedText>
                  </Pressable>
                ),
              )}
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: 10, marginTop: 30 }}>
            <Pressable
              style={{
                flex: 1,
                padding: 15,
                backgroundColor: "#10b981",
                borderRadius: 8,
                alignItems: "center",
              }}
              onPress={handleSave}
            >
              <ThemedText style={{ color: "white", fontWeight: "600" }}>
                Guardar
              </ThemedText>
            </Pressable>

            <Pressable
              style={{
                flex: 1,
                padding: 15,
                backgroundColor: "#ef4444",
                borderRadius: 8,
                alignItems: "center",
              }}
              onPress={handleDelete}
            >
              <ThemedText style={{ color: "white", fontWeight: "600" }}>
                Eliminar
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};
