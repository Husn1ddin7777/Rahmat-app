import React, { createContext, forwardRef, useCallback, useContext } from 'react';
import { StyleSheet, Text as NativeText, TextInput as NativeTextInput, type StyleProp, type TextInputProps, type TextProps, type TextStyle } from 'react-native';
import { toScript, type Script } from '../domain/script';
import { cyrillicFonts } from '../theme';

const ScriptContext = createContext<Script>('latin');

export const ScriptProvider = ScriptContext.Provider;

export function useScript(): Script {
  return useContext(ScriptContext);
}

/** Converts the app's own wording (labels, placeholders, messages) to the chosen script. */
export function useT(): (text: string) => string {
  const script = useScript();
  return useCallback((text: string) => toScript(text, script), [script]);
}

/** Swaps the Latin-only sans serif for its Cyrillic twin; other styles pass through. */
function scriptStyle(style: StyleProp<TextStyle>, script: Script): StyleProp<TextStyle> {
  if (script === 'latin') return style;
  const family = StyleSheet.flatten(style)?.fontFamily;
  const swap = family ? cyrillicFonts[family] : undefined;
  return swap ? [style, { fontFamily: swap }] : style;
}

function convertChildren(children: React.ReactNode, script: Script): React.ReactNode {
  return React.Children.map(children, (child) => typeof child === 'string' ? toScript(child, script) : child);
}

/**
 * The app's text. Strings are shown in the chosen script; nested elements keep
 * their own setting. Anything the user wrote is passed with `raw` and is shown
 * exactly as typed.
 */
export function Text({ raw = false, children, accessibilityLabel, style, ...props }: TextProps & { raw?: boolean }) {
  const script = useContext(ScriptContext);
  if (script === 'latin') return <NativeText accessibilityLabel={accessibilityLabel} style={style} {...props}>{children}</NativeText>;
  // The font follows the interface script even for raw text, so Cyrillic typed by the user has its letters.
  if (raw) return <NativeText accessibilityLabel={accessibilityLabel} style={scriptStyle(style, script)} {...props}>{children}</NativeText>;
  return <NativeText accessibilityLabel={accessibilityLabel === undefined ? undefined : toScript(accessibilityLabel, script)} style={scriptStyle(style, script)} {...props}>
    {convertChildren(children, script)}
  </NativeText>;
}

/** A text field whose font has the letters of the chosen script. Its value is never converted. */
export const TextInput = forwardRef<NativeTextInput, TextInputProps>(function TextInput({ style, ...props }, ref) {
  const script = useContext(ScriptContext);
  return <NativeTextInput ref={ref} style={scriptStyle(style, script)} {...props} />;
});
