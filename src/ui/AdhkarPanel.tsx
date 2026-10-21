import React from 'react';
import { Pressable, View } from 'react-native';
import { Check, ExternalLink, RotateCcw, Undo2 } from 'lucide-react-native';
import Svg, { Circle } from 'react-native-svg';
import adhkar from '../data/adhkar.json';
import { getAdhkarCount, setAdhkarCount, type AppState } from '../domain/model';
import { colors as c, fonts, s } from '../theme';
import type { AudioId } from '../data/audio.generated';
import { AdhkarAudio } from './AudioButton';
import { ReviewNotice } from './controls';
import { Text, useT } from './text';

export type TasbihProgress = { step: number; count: number; done: boolean };
export const TASBIH_START: TasbihProgress = { step: 0, count: 0, done: false };

const sayyid = adhkar.items.find((item) => item.id === 'sayyid-al-istighfar')!;
const tasbih = adhkar.items.find((item) => item.id === 'after-prayer-tasbih')!;
const steps = tasbih.steps!;

function Arabic({ children, size = 22 }: { children: string; size?: number }) {
  // No custom font: the bundled Latin fonts have no Arabic glyphs, so the system font draws it.
  return <Text raw style={{ fontSize: size, lineHeight: size * 1.85, color: c.forest, textAlign: 'right', writingDirection: 'rtl' }}>{children}</Text>;
}

function SourceLink({ label, url, onOpen }: { label: string; url: string; onOpen: (url: string) => void }) {
  return <Pressable accessibilityRole="link" onPress={() => onOpen(url)} style={s.linkButton}><Text style={s.source}>{label}</Text><ExternalLink size={12} color={c.forest} /></Pressable>;
}

