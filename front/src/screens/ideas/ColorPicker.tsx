/** Selector de color para las secciones: una paleta de colores para tocar. */
import React from 'react';
import { Pressable, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SECTION_PALETTE } from '../../lib/format';
import { useTheme } from '../../theme/theme';

/** Paleta de colores. Los que ya usa otra sección aparecen tachados. */
export function ColorPicker({ value, onChange, used = [] }: { value: string; onChange: (color: string) => void; used?: string[] }) {
  const { colors } = useTheme();
  const taken = used.map((c) => c.toLowerCase());
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {SECTION_PALETTE.map((color) => {
        const active = color.toLowerCase() === value.toLowerCase();
        const isTaken = taken.includes(color.toLowerCase());
        return (
          <Pressable
            key={color}
            onPress={() => onChange(color)}
            accessibilityRole="button"
            accessibilityLabel={`Color ${color}${isTaken ? ', ya usado' : ''}`}
            accessibilityState={{ selected: active }}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: color,
              borderWidth: active ? 3 : 1,
              borderColor: active ? colors.textPrimary : colors.hairline,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: isTaken && !active ? 0.35 : 1,
            }}
          >
            {active ? <Feather name="check" size={18} color="#fff" /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/** Primer color de la paleta que todavía no usa ninguna sección. */
export function nextFreeColor(used: string[]) {
  const taken = used.map((c) => c.toLowerCase());
  return SECTION_PALETTE.find((c) => !taken.includes(c.toLowerCase())) || SECTION_PALETTE[0];
}
