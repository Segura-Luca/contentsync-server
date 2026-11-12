/**
 * Clientes de la agencia: invitar una marca nueva (queda pendiente hasta que el cliente confirme
 * "Sí, soy yo"), reenviar la invitación, ver su cronograma o eliminarlo.
 */
import React, { useState } from 'react';
import { View } from 'react-native';
import { apiFetch, friendlyError } from '../api/client';
import { Client } from '../api/types';
import { Button, Card, ConfirmDialog, Detail, EmptyState, Field, IconButton, Input, Screen, ScreenHeader, T } from '../components/ui';
import { EMAIL } from '../lib/format';
import { useApiAction, useApp } from '../state/AppContext';
import { useTheme } from '../theme/theme';

/** Formulario para invitar a un cliente nuevo. */
function NewClientForm({ onDone }: { onDone: () => void }) {
  const { hydrate, setBanner } = useApp();
  const { colors } = useTheme();
  const [companyName, setCompanyName] = useState('');
  const [industry, setIndustry] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const company = companyName.trim();
    const mail = email.trim();
    if (!company) return setBanner('Ingresá el nombre de la empresa o marca.', true);
    if (!EMAIL.test(mail)) return setBanner('Ingresá un correo electrónico válido para el cliente.', true);
    setBusy(true);
    const r = await apiFetch('/clients', {
      method: 'POST',
      body: { companyName: company, industry: industry.trim(), fullName: fullName.trim() || 'Responsable de Marca', email: mail },
    });
    setBusy(false);
    if (!r.ok) return setBanner(friendlyError(r.data, r.status), true);
    onDone();
    await hydrate();
    if (r.data?.emailSent === false) {
      setBanner(`Creamos el perfil de "${company}", pero no pudimos enviar el correo a ${mail}. Probá con "Reenviar" en unos minutos.`, true);
      return;
    }
    setBanner(`Solicitud enviada a ${mail}. El perfil de "${company}" se activa cuando el cliente presione "Sí, soy yo".`);
  };

  return (
    <Card style={{ borderColor: colors.borderStrong }}>
      <T variant="subtitle">Nuevo cliente</T>
      <Detail text="Le enviamos un aviso y un correo a esa dirección. El perfil queda pendiente hasta que el titular presione «Sí, soy yo», para que nadie cree perfiles con correos ajenos." />
      <Field label="Empresa / marca">
        <Input value={companyName} onChangeText={setCompanyName} />
      </Field>
      <Field label="Rubro">
        <Input value={industry} onChangeText={setIndustry} />
      </Field>
      <Field label="Nombre del responsable">
        <Input value={fullName} onChangeText={setFullName} autoComplete="name" />
      </Field>
      <Field label="Correo del cliente">
        <Input value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      </Field>
      <Button title="Invitar" variant="signal" busy={busy} onPress={submit} />
    </Card>
  );
}

/** Pantalla de clientes. */
export function ClientsScreen() {
  const app = useApp();
  const { clients, loadingData } = app;
  const { colors } = useTheme();
  const action = useApiAction();
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<Client | null>(null);
  const active = clients.filter((c) => c.confirmationStatus === 'CONFIRMED');
  const pending = clients.filter((c) => c.confirmationStatus !== 'CONFIRMED');

  const resend = async (clientId: string) => {
    const r = await apiFetch(`/clients/${clientId}/resend-confirmation`, { method: 'POST' });
    if (!r.ok) return app.setBanner(friendlyError(r.data, r.status), true);
    if (r.data?.emailSent === false) return app.setBanner('No pudimos enviar el correo de confirmación. Probá de nuevo en unos minutos.', true);
    app.setBanner('Reenviamos el aviso y el correo «Sí, soy yo» al cliente.');
  };

  return (
    <>
      <Screen onRefresh={() => app.hydrate()} refreshing={loadingData}>
        <ScreenHeader
          title="Clientes"
          actions={
            formOpen ? (
              <IconButton icon="x" label="Cerrar" onPress={() => setFormOpen(false)} size={46} />
            ) : (
              <Button title="Cliente" icon="user-plus" variant="signal" onPress={() => setFormOpen(true)} />
            )
          }
        />
        {formOpen ? <NewClientForm onDone={() => setFormOpen(false)} /> : null}

        {pending.length ? (
          <View style={{ gap: 10 }}>
            <T variant="eyebrow">{`POR CONFIRMAR (${pending.length})`}</T>
            <Detail text="Se activan cuando presionan «Sí, soy yo»." />
            {pending.map((c) => (
              <Card key={c.id} style={{ borderColor: colors.warn }}>
                <T variant="subtitle">{c.companyName}</T>
                <T variant="small">{`${c.contactFullName} · ${c.contactEmail}`}</T>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <IconButton icon="mail" label="Reenviar confirmación" variant="warn" onPress={() => resend(c.id)} />
                  <IconButton icon="trash-2" label="Eliminar" variant="fault" onPress={() => setDeleting(c)} />
                </View>
              </Card>
            ))}
          </View>
        ) : null}

        <View style={{ gap: 10 }}>
          <T variant="eyebrow">{`ACTIVOS (${active.length})`}</T>
          {active.length ? (
            active.map((c) => (
              <Card key={c.id}>
                <T variant="eyebrow">{`${c.industry} · ${c.agencyName}`.toUpperCase()}</T>
                <T variant="subtitle">{c.companyName}</T>
                <T variant="muted">{`Contacto: ${c.contactFullName} (${c.contactEmail})`}</T>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <IconButton
                    icon="calendar"
                    label="Ver cronograma"
                    onPress={() => {
                      app.selectClient(c.id);
                      app.goToTab('schedules');
                    }}
                  />
                  <IconButton icon="trash-2" label="Eliminar" variant="fault" onPress={() => setDeleting(c)} />
                </View>
              </Card>
            ))
          ) : (
            <EmptyState title="Todavía no hay clientes activos" />
          )}
        </View>
      </Screen>

      <ConfirmDialog
        visible={Boolean(deleting)}
        title={`¿Eliminar a ${deleting?.companyName || 'este cliente'}?`}
        lines={['Se borran su acceso, sus cronogramas, fotos y videos. No se puede deshacer.']}
        confirmLabel="Sí, eliminar"
        danger
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          const id = deleting?.id;
          setDeleting(null);
          if (id) await action(`/clients/${id}`, { method: 'DELETE' }, 'Cliente eliminado correctamente.');
        }}
      />
    </>
  );
}
