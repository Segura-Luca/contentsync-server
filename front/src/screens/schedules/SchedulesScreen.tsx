/**
 * Cronograma semanal: elegir cliente y semana, ver los bloques de lunes a domingo
 * (cada día se desliza de costado) y confirmar la semana.
 */
import React, { useState } from 'react';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { Block, Schedule } from '../../api/types';
import { useRespondIdentity } from '../../components/TopBar';
import { Badge, Button, Card, Chip, ChipRow, ConfirmDialog, EmptyState, IconButton, Screen, ScreenHeader, T } from '../../components/ui';
import { contentTypeLabel, fmtDateTime, fmtShortDate, plural, productionLabel, WEEKDAYS, workflowMeta } from '../../lib/format';
import { useApiAction, useApp } from '../../state/AppContext';
import { monoFont, noteColors, useTheme } from '../../theme/theme';
import { BlockEditorSheet } from './BlockEditorSheet';
import { BlockInspectorSheet } from './BlockInspectorSheet';
import { NewWeekSheet } from './NewWeekSheet';

/** Tarjeta de un bloque dentro de un día. */
function BlockCard({ block, width, isClient }: { block: Block; width: number; isClient: boolean }) {
  const { setInspectBlockId } = useApp();
  const { colors, name: themeName } = useTheme();
  const action = useApiAction();
  const tint = noteColors(block.noteColor || 'AMBER', colors, themeName);
  const wf = workflowMeta(block.reviewStatus);
  const media = block.media || [];
  const photos = media.filter((m) => m.kind === 'IMAGE').length;
  const videos = media.filter((m) => m.kind === 'VIDEO').length;
  const comments = (block.comments || []).length;
  const summary =
    [photos ? plural(photos, 'foto', 'fotos') : '', videos ? plural(videos, 'video', 'videos') : '', comments ? plural(comments, 'comentario', 'comentarios') : '']
      .filter(Boolean)
      .join(' · ') || 'Sin archivos todavía';

  return (
    <Pressable
      onPress={() => setInspectBlockId(block.id)}
      accessibilityRole="button"
      accessibilityLabel={`${block.blockTitle}, ${wf.label}`}
      style={({ pressed }) => ({
        width,
        borderRadius: 10,
        borderWidth: 1,
        borderLeftWidth: 4,
        borderColor: tint.fg,
        backgroundColor: tint.bg,
        padding: 12,
        gap: 7,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <T style={{ fontSize: 12, fontWeight: '700', color: tint.fg, fontFamily: monoFont }}>{contentTypeLabel(block.contentType).toUpperCase()}</T>
        <T variant="mono">{`${block.plannedTime || '18:00'} hs`}</T>
      </View>
      <T style={{ fontWeight: '700' }} numberOfLines={2}>{block.blockTitle}</T>
      {block.notes ? <T variant="muted" numberOfLines={3}>{block.notes}</T> : null}
      <View style={{ borderTopWidth: 1, borderTopColor: colors.hairline, paddingTop: 8, gap: 6 }}>
        <T variant="mono">{summary}</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          <Badge label={productionLabel(block.productionStatus).toUpperCase()} tone={block.productionStatus === 'UPLOADED' ? 'live' : 'neutral'} />
          <Badge label={wf.label} tone={wf.tone} />
        </View>
      </View>
      {!isClient && block.reviewStatus === 'CHANGES_REQUESTED' ? (
        <Button
          title="Reenviar a revisión"
          icon="refresh-cw"
          variant="warn"
          small
          onPress={() => action(`/schedules/blocks/${block.id}/resubmit`, { method: 'POST' }, 'Listo: le avisamos al cliente que ya puede revisarlo.')}
        />
      ) : null}
    </Pressable>
  );
}

/** Franja que muestra si la semana está confirmada, o el botón para que el cliente la confirme. */
function ConfirmBar({ schedule, isClient, blocked }: { schedule: Schedule; isClient: boolean; blocked: number }) {
  const action = useApiAction();
  const [asking, setAsking] = useState(false);
  const hasItems = (schedule.items || []).length > 0;

  if (schedule.status === 'APPROVED') {
    const by = schedule.confirmedByUser?.fullName ? ` por ${schedule.confirmedByUser.fullName}` : '';
    const at = schedule.confirmedAt ? ` · ${fmtDateTime(schedule.confirmedAt)}` : '';
    return (
      <Card tone="live">
        <T style={{ fontWeight: '700' }}>{`✓ Cronograma confirmado${by}${at}`}</T>
      </Card>
    );
  }
  if (!isClient) {
    if (blocked) return null;
    return (
      <Card>
        <T variant="muted">{hasItems ? 'Esperando que el cliente revise y confirme la semana.' : 'Agregá el contenido de la semana para que el cliente pueda revisarlo.'}</T>
      </Card>
    );
  }
  if (!hasItems) return null;
  return (
    <Card tone="review">
      <T>
        {blocked
          ? `Pediste cambios en ${blocked === 1 ? 'un bloque' : `${blocked} bloques`}: vas a poder confirmar cuando tu agencia los resuelva.`
          : '¿Revisaste todo? Al confirmar, lo que siga en revisión queda aprobado.'}
      </T>
      {blocked ? null : <Button title="Confirmar cronograma" icon="check" variant="signal" onPress={() => setAsking(true)} />}
      <ConfirmDialog
        visible={asking}
        title="¿Confirmás toda la semana?"
        lines={['Lo que siga en revisión queda aprobado y le avisamos a tu agencia.']}
        confirmLabel="Sí, confirmar"
        onCancel={() => setAsking(false)}
        onConfirm={async () => {
          setAsking(false);
          await action(`/schedules/${schedule.id}/confirm`, { method: 'POST' }, '¡Cronograma confirmado! Le avisamos a tu agencia.');
        }}
      />
    </Card>
  );
}

/** Pantalla del cronograma. */
export function SchedulesScreen() {
  const app = useApp();
  const { session, clients, schedules, selectedClientId, selectedScheduleId, pendingConfirmation, loadingData, blockEditor } = app;
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const respond = useRespondIdentity();
  const [newWeekOpen, setNewWeekOpen] = useState(false);
  if (!session) return null;

  const isClient = session.role === 'CLIENTE';
  const confirmed = clients.filter((c) => c.confirmationStatus === 'CONFIRMED');
  const clientSchedules = schedules.filter((s) => s.clientId === selectedClientId);
  const active = schedules.find((s) => s.id === selectedScheduleId) || null;
  const items = active?.items || [];
  const approved = items.filter((b) => b.reviewStatus === 'APPROVED').length;
  const inReview = items.filter((b) => b.reviewStatus === 'IN_REVIEW').length;
  const blocked = items.filter((b) => b.reviewStatus === 'CHANGES_REQUESTED' || b.reviewStatus === 'REJECTED').length;
  // Cada tarjeta ocupa casi todo el ancho; la siguiente asoma para que se note que hay más.
  const cardWidth = Math.min(width - 72, 340);

  const openNewWeek = () => {
    if (!confirmed.length) {
      app.setBanner('Primero necesitás un cliente con identidad confirmada ("Sí, soy yo") para armarle un cronograma.', true);
      return;
    }
    setNewWeekOpen(true);
  };

  if (isClient && pendingConfirmation) {
    return (
      <Screen>
        <Card tone="warn" style={{ gap: 14 }}>
          <T variant="title">Confirmá tu identidad para ver tu cronograma</T>
          <T variant="muted">
            Por tu seguridad, antes de mostrarte contenido o vincular tu cuenta con {pendingConfirmation.agency?.name || 'la agencia'}, confirmá que sos vos.
          </T>
          <Button title="Sí, soy yo — Activar mi cuenta" icon="check" variant="signal" onPress={() => respond(pendingConfirmation.id, 'ACCEPT')} />
          <Button title="No soy yo — Rechazar" icon="x" variant="fault" onPress={() => respond(pendingConfirmation.id, 'REJECT')} />
        </Card>
      </Screen>
    );
  }

  return (
    <>
      <Screen onRefresh={() => app.hydrate()} refreshing={loadingData}>
        <ScreenHeader
          title={isClient ? 'Tu contenido de la semana' : 'Cronograma semanal'}
          actions={isClient ? undefined : <Button title="Nueva semana" icon="plus" variant="signal" onPress={openNewWeek} />}
        />

        {!isClient && confirmed.length > 0 ? (
          <View style={{ gap: 6 }}>
            <T variant="eyebrow">CLIENTE</T>
            <ChipRow>
              {confirmed.map((c) => (
                <Chip key={c.id} label={c.companyName} active={c.id === selectedClientId} onPress={() => app.selectClient(c.id)} />
              ))}
            </ChipRow>
          </View>
        ) : null}

        {!isClient && confirmed.length === 0 ? (
          <EmptyState
            title="Agregá y confirmá un cliente para armar su cronograma"
            text="En Clientes das de alta una marca. Cuando el cliente confirme «Sí, soy yo», vas a poder crearle sus semanas."
          >
            <Button title="Ir a Clientes" icon="users" variant="signal" onPress={() => app.goToTab('accounts')} />
          </EmptyState>
        ) : !active ? (
          <EmptyState
            title={isClient ? 'Tu agencia todavía no compartió un cronograma' : 'Todavía no hay semanas para este cliente'}
            text={isClient ? 'Te vamos a avisar apenas tu agencia cargue el contenido de la semana.' : 'Creá la primera semana para empezar a cargar el contenido.'}
          >
            {isClient ? null : <Button title="Crear primera semana" icon="plus" variant="signal" onPress={openNewWeek} />}
          </EmptyState>
        ) : (
          <>
            <View style={{ gap: 6 }}>
              <T variant="eyebrow">SEMANA</T>
              <ChipRow>
                {clientSchedules.map((s) => (
                  <Chip
                    key={s.id}
                    label={`${fmtShortDate(s.weekStartDate)} al ${fmtShortDate(s.weekStartDate, 6)}`}
                    active={s.id === active.id}
                    onPress={() => app.selectSchedule(s.id)}
                  />
                ))}
              </ChipRow>
            </View>

            <View style={{ gap: 4 }}>
              <T variant="subtitle">{active.title}</T>
              {active.summaryNotes ? <T variant="muted">{active.summaryNotes}</T> : null}
            </View>

            {!isClient ? <Button title="Agregar bloque" icon="plus" variant="signal" onPress={() => app.openBlockEditor({ blockId: null, day: 1 })} /> : null}

            <ConfirmBar schedule={active} isClient={isClient} blocked={blocked} />

            <View style={{ flexDirection: 'row', borderWidth: 1, borderColor: colors.hairline, borderRadius: 10, backgroundColor: colors.stage }}>
              {[
                { value: items.length, label: 'BLOQUES', color: colors.textPrimary },
                { value: approved, label: 'APROBADOS', color: colors.live },
                { value: blocked || inReview, label: blocked ? 'CON CAMBIOS' : 'EN REVISIÓN', color: blocked ? colors.warn : colors.signalSubtleFg },
              ].map((stat, i) => (
                <View key={stat.label} style={{ flex: 1, padding: 12, borderLeftWidth: i ? 1 : 0, borderLeftColor: colors.hairline }}>
                  <T style={{ fontSize: 20, fontWeight: '700', color: stat.color, fontFamily: monoFont }}>{String(stat.value)}</T>
                  <T variant="eyebrow">{stat.label}</T>
                </View>
              ))}
            </View>

            {WEEKDAYS.map((day, idx) => {
              const dayBlocks = items.filter((b) => b.dayOfWeek === day.num);
              return (
                <View key={day.num} style={{ borderWidth: 1, borderColor: colors.hairline, borderRadius: 10, backgroundColor: colors.stage, overflow: 'hidden' }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: 12,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.hairline,
                      backgroundColor: colors.inspector,
                    }}
                  >
                    <View>
                      <T style={{ fontWeight: '700', color: colors.signalSubtleFg, fontFamily: monoFont }}>{day.full}</T>
                      <T variant="mono">{fmtShortDate(active.weekStartDate, idx)}</T>
                    </View>
                    <Badge label={String(dayBlocks.length)} />
                  </View>
                  {dayBlocks.length === 0 ? (
                    <T variant="small" style={{ padding: 16, textAlign: 'center' }}>{`Sin bloques para el ${day.full.toLowerCase()}`}</T>
                  ) : (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      snapToInterval={cardWidth + 10}
                      decelerationRate="fast"
                      contentContainerStyle={{ padding: 10, gap: 10 }}
                    >
                      {dayBlocks.map((b) => (
                        <BlockCard key={b.id} block={b} width={dayBlocks.length === 1 ? width - 54 : cardWidth} isClient={isClient} />
                      ))}
                    </ScrollView>
                  )}
                  {!isClient ? (
                    <View style={{ padding: 10, paddingTop: dayBlocks.length ? 0 : 10 }}>
                      <IconButton icon="plus" label={`Agregar bloque al ${day.full.toLowerCase()}`} onPress={() => app.openBlockEditor({ blockId: null, day: day.num })} />
                    </View>
                  ) : null}
                </View>
              );
            })}
          </>
        )}
      </Screen>

      {newWeekOpen ? <NewWeekSheet onClose={() => setNewWeekOpen(false)} /> : null}
      {blockEditor ? <BlockEditorSheet seed={blockEditor} onClose={() => app.openBlockEditor(null)} /> : null}
      {app.inspectBlockId ? <BlockInspectorSheet key={app.inspectBlockId} /> : null}
    </>
  );
}
