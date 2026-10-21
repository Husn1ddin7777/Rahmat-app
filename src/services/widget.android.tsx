import React from 'react';
import * as SecureStore from 'expo-secure-store';
import { registerWidgetTaskHandler, requestWidgetUpdate, type WidgetTaskHandlerProps } from 'react-native-android-widget';
import { localDateKey, type AppState } from '../domain/model';
import { parseWidgetSnapshot, widgetSnapshot, widgetView, type WidgetSnapshot } from '../domain/widget';
import { RahmatWidget } from '../widget/RahmatWidget';

export const WIDGET_NAME = 'RahmatToday';
const SNAPSHOT_KEY = 'rahmat.widget.v1';
let lastWritten = '';

function render(snapshot: WidgetSnapshot | null, width: number) {
  return <RahmatWidget view={widgetView(snapshot, localDateKey())} width={width} />;
}

async function readSnapshot(): Promise<WidgetSnapshot | null> {
  try { return parseWidgetSnapshot(await SecureStore.getItemAsync(SNAPSHOT_KEY)); } catch { return null; }
}

/**
 * Android runs this in the background when a widget is added, resized or
 * refreshed (hourly, so a new day starts from zero). It reads only the small
 * numbers snapshot, never the saved notes.
 */
async function handleWidget({ widgetInfo, widgetAction, renderWidget }: WidgetTaskHandlerProps): Promise<void> {
  if (widgetAction === 'WIDGET_DELETED' || widgetAction === 'WIDGET_CLICK') return;
  renderWidget(render(await readSnapshot(), widgetInfo.width));
}

export function registerWidget(): void {
  registerWidgetTaskHandler(handleWidget);
}

/** Called after the app saves: refreshes every placed widget with today's numbers. */
export async function updateWidget(state: AppState): Promise<void> {
  const snapshot = widgetSnapshot(state, localDateKey());
  const raw = JSON.stringify(snapshot);
  if (raw === lastWritten) return;
  await SecureStore.setItemAsync(SNAPSHOT_KEY, raw);
  lastWritten = raw;
  await requestWidgetUpdate({ widgetName: WIDGET_NAME, renderWidget: (info) => render(snapshot, info.width) });
}

/** After all data is deleted the widget forgets its numbers too. */
export async function clearWidget(): Promise<void> {
  lastWritten = '';
  await SecureStore.deleteItemAsync(SNAPSHOT_KEY);
  await requestWidgetUpdate({ widgetName: WIDGET_NAME, renderWidget: (info) => render(null, info.width) });
}
