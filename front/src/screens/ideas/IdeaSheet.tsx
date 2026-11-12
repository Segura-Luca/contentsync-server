/** Formulario de ideas: crear, editar, o editar una propuesta de un cliente antes de aceptarla. */
import React, { useState } from 'react';
import { Switch, View } from 'react-native';
import { apiFetch, friendlyError } from '../../api/client';
import { Idea, IdeaProposal } from '../../api/types';
import { Button, Chip, ChipRow, ErrorText, Field, IconButton, Input, Sheet, T } from '../../components/ui';
import { normalizeUrl } from '../../lib/format';
import { useApp } from '../../state/AppContext';
import { noteColors, useTheme } from '../../theme/theme';
import { ColorPicker, nextFreeColor } from './ColorPicker';

/** Qué se abre en el formulario. */
export type IdeaSheetTarget =
  | { kind: 'new'; sectionId?: string; clientId?: string }
  | { kind: 'edit'; idea: Idea }
  | { kind: 'proposal'; proposal: IdeaProposal; sectionId?: string };

/** Valores iniciales del formulario según lo que se abre. */
function initialValues(target: IdeaSheetTarget, firstSectionId: string) {
  if (target.kind === 'edit') {
    const idea = target.idea;
    return { sectionId: idea.sectionId, clientId: idea.clientId || '', title: idea.title, content: idea.content, refUrl: idea.referenceUrl || '', pinned: Boolean(idea.isPinned) };
  }
  if (target.kind === 'proposal') {
    const p = target.proposal;
    return { sectionId: target.sectionId || firstSectionId, clientId: p.clientId, title: p.title, content: p.content, refUrl: p.referenceUrl || '', pinned: false };
  }
  return { sectionId: target.sectionId || firstSectionId, clientId: target.clientId || '', title: '', content: '', refUrl: '', pinned: false };
}

/** Formulario de ideas. Se monta solo mientras está abierto. */
export function IdeaSheet({ target, onClose }: { target: IdeaSheetTarget; onClose: () => void }) {
  const { ideaSections, clients, hydrate, setBanner } = useApp();
  const { colors, name: themeName } = useTheme();
  const confirmed = clients.filter((c) => c.confirmationStatus === 'CONFIRMED');
  const [initial] = useState(() => initialValues(target, ideaSections[0]?.id || ''));

  const [sectionId, setSectionId] = useState(initial.sectionId);
  const [clientId, setClientId] = useState(initial.clientId);
  const [title, setTitle] = useState(initial.title);
  const [content, setContent] = useState(initial.content);
  const [refUrl, setRefUrl] = useState(initial.refUrl);
  const [pinned, setPinned] = useState(initial.pinned);
  const [newSectionOpen, setNewSectionOpen] = useState(ideaSections.length === 0);
  const [newSectionName, setNewSectionName] = useState('');
  const [newSectionColor, setNewSectionColor] = useState(() => nextFreeColor(ideaSections.map((s) => s.color)));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const createSection = async () => {
    const name = newSectionName.trim();
    if (!name) return setError('Escribile un nombre a la sección.');
    const r = await apiFetch('/ideas/sections', { method: 'POST', body: { name, color: newSectionColor } });
    if (!r.ok) return setError(friendlyError(r.data, r.status));
    setError('');
    setSectionId(r.data.id);
    setNewSectionOpen(false);
    await hydrate();
  };

  const submit = async () => {
    if (busy) return;
    const t = title.trim();
    const c = content.trim();
    if (!t || !c) return setError('Completá el título y el desarrollo de la idea.');
    if (!sectionId || newSectionOpen) return setError(newSectionOpen ? 'Primero creá la sección con su botón.' : 'Elegí una sección para la idea.');
    setBusy(true);
    let r;
    let success: string;
    if (target.kind === 'proposal') {
      r = await apiFetch(`/idea-proposals/${target.proposal.id}/accept`, {
        method: 'POST',
        body: { sectionId, title: t, content: c, referenceUrl: normalizeUrl(refUrl) },
      });
      success = 'Propuesta aceptada: ya está en tus ideas. Le avisamos al cliente.';
    } else {
      const editing = target.kind === 'edit';
      r = await apiFetch(editing ? `/ideas/${target.idea.id}` : '/ideas', {
        method: editing ? 'PATCH' : 'POST',
        body: { sectionId, clientId: clientId || undefined, title: t, content: c, referenceUrl: normalizeUrl(refUrl) || undefined, isPinned: pinned },
      });
      success = editing ? 'Idea actualizada.' : 'Idea guardada en tu espacio privado.';
    }
    setBusy(false);
    if (!r.ok) return setError(friendlyError(r.data, r.status));
    onClose();
    await hydrate();
    setBanner(success);
  };

  const isProposal = target.kind === 'proposal';
  const heading = isProposal ? 'Editar y aceptar' : target.kind === 'edit' ? 'Editar idea' : 'Nueva idea';

  return (
    <Sheet
      visible
      title={heading}
      onClose={onClose}
      footer={
        <>
          <IconButton icon="x" label="Cancelar" onPress={onClose} size={46} />
          <Button title={isProposal ? 'Aceptar' : 'Guardar'} variant="signal" busy={busy} onPress={submit} style={{ flex: 1 }} />
        </>
      }
    >
      <Field label="Sección">
        <ChipRow>
          {ideaSections.map((s) => (
            <Chip
              key={s.id}
              label={s.name}
              dot={noteColors(s.color, colors, themeName).dot}
              active={!newSectionOpen && s.id === sectionId}
              onPress={() => {
                setNewSectionOpen(false);
                setSectionId(s.id);
              }}
            />
          ))}
          <Chip label="+ Crear sección" active={newSectionOpen} onPress={() => setNewSectionOpen(true)} />
        </ChipRow>
      </Field>

      {newSectionOpen ? (
        <View style={{ borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 10, padding: 12, gap: 12 }}>
          <Field label="Nombre">
            <Input value={newSectionName} onChangeText={setNewSectionName} maxLength={100} />
          </Field>
          <Field label="Color">
            <ColorPicker value={newSectionColor} onChange={setNewSectionColor} used={ideaSections.map((s) => s.color)} />
          </Field>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {ideaSections.length ? <IconButton icon="x" label="Cancelar" onPress={() => setNewSectionOpen(false)} size={46} /> : null}
            <Button title="Crear" variant="signal" onPress={createSection} style={{ flex: 1 }} />
          </View>
        </View>
      ) : null}

      {isProposal ? null : (
        <Field label="Cliente (opcional)">
          <ChipRow>
            <Chip label="General" active={!clientId} onPress={() => setClientId('')} />
            {confirmed.map((c) => (
              <Chip key={c.id} label={c.companyName} active={clientId === c.id} onPress={() => setClientId(c.id)} />
            ))}
          </ChipRow>
        </Field>
      )}

      <Field label="Título">
        <Input value={title} onChangeText={setTitle} maxLength={180} />
      </Field>
      <Field label="Desarrollo">
        <Input value={content} onChangeText={setContent} multiline style={{ minHeight: 120 }} />
      </Field>
      <Field label="Enlace (opcional)">
        <Input value={refUrl} onChangeText={setRefUrl} autoCapitalize="none" keyboardType="url" maxLength={500} />
      </Field>

      {isProposal ? null : (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <T>Fijada</T>
          <Switch value={pinned} onValueChange={setPinned} trackColor={{ true: colors.signal, false: colors.hairline }} />
        </View>
      )}

      <ErrorText message={error} />
    </Sheet>
  );
}
