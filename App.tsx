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
import { Archive, ArrowRight, Bell, BellRing, BookHeart, CalendarDays, Check, ChevronDown, ChevronRight, ChevronUp, CircleDot, Coffee, ExternalLink, Heart, Leaf, LockKeyhole, Minus, Moon, Pencil, Plus, RefreshCw, ShieldCheck, Sparkles, Sprout, Sun, Trash2, Undo2, X } from 'lucide-react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import content from './src/data/sunnah.json';
import adhkar from './src/data/adhkar.json';
import muhosaba from './src/data/muhosaba.json';
import {
  activityCalendar, addCustomHabit, consistencySummary, createInitialState, createReflection, customHabitsFor, dayHasActivity,
  deleteEvening, eveningHistory, getDayTarget, getDayTotal, getEvening, getReflectionTotal, getSessionCounts, incrementCount,
  istighfarSlots, localDateKey, MAX_REFLECTIONS, reflectionTarget, removeCustomHabit, saveEvening, setRoutine, shiftDateKey,
  STARTER_ROUTINE, toggleHabit, type AppState, type LockMode,
} from './src/domain/model';
import { createPinRecord, lockWith } from './src/domain/lock';
import { fitsTimeCategory } from './src/domain/schedule';
import { clearState, loadState, saveState } from './src/services/storage';
import { ReminderResult, ReminderSettings, getTestNotificationStatus, sendTestNotification, subscribeToReminderOpen, syncReminders } from './src/services/notifications';
import { biometricsAvailable } from './src/services/biometrics';
import { colors as c, fonts, s } from './src/theme';
import { getPwaState, preparePwa } from './src/services/pwa';
import { Button, Choice, IconButton, ReviewNotice, Segmented } from './src/ui/controls';
import { GoalPicker } from './src/ui/GoalPicker';
import { LockScreen } from './src/ui/LockScreen';
import { PinPad } from './src/ui/PinPad';
import { AdhkarPanel, TASBIH_START, type TasbihProgress } from './src/ui/AdhkarPanel';
import { ConsistencyView } from './src/ui/ConsistencyView';
import { HabitEditor, weekdaySummary } from './src/ui/HabitEditor';
import { EveningEditor } from './src/ui/EveningEditor';

