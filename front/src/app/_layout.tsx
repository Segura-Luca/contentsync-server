/**
 * Raíz de la app (Expo Router). Arma los proveedores de tema y estado, y decide qué mostrar:
 * la carga inicial, la pantalla de acceso o las pestañas de la app.
 */
import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { T } from '../components/ui';
import { AuthScreen } from '../screens/AuthScreen';
import { AppProvider, useApp } from '../state/AppContext';
import { ThemeProvider, useTheme } from '../theme/theme';

/** Muestra el acceso si no hay sesión y las pestañas si la hay. */
function Gate() {
  const { booting, session } = useApp();
  const { colors, name } = useTheme();

  let content: React.ReactNode;
  if (booting) {
    content = (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, backgroundColor: colors.canvas }}>
        <ActivityIndicator size="large" color={colors.signal} />
        <T variant="muted">Conectando con el servidor…</T>
      </View>
    );
  } else if (!session) {
    content = (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.stage }} edges={['top', 'bottom']}>
        <AuthScreen />
      </SafeAreaView>
    );
  } else {
    content = <Slot />;
  }

  return (
    <>
      <StatusBar style={name === 'dark' ? 'light' : 'dark'} />
      {content}
    </>
  );
}

/** Componente raíz. */
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppProvider>
          <Gate />
        </AppProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
