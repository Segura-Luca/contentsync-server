/** Editor de bloques: tipo, estado, textos, fotos y videos, día, hora y etiqueta. */
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { apiFetch, friendlyError, LocalFile, uploadFile } from '../../api/client';
import { ContentType, Media, ProductionStatus } from '../../api/types';
import { Button, Chip, ChipRow, ErrorText, Field, IconButton, Input, Sheet, T } from '../../components/ui';
import { CONTENT_TYPES, MAX_MEDIA_PER_BLOCK, PRODUCTION_STATUSES, WEEKDAYS } from '../../lib/format';
import { BlockEditorSeed, useApp } from '../../state/AppContext';
import { noteColors, useTheme } from '../../theme/theme';
import { MediaView } from './MediaView';

/** Archivo del bloque: ya subido (storageKey) o recién elegido en el teléfono (file). */
interface DraftMedia extends Media {
  file?: LocalFile | null;
  localUri?: string;
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Editor de bloques. Se abre con una "semilla": un bloque existente o los datos iniciales de uno nuevo.
 * Se monta solo mientras está abierto, así cada vez arranca con los datos de la semilla.
 */
export function BlockEditorSheet({ seed, onClose }: { seed: BlockEditorSeed; onClose: () => void }) {
  const { schedules, selectedScheduleId, ideaSections, config, hydrate, setBanner } = useApp();
  const { colors, name: themeName } = useTheme();
  const schedule = schedules.find((s) => s.id === selectedScheduleId) || null;
  // Al editar, el formulario arranca con los datos del bloque; al crear, con los de la semilla.
  const [block] = useState(() => (seed.blockId ? (schedule?.items || []).find((b) => b.id === seed.blockId) || null : null));

  const [day, setDay] = useState(block?.dayOfWeek ?? seed.day);
  const [time, setTime] = useState(block?.plannedTime || '18:00');
  const [color, setColor] = useState(block ? block.noteColor || 'AMBER' : seed.color || ideaSections[0]?.color || 'AMBER');
  const [title, setTitle] = useState(block ? block.blockTitle || '' : seed.title || '');
  const [notes, setNotes] = useState(block ? block.notes || '' : seed.notes || '');
  const [caption, setCaption] = useState(block?.caption || '');
  const [contentType, setContentType] = useState<ContentType>(block ? block.contentType || 'OTHER' : 'REEL');
  const [production, setProduction] = useState<ProductionStatus>(block?.productionStatus || 'PENDING');
  const [media, setMedia] = useState<DraftMedia[]>(() => (block?.media || []).map((m) => ({ ...m, description: m.description || '' })));
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');

  const close = () => {
    if (!saving) onClose();
  };

  /** Abre la galería para elegir fotos y videos. */
  const pickMedia = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Para agregar fotos y videos, permití el acceso a la galería.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: true,
      selectionLimit: Math.max(1, MAX_MEDIA_PER_BLOCK - media.length),
      quality: 1,
    });
    if (result.canceled) return;
    const maxMb = Number(config.uploadMaxMb) || 0;
    const rejected: string[] = [];
    const added: DraftMedia[] = [];
    for (const asset of result.assets) {
      const isVideo = asset.type === 'video';
      const name = asset.fileName || `archivo-${Date.now()}.${isVideo ? 'mp4' : 'jpg'}`;
      const size = asset.fileSize || 0;
      if (maxMb && size > maxMb * 1024 * 1024) {
        rejected.push(`${name} supera los ${maxMb} MB`);
        continue;
      }
      if (media.length + added.length >= MAX_MEDIA_PER_BLOCK) {
        rejected.push(`cada bloque admite hasta ${MAX_MEDIA_PER_BLOCK} archivos`);
        break;
      }
      added.push({
        storageKey: '',
        kind: isVideo ? 'VIDEO' : 'IMAGE',
        description: '',
        sizeBytes: size,
        originalName: name,
        localUri: asset.uri,
        file: { uri: asset.uri, name, mimeType: asset.mimeType || (isVideo ? 'video/mp4' : 'image/jpeg'), size },
      });
    }
    setMedia((prev) => [...prev, ...added]);
    setError(rejected.length ? `No se agregó: ${rejected.join('; ')}.` : '');
  };

  const moveMedia = (index: number, delta: number) => {
    setMedia((prev) => {
      const target = index + delta;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return next;
    });
  };

  const setDescription = (index: number, text: string) => {
    setMedia((prev) => prev.map((m, i) => (i === index ? { ...m, description: text } : m)));
  };

  /** Sube los archivos nuevos de a uno y después guarda el bloque. */
  const submit = async () => {
    if (saving || !schedule) return;
    const blockTitle = title.trim();
    if (!blockTitle) return setError('Escribí un título para el bloque.');
    if (!TIME.test(time)) return setError('Escribí la hora como HH:MM, por ejemplo 18:00.');
    setSaving(true);
    setError('');

    // Si una subida falla, las que ya terminaron no se vuelven a enviar al reintentar.
    const items = [...media];
    const pending = items.filter((m) => m.file);
    for (let i = 0; i < pending.length; i++) {
      const item = pending[i];
      try {
        const uploaded = await uploadFile(item.file!, schedule.clientId, (fraction) => {
          setProgress(Math.max(3, Math.round(((i + fraction) / pending.length) * 100)));
        });
        item.storageKey = uploaded.storageKey;
        item.sizeBytes = uploaded.sizeBytes || item.sizeBytes;
        item.kind = uploaded.kind || item.kind;
        item.file = null;
        setMedia([...items]);
      } catch (e: any) {
        setSaving(false);
        setProgress(0);
        setError(e?.message || 'No pudimos subir uno de los archivos.');
        return;
      }
    }

    const body = {
      dayOfWeek: day,
      contentType,
      productionStatus: production,
      blockTitle,
      noteColor: color,
      notes: notes.trim(),
      caption: caption.trim(),
      plannedTime: time,
      media: items.map((m) => ({
        storageKey: m.storageKey,
        description: (m.description || '').trim(),
        sizeBytes: Math.round(Number(m.sizeBytes) || 0),
        originalName: m.originalName || undefined,
      })),
    };
    const editing = Boolean(seed.blockId);
    const r = await apiFetch(editing ? `/schedules/blocks/${seed.blockId}` : `/schedules/${schedule.id}/blocks`, {
      method: editing ? 'PATCH' : 'POST',
      body,
    });
    setSaving(false);
    setProgress(0);
    if (!r.ok) return setError(friendlyError(r.data, r.status));
    onClose();
    await hydrate();
    setBanner(editing ? 'Bloque actualizado.' : 'Bloque agregado al cronograma. Le avisamos al cliente.');
  };

  const selectedSection = ideaSections.find((s) => s.color.toLowerCase() === color.toLowerCase());
  const maxMb = Number(config.uploadMaxMb) || 0;

  return (
    <Sheet
      visible
      title={seed.blockId ? 'Editar bloque' : 'Nuevo bloque'}
      onClose={close}
      footer={
        <>
          <IconButton icon="x" label="Cancelar" onPress={close} disabled={saving} size={46} />
          <Button title="Guardar" variant="signal" busy={saving} onPress={submit} style={{ flex: 1 }} />
        </>
      }
    >
      <Field label="Tipo de contenido">
        <ChipRow>
          {CONTENT_TYPES.map((t) => (
            <Chip key={t.code} label={t.label} active={contentType === t.code} onPress={() => setContentType(t.code)} />
          ))}
        </ChipRow>
      </Field>

      <Field label="Estado">
        <ChipRow>
          {PRODUCTION_STATUSES.map((p) => (
            <Chip key={p.code} label={p.label} active={production === p.code} onPress={() => setProduction(p.code)} />
          ))}
        </ChipRow>
      </Field>

      <Field label="Título">
        <Input value={title} onChangeText={setTitle} maxLength={160} />
      </Field>
      <Field label="Contenido">
        <Input value={notes} onChangeText={setNotes} multiline />
      </Field>
      <Field label="Texto (opcional)">
        <Input value={caption} onChangeText={setCaption} multiline />
      </Field>

      <Field label="Fotos y videos">
        <Pressable
          onPress={pickMedia}
          accessibilityRole="button"
          style={{ borderWidth: 1, borderStyle: 'dashed', borderColor: colors.signalSubtleFg, borderRadius: 10, padding: 18, alignItems: 'center', gap: 4 }}
        >
          <T style={{ color: colors.signalSubtleFg, fontWeight: '700' }}>+ Fotos o videos</T>
          {maxMb ? <T variant="small">{`Hasta ${maxMb} MB`}</T> : null}
        </Pressable>
      </Field>

      {media.map((m, i) => (
        <View key={(m.storageKey || m.localUri || '') + i} style={{ flexDirection: 'row', gap: 10, borderWidth: 1, borderColor: colors.hairline, borderRadius: 10, padding: 8, backgroundColor: colors.canvas }}>
          <View style={{ width: 72, height: 72, borderRadius: 6, overflow: 'hidden' }}>
            <MediaView uri={m.localUri || m.url} kind={m.kind} height={72} thumbnail />
          </View>
          <Field label={`${m.kind === 'VIDEO' ? 'Video' : 'Foto'} ${i + 1}: descripción`} style={{ flex: 1 }}>
            <Input value={m.description} onChangeText={(t) => setDescription(i, t)} multiline maxLength={2000} style={{ minHeight: 60 }} />
          </Field>
          <View style={{ gap: 6 }}>
            <IconButton icon="arrow-up" label="Subir" disabled={i === 0} onPress={() => moveMedia(i, -1)} />
            <IconButton icon="arrow-down" label="Bajar" disabled={i === media.length - 1} onPress={() => moveMedia(i, 1)} />
            <IconButton icon="x" label="Quitar" onPress={() => setMedia((prev) => prev.filter((_, j) => j !== i))} />
          </View>
        </View>
      ))}

      <Field label="Día de la semana">
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {WEEKDAYS.map((d) => {
            const active = day === d.num;
            return (
              <Pressable
                key={d.num}
                onPress={() => setDay(d.num)}
                accessibilityRole="button"
                accessibilityLabel={d.full}
                accessibilityState={{ selected: active }}
                style={{
                  flex: 1,
                  height: 40,
                  borderRadius: 8,
                  borderWidth: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderColor: active ? colors.signalSubtleFg : colors.hairline,
                  backgroundColor: active ? colors.signalSubtleBg : colors.stage,
                }}
              >
                <T style={{ fontSize: 11.5, fontWeight: '700', color: active ? colors.signalSubtleFg : colors.textSecondary }}>{d.code}</T>
              </Pressable>
            );
          })}
        </View>
      </Field>

      <Field label="Hora">
        <Input value={time} onChangeText={(v) => setTime(v.replace(/[^\d:]/g, '').slice(0, 5))} keyboardType="numbers-and-punctuation" maxLength={5} />
      </Field>

      <Field label="Etiqueta">
        <ChipRow>
          {ideaSections.map((sec) => (
            <Chip
              key={sec.id}
              label={sec.name}
              dot={noteColors(sec.color, colors, themeName).dot}
              active={sec.id === selectedSection?.id}
              onPress={() => setColor(sec.color)}
            />
          ))}
          {selectedSection ? null : <Chip label="Sin etiqueta" dot={noteColors(color, colors, themeName).dot} active onPress={() => {}} />}
        </ChipRow>
        {ideaSections.length === 0 ? <T variant="small">Creá etiquetas en Ideas de contenido.</T> : null}
      </Field>

      {saving && progress > 0 ? (
        <View style={{ borderWidth: 1, borderColor: colors.signalSubtleFg, backgroundColor: colors.signalSubtleBg, borderRadius: 8, padding: 10, gap: 6 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <T variant="eyebrow" style={{ color: colors.signalSubtleFg }}>SUBIENDO ARCHIVOS…</T>
            <T variant="eyebrow" style={{ color: colors.signalSubtleFg }}>{progress}%</T>
          </View>
          <View style={{ height: 5, backgroundColor: colors.hairline, borderRadius: 3, overflow: 'hidden' }}>
            <View style={{ width: `${progress}%`, height: '100%', backgroundColor: colors.signal }} />
          </View>
        </View>
      ) : null}

      <ErrorText message={error} />
    </Sheet>
  );
}
