import React, { useEffect } from 'react';
import { Pressable } from 'react-native';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Pause, Play } from 'lucide-react-native';
import { ADHKAR_AUDIO, type AudioId } from '../data/audio.generated';
import { colors as c, s } from '../theme';
import { Text, useT } from './text';

function Player({ source, label }: { source: number; label: string }) {
  const t = useT();
  const player = useAudioPlayer(source);
  const status = useAudioPlayerStatus(player);
  // Plays even when the phone is on silent: the user asked for it with a tap.
  useEffect(() => { void setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false, interruptionMode: 'doNotMix' }).catch(() => undefined); }, []);
  const toggle = () => {
    if (status.playing) { player.pause(); return; }
    if (status.didJustFinish || (status.duration > 0 && status.currentTime >= status.duration - 0.05)) void player.seekTo(0);
    player.play();
  };
  return <Pressable accessibilityRole="button" accessibilityLabel={`${t(label)}: ${t(status.playing ? 'to‘xtatish' : 'tinglash')}`} onPress={toggle}
    style={({ pressed }) => [s.linkButton, { paddingHorizontal: 14, minHeight: 40, borderRadius: 20, backgroundColor: c.sage }, pressed && s.pressed]}>
    {status.playing ? <Pause size={15} color={c.forest} /> : <Play size={15} color={c.forest} />}
    <Text style={[s.muted, { color: c.forest }]}>{status.playing ? 'To‘xtatish' : 'Tinglash'}</Text>
  </Pressable>;
}

/** A listen button, shown only when a recording for this dhikr has been added to the app. */
export function AdhkarAudio({ id, label }: { id: AudioId; label: string }) {
  const source = ADHKAR_AUDIO[id];
  return source === undefined ? null : <Player key={id} source={source} label={label} />;
}
