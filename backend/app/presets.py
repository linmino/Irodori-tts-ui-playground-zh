from __future__ import annotations


DEFAULT_MODELS = {
    "reference": {
        "label": "通常版 / Reference Voice",
        "checkpoint": "Aratako/Irodori-TTS-500M-v2",
        "description": "支援 no-ref 與 reference audio speaker conditioning。",
    },
    "voicedesign": {
        "label": "VoiceDesign / Caption",
        "checkpoint": "Aratako/Irodori-TTS-500M-v2-VoiceDesign",
        "description": "使用 caption 描述角色聲音、語氣與風格，不需要 reference audio。",
    },
}


EMOJI_PRESETS = [
    {"emoji": "👂", "category": "音效", "ja": "囁き、耳元の音", "zh": "耳語、貼近耳邊", "en": "Whisper, close to ear"},
    {"emoji": "😮‍💨", "category": "音效", "ja": "吐息、溜息、寝息", "zh": "吐息、嘆氣、睡眠呼吸", "en": "Breath, sigh"},
    {"emoji": "⏸️", "category": "節奏", "ja": "間、沈黙", "zh": "停頓、沉默", "en": "Pause, silence"},
    {"emoji": "🤭", "category": "情緒", "ja": "笑い、くすくす、含み笑い", "zh": "笑聲、竊笑、含蓄的笑", "en": "Laugh, chuckle, giggle"},
    {"emoji": "🥵", "category": "情緒", "ja": "喘ぎ、うめき声、唸り声", "zh": "喘息、呻吟、低吼", "en": "Panting, moan, groan"},
    {"emoji": "📢", "category": "音效", "ja": "エコー、リバーブ", "zh": "回音、殘響", "en": "Echo, reverb"},
    {"emoji": "😏", "category": "語氣", "ja": "からかうように、甘えるように", "zh": "調侃、撒嬌", "en": "Teasing, coaxing"},
    {"emoji": "🥺", "category": "情緒", "ja": "声を震わせながら、自信のなさげに", "zh": "聲音顫抖、缺乏自信", "en": "Trembling, uncertain"},
    {"emoji": "🌬️", "category": "音效", "ja": "息切れ、荒い息遣い", "zh": "喘不上氣、粗重呼吸", "en": "Heavy breathing"},
    {"emoji": "😮", "category": "情緒", "ja": "息をのむ", "zh": "倒抽一口氣", "en": "Gasp"},
    {"emoji": "👅", "category": "音效", "ja": "舐める音、咀嚼音、水音", "zh": "舔舐、咀嚼、水聲", "en": "Wet sound"},
    {"emoji": "💋", "category": "音效", "ja": "リップノイズ", "zh": "唇音、嘴唇聲", "en": "Lip noise"},
    {"emoji": "🫶", "category": "語氣", "ja": "優しく、柔らかく", "zh": "溫柔、柔和", "en": "Gentle, soft"},
    {"emoji": "😭", "category": "情緒", "ja": "嗚咽、泣き声、悲しみ", "zh": "哭泣、哽咽、悲傷", "en": "Sobbing"},
    {"emoji": "😱", "category": "情緒", "ja": "悲鳴、叫び、絶叫", "zh": "尖叫、驚叫", "en": "Scream"},
    {"emoji": "😪", "category": "語氣", "ja": "眠そうに、気だるげに", "zh": "想睡、慵懶", "en": "Sleepy"},
    {"emoji": "⏩", "category": "節奏", "ja": "早口、まくしたてる", "zh": "語速快、連珠炮般說話", "en": "Fast-speaking, rapid-fire"},
    {"emoji": "📞", "category": "音效", "ja": "電話越し、スピーカー越し", "zh": "電話或喇叭質感", "en": "Phone, speaker"},
    {"emoji": "🐢", "category": "節奏", "ja": "ゆっくりと", "zh": "慢慢說", "en": "Slowly"},
    {"emoji": "🥤", "category": "音效", "ja": "唾を飲み込む音", "zh": "吞嚥聲", "en": "Gulp"},
    {"emoji": "🤧", "category": "音效", "ja": "咳き込み、鼻をすする、くしゃみ", "zh": "咳嗽、吸鼻、噴嚏", "en": "Cough, sniffle, sneeze"},
    {"emoji": "😒", "category": "語氣", "ja": "舌打ち", "zh": "咋舌、不耐煩", "en": "Tutting"},
    {"emoji": "😰", "category": "情緒", "ja": "慌てて、動揺、緊張、どもり", "zh": "慌張、動搖、緊張、結巴", "en": "Panicked, flustered, stammering"},
    {"emoji": "😆", "category": "情緒", "ja": "喜びながら", "zh": "開心地", "en": "Joyfully"},
    {"emoji": "😠", "category": "情緒", "ja": "怒り、不満げに、拗ねながら", "zh": "生氣、不滿、鬧彆扭", "en": "Angry, displeased, sulky"},
    {"emoji": "😲", "category": "情緒", "ja": "驚き、感嘆", "zh": "驚訝、感嘆", "en": "Surprise"},
    {"emoji": "🥱", "category": "音效", "ja": "あくび", "zh": "打哈欠", "en": "Yawn"},
    {"emoji": "😖", "category": "情緒", "ja": "苦しげに", "zh": "痛苦、吃力", "en": "Painfully"},
    {"emoji": "😟", "category": "情緒", "ja": "心配そうに", "zh": "擔心、不安", "en": "Worried"},
    {"emoji": "🫣", "category": "情緒", "ja": "恥ずかしそうに、照れながら", "zh": "害羞、難為情", "en": "Shyly, embarrassed"},
    {"emoji": "🙄", "category": "語氣", "ja": "呆れたように", "zh": "無奈、傻眼", "en": "Exasperated"},
    {"emoji": "😊", "category": "情緒", "ja": "楽しげに、嬉しそうに", "zh": "愉快、開朗", "en": "Cheerfully"},
    {"emoji": "👌", "category": "音效", "ja": "相槌、頷く音", "zh": "附和、點頭聲", "en": "Backchanneling"},
    {"emoji": "🙏", "category": "語氣", "ja": "懇願するように", "zh": "懇求、拜託", "en": "Pleading"},
    {"emoji": "🥴", "category": "語氣", "ja": "酔っ払って", "zh": "醉醺醺", "en": "Drunken"},
    {"emoji": "🎵", "category": "音效", "ja": "鼻歌", "zh": "哼歌", "en": "Humming"},
    {"emoji": "🤐", "category": "音效", "ja": "口を塞がれて", "zh": "嘴被摀住、悶聲", "en": "Muffled"},
    {"emoji": "😌", "category": "情緒", "ja": "安堵、満足げに", "zh": "安心、滿足", "en": "Relieved"},
    {"emoji": "🤔", "category": "語氣", "ja": "疑問の声", "zh": "疑問、思考", "en": "Questioning"},
]


