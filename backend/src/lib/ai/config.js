import path from "path";
import { fileURLToPath } from "url";

export const HF_API_BASE_URL = "https://router.huggingface.co/hf-inference/models";
export const HF_DIRECT_INFERENCE_API_BASE_URL = "https://api-inference.huggingface.co/models";
export const HF_CHAT_COMPLETIONS_URL = "https://router.huggingface.co/v1/chat/completions";
export const SAFE_BROWSING_API_URL = "https://safebrowsing.googleapis.com/v4/threatMatches:find";
export const HF_INFERENCE_TIMEOUT_MS = Number(process.env.HF_INFERENCE_TIMEOUT_MS || 20000);
export const DEFAULT_NSFW_MODEL = process.env.HF_NSFW_MODEL || "Falconsai/nsfw_image_detection";
export const DEFAULT_AI_IMAGE_MODEL =
    process.env.HF_AI_IMAGE_MODEL || "prithivMLmods/deepfake-detector-model-v1";
export const DEFAULT_TEXT_AI_MODEL =
    process.env.HF_TEXT_AI_MODEL ||
    process.env.HF_TEXT_MODERATION_MODEL ||
    "Hello-SimpleAI/chatgpt-detector-roberta";
export const DEFAULT_TRANSLATION_MODEL =
    process.env.HF_TRANSLATION_MODEL || "facebook/mbart-large-50-many-to-one-mmt";
export const FALLBACK_TRANSLATION_MODEL =
    process.env.HF_TRANSLATION_FALLBACK_MODEL || "facebook/mbart-large-50-many-to-many-mmt";
export const NLLB_TRANSLATION_FALLBACK_MODEL =
    process.env.HF_NLLB_TRANSLATION_FALLBACK_MODEL || "facebook/nllb-200-distilled-600M";
export const DEFAULT_SUMMARIZATION_MODEL = process.env.HF_SUMMARIZATION_MODEL || "sshleifer/distilbart-cnn-12-6";
export const FALLBACK_SUMMARIZATION_MODEL =
    process.env.HF_SUMMARIZATION_FALLBACK_MODEL || "facebook/bart-large-cnn";
export const DEFAULT_SUMMARIZATION_PROVIDER = process.env.HF_SUMMARIZATION_PROVIDER || "auto";
export const DEFAULT_IMAGE_DESCRIPTION_MODEL =
    process.env.HF_IMAGE_DESCRIPTION_MODEL || "Salesforce/blip-image-captioning-base";
export const FALLBACK_IMAGE_DESCRIPTION_MODEL =
    process.env.HF_IMAGE_DESCRIPTION_FALLBACK_MODEL || "nlpconnect/vit-gpt2-image-captioning";
export const DEFAULT_IMAGE_DESCRIPTION_VLM_MODEL =
    process.env.HF_IMAGE_DESCRIPTION_VLM_MODEL || "CohereLabs/aya-vision-32b:cohere";
export const FALLBACK_IMAGE_DESCRIPTION_VLM_MODEL =
    process.env.HF_IMAGE_DESCRIPTION_VLM_FALLBACK_MODEL || "zai-org/GLM-4.5V:zai-org";
export const DEFAULT_IMAGE_DESCRIPTION_PROVIDER = process.env.HF_IMAGE_DESCRIPTION_PROVIDER || "auto";
export const IMAGE_DESCRIPTION_TIMEOUT_MS = Number(process.env.IMAGE_DESCRIPTION_TIMEOUT_MS || 45000);
export const ENABLE_LEGACY_IMAGE_DESCRIPTION_MODELS =
    process.env.ENABLE_LEGACY_IMAGE_DESCRIPTION_MODELS === "true";
export const IMAGE_DESCRIPTION_INLINE_IMAGE_MAX_BYTES = Number(
    process.env.IMAGE_DESCRIPTION_INLINE_IMAGE_MAX_BYTES || 180000,
);
export const DEFAULT_LANGUAGE_DETECTION_MODEL =
    process.env.HF_LANGUAGE_DETECTION_MODEL || "papluca/xlm-roberta-base-language-detection";
export const DEFAULT_LINK_PHISHING_MODEL =
    process.env.HF_LINK_PHISHING_MODEL || "ealvaradob/bert-finetuned-phishing";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const LANGUAGE_DETECTOR_SCRIPT_PATH = path.resolve(__dirname, "../../scripts/detect_language.py");
export const NSFW_LABELS = new Set(["nsfw", "porn", "hentai", "sexy", "explicit"]);
export const SAFE_IMAGE_LABELS = new Set(["sfw", "safe", "neutral", "normal"]);
export const AI_IMAGE_LABELS = new Set(["ai", "generated", "synthetic", "fake", "artificial", "deepfake"]);
export const HUMAN_IMAGE_LABELS = new Set(["human", "real", "authentic", "natural", "realism"]);
export const MODEL_LABEL_MAPPINGS = {
    "Hello-SimpleAI/chatgpt-detector-roberta": {
        LABEL_0: "human",
        LABEL_1: "chatgpt",
    },
    "ealvaradob/bert-finetuned-phishing": {
        LABEL_0: "benign",
        LABEL_1: "phishing",
    },
};

