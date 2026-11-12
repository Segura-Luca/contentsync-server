/** Avisos: lo que hizo la otra parte. Abrir la pantalla los marca como leídos; "Ver" lleva al bloque o a la propuesta. */
import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { useIsFocused } from 'expo-router';
import { apiFetch } from '../api/client';
import { Notification } from '../api/types';
import { useRespondIdentity } from '../components/TopBar';
import { Button, Card, EmptyState, IconButton, Screen, ScreenHeader, T } from '../components/ui';
import { fmtDateTime } from '../lib/format';
import { useApp } from '../state/AppContext';
import { useTheme } from '../theme/theme';

/** Pantalla de avisos. */
export function NotificationsScreen() {
  const app = useApp();
  const { notifications, schedules, ideaProposals, session, pendingConfirmation } = app;
  const { colors } = useTheme();
  const respond = useRespondIdentity();
  const focused = useIsFocused();
  const marking = useRef(false);

  // Abrir la pantalla cuenta como haberlos visto: se ven resaltados esta vez y el contador baja.
  useEffect(() => {
    if (!focused || marking.current || !notifications.some((n) => !n.isRead)) return;
    marking.current = true;
    apiFetch('/notifications/read-all', { method: 'PATCH' }).finally(() => {
      marking.current = false;
    });
    const timer = setTimeout(() => void app.hydrate({ silent: true }), 4000);
    return () => clearTimeout(timer);
  }, [focused]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Busca a qué apunta el aviso entre lo que este usuario puede ver. */
  const targetOf = (n: Notification) => {
    if (!n.referenceId) return null;
    const proposal = ideaProposals.find((p) => p.id === n.referenceId);
    if (proposal) return session?.role === 'CLIENTE' || proposal.status === 'PENDING' ? { proposal } : null;
    for (const sched of schedules) {
      if (sched.id === n.referenceId) return { sched, block: null };
      const block = (sched.items || []).find((b) => b.id === n.referenceId);
      if (block) return { sched, block };
    }
    return null;
  };

  const open = (n: Notification) => {
    const target = targetOf(n);
    if (!target) return;
    if ('proposal' in target) {
      if (session?.role === 'CLIENTE') app.goToTab('proposals');
      else {
        app.setIdeaSectionFilter('PROPOSALS');
        app.goToTab('ideas');
      }
    } else {
      app.selectClient(target.sched.clientId);
      app.selectSchedule(target.sched.id);
      app.setInspectBlockId(target.block ? target.block.id : null);
      app.goToTab('schedules');
    }
    if (!n.isRead) void apiFetch(`/notifications/${n.id}/read`, { method: 'PATCH' });
  };

  return (
    <Screen onRefresh={() => app.hydrate()} refreshing={app.loadingData}>
      <ScreenHeader title="Avisos" />
      {notifications.length === 0 ? (
        <EmptyState title="No tenés avisos" />
      ) : (
        notifications.map((n) => {
          const isConfirmRequest = n.type === 'CLIENT_CONFIRMATION_REQUEST' && pendingConfirmation;
          const target = targetOf(n);
          return (
            <Card key={n.id} style={n.isRead ? undefined : { borderColor: colors.signalSubtleFg, backgroundColor: colors.signalSubtleBg }}>
              <T style={{ fontWeight: '700' }}>{n.title}</T>
              <T variant="muted">{n.body}</T>
              <T variant="mono">{fmtDateTime(n.createdAt)}</T>
              {isConfirmRequest ? (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Button title="Sí, soy yo" icon="check" variant="signal" small style={{ flex: 1 }} onPress={() => respond(n.referenceId || pendingConfirmation!.id, 'ACCEPT')} />
                  <Button title="No soy yo" icon="x" variant="fault" small style={{ flex: 1 }} onPress={() => respond(n.referenceId || pendingConfirmation!.id, 'REJECT')} />
                </View>
              ) : target ? (
                <IconButton icon="eye" label="Ver" onPress={() => open(n)} />
              ) : null}
            </Card>
          );
        })
      )}
    </Screen>
  );
}
