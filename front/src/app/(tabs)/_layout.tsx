/**
 * Pestañas del menú inferior. Cambian según el rol: la agencia y el administrador ven Ideas y Clientes;
 * el cliente ve Proponer ideas. Arriba de cada pantalla va la barra con la app, los avisos y el tema.
 */
import React from 'react';
import { ColorValue, View } from 'react-native';
import { Tabs } from 'expo-router/tabs';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BannerBar, TopBar } from '../../components/TopBar';
import { IconName } from '../../components/ui';
import { ProfileSetupSheet } from '../../screens/ProfileSetupSheet';
import { useApp } from '../../state/AppContext';
import { useTheme } from '../../theme/theme';

/** Barra superior, respetando el espacio de la barra de estado del teléfono. */
function Header() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  return (
    <View style={{ paddingTop: insets.top, backgroundColor: colors.stage }}>
      <TopBar />
      <BannerBar />
    </View>
  );
}

/** Ícono de una pestaña. */
const icon = (name: IconName) =>
  function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Feather name={name} size={size - 2} color={String(color)} />;
  };

/** Navegador de pestañas. */
export default function TabsLayout() {
  const { session, notifications, ideaProposals } = useApp();
  const { colors } = useTheme();
  const isClient = session?.role === 'CLIENTE';
  const unread = notifications.filter((n) => !n.isRead).length;
  const pendingProposals = ideaProposals.filter((p) => p.status === 'PENDING').length;

  return (
    <>
      <Tabs
        screenOptions={{
          header: () => <Header />,
          sceneStyle: { backgroundColor: colors.canvas },
          tabBarActiveTintColor: colors.signalSubtleFg,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarStyle: { backgroundColor: colors.stage, borderTopColor: colors.hairline },
          tabBarLabelStyle: { fontSize: 11.5, fontWeight: '600' },
        }}
      >
        <Tabs.Screen name="index" options={{ title: 'Cronograma', tabBarIcon: icon('calendar') }} />
        <Tabs.Screen
          name="ideas"
          options={{ title: 'Ideas', tabBarIcon: icon('zap'), href: isClient ? null : undefined, tabBarBadge: pendingProposals || undefined }}
        />
        <Tabs.Screen name="accounts" options={{ title: 'Clientes', tabBarIcon: icon('users'), href: isClient ? null : undefined }} />
        <Tabs.Screen name="proposals" options={{ title: 'Ideas', tabBarIcon: icon('zap'), href: isClient ? undefined : null }} />
        <Tabs.Screen name="history" options={{ title: 'Avisos', tabBarIcon: icon('bell'), tabBarBadge: unread || undefined }} />
        <Tabs.Screen name="settings" options={{ title: 'Ajustes', tabBarIcon: icon('sliders') }} />
      </Tabs>
      <ProfileSetupSheet />
    </>
  );
}
