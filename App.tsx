import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState as NativeAppState, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { DMSans_400Regular } from '@expo-google-fonts/dm-sans/400Regular';
import { DMSans_500Medium } from '@expo-google-fonts/dm-sans/500Medium';
import { DMSans_600SemiBold } from '@expo-google-fonts/dm-sans/600SemiBold';
import { CormorantGaramond_500Medium } from '@expo-google-fonts/cormorant-garamond/500Medium';
import { CormorantGaramond_600SemiBold } from '@expo-google-fonts/cormorant-garamond/600SemiBold';
import { Archive, ArrowDown, ArrowRight, Bell, BellRing, BookHeart, Check, ChevronLeft, ChevronRight, CircleDot, Coffee, ExternalLink, Heart, Leaf, LockKeyhole, Minus, Plus, RefreshCw, ShieldCheck, Sprout, Sun, Trash2, Undo2, X } from 'lucide-react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import content from './src/data/sunnah.json';
import { AppState, Reflection, createInitialState, getCounts, getDayTotal, incrementCount, localDateKey, MAX_REFLECTIONS, toggleHabit } from './src/domain/model';
import { clearState, loadState, saveState } from './src/services/storage';
import { ReminderResult, ReminderSettings, getTestNotificationStatus, sendTestNotification, subscribeToReminderOpen, syncReminders } from './src/services/notifications';
import { colors as c, fonts, s } from './src/theme';
import { getPwaState, preparePwa } from './src/services/pwa';

