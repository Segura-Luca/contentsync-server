/** Ventana obligatoria para las cuentas nuevas creadas con una red social: nombre, apellido y agencia. */
import React, { useState } from 'react';
import { Modal, ScrollView, View } from 'react-native';
import { apiFetch, friendlyError } from '../api/client';
import { Button, ErrorText, Field, Input, LinkButton, T } from '../components/ui';
import { useApp } from '../state/AppContext';
import { useTheme } from '../theme/theme';

/** Muestra la ventana solo a las cuentas que todavía tienen que completar sus datos. */
export function ProfileSetupSheet() {
  const { session } = useApp();
  if (!session?.needsProfileSetup) return null;
  return <ProfileSetupForm key={session.id} fullName={session.fullName} />;
}

/** Ventana para completar los datos. No se puede cerrar sin guardar (solo cerrando sesión). */
function ProfileSetupForm({ fullName }: { fullName: string }) {
  const app = useApp();
  const { colors } = useTheme();
  // Propone el nombre que vino de la red social.
  const [nameParts] = useState(() => String(fullName || '').trim().split(/\s+/));
  const [firstName, setFirstName] = useState(nameParts[0] || '');
  const [lastName, setLastName] = useState(nameParts.slice(1).join(' '));
  const [agencyName, setAgencyName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    const f = firstName.trim();
    const l = lastName.trim();
    const a = agencyName.trim();
    const problem = f.length < 2 ? 'Ingresá tu nombre.' : l.length < 2 ? 'Ingresá tu apellido.' : a.length < 2 ? 'Ingresá el nombre de tu agencia.' : '';
    if (problem) return setError(problem);
    setBusy(true);
    const r = await apiFetch('/auth/me/complete-profile', { method: 'POST', body: { firstName: f, lastName: l, agencyName: a } });
    setBusy(false);
    if (!r.ok) return setError(friendlyError(r.data, r.status));
    app.updateSession({ fullName: r.data.fullName, agencyName: r.data.agencyName, needsProfileSetup: false });
    await app.hydrate();
    app.setBanner('¡Listo! Tus datos quedaron guardados.');
  };

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={() => {}}>
      <View style={{ flex: 1, backgroundColor: colors.scrim, justifyContent: 'center', padding: 16 }}>
        <ScrollView
          style={{ flexGrow: 0, backgroundColor: colors.stage, borderRadius: 12, borderWidth: 1, borderColor: colors.hairline }}
          contentContainerStyle={{ padding: 20, gap: 14 }}
          keyboardShouldPersistTaps="handled"
        >
          <T variant="title">Completá tus datos</T>
          <Field label="Nombre">
            <Input value={firstName} onChangeText={setFirstName} maxLength={70} />
          </Field>
          <Field label="Apellido">
            <Input value={lastName} onChangeText={setLastName} maxLength={70} />
          </Field>
          <Field label="Nombre de la agencia">
            <Input value={agencyName} onChangeText={setAgencyName} maxLength={150} onSubmitEditing={submit} />
          </Field>
          <ErrorText message={error} />
          <Button title="Guardar" variant="signal" busy={busy} onPress={submit} />
          <View style={{ alignItems: 'center' }}>
            <LinkButton title="Cerrar sesión" onPress={() => app.logout()} />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}