type Tab = 'today' | 'istighfar' | 'reflections' | 'reminders';
type Sheet = 'add' | 'about' | 'clear' | 'goal' | 'habits' | 'consistency' | 'evening' | 'lock';
const tabs = [{ key: 'today', label: 'Bugun', icon: Sun }, { key: 'istighfar', label: 'Istig‘for', icon: CircleDot }, { key: 'reflections', label: 'Muhosaba', icon: BookHeart }, { key: 'reminders', label: 'Eslatmalar', icon: Bell }] as const;
const defaultHabits = [{ id: 'meal', title: 'Bismillah bilan boshlash', subtitle: 'Taom oldidan bir go‘zal odat', icon: Coffee }, { id: 'kindness', title: 'Yaxshi so‘z aytish', subtitle: 'Yoki sukutni tanlash', icon: Heart }, { id: 'family', title: 'Oilaga yordam berish', subtitle: 'Yaxshilik yaqinlardan boshlanadi', icon: Sprout }];
const slotNames = ['Tong', 'Choshgoh', 'Peshindan so‘ng', 'Kunning ikkinchi yarmi', 'Oqshom'];
const weekNames = ['Ya', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh'];
const months = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
const weekdays = ['yakshanba', 'dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba'];
const categoryNames: Record<string, string> = { morning: 'Tong', daytime: 'Kun davomida', mealtime: 'Taom paytida', evening: 'Kechqurun', anytime: 'Istalgan payt' };
const lockModes: readonly { key: LockMode; label: string }[] = [{ key: 'off', label: 'O‘chiq' }, { key: 'app', label: 'Butun ilova' }, { key: 'muhosaba', label: 'Faqat Muhosaba' }];
const uzDate = (date: Date, withWeekday = false) => `${date.getDate()}-${months[date.getMonth()]}${withWeekday ? `, ${weekdays[date.getDay()]}` : ''}`;
const keyDate = (dateKey: string, withWeekday = false) => uzDate(new Date(`${dateKey}T12:00:00`), withWeekday);
const hour = (v: number) => `${String(v).padStart(2, '0')}:00`;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const steady = content.reminders.find(item => item.id === 'small-and-steady')!;

/** Open on a Sunnah reminder that suits the time of day, so morning advice is not shown at night. */
function initialQuoteIndex(): number {
  const now = new Date();
  const minute = now.getHours() * 60 + now.getMinutes();
  const all = content.reminders.map((item, index) => ({ item, index }));
  const timely = all.filter(({ item }) => fitsTimeCategory(item.timeCategory, minute));
  const pool = timely.length ? timely : all;
  return pool[Math.floor(Math.random() * pool.length)]!.index;
}

function weeklyLine({ active, total }: { active: number; total: number }): string {
  if (active === 0) return 'Bugun — yangidan boshlash uchun yaxshi kun.';
  if (active === total) return `So‘nggi ${total} kunning har birida yaxshi amal qayd etildi.`;
  return `So‘nggi ${total} kunning ${active} kunida yaxshi amal qayd etildi. Har qadam qadrli.`;
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
  const [quoteIndex, setQuoteIndex] = useState(initialQuoteIndex);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteEveningKey, setDeleteEveningKey] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [note, setNote] = useState('');
  const [routine, setRoutineDraft] = useState<{ sessions: number; target: number }>({ ...STARTER_ROUTINE });
  const [goal, setGoal] = useState<{ id: string; sessions: number; target: number } | null>(null);
  const [archived, setArchived] = useState(false);
  const [toast, setToast] = useState('');
  const [notificationState, setNotificationState] = useState<ReminderResult | null>(null);
  const [notificationError, setNotificationError] = useState('');
  const [testStatus, setTestStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState<ReminderSettings | null>(null);
  const [settingsError, setSettingsError] = useState('');
  const [istighfarView, setIstighfarView] = useState<'counter' | 'adhkar'>('counter');
  const [tasbih, setTasbih] = useState<TasbihProgress>({ ...TASBIH_START });
  const [openEvening, setOpenEvening] = useState<string | null>(null);
  // Lock state lives only in memory: every cold start begins locked.
  const [locked, setLocked] = useState(true);
  const [muhosabaOpen, setMuhosabaOpen] = useState(false);
  const [bioReady, setBioReady] = useState(false);
  const [lockStep, setLockStep] = useState<'verify' | 'menu' | 'new' | 'confirm'>('menu');
  const [pinDraft, setPinDraft] = useState('');
  const [pinFirst, setPinFirst] = useState('');
  const [pendingMode, setPendingMode] = useState<LockMode>('app');
  const [lockMessage, setLockMessage] = useState('');
  const [savingPin, setSavingPin] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef<AppState | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scroll = useRef<ScrollView>(null);
  const deleting = useRef(false);
  const notificationOperation = useRef(false);
  // The sheet keeps its last content while it fades out, instead of flashing an empty panel.
  const lastSheetBody = useRef<React.ReactNode>(null);
  const day = localDateKey(now);
  const active = data?.reflections.filter(r => !r.archived) ?? [];
  const current = active.find(r => r.id === selectedId) ?? active[0];
  const slotIndex = current ? Math.min(slot, current.sessions - 1) : 0;
  const counts = data && current ? getSessionCounts(data, current, day) : [];
  const total = data ? getDayTotal(data, day) : 0;
  const target = data ? getDayTarget(data) : 0;
  const slots = data ? istighfarSlots(data) : 0;
  const quote = content.reminders[quoteIndex] ?? content.reminders[0]!;
  const completedHabits = data?.days[day]?.habits ?? [];
  const todaysHabits = data ? [...defaultHabits, ...customHabitsFor(data, day).map(habit => ({ id: habit.id, title: habit.title, subtitle: weekdaySummary(habit.weekdays), icon: Sparkles }))] : [];
  const doneHabits = todaysHabits.filter(habit => completedHabits.includes(habit.id)).length;
  const lockMode = data?.lock.mode ?? 'off';
  const privateHidden = lockMode === 'muhosaba' && !muhosabaOpen;
  const todayEvening = data ? getEvening(data, day) : undefined;
  const yesterdayIntention = data ? getEvening(data, shiftDateKey(day, -1))?.intention.trim() : undefined;
  const summary = data ? consistencySummary(data, day) : { active: 0, total: 7 };
  const reflectionName = (index: number, labelText: string) => privateHidden ? `Niyat ${index + 1}` : labelText;
  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 3600);
  }, []);
  const openSource = (url: string) => { Linking.openURL(url).catch(() => showToast('Manbani ochib bo‘lmadi. Internet aloqasini tekshiring.')); };
  const tap = () => { if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {}); };
  const reload = useCallback(() => {
    setLoadError(false);
    loadState().then(state => { setData(state); setSettingsDraft(state.settings); }).catch(() => setLoadError(true));
  }, []);
  useEffect(reload, [reload]);
  useEffect(() => { if (Platform.OS === 'web') void preparePwa().catch(() => {}); }, []);
  useEffect(() => { void biometricsAvailable().then(setBioReady); }, []);
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
      if (state === 'active') { setNow(new Date()); setPwa(getPwaState()); if (latest.current && !notificationOperation.current) syncReminders(latest.current.settings, istighfarSlots(latest.current)).then(result => setNotificationState(previous => result.status === 'disabled' && previous?.status === 'denied' ? previous : result)).catch(() => setNotificationError('Eslatmalarni yangilab bo‘lmadi. Qayta urinib ko‘ring.')); return; }
      // Only a real background locks: iOS reports "inactive" while its own Face ID prompt is open.
      if (state === 'background') {
        setLocked(true); setMuhosabaOpen(false);
        if (latest.current && latest.current.lock.mode !== 'off') { setSheet(null); setDeleteId(null); setDeleteEveningKey(null); }
      }
      if (latest.current && !deleting.current) { if (saveTimer.current) clearTimeout(saveTimer.current); saveState(latest.current).catch(error => setSaveError(error instanceof Error ? error.message : 'Saqlashda xato.')); }
    });
    return () => { clearInterval(timer); sub.remove(); if (toastTimer.current) clearTimeout(toastTimer.current); };
  }, []);
  const settingsKey = JSON.stringify(data?.settings);
  useEffect(() => {
    if (!data || busy || notificationOperation.current) return;
    let live = true;
    syncReminders(data.settings, slots).then(result => { if (live) { setNotificationState(previous => result.status === 'disabled' && previous?.status === 'denied' ? previous : result); setNotificationError(''); } }).catch(() => { if (live) setNotificationError('Eslatmalarni sozlab bo‘lmadi. Qayta urinib ko‘ring.'); });
    return () => { live = false; };
  }, [settingsKey, slots, day, busy]);
  useEffect(() => subscribeToReminderOpen((destination, quoteId) => { setTab(destination); const index = content.reminders.findIndex(item => item.id === quoteId); if (index >= 0) setQuoteIndex(index); }), []);
  useEffect(() => { scroll.current?.scrollTo({ y: 0, animated: false }); if (tab !== 'reflections') setMuhosabaOpen(false); }, [tab]);
  const update = (fn: (state: AppState) => AppState) => setData(old => old ? fn(old) : old);
  const closeSheet = () => { setSheet(null); setDeleteId(null); setDeleteEveningKey(null); setGoal(null); };
  const addReflection = () => {
    if (!data) return;
    if (data.reflections.length >= MAX_REFLECTIONS) { showToast('20 ta niyat saqlash mumkin. Avval keraksiz qaydni o‘chiring.'); return; }
    setLabel(''); setNote(''); setRoutineDraft({ ...STARTER_ROUTINE }); setSheet('add');
  };
  const saveReflection = () => {
    if (!data) return;
    const created = createReflection(data, { label, note, ...routine });
    if (!created) return;
    const reflection = created.state.reflections.at(-1)!;
    update(old => old.reflections.length >= MAX_REFLECTIONS ? old : { ...old, reflections: [...old.reflections, reflection] });
    setSelectedId(reflection.id); setSlot(0); setSheet(null); setTab('istighfar'); setIstighfarView('counter'); showToast('Niyat qo‘shildi. Kichik qadamdan boshlang.');
  };
  const openGoal = (id: string) => {
    const reflection = data?.reflections.find(item => item.id === id);
    if (!reflection) return;
    setGoal({ id, sessions: reflection.sessions, target: reflection.target }); setSheet('goal');
  };
  const saveGoal = () => {
    if (!goal) return;
    update(old => setRoutine(old, goal.id, goal.sessions, goal.target));
    setSlot(value => Math.min(value, goal.sessions - 1)); closeSheet(); showToast('Kunlik reja yangilandi. Bugungi sanoqlar saqlandi.');
  };
  const addCount = (delta = 1) => {
    if (!current) return;
    update(old => incrementCount(old, current.id, slotIndex, delta, localDateKey()));
    if (delta > 0) tap();
  };
  const validateSettings = (settings: ReminderSettings) => {
    if (settings.dayStart >= settings.dayEnd) return 'Kunning tugashi boshlanishidan keyin bo‘lishi kerak.';
    if (settings.times.some(t => !TIME.test(t))) return 'Vaqtni SS:DD shaklida kiriting, masalan 08:00.';
    const minutes = settings.times.map(t => Number(t.slice(0, 2)) * 60 + Number(t.slice(3)));
    if (new Set(minutes).size !== 5) return 'Beshta vaqt bir-biridan farq qilishi kerak.';
    if (minutes.some(t => t < settings.dayStart * 60 || t >= settings.dayEnd * 60)) return 'Barcha vaqtlarni faol kun oralig‘ida belgilang.';
    if (minutes.some((t, i) => i > 0 && t <= minutes[i - 1]!)) return 'Vaqtlarni ertalabdan kechgacha ketma-ket kiriting.';
    if (settings.eveningTime && !TIME.test(settings.eveningTime)) return 'Kechki muhosaba vaqtini SS:DD shaklida kiriting, masalan 21:00.';
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
      const result = await syncReminders(next, slots, true);
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
      await syncReminders({ ...createInitialState().settings, enabled: false }, 0, true);
      await clearState();
      const next = createInitialState(); latest.current = next; setData(next); setSettingsDraft(next.settings); setSelectedId(''); setSlot(0); closeSheet(); setLoadError(false); setSaveError(''); setTab('today');
      setLocked(false); setMuhosabaOpen(false); setTasbih({ ...TASBIH_START }); setOpenEvening(null);
      showToast('Barcha qaydlar o‘chirildi.');
    } catch { showToast('O‘chirib bo‘lmadi. Qayta urinib ko‘ring.'); }
    finally { deleting.current = false; setBusy(false); }
  };
  const openLockSheet = () => { setLockMessage(''); setPinDraft(''); setPinFirst(''); setLockStep(data?.lock.pin ? 'verify' : 'menu'); setSheet('lock'); };
  const chooseLockMode = (mode: LockMode) => {
    if (!data || mode === data.lock.mode) return;
    if (mode === 'off') { update(old => ({ ...old, lock: lockWith('off', null, false) })); showToast('Qulf o‘chirildi. PIN kod unutildi.'); return; }
    if (data.lock.pin) {
      update(old => old.lock.pin ? { ...old, lock: lockWith(mode, old.lock.pin, old.lock.biometrics) } : old);
      setLocked(false); setMuhosabaOpen(false);
      showToast(mode === 'app' ? 'Endi ilova ochilganda PIN kod so‘raladi.' : 'Endi Muhosaba ochilganda PIN kod so‘raladi.');
      return;
    }
    setPendingMode(mode); setPinDraft(''); setPinFirst(''); setLockMessage(''); setLockStep('new');
  };
  const confirmPin = (value: string) => {
    setPinDraft(value); setLockMessage('');
    if (value.length !== pinFirst.length) return;
    if (value !== pinFirst) { setLockMessage('PIN kodlar mos kelmadi. Qaytadan kiriting.'); setPinDraft(''); setPinFirst(''); setLockStep('new'); return; }
    setSavingPin(true);
    // Let the last dot render before the short hashing work runs.
    setTimeout(() => {
      const record = createPinRecord(value);
      update(old => ({ ...old, lock: lockWith(pendingMode, record, old.lock.mode === 'off' ? false : old.lock.biometrics) }));
      setSavingPin(false); setPinDraft(''); setPinFirst(''); setLockStep('menu'); setLocked(false); setMuhosabaOpen(false);
      showToast('PIN kod saqlandi. Uni unutmang: tiklashning yagona yo‘li — barcha ma’lumotlarni o‘chirish.');
    }, 30);
  };

  if (!data) return <View style={[s.outer, { justifyContent: 'center', padding: 28 }]}><StatusBar style="dark" />{loadError ? <View style={[s.stack, { maxWidth: 400 }]}><Text style={s.heading}>Qaydlarni ochib bo‘lmadi</Text><Text style={s.text}>Saqlangan ma’lumotlar almashtirilmadi. Qayta urinib ko‘ring.</Text>{sheet === 'clear' ? <><Text style={[s.text, { color: c.danger }]}>Barcha qaydlarni butunlay o‘chirishni xohlaysizmi? Ularni qaytarib bo‘lmaydi.</Text><Button disabled={busy} onPress={() => void wipe()}>Ha, hammasini o‘chirish</Button><Button secondary onPress={() => setSheet(null)}>Bekor qilish</Button></> : <><Button onPress={reload}>Qayta urinish</Button><Button secondary onPress={() => setSheet('clear')}>Ma’lumotlarni tozalash</Button></>}</View> : <ActivityIndicator color={c.forest} />}</View>;
  if (data.lock.mode === 'app' && locked && data.lock.pin) {
    return <View style={s.outer}><StatusBar style="dark" /><View style={[s.shell, { paddingTop: insets.top + 32, paddingHorizontal: 24, justifyContent: 'center' }]}>
      <LockScreen key={bioReady ? 'device' : 'pin'} pin={data.lock.pin} biometrics={data.lock.biometrics && bioReady} title="Rahmat qulflangan" subtitle="Davom etish uchun PIN kodni kiriting." onUnlock={() => setLocked(false)} onForgot={wipe} />
    </View></View>;
  }
  const draft = settingsDraft ?? data.settings;
  const week = Array.from({ length: 7 }, (_, i) => { const d = new Date(now); d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + i); return d; });
  const sourceLink = <Pressable accessibilityRole="link" onPress={() => openSource(quote.url)} style={s.linkButton}><Text style={s.source}>{quote.source}</Text><ExternalLink size={12} color={c.forest} /></Pressable>;
  const history = eveningHistory(data).filter(item => item.dateKey !== day);
  const eveningRow = (title: string, text: string) => text ? <View style={{ gap: 2 }}><Text style={s.tiny}>{title.toUpperCase()}</Text><Text style={s.text}>{text}</Text></View> : null;
  const modalOpen = sheet !== null || deleteId !== null || deleteEveningKey !== null;
  const sheetBody = modalOpen ? <>
      <View style={s.between}><Text style={s.heading}>{deleteId ? 'Niyatni o‘chirish' : deleteEveningKey ? 'Yozuvni o‘chirish' : sheet === 'add' ? 'Yangi niyat' : sheet === 'clear' ? 'Yangidan boshlash' : sheet === 'goal' ? 'Kunlik reja' : sheet === 'habits' ? 'Odatlarim' : sheet === 'consistency' ? 'So‘nggi 30 kun' : sheet === 'evening' ? muhosaba.title : sheet === 'lock' ? 'Ilova qulfi' : 'Niyat va manbalar'}</Text><IconButton label="Yopish" onPress={() => { if (!busy) closeSheet(); }}><X size={20} color={c.forest} /></IconButton></View>
      {sheet === 'add' && !deleteId && !deleteEveningKey && <><Text style={s.muted}>Bu makon baholash uchun emas, yaxshilikka qaytish uchun.</Text><Text style={s.medium}>Niyat nomi · ixtiyoriy</Text><TextInput accessibilityLabel="Niyat nomi" value={label} onChangeText={setLabel} maxLength={48} placeholder="Masalan, sabrliroq bo‘lish" placeholderTextColor={c.muted} style={s.input} /><Text style={s.medium}>Shaxsiy eslatma · ixtiyoriy</Text><TextInput accessibilityLabel="Shaxsiy eslatma" value={note} onChangeText={setNote} multiline maxLength={120} placeholder="Yozmasangiz ham bo‘ladi…" placeholderTextColor={c.muted} style={[s.input, { minHeight: 96, textAlignVertical: 'top' }]} /><View style={[s.softCard, { gap: 12 }]}><Text style={s.medium}>Kunlik istig‘for rejasi</Text><GoalPicker sessions={routine.sessions} target={routine.target} onChange={(sessions, value) => setRoutineDraft({ sessions, target: value })} /><Text style={s.muted}>Bu o‘zingiz tanlagan maqsad. Istalgan payt rejani o‘zgartirishingiz, niyatni tanaffusga qo‘yishingiz yoki o‘chirishingiz mumkin.</Text></View><Button onPress={saveReflection}>Niyatni saqlash</Button></>}
      {sheet === 'goal' && goal && <><Text style={s.muted}>{privateHidden ? 'Tanlangan niyat' : data.reflections.find(r => r.id === goal.id)?.label}: necha mahal va har mahalda nechta istig‘for aytishni o‘zingiz tanlang.</Text><GoalPicker sessions={goal.sessions} target={goal.target} onChange={(sessions, value) => setGoal({ ...goal, sessions, target: value })} /><Text style={s.muted}>Bugungi sanoqlar o‘chmaydi. Maqsad kamaysa, ortig‘i ko‘rsatilmaydi; qayta oshirsangiz, yana ko‘rinadi.</Text><Button onPress={saveGoal}>Rejani saqlash</Button></>}
      {sheet === 'habits' && <HabitEditor habits={data.habits} defaults={defaultHabits} onAdd={(title, days) => { update(old => addCustomHabit(old, { title, weekdays: days })); showToast('Odat qo‘shildi.'); }} onRemove={id => { update(old => removeCustomHabit(old, id)); showToast('Odat ro‘yxatdan olindi. O‘tgan kunlardagi belgilar saqlanadi.'); }} />}
      {sheet === 'consistency' && <><Text style={s.text}>{`So‘nggi 30 kunning ${activityCalendar(data, day).filter(item => item.active).length} kunida yaxshi amal qayd etildi.`}</Text><ConsistencyView days={activityCalendar(data, day)} /><Text style={s.muted}>Belgilangan kun — kamida bitta odat, istig‘for, zikr yoki muhosaba qayd etilgan kun. Bu yerda zanjir uzilmaydi: o‘tkazib yuborilgan kun qarzga aylanmaydi.</Text><View style={[s.softCard, { gap: 6 }]}><Text style={s.medium}>{steady.title}</Text><Text style={s.text}>{steady.text}</Text><Pressable accessibilityRole="link" onPress={() => openSource(steady.url)} style={s.linkButton}><Text style={s.source}>{steady.source}</Text><ExternalLink size={12} color={c.forest} /></Pressable></View></>}
      {sheet === 'evening' && <EveningEditor initial={todayEvening} onSave={answers => { update(old => saveEvening(old, answers, localDateKey())); closeSheet(); showToast(answers.gratitude.trim() || answers.improve.trim() || answers.intention.trim() ? 'Muhosaba saqlandi. Alloh qabul qilsin.' : 'Bugungi yozuv o‘chirildi.'); }} onDelete={() => { update(old => deleteEvening(old, localDateKey())); closeSheet(); showToast('Bugungi yozuv o‘chirildi.'); }} />}
      {sheet === 'lock' && <>
        {lockStep === 'verify' && data.lock.pin && <LockScreen pin={data.lock.pin} biometrics={data.lock.biometrics && bioReady} title="Avval tasdiqlang" subtitle="Qulf sozlamalarini o‘zgartirish uchun joriy PIN kodni kiriting." onUnlock={() => setLockStep('menu')} onForgot={wipe} />}
        {lockStep === 'menu' && <>
          <Text style={s.muted}>Qulf ilovani boshqalar ochib ko‘rishidan saqlaydi. Telefoningizning o‘z qulfi ham yoqilgan bo‘lsin.</Text>
          <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{lockModes.map(mode => <Choice key={mode.key} wide label={mode.label} selected={lockMode === mode.key} onPress={() => chooseLockMode(mode.key)} />)}</View>
          <Text style={s.muted}>{lockMode === 'app' ? 'Ilova har safar ochilganda PIN kod so‘raladi.' : lockMode === 'muhosaba' ? 'Muhosaba bo‘limi va niyat nomlari PIN kod bilan yopiladi. Bugun, sanoq va eslatmalar ochiq qoladi.' : 'Qulf o‘chiq.'}</Text>
          {lockMode !== 'off' && Platform.OS !== 'web' && bioReady && <View style={s.between}><Text style={[s.text, { flex: 1 }]}>Telefon qulfi (barmoq izi yoki yuz) bilan ochish</Text><Switch accessibilityLabel="Telefon qulfi bilan ochish" value={data.lock.biometrics} onValueChange={value => update(old => old.lock.mode === 'off' ? old : { ...old, lock: { ...old.lock, biometrics: value } })} trackColor={{ false: '#D3D8CE', true: c.forest }} thumbColor={c.white} /></View>}
          {lockMode !== 'off' && <Button secondary onPress={() => { setPendingMode(lockMode); setPinDraft(''); setPinFirst(''); setLockMessage(''); setLockStep('new'); }}>PIN kodni almashtirish</Button>}
          <Text style={s.muted}>PIN kodni unutsangiz, uni tiklab bo‘lmaydi: qayta boshlashning yagona yo‘li — barcha ma’lumotlarni o‘chirish.</Text>
        </>}
        {lockStep === 'new' && <View style={{ gap: 16, alignItems: 'center' }}>
          <Text style={[s.text, { textAlign: 'center' }]}>Yangi PIN kod: 4–6 ta raqam. Uni boshqalar taxmin qila olmaydigan qilib tanlang.</Text>
          <PinPad value={pinDraft} onChange={value => { setPinDraft(value); setLockMessage(''); }} />
          {!!lockMessage && <Text accessibilityRole="alert" style={[s.muted, { color: c.danger }]}>{lockMessage}</Text>}
          <View style={{ alignSelf: 'stretch', gap: 10 }}><Button disabled={pinDraft.length < 4} onPress={() => { setPinFirst(pinDraft); setPinDraft(''); setLockStep('confirm'); }}>Davom etish</Button><Button secondary onPress={() => { setPinDraft(''); setLockStep('menu'); }}>Bekor qilish</Button></View>
        </View>}
        {lockStep === 'confirm' && <View style={{ gap: 16, alignItems: 'center' }}>
          <Text style={[s.text, { textAlign: 'center' }]}>PIN kodni yana bir bor kiriting.</Text>
          <PinPad value={pinDraft} onChange={confirmPin} length={pinFirst.length} disabled={savingPin} />
          {savingPin && <ActivityIndicator color={c.forest} />}
          <Button secondary disabled={savingPin} onPress={() => { setPinDraft(''); setPinFirst(''); setLockStep('new'); }}>Orqaga</Button>
        </View>}
      </>}
      {sheet === 'about' && !deleteId && !deleteEveningKey && <><Text style={s.text}>{content.istighfarNote.text}</Text><Pressable accessibilityRole="link" onPress={() => openSource(content.istighfarNote.url)} style={s.linkButton}><Text style={s.source}>{content.istighfarNote.source}</Text><ExternalLink size={13} color={c.forest} /></Pressable><Text style={s.muted}>{content.istighfarNote.progressNotice}</Text>{content.scholarReview.status !== 'approved' && <ReviewNotice text={content.scholarReview.notice} />}<Text style={s.heading}>Sunnat eslatmalari</Text><Text style={s.muted}>{content.contentNotice} Manbalar {content.verifiedOn} sanasida hadis matniga solishtirildi.</Text>{Object.entries(categoryNames).map(([key, name]) => { const items = content.reminders.filter(r => r.timeCategory === key); return items.length ? <View key={key} style={{ gap: 2 }}><Text style={[s.eyebrow, { marginTop: 8 }]}>{name.toUpperCase()}</Text>{items.map(r => <Pressable key={r.id} accessibilityRole="link" onPress={() => openSource(r.url)} style={{ gap: 4, paddingVertical: 8 }}><Text style={s.medium}>{r.title}</Text><Text style={s.source}>{r.source} ↗</Text></Pressable>)}</View> : null; })}<Text style={s.heading}>Zikrlar</Text>{adhkar.items.map(item => <Pressable key={item.id} accessibilityRole="link" onPress={() => openSource(item.url)} style={{ gap: 4, paddingVertical: 8 }}><Text style={s.medium}>{item.title}</Text><Text style={s.source}>{item.source} ↗</Text></Pressable>)}<Text style={s.muted}>Har bir faol niyatning sanoqlari alohida saqlanadi. Yangi kun yangi sanoqdan boshlanadi. O‘tgan 30 kunlik odat, sanoq va muhosaba yozuvlari saqlanadi, eskilari o‘chib boradi.</Text></>}
      {sheet === 'clear' && <><Text style={s.text}>Barcha niyatlar, sanoqlar, odatlar va muhosaba yozuvlari o‘chiriladi. Eslatmalar va ilova qulfi ham o‘chadi. Bu amalni ortga qaytarib bo‘lmaydi.</Text><Button disabled={busy} onPress={() => void wipe()}>{busy ? 'O‘chirilmoqda…' : 'Ha, hammasini o‘chirish'}</Button><Button secondary onPress={() => setSheet(null)}>Saqlab qolish</Button></>}
      {deleteId && <><Text style={s.text}>Ushbu niyat va uning sanoqlari o‘chiriladi. Boshqa niyatlar saqlanib qoladi.</Text><Button onPress={() => { const id = deleteId; update(old => ({ ...old, reflections: old.reflections.filter(r => r.id !== id), days: Object.fromEntries(Object.entries(old.days).map(([key, value]) => { const nextCounts = { ...value.counts }; delete nextCounts[id]; return [key, { ...value, counts: nextCounts }]; })) })); setDeleteId(null); showToast('Niyat o‘chirildi.'); }}>Niyatni o‘chirish</Button><Button secondary onPress={() => setDeleteId(null)}>Saqlab qolish</Button></>}
      {deleteEveningKey && <><Text style={s.text}>{keyDate(deleteEveningKey, true)} kungi muhosaba yozuvi o‘chiriladi. Qaytarib bo‘lmaydi.</Text><Button onPress={() => { const key = deleteEveningKey; update(old => deleteEvening(old, key)); setDeleteEveningKey(null); setOpenEvening(null); showToast('Yozuv o‘chirildi.'); }}>Yozuvni o‘chirish</Button><Button secondary onPress={() => setDeleteEveningKey(null)}>Saqlab qolish</Button></>}
  </> : null;
  if (modalOpen) lastSheetBody.current = sheetBody;

  return <View style={s.outer}><StatusBar style="dark" /><View style={[s.shell, { paddingTop: insets.top }]}>
    <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={s.body}>
      <View style={s.between}><View style={s.row}><View style={s.logo}><Sprout size={21} color={c.paper} strokeWidth={1.5} /></View><Text style={s.brand}>RAHMAT</Text></View><IconButton label="Eslatma sozlamalari" onPress={() => setTab('reminders')}><Bell size={20} color={c.ink} strokeWidth={1.6} /></IconButton></View>
      {!!saveError && <View style={s.error}><Text style={s.text}>{saveError}</Text><Button secondary onPress={() => saveState(data).then(() => setSaveError('')).catch(error => setSaveError(error instanceof Error ? error.message : 'Saqlashda xato.'))}>Qayta saqlash</Button></View>}

      {tab === 'today' && <>
        <View style={{ gap: 10 }}><Text style={s.eyebrow}>{uzDate(now, true).toUpperCase()}</Text><Text style={s.title}>Yaxshilik sari,{ '\n' }har kuni.</Text><Text style={s.muted}>Kichik qadamlar. Mustahkam odatlar.</Text></View>
        <View style={s.hero}><Ornament /><Text style={[s.eyebrow, { color: '#D0DBCA' }]}>QALB UCHUN BIR LAHZA</Text><Text style={s.heroTitle}>Istig‘for bilan{ '\n' }yangidan boshlang.</Text><Pressable accessibilityRole="button" onPress={() => { if (current) { setTab('istighfar'); setIstighfarView('counter'); } else addReflection(); }} style={({ pressed }) => [s.heroAction, pressed && s.pressed]}><Text style={s.medium}>{current ? 'Davom etish' : 'Birinchi niyatim'}</Text><ArrowRight size={18} color={c.forest} /></Pressable></View>
        <View style={[s.card, { gap: 15 }]}><View style={s.between}><View style={[s.row, { gap: 8 }]}><CircleDot size={17} color={c.forest} /><Text style={s.medium}>Bugungi istig‘for</Text></View><Text style={s.muted}><Text style={{ color: c.forest, fontFamily: fonts.bold }}>{total}</Text> / {target}</Text></View><View style={s.progressTrack}><View style={[s.progressFill, { width: `${target ? Math.min(100, total / target * 100) : 0}%` }]} /></View><Text style={s.muted}>{target ? `${active.length} ta faol niyat · o‘zingiz tanlagan kunlik reja` : 'Niyat qo‘shing va o‘z sur’atingizda boshlang.'}</Text></View>
        {!!yesterdayIntention && !privateHidden && <View style={[s.softCard, { gap: 8 }]}><View style={[s.row, { gap: 8 }]}><Moon size={16} color={c.forest} /><Text style={s.eyebrow}>KECHA O‘ZINGIZGA QOLDIRGAN NIYAT</Text></View><Text style={s.text}>{yesterdayIntention}</Text></View>}
        <View>
          <View style={s.between}><Text style={s.heading}>Bugungi odatlar</Text><View style={[s.row, { gap: 8 }]}><View style={s.pill}><Text style={[s.tiny, { color: c.forest }]}>{doneHabits} / {todaysHabits.length}</Text></View><IconButton label="Odatlarni tahrirlash" onPress={() => setSheet('habits')}><Pencil size={17} color={c.forest} strokeWidth={1.6} /></IconButton></View></View>
          {todaysHabits.map(h => { const done = completedHabits.includes(h.id); const Icon = h.icon; return <Pressable key={h.id} accessibilityRole="checkbox" accessibilityState={{ checked: done }} accessibilityLabel={h.title} onPress={() => update(old => toggleHabit(old, h.id, localDateKey()))} style={({ pressed }) => [s.habitRow, pressed && s.pressed]}><View style={s.habitIcon}><Icon size={19} color={c.forest} strokeWidth={1.5} /></View><View style={{ flex: 1, gap: 2 }}><Text style={[s.medium, done && { color: c.muted }]}>{h.title}</Text><Text style={s.muted}>{h.subtitle}</Text></View><View style={[s.check, done && s.checkOn]}>{done && <Check size={16} color="white" />}</View></Pressable>; })}
          <Pressable accessibilityRole="button" onPress={() => setSheet('habits')} style={[s.linkButton, { alignSelf: 'flex-start' }]}><Plus size={15} color={c.forest} /><Text style={s.source}>Shaxsiy odat qo‘shish</Text></Pressable>
        </View>
        <View style={[s.softCard, { gap: 4 }]}>
          <View style={[s.between, { marginBottom: 10 }]}><Text style={s.eyebrow}>SUNNATDAN BIR ESLATMA</Text><Leaf size={18} color={c.forest} strokeWidth={1.5} /></View>
          <Text style={s.quote}>{quote.text}</Text>
          <View style={{ marginTop: 10, gap: 2 }}><Text style={s.tiny}>BUGUN SINAB KO‘RING</Text><Text style={s.medium}>{quote.tryToday}</Text></View>
          <View style={s.between}>{sourceLink}<IconButton label="Boshqa Sunnat eslatmasi" onPress={() => setQuoteIndex(i => (i + 1) % content.reminders.length)}><RefreshCw size={16} color={c.forest} /></IconButton></View>
          <Text style={s.tiny}>Hadis mazmuni asosida{content.scholarReview.status !== 'approved' ? ' · olim tekshiruvi kutilmoqda' : ''}</Text>
        </View>
        <View style={{ gap: 16 }}>
          <View style={s.between}><Text style={s.heading}>Shu hafta</Text><Pressable accessibilityRole="button" onPress={() => setSheet('consistency')} style={s.linkButton}><CalendarDays size={15} color={c.forest} /><Text style={s.source}>So‘nggi 30 kun</Text></Pressable></View>
          <View style={s.row}>{week.map(d => { const key = localDateKey(d); const done = dayHasActivity(data, key); return <View key={key} style={s.weekCell}><Text style={[s.tiny, key === day && { color: c.forest }]}>{weekNames[d.getDay()]}</Text><View style={[s.weekDot, done && s.checkOn, key === day && !done && { borderColor: c.forest }]}>{done ? <Check size={15} color="white" /> : <Text style={[s.muted, key === day && { color: c.forest }]}>{d.getDate()}</Text>}</View></View>; })}</View>
          <Text style={s.muted}>{weeklyLine(summary)}</Text>
        </View>
        {!data.settings.enabled && <Pressable accessibilityRole="button" onPress={() => setTab('reminders')} style={[s.between, { paddingTop: 5 }]}><View style={[s.row, { gap: 10, flex: 1 }]}><BellRing size={18} color={c.muted} /><Text style={s.muted}>Yaxshi odatlar yodingizda bo‘lsin</Text></View><ArrowRight size={17} color={c.forest} /></Pressable>}
      </>}

      {tab === 'istighfar' && <>
        <View style={{ gap: 10 }}><Text style={s.eyebrow}>QALB XOTIRJAMLIGI</Text><Text style={s.title}>Bir lahza,{ '\n' }bir istig‘for.</Text><Text style={s.muted}>Shoshilmang. E’tibor bilan davom eting.</Text></View>
        <Segmented options={[{ key: 'counter', label: 'Niyatlarim' }, { key: 'adhkar', label: 'Kunlik zikrlar' }] as const} value={istighfarView} onChange={setIstighfarView} />
        {istighfarView === 'adhkar' ? <AdhkarPanel data={data} day={day} update={update} openSource={openSource} onTap={tap} progress={tasbih} setProgress={setTasbih} /> : <>
          {!current ? <View style={[s.card, s.empty]}><Sprout size={42} color={c.forest} strokeWidth={1.2} /><Text style={s.heading}>Yangi niyatdan boshlang</Text><Text style={[s.text, { textAlign: 'center' }]}>Shaxsiy niyat qo‘shing va kunlik rejani o‘zingiz tanlang — masalan, kuniga bir mahal 33 ta.</Text><Button onPress={addReflection}>Niyat qo‘shish</Button></View> : <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>{active.map((r, index) => <Pressable key={r.id} accessibilityRole="button" accessibilityState={{ selected: r.id === current.id }} onPress={() => { setSelectedId(r.id); setSlot(0); }} style={[s.chip, r.id === current.id && s.chipOn]}><Text style={[s.medium, r.id === current.id && { color: c.paper }]}>{reflectionName(index, r.label)}</Text></Pressable>)}</ScrollView>
            <View style={[s.row, { justifyContent: current.sessions > 2 ? 'space-between' : 'center', gap: current.sessions > 2 ? 0 : 28 }]}>{counts.map((count, i) => <Pressable key={i} accessibilityRole="button" accessibilityLabel={`${i + 1}-mahal, ${count} / ${current.target}, ${data.settings.times[i]}`} accessibilityState={{ selected: slotIndex === i }} onPress={() => setSlot(i)} style={{ alignItems: 'center', gap: 7, minWidth: 48, paddingVertical: 4 }}><View style={[s.roundSlot, slotIndex === i && { borderColor: c.forest, backgroundColor: c.sage }, count >= current.target && s.checkOn]}>{count >= current.target ? <Check size={17} color="white" /> : <Text style={s.medium}>{i + 1}</Text>}</View><Text style={s.tiny}>{data.settings.times[i]}</Text></Pressable>)}</View>
            <View style={{ alignItems: 'center', gap: 10, paddingVertical: 3 }}><Text style={{ fontSize: 29, color: c.forest, marginBottom: 5 }}>أَسْتَغْفِرُ اللّٰهَ</Text><Text style={s.eyebrow}>ASTAG‘FIRULLOH</Text><Text style={s.muted}>Allohdan mag‘firat so‘rayman</Text></View>
            <Pressable accessibilityRole="button" accessibilityLabel={`Istig‘for qo‘shish. Hozir ${counts[slotIndex]} ta, maqsad ${current.target}`} disabled={(counts[slotIndex] ?? 0) >= current.target} onPress={() => addCount()} style={({ pressed }) => [s.counter, pressed && { backgroundColor: '#DDE6D8' }]}><Svg width={258} height={258} style={{ position: 'absolute' }}><Circle cx="129" cy="129" r="120" fill="none" stroke="#D7DFD1" strokeWidth="2" /><Circle cx="129" cy="129" r="120" fill="none" stroke={c.forest} strokeWidth="3" strokeLinecap="round" strokeDasharray={`${(counts[slotIndex] ?? 0) / current.target * 754} 754`} rotation="-90" origin="129,129" /></Svg><Text style={s.counterNumber}>{counts[slotIndex]}</Text><Text style={s.muted}>/ {current.target}</Text><Text style={[s.tiny, { marginTop: 14, color: c.forest }]}>{(counts[slotIndex] ?? 0) >= current.target ? 'BU MAHAL YAKUNLANDI' : 'SANASH UCHUN BOSING'}</Text></Pressable>
            <View style={{ alignItems: 'center', gap: 5 }}><Text style={s.medium}>{slotIndex + 1}-mahal · {slotNames[slotIndex]}</Text><Text style={s.muted}>Bugun bu niyat uchun {getReflectionTotal(data, current, day)} / {reflectionTarget(current)} · kuniga {current.sessions} × {current.target}</Text><View style={[s.row, { gap: 18 }]}><Pressable accessibilityRole="button" accessibilityLabel="Oxirgi sanoqni qaytarish" disabled={counts[slotIndex] === 0} onPress={() => addCount(-1)} style={[s.linkButton, counts[slotIndex] === 0 && { opacity: .35 }]}><Undo2 size={15} color={c.muted} /><Text style={s.muted}>Bittasini qaytarish</Text></Pressable><Pressable accessibilityRole="button" onPress={() => openGoal(current.id)} style={s.linkButton}><Pencil size={14} color={c.forest} /><Text style={s.source}>Rejani o‘zgartirish</Text></Pressable></View></View>
            {(counts[slotIndex] ?? 0) >= current.target && slotIndex < current.sessions - 1 && <Button onPress={() => setSlot(slotIndex + 1)}>Keyingi mahalga o‘tish</Button>}
          </>}
          <Pressable accessibilityRole="button" onPress={() => setSheet('about')} style={[s.softCard, { gap: 6 }]}><View style={[s.row, { gap: 7 }]}><Heart size={15} color={c.forest} /><Text style={s.medium}>O‘zingiz tanlagan maqsad</Text></View><Text style={s.muted}>Kunlik reja — shaxsiy rejangiz. Sanoq mag‘firatning o‘lchovi emas.</Text><Text style={[s.source, { marginTop: 4 }]}>Mazmuni va manbasi</Text></Pressable>
        </>}
      </>}

      {tab === 'reflections' && <>
        <View style={{ gap: 10 }}><Text style={s.eyebrow}>O‘ZINGIZ UCHUN</Text><Text style={s.title}>Muhosaba</Text><Text style={s.muted}>O‘zingizni anglash. Yaxshilikka niyat qilish.</Text></View>
        {privateHidden && data.lock.pin ? <View style={s.card}><LockScreen key={bioReady ? 'device' : 'pin'} pin={data.lock.pin} biometrics={data.lock.biometrics && bioReady} title="Muhosaba qulflangan" subtitle="Shaxsiy niyatlar va yozuvlarni ko‘rish uchun PIN kodni kiriting." onUnlock={() => setMuhosabaOpen(true)} onForgot={wipe} /></View> : <>
          <View style={[s.softCard, { gap: 10 }]}><View style={[s.row, { gap: 8 }]}><LockKeyhole size={17} color={c.forest} /><Text style={s.medium}>Bu — sizning shaxsiy makoningiz</Text></View><Text style={s.muted}>{Platform.OS === 'web' ? 'Niyatlar, sanoqlar va muhosaba yozuvlari faqat shu brauzerda saqlanadi. Serverga shaxsiy matn yuborilmaydi. Brauzer ma’lumotlarini tozalasangiz, qaydlar o‘chadi.' : 'Qaydlar shu qurilmada shifrlab saqlanadi. Hech qanday hisob yoki bulutga yuborish yo‘q.'}</Text><Text style={s.muted}>{lockMode === 'off' ? 'Telefonni boshqalar ham ishlatsa, Eslatmalar bo‘limidan ilova qulfini yoqing.' : 'Ilova qulfi yoqilgan. Bildirishnomalarda shaxsiy qaydlar ko‘rsatilmaydi.'}</Text></View>
          <View style={[s.card, { gap: 12 }]}>
            <View style={s.between}><View style={[s.row, { gap: 8, flex: 1 }]}><Moon size={18} color={c.forest} /><Text style={s.heading}>{muhosaba.title}</Text></View></View>
            {todayEvening ? <>
              <Text style={s.muted}>Bugungi yozuv saqlandi · {keyDate(day)}</Text>
              {eveningRow('Shukr', todayEvening.gratitude)}{eveningRow('Saboq', todayEvening.improve)}{eveningRow('Ertangi niyat', todayEvening.intention)}
              <Button secondary onPress={() => setSheet('evening')}>Tahrirlash</Button>
            </> : <>
              <Text style={s.muted}>Uch qisqa savol: shukr, saboq va ertangi niyat. Bir-ikki daqiqa yetarli.</Text>
              <Button onPress={() => setSheet('evening')}>Bugungi muhosabani yozish</Button>
            </>}
            {!!yesterdayIntention && <Text style={s.muted}>Kecha qoldirgan niyatingiz: {yesterdayIntention}</Text>}
          </View>
          <Button onPress={addReflection}>＋  Yangi niyat qo‘shish</Button>
          <View style={s.between}><Text style={s.heading}>{archived ? 'Arxivdagi niyatlar' : 'Faol niyatlar'}</Text><Pressable accessibilityRole="button" onPress={() => setArchived(v => !v)} style={s.linkButton}><Archive size={15} color={c.forest} /><Text style={s.source}>{archived ? 'Faollar' : 'Arxiv'}</Text></Pressable></View>
          {data.reflections.filter(r => r.archived === archived).length === 0 && <View style={s.empty}><BookHeart size={42} color={c.muted} strokeWidth={1.2} /><Text style={s.heading}>{archived ? 'Arxiv hozircha bo‘sh' : 'Har kun — yangi imkon'}</Text><Text style={[s.muted, { textAlign: 'center' }]}>{archived ? 'Tanaffusga qo‘yilgan niyatlar shu yerda turadi.' : 'Birinchi niyatingizni qo‘shing. Oddiy nomning o‘zi yetarli.'}</Text></View>}
          {data.reflections.filter(r => r.archived === archived).map(r => { const sum = getReflectionTotal(data, r, day); const goalTotal = reflectionTarget(r); return <View key={r.id} style={[s.card, { gap: 13 }]}><View style={s.between}><View style={{ flex: 1, gap: 4 }}><Text style={s.heading}>{r.label}</Text><Text style={s.tiny}>{uzDate(new Date(r.createdAt))} · {r.archived ? 'Tanaffusda' : `Kuniga ${r.sessions} × ${r.target}`}</Text></View><BookHeart size={22} color={c.forest} strokeWidth={1.3} /></View>{r.note ? <Text style={s.text}>{r.note}</Text> : null}{!r.archived && <><View style={s.progressTrack}><View style={[s.progressFill, { width: `${Math.min(100, sum / goalTotal * 100)}%` }]} /></View><View style={s.between}><Text style={s.muted}>Bugun {sum} / {goalTotal}</Text><Pressable accessibilityRole="button" onPress={() => { setSelectedId(r.id); setSlot(0); setTab('istighfar'); setIstighfarView('counter'); }} style={s.linkButton}><Text style={s.source}>Istig‘for aytish</Text><ArrowRight size={15} color={c.forest} /></Pressable></View></>}<View style={[s.between, { borderTopWidth: 1, borderTopColor: c.line, paddingTop: 6 }]}><Pressable accessibilityRole="button" onPress={() => update(old => ({ ...old, reflections: old.reflections.map(item => item.id === r.id ? { ...item, archived: !item.archived } : item) }))} style={s.linkButton}><Archive size={15} color={c.muted} /><Text style={s.muted}>{r.archived ? 'Faollashtirish' : 'Tanaffusga qo‘yish'}</Text></Pressable>{!r.archived && <Pressable accessibilityRole="button" onPress={() => openGoal(r.id)} style={s.linkButton}><Pencil size={14} color={c.forest} /><Text style={s.source}>Reja</Text></Pressable>}<IconButton label={`${r.label} ni o‘chirish`} onPress={() => setDeleteId(r.id)}><Trash2 size={17} color={c.danger} /></IconButton></View></View>; })}
          {history.length > 0 && <View style={{ gap: 10 }}>
            <Text style={s.heading}>Oldingi muhosabalar</Text>
            {history.map(({ dateKey, entry }) => { const open = openEvening === dateKey; return <View key={dateKey} style={[s.card, { gap: 10, paddingVertical: 8 }]}>
              <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpenEvening(open ? null : dateKey)} style={[s.between, { minHeight: 44 }]}><Text style={s.medium}>{keyDate(dateKey, true)}</Text>{open ? <ChevronUp size={18} color={c.muted} /> : <ChevronDown size={18} color={c.muted} />}</Pressable>
              {open && <>{eveningRow('Shukr', entry.gratitude)}{eveningRow('Saboq', entry.improve)}{eveningRow('Niyat', entry.intention)}<Pressable accessibilityRole="button" onPress={() => setDeleteEveningKey(dateKey)} style={s.linkButton}><Trash2 size={15} color={c.danger} /><Text style={[s.muted, { color: c.danger }]}>Bu yozuvni o‘chirish</Text></Pressable></>}
            </View>; })}
          </View>}
          <Text style={[s.muted, { textAlign: 'center' }]}>O‘tgan kunlar qarzga aylanmaydi.{ '\n' }Bugungi qadamdan davom eting.</Text>
        </>}
      </>}

      {tab === 'reminders' && <>
        <View style={{ gap: 10 }}><Text style={s.eyebrow}>KUN DAVOMIDA YONINGIZDA</Text><Text style={s.title}>Yaxshilikni{ '\n' }yodga oling.</Text><Text style={s.muted}>Kuningizga mos, muloyim eslatmalar.</Text></View>
        {Platform.OS === 'web' && <View style={[s.softCard, { gap: 10 }]}><Text style={s.medium}>{pwa.installed ? 'Rahmat bosh ekraningizda' : 'Rahmatni telefoningizga o‘rnating'}</Text><Text style={s.muted}>{pwa.installed ? 'Eslatmalarni yoqing va ruxsat so‘ralganda “Ruxsat berish”ni tanlang.' : pwa.ios ? 'Safari → Ulashish → Bosh ekranga qo‘shish → Qo‘shish. So‘ng Rahmat belgisidan ochib, bildirishnomalarni yoqing.' : 'Brauzer menyusidan “Ilovani o‘rnatish” yoki “Bosh ekranga qo‘shish”ni tanlang.'}</Text><Text style={s.muted}>iPhone eslatmalari uchun iOS 16.4 yoki yangiroq versiya kerak. Eslatma vaqtlari va telefonning bildirishnoma manzili serverda saqlanadi; niyat matnlari yuborilmaydi.</Text>{!pwa.secure && <Text style={[s.muted, { color: c.danger }]}>O‘rnatish va eslatmalar uchun xavfsiz HTTPS havolasidan oching.</Text>}</View>}
        <View style={[s.card, { gap: 12 }]}><View style={s.between}><View style={[s.row, { gap: 10, flex: 1 }]}><BellRing size={21} color={c.forest} /><Text style={[s.medium, { flex: 1 }]}>Bildirishnomalar</Text></View><Switch accessibilityLabel="Bildirishnomalarni yoqish" value={data.settings.enabled && notificationState?.status === 'enabled'} onValueChange={value => void applySettings(value)} disabled={busy} trackColor={{ false: '#D3D8CE', true: c.forest }} thumbColor={c.white} /></View><Text style={s.muted}>{notificationState?.status === 'denied' ? 'Ruxsat berilmagan. Telefon sozlamalarini oching.' : data.settings.enabled && notificationState?.status === 'enabled' ? 'Yoqilgan · shaxsiy qaydlarsiz eslatmalar' : 'Istig‘for va Sunnat uchun eslatmalarni yoqing.'}</Text>{notificationState?.status === 'denied' && Platform.OS !== 'web' && <Button secondary onPress={() => Linking.openSettings().catch(() => showToast('Telefon sozlamalarini qo‘lda oching.'))}>Telefon sozlamalari</Button>}{notificationState?.status === 'denied' && Platform.OS === 'web' && <Text style={s.muted}>iPhone: Sozlamalar → Bildirishnomalar → Rahmat → Ruxsat berish.</Text>}{notificationError ? <Text style={[s.muted, { color: c.danger }]}>{notificationError}</Text> : null}</View>
        <View style={s.stack}><Text style={s.heading}>Sizning faol kuningiz</Text><Text style={s.muted}>Eslatmalar shu oraliqda rejalashtiriladi.</Text><View style={[s.row, { gap: 12 }]}>{(['dayStart', 'dayEnd'] as const).map(key => <View key={key} style={[s.card, { flex: 1, padding: 14, gap: 10 }]}><Text style={s.tiny}>{key === 'dayStart' ? 'BOSHLANISHI' : 'TUGASHI'}</Text><Text style={s.heading}>{hour(draft[key])}</Text><View style={s.between}><IconButton disabled={busy} label={`${key === 'dayStart' ? 'Boshlanish' : 'Tugash'} vaqtini bir soat kamaytirish`} onPress={() => setSettingsDraft({ ...draft, [key]: Math.max(key === 'dayStart' ? 0 : 1, draft[key] - 1) })}><Minus size={16} color={c.forest} /></IconButton><IconButton disabled={busy} label={`${key === 'dayStart' ? 'Boshlanish' : 'Tugash'} vaqtini bir soat oshirish`} onPress={() => setSettingsDraft({ ...draft, [key]: Math.min(key === 'dayStart' ? 23 : 24, draft[key] + 1) })}><Plus size={16} color={c.forest} /></IconButton></View></View>)}</View></View>
        <View style={s.stack}><Text style={s.heading}>Istig‘for vaqtlari</Text><Text style={s.muted}>{slots === 0 ? 'Faol niyat yo‘q — istig‘for eslatmasi kelmaydi.' : `Eslatma faol niyatlaringizdagi eng ko‘p mahal soniga qarab keladi: hozir kuniga ${slots} ta, ro‘yxatdagi birinchi ${slots} vaqtda.`}</Text>{draft.times.map((t, i) => <View key={i} style={[s.between, i >= slots && { opacity: .55 }]}><View style={[s.row, { gap: 12, flex: 1 }]}><View style={[s.roundSlot, { width: 33, height: 33, flexShrink: 0 }]}><Text style={s.muted}>{i + 1}</Text></View><Text style={[s.text, { flex: 1 }]}>{slotNames[i]}</Text></View><TextInput editable={!busy} accessibilityLabel={`${i + 1}-mahal vaqti`} value={t} maxLength={5} autoCorrect={false} keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'} onChangeText={value => setSettingsDraft({ ...draft, times: draft.times.map((v, index) => index === i ? value : v) })} style={[s.input, { width: 82, flexShrink: 0, textAlign: 'center', paddingHorizontal: 8 }]} /></View>)}</View>
        <View style={[s.softCard, { gap: 14 }]}><View style={[s.row, { gap: 8 }]}><Leaf size={18} color={c.forest} /><Text style={s.medium}>Sunnatdan bir eslatma</Text></View><Text style={s.muted}>Kun davomida tasodifiy vaqtlarda hadisga tayangan bir jumla — {content.reminders.length} ta eslatma ichidan.</Text><View style={s.row}>{([1, 2, 3] as const).map(n => <Pressable disabled={busy} key={n} accessibilityRole="button" accessibilityState={{ selected: draft.sunnahPerDay === n }} onPress={() => setSettingsDraft({ ...draft, sunnahPerDay: n })} style={[s.chip, { flex: 1, alignItems: 'center', paddingHorizontal: 8 }, draft.sunnahPerDay === n && s.chipOn]}><Text style={[s.medium, draft.sunnahPerDay === n && { color: c.paper }]}>{n} marta</Text></Pressable>)}</View></View>
        <View style={[s.card, { gap: 12 }]}><View style={s.between}><View style={[s.row, { gap: 10, flex: 1 }]}><Moon size={20} color={c.forest} /><Text style={[s.medium, { flex: 1 }]}>Kechki muhosaba eslatmasi</Text></View><Switch accessibilityLabel="Kechki muhosaba eslatmasi" disabled={busy} value={!!draft.eveningTime} onValueChange={value => setSettingsDraft({ ...draft, eveningTime: value ? '21:00' : null })} trackColor={{ false: '#D3D8CE', true: c.forest }} thumbColor={c.white} /></View><Text style={s.muted}>Har kuni bitta umumiy eslatma: «Kun yakunida bir daqiqa». Javoblaringiz bildirishnomada hech qachon ko‘rinmaydi. Kunduzgi oraliqdan keyin ham bo‘lishi mumkin.</Text>{!!draft.eveningTime && <View style={s.between}><Text style={s.text}>Vaqti</Text><TextInput editable={!busy} accessibilityLabel="Kechki muhosaba vaqti" value={draft.eveningTime} maxLength={5} autoCorrect={false} keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'} onChangeText={value => setSettingsDraft({ ...draft, eveningTime: value })} style={[s.input, { width: 82, textAlign: 'center', paddingHorizontal: 8 }]} /></View>}</View>
        {settingsError ? <View style={s.error}><Text style={[s.text, { color: c.danger }]}>{settingsError}</Text></View> : null}
        <Button disabled={busy} onPress={() => void applySettings()}>{busy ? 'Saqlanmoqda…' : 'Sozlamalarni saqlash'}</Button>
        <Button secondary disabled={busy} onPress={async () => { if (busy || notificationOperation.current) return; notificationOperation.current = true; setBusy(true); setTestStatus(''); try { const result = await sendTestNotification(); const message = result.status === 'install-required' ? 'Avval Rahmatni bosh ekranga qo‘shib, o‘sha belgidan oching.' : result.status === 'unavailable' || result.status === 'preview' ? 'Bu brauzer bildirishnomalarni qo‘llamaydi.' : result.status === 'denied' ? 'Avval bildirishnomalarni yoqing.' : 'Sinov rejalashtirildi. Telefonni qulflang va bir necha soniyadan so‘ng tekshiring.'; setTestStatus(message); showToast(message); } catch (error) { const message = error instanceof Error ? error.message : 'Sinov eslatmasini yuborib bo‘lmadi.'; setTestStatus(message); showToast(message); } finally { notificationOperation.current = false; setBusy(false); } }}>Sinov eslatmasi</Button>
        {Platform.OS === 'web' && <Button secondary disabled={busy} onPress={async () => { if (busy) return; setBusy(true); try { setTestStatus(await getTestNotificationStatus()); } catch (error) { setTestStatus(error instanceof Error ? error.message : 'Holatni tekshirib bo‘lmadi.'); } finally { setBusy(false); } }}>Sinov holatini tekshirish</Button>}
        {!!testStatus && <Text accessibilityRole="alert" style={s.muted}>{testStatus}</Text>}
        <Text style={s.muted}>Vaqtlar telefoningizning mahalliy vaqtiga mos. Sayohatdan keyin ilovani oching — vaqt mintaqasi yangilanadi. Bildirishnomalar internet aloqasi va telefon sozlamalariga qarab kechikishi mumkin.</Text>
        <View style={[s.card, { gap: 12 }]}><View style={[s.row, { gap: 10 }]}><LockKeyhole size={20} color={c.forest} /><Text style={[s.medium, { flex: 1 }]}>Ilova qulfi</Text><Text style={s.muted}>{lockMode === 'off' ? 'O‘chiq' : lockMode === 'app' ? 'Butun ilova' : 'Faqat Muhosaba'}</Text></View><Text style={s.muted}>Telefoningizni boshqalar ham ishlatsa, niyat va yozuvlaringizni PIN kod bilan yoping.</Text><Button secondary onPress={openLockSheet}>Qulfni sozlash</Button></View>
        <View style={{ borderTopWidth: 1, borderTopColor: c.line, paddingTop: 14 }}><Pressable accessibilityRole="button" onPress={() => setSheet('about')} style={s.linkButton}><ShieldCheck size={17} color={c.forest} /><Text style={s.text}>Ilova va manbalar haqida</Text><ChevronRight size={17} color={c.muted} /></Pressable><Pressable accessibilityRole="button" onPress={() => setSheet('clear')} style={s.linkButton}><Trash2 size={17} color={c.danger} /><Text style={[s.text, { color: c.danger }]}>Barcha ma’lumotlarni o‘chirish</Text></Pressable><Text style={[s.tiny, { marginTop: 15, textAlign: 'center' }]}>RAHMAT · 1.1{ '\n' }Kichik qadamlar, go‘zal odatlar.</Text></View>
      </>}
    </ScrollView>
    <View style={[s.tabbar, { paddingBottom: Math.max(insets.bottom, 10) }]}>{tabs.map(item => { const Icon = item.icon; return <Pressable key={item.key} accessibilityRole="tab" accessibilityLabel={item.label} accessibilityState={{ selected: tab === item.key }} onPress={() => setTab(item.key)} style={s.tab}><View style={[s.tabIcon, tab === item.key && { backgroundColor: c.sage }]}><Icon size={21} color={tab === item.key ? c.forest : c.muted} strokeWidth={tab === item.key ? 1.9 : 1.4} /></View><Text style={[s.tabText, tab === item.key && { color: c.forest, fontFamily: fonts.bold }]}>{item.label}</Text></Pressable>; })}</View>
    {!!toast && <View style={s.toast} accessibilityLiveRegion="polite"><Text style={[s.text, { color: c.paper, fontSize: 13 }]}>{toast}</Text></View>}

    <Modal transparent visible={modalOpen} animationType="fade" onRequestClose={() => { if (!busy) closeSheet(); }}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalShade}><View style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 20) }]}><View style={s.handle} /><ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={s.stack}>
      {modalOpen ? sheetBody : lastSheetBody.current}
    </ScrollView></View></KeyboardAvoidingView></Modal>
  </View></View>;
}
