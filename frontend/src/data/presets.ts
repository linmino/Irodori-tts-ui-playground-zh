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
    { emoji: "👂", category: "音效", ja: "囁き、耳元の音", zh: "耳語、貼近耳邊", en: "Whisper, close to ear" },
    { emoji: "😮‍💨", category: "音效", ja: "吐息、溜息、寝息", zh: "吐息、嘆氣、睡眠呼吸", en: "Breath, sigh" },
    { emoji: "⏸️", category: "節奏", ja: "間、沈黙", zh: "停頓、沉默", en: "Pause, silence" },
    { emoji: "🤭", category: "情緒", ja: "笑い、くすくす、含み笑い", zh: "笑聲、竊笑、含蓄的笑", en: "Laugh, chuckle, giggle" },
    { emoji: "🥵", category: "情緒", ja: "喘ぎ、うめき声、唸り声", zh: "喘息、呻吟、低吼", en: "Panting, moan, groan" },
    { emoji: "📢", category: "音效", ja: "エコー、リバーブ", zh: "回音、殘響", en: "Echo, reverb" },
    { emoji: "😏", category: "語氣", ja: "からかうように、甘えるように", zh: "調侃、撒嬌", en: "Teasing, coaxing" },
    { emoji: "🥺", category: "情緒", ja: "声を震わせながら、自信のなさげに", zh: "聲音顫抖、缺乏自信", en: "Trembling, uncertain" },
    { emoji: "🌬️", category: "音效", ja: "息切れ、荒い息遣い", zh: "喘不上氣、粗重呼吸", en: "Heavy breathing" },
    { emoji: "😮", category: "情緒", ja: "息をのむ", zh: "倒抽一口氣", en: "Gasp" },
    { emoji: "👅", category: "音效", ja: "舐める音、咀嚼音、水音", zh: "舔舐、咀嚼、水聲", en: "Wet sound" },
    { emoji: "💋", category: "音效", ja: "リップノイズ", zh: "唇音、嘴唇聲", en: "Lip noise" },
    { emoji: "🫶", category: "語氣", ja: "優しく、柔らかく", zh: "溫柔、柔和", en: "Gentle, soft" },
    { emoji: "😭", category: "情緒", ja: "嗚咽、泣き声、悲しみ", zh: "哭泣、哽咽、悲傷", en: "Sobbing" },
    { emoji: "😱", category: "情緒", ja: "悲鳴、叫び、絶叫", zh: "尖叫、驚叫", en: "Scream" },
    { emoji: "😪", category: "語氣", ja: "眠そうに、気だるげに", zh: "想睡、慵懶", en: "Sleepy" },
    { emoji: "⏩", category: "節奏", ja: "早口、まくしたてる", zh: "語速快、連珠炮般說話", en: "Fast-speaking, rapid-fire" },
    { emoji: "📞", category: "音效", ja: "電話越し、スピーカー越し", zh: "電話或喇叭質感", en: "Phone, speaker" },
    { emoji: "🐢", category: "節奏", ja: "ゆっくりと", zh: "慢慢說", en: "Slowly" },
    { emoji: "🥤", category: "音效", ja: "唾を飲み込む音", zh: "吞嚥聲", en: "Gulp" },
    { emoji: "🤧", category: "音效", ja: "咳き込み、鼻をすする、くしゃみ", zh: "咳嗽、吸鼻、噴嚏", en: "Cough, sniffle, sneeze" },
    { emoji: "😒", category: "語氣", ja: "舌打ち", zh: "咋舌、不耐煩", en: "Tutting" },
    { emoji: "😰", category: "情緒", ja: "慌てて、動揺、緊張、どもり", zh: "慌張、動搖、緊張、結巴", en: "Panicked, flustered, stammering" },
    { emoji: "😆", category: "情緒", ja: "喜びながら", zh: "開心地", en: "Joyfully" },
    { emoji: "😠", category: "情緒", ja: "怒り、不満げに、拗ねながら", zh: "生氣、不滿、鬧彆扭", en: "Angry, displeased, sulky" },
    { emoji: "😲", category: "情緒", ja: "驚き、感嘆", zh: "驚訝、感嘆", en: "Surprise" },
    { emoji: "🥱", category: "音效", ja: "あくび", zh: "打哈欠", en: "Yawn" },
    { emoji: "😖", category: "情緒", ja: "苦しげに", zh: "痛苦、吃力", en: "Painfully" },
    { emoji: "😟", category: "情緒", ja: "心配そうに", zh: "擔心、不安", en: "Worried" },
    { emoji: "🫣", category: "情緒", ja: "恥ずかしそうに、照れながら", zh: "害羞、難為情", en: "Shyly, embarrassed" },
    { emoji: "🙄", category: "語氣", ja: "呆れたように", zh: "無奈、傻眼", en: "Exasperated" },
    { emoji: "😊", category: "情緒", ja: "楽しげに、嬉しそうに", zh: "愉快、開朗", en: "Cheerfully" },
    { emoji: "👌", category: "音效", ja: "相槌、頷く音", zh: "附和、點頭聲", en: "Backchanneling" },
    { emoji: "🙏", category: "語氣", ja: "懇願するように", zh: "懇求、拜託", en: "Pleading" },
    { emoji: "🥴", category: "語氣", ja: "酔っ払って", zh: "醉醺醺", en: "Drunken" },
    { emoji: "🎵", category: "音效", ja: "鼻歌", zh: "哼歌", en: "Humming" },
    { emoji: "🤐", category: "音效", ja: "口を塞がれて", zh: "嘴被摀住、悶聲", en: "Muffled" },
    { emoji: "😌", category: "情緒", ja: "安堵、満足げに", zh: "安心、滿足", en: "Relieved" },
    { emoji: "🤔", category: "語氣", ja: "疑問の声", zh: "疑問、思考", en: "Questioning" }
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
