/** Componentes visuales que comparten todas las pantallas: botones, campos, tarjetas y ventanas. */
import React from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleProp,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { monoFont, useTheme } from '../theme/theme';

export type IconName = React.ComponentProps<typeof Feather>['name'];
type Tone = 'live' | 'warn' | 'fault' | 'review' | 'neutral';

/** Colores de texto, fondo y borde de cada tono. */
function useTone(tone: Tone) {
  const { colors } = useTheme();
  switch (tone) {
    case 'live':
      return { fg: colors.live, bg: colors.liveBg, border: colors.live };
    case 'warn':
      return { fg: colors.warn, bg: colors.warnBg, border: colors.warn };
    case 'fault':
      return { fg: colors.fault, bg: colors.faultBg, border: colors.fault };
    case 'review':
      return { fg: colors.signalSubtleFg, bg: colors.signalSubtleBg, border: colors.signalSubtleFg };
    default:
      return { fg: colors.textSecondary, bg: colors.inspector, border: colors.hairline };
  }
}

/** Texto con el color del tema. */
export function T({
  children,
  variant = 'body',
  style,
  numberOfLines,
}: {
  children: React.ReactNode;
  variant?: 'title' | 'subtitle' | 'body' | 'muted' | 'small' | 'eyebrow' | 'mono';
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  const { colors } = useTheme();
  const base: Record<string, TextStyle> = {
    title: { fontSize: 22, fontWeight: '700', color: colors.textPrimary },
    subtitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
    body: { fontSize: 15, color: colors.textPrimary, lineHeight: 21 },
    muted: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
    small: { fontSize: 12.5, color: colors.textMuted, lineHeight: 17 },
    eyebrow: { fontSize: 11.5, fontWeight: '700', letterSpacing: 0.8, color: colors.textMuted, fontFamily: monoFont },
    mono: { fontSize: 12.5, color: colors.textMuted, fontFamily: monoFont },
  };
  return (
    <Text style={[base[variant], style]} numberOfLines={numberOfLines}>
      {children}
    </Text>
  );
}

/** Botón. Variantes: signal (principal), outline, fault (peligro) y warn (atención). */
export function Button({
  title,
  onPress,
  variant = 'outline',
  icon,
  disabled,
  busy,
  small,
  style,
}: {
  title: string;
  onPress?: () => void;
  variant?: 'signal' | 'outline' | 'fault' | 'warn';
  icon?: IconName;
  disabled?: boolean;
  busy?: boolean;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const palette = {
    signal: { bg: colors.signal, fg: colors.onSignal, border: colors.signal },
    outline: { bg: 'transparent', fg: colors.textPrimary, border: colors.borderStrong },
    fault: { bg: colors.faultBg, fg: colors.fault, border: colors.fault },
    warn: { bg: colors.warnBg, fg: colors.warn, border: colors.warn },
  }[variant];
  const off = disabled || busy;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(off) }}
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => [
        {
          minHeight: small ? 36 : 46,
          paddingHorizontal: small ? 12 : 16,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: palette.border,
          backgroundColor: palette.bg,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          opacity: off ? 0.55 : pressed ? 0.8 : 1,
        },
        style,
      ]}
    >
      {busy ? <ActivityIndicator size="small" color={palette.fg} /> : icon ? <Feather name={icon} size={small ? 15 : 17} color={palette.fg} /> : null}
      <Text style={{ color: palette.fg, fontWeight: '700', fontSize: small ? 13 : 14.5 }}>{title}</Text>
    </Pressable>
  );
}

/** Botón de texto, sin borde. */
export function LinkButton({ title, onPress, style }: { title: string; onPress: () => void; style?: StyleProp<TextStyle> }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button">
      <Text style={[{ color: colors.signalSubtleFg, fontSize: 14, fontWeight: '600' }, style]}>{title}</Text>
    </Pressable>
  );
}

/**
 * Botón con solo un ícono, para las acciones que se entienden sin leer (cerrar, editar, eliminar...).
 * `label` no se ve: lo lee el lector de pantalla y aparece al mantener presionado.
 */
export function IconButton({
  icon,
  onPress,
  label,
  disabled,
  variant = 'outline',
  size = 44,
}: {
  icon: IconName;
  onPress: () => void;
  label: string;
  disabled?: boolean;
  variant?: 'signal' | 'outline' | 'fault' | 'warn';
  size?: number;
}) {
  const { colors } = useTheme();
  const palette = {
    signal: { bg: colors.signal, fg: colors.onSignal, border: colors.signal },
    outline: { bg: 'transparent', fg: colors.textPrimary, border: colors.borderStrong },
    fault: { bg: colors.faultBg, fg: colors.fault, border: colors.fault },
    warn: { bg: colors.warnBg, fg: colors.warn, border: colors.warn },
  }[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      hitSlop={6}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: palette.border,
        backgroundColor: palette.bg,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
      })}
    >
      <Feather name={icon} size={19} color={palette.fg} />
    </Pressable>
  );
}

/** Campo con su etiqueta arriba. */
export function Field({ label, children, style }: { label: string; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ gap: 6 }, style]}>
      <T variant="eyebrow">{label.toUpperCase()}</T>
      {children}
    </View>
  );
}

/** Campo de texto con los colores del tema. */
export function Input({ style, multiline, ...props }: TextInputProps) {
  const { colors } = useTheme();
  return (
    <TextInput
      placeholderTextColor={colors.textMuted}
      selectionColor={colors.signal}
      multiline={multiline}
      {...props}
      style={[
        {
          borderWidth: 1,
          borderColor: colors.borderStrong,
          backgroundColor: colors.canvas,
          color: colors.textPrimary,
          borderRadius: 8,
          paddingHorizontal: 12,
          paddingVertical: 10,
          fontSize: 15,
          minHeight: multiline ? 88 : 46,
          textAlignVertical: multiline ? 'top' : 'center',
        },
        style,
      ]}
    />
  );
}

