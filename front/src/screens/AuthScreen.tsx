/**
 * Pantalla de acceso: iniciar sesión, crear una cuenta de agencia, verificar el correo con un código
 * de 6 dígitos y recuperar o crear la contraseña.
 */
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { apiFetch, friendlyError } from '../api/client';
import { AuthResponse } from '../api/types';
import { BannerBar, TopBar } from '../components/TopBar';
import { Button, Card, Chip, ErrorText, Field, Input, LinkButton, T } from '../components/ui';
import { EMAIL, STRONG_PASSWORD } from '../lib/format';
import { useApp } from '../state/AppContext';
import { useTheme } from '../theme/theme';

type Mode = 'login' | 'register' | 'verify' | 'recover';
type RecoverKind = 'RESET' | 'CREATE';

const PASSWORD_RULE = 'La contraseña debe tener entre 8 y 64 caracteres, con mayúscula, minúscula, número y un símbolo.';

/** Los tres pasos que explican cómo funciona la plataforma. */
function HowItWorks() {
  const { colors } = useTheme();
  const steps = [
    ['1', 'La agencia arma el cronograma', 'Cada bloque dice qué es, de qué trata y lleva sus fotos o videos.'],
    ['2', 'El cliente lo revisa', 'Ve todo desde la app, comenta y pide cambios.'],
    ['3', 'El cliente confirma', 'La semana queda aprobada y todo queda registrado.'],
  ];
  return (
    <View style={{ gap: 10 }}>
      {steps.map(([n, title, text]) => (
        <View key={n} style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.signalSubtleBg }}>
            <T style={{ color: colors.signalSubtleFg, fontWeight: '700', fontSize: 12 }}>{n}</T>
          </View>
          <View style={{ flex: 1 }}>
            <T style={{ fontWeight: '600' }}>{title}</T>
            <T variant="small">{text}</T>
          </View>
        </View>
      ))}
    </View>
  );
}

