/**
 * Ajustes: datos de la sesión, perfil, contraseña, apariencia, configuración de la plataforma
 * (solo el administrador), cerrar sesión y eliminar la cuenta.
 */
import React, { useEffect, useState } from 'react';
import { Switch, View } from 'react-native';
import { apiFetch, friendlyError } from '../api/client';
import { PlatformIntegrations, PlatformSettings } from '../api/types';
import { Button, Card, ErrorText, Field, IconButton, InfoRow, Input, Screen, ScreenHeader, Sheet, T } from '../components/ui';
import { STRONG_PASSWORD } from '../lib/format';
import { useApp } from '../state/AppContext';
import { useTheme } from '../theme/theme';

/** Ventana para cambiar la contraseña, o crearla si la cuenta entró solo con una red social. */
function ChangePasswordSheet({ hasPassword, onClose }: { hasPassword: boolean; onClose: () => void }) {
  const { applyServerSession } = useApp();
  // Se monta solo mientras está abierta: al cerrarla, lo escrito se olvida.
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    if (hasPassword && !current) return setError('Ingresá tu contraseña actual.');
    if (!STRONG_PASSWORD.test(next)) return setError('La nueva contraseña debe tener entre 8 y 64 caracteres, con mayúscula, minúscula, número y un símbolo.');
    if (next !== repeat) return setError('Las contraseñas nuevas no coinciden.');
    setBusy(true);
    const r = await apiFetch('/auth/me/change-password', {
      method: 'POST',
      body: { ...(hasPassword ? { currentPassword: current } : {}), newPassword: next },
    });
    setBusy(false);
    if (!r.ok) return setError(friendlyError(r.data, r.status));
    onClose();
    // El servidor cierra las otras sesiones y abre una nueva en este teléfono.
    await applyServerSession(r.data.session, r.data.message);
  };

  return (
    <Sheet
      visible
      title={hasPassword ? 'Cambiar contraseña' : 'Crear contraseña'}
      onClose={() => !busy && onClose()}
      footer={
        <>
          <IconButton icon="x" label="Cancelar" onPress={onClose} disabled={busy} size={46} />
          <Button title="Guardar" variant="signal" busy={busy} onPress={submit} style={{ flex: 1 }} />
        </>
      }
    >
      {hasPassword ? (
        <Field label="Contraseña actual">
          <Input value={current} onChangeText={setCurrent} secureTextEntry autoComplete="current-password" maxLength={128} />
        </Field>
      ) : null}
      <Field label="Nueva contraseña">
        <Input value={next} onChangeText={setNext} secureTextEntry autoComplete="new-password" maxLength={128} />
      </Field>
      <Field label="Repetí la nueva contraseña">
        <Input value={repeat} onChangeText={setRepeat} secureTextEntry autoComplete="new-password" maxLength={128} onSubmitEditing={submit} />
      </Field>
      <T variant="small">Entre 8 y 64 caracteres, con mayúscula, minúscula, número y un símbolo. Se cierra la sesión en tus otros dispositivos.</T>
      <ErrorText message={error} />
    </Sheet>
  );
}

/** Ventana para eliminar la cuenta propia. */
function DeleteAccountSheet({ hasPassword, onClose }: { hasPassword: boolean; onClose: () => void }) {
  const { session, clients, logout } = useApp();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const isAgency = session?.role === 'AGENCIA';
  const consequence = isAgency
    ? clients.length === 1
      ? 'Se eliminan tu agencia, tu cliente con su acceso, sus cronogramas, fotos y videos.'
      : `Se eliminan tu agencia, tus ${clients.length} clientes con sus accesos, sus cronogramas, fotos y videos.`
    : 'Se eliminan tu acceso, tus cronogramas, fotos y videos.';

  const submit = async () => {
    if (busy) return;
    if (confirmation.trim() !== 'ELIMINAR') return setError('Escribí ELIMINAR para confirmar.');
    if (hasPassword && !password) return setError('Ingresá tu contraseña.');
    setBusy(true);
    const r = await apiFetch('/auth/me/delete', {
      method: 'POST',
      body: { confirmation: 'ELIMINAR', ...(hasPassword ? { password } : {}) },
    });
    setBusy(false);
    if (!r.ok) return setError(friendlyError(r.data, r.status));
    onClose();
    await logout('Tu cuenta se eliminó correctamente.');
  };

  return (
    <Sheet
      visible
      title="¿Eliminar tu cuenta definitivamente?"
      onClose={() => !busy && onClose()}
      footer={
        <>
          <IconButton icon="x" label="Cancelar" onPress={onClose} disabled={busy} size={46} />
          <Button title="Eliminar cuenta" variant="fault" busy={busy} onPress={submit} style={{ flex: 1 }} />
        </>
      }
    >
      <T>{consequence}</T>
      <T variant="muted">No se puede deshacer.</T>
      {hasPassword ? (
        <Field label="Tu contraseña">
          <Input value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" maxLength={128} />
        </Field>
      ) : null}
      <Field label="Escribí ELIMINAR para confirmar">
        <Input value={confirmation} onChangeText={setConfirmation} autoCapitalize="characters" maxLength={20} />
      </Field>
      <ErrorText message={error} />
    </Sheet>
  );
}