/** Etiqueta pequeña de estado. */
export function Badge({ label, tone = 'neutral', color }: { label: string; tone?: Tone; color?: { fg: string; bg: string } }) {
  const t = useTone(tone);
  const fg = color?.fg || t.fg;
  return (
    <View style={{ borderWidth: 1, borderColor: fg, backgroundColor: color?.bg || t.bg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start' }}>
      <Text style={{ color: fg, fontSize: 11, fontWeight: '700', fontFamily: monoFont }}>{label}</Text>
    </View>
  );
}

/** Tarjeta con borde. */
export function Card({ children, style, tone }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; tone?: Tone }) {
  const { colors } = useTheme();
  const t = useTone(tone || 'neutral');
  return (
    <View
      style={[
        { borderWidth: 1, borderColor: tone ? t.border : colors.hairline, backgroundColor: tone ? t.bg : colors.stage, borderRadius: 10, padding: 16, gap: 10 },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** Botón de filtro, que queda marcado cuando está activo. */
export function Chip({ label, active, onPress, dot }: { label: string; active: boolean; onPress: () => void; dot?: string }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        borderWidth: 1,
        borderColor: active ? colors.signalSubtleFg : colors.hairline,
        backgroundColor: active ? colors.signalSubtleBg : colors.stage,
        borderRadius: 999,
        paddingHorizontal: 12,
        minHeight: 36,
      }}
    >
      {dot ? <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: dot }} /> : null}
      <Text style={{ color: active ? colors.signalSubtleFg : colors.textSecondary, fontWeight: active ? '700' : '500', fontSize: 13.5 }}>{label}</Text>
    </Pressable>
  );
}

/** Fila de chips con desplazamiento lateral. */
export function ChipRow({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
      {children}
    </ScrollView>
  );
}

/** Mensaje de error dentro de un formulario. */
export function ErrorText({ message }: { message?: string | null }) {
  const t = useTone('fault');
  if (!message) return null;
  return (
    <View accessibilityRole="alert" style={{ borderWidth: 1, borderColor: t.border, backgroundColor: t.bg, borderRadius: 8, padding: 10 }}>
      <Text style={{ color: t.fg, fontSize: 13.5 }}>{message}</Text>
    </View>
  );
}

/** Mensaje para cuando una lista está vacía. */
export function EmptyState({ title, text, children }: { title: string; text?: string; children?: React.ReactNode }) {
  return (
    <Card style={{ alignItems: 'center', paddingVertical: 24 }}>
      <T variant="subtitle" style={{ textAlign: 'center' }}>{title}</T>
      {text ? <T variant="muted" style={{ textAlign: 'center' }}>{text}</T> : null}
      {children}
    </Card>
  );
}

/** Pantalla con desplazamiento vertical y "tirar para actualizar". */
export function Screen({ children, onRefresh, refreshing }: { children: React.ReactNode; onRefresh?: () => void; refreshing?: boolean }) {
  const { colors } = useTheme();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.canvas }}
      contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 32 }}
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} tintColor={colors.signal} colors={[colors.signal]} /> : undefined}
    >
      {children}
    </ScrollView>
  );
}

/** Ventana que ocupa casi toda la pantalla, con título y botón de cerrar. */
export function Sheet({
  visible,
  title,
  subtitle,
  onClose,
  children,
  footer,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.stage }} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 16, borderBottomWidth: 1, borderBottomColor: colors.hairline }}>
            <View style={{ flex: 1, gap: 2 }}>
              {subtitle ? <T variant="mono" style={{ color: colors.signalSubtleFg, fontWeight: '700' }}>{subtitle}</T> : null}
              <T variant="subtitle" style={{ fontSize: 19 }}>{title}</T>
            </View>
            <IconButton icon="x" label="Cerrar" onPress={onClose} />
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 28 }} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
          {footer ? (
            <View style={{ flexDirection: 'row', gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: colors.hairline }}>{footer}</View>
          ) : null}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

/** Ventana chica centrada para confirmar una acción. */
export function ConfirmDialog({
  visible,
  title,
  lines,
  confirmLabel,
  danger,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  lines?: string[];
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
      <Pressable onPress={onCancel} style={{ flex: 1, backgroundColor: colors.scrim, justifyContent: 'center', padding: 20 }}>
        <Pressable onPress={() => {}} style={{ backgroundColor: colors.stage, borderRadius: 12, borderWidth: 1, borderColor: colors.hairline, padding: 20, gap: 12 }}>
          <T variant="subtitle">{title}</T>
          {(lines || []).map((line) => (
            <T key={line} variant="muted">{line}</T>
          ))}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
            <IconButton icon="x" label="Volver" onPress={onCancel} size={46} />
            <Button title={confirmLabel} variant={danger ? 'fault' : 'signal'} onPress={onConfirm} style={{ flex: 1 }} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** Encabezado de una pantalla: título y, opcionalmente, acciones a la derecha. */
export function ScreenHeader({ title, badge, actions }: { title: string; badge?: React.ReactNode; actions?: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 10, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.hairline }}>
      {badge}
      <T variant="title">{title}</T>
      {actions ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{actions}</View> : null}
    </View>
  );
}

/** Fila "etiqueta — valor" para datos de solo lectura. */
export function InfoRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
      <T variant="mono">{label}</T>
      <T variant="mono" style={{ color: valueColor || colors.textPrimary, flexShrink: 1, textAlign: 'right' }}>{value}</T>
    </View>
  );
}
