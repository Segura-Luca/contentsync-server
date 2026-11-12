/** Barra superior: nombre de la app, rol, avisos sin leer, tema, confirmación "Sí, soy yo" y mensajes. */
import React from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { apiFetch, friendlyError } from '../api/client';
import { useApp } from '../state/AppContext';
import { monoFont, useTheme } from '../theme/theme';
import { Badge, Button, Detail, T } from './ui';

/** El cliente responde "Sí, soy yo" o "No soy yo" a la vinculación con una agencia. */
export function useRespondIdentity() {
  const { setBanner, hydrate, logout } = useApp();
  return async (clientId: string, decision: 'ACCEPT' | 'REJECT') => {
    const r = await apiFetch(`/clients/${clientId}/confirm-identity`, { method: 'POST', body: { decision } });
    if (!r.ok) {
      setBanner(friendlyError(r.data, r.status), true);
      return;
    }
    if (decision === 'REJECT') {
      await logout('Rechazaste la vinculación. Tu correo electrónico fue liberado por seguridad.');
      return;
    }
    await hydrate();
    setBanner(r.data?.message || '¡Identidad confirmada! Ya podés ver el cronograma de tu marca.');
  };
}

/**
 * Aviso de éxito o error: un pop up en el medio de la pantalla, por encima de cualquier ventana.
 * Se cierra solo o al tocarlo.
 */
export function BannerBar() {
  const { banner, clearBanner } = useApp();
  const { colors } = useTheme();
  if (!banner) return null;
  const fg = banner.isErr ? colors.fault : colors.live;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={clearBanner} statusBarTranslucent>
      <Pressable
        onPress={clearBanner}
        accessibilityRole="button"
        accessibilityLabel="Cerrar mensaje"
        style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.32)', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      >
        <View
          accessibilityLiveRegion="assertive"
          style={{
            width: '100%',
            maxWidth: 360,
            alignItems: 'center',
            gap: 12,
            padding: 22,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.borderStrong,
            backgroundColor: colors.stage,
          }}
        >
          <View style={{ width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: banner.isErr ? colors.faultBg : colors.liveBg }}>
            <Feather name={banner.isErr ? 'alert-circle' : 'check'} size={28} color={fg} />
          </View>
          <Text style={{ color: colors.textPrimary, fontSize: 15.5, lineHeight: 22, textAlign: 'center' }}>{banner.msg}</Text>
        </View>
      </Pressable>
    </Modal>
  );
}

/** Barra superior de la app. */
export function TopBar() {
  const { appName, session, notifications, pendingConfirmation, goToTab } = useApp();
  const { colors, name, setTheme } = useTheme();
  const respond = useRespondIdentity();
  const unread = notifications.filter((n) => !n.isRead).length;
  const pc = pendingConfirmation;

  return (
    <View style={{ backgroundColor: colors.stage, borderBottomWidth: 1, borderBottomColor: colors.hairline }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ color: colors.textPrimary, fontWeight: '800', fontSize: 17 }}>{appName}</Text>
            {session ? <Badge label={session.role.replace('_', ' ')} tone="review" /> : null}
          </View>
          <Text numberOfLines={1} style={{ color: colors.textMuted, fontSize: 12.5, fontFamily: monoFont }}>
            {session ? session.fullName : 'Agencias y clientes, en un solo lugar'}
          </Text>
        </View>
        {session ? (
          <Pressable
            onPress={() => goToTab('history')}
            accessibilityRole="button"
            accessibilityLabel={`${unread} avisos sin leer`}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: 10,
              height: 38,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: unread ? colors.warn : colors.hairline,
              backgroundColor: unread ? colors.warnBg : 'transparent',
            }}
          >
            <Feather name="bell" size={16} color={unread ? colors.warn : colors.textSecondary} />
            <Text style={{ color: unread ? colors.warn : colors.textSecondary, fontWeight: '700', fontFamily: monoFont }}>{unread}</Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={() => setTheme(name === 'dark' ? 'light' : 'dark')}
          accessibilityRole="button"
          accessibilityLabel="Cambiar apariencia"
          style={{ width: 38, height: 38, borderRadius: 8, borderWidth: 1, borderColor: colors.hairline, alignItems: 'center', justifyContent: 'center' }}
        >
          <Feather name={name === 'dark' ? 'moon' : 'sun'} size={17} color={colors.textPrimary} />
        </Pressable>
      </View>

      {pc ? (
        <View style={{ margin: 12, marginTop: 0, padding: 14, gap: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.warn, backgroundColor: colors.warnBg }}>
          <T variant="eyebrow" style={{ color: colors.warn }}>VERIFICACIÓN DE SEGURIDAD REQUERIDA</T>
          <T style={{ fontWeight: '600' }}>
            La agencia «{pc.agency?.name || 'Agencia'}» quiere vincular tu correo ({pc.user?.email || session?.email}) como cliente de la marca «{pc.companyName}».
          </T>
          <Detail text="Confirmá si reconocés esta vinculación. Si no sos vos, rechazala para liberar tu correo." />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button title="Sí, soy yo" icon="check" variant="signal" small style={{ flex: 1 }} onPress={() => respond(pc.id, 'ACCEPT')} />
            <Button title="No soy yo" icon="x" variant="fault" small style={{ flex: 1 }} onPress={() => respond(pc.id, 'REJECT')} />
          </View>
        </View>
      ) : null}
    </View>
  );
}
