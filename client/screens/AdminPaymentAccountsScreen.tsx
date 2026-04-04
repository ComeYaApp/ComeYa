// Admin Payment Receiving Accounts Configuration Screen
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../hooks/useTheme';
import { apiRequest } from '../lib/query-client';

export default function AdminPaymentAccountsScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [accounts, setAccounts] = useState<any>({});

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      const response = await apiRequest('GET', '/api/payment-accounts/admin/receiving-accounts');
      const data = await response.json();
      if (data.success) {
        const accountsMap: any = {};
        data.accounts.forEach((acc: any) => {
          accountsMap[acc.provider] = acc.accountData;
        });
        setAccounts(accountsMap);
      }
    } catch (error) {
      console.error('Error loading accounts:', error);
      Alert.alert('Error', 'No se pudieron cargar las cuentas');
    } finally {
      setLoading(false);
    }
  };

  const updateAccount = (provider: string, field: string, value: string) => {
    setAccounts({
      ...accounts,
      [provider]: {
        ...accounts[provider],
        [field]: value,
      },
    });
  };

  const saveAccount = async (provider: string) => {
    setSaving(true);
    try {
      const response = await apiRequest('PUT', `/api/payment-accounts/admin/receiving-accounts/${provider}`, {
        accountData: accounts[provider],
        isActive: true,
      });
      const data = await response.json();
      if (data.success) {
        Alert.alert('Éxito', 'Cuenta actualizada correctamente');
      } else {
        Alert.alert('Error', data.error || 'No se pudo actualizar');
      }
    } catch (error) {
      console.error('Error saving account:', error);
      Alert.alert('Error', 'No se pudo guardar la cuenta');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { backgroundColor: theme.card }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          Cuentas Receptoras
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Binance Pay */}
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="logo-bitcoin" size={24} color="#F3BA2F" />
            <Text style={[styles.cardTitle, { color: theme.text }]}>Binance Pay</Text>
          </View>
          
          <Text style={[styles.label, { color: theme.textSecondary }]}>Binance ID</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
            value={accounts.binance_pay?.binanceId || ''}
            onChangeText={(val) => updateAccount('binance_pay', 'binanceId', val)}
            placeholder="123456789"
            placeholderTextColor={theme.textSecondary}
          />

          <Text style={[styles.label, { color: theme.textSecondary }]}>Email</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
            value={accounts.binance_pay?.email || ''}
            onChangeText={(val) => updateAccount('binance_pay', 'email', val)}
            placeholder="payments@ComeYa.ve"
            placeholderTextColor={theme.textSecondary}
            keyboardType="email-address"
          />

          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: '#F3BA2F' }]}
            onPress={() => saveAccount('binance_pay')}
            disabled={saving}
          >
            <Text style={styles.saveButtonText}>Guardar Binance Pay</Text>
          </TouchableOpacity>
        </View>

        {/* Zinli */}
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="card" size={24} color="#00D4FF" />
            <Text style={[styles.cardTitle, { color: theme.text }]}>Zinli</Text>
          </View>
          
          <Text style={[styles.label, { color: theme.textSecondary }]}>Email</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
            value={accounts.zinli?.email || ''}
            onChangeText={(val) => updateAccount('zinli', 'email', val)}
            placeholder="payments@ComeYa.ve"
            placeholderTextColor={theme.textSecondary}
            keyboardType="email-address"
          />

          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: '#00D4FF' }]}
            onPress={() => saveAccount('zinli')}
            disabled={saving}
          >
            <Text style={styles.saveButtonText}>Guardar Zinli</Text>
          </TouchableOpacity>
        </View>

        {/* Zelle */}
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="cash" size={24} color="#6D1ED4" />
            <Text style={[styles.cardTitle, { color: theme.text }]}>Zelle</Text>
          </View>
          
          <Text style={[styles.label, { color: theme.textSecondary }]}>Email</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
            value={accounts.zelle?.email || ''}
            onChangeText={(val) => updateAccount('zelle', 'email', val)}
            placeholder="payments@ComeYa.ve"
            placeholderTextColor={theme.textSecondary}
            keyboardType="email-address"
          />

          <Text style={[styles.label, { color: theme.textSecondary }]}>Teléfono</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
            value={accounts.zelle?.phone || ''}
            onChangeText={(val) => updateAccount('zelle', 'phone', val)}
            placeholder="+1 (555) 123-4567"
            placeholderTextColor={theme.textSecondary}
            keyboardType="phone-pad"
          />

          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: '#6D1ED4' }]}
            onPress={() => saveAccount('zelle')}
            disabled={saving}
          >
            <Text style={styles.saveButtonText}>Guardar Zelle</Text>
          </TouchableOpacity>
        </View>

        {/* PayPal */}
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="logo-paypal" size={24} color="#003087" />
            <Text style={[styles.cardTitle, { color: theme.text }]}>PayPal</Text>
          </View>
          
          <Text style={[styles.label, { color: theme.textSecondary }]}>Email</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
            value={accounts.paypal?.email || ''}
            onChangeText={(val) => updateAccount('paypal', 'email', val)}
            placeholder="payments@ComeYa.ve"
            placeholderTextColor={theme.textSecondary}
            keyboardType="email-address"
          />

          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: '#003087' }]}
            onPress={() => saveAccount('paypal')}
            disabled={saving}
          >
            <Text style={styles.saveButtonText}>Guardar PayPal</Text>
          </TouchableOpacity>
        </View>

        {/* Pago Móvil */}
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="phone-portrait" size={24} color="#0066CC" />
            <Text style={[styles.cardTitle, { color: theme.text }]}>Pago Móvil</Text>
          </View>
          
          <Text style={[styles.label, { color: theme.textSecondary }]}>Teléfono</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
            value={accounts.pago_movil?.phone || ''}
            onChangeText={(val) => updateAccount('pago_movil', 'phone', val)}
            placeholder="04121234567"
            placeholderTextColor={theme.textSecondary}
            keyboardType="phone-pad"
          />

          <Text style={[styles.label, { color: theme.textSecondary }]}>Banco (código)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
            value={accounts.pago_movil?.bank || ''}
            onChangeText={(val) => updateAccount('pago_movil', 'bank', val)}
            placeholder="0102"
            placeholderTextColor={theme.textSecondary}
            keyboardType="numeric"
          />

          <Text style={[styles.label, { color: theme.textSecondary }]}>Nombre del Banco</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
            value={accounts.pago_movil?.bankName || ''}
            onChangeText={(val) => updateAccount('pago_movil', 'bankName', val)}
            placeholder="Banco de España"
            placeholderTextColor={theme.textSecondary}
          />

          <Text style={[styles.label, { color: theme.textSecondary }]}>Cédula</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
            value={accounts.pago_movil?.cedula || ''}
            onChangeText={(val) => updateAccount('pago_movil', 'cedula', val)}
            placeholder="V12345678"
            placeholderTextColor={theme.textSecondary}
          />

          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: '#0066CC' }]}
            onPress={() => saveAccount('pago_movil')}
            disabled={saving}
          >
            <Text style={styles.saveButtonText}>Guardar Pago Móvil</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  card: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  label: {
    fontSize: 14,
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
  },
  saveButton: {
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
