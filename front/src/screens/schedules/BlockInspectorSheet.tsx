/** Detalle de un bloque: contenido, fotos y videos, comentarios, revisión del cliente y acciones de la agencia. */
import React, { useState } from 'react';
import { View } from 'react-native';
import { apiFetch, friendlyError } from '../../api/client';
import { Badge, Button, Card, Chip, ChipRow, ConfirmDialog, Field, IconButton, Input, Sheet, T } from '../../components/ui';
import { contentTypeLabel, fmtDateTime, fmtShortDate, PRODUCTION_STATUSES, productionLabel, WEEKDAYS, workflowMeta } from '../../lib/format';
import { useApiAction, useApp } from '../../state/AppContext';
import { noteColors, useTheme } from '../../theme/theme';
import { MediaView } from './MediaView';

type Decision = 'APPROVED' | 'CHANGES_REQUESTED' | 'REJECTED';

/** Detalle de un bloque. */
export function BlockInspectorSheet() {
  const { session, schedules, selectedScheduleId, inspectBlockId, setInspectBlockId, openBlockEditor, patchBlockLocally, setBanner, hydrate } =
    useApp();
  const { colors, name: themeName } = useTheme();
  const action = useApiAction();
  const [note, setNote] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reviewConfirm, setReviewConfirm] = useState<{ decision: Decision; hadChanges: boolean; hasText: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  // Se monta con key={inspectBlockId}: al abrir otro bloque, lo escrito empieza de cero.
  const schedule = schedules.find((s) => s.id === selectedScheduleId) || null;
  const block = (schedule?.items || []).find((b) => b.id === inspectBlockId) || null;

  if (!session || !block || !schedule) return null;

  const isClient = session.role === 'CLIENTE';
  const close = () => setInspectBlockId(null);
  const day = WEEKDAYS.find((d) => d.num === block.dayOfWeek) || WEEKDAYS[0];
  const wf = workflowMeta(block.reviewStatus);
  const media = block.media || [];
  const comments = block.comments || [];
  const tint = noteColors(block.noteColor || 'AMBER', colors, themeName);

  const comment = async () => {
    const message = note.trim();
    if (!message || busy) return;
    setBusy(true);
    const ok = await action(`/schedules/blocks/${block.id}/comments`, { method: 'POST', body: { message } });
    setBusy(false);
    if (ok) setNote('');
  };

  /** Envía la decisión. Pide confirmar si con ella se descarta un pedido de cambios o un texto ya escrito. */
  const review = async (decision: Decision, confirmed = false) => {
    const feedback = note.trim();
    const hadChanges = block.reviewStatus === 'CHANGES_REQUESTED';
    if (!confirmed) {
      const dropsChanges = decision !== 'CHANGES_REQUESTED' && hadChanges;
      const dropsText = decision === 'APPROVED' && Boolean(feedback);
      if (dropsChanges || dropsText) {
        setReviewConfirm({ decision, hadChanges, hasText: Boolean(feedback) });
        return;
      }
      if (decision !== 'APPROVED' && feedback.length < 3) {
        setBanner('Contá brevemente qué cambiarías o por qué lo rechazás.', true);
        return;
      }
    }
    setReviewConfirm(null);
    // Confirmado el aviso, solo viaja la decisión: lo escrito no se le manda a la agencia.
    const ok = await action(
      `/schedules/blocks/${block.id}/review`,
      { method: 'POST', body: { decision, feedbackNotes: confirmed ? undefined : feedback || undefined } },
      'Listo: le avisamos a tu agencia.',
    );
    if (ok) setNote('');
  };

  const setProduction = async (productionStatus: string) => {
    if (block.productionStatus === productionStatus) return;
    const previous = block.productionStatus;
    patchBlockLocally(block.id, { productionStatus });
    const r = await apiFetch(`/schedules/blocks/${block.id}`, { method: 'PATCH', body: { productionStatus } });
    if (!r.ok) {
      patchBlockLocally(block.id, { productionStatus: previous });
      setBanner(friendlyError(r.data, r.status), true);
    }
  };

  const remove = async () => {
    setConfirmDelete(false);
    const r = await apiFetch(`/schedules/blocks/${block.id}`, { method: 'DELETE' });
    if (!r.ok) {
      setBanner(friendlyError(r.data, r.status), true);
      return;
    }
    close();
    await hydrate();
    setBanner('Bloque eliminado del cronograma.');
  };

  const rejecting = reviewConfirm?.decision === 'REJECTED';

  return (
    <Sheet
      visible
      onClose={close}
      title={block.blockTitle}
      subtitle={`${contentTypeLabel(block.contentType).toUpperCase()} · ${day.full.toUpperCase()} ${fmtShortDate(schedule.weekStartDate, block.dayOfWeek - 1)} · ${block.plannedTime || '18:00'} HS`}
      footer={
        isClient ? undefined : (
          <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-between' }}>
            <IconButton icon="trash-2" label="Eliminar bloque" variant="fault" onPress={() => setConfirmDelete(true)} />
            <IconButton
              icon="edit-2"
              label="Editar bloque"
              variant="signal"
              onPress={() => {
                close();
                openBlockEditor({ blockId: block.id, day: block.dayOfWeek });
              }}
            />
          </View>
        )
      }
    >
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <Badge label={wf.label} tone={wf.tone} />
        {isClient ? <Badge label={productionLabel(block.productionStatus).toUpperCase()} tone={block.productionStatus === 'UPLOADED' ? 'live' : 'neutral'} /> : null}
      </View>

      {!isClient && block.reviewStatus === 'CHANGES_REQUESTED' ? (
        <Button
          title="Reenviar a revisión"
          variant="warn"
          icon="refresh-cw"
          onPress={() => action(`/schedules/blocks/${block.id}/resubmit`, { method: 'POST' }, 'Listo: le avisamos al cliente que ya puede revisarlo.')}
        />
      ) : null}

      {!isClient ? (
        <Field label="Estado">
          <ChipRow>
            {PRODUCTION_STATUSES.map((p) => (
              <Chip key={p.code} label={p.label} active={(block.productionStatus || 'PENDING') === p.code} onPress={() => setProduction(p.code)} />
            ))}
          </ChipRow>
        </Field>
      ) : null}

      {block.notes ? (
        <View style={{ borderWidth: 1, borderColor: tint.fg, backgroundColor: tint.bg, borderRadius: 10, padding: 12, gap: 4 }}>
          <T variant="eyebrow" style={{ color: tint.fg }}>CONTENIDO</T>
          <T>{block.notes}</T>
        </View>
      ) : null}

      {block.caption ? (
        <Card style={{ gap: 4 }}>
          <T variant="eyebrow">TEXTO DE LA PUBLICACIÓN</T>
          <T>{block.caption}</T>
        </Card>
      ) : null}

      {media.length ? (
        media.map((m, i) => (
          <View key={m.storageKey} style={{ borderWidth: 1, borderColor: colors.hairline, borderRadius: 10, overflow: 'hidden', backgroundColor: colors.inspector }}>
            <MediaView uri={m.url} kind={m.kind} height={320} />
            <View style={{ padding: 10, gap: 3 }}>
              <T variant="mono">{`${m.kind === 'VIDEO' ? 'VIDEO' : 'FOTO'} ${i + 1} DE ${media.length}`}</T>
              {m.description ? <T>{m.description}</T> : null}
            </View>
          </View>
        ))
      ) : (
        <View style={{ borderWidth: 1, borderStyle: 'dashed', borderColor: colors.borderStrong, borderRadius: 10, padding: 16 }}>
          <T variant="muted" style={{ textAlign: 'center' }}>
            {isClient ? 'Tu agencia va a sumar las fotos o videos de este contenido.' : 'Este bloque todavía no tiene fotos ni videos.'}
          </T>
        </View>
      )}

      <View style={{ gap: 10, borderTopWidth: 1, borderTopColor: colors.hairline, paddingTop: 14 }}>
        <T variant="eyebrow">COMENTARIOS</T>
        {comments.length ? (
          comments.map((c) => (
            <View key={c.id} style={{ backgroundColor: colors.inspector, borderWidth: 1, borderColor: colors.hairline, borderRadius: 10, padding: 10, gap: 2 }}>
              <T variant="mono">{`${c.authorUser?.fullName || 'Usuario'} · ${fmtDateTime(c.createdAt)}`}</T>
              <T>{c.message}</T>
            </View>
          ))
        ) : (
          <T variant="small">Todavía no hay comentarios.</T>
        )}
        <Field label={isClient ? 'Tu comentario o los cambios que pedís' : 'Escribile al cliente'}>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
            <Input value={note} onChangeText={setNote} multiline maxLength={5000} style={{ minHeight: 70, flex: 1 }} />
            <IconButton icon="send" label="Comentar" variant="signal" disabled={busy} onPress={comment} />
          </View>
        </Field>

        {session.role !== 'AGENCIA' ? (
          <View style={{ gap: 8 }}>
            <Button title="Aprobar" variant="signal" icon="check" onPress={() => review('APPROVED')} />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button title="Pedir cambios" variant="warn" onPress={() => review('CHANGES_REQUESTED')} style={{ flex: 1 }} />
              <Button title="Rechazar" variant="fault" onPress={() => review('REJECTED')} style={{ flex: 1 }} />
            </View>
          </View>
        ) : null}
      </View>

      <ConfirmDialog
        visible={confirmDelete}
        title="¿Eliminar este bloque?"
        lines={['Se borran también sus fotos y videos. No se puede deshacer.']}
        confirmLabel="Sí, eliminar"
        danger
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />
      <ConfirmDialog
        visible={Boolean(reviewConfirm)}
        title={rejecting ? '¿Rechazar este contenido?' : '¿Aprobar este contenido?'}
        lines={[
          ...(reviewConfirm?.hadChanges ? ['Ya pediste cambios en este contenido. Si seguís, ese pedido queda sin efecto.'] : []),
          ...(reviewConfirm?.hasText ? ['Lo que escribiste en el comentario no se va a enviar.'] : []),
          `A tu agencia solo le va a llegar que ${rejecting ? 'rechazaste' : 'aprobaste'} el contenido.`,
        ]}
        confirmLabel={rejecting ? 'Sí, rechazar' : 'Sí, aprobar'}
        danger={rejecting}
        onConfirm={() => reviewConfirm && review(reviewConfirm.decision, true)}
        onCancel={() => setReviewConfirm(null)}
      />
    </Sheet>
  );
}