type Tab = 'today' | 'istighfar' | 'reflections' | 'reminders';
const tabs = [{ key: 'today', label: 'Bugun', icon: Sun }, { key: 'istighfar', label: 'Istig‘for', icon: CircleDot }, { key: 'reflections', label: 'Muhosaba', icon: BookHeart }, { key: 'reminders', label: 'Eslatmalar', icon: Bell }] as const;
const habits = [{ id: 'meal', title: 'Bismillah bilan boshlash', subtitle: 'Taom oldidan bir go‘zal odat', icon: Coffee }, { id: 'kindness', title: 'Yaxshi so‘z aytish', subtitle: 'Yoki sukutni tanlash', icon: Heart }, { id: 'family', title: 'Oilaga yordam berish', subtitle: 'Yaxshilik yaqinlardan boshlanadi', icon: Sprout }];
const slotNames = ['Tong', 'Choshgoh', 'Peshindan so‘ng', 'Kunning ikkinchi yarmi', 'Oqshom'];
const weekNames = ['Ya', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh'];
const months = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
const weekdays = ['yakshanba', 'dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba'];
const uzDate = (date: Date, withWeekday = false) => `${date.getDate()}-${months[date.getMonth()]}${withWeekday ? `, ${weekdays[date.getDay()]}` : ''}`;
const hour = (v: number) => `${String(v).padStart(2, '0')}:00`;
function Button({ children, onPress, secondary = false, disabled = false }: { children: React.ReactNode; onPress: () => void; secondary?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [s.button, secondary && s.secondary, (pressed || disabled) && s.pressed]}><Text style={[s.buttonText, secondary && { color: c.forest }]}>{children}</Text></Pressable>;
}
function IconButton({ label, onPress, children, disabled = false }: { label: string; onPress: () => void; children: React.ReactNode; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} style={({ pressed }) => [s.iconButton, pressed && s.pressed]}>{children}</Pressable>;
}
function Ornament() {
  return <Svg width={150} height={192} viewBox="0 0 150 192" style={{ position: 'absolute', right: -12, top: 13 }} accessibilityElementsHidden>
    {[43, 61, 79, 97].map(r => <Circle key={r} cx="105" cy="92" r={r} fill="none" stroke="#769180" strokeOpacity=".28" strokeWidth="1" />)}
    <Path d="M80 146 Q112 104 99 43 M94 108 Q58 102 66 80 Q94 83 98 99 M101 85 Q135 80 127 60 Q104 62 100 78 M87 128 Q57 125 57 107 Q77 106 93 115 M99 59 Q79 42 92 28 Q107 42 99 59" fill="none" stroke="#C9AC6A" strokeWidth="1.25" />
  </Svg>;
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({ DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, CormorantGaramond_500Medium, CormorantGaramond_600SemiBold });
  if (!fontsLoaded && !fontError) return <View style={[s.outer, { justifyContent: 'center' }]}><ActivityIndicator color={c.forest} /></View>;
  return <SafeAreaProvider><Rahmat /></SafeAreaProvider>;
}

function Rahmat() {
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<AppState | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [pwa, setPwa] = useState(getPwaState);
  const [tab, setTab] = useState<Tab>('today');
  const [now, setNow] = useState(new Date());
  const [selectedId, setSelectedId] = useState('');
  const [slot, setSlot] = useState(0);
  const [quoteIndex, setQuoteIndex] = useState(Math.floor(Math.random() * content.reminders.length));
  const [sheet, setSheet] = useState<'add' | 'about' | 'clear' | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [note, setNote] = useState('');
  const [archived, setArchived] = useState(false);
  const [toast, setToast] = useState('');
  const [notificationState, setNotificationState] = useState<ReminderResult | null>(null);
  const [notificationError, setNotificationError] = useState('');
  const [testStatus, setTestStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState<ReminderSettings | null>(null);
  const [settingsError, setSettingsError] = useState('');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef<AppState | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scroll = useRef<ScrollView>(null);
  const deleting = useRef(false);
  const notificationOperation = useRef(false);
  const day = localDateKey(now);
  const active = data?.reflections.filter(r => !r.archived) ?? [];
  const current = active.find(r => r.id === selectedId) ?? active[0];
  const counts = data && current ? getCounts(data, current.id, day) : [0, 0, 0, 0, 0];
  const total = data ? getDayTotal(data, day) : 0;
  const target = active.length * 500;
  const quote = content.reminders[quoteIndex] ?? content.reminders[0]!;
  const completedHabits = data?.days[day]?.habits ?? [];
  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 3600);
  }, []);
  const openSource = (url: string) => { Linking.openURL(url).catch(() => showToast('Manbani ochib bo‘lmadi. Internet aloqasini tekshiring.')); };
  const reload = useCallback(() => {
    setLoadError(false);
    loadState().then(state => { setData(state); setSettingsDraft(state.settings); }).catch(() => setLoadError(true));
  }, []);
  useEffect(reload, [reload]);
  useEffect(() => { if (Platform.OS === 'web') void preparePwa().catch(() => {}); }, []);
  useEffect(() => { latest.current = data; }, [data]);
  useEffect(() => {
    if (!data || deleting.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { saveState(data).then(() => setSaveError('')).catch(error => setSaveError(error instanceof Error ? error.message : 'O‘zgarishlarni saqlab bo‘lmadi.')); }, Platform.OS === 'web' ? 0 : 350);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [data]);
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    const sub = NativeAppState.addEventListener('change', state => {
      if (state === 'active') { setNow(new Date()); setPwa(getPwaState()); if (latest.current && !notificationOperation.current) syncReminders(latest.current.settings, latest.current.reflections.some(r => !r.archived)).then(result => setNotificationState(previous => result.status === 'disabled' && previous?.status === 'denied' ? previous : result)).catch(() => setNotificationError('Eslatmalarni yangilab bo‘lmadi. Qayta urinib ko‘ring.')); }
      else if (latest.current && !deleting.current) { if (saveTimer.current) clearTimeout(saveTimer.current); saveState(latest.current).catch(error => setSaveError(error instanceof Error ? error.message : 'Saqlashda xato.')); }
    });
    return () => { clearInterval(timer); sub.remove(); if (toastTimer.current) clearTimeout(toastTimer.current); };
  }, []);
  const settingsKey = JSON.stringify(data?.settings);
  const hasActive = active.length > 0;
  useEffect(() => {
    if (!data || busy || notificationOperation.current) return;
    let live = true;
    syncReminders(data.settings, hasActive).then(result => { if (live) { setNotificationState(previous => result.status === 'disabled' && previous?.status === 'denied' ? previous : result); setNotificationError(''); } }).catch(() => { if (live) setNotificationError('Eslatmalarni sozlab bo‘lmadi. Qayta urinib ko‘ring.'); });
    return () => { live = false; };
  }, [settingsKey, hasActive, day, busy]);
  useEffect(() => subscribeToReminderOpen((destination, quoteId) => { setTab(destination); const index = content.reminders.findIndex(item => item.id === quoteId); if (index >= 0) setQuoteIndex(index); }), []);
  useEffect(() => { scroll.current?.scrollTo({ y: 0, animated: false }); }, [tab]);
  const update = (fn: (state: AppState) => AppState) => setData(old => old ? fn(old) : old);
  const addReflection = () => {
    if (!data) return;
    if (data.reflections.length >= MAX_REFLECTIONS) { showToast('20 ta niyat saqlash mumkin. Avval keraksiz qaydni o‘chiring.'); return; }
    setLabel(''); setNote(''); setSheet('add');
  };
  const saveReflection = () => {
    if (!data || data.reflections.length >= MAX_REFLECTIONS) return;
    const reflection: Reflection = { id: `r${Date.now()}${Math.random().toString(36).slice(2, 8)}`, label: label.trim() || `Niyat ${data.reflections.length + 1}`, note: note.trim(), createdAt: new Date().toISOString(), archived: false };
    update(old => ({ ...old, reflections: [...old.reflections, reflection] }));
    setSelectedId(reflection.id); setSlot(0); setSheet(null); setTab('istighfar'); showToast('Niyat qo‘shildi. Kichik qadamdan boshlang.');
  };
  const addCount = (delta = 1) => {
    if (!current) return;
    update(old => incrementCount(old, current.id, slot, delta, localDateKey()));
    if (delta > 0 && Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
  };
  const validateSettings = (settings: ReminderSettings) => {
    if (settings.dayStart >= settings.dayEnd) return 'Kunning tugashi boshlanishidan keyin bo‘lishi kerak.';
    if (settings.times.some(t => !/^([01]\d|2[0-3]):[0-5]\d$/.test(t))) return 'Vaqtni SS:DD shaklida kiriting, masalan 08:00.';
    const minutes = settings.times.map(t => Number(t.slice(0, 2)) * 60 + Number(t.slice(3)));
    if (new Set(minutes).size !== 5) return 'Beshta vaqt bir-biridan farq qilishi kerak.';
    if (minutes.some(t => t < settings.dayStart * 60 || t >= settings.dayEnd * 60)) return 'Barcha vaqtlarni faol kun oralig‘ida belgilang.';
    if (minutes.some((t, i) => i > 0 && t <= minutes[i - 1]!)) return 'Vaqtlarni ertalabdan kechgacha ketma-ket kiriting.';
    return '';
  };
  const applySettings = async (enable?: boolean) => {
    if (!settingsDraft || busy || notificationOperation.current) return;
    const next = enable === false ? { ...data!.settings, enabled: false } : { ...settingsDraft, enabled: enable ?? settingsDraft.enabled };
    const error = validateSettings(next);
    if (error) { setSettingsError(error); return; }
    notificationOperation.current = true;
    setBusy(true); setSettingsError('');
    try {
      const result = await syncReminders(next, hasActive, true);
      setNotificationState(result); setNotificationError('');
      const saved = { ...next, enabled: result.status === 'enabled' };
      setSettingsDraft(saved); update(old => ({ ...old, settings: saved }));
      showToast(result.status === 'install-required' ? 'Avval Rahmatni bosh ekranga qo‘shing va o‘sha belgidan oching.' : result.status === 'unavailable' || result.status === 'preview' ? 'Bu brauzerda bildirishnomalar mavjud emas.' : result.status === 'denied' ? 'Bildirishnomalarga telefon sozlamalaridan ruxsat bering.' : 'Eslatma sozlamalari saqlandi.');
    } catch (error) { setSettingsError(error instanceof Error ? error.message : 'Saqlab bo‘lmadi. Qayta urinib ko‘ring.'); }
    finally { notificationOperation.current = false; setBusy(false); }
  };
  const wipe = async () => {
    if (busy) return;
    setBusy(true); deleting.current = true;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    try {
      await syncReminders({ ...createInitialState().settings, enabled: false }, false, true);
      await clearState();
      const next = createInitialState(); latest.current = next; setData(next); setSettingsDraft(next.settings); setSelectedId(''); setSlot(0); setSheet(null); setLoadError(false); setSaveError(''); setTab('today'); showToast('Barcha qaydlar o‘chirildi.');
    } catch { showToast('O‘chirib bo‘lmadi. Qayta urinib ko‘ring.'); }
    finally { deleting.current = false; setBusy(false); }
  };

  if (!data) return <View style={[s.outer, { justifyContent: 'center', padding: 28 }]}><StatusBar style="dark" />{loadError ? <View style={[s.stack, { maxWidth: 400 }]}><Text style={s.heading}>Qaydlarni ochib bo‘lmadi</Text><Text style={s.text}>Saqlangan ma’lumotlar almashtirilmadi. Qayta urinib ko‘ring.</Text>{sheet === 'clear' ? <><Text style={[s.text, { color: c.danger }]}>Barcha qaydlarni butunlay o‘chirishni xohlaysizmi? Ularni qaytarib bo‘lmaydi.</Text><Button disabled={busy} onPress={() => void wipe()}>Ha, hammasini o‘chirish</Button><Button secondary onPress={() => setSheet(null)}>Bekor qilish</Button></> : <><Button onPress={reload}>Qayta urinish</Button><Button secondary onPress={() => setSheet('clear')}>Ma’lumotlarni tozalash</Button></>}</View> : <ActivityIndicator color={c.forest} />}</View>;
  const draft = settingsDraft ?? data.settings;
  const week = Array.from({ length: 7 }, (_, i) => { const d = new Date(now); d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + i); return d; });
  const sourceLink = <Pressable accessibilityRole="link" onPress={() => openSource(quote.url)} style={s.linkButton}><Text style={s.source}>{quote.source}</Text><ExternalLink size={12} color={c.forest} /></Pressable>;

  return <View style={s.outer}><StatusBar style="dark" /><View style={[s.shell, { paddingTop: insets.top }]}>
    <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={s.body}>
      <View style={s.between}><View style={s.row}><View style={s.logo}><Sprout size={21} color={c.paper} strokeWidth={1.5} /></View><Text style={s.brand}>RAHMAT</Text></View><IconButton label="Eslatma sozlamalari" onPress={() => setTab('reminders')}><Bell size={20} color={c.ink} strokeWidth={1.6} /></IconButton></View>
      {!!saveError && <View style={s.error}><Text style={s.text}>{saveError}</Text><Button secondary onPress={() => saveState(data).then(() => setSaveError('')).catch(error => setSaveError(error instanceof Error ? error.message : 'Saqlashda xato.'))}>Qayta saqlash</Button></View>}

      {tab === 'today' && <>
        <View style={{ gap: 10 }}><Text style={s.eyebrow}>{uzDate(now, true).toUpperCase()}</Text><Text style={s.title}>Yaxshilik sari,{ '\n' }har kuni.</Text><Text style={s.muted}>Kichik qadamlar. Mustahkam odatlar.</Text></View>
        <View style={s.hero}><Ornament /><Text style={[s.eyebrow, { color: '#D0DBCA' }]}>QALB UCHUN BIR LAHZA</Text><Text style={s.heroTitle}>Istig‘for bilan{ '\n' }yangidan boshlang.</Text><Pressable accessibilityRole="button" onPress={() => current ? setTab('istighfar') : addReflection()} style={({ pressed }) => [s.heroAction, pressed && s.pressed]}><Text style={s.medium}>{current ? 'Davom etish' : 'Birinchi niyatim'}</Text><ArrowRight size={18} color={c.forest} /></Pressable></View>
        <View style={[s.card, { gap: 15 }]}><View style={s.between}><View style={[s.row, { gap: 8 }]}><CircleDot size={17} color={c.forest} /><Text style={s.medium}>Bugungi istig‘for</Text></View><Text style={s.muted}><Text style={{ color: c.forest, fontFamily: fonts.bold }}>{total}</Text> / {target}</Text></View><View style={s.progressTrack}><View style={[s.progressFill, { width: `${target ? Math.min(100, total / target * 100) : 0}%` }]} /></View><Text style={s.muted}>{target ? `${active.length} ta faol niyat · har biri uchun 5 × 100` : 'Niyat qo‘shing va o‘z sur’atingizda boshlang.'}</Text></View>
        <View><View style={s.between}><Text style={s.heading}>Bugungi odatlar</Text><View style={s.pill}><Text style={[s.tiny, { color: c.forest }]}>{completedHabits.length} / {habits.length}</Text></View></View>{habits.map(h => { const done = completedHabits.includes(h.id); const Icon = h.icon; return <Pressable key={h.id} accessibilityRole="checkbox" accessibilityState={{ checked: done }} accessibilityLabel={h.title} onPress={() => update(old => toggleHabit(old, h.id, localDateKey()))} style={({ pressed }) => [s.habitRow, pressed && s.pressed]}><View style={s.habitIcon}><Icon size={19} color={c.forest} strokeWidth={1.5} /></View><View style={{ flex: 1, gap: 2 }}><Text style={[s.medium, done && { color: c.muted }]}>{h.title}</Text><Text style={s.muted}>{h.subtitle}</Text></View><View style={[s.check, done && s.checkOn]}>{done && <Check size={16} color="white" />}</View></Pressable>; })}</View>
        <View style={s.softCard}><View style={[s.between, { marginBottom: 14 }]}><Text style={s.eyebrow}>SUNNATDAN BIR ESLATMA</Text><Leaf size={18} color={c.forest} strokeWidth={1.5} /></View><Text style={s.quote}>{quote.text}</Text><View style={s.between}>{sourceLink}<IconButton label="Boshqa Sunnat eslatmasi" onPress={() => setQuoteIndex(i => (i + 1) % content.reminders.length)}><RefreshCw size={16} color={c.forest} /></IconButton></View><Text style={s.tiny}>Hadis mazmuni asosida</Text></View>
        <View style={{ gap: 16 }}><View style={s.between}><Text style={s.heading}>Shu hafta</Text><Text style={s.muted}>Har qadam qadrli</Text></View><View style={s.row}>{week.map(d => { const key = localDateKey(d); const done = (data.days[key]?.habits.length ?? 0) > 0 || Object.values(data.days[key]?.counts ?? {}).some(values => values.some(value => value > 0)); return <View key={key} style={s.weekCell}><Text style={[s.tiny, key === day && { color: c.forest }]}>{weekNames[d.getDay()]}</Text><View style={[s.weekDot, done && s.checkOn, key === day && !done && { borderColor: c.forest }]}>{done ? <Check size={15} color="white" /> : <Text style={[s.muted, key === day && { color: c.forest }]}>{d.getDate()}</Text>}</View></View>; })}</View></View>
        {!data.settings.enabled && <Pressable accessibilityRole="button" onPress={() => setTab('reminders')} style={[s.between, { paddingTop: 5 }]}><View style={[s.row, { gap: 10, flex: 1 }]}><BellRing size={18} color={c.muted} /><Text style={s.muted}>Yaxshi odatlar yodingizda bo‘lsin</Text></View><ArrowRight size={17} color={c.forest} /></Pressable>}
      </>}

      {tab === 'istighfar' && <>
        <View style={{ gap: 10 }}><Text style={s.eyebrow}>QALB XOTIRJAMLIGI</Text><Text style={s.title}>Bir lahza,{ '\n' }bir istig‘for.</Text><Text style={s.muted}>Shoshilmang. E’tibor bilan davom eting.</Text></View>
        {!current ? <View style={[s.card, s.empty]}><Sprout size={42} color={c.forest} strokeWidth={1.2} /><Text style={s.heading}>Yangi niyatdan boshlang</Text><Text style={[s.text, { textAlign: 'center' }]}>Shaxsiy qayd qo‘shing. Har bir faol niyat uchun kuniga besh mahal 100 tadan istig‘for sanaladi.</Text><Button onPress={addReflection}>Niyat qo‘shish</Button></View> : <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>{active.map(r => <Pressable key={r.id} accessibilityRole="button" accessibilityState={{ selected: r.id === current.id }} onPress={() => { setSelectedId(r.id); setSlot(0); }} style={[s.chip, r.id === current.id && s.chipOn]}><Text style={[s.medium, r.id === current.id && { color: c.paper }]}>{r.label}</Text></Pressable>)}</ScrollView>
          <View style={[s.row, { justifyContent: 'space-between' }]}>{counts.map((count, i) => <Pressable key={i} accessibilityRole="button" accessibilityLabel={`${i + 1}-mahal, ${count} ta, ${data.settings.times[i]}`} accessibilityState={{ selected: slot === i }} onPress={() => setSlot(i)} style={{ alignItems: 'center', gap: 7, minWidth: 48, paddingVertical: 4 }}><View style={[s.roundSlot, slot === i && { borderColor: c.forest, backgroundColor: c.sage }, count === 100 && s.checkOn]}>{count === 100 ? <Check size={17} color="white" /> : <Text style={s.medium}>{i + 1}</Text>}</View><Text style={s.tiny}>{data.settings.times[i]}</Text></Pressable>)}</View>
          <View style={{ alignItems: 'center', gap: 10, paddingVertical: 3 }}><Text style={{ fontSize: 29, color: c.forest, marginBottom: 5 }}>أَسْتَغْفِرُ اللّٰهَ</Text><Text style={s.eyebrow}>ASTAG‘FIRULLOH</Text><Text style={s.muted}>Allohdan mag‘firat so‘rayman</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel={`Istig‘for qo‘shish. Hozir ${counts[slot]} ta, maqsad 100`} disabled={counts[slot] === 100} onPress={() => addCount()} style={({ pressed }) => [s.counter, pressed && { backgroundColor: '#DDE6D8' }]}><Svg width={258} height={258} style={{ position: 'absolute' }}><Circle cx="129" cy="129" r="120" fill="none" stroke="#D7DFD1" strokeWidth="2" /><Circle cx="129" cy="129" r="120" fill="none" stroke={c.forest} strokeWidth="3" strokeLinecap="round" strokeDasharray={`${(counts[slot] ?? 0) / 100 * 754} 754`} rotation="-90" origin="129,129" /></Svg><Text style={s.counterNumber}>{counts[slot]}</Text><Text style={s.muted}>/ 100</Text><Text style={[s.tiny, { marginTop: 14, color: c.forest }]}>{counts[slot] === 100 ? 'BU MAHAL YAKUNLANDI' : 'SANASH UCHUN BOSING'}</Text></Pressable>
          <View style={{ alignItems: 'center', gap: 5 }}><Text style={s.medium}>{slot + 1}-mahal · {slotNames[slot]}</Text><Text style={s.muted}>Bugun bu niyat uchun {counts.reduce((a, b) => a + b, 0)} / 500</Text><Pressable accessibilityRole="button" accessibilityLabel="Oxirgi sanoqni qaytarish" disabled={counts[slot] === 0} onPress={() => addCount(-1)} style={[s.linkButton, counts[slot] === 0 && { opacity: .35 }]}><Undo2 size={15} color={c.muted} /><Text style={s.muted}>Bittasini qaytarish</Text></Pressable></View>
          {counts[slot] === 100 && slot < 4 && <Button onPress={() => setSlot(i => i + 1)}>Keyingi mahalga o‘tish</Button>}
        </>}
        <Pressable accessibilityRole="button" onPress={() => setSheet('about')} style={[s.softCard, { gap: 6 }]}><View style={[s.row, { gap: 7 }]}><Heart size={15} color={c.forest} /><Text style={s.medium}>O‘zingiz tanlagan maqsad</Text></View><Text style={s.muted}>5 × 100 — shaxsiy rejangiz. Sanoq mag‘firatning o‘lchovi emas.</Text><Text style={[s.source, { marginTop: 4 }]}>Mazmuni va manbasi</Text></Pressable>
      </>}

      {tab === 'reflections' && <>
        <View style={{ gap: 10 }}><Text style={s.eyebrow}>O‘ZINGIZ UCHUN</Text><Text style={s.title}>Muhosaba</Text><Text style={s.muted}>O‘zingizni anglash. Yaxshilikka niyat qilish.</Text></View>
        <View style={[s.softCard, { gap: 10 }]}><View style={[s.row, { gap: 8 }]}><LockKeyhole size={17} color={c.forest} /><Text style={s.medium}>Bu — sizning shaxsiy makoningiz</Text></View><Text style={s.muted}>{Platform.OS === 'web' ? 'Niyatlar va sanoqlar faqat shu brauzerda saqlanadi. Serverga shaxsiy matn yuborilmaydi. Brauzer ma’lumotlarini tozalasangiz, qaydlar o‘chadi. Telefon qulfidan foydalaning.' : 'Qaydlar shu qurilmada shifrlab saqlanadi. Hech qanday hisob yoki bulutga yuborish yo‘q. Telefon qulfidan foydalaning.'}</Text><Text style={s.muted}>Tafsilot yozishingiz shart emas. Bildirishnomalarda shaxsiy qaydlar ko‘rsatilmaydi.</Text></View>
        <Button onPress={addReflection}>＋  Yangi niyat qo‘shish</Button>
        <View style={s.between}><Text style={s.heading}>{archived ? 'Arxivdagi niyatlar' : 'Faol niyatlar'}</Text><Pressable accessibilityRole="button" onPress={() => setArchived(v => !v)} style={s.linkButton}><Archive size={15} color={c.forest} /><Text style={s.source}>{archived ? 'Faollar' : 'Arxiv'}</Text></Pressable></View>
        {data.reflections.filter(r => r.archived === archived).length === 0 && <View style={s.empty}><BookHeart size={42} color={c.muted} strokeWidth={1.2} /><Text style={s.heading}>{archived ? 'Arxiv hozircha bo‘sh' : 'Har kun — yangi imkon'}</Text><Text style={[s.muted, { textAlign: 'center' }]}>{archived ? 'Tanaffusga qo‘yilgan niyatlar shu yerda turadi.' : 'Birinchi niyatingizni qo‘shing. Oddiy nomning o‘zi yetarli.'}</Text></View>}
        {data.reflections.filter(r => r.archived === archived).map(r => { const sum = getCounts(data, r.id, day).reduce((a, b) => a + b, 0); return <View key={r.id} style={[s.card, { gap: 13 }]}><View style={s.between}><View style={{ flex: 1, gap: 4 }}><Text style={s.heading}>{r.label}</Text><Text style={s.tiny}>{uzDate(new Date(r.createdAt))} · {r.archived ? 'Tanaffusda' : 'Kuniga 5 × 100'}</Text></View><BookHeart size={22} color={c.forest} strokeWidth={1.3} /></View>{r.note ? <Text style={s.text}>{r.note}</Text> : null}{!r.archived && <><View style={s.progressTrack}><View style={[s.progressFill, { width: `${sum / 5}%` }]} /></View><View style={s.between}><Text style={s.muted}>Bugun {sum} / 500</Text><Pressable accessibilityRole="button" onPress={() => { setSelectedId(r.id); setSlot(0); setTab('istighfar'); }} style={s.linkButton}><Text style={s.source}>Istig‘for aytish</Text><ArrowRight size={15} color={c.forest} /></Pressable></View></>}<View style={[s.between, { borderTopWidth: 1, borderTopColor: c.line, paddingTop: 6 }]}><Pressable accessibilityRole="button" onPress={() => update(old => ({ ...old, reflections: old.reflections.map(item => item.id === r.id ? { ...item, archived: !item.archived } : item) }))} style={s.linkButton}><Archive size={15} color={c.muted} /><Text style={s.muted}>{r.archived ? 'Faollashtirish' : 'Tanaffusga qo‘yish'}</Text></Pressable><IconButton label={`${r.label} ni o‘chirish`} onPress={() => setDeleteId(r.id)}><Trash2 size={17} color={c.danger} /></IconButton></View></View>; })}
        <Text style={[s.muted, { textAlign: 'center' }]}>O‘tgan kunlar qarzga aylanmaydi.{ '\n' }Bugungi qadamdan davom eting.</Text>
      </>}

      {tab === 'reminders' && <>
        <View style={{ gap: 10 }}><Text style={s.eyebrow}>KUN DAVOMIDA YONINGIZDA</Text><Text style={s.title}>Yaxshilikni{ '\n' }yodga oling.</Text><Text style={s.muted}>Kuningizga mos, muloyim eslatmalar.</Text></View>
        {Platform.OS === 'web' && <View style={[s.softCard, { gap: 10 }]}><Text style={s.medium}>{pwa.installed ? 'Rahmat bosh ekraningizda' : 'Rahmatni telefoningizga o‘rnating'}</Text><Text style={s.muted}>{pwa.installed ? 'Eslatmalarni yoqing va ruxsat so‘ralganda “Ruxsat berish”ni tanlang.' : pwa.ios ? 'Safari → Ulashish → Bosh ekranga qo‘shish → Qo‘shish. So‘ng Rahmat belgisidan ochib, bildirishnomalarni yoqing.' : 'Brauzer menyusidan “Ilovani o‘rnatish” yoki “Bosh ekranga qo‘shish”ni tanlang.'}</Text><Text style={s.muted}>iPhone eslatmalari uchun iOS 16.4 yoki yangiroq versiya kerak. Eslatma vaqtlari va telefonning bildirishnoma manzili serverda saqlanadi; niyat matnlari yuborilmaydi.</Text>{!pwa.secure && <Text style={[s.muted, { color: c.danger }]}>O‘rnatish va eslatmalar uchun xavfsiz HTTPS havolasidan oching.</Text>}</View>}
        <View style={[s.card, { gap: 12 }]}><View style={s.between}><View style={[s.row, { gap: 10, flex: 1 }]}><BellRing size={21} color={c.forest} /><Text style={[s.medium, { flex: 1 }]}>Bildirishnomalar</Text></View><Switch accessibilityLabel="Bildirishnomalarni yoqish" value={data.settings.enabled && notificationState?.status === 'enabled'} onValueChange={value => void applySettings(value)} disabled={busy} trackColor={{ false: '#D3D8CE', true: c.forest }} thumbColor={c.white} /></View><Text style={s.muted}>{notificationState?.status === 'denied' ? 'Ruxsat berilmagan. Telefon sozlamalarini oching.' : data.settings.enabled && notificationState?.status === 'enabled' ? 'Yoqilgan · shaxsiy qaydlarsiz eslatmalar' : 'Istig‘for va Sunnat uchun eslatmalarni yoqing.'}</Text>{notificationState?.status === 'denied' && Platform.OS !== 'web' && <Button secondary onPress={() => Linking.openSettings().catch(() => showToast('Telefon sozlamalarini qo‘lda oching.'))}>Telefon sozlamalari</Button>}{notificationState?.status === 'denied' && Platform.OS === 'web' && <Text style={s.muted}>iPhone: Sozlamalar → Bildirishnomalar → Rahmat → Ruxsat berish.</Text>}{notificationError ? <Text style={[s.muted, { color: c.danger }]}>{notificationError}</Text> : null}</View>
        <View style={s.stack}><Text style={s.heading}>Sizning faol kuningiz</Text><Text style={s.muted}>Eslatmalar shu oraliqda rejalashtiriladi.</Text><View style={[s.row, { gap: 12 }]}>{(['dayStart', 'dayEnd'] as const).map(key => <View key={key} style={[s.card, { flex: 1, padding: 14, gap: 10 }]}><Text style={s.tiny}>{key === 'dayStart' ? 'BOSHLANISHI' : 'TUGASHI'}</Text><Text style={s.heading}>{hour(draft[key])}</Text><View style={s.between}><IconButton disabled={busy} label={`${key === 'dayStart' ? 'Boshlanish' : 'Tugash'} vaqtini bir soat kamaytirish`} onPress={() => setSettingsDraft({ ...draft, [key]: Math.max(key === 'dayStart' ? 0 : 1, draft[key] - 1) })}><Minus size={16} color={c.forest} /></IconButton><IconButton disabled={busy} label={`${key === 'dayStart' ? 'Boshlanish' : 'Tugash'} vaqtini bir soat oshirish`} onPress={() => setSettingsDraft({ ...draft, [key]: Math.min(key === 'dayStart' ? 23 : 24, draft[key] + 1) })}><Plus size={16} color={c.forest} /></IconButton></View></View>)}</View></View>
        <View style={s.stack}><Text style={s.heading}>Istig‘for uchun 5 mahal</Text><Text style={s.muted}>Har bir faol niyat uchun 100 tadan. Bir vaqtda bitta umumiy eslatma keladi.</Text>{draft.times.map((t, i) => <View key={i} style={s.between}><View style={[s.row, { gap: 12, flex: 1 }]}><View style={[s.roundSlot, { width: 33, height: 33, flexShrink: 0 }]}><Text style={s.muted}>{i + 1}</Text></View><Text style={[s.text, { flex: 1 }]}>{slotNames[i]}</Text></View><TextInput editable={!busy} accessibilityLabel={`${i + 1}-mahal vaqti`} value={t} maxLength={5} autoCorrect={false} keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'} onChangeText={value => setSettingsDraft({ ...draft, times: draft.times.map((v, index) => index === i ? value : v) })} style={[s.input, { width: 82, flexShrink: 0, textAlign: 'center', paddingHorizontal: 8 }]} /></View>)}</View>
        <View style={[s.softCard, { gap: 14 }]}><View style={[s.row, { gap: 8 }]}><Leaf size={18} color={c.forest} /><Text style={s.medium}>Sunnatdan bir eslatma</Text></View><Text style={s.muted}>Kun davomida tasodifiy vaqtlarda hadisga tayangan bir jumla.</Text><View style={s.row}>{([1, 2, 3] as const).map(n => <Pressable disabled={busy} key={n} accessibilityRole="button" accessibilityState={{ selected: draft.sunnahPerDay === n }} onPress={() => setSettingsDraft({ ...draft, sunnahPerDay: n })} style={[s.chip, { flex: 1, alignItems: 'center', paddingHorizontal: 8 }, draft.sunnahPerDay === n && s.chipOn]}><Text style={[s.medium, draft.sunnahPerDay === n && { color: c.paper }]}>{n} marta</Text></Pressable>)}</View></View>
        {settingsError ? <View style={s.error}><Text style={[s.text, { color: c.danger }]}>{settingsError}</Text></View> : null}
        <Button disabled={busy} onPress={() => void applySettings()}>{busy ? 'Saqlanmoqda…' : 'Sozlamalarni saqlash'}</Button>
        <Button secondary disabled={busy} onPress={async () => { if (busy || notificationOperation.current) return; notificationOperation.current = true; setBusy(true); setTestStatus(''); try { const result = await sendTestNotification(); const message = result.status === 'install-required' ? 'Avval Rahmatni bosh ekranga qo‘shib, o‘sha belgidan oching.' : result.status === 'unavailable' || result.status === 'preview' ? 'Bu brauzer bildirishnomalarni qo‘llamaydi.' : result.status === 'denied' ? 'Avval bildirishnomalarni yoqing.' : 'Sinov rejalashtirildi. Telefonni qulflang va bir necha soniyadan so‘ng tekshiring.'; setTestStatus(message); showToast(message); } catch (error) { const message = error instanceof Error ? error.message : 'Sinov eslatmasini yuborib bo‘lmadi.'; setTestStatus(message); showToast(message); } finally { notificationOperation.current = false; setBusy(false); } }}>Sinov eslatmasi</Button>
        {Platform.OS === 'web' && <Button secondary disabled={busy} onPress={async () => { if (busy) return; setBusy(true); try { setTestStatus(await getTestNotificationStatus()); } catch (error) { setTestStatus(error instanceof Error ? error.message : 'Holatni tekshirib bo‘lmadi.'); } finally { setBusy(false); } }}>Sinov holatini tekshirish</Button>}
        {!!testStatus && <Text accessibilityRole="alert" style={s.muted}>{testStatus}</Text>}
        <Text style={s.muted}>Vaqtlar telefoningizning mahalliy vaqtiga mos. Sayohatdan keyin ilovani oching — vaqt mintaqasi yangilanadi. Bildirishnomalar internet aloqasi va telefon sozlamalariga qarab kechikishi mumkin.</Text>
        <View style={{ borderTopWidth: 1, borderTopColor: c.line, paddingTop: 14 }}><Pressable accessibilityRole="button" onPress={() => setSheet('about')} style={s.linkButton}><ShieldCheck size={17} color={c.forest} /><Text style={s.text}>Ilova va manbalar haqida</Text><ChevronRight size={17} color={c.muted} /></Pressable><Pressable accessibilityRole="button" onPress={() => setSheet('clear')} style={s.linkButton}><Trash2 size={17} color={c.danger} /><Text style={[s.text, { color: c.danger }]}>Barcha ma’lumotlarni o‘chirish</Text></Pressable><Text style={[s.tiny, { marginTop: 15, textAlign: 'center' }]}>RAHMAT · 1.0{ '\n' }Kichik qadamlar, go‘zal odatlar.</Text></View>
      </>}
    </ScrollView>
    <View style={[s.tabbar, { paddingBottom: Math.max(insets.bottom, 10) }]}>{tabs.map(item => { const Icon = item.icon; return <Pressable key={item.key} accessibilityRole="tab" accessibilityLabel={item.label} accessibilityState={{ selected: tab === item.key }} onPress={() => setTab(item.key)} style={s.tab}><View style={[s.tabIcon, tab === item.key && { backgroundColor: c.sage }]}><Icon size={21} color={tab === item.key ? c.forest : c.muted} strokeWidth={tab === item.key ? 1.9 : 1.4} /></View><Text style={[s.tabText, tab === item.key && { color: c.forest, fontFamily: fonts.bold }]}>{item.label}</Text></Pressable>; })}</View>
    {!!toast && <View style={s.toast} accessibilityLiveRegion="polite"><Text style={[s.text, { color: c.paper, fontSize: 13 }]}>{toast}</Text></View>}

    <Modal transparent visible={sheet !== null || deleteId !== null} animationType="fade" onRequestClose={() => { if (!busy) { setSheet(null); setDeleteId(null); } }}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalShade}><View style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 20) }]}><View style={s.handle} /><ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={s.stack}>
      <View style={s.between}><Text style={s.heading}>{deleteId ? 'Niyatni o‘chirish' : sheet === 'add' ? 'Yangi niyat' : sheet === 'clear' ? 'Yangidan boshlash' : 'Niyat va manbalar'}</Text><IconButton label="Yopish" onPress={() => { if (!busy) { setSheet(null); setDeleteId(null); } }}><X size={20} color={c.forest} /></IconButton></View>
      {sheet === 'add' && <><Text style={s.muted}>Bu makon baholash uchun emas, yaxshilikka qaytish uchun.</Text><Text style={s.medium}>Niyat nomi · ixtiyoriy</Text><TextInput accessibilityLabel="Niyat nomi" value={label} onChangeText={setLabel} maxLength={48} placeholder="Masalan, sabrliroq bo‘lish" placeholderTextColor={c.muted} style={s.input} /><Text style={s.medium}>Shaxsiy eslatma · ixtiyoriy</Text><TextInput accessibilityLabel="Shaxsiy eslatma" value={note} onChangeText={setNote} multiline maxLength={120} placeholder="Yozmasangiz ham bo‘ladi…" placeholderTextColor={c.muted} style={[s.input, { minHeight: 96, textAlignVertical: 'top' }]} /><View style={[s.softCard, { gap: 5 }]}><Text style={s.medium}>Har kuni 5 mahal × 100 istig‘for</Text><Text style={s.muted}>Bu o‘zingiz tanlagan maqsad. Istalgan payt niyatni tanaffusga qo‘yishingiz yoki o‘chirishingiz mumkin.</Text></View><Button onPress={saveReflection}>Niyatni saqlash</Button></>}
      {sheet === 'about' && <><Text style={s.text}>{content.istighfarNote.text}</Text><Pressable accessibilityRole="link" onPress={() => openSource(content.istighfarNote.url)} style={s.linkButton}><Text style={s.source}>{content.istighfarNote.source}</Text><ExternalLink size={13} color={c.forest} /></Pressable><Text style={s.muted}>{content.istighfarNote.progressNotice}</Text><Text style={s.heading}>Sunnat eslatmalari</Text><Text style={s.muted}>{content.contentNotice}</Text>{content.reminders.map(r => <Pressable key={r.id} accessibilityRole="link" onPress={() => openSource(r.url)} style={{ gap: 4, paddingVertical: 8 }}><Text style={s.medium}>{r.title}</Text><Text style={s.source}>{r.source} ↗</Text></Pressable>)}<Text style={s.muted}>Har bir faol niyatning sanoqlari alohida saqlanadi. Yangi kun yangi sanoqdan boshlanadi. O‘tgan 30 kunlik odat va sanoqlar saqlanadi.</Text></>}
      {sheet === 'clear' && <><Text style={s.text}>Barcha niyatlar, sanoqlar va odatlar o‘chiriladi. Eslatmalar ham o‘chadi. Bu amalni ortga qaytarib bo‘lmaydi.</Text><Button disabled={busy} onPress={() => void wipe()}>{busy ? 'O‘chirilmoqda…' : 'Ha, hammasini o‘chirish'}</Button><Button secondary onPress={() => setSheet(null)}>Saqlab qolish</Button></>}
      {deleteId && <><Text style={s.text}>Ushbu niyat va uning sanoqlari o‘chiriladi. Boshqa niyatlar saqlanib qoladi.</Text><Button onPress={() => { const id = deleteId; update(old => ({ ...old, reflections: old.reflections.filter(r => r.id !== id), days: Object.fromEntries(Object.entries(old.days).map(([key, value]) => { const nextCounts = { ...value.counts }; delete nextCounts[id]; return [key, { ...value, counts: nextCounts }]; })) })); setDeleteId(null); showToast('Niyat o‘chirildi.'); }}>Niyatni o‘chirish</Button><Button secondary onPress={() => setDeleteId(null)}>Saqlab qolish</Button></>}
    </ScrollView></View></KeyboardAvoidingView></Modal>
  </View></View>;
}
