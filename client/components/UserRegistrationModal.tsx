import React, { useState } from "react";
import {
  View,
  Modal,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
} from "react-native";
import { ThemedText } from "./ThemedText";

interface UserRegistrationModalProps {
  visible: boolean;
  onSave: (userData: UserData) => void;
  onClose: () => void;
}

interface UserData {
  name: string;
  phone: string;
  email: string;
  address: string;
}

export function UserRegistrationModal({
  visible,
  onSave,
  onClose,
}: UserRegistrationModalProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");

  const handleSave = async () => {
    if (!name || !phone) {
      Alert.alert("Error", "Nombre y teléfono son obligatorios");
      return;
    }

    const userData: UserData = { name, phone, email, address };

    try {
      // Guardar en backend
      const response = await fetch("http://localhost:5000/api/users/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userData),
      });

      if (response.ok) {
        onSave(userData);
        // Limpiar campos
        setName("");
        setPhone("");
        setEmail("");
        setAddress("");
      } else {
        Alert.alert("Error", "No se pudo guardar");
      }
    } catch (error) {
      Alert.alert("Error", "Error de conexión");
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <ThemedText type="h3" style={styles.title}>
            Registro de Usuario
          </ThemedText>

          <TextInput
            style={styles.input}
            placeholder="Nombre *"
            value={name}
            onChangeText={setName}
          />

          <TextInput
            style={styles.input}
            placeholder="Teléfono *"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />

          <TextInput
            style={styles.input}
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
          />

          <TextInput
            style={styles.input}
            placeholder="Dirección"
            value={address}
            onChangeText={setAddress}
          />

          <View style={styles.buttons}>
            <Pressable style={styles.cancelButton} onPress={onClose}>
              <ThemedText>Cancelar</ThemedText>
            </Pressable>

            <Pressable style={styles.saveButton} onPress={handleSave}>
              <ThemedText style={styles.saveText}>Guardar</ThemedText>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modal: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 10,
    width: "90%",
    maxWidth: 400,
  },
  title: {
    textAlign: "center",
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    padding: 12,
    borderRadius: 8,
    marginBottom: 15,
    fontSize: 16,
  },
  buttons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  cancelButton: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#f0f0f0",
    flex: 1,
    marginRight: 10,
    alignItems: "center",
  },
  saveButton: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#FF8C00",
    flex: 1,
    alignItems: "center",
  },
  saveText: {
    color: "white",
    fontWeight: "bold",
  },
});