VOICE_PRESETS = [
    {"id": "warm_woman", "label": "溫柔女性", "caption": "落ち着いた女性の声で、近い距離感でやわらかく自然に読み上げてください。"},
    {"id": "low_male", "label": "低沉男性", "caption": "低い声の男性が、ゆっくり落ち着いたトーンで静かに語りかけるように話してください。"},
    {"id": "bright_girl", "label": "元氣少女", "caption": "明るく元気な若い女性の声で、楽しそうにテンポよく話してください。"},
    {"id": "asmr", "label": "ASMR whisper", "caption": "甘く囁くような女性の声で、近い距離感と柔らかい吐息を含めて話してください。"},
    {"id": "robot", "label": "機械聲", "caption": "感情の少ない機械的で単調な声で、一定のリズムで読み上げてください。"},
    {"id": "nervous", "label": "焦急顫抖", "caption": "泣きそうになりながら震える声で、焦りと不安を含めて必死に話してください。"},
    {"id": "elder", "label": "年長賢者", "caption": "老齢の賢者が静かに諭すような、しわがれた低い声でゆっくり話してください。"},
]


SAMPLE_TEXTS = [
    {"id": "weather", "label": "天氣問候", "text": "こんにちは、今日はとてもいい天気ですね 😊"},
    {"id": "forest", "label": "敘事長句", "text": "その森には、古い言い伝えがありました。月が最も高く昇る夜、静かに耳を澄ませば、風の歌声が聞こえるというのです。"},
    {"id": "phone", "label": "電話語音", "text": "📞お電話ありがとうございます。ただいま電話が大変混み合っております。"},
    {"id": "whisper", "label": "耳語測試", "text": "👂😮‍💨少しだけ近くで、静かに話してもいいですか？"},
    {"id": "emotion", "label": "情緒測試", "text": "😭そんなこと言わないでください。まだ、ちゃんと話せると思っていたんです。"},
]


PARAMETER_NOTES = [
    {"name": "Num Steps", "default": "40", "range": "20-80", "note": "Euler integration steps。越高越細緻但越慢，第一版建議 40。"},
    {"name": "Num Candidates", "default": "1", "range": "1-32", "note": "一次生成幾個候選。多候選會增加等待與記憶體壓力。"},
    {"name": "Seed", "default": "random", "range": "整數或空白", "note": "固定 seed 可重現結果；空白則每次隨機。"},
    {"name": "CFG Scale Text", "default": "3.0", "range": "0-10", "note": "控制模型貼近輸入文字的程度，過高可能使聲音不自然。"},
    {"name": "CFG Scale Speaker", "default": "5.0", "range": "0-10", "note": "Reference mode 中 speaker conditioning 強度。"},
    {"name": "CFG Scale Caption", "default": "3.0", "range": "0-10", "note": "VoiceDesign caption conditioning 強度。"},
    {"name": "CFG Guidance Mode", "default": "independent", "range": "independent / joint / alternating", "note": "多條件 guidance 的組合方式，通常維持 independent。"},
    {"name": "CFG Min/Max t", "default": "0.5 / 1.0", "range": "0-1", "note": "限制 CFG 生效的 diffusion timestep 區間。"},
    {"name": "Context KV Cache", "default": "on", "range": "on/off", "note": "預先快取 context K/V，可加速文字推理。"},
    {"name": "Speaker KV Scale", "default": "空白", "range": "0-10", "note": "進階 speaker identity 強化；只建議在 reference voice 測試時使用。"},
]


def build_presets_response() -> dict[str, list[dict[str, str]]]:
    return {
        "emojis": EMOJI_PRESETS,
        "voice_presets": VOICE_PRESETS,
        "sample_texts": SAMPLE_TEXTS,
        "parameter_notes": PARAMETER_NOTES,
    }