/** Two sourced adhkar. Completions only mark the day as a good day; nothing is scored. */
export function AdhkarPanel({ data, day, update, openSource, onTap, progress, setProgress }: {
  data: AppState; day: string; update: (fn: (state: AppState) => AppState) => void; openSource: (url: string) => void;
  onTap: () => void; progress: TasbihProgress; setProgress: (next: TasbihProgress) => void;
}) {
  const t = useT();
  const step = steps[progress.step] ?? steps[0]!;
  const completions = getAdhkarCount(data, tasbih.id, day);
  const count = () => {
    if (progress.done) return;
    onTap();
    const next = progress.count + 1;
    if (next < step.count) { setProgress({ ...progress, count: next }); return; }
    if (progress.step < steps.length - 1) { setProgress({ step: progress.step + 1, count: 0, done: false }); return; }
    setProgress({ step: progress.step, count: next, done: true });
    update((state) => setAdhkarCount(state, tasbih.id, getAdhkarCount(state, tasbih.id, day) + 1, day));
  };
  const undo = () => {
    if (progress.done) return;
    if (progress.count > 0) setProgress({ ...progress, count: progress.count - 1 });
    else if (progress.step > 0) setProgress({ step: progress.step - 1, count: steps[progress.step - 1]!.count - 1, done: false });
  };
  const ring = 2 * Math.PI * 100;
  const fraction = progress.done ? 1 : progress.count / step.count;

  return <View style={{ gap: 18 }}>
    {adhkar.scholarReview.status !== 'approved' && <ReviewNotice text={adhkar.scholarReview.notice} />}

    <View style={[s.card, { gap: 12 }]}>
      <View style={{ gap: 2 }}><Text style={s.heading}>{sayyid.title}</Text><Text style={s.tiny}>{sayyid.subtitle!.toUpperCase()}</Text></View>
      <Arabic>{sayyid.arabic!}</Arabic>
      <View style={{ alignItems: 'flex-start' }}><AdhkarAudio id="sayyid-al-istighfar" label={sayyid.title} /></View>
      <Text style={[s.text, { color: c.muted }]}>{sayyid.transliteration}</Text>
      <Text style={s.text}>{sayyid.meaning}</Text>
      <Text style={s.muted}>{sayyid.note}</Text>
      <SourceLink label={sayyid.source} url={sayyid.url} onOpen={openSource} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {sayyid.parts!.map((part) => {
          const done = getAdhkarCount(data, part.id, day) > 0;
          return <Pressable key={part.id} accessibilityRole="checkbox" accessibilityState={{ checked: done }} accessibilityLabel={t(`${part.label} o‘qidim`)}
            onPress={() => update((state) => setAdhkarCount(state, part.id, done ? 0 : 1, day))}
            style={({ pressed }) => [{ flex: 1, minHeight: 52, borderRadius: 16, borderWidth: 1, borderColor: done ? c.forest : c.line, backgroundColor: done ? c.forest : c.paper, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, pressed && s.pressed]}>
            {done && <Check size={16} color={c.white} />}
            <Text style={[s.medium, done && { color: c.white }]}>{part.label}{done ? '' : ' o‘qidim'}</Text>
          </Pressable>;
        })}
      </View>
    </View>

    <View style={[s.card, { gap: 14 }]}>
      <View style={{ gap: 2 }}><Text style={s.heading}>{tasbih.title}</Text><Text style={s.tiny}>{tasbih.subtitle!.toUpperCase()}</Text></View>
      <Text style={s.muted}>{tasbih.note}</Text>
      <View style={{ flexDirection: 'row', gap: 6 }} accessibilityLabel={t(`${steps.length} bosqichdan ${progress.step + 1}-bosqich`)}>
        {steps.map((item, index) => <View key={item.id} style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: index < progress.step || progress.done ? c.forest : index === progress.step ? c.gold : c.sand }} />)}
      </View>
      <View style={{ gap: 4 }}>
        <Arabic size={progress.step === steps.length - 1 ? 20 : 30}>{step.arabic}</Arabic>
        <Text style={[s.medium, { textAlign: 'center' }]}>{step.transliteration}</Text>
        <Text style={[s.muted, { textAlign: 'center' }]}>{step.meaning}</Text>
        <View style={{ alignItems: 'center', marginTop: 4 }}><AdhkarAudio id={step.id as AudioId} label={step.transliteration} /></View>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={t(progress.done ? 'Tasbih yakunlandi' : `${step.transliteration}: ${progress.count} / ${step.count}. Sanash uchun bosing`)}
        disabled={progress.done} onPress={count}
        style={({ pressed }) => [{ width: 220, height: 220, borderRadius: 110, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', backgroundColor: c.sage }, pressed && { backgroundColor: '#DDE6D8' }]}>
        <Svg width={220} height={220} style={{ position: 'absolute' }} accessibilityElementsHidden>
          <Circle cx="110" cy="110" r="100" fill="none" stroke="#D7DFD1" strokeWidth="2" />
          <Circle cx="110" cy="110" r="100" fill="none" stroke={c.forest} strokeWidth="3" strokeLinecap="round" strokeDasharray={`${fraction * ring} ${ring}`} rotation="-90" origin="110,110" />
        </Svg>
        {progress.done
          ? <><Check size={34} color={c.forest} /><Text style={[s.medium, { marginTop: 8, color: c.forest }]}>Yakunlandi</Text><Text style={s.muted}>Alloh qabul qilsin</Text></>
          : <><Text style={[s.counterNumber, { fontSize: 64, lineHeight: 72 }]}>{progress.count}</Text><Text style={s.muted}>/ {step.count}</Text><Text style={[s.tiny, { marginTop: 10, color: c.forest }]}>SANASH UCHUN BOSING</Text></>}
      </Pressable>
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 22 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('Oxirgi sanoqni qaytarish')} disabled={progress.done || (progress.step === 0 && progress.count === 0)} onPress={undo}
          style={[s.linkButton, (progress.done || (progress.step === 0 && progress.count === 0)) && { opacity: .35 }]}><Undo2 size={15} color={c.muted} /><Text style={s.muted}>Qaytarish</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={t('Tasbihni qaytadan boshlash')} onPress={() => setProgress({ ...TASBIH_START })} style={s.linkButton}>
          <RotateCcw size={15} color={c.forest} /><Text style={[s.muted, { color: c.forest, fontFamily: fonts.medium }]}>{progress.done ? 'Yana boshlash' : 'Qaytadan'}</Text>
        </Pressable>
      </View>
      {completions > 0 && <Text style={[s.muted, { textAlign: 'center' }]}>Bugun {completions} marta yakunlandi.</Text>}
      <SourceLink label={tasbih.source} url={tasbih.url} onOpen={openSource} />
    </View>
    <Text style={[s.muted, { textAlign: 'center' }]}>Sanoq faqat yordamchi — u amalning qabul bo‘lishi yoki darajaning o‘lchovi emas.</Text>
  </View>;
}
