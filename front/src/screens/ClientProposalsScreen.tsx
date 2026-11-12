/** Pantalla del cliente para proponerle ideas a su agencia y ver la respuesta de cada una. */
import React, { useState } from 'react';
import { Linking } from 'react-native';
import { Badge, Button, Card, Detail, Field, Input, LinkButton, Screen, ScreenHeader, T } from '../components/ui';
import { fmtDateTime, normalizeUrl } from '../lib/format';
import { useApiAction, useApp } from '../state/AppContext';

const STATUS = {
  PENDING: { label: 'ESPERANDO RESPUESTA', tone: 'review' },
  ACCEPTED: { label: 'ACEPTADA', tone: 'live' },
  REJECTED: { label: 'RECHAZADA', tone: 'fault' },
} as const;

/** Pantalla de propuestas del cliente. */
export function ClientProposalsScreen() {
  const app = useApp();
  const action = useApiAction();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [refUrl, setRefUrl] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!title.trim() || !content.trim()) {
      app.setBanner('Completá el título y contá de qué se trata tu idea.', true);
      return;
    }
    setBusy(true);
    const ok = await action(
      '/idea-proposals',
      { method: 'POST', body: { title: title.trim(), content: content.trim(), referenceUrl: normalizeUrl(refUrl) || undefined } },
      'Listo: le mandamos tu idea a la agencia.',
    );
    setBusy(false);
    if (ok) {
      setTitle('');
      setContent('');
      setRefUrl('');
    }
  };

  return (
    <Screen onRefresh={() => app.hydrate()} refreshing={app.loadingData}>
      <ScreenHeader title="Proponé ideas" badge={<Detail text="Contale a tu agencia qué te gustaría mostrar. La acepta, la ajusta o te responde que no." />} />
      <Card>
        <Field label="Título">
          <Input value={title} onChangeText={setTitle} maxLength={180} />
        </Field>
        <Field label="Desarrollo">
          <Input value={content} onChangeText={setContent} multiline maxLength={5000} style={{ minHeight: 110 }} />
        </Field>
        <Field label="Enlace (opcional)">
          <Input value={refUrl} onChangeText={setRefUrl} autoCapitalize="none" keyboardType="url" maxLength={500} />
        </Field>
        <Button title="Enviar" icon="send" variant="signal" busy={busy} onPress={submit} />
      </Card>

      <T variant="eyebrow">{`LAS QUE YA ENVIASTE (${app.ideaProposals.length})`}</T>
      {app.ideaProposals.length ? (
        app.ideaProposals.map((p) => (
          <Card key={p.id}>
            <Badge label={STATUS[p.status].label} tone={STATUS[p.status].tone} />
            <T variant="subtitle">{p.title}</T>
            <T variant="muted">{p.content}</T>
            {p.referenceUrl ? (
              <LinkButton
                title="Ver referencia"
                onPress={() => Linking.openURL(/^https?:\/\//i.test(p.referenceUrl!) ? p.referenceUrl! : `https://${p.referenceUrl}`).catch(() => {})}
              />
            ) : null}
            <T variant="mono">{fmtDateTime(p.createdAt)}</T>
          </Card>
        ))
      ) : (
        <T variant="small">Todavía no enviaste ideas.</T>
      )}
    </Screen>
  );
}