/** Configuración de la plataforma. Solo la ve el administrador. Carga los valores actuales al abrir la pantalla. */
function PlatformSettingsPanel() {
  const { platformSettings: s, platformIntegrations: i, setPlatform } = useApp();

  useEffect(() => {
    apiFetch('/settings').then((r) => {
      if (r.ok) setPlatform(r.data.settings, r.data.integrations);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!s || !i) {
    return (
      <Card>
        <T variant="small">Cargando configuración de la plataforma…</T>
      </Card>
    );
  }
  // Al guardar llegan valores nuevos: el formulario se vuelve a montar con ellos.
  return <PlatformSettingsForm key={JSON.stringify(s)} s={s} i={i} />;
}

/** Formulario de la configuración de la plataforma. */
function PlatformSettingsForm({ s, i }: { s: PlatformSettings; i: PlatformIntegrations }) {
  const { setPlatform, setBanner } = useApp();
  const { colors } = useTheme();
  const [form, setForm] = useState<Record<string, string>>(() => ({
    appName: s.appName,
    otpTtlMinutes: String(s.otpTtlMinutes),
    otpMaxAttempts: String(s.otpMaxAttempts),
    otpResendCooldownSeconds: String(s.otpResendCooldownSeconds),
    clientInviteTtlHours: String(s.clientInviteTtlHours),
  }));
  const [registration, setRegistration] = useState(s.registrationEnabled);
  const [askReset, setAskReset] = useState(false);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    const r = await apiFetch('/settings', {
      method: 'PATCH',
      body: {
        appName: (form.appName || '').trim(),
        registrationEnabled: registration,
        otpTtlMinutes: Number(form.otpTtlMinutes),
        otpMaxAttempts: Number(form.otpMaxAttempts),
        otpResendCooldownSeconds: Number(form.otpResendCooldownSeconds),
        clientInviteTtlHours: Number(form.clientInviteTtlHours),
      },
    });
    setBusy(false);
    if (!r.ok) return setBanner(friendlyError(r.data, r.status), true);
    setPlatform(r.data.settings, r.data.integrations);
    setBanner('Ajustes guardados: ya están activos, sin reiniciar el servidor.');
  };

  const reset = async () => {
    setAskReset(false);
    const r = await apiFetch('/settings', { method: 'DELETE' });
    if (!r.ok) return setBanner(friendlyError(r.data, r.status), true);
    setPlatform(r.data.settings, r.data.integrations);
    setBanner('Ajustes restablecidos a los valores de fábrica.');
  };

  const numberField = (key: string, label: string) => (
    <Field label={label}>
      <Input value={form[key]} onChangeText={(v) => setForm((f) => ({ ...f, [key]: v.replace(/\D/g, '') }))} keyboardType="number-pad" />
    </Field>
  );
  const status = (label: string, on: boolean) => <InfoRow label={label} value={on ? 'CONFIGURADO' : 'SIN CONFIGURAR'} valueColor={on ? colors.live : colors.textMuted} />;

  return (
    <Card>
      <T variant="eyebrow">CONFIGURACIÓN DE LA PLATAFORMA</T>
      <T variant="small">Se aplica a todas las agencias, sin reiniciar el servidor.</T>
      <Field label="Nombre de la aplicación">
        <Input value={form.appName} onChangeText={(v) => setForm((f) => ({ ...f, appName: v }))} maxLength={60} />
      </Field>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <T style={{ flex: 1 }}>Permitir el registro de nuevas agencias</T>
        <Switch value={registration} onValueChange={setRegistration} trackColor={{ true: colors.signal, false: colors.hairline }} />
      </View>
      <T variant="eyebrow">SEGURIDAD</T>
      {numberField('otpTtlMinutes', 'Vigencia del código (minutos)')}
      {numberField('otpMaxAttempts', 'Intentos por código')}
      {numberField('otpResendCooldownSeconds', 'Espera para reenviar (segundos)')}
      {numberField('clientInviteTtlHours', 'Vigencia de invitaciones (horas)')}
      <Button title="Guardar ajustes" variant="signal" busy={busy} onPress={save} />
      {askReset ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button title="Sí, restablecer" variant="fault" onPress={reset} style={{ flex: 1 }} />
          <IconButton icon="x" label="Cancelar" onPress={() => setAskReset(false)} size={46} />
        </View>
      ) : (
        <Button title="Restablecer valores de fábrica" onPress={() => setAskReset(true)} />
      )}
      <View style={{ borderTopWidth: 1, borderTopColor: colors.hairline, paddingTop: 12, gap: 6 }}>
        <T variant="eyebrow">INTEGRACIONES (VARIABLES DE ENTORNO)</T>
        <InfoRow label="BASE DE DATOS" value={i.database} />
        <InfoRow label="URL PÚBLICA" value={i.publicUrl} />
        <InfoRow label="REMITENTE" value={i.mail.senderAddress || 'sin definir'} />
        {status('CORREO · N8N', i.mail.n8n)}
        {status('CORREO · RELAY HTTPS', i.mail.httpsRelay)}
        {status('CORREO · SMTP', i.mail.smtp)}
        {status('ACCESO · GOOGLE', i.login.google)}
        {status('ACCESO · FACEBOOK', i.login.facebook)}
        {status('ACCESO · GITHUB', i.login.github)}
        {status('ARCHIVOS · S3', i.storage === 'S3')}
      </View>
    </Card>
  );
}

/** Pantalla de ajustes. */
export function SettingsScreen() {
  const app = useApp();
  const { session } = app;
  const { name: themeName, setTheme } = useTheme();
  const [fullName, setFullName] = useState(session?.fullName || '');
  const [agencyName, setAgencyName] = useState(session?.agencyName || '');
  const [hasPassword, setHasPassword] = useState(true);
  const [sheet, setSheet] = useState<'password' | 'delete' | null>(null);
  const [saving, setSaving] = useState(false);

  if (!session) return null;
  const isAgency = session.role === 'AGENCIA';

  const saveProfile = async () => {
    const name = fullName.trim();
    const agency = agencyName.trim();
    if (!name) return app.setBanner('Ingresá tu nombre.', true);
    if (isAgency && !agency) return app.setBanner('Ingresá el nombre de tu agencia.', true);
    setSaving(true);
    const r = await apiFetch('/auth/me', { method: 'PATCH', body: { fullName: name, ...(isAgency ? { agencyName: agency } : {}) } });
    setSaving(false);
    if (!r.ok) return app.setBanner(friendlyError(r.data, r.status), true);
    app.updateSession({ fullName: r.data.fullName, ...(isAgency ? { agencyName: r.data.agencyName || agency } : {}) });
    app.setBanner('Perfil actualizado.');
  };

  /** Antes de abrir la ventana, pregunta si la cuenta tiene contraseña: cambia lo que se pide. */
  const openSheet = async (kind: 'password' | 'delete') => {
    const me = await apiFetch('/auth/me');
    if (!me.ok) return app.setBanner(friendlyError(me.data, me.status), true);
    setHasPassword(Boolean(me.data.hasPassword));
    setSheet(kind);
  };

  return (
    <>
      <Screen>
        <ScreenHeader title="Ajustes" />
        <Card>
          <T variant="eyebrow">DATOS DE SESIÓN</T>
          <T variant="subtitle">{session.fullName}</T>
          <InfoRow label="CORREO" value={session.email} />
          <InfoRow label="ROL" value={session.role} />
        </Card>

        <Card>
          <T variant="eyebrow">PERFIL</T>
          <Field label="Nombre visible">
            <Input value={fullName} onChangeText={setFullName} maxLength={150} />
          </Field>
          {isAgency ? (
            <Field label="Nombre de la agencia">
              <Input value={agencyName} onChangeText={setAgencyName} maxLength={150} />
            </Field>
          ) : null}
          <Button title="Guardar perfil" busy={saving} onPress={saveProfile} />
        </Card>

        <Card>
          <T variant="eyebrow">SEGURIDAD</T>
          <Button title="Cambiar contraseña" icon="lock" onPress={() => openSheet('password')} />
        </Card>

        {session.role === 'ADMIN_GENERAL' ? <PlatformSettingsPanel /> : null}

        <Card>
          <T variant="eyebrow">APARIENCIA</T>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button title="Oscuro" icon="moon" variant={themeName === 'dark' ? 'signal' : 'outline'} onPress={() => setTheme('dark')} style={{ flex: 1 }} />
            <Button title="Claro" icon="sun" variant={themeName === 'light' ? 'signal' : 'outline'} onPress={() => setTheme('light')} style={{ flex: 1 }} />
          </View>
        </Card>

        <Button title="Cerrar sesión" icon="log-out" variant="fault" onPress={() => app.logout()} />

        {session.role !== 'ADMIN_GENERAL' ? (
          <Card>
            <T variant="eyebrow">ZONA DE RIESGO</T>
            <T variant="small">Eliminar tu cuenta borra tus datos y no se puede deshacer.</T>
            <Button title="Eliminar cuenta" variant="fault" onPress={() => openSheet('delete')} />
          </Card>
        ) : null}
      </Screen>

      {sheet === 'password' ? <ChangePasswordSheet hasPassword={hasPassword} onClose={() => setSheet(null)} /> : null}
      {sheet === 'delete' ? <DeleteAccountSheet hasPassword={hasPassword} onClose={() => setSheet(null)} /> : null}
    </>
  );
}
