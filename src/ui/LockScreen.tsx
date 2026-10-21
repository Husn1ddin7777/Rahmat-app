import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { LockKeyhole } from 'lucide-react-native';
import { pauseAfterFailures, verifyPin } from '../domain/lock';
import type { PinRecord } from '../domain/model';
import { unlockWithBiometrics } from '../services/biometrics';
import { colors as c, s } from '../theme';
import { Button } from './controls';
import { Text, useScript } from './text';
import { PinPad } from './PinPad';

// Shared across lock screens for this app session, so switching tabs cannot reset the pause.
let failures = 0;
let pausedUntil = 0;

/** Asks for the PIN (or device unlock). A forgotten PIN can only be reset by deleting all data. */
export function LockScreen({ pin, biometrics, onUnlock, onForgot, title, subtitle }: {
  pin: PinRecord; biometrics: boolean; onUnlock: () => void; onForgot: () => Promise<void>; title: string; subtitle: string;
}) {
  const script = useScript();
  const [value, setValue] = useState('');
  const [message, setMessage] = useState('');
  const [checking, setChecking] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [forgot, setForgot] = useState(false);
  const [wiping, setWiping] = useState(false);
  const live = useRef(true);
  // A ref keeps the device prompt from re-opening whenever the parent re-renders.
  const unlock = useRef(onUnlock);
  unlock.current = onUnlock;
  useEffect(() => () => { live.current = false; }, []);
  const waiting = Math.max(0, Math.ceil((pausedUntil - now) / 1000));
  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [waiting]);

  const tryBiometrics = useCallback(async () => {
    if (await unlockWithBiometrics(script)) { failures = 0; if (live.current) unlock.current(); }
  }, [script]);
  // Offer device unlock once when the screen appears; the button can ask again.
  useEffect(() => { if (biometrics) void tryBiometrics(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const change = (next: string) => {
    setValue(next);
    setMessage('');
    if (next.length !== pin.length) return;
    setChecking(true);
    // Let the pad show the last dot before the short hashing work runs.
    setTimeout(() => {
      if (!live.current) return;
      const ok = verifyPin(next, pin);
      setChecking(false);
      setValue('');
      if (ok) { failures = 0; unlock.current(); return; }
      failures += 1;
      const pause = pauseAfterFailures(failures);
      if (pause) { pausedUntil = Date.now() + pause * 1000; setNow(Date.now()); }
      setMessage(pause ? `Bir necha marta noto‘g‘ri kiritildi. ${pause} soniya kuting.` : 'PIN kod noto‘g‘ri. Qayta urinib ko‘ring.');
    }, 30);
  };

  if (forgot) {
    return <View style={{ gap: 14, paddingVertical: 8 }}>
      <Text style={s.heading}>PIN kodni unutdingizmi?</Text>
      <Text style={s.text}>Qulfni ochishning yagona yo‘li — barcha niyatlar, sanoqlar, odatlar va muhosaba yozuvlarini o‘chirib, qaytadan boshlash. Bu amalni ortga qaytarib bo‘lmaydi.</Text>
      <Button disabled={wiping} onPress={async () => { setWiping(true); try { await onForgot(); } finally { if (live.current) setWiping(false); } }}>{wiping ? 'O‘chirilmoqda…' : 'Hammasini o‘chirib, qayta boshlash'}</Button>
      <Button secondary disabled={wiping} onPress={() => setForgot(false)}>PIN kodni kiritaman</Button>
    </View>;
  }
  return <View style={{ alignItems: 'center', gap: 18, paddingVertical: 8 }}>
    <View style={[s.logo, { marginRight: 0, width: 52, height: 52, borderRadius: 26 }]}><LockKeyhole size={24} color={c.paper} strokeWidth={1.6} /></View>
    <View style={{ alignItems: 'center', gap: 6 }}>
      <Text style={s.heading}>{title}</Text>
      <Text style={[s.muted, { textAlign: 'center', maxWidth: 300 }]}>{subtitle}</Text>
    </View>
    <PinPad value={value} onChange={change} length={pin.length} disabled={checking || waiting > 0} onBiometric={biometrics ? () => void tryBiometrics() : undefined} />
    <View style={{ minHeight: 22, alignItems: 'center' }}>
      {checking ? <ActivityIndicator color={c.forest} /> : waiting > 0
        ? <Text accessibilityRole="alert" style={[s.muted, { color: c.danger }]}>Qayta urinish uchun {waiting} soniya kuting.</Text>
        : message ? <Text accessibilityRole="alert" style={[s.muted, { color: c.danger }]}>{message}</Text> : null}
    </View>
    <Pressable accessibilityRole="button" onPress={() => setForgot(true)} style={s.linkButton}><Text style={s.source}>PIN kodni unutdingizmi?</Text></Pressable>
  </View>;
}
