export type Mode = "reference" | "voicedesign";

export type EmojiPreset = {
  emoji: string;
  category: string;
  ja: string;
  zh: string;
  en: string;
};

export type VoicePreset = {
  id: string;
  label: string;
  caption: string;
};

export type SampleText = {
  id: string;
  label: string;
  text: string;
};

export type ParameterNote = {
  name: string;
  default: string;
  range: string;
  note: string;
};

export type PresetsResponse = {
  emojis: EmojiPreset[];
  voice_presets: VoicePreset[];
  sample_texts: SampleText[];
  parameter_notes: ParameterNote[];
};

export const fallbackPresets: PresetsResponse = {
  emojis: [
    { emoji: "😊", category: "情緒", ja: "楽しげに", zh: "愉快、開朗", en: "Cheerfully" },
    { emoji: "😭", category: "情緒", ja: "嗚咽、泣き声", zh: "哭泣、哽咽", en: "Sobbing" },
    { emoji: "👂", category: "音效", ja: "囁き、耳元の音", zh: "耳語、貼近耳邊", en: "Whisper" },
    { emoji: "😮‍💨", category: "音效", ja: "吐息、溜息", zh: "吐息、嘆氣", en: "Breath" },
    { emoji: "⏩", category: "節奏", ja: "早口", zh: "語速快", en: "Fast" },
    { emoji: "🐢", category: "節奏", ja: "ゆっくりと", zh: "慢慢說", en: "Slowly" }
  ],
  voice_presets: [
    {
      id: "warm_woman",
      label: "溫柔女性",
      caption: "落ち着いた女性の声で、近い距離感でやわらかく自然に読み上げてください。"
    },
    {
      id: "asmr",
      label: "ASMR whisper",
      caption: "甘く囁くような女性の声で、近い距離感と柔らかい吐息を含めて話してください。"
    }
  ],
  sample_texts: [
    { id: "weather", label: "天氣問候", text: "こんにちは、今日はとてもいい天気ですね 😊" }
  ],
  parameter_notes: [
    { name: "Num Steps", default: "40", range: "20-80", note: "越高越細緻但越慢。" }
  ]
};
