/** Ventana para crear una semana de lunes a domingo. */
import React, { useState } from 'react';
import { View } from 'react-native';
import { Button, Field, IconButton, Input, Sheet, T } from '../../components/ui';
import { addDaysIso, fmtShortDate, getMondayOf } from '../../lib/format';
import { useApiAction, useApp } from '../../state/AppContext';

/** Propone la semana siguiente a la última del cliente, o la actual si todavía no tiene. */
function suggestedMonday(latestStart: string | undefined) {
  return latestStart ? addDaysIso(latestStart, 7) : getMondayOf(new Date());
}

/** Ventana para crear una semana. Se monta solo mientras está abierta. */
export function NewWeekSheet({ onClose }: { onClose: () => void }) {
  const { schedules, selectedClientId, selectSchedule } = useApp();
  const action = useApiAction();
  const [monday, setMonday] = useState(() => suggestedMonday(schedules.find((s) => s.clientId === selectedClientId)?.weekStartDate));
  const [title, setTitle] = useState(() => `Semana del ${fmtShortDate(monday)}`);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const move = (weeks: number) => {
    const next = addDaysIso(monday, weeks * 7);
    // Si el título era el propuesto, se actualiza con la nueva fecha.
    if (title === `Semana del ${fmtShortDate(monday)}`) setTitle(`Semana del ${fmtShortDate(next)}`);
    setMonday(next);
  };

  const submit = async () => {
    if (!selectedClientId || busy) return;
    setBusy(true);
    const created = await action(
      '/schedules',
      {
        method: 'POST',
        body: {
          clientId: selectedClientId,
          weekStartDate: monday,
          weekEndDate: addDaysIso(monday, 6),
          title: title.trim() || `Semana ${fmtShortDate(monday)}`,
          summaryNotes: notes.trim() || undefined,
        },
      },
      'Semana creada. Ya la puede ver el cliente.',
    );
    setBusy(false);
    if (created) {
      selectSchedule(created.id);
      onClose();
    }
  };

  return (
    <Sheet
      visible
      title="Crear semana de lunes a domingo"
      onClose={onClose}
      footer={
        <>
          <IconButton icon="x" label="Cancelar" onPress={onClose} size={46} />
          <Button title="Crear semana" variant="signal" busy={busy} onPress={submit} style={{ flex: 1 }} />
        </>
      }
    >
      <Field label="Semana">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <IconButton icon="chevron-left" label="Semana anterior" onPress={() => move(-1)} />
          <View style={{ flex: 1, alignItems: 'center' }}>
            <T variant="subtitle">Lun {fmtShortDate(monday)} — Dom {fmtShortDate(monday, 6)}</T>
          </View>
          <IconButton icon="chevron-right" label="Semana siguiente" onPress={() => move(1)} />
        </View>
      </Field>
      <Field label="Título de la semana">
        <Input value={title} onChangeText={setTitle} maxLength={160} />
      </Field>
      <Field label="Objetivo o nota general para el cliente (opcional)">
        <Input value={notes} onChangeText={setNotes} multiline />
      </Field>
    </Sheet>
  );
}
