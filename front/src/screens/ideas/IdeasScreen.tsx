/**
 * Banco de ideas, privado de la agencia: secciones con color, filtros por sección y marca,
 * búsqueda, ideas fijadas y propuestas que mandan los clientes.
 */
import React, { useState } from 'react';
import { Linking, View } from 'react-native';
import { Idea, IdeaProposal } from '../../api/types';
import { Badge, Button, Card, Chip, ChipRow, ConfirmDialog, Detail, EmptyState, Field, IconButton, Input, LinkButton, Screen, ScreenHeader, T } from '../../components/ui';
import { useApiAction, useApp } from '../../state/AppContext';
import { noteColors, useTheme } from '../../theme/theme';
import { ColorPicker, nextFreeColor } from './ColorPicker';
import { IdeaSheet, IdeaSheetTarget } from './IdeaSheet';

/** Abre un enlace de referencia en el navegador. */
function openLink(url: string) {
  const full = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  Linking.openURL(full).catch(() => {});
}

/** Propuestas de clientes que todavía no se respondieron. */
function ProposalsList({ onEdit }: { onEdit: (proposal: IdeaProposal, sectionId?: string) => void }) {
  const { ideaProposals, ideaSections } = useApp();
  const { colors, name: themeName } = useTheme();
  const action = useApiAction();
  const [choice, setChoice] = useState<Record<string, string>>({});
  const [rejecting, setRejecting] = useState<string | null>(null);
  const pending = ideaProposals.filter((p) => p.status === 'PENDING');

  if (!pending.length) {
    return <EmptyState title="No hay propuestas por responder" />;
  }

  return (
    <View style={{ gap: 12 }}>
      {pending.map((p) => {
        const sectionId = choice[p.id] || ideaSections[0]?.id;
        return (
          <Card key={p.id}>
            <Badge label={p.client?.companyName || 'Cliente'} tone="warn" />
            <T variant="subtitle">{p.title}</T>
            <T variant="muted">{p.content}</T>
            {p.referenceUrl ? <LinkButton title="Ver referencia" onPress={() => openLink(p.referenceUrl!)} /> : null}
            {ideaSections.length ? (
              <Field label="Sección">
                <ChipRow>
                  {ideaSections.map((s) => (
                    <Chip
                      key={s.id}
                      label={s.name}
                      dot={noteColors(s.color, colors, themeName).dot}
                      active={sectionId === s.id}
                      onPress={() => setChoice((prev) => ({ ...prev, [p.id]: s.id }))}
                    />
                  ))}
                </ChipRow>
              </Field>
            ) : null}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <IconButton
                icon="check"
                label="Aceptar"
                variant="signal"
                onPress={() =>
                  sectionId
                    ? action(`/idea-proposals/${p.id}/accept`, { method: 'POST', body: { sectionId } }, 'Propuesta aceptada: ya está en tus ideas. Le avisamos al cliente.')
                    : onEdit(p)
                }
              />
              <IconButton icon="edit-2" label="Editar y aceptar" onPress={() => onEdit(p, sectionId)} />
              <IconButton icon="x" label="Rechazar" variant="fault" onPress={() => setRejecting(p.id)} />
            </View>
          </Card>
        );
      })}
      <ConfirmDialog
        visible={Boolean(rejecting)}
        title="¿Rechazar esta propuesta?"
        lines={['Le avisamos al cliente.']}
        confirmLabel="Sí, rechazar"
        danger
        onCancel={() => setRejecting(null)}
        onConfirm={async () => {
          const id = rejecting;
          setRejecting(null);
          if (id) await action(`/idea-proposals/${id}/reject`, { method: 'POST' }, 'Propuesta rechazada. Le avisamos al cliente.');
        }}
      />
    </View>
  );
}

