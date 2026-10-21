import React, { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import muhosaba from '../data/muhosaba.json';
import { MAX_EVENING_LENGTH, type EveningEntry } from '../domain/model';
import { colors as c, s } from '../theme';
import { Button, ReviewNotice } from './controls';

type Answers = { gratitude: string; improve: string; intention: string };

/** Three optional answers. Nothing is scored, and empty answers are fine. */
export function EveningEditor({ initial, onSave, onDelete }: {
  initial?: EveningEntry; onSave: (answers: Answers) => void; onDelete?: () => void;
}) {
  const [answers, setAnswers] = useState<Answers>({
    gratitude: initial?.gratitude ?? '', improve: initial?.improve ?? '', intention: initial?.intention ?? '',
  });
  const empty = !answers.gratitude.trim() && !answers.improve.trim() && !answers.intention.trim();
  return <View style={{ gap: 14 }}>
    {muhosaba.scholarReview.status !== 'approved' && <ReviewNotice text={muhosaba.scholarReview.notice} />}
    <Text style={s.text}>{muhosaba.intro}</Text>
    {muhosaba.prompts.map((prompt) => {
      const key = prompt.id as keyof Answers;
      return <View key={prompt.id} style={{ gap: 6 }}>
        <Text style={s.medium}>{prompt.label}</Text>
        <TextInput accessibilityLabel={prompt.label} value={answers[key]} onChangeText={(text) => setAnswers({ ...answers, [key]: text })}
          multiline maxLength={MAX_EVENING_LENGTH} placeholder={prompt.placeholder} placeholderTextColor={c.muted}
          style={[s.input, { minHeight: 76, textAlignVertical: 'top' }]} />
      </View>;
    })}
    <Text style={s.muted}>{muhosaba.privacy}</Text>
    <Button disabled={empty && !initial} onPress={() => onSave(answers)}>{empty && initial ? 'Bo‘sh qoldirib o‘chirish' : 'Saqlash'}</Button>
    {initial && onDelete && <Button secondary onPress={onDelete}>Bugungi yozuvni o‘chirish</Button>}
  </View>;
}
