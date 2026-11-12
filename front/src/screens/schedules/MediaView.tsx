/** Muestra una foto o un video de un bloque. El video se reproduce dentro de la app. */
import React from 'react';
import { Image, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { T } from '../../components/ui';
import { absoluteUrl } from '../../config';

/** Video con controles, en un recuadro de alto fijo. */
function VideoPlayer({ uri, height }: { uri: string; height: number }) {
  const player = useVideoPlayer(uri);
  return <VideoView player={player} style={{ width: '100%', height }} contentFit="contain" nativeControls />;
}

/** Foto o video. Con `thumbnail` muestra una miniatura sin reproducir el video. */
export function MediaView({
  uri,
  kind,
  height = 300,
  thumbnail,
}: {
  uri?: string | null;
  kind: 'IMAGE' | 'VIDEO';
  height?: number;
  thumbnail?: boolean;
}) {
  const src = absoluteUrl(uri);
  if (!src) {
    return (
      <View style={{ height, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}>
        <T variant="small" style={{ color: '#fff' }}>Archivo no disponible</T>
      </View>
    );
  }
  if (kind === 'VIDEO') {
    if (thumbnail) {
      return (
        <View style={{ height, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}>
          <Feather name="film" size={26} color="#fff" />
        </View>
      );
    }
    return (
      <View style={{ backgroundColor: '#000' }}>
        <VideoPlayer uri={src} height={height} />
      </View>
    );
  }
  return <Image source={{ uri: src }} style={{ width: '100%', height, backgroundColor: '#000' }} resizeMode={thumbnail ? 'cover' : 'contain'} />;
}