/** Tarjeta de una idea. */
function IdeaCard({ idea, onEdit, onDelete, onSendToPlan }: { idea: Idea; onEdit: () => void; onDelete: () => void; onSendToPlan: () => void }) {
  const { colors, name: themeName } = useTheme();
  const action = useApiAction();
  const tint = noteColors(idea.section?.color || 'LIME', colors, themeName);
  return (
    <View style={{ borderWidth: 1, borderColor: colors.hairline, borderTopWidth: 3, borderTopColor: tint.fg, backgroundColor: colors.stage, borderRadius: 10, padding: 14, gap: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <Badge label={idea.section?.name || 'Sección'} color={{ fg: tint.fg, bg: tint.bg }} />
        <IconButton
          icon="bookmark"
          label={idea.isPinned ? 'Quitar fijado' : 'Fijar arriba'}
          variant={idea.isPinned ? 'signal' : 'outline'}
          onPress={() => action(`/ideas/${idea.id}`, { method: 'PATCH', body: { isPinned: !idea.isPinned } })}
        />
      </View>
      <T variant="subtitle">{idea.title}</T>
      <T variant="muted">{idea.content}</T>
      {idea.referenceUrl ? <LinkButton title="Ver referencia" onPress={() => openLink(idea.referenceUrl!)} /> : null}
      <T variant="mono">{idea.client?.companyName || 'General de la agencia'}</T>
      <View style={{ borderTopWidth: 1, borderTopColor: colors.hairline, paddingTop: 10, flexDirection: 'row', gap: 10, alignItems: 'center' }}>
        <IconButton icon="calendar" label="Llevar al cronograma" variant="signal" onPress={onSendToPlan} />
        <View style={{ flex: 1 }} />
        <IconButton icon="edit-2" label="Editar" onPress={onEdit} />
        <IconButton icon="trash-2" label="Eliminar" variant="fault" onPress={onDelete} />
      </View>
    </View>
  );
}

/** Pantalla de ideas. */
export function IdeasScreen() {
  const app = useApp();
  const { ideas, ideaSections, clients, ideaProposals, ideaSectionFilter, setIdeaSectionFilter, loadingData } = app;
  const { colors, name: themeName } = useTheme();
  const action = useApiAction();
  const [clientFilter, setClientFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [sheet, setSheet] = useState<IdeaSheetTarget | null>(null);
  const [newSectionOpen, setNewSectionOpen] = useState(false);
  const [sectionName, setSectionName] = useState('');
  const [sectionColor, setSectionColor] = useState('');
  const [deleteIdea, setDeleteIdea] = useState<string | null>(null);
  const [deleteSection, setDeleteSection] = useState(false);

  const confirmed = clients.filter((c) => c.confirmationStatus === 'CONFIRMED');
  const pendingCount = ideaProposals.filter((p) => p.status === 'PENDING').length;
  const activeSection = ideaSections.find((s) => s.id === ideaSectionFilter) || null;
  const q = search.trim().toLowerCase();
  const filtered = ideas.filter((idea) => {
    const matchSection = ideaSectionFilter === 'ALL' || idea.sectionId === ideaSectionFilter;
    const matchClient = clientFilter === 'ALL' || (clientFilter === 'GENERAL' && !idea.clientId) || idea.clientId === clientFilter;
    const matchText = !q || [idea.title, idea.content, idea.section?.name || ''].some((x) => x.toLowerCase().includes(q));
    return matchSection && matchClient && matchText;
  });

  const openNewSection = () => {
    setSectionName('');
    setSectionColor(nextFreeColor(ideaSections.map((s) => s.color)));
    setNewSectionOpen((open) => !open);
  };

  const createSection = async () => {
    const name = sectionName.trim();
    if (!name) {
      app.setBanner('Escribile un nombre a la sección.', true);
      return;
    }
    const created = await action('/ideas/sections', { method: 'POST', body: { name, color: sectionColor } }, `Sección "${name}" creada.`);
    if (created) {
      setNewSectionOpen(false);
      setIdeaSectionFilter(created.id);
    }
  };

  /** Lleva una idea al cronograma: abre un bloque nuevo con su título, contenido y color. */
  const sendToPlan = (idea: Idea) => {
    if (idea.clientId) app.selectClient(idea.clientId);
    const hasWeek = app.schedules.some((s) => s.clientId === (idea.clientId || app.selectedClientId));
    app.goToTab('schedules');
    if (!hasWeek) {
      app.setBanner('Primero creá una semana para ese cliente.', true);
      return;
    }
    app.openBlockEditor({ blockId: null, day: 1, title: idea.title, notes: idea.content, color: idea.section?.color });
  };

  return (
    <>
      <Screen onRefresh={() => app.hydrate()} refreshing={loadingData}>
        <ScreenHeader
          title="Ideas de contenido"
          badge={<Detail text="Guardá guiones, ganchos y formatos en tus propias secciones. Tus clientes nunca ven este espacio." />}
          actions={
            <>
              {newSectionOpen ? (
                <IconButton icon="x" label="Cerrar" onPress={openNewSection} size={46} />
              ) : (
                <Button title="Sección" icon="plus" onPress={openNewSection} />
              )}
              <Button
                title="Idea"
                icon="plus"
                variant="signal"
                onPress={() => setSheet({ kind: 'new', sectionId: activeSection?.id, clientId: clientFilter === 'ALL' || clientFilter === 'GENERAL' ? undefined : clientFilter })}
              />
            </>
          }
        />

        {newSectionOpen ? (
          <Card>
            <Field label="Nombre">
              <Input value={sectionName} onChangeText={setSectionName} maxLength={100} />
            </Field>
            <Field label="Color">
              <ColorPicker value={sectionColor} onChange={setSectionColor} used={ideaSections.map((s) => s.color)} />
            </Field>
            <Button title="Guardar" variant="signal" onPress={createSection} />
          </Card>
        ) : null}

        <ChipRow>
          <Chip label={`Todas (${ideas.length})`} active={ideaSectionFilter === 'ALL'} onPress={() => setIdeaSectionFilter('ALL')} />
          <Chip label={`Propuestas (${pendingCount})`} active={ideaSectionFilter === 'PROPOSALS'} onPress={() => setIdeaSectionFilter('PROPOSALS')} />
          {ideaSections.map((s) => (
            <Chip
              key={s.id}
              label={`${s.name} (${ideas.filter((i) => i.sectionId === s.id).length})`}
              dot={noteColors(s.color, colors, themeName).dot}
              active={ideaSectionFilter === s.id}
              onPress={() => setIdeaSectionFilter(s.id)}
            />
          ))}
        </ChipRow>

        {activeSection ? <IconButton icon="trash-2" label={`Eliminar sección «${activeSection.name}»`} variant="fault" onPress={() => setDeleteSection(true)} /> : null}

        {ideaSectionFilter === 'PROPOSALS' ? (
          <ProposalsList onEdit={(proposal, sectionId) => setSheet({ kind: 'proposal', proposal, sectionId })} />
        ) : (
          <>
            <Input value={search} onChangeText={setSearch} placeholder="Buscar ideas" accessibilityLabel="Buscar ideas" />
            <ChipRow>
              <Chip label="Todas las marcas" active={clientFilter === 'ALL'} onPress={() => setClientFilter('ALL')} />
              <Chip label="Solo generales" active={clientFilter === 'GENERAL'} onPress={() => setClientFilter('GENERAL')} />
              {confirmed.map((c) => (
                <Chip key={c.id} label={c.companyName} active={clientFilter === c.id} onPress={() => setClientFilter(c.id)} />
              ))}
            </ChipRow>

            {ideaSectionFilter === 'ALL' && pendingCount ? (
              <View style={{ gap: 10 }}>
                <T variant="eyebrow">{`PROPUESTAS DE CLIENTES POR RESPONDER (${pendingCount})`}</T>
                <ProposalsList onEdit={(proposal, sectionId) => setSheet({ kind: 'proposal', proposal, sectionId })} />
              </View>
            ) : null}

            {filtered.length === 0 ? (
              <EmptyState title="No hay ideas con este filtro">
                <Button
                  title="Ver todas"
                  onPress={() => {
                    setIdeaSectionFilter('ALL');
                    setClientFilter('ALL');
                    setSearch('');
                  }}
                />
              </EmptyState>
            ) : (
              filtered.map((idea) => (
                <IdeaCard
                  key={idea.id}
                  idea={idea}
                  onEdit={() => setSheet({ kind: 'edit', idea })}
                  onDelete={() => setDeleteIdea(idea.id)}
                  onSendToPlan={() => sendToPlan(idea)}
                />
              ))
            )}
          </>
        )}
      </Screen>

      {sheet ? <IdeaSheet target={sheet} onClose={() => setSheet(null)} /> : null}
      <ConfirmDialog
        visible={Boolean(deleteIdea)}
        title="¿Eliminar esta idea?"
        confirmLabel="Sí, eliminar"
        danger
        onCancel={() => setDeleteIdea(null)}
        onConfirm={async () => {
          const id = deleteIdea;
          setDeleteIdea(null);
          if (id) await action(`/ideas/${id}`, { method: 'DELETE' }, 'Idea eliminada.');
        }}
      />
      <ConfirmDialog
        visible={deleteSection}
        title={`¿Eliminar la sección «${activeSection?.name || ''}»?`}
        lines={['También se eliminan sus ideas.']}
        confirmLabel="Sí, eliminar"
        danger
        onCancel={() => setDeleteSection(false)}
        onConfirm={async () => {
          setDeleteSection(false);
          if (!activeSection) return;
          const ok = await action(`/ideas/sections/${activeSection.id}`, { method: 'DELETE' }, 'Sección eliminada.');
          if (ok) setIdeaSectionFilter('ALL');
        }}
      />
    </>
  );
}