export const LANGUAGE_CODE_TO_NAME = {
    ar: "Arabic",
    bn: "Bengali",
    de: "German",
    en: "English",
    es: "Spanish",
    fa: "Persian",
    fr: "French",
    gu: "Gujarati",
    hi: "Hindi",
    it: "Italian",
    ja: "Japanese",
    kn: "Kannada",
    ko: "Korean",
    ml: "Malayalam",
    mr: "Marathi",
    ne: "Nepali",
    nl: "Dutch",
    or: "Odia",
    pa: "Punjabi",
    pt: "Portuguese",
    ru: "Russian",
    ta: "Tamil",
    te: "Telugu",
    tr: "Turkish",
    ur: "Urdu",
    vi: "Vietnamese",
    zh: "Chinese",
};

export const ISO_TO_NLLB_LANGUAGE = {
    ar: "arb_Arab",
    bn: "ben_Beng",
    de: "deu_Latn",
    en: "eng_Latn",
    es: "spa_Latn",
    fa: "pes_Arab",
    fr: "fra_Latn",
    gu: "guj_Gujr",
    hi: "hin_Deva",
    it: "ita_Latn",
    ja: "jpn_Jpan",
    kn: "kan_Knda",
    ko: "kor_Hang",
    ml: "mal_Mlym",
    mr: "mar_Deva",
    ne: "npi_Deva",
    nl: "nld_Latn",
    or: "ory_Orya",
    pa: "pan_Guru",
    pt: "por_Latn",
    ru: "rus_Cyrl",
    ta: "tam_Taml",
    te: "tel_Telu",
    tr: "tur_Latn",
    ur: "urd_Arab",
    vi: "vie_Latn",
    zh: "zho_Hans",
};

export const ISO_TO_MBART_LANGUAGE = {
    ar: "ar_AR",
    bn: "bn_IN",
    de: "de_DE",
    en: "en_XX",
    es: "es_XX",
    fa: "fa_IR",
    fr: "fr_XX",
    gu: "gu_IN",
    hi: "hi_IN",
    it: "it_IT",
    ja: "ja_XX",
    ko: "ko_KR",
    ml: "ml_IN",
    mr: "mr_IN",
    ne: "ne_NP",
    nl: "nl_XX",
    pt: "pt_XX",
    ru: "ru_RU",
    ta: "ta_IN",
    te: "te_IN",
    tr: "tr_TR",
    ur: "ur_PK",
    vi: "vi_VN",
    zh: "zh_CN",
};

export const HINGLISH_HINT_WORDS = new Set([
    "acha",
    "achha",
    "bhai",
    "bro",
    "haan",
    "hai",
    "hoon",
    "kal",
    "kar",
    "kya",
    "matlab",
    "milte",
    "nahi",
    "na",
    "samajh",
    "thik",
    "theek",
    "yaar",
]);
export const HINGLISH_PHRASE_TRANSLATIONS = new Map([
    ["kaise ho", "how are you"],
    ["kya kar raha hai", "what are you doing"],
    ["kya kar rha hai", "what are you doing"],
    ["kya kar रही hai", "what are you doing"],
    ["kya kar rhe ho", "what are you doing"],
    ["kya kar रहे हो", "what are you doing"],
    ["kya hua", "what happened"],
    ["kya scene hai", "what is going on"],
    ["milte hain", "let us meet"],
    ["baad mein", "later"],
    ["baad me", "later"],
    ["thik hai", "okay"],
    ["theek hai", "okay"],
    ["koi baat nahi", "no problem"],
    ["koi baat nhi", "no problem"],
    ["samajh gaya", "understood"],
    ["samajh gayi", "understood"],
    ["jaldi aao", "come quickly"],
    ["thoda wait karo", "wait a little"],
]);
export const HINGLISH_TOKEN_TRANSLATIONS = new Map([
    ["acha", "okay"],
    ["achha", "okay"],
    ["arey", "hey"],
    ["aur", "and"],
    ["baad", "later"],
    ["bhai", "brother"],
    ["bro", "bro"],
    ["class", "class"],
    ["de", "give"],
    ["do", "give"],
    ["ek", "one"],
    ["hain", "are"],
    ["hai", "is"],
    ["haan", "yes"],
    ["ho", "are"],
    ["hoon", "am"],
    ["hu", "am"],
    ["hua", "happened"],
    ["jaldi", "quickly"],
    ["kal", "tomorrow"],
    ["kar", "do"],
    ["kare", "do"],
    ["karo", "do"],
    ["kr", "do"],
    ["krna", "do"],
    ["krta", "does"],
    ["krti", "does"],
    ["kya", "what"],
    ["liya", "taken"],
    ["liye", "for"],
    ["main", "i"],
    ["mein", "in"],
    ["mat", "do not"],
    ["milte", "meet"],
    ["nahi", "not"],
    ["nhi", "not"],
    ["na", "right"],
    ["please", "please"],
    ["raha", ""],
    ["rha", ""],
    ["rahe", ""],
    ["rhe", ""],
    ["rahi", ""],
    ["samajh", "understand"],
    ["set", "set"],
    ["thik", "okay"],
    ["theek", "okay"],
    ["thoda", "a little"],
    ["timer", "timer"],
    ["wait", "wait"],
    ["wala", ""],
    ["wali", ""],
    ["yaar", "friend"],
]);

export const ENGLISH_HINT_WORDS = new Set([
    "a",
    "an",
    "and",
    "are",
    "at",
    "be",
    "for",
    "from",
    "have",
    "hello",
    "hey",
    "how",
    "i",
    "in",
    "is",
    "it",
    "me",
    "my",
    "of",
    "on",
    "please",
    "thanks",
    "that",
    "the",
    "this",
    "to",
    "we",
    "what",
    "when",
    "where",
    "you",
    "your",
]);