/** Pantalla de acceso. */
export function AuthScreen() {
  const { config, applyServerSession, setBanner } = useApp();
  const { colors } = useTheme();
  const registrationEnabled = config.registrationEnabled !== false;
  const sender = config.senderEmail ? ` desde ${config.senderEmail}` : '';

  const [mode, setMode] = useState<Mode>('login');
  const [recoverKind, setRecoverKind] = useState<RecoverKind>('RESET');
  const [recoverStep, setRecoverStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [agencyName, setAgencyName] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const go = (next: Mode) => {
    setError('');
    setMode(next);
  };

  /** Ejecuta un paso con el indicador de carga y el manejo de error en común. */
  const run = async (step: () => Promise<void>) => {
    if (busy) return;
    setError('');
    setBusy(true);
    try {
      await step();
    } finally {
      setBusy(false);
    }
  };

  const enter = async (data: AuthResponse, welcome?: string) => {
    setPassword('');
    setNewPassword('');
    setCode('');
    await applyServerSession(data, welcome);
  };

  const login = () =>
    run(async () => {
      const mail = email.trim();
      if (!EMAIL.test(mail)) return setError('Ingresá un correo electrónico válido.');
      const r = await apiFetch('/auth/login', { method: 'POST', body: { email: mail, password: password || undefined, deviceInfo: 'App Android' } });
      if (r.ok && r.data?.requiresPasswordCreation) {
        setEmail(r.data.email || mail);
        setRecoverKind('CREATE');
        setRecoverStep(2);
        setCode('');
        setMode('recover');
        setBanner(r.data.message || 'Te enviamos un código de 6 dígitos para comprobar tu identidad y crear tu contraseña.');
        return;
      }
      if (r.ok && r.data?.requiresEmailVerification) {
        setEmail(r.data.email || mail);
        setCode('');
        setMode('verify');
        setBanner(r.data.message || 'Te enviamos un código de 6 dígitos para verificar tu correo.');
        return;
      }
      if (r.ok && r.data?.accessToken) return enter(r.data);
      setError(friendlyError(r.data, r.status));
    });

  const register = () =>
    run(async () => {
      const mail = email.trim();
      if (firstName.trim().length < 2) return setError('Ingresá tu nombre.');
      if (lastName.trim().length < 2) return setError('Ingresá tu apellido.');
      if (agencyName.trim().length < 2) return setError('Ingresá el nombre de tu agencia.');
      if (!EMAIL.test(mail)) return setError('Ingresá un correo electrónico válido.');
      if (!STRONG_PASSWORD.test(password)) return setError(PASSWORD_RULE);
      const r = await apiFetch('/auth/register', {
        method: 'POST',
        body: {
          email: mail,
          password,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          fullName: `${firstName.trim()} ${lastName.trim()}`,
          agencyName: agencyName.trim(),
        },
      });
      if (r.ok && r.data?.requiresEmailVerification) {
        setCode('');
        setMode('verify');
        setBanner(r.data.message || `Enviamos un código de 6 dígitos${sender} a ${mail}. Ingresalo para verificar tu cuenta.`);
        return;
      }
      if (r.ok && r.data?.accessToken) return enter(r.data, `Agencia creada con éxito. ¡Bienvenido/a, ${firstName.trim()}!`);
      setError(friendlyError(r.data, r.status));
    });

  const verifyRegistration = () =>
    run(async () => {
      if (!/^\d{6}$/.test(code)) return setError('Ingresá el código numérico de 6 dígitos que enviamos a tu correo.');
      const r = await apiFetch('/auth/verify-registration', { method: 'POST', body: { email: email.trim(), code } });
      if (r.ok && r.data?.accessToken) return enter(r.data, '¡Correo verificado con éxito! Tu agencia ya está activa.');
      setError(friendlyError(r.data, r.status));
    });

  const requestRecoveryCode = () =>
    run(async () => {
      const mail = email.trim();
      if (!EMAIL.test(mail)) return setError('Ingresá un correo electrónico válido.');
      const r = await apiFetch('/auth/forgot-password', { method: 'POST', body: { email: mail } });
      if (!r.ok) return setError(friendlyError(r.data, r.status));
      setCode('');
      setRecoverStep(2);
    });

  const verifyRecoveryCode = () =>
    run(async () => {
      if (!/^\d{6}$/.test(code)) return setError('Ingresá el código numérico de 6 dígitos que enviamos a tu correo.');
      const r = await apiFetch('/auth/verify-otp', { method: 'POST', body: { email: email.trim(), code } });
      if (r.ok && r.data?.verified) {
        setNewPassword('');
        setRecoverStep(3);
        return;
      }
      setError(friendlyError(r.data, r.status));
    });

  const savePassword = () =>
    run(async () => {
      if (!STRONG_PASSWORD.test(newPassword)) return setError(PASSWORD_RULE);
      const r = await apiFetch('/auth/reset-password', { method: 'POST', body: { email: email.trim(), token: code, newPassword } });
      if (!r.ok) return setError(friendlyError(r.data, r.status));
      setMode('login');
      setRecoverStep(1);
      if (r.data?.session?.accessToken) {
        await enter(r.data.session, r.data.message || '¡Contraseña guardada! Ya podés iniciar sesión con tu correo y tu clave.');
        return;
      }
      setBanner(r.data?.message || '¡Contraseña guardada! Ya podés iniciar sesión con tu clave.');
    });

  const codeInput = (onSubmit: () => void) => (
    <Field label="Código de 6 dígitos">
      <Input
        value={code}
        onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        maxLength={6}
        onSubmitEditing={onSubmit}
        style={{ fontSize: 22, letterSpacing: 6, textAlign: 'center' }}
      />
    </Field>
  );

  let content: React.ReactNode;
  if (mode === 'verify') {
    content = (
      <>
        <T variant="subtitle">Verificá tu correo</T>
        <T variant="muted">
          Enviamos un código de 6 dígitos{sender} a <T style={{ fontWeight: '700' }}>{email}</T> para comprobar que ese correo te pertenece.
        </T>
        {codeInput(verifyRegistration)}
        <ErrorText message={error} />
        <Button title="Verificar correo y activar mi cuenta" variant="signal" busy={busy} onPress={verifyRegistration} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <LinkButton title="Reenviar código" onPress={register} />
          <LinkButton title="Cambiar correo" onPress={() => go('register')} />
        </View>
      </>
    );
  } else if (mode === 'recover') {
    const isCreate = recoverKind === 'CREATE';
    const stepLabel = `PASO ${recoverStep} DE 3`;
    if (recoverStep === 1) {
      content = (
        <>
          <T variant="eyebrow">{stepLabel}</T>
          <T variant="subtitle">{isCreate ? 'Crear contraseña' : 'Recuperar contraseña'}</T>
          <T variant="muted">
            {isCreate
              ? `Tu cuenta todavía no tiene contraseña propia. Ingresá tu correo y te enviamos un código de 6 dígitos${sender} para crearla.`
              : `Ingresá tu correo y te enviamos un código de verificación de 6 dígitos${sender}.`}
          </T>
          <Field label="Correo electrónico">
            <Input value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" onSubmitEditing={requestRecoveryCode} />
          </Field>
          <ErrorText message={error} />
          <Button title="Enviar código" variant="signal" busy={busy} onPress={requestRecoveryCode} />
          <LinkButton title="Volver a iniciar sesión" onPress={() => go('login')} />
        </>
      );
    } else if (recoverStep === 2) {
      content = (
        <>
          <T variant="eyebrow">{stepLabel}</T>
          <T variant="subtitle">Comprobá tu identidad</T>
          <T variant="muted">
            Enviamos un código de 6 dígitos{sender} a <T style={{ fontWeight: '700' }}>{email}</T>.
          </T>
          {codeInput(verifyRecoveryCode)}
          <ErrorText message={error} />
          <Button title="Verificar código" variant="signal" busy={busy} onPress={verifyRecoveryCode} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <LinkButton title="Reenviar código" onPress={requestRecoveryCode} />
            <LinkButton title="Cancelar" onPress={() => go('login')} />
          </View>
        </>
      );
    } else {
      content = (
        <>
          <T variant="eyebrow" style={{ color: colors.live }}>{stepLabel}</T>
          <T variant="subtitle">Creá tu nueva contraseña</T>
          <T variant="muted">Identidad comprobada para {email}. Esta será la contraseña para entrar con tu correo.</T>
          <Field label="Nueva contraseña">
            <Input value={newPassword} onChangeText={setNewPassword} secureTextEntry autoComplete="new-password" onSubmitEditing={savePassword} />
          </Field>
          <T variant="small">{PASSWORD_RULE}</T>
          <ErrorText message={error} />
          <Button title="Guardar contraseña e ingresar" variant="signal" busy={busy} onPress={savePassword} />
          <LinkButton title="Cancelar" onPress={() => go('login')} />
        </>
      );
    }
  } else {
    const registering = mode === 'register' && registrationEnabled;
    content = (
      <>
        {registrationEnabled ? (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Chip label="Iniciar sesión" active={!registering} onPress={() => go('login')} />
            <Chip label="Crear cuenta" active={registering} onPress={() => go('register')} />
          </View>
        ) : (
          <T variant="subtitle">Iniciar sesión</T>
        )}
        {registering ? (
          <>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Field label="Nombre" style={{ flex: 1 }}>
                <Input value={firstName} onChangeText={setFirstName} autoComplete="given-name" />
              </Field>
              <Field label="Apellido" style={{ flex: 1 }}>
                <Input value={lastName} onChangeText={setLastName} autoComplete="family-name" />
              </Field>
            </View>
            <Field label="Nombre de la agencia">
              <Input value={agencyName} onChangeText={setAgencyName} />
            </Field>
          </>
        ) : null}
        <Field label="Correo electrónico">
          <Input value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
        </Field>
        <Field label="Contraseña">
          <Input
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete={registering ? 'new-password' : 'current-password'}
            onSubmitEditing={registering ? register : login}
          />
        </Field>
        {registering ? <T variant="small">{PASSWORD_RULE}</T> : null}
        <ErrorText message={error} />
        <Button title={registering ? 'Crear cuenta' : 'Ingresar'} variant="signal" busy={busy} onPress={registering ? register : login} />
        {registering ? null : (
          <View style={{ gap: 12 }}>
            <LinkButton
              title="Olvidé mi contraseña"
              onPress={() => {
                setRecoverKind('RESET');
                setRecoverStep(1);
                go('recover');
              }}
            />
            <LinkButton
              title="¿Entraste con Google, Facebook o GitHub? Creá una contraseña"
              onPress={() => {
                setRecoverKind('CREATE');
                setRecoverStep(1);
                go('recover');
              }}
            />
          </View>
        )}
      </>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <TopBar />
      <BannerBar />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <View style={{ gap: 10 }}>
            <T variant="title" style={{ fontSize: 26 }}>Tu agencia y tus clientes, en un solo lugar.</T>
            <T variant="muted">Compartí el cronograma de cada semana, mostrá cada pieza y recibí comentarios y aprobaciones sin perderte entre chats.</T>
          </View>
          <Card style={{ gap: 14 }}>{content}</Card>
          <HowItWorks />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
