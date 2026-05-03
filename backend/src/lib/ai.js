import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { InferenceClient } from "@huggingface/inference";
import { pipeline, RawImage } from "@huggingface/transformers";

const HF_API_BASE_URL = "https://router.huggingface.co/hf-inference/models";
const SAFE_BROWSING_API_URL = "https://safebrowsing.googleapis.com/v4/threatMatches:find";
const DEFAULT_NSFW_MODEL = process.env.HF_NSFW_MODEL || "Falconsai/nsfw_image_detection";
const DEFAULT_AI_IMAGE_MODEL =
    process.env.HF_AI_IMAGE_MODEL || "prithivMLmods/deepfake-detector-model-v1";
const DEFAULT_TEXT_AI_MODEL =
    process.env.HF_TEXT_AI_MODEL ||
    process.env.HF_TEXT_MODERATION_MODEL ||
    "Hello-SimpleAI/chatgpt-detector-roberta";
const DEFAULT_TRANSLATION_MODEL =
    process.env.HF_TRANSLATION_MODEL || "facebook/mbart-large-50-many-to-one-mmt";
const FALLBACK_TRANSLATION_MODEL = "facebook/mbart-large-50-many-to-many-mmt";
const DEFAULT_SUMMARIZATION_MODEL = process.env.HF_SUMMARIZATION_MODEL || "sshleifer/distilbart-cnn-12-6";
const FALLBACK_SUMMARIZATION_MODEL =
    process.env.HF_SUMMARIZATION_FALLBACK_MODEL || "facebook/bart-large-cnn";
const DEFAULT_SUMMARIZATION_PROVIDER = process.env.HF_SUMMARIZATION_PROVIDER || "auto";
const DEFAULT_IMAGE_DESCRIPTION_MODEL =
    process.env.HF_IMAGE_DESCRIPTION_MODEL || "Salesforce/blip-image-captioning-base";
const FALLBACK_IMAGE_DESCRIPTION_MODEL =
    process.env.HF_IMAGE_DESCRIPTION_FALLBACK_MODEL || "nlpconnect/vit-gpt2-image-captioning";
const DEFAULT_IMAGE_DESCRIPTION_PROVIDER =
    process.env.HF_IMAGE_DESCRIPTION_PROVIDER || "auto";
const LOCAL_IMAGE_DESCRIPTION_MODEL =
    process.env.LOCAL_IMAGE_DESCRIPTION_MODEL || "Xenova/vit-gpt2-image-captioning";
const DEFAULT_LANGUAGE_DETECTION_MODEL =
    process.env.HF_LANGUAGE_DETECTION_MODEL || "papluca/xlm-roberta-base-language-detection";
const DEFAULT_LINK_PHISHING_MODEL =
    process.env.HF_LINK_PHISHING_MODEL || "ealvaradob/bert-finetuned-phishing";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LANGUAGE_DETECTOR_SCRIPT_PATH = path.resolve(__dirname, "../scripts/detect_language.py");
const NSFW_LABELS = new Set(["nsfw", "porn", "hentai", "sexy", "explicit"]);
const SAFE_IMAGE_LABELS = new Set(["sfw", "safe", "neutral", "normal"]);
const AI_IMAGE_LABELS = new Set(["ai", "generated", "synthetic", "fake", "artificial", "deepfake"]);
const HUMAN_IMAGE_LABELS = new Set(["human", "real", "authentic", "natural", "realism"]);
const MODEL_LABEL_MAPPINGS = {
    "Hello-SimpleAI/chatgpt-detector-roberta": {
        LABEL_0: "human",
        LABEL_1: "chatgpt",
    },
    "ealvaradob/bert-finetuned-phishing": {
        LABEL_0: "benign",
        LABEL_1: "phishing",
    },
};

const LANGUAGE_CODE_TO_NAME = {
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

const ISO_TO_NLLB_LANGUAGE = {
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

const ISO_TO_MBART_LANGUAGE = {
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

const HINGLISH_HINT_WORDS = new Set([
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
const HINGLISH_PHRASE_TRANSLATIONS = new Map([
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
const HINGLISH_TOKEN_TRANSLATIONS = new Map([
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

const ENGLISH_HINT_WORDS = new Set([
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


const normalizeLabel = (label = "") => label.trim().toLowerCase();
const prettifyLabel = (label = "") =>
    label.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());

const toPercent = (score = 0) => Number((score * 100).toFixed(2));
const stripDiacritics = (text = "") => text.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
const countWords = (text = "") => text.trim().split(/\s+/).filter(Boolean).length;
let inferenceClient;
let localImageCaptionerPromise;

const getInferenceClient = () => {
  if (!inferenceClient) {
    inferenceClient = new InferenceClient(process.env.HUGGINGFACE_API_KEY);
  }

  return inferenceClient;
};

const getLocalImageCaptioner = () => {
    if (!localImageCaptionerPromise) {
        localImageCaptionerPromise = pipeline("image-to-text", LOCAL_IMAGE_DESCRIPTION_MODEL);
    }

    return localImageCaptionerPromise;
};


const getSummaryProviderInfo = () => ({
  providerPreference: DEFAULT_SUMMARIZATION_PROVIDER,
  resolvedProvider:
    DEFAULT_SUMMARIZATION_PROVIDER === "auto" ? null : DEFAULT_SUMMARIZATION_PROVIDER,
});

const pickTopMatch = (predictions, matcher) =>
    predictions
        .filter((prediction) => matcher(normalizeLabel(prediction.label)))
        .sort((left, right) => right.score - left.score)[0];

const summarizeNsfw = (predictions) => {
    const nsfwMatch = pickTopMatch(
        predictions,
        (label) =>
            NSFW_LABELS.has(label) ||
            label.includes("porn") ||
            label.includes("hentai") ||
            label.includes("explicit"),
    );

    const safeMatch = pickTopMatch(
        predictions,
        (label) =>
            SAFE_IMAGE_LABELS.has(label) ||
            (label.includes("safe") && !label.includes("unsafe")) ||
            label.includes("neutral") ||
            label.includes("normal"),
    );

    const riskScore = nsfwMatch?.score || 0;

    return {
        topPrediction: predictions[0] || null,
        riskScore,
        riskPercent: toPercent(riskScore),
        safePercent: toPercent(safeMatch?.score || Math.max(0, 1 - riskScore)),
        flagged: riskScore >= 0.5,
        status: riskScore >= 0.75 ? "high_risk" : riskScore >= 0.5 ? "review" : "clear",
    };
};

const summarizeAiGenerated = (predictions) => {
    const aiMatch = pickTopMatch(
        predictions,
        (label) =>
            AI_IMAGE_LABELS.has(label) ||
            label.includes("generated") ||
            label.includes("synthetic") ||
            label.includes("fake"),
    );

    const humanMatch = pickTopMatch(
        predictions,
        (label) =>
            HUMAN_IMAGE_LABELS.has(label) ||
            label.includes("human") ||
            label.includes("real") ||
            label.includes("authentic") ||
            label.includes("natural"),
    );

    const fallbackTopPrediction = predictions[0] || null;
    const derivedAiScore =
        aiMatch?.score ??
        (fallbackTopPrediction && AI_IMAGE_LABELS.has(normalizeLabel(fallbackTopPrediction.label))
            ? fallbackTopPrediction.score
            : null);
    const derivedHumanScore =
        humanMatch?.score ??
        (fallbackTopPrediction &&
        HUMAN_IMAGE_LABELS.has(normalizeLabel(fallbackTopPrediction.label))
            ? fallbackTopPrediction.score
            : null);
    const aiScore =
        derivedAiScore ??
        (typeof derivedHumanScore === "number" ? Math.max(0, 1 - derivedHumanScore) : 0);
    const humanScore =
        derivedHumanScore ??
        (typeof derivedAiScore === "number"
            ? Math.max(0, 1 - derivedAiScore)
            : Math.max(0, 1 - aiScore));

    return {
        topPrediction: fallbackTopPrediction,
        aiScore,
        aiPercent: toPercent(aiScore),
        humanScore,
        humanPercent: toPercent(humanScore),
        flagged: aiScore >= 0.6,
        status: aiScore >= 0.8 ? "likely_ai" : aiScore >= 0.6 ? "possible_ai" : "likely_real",
    };
};

const summarizeOverallImageResult = ({ nsfwSummary, aiSummary }) => {
    if (nsfwSummary.status === "high_risk") {
        return {
            status: "block_review",
            label: "High-risk content",
            message: "NSFW risk is high. Review the image before sharing further.",
        };
    }

    if (nsfwSummary.status === "review") {
        return {
            status: "needs_review",
            label: "Content review suggested",
            message: "This image may contain sensitive content and should be reviewed.",
        };
    }

    if (aiSummary.status === "likely_ai") {
        return {
            status: "likely_ai",
            label: "Likely AI-generated",
            message: "The detector strongly suggests this image is AI-generated.",
        };
    }

    if (aiSummary.status === "possible_ai") {
        return {
            status: "possible_ai",
            label: "Possibly AI-generated",
            message:
                "The detector found some signals of AI generation, but confidence is moderate.",
        };
    }

    return {
        status: "clear",
        label: "Looks acceptable",
        message:
            "No strong NSFW risk was found, and the image looks more likely real than AI-generated.",
    };
};

const ensureInferenceConfigured = () => {
    if (!process.env.HUGGINGFACE_API_KEY) {
        const error = new Error("AI detection is not configured");
        error.statusCode = 503;
        error.publicMessage = "AI detection is not configured on the server";
        throw error;
    }
};

const parseInferenceError = async (response) => {
    const responseText = await response.text();

    try {
        const payload = JSON.parse(responseText);
        return payload?.error || responseText;
    } catch {
        return responseText;
    }
};

const normalizePredictions = (payload) => {
    const flattenedPayload =
        Array.isArray(payload) && Array.isArray(payload[0]) ? payload[0] : payload;

    if (!Array.isArray(flattenedPayload)) {
        const error = new Error(`Unexpected inference response: ${JSON.stringify(payload)}`);
        error.statusCode = 502;
        error.publicMessage = "AI detection returned an unexpected response";
        throw error;
    }

    return flattenedPayload
        .filter((item) => typeof item?.label === "string" && typeof item?.score === "number")
        .sort((left, right) => right.score - left.score);
};

const prepareTextForModel = (text, model) => {
    if (!model?.includes("twitter-roberta")) {
        return text;
    }

    return text
        .split(/\s+/)
        .map((token) => {
            if (token.startsWith("@") && token.length > 1) return "@user";
            if (/^(https?:\/\/|www\.)/i.test(token)) return "http";
            return token;
        })
        .join(" ");
};

const mapPredictionLabels = (predictions, model) => {
    const labelMapping = MODEL_LABEL_MAPPINGS[model] || {};

    return predictions.map((prediction) => {
        const canonicalLabel = labelMapping[prediction.label] || prediction.label;

        return {
            ...prediction,
            label: canonicalLabel,
            displayLabel: prettifyLabel(canonicalLabel),
        };
    });
};

const runImageClassification = async ({ buffer, mimeType, model }) => {
    ensureInferenceConfigured();

    const response = await fetch(`${HF_API_BASE_URL}/${model}`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
            "Content-Type": mimeType || "application/octet-stream",
            Accept: "application/json",
        },
        body: buffer,
    });

    if (!response.ok) {
        const errorMessage = await parseInferenceError(response);
        const error = new Error(`Inference request failed for ${model}: ${errorMessage}`);
        error.statusCode = response.status;
        error.publicMessage = "AI detection could not analyze this image right now";
        throw error;
    }

    const payload = await response.json();
    return mapPredictionLabels(normalizePredictions(payload), model);
};

const runTextClassification = async ({ text, model }) => {
    ensureInferenceConfigured();
    const preparedText = prepareTextForModel(text, model);

    const response = await fetch(`${HF_API_BASE_URL}/${model}`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
            "Content-Type": "application/json",
            Accept: "application/json",
        },
        body: JSON.stringify({
            inputs: preparedText,
            parameters: {
                top_k: 6,
            },
        }),
    });

    if (!response.ok) {
        const errorMessage = await parseInferenceError(response);
        const error = new Error(`Inference request failed for ${model}: ${errorMessage}`);
        error.statusCode = response.status;
        error.publicMessage = "AI detection could not analyze this message right now";
        throw error;
    }

    const payload = await response.json();
    return mapPredictionLabels(normalizePredictions(payload), model);
};

const runTranslation = async ({ text, srcLang, tgtLang, model }) => {
    ensureInferenceConfigured();

    const response = await fetch(`${HF_API_BASE_URL}/${model}`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
            "Content-Type": "application/json",
            Accept: "application/json",
        },
        body: JSON.stringify({
            inputs: text,
            parameters: {
                src_lang: srcLang,
                tgt_lang: tgtLang,
                clean_up_tokenization_spaces: true,
            },
        }),
    });

    if (!response.ok) {
        const errorMessage = await parseInferenceError(response);
        const error = new Error(`Translation request failed for ${model}: ${errorMessage}`);
        error.statusCode = response.status;
        error.publicMessage = "Translation could not analyze this message right now";
        error.providerError = errorMessage;
        throw error;
    }

    const payload = await response.json();
    const normalizedPayload = Array.isArray(payload) ? payload[0] : payload;
    const translatedText = normalizedPayload?.translation_text?.trim();

    if (!translatedText) {
        const error = new Error(`Unexpected translation response: ${JSON.stringify(payload)}`);
        error.statusCode = 502;
        error.publicMessage = "Translation returned an unexpected response";
        throw error;
    }

    return translatedText;
};

const runSummarization = async ({ text, model }) => {
  ensureInferenceConfigured();
  const approximateWordCount = countWords(text);
  const client = getInferenceClient();
  const providerInfo = getSummaryProviderInfo();

  if (model.includes("flan-t5")) {
        const prompt = [
            "Summarize the following chat message in one short sentence.",
            "Keep only the key point and remove filler.",
            "",
            `Message: ${text}`,
            "Summary:",
        ].join("\n");

          try {
              const generated = await client.textGeneration({
              provider: providerInfo.providerPreference,
                  model,
                  inputs: prompt,
                parameters: {
                    do_sample: false,
                    return_full_text: false,
                    max_new_tokens: Math.min(
                        48,
                        Math.max(18, Math.ceil(approximateWordCount * 0.45)),
                    ),
                    repetition_penalty: 1.05,
                },
            });

            const generatedText =
                typeof generated === "string" ? generated : generated?.generated_text || "";
            const summaryText = generatedText
                .trim()
                .replace(/^summary:\s*/i, "")
                .trim();

            if (!summaryText) {
                const error = new Error(
                    `Unexpected summarization response: ${JSON.stringify(generated)}`,
                );
                error.statusCode = 502;
                error.publicMessage = "Summarization returned an unexpected response";
                throw error;
            }

          return {
              summaryText,
              providerInfo,
          };
      } catch (error) {
          const wrappedError = new Error(
              `Summarization request failed for ${model}: ${error.message}`,
            );
            wrappedError.statusCode = error.response?.status || error.statusCode || 502;
            wrappedError.publicMessage = "Summarization could not analyze this message right now";
            wrappedError.providerError = error.message;
            throw wrappedError;
        }
    }

    const maxLength = Math.min(80, Math.max(24, Math.ceil(approximateWordCount * 0.7)));
    const minLength = Math.min(16, Math.max(5, Math.floor(approximateWordCount * 0.22)));

    try {
        const result = await client.summarization({
          provider: providerInfo.providerPreference,
            model,
            inputs: text,
            parameters: {
                do_sample: false,
                max_length: maxLength,
                min_length: minLength,
            },
        });

        const summaryText = result?.summary_text?.trim() || result?.generated_text?.trim() || "";

        if (!summaryText) {
            const error = new Error(`Unexpected summarization response: ${JSON.stringify(result)}`);
            error.statusCode = 502;
            error.publicMessage = "Summarization returned an unexpected response";
            throw error;
        }

      return {
          summaryText,
          providerInfo,
      };
  } catch (error) {
      const wrappedError = new Error(
          `Summarization request failed for ${model}: ${error.message}`,
        );
        wrappedError.statusCode = error.response?.status || error.statusCode || 502;
        wrappedError.publicMessage = "Summarization could not analyze this message right now";
        wrappedError.providerError = error.message;
        throw wrappedError;
    }
};

const runImageToText = async ({ buffer, mimeType, model }) => {
    ensureInferenceConfigured();
    const client = getInferenceClient();

    try {
        const result = await client.imageToText({
            provider: DEFAULT_IMAGE_DESCRIPTION_PROVIDER,
            model,
            data: buffer,
        });

        const descriptionText =
            result?.generated_text?.trim() || result?.text?.trim() || "";

        if (!descriptionText) {
            const error = new Error(
                `Unexpected image description response: ${JSON.stringify(result)}`,
            );
            error.statusCode = 502;
            error.publicMessage = "Image description returned an unexpected response";
            throw error;
        }

        return {
            descriptionText,
            provider:
                DEFAULT_IMAGE_DESCRIPTION_PROVIDER === "auto"
                    ? null
                    : DEFAULT_IMAGE_DESCRIPTION_PROVIDER,
        };
    } catch (error) {
        const wrappedError = new Error(
            `Image description request failed for ${model}: ${error.message}`,
        );
        wrappedError.statusCode = error.response?.status || error.statusCode || 502;
        wrappedError.publicMessage = "Image description could not analyze this image right now";
        wrappedError.providerError = error.message;
        throw wrappedError;
    }
};

const runLocalImageToText = async ({ buffer, mimeType }) => {
    try {
        const captioner = await getLocalImageCaptioner();
        const image = await RawImage.read(
            new Blob([buffer], {
                type: mimeType || "image/png",
            }),
        );
        const result = await captioner(image);
        const firstResult = Array.isArray(result) ? result[0] : result;
        const descriptionText =
            firstResult?.generated_text?.trim() || firstResult?.text?.trim() || "";

        if (!descriptionText) {
            const error = new Error(`Unexpected local image description response: ${JSON.stringify(result)}`);
            error.statusCode = 502;
            error.publicMessage = "Image description returned an unexpected response";
            throw error;
        }

        return {
            descriptionText,
            provider: "local-transformers",
            model: LOCAL_IMAGE_DESCRIPTION_MODEL,
        };
    } catch (error) {
        const wrappedError = new Error(`Local image description failed: ${error.message}`);
        wrappedError.statusCode = error.statusCode || 502;
        wrappedError.publicMessage = "Image description could not analyze this image right now";
        wrappedError.providerError = error.message;
        throw wrappedError;
    }
};

const getTranslationLanguageCode = (isoCode, model) => {
    if (model.includes("mbart-large-50")) {
        return ISO_TO_MBART_LANGUAGE[isoCode] || null;
    }

    return ISO_TO_NLLB_LANGUAGE[isoCode] || null;
};

const normalizeComparableText = (text = "") =>
    stripDiacritics(text.toLowerCase())
        .replace(/[^\p{L}\p{N}]+/gu, " ")
        .trim();

const isSuspiciousSummaryResult = ({ sourceText, summaryText }) => {
    const sourceWordCount = countWords(sourceText);
    const summaryWordCount = countWords(summaryText);
    const normalizedSource = normalizeComparableText(sourceText);
    const normalizedSummary = normalizeComparableText(summaryText);

    if (!normalizedSummary) {
        return true;
    }

    if (sourceWordCount >= 18 && summaryWordCount >= sourceWordCount) {
        return true;
    }

    if (sourceWordCount >= 18 && normalizedSummary === normalizedSource) {
        return true;
    }

    return false;
};

const isSuspiciousTranslationResult = ({ sourceText, translatedText, sourceIsoCode }) => {
    const normalizedSource = normalizeComparableText(sourceText);
    const normalizedTranslation = normalizeComparableText(translatedText);

    if (!normalizedTranslation) {
        return true;
    }

    if (sourceIsoCode !== "en" && normalizedSource && normalizedSource === normalizedTranslation) {
        return true;
    }

    if (
        sourceText.trim().length <= 32 &&
        translatedText.trim().length >= sourceText.trim().length * 4
    ) {
        return true;
    }

    return false;
};

export async function analyzeImageContent({ buffer, mimeType }) {
    const [nsfwPredictions, aiGeneratedPredictions] = await Promise.all([
        runImageClassification({
            buffer,
            mimeType,
            model: DEFAULT_NSFW_MODEL,
        }),
        runImageClassification({
            buffer,
            mimeType,
            model: DEFAULT_AI_IMAGE_MODEL,
        }),
    ]);
    const nsfwSummary = summarizeNsfw(nsfwPredictions);
    const aiSummary = summarizeAiGenerated(aiGeneratedPredictions);

    return {
        checkedAt: new Date().toISOString(),
        models: {
            nsfw: DEFAULT_NSFW_MODEL,
            aiGenerated: DEFAULT_AI_IMAGE_MODEL,
        },
        overall: summarizeOverallImageResult({
            nsfwSummary,
            aiSummary,
        }),
        nsfw: {
            predictions: nsfwPredictions.map((prediction) => ({
                label: prediction.label,
                score: prediction.score,
                percent: toPercent(prediction.score),
            })),
            summary: nsfwSummary,
        },
        aiGenerated: {
            predictions: aiGeneratedPredictions.map((prediction) => ({
                label: prediction.label,
                score: prediction.score,
                percent: toPercent(prediction.score),
            })),
            summary: aiSummary,
        },
    };
}

const AI_TEXT_LABELS = new Set([
    "chatgpt",
    "ai",
    "generated",
    "machine",
    "llm",
    "gpt",
    "synthetic",
]);
const HUMAN_TEXT_LABELS = new Set(["human", "real", "authentic", "organic", "written_by_human"]);

export const CURRENT_TEXT_AI_MODELS = [DEFAULT_TEXT_AI_MODEL];

const summarizeAiGeneratedText = (predictions) => {
    const aiMatch = pickTopMatch(
        predictions,
        (label) =>
            AI_TEXT_LABELS.has(label) ||
            label.includes("chatgpt") ||
            label.includes("generated") ||
            label.includes("machine") ||
            label.includes("gpt") ||
            label.includes("ai"),
    );

    const humanMatch = pickTopMatch(
        predictions,
        (label) =>
            HUMAN_TEXT_LABELS.has(label) ||
            label.includes("human") ||
            label.includes("authentic") ||
            label.includes("organic"),
    );

    const fallbackTopPrediction = predictions[0] || null;
    const derivedAiScore =
        aiMatch?.score ??
        (fallbackTopPrediction && AI_TEXT_LABELS.has(normalizeLabel(fallbackTopPrediction.label))
            ? fallbackTopPrediction.score
            : null);
    const derivedHumanScore =
        humanMatch?.score ??
        (fallbackTopPrediction && HUMAN_TEXT_LABELS.has(normalizeLabel(fallbackTopPrediction.label))
            ? fallbackTopPrediction.score
            : null);
    const aiScore =
        derivedAiScore ??
        (typeof derivedHumanScore === "number" ? Math.max(0, 1 - derivedHumanScore) : 0);
    const humanScore =
        derivedHumanScore ??
        (typeof derivedAiScore === "number"
            ? Math.max(0, 1 - derivedAiScore)
            : Math.max(0, 1 - aiScore));

    return {
        topPrediction: fallbackTopPrediction,
        aiScore,
        aiPercent: toPercent(aiScore),
        humanScore,
        humanPercent: toPercent(humanScore),
        flagged: aiScore >= 0.6,
        status: aiScore >= 0.8 ? "likely_ai" : aiScore >= 0.6 ? "possible_ai" : "likely_real",
    };
};

const summarizeOverallTextAiResult = (summary) => {
    if (summary.status === "likely_ai") {
        return {
            status: "likely_ai",
            label: "Likely AI-generated",
            message: "The detector strongly suggests this text was generated by AI.",
        };
    }

    if (summary.status === "possible_ai") {
        return {
            status: "possible_ai",
            label: "Possibly AI-generated",
            message: "The detector found moderate signs that this text may be AI-generated.",
        };
    }

    return {
        status: "likely_real",
        label: "Likely human-written",
        message: "The detector found stronger signs of human-written text than AI-generated text.",
    };
};

export async function analyzeTextContent({ text }) {
    const predictions = await runTextClassification({
        text,
        model: DEFAULT_TEXT_AI_MODEL,
    });
    const summary = summarizeAiGeneratedText(predictions);

    return {
        checkedAt: new Date().toISOString(),
        models: {
            aiGeneratedText: DEFAULT_TEXT_AI_MODEL,
        },
        overall: summarizeOverallTextAiResult(summary),
        aiGeneratedText: {
            predictions: predictions.map((prediction) => ({
                label: prediction.label,
                score: prediction.score,
                percent: toPercent(prediction.score),
            })),
            summary,
        },
    };
}

export async function summarizeTextContent({ text }) {
    const normalizedText = text.replace(/\s+/g, " ").trim();
    const originalWordCount = countWords(normalizedText);

    if (originalWordCount <= 5) {
        return {
            checkedAt: new Date().toISOString(),
            models: {
                summarization: "short-text shortcut",
            },
            attempts: [
                {
                    model: "short-text shortcut",
                    status: "skipped",
                    resolvedProvider: null,
                    providerPreference: null,
                    reason: "Message already too short to summarize further.",
                },
            ],
            summaryText: normalizedText,
            originalWordCount,
            summaryWordCount: originalWordCount,
            compressionPercent: 0,
            note: "This message is already extremely short, so the summary stays the same.",
        };
    }

    const candidateModels = [DEFAULT_SUMMARIZATION_MODEL, FALLBACK_SUMMARIZATION_MODEL].filter(
        (model, index, allModels) => allModels.indexOf(model) === index,
    );
    const attempts = [];
    let summaryText = null;
    let usedModel = DEFAULT_SUMMARIZATION_MODEL;
    let usedProvider = null;
    let providerPreferenceUsed = null;

    for (const model of candidateModels) {
        try {
            const candidateResult = await runSummarization({
                text: normalizedText,
                model,
            });
            const candidateSummary = candidateResult.summaryText;

            if (
                isSuspiciousSummaryResult({
                    sourceText: normalizedText,
                    summaryText: candidateSummary,
                })
            ) {
                attempts.push({
                    model,
                    status: "rejected",
                    resolvedProvider: candidateResult.providerInfo?.resolvedProvider || null,
                    providerPreference: candidateResult.providerInfo?.providerPreference || null,
                    reason: "Suspicious summary output",
                });
                continue;
            }

            summaryText = candidateSummary;
            usedModel = model;
            usedProvider = candidateResult.providerInfo?.resolvedProvider || null;
            providerPreferenceUsed = candidateResult.providerInfo?.providerPreference || null;
            attempts.push({
                model,
                status: "used",
                resolvedProvider: usedProvider,
                providerPreference: providerPreferenceUsed,
                reason: null,
            });
            break;
        } catch (error) {
            attempts.push({
                model,
                status: "failed",
                resolvedProvider: null,
                providerPreference: DEFAULT_SUMMARIZATION_PROVIDER,
                reason: error.providerError || error.message,
            });
        }
    }

    if (!summaryText) {
        const error = new Error(
            `Summarization failed for all configured models: ${attempts
                .map((attempt) => `${attempt.model}: ${attempt.reason || attempt.status}`)
                .join(" | ")}`,
        );
        error.statusCode = 502;
        error.publicMessage = "Summarization could not analyze this message right now";
        throw error;
    }

    const summaryWordCount = countWords(summaryText);
    const compressionRatio = originalWordCount
        ? Math.max(0, 1 - summaryWordCount / originalWordCount)
        : 0;

    return {
        checkedAt: new Date().toISOString(),
        models: {
            summarization: usedModel,
        },
        provider: {
            preference: providerPreferenceUsed,
            resolved: usedProvider,
        },
        attempts,
        summaryText,
        originalWordCount,
        summaryWordCount,
        compressionPercent: toPercent(compressionRatio),
        note: null,
    };
}

const detectLikelyHinglish = () => false;

const detectLikelyEnglish = (text = "") => {
    if (!text.trim()) return false;

    if (!/^[\x00-\x7F\s.,!?'"()\-:;@#/&%0-9]+$/.test(text)) {
        return false;
    }

    const normalizedTokens = stripDiacritics(text.toLowerCase())
        .split(/[^a-z]+/)
        .filter(Boolean);

    if (normalizedTokens.length === 0) {
        return false;
    }

    let englishHintMatches = 0;
    for (const token of normalizedTokens) {
        if (ENGLISH_HINT_WORDS.has(token)) {
            englishHintMatches += 1;
        }
    }

    const englishHintRatio = englishHintMatches / normalizedTokens.length;

    return englishHintMatches >= 2 || (normalizedTokens.length >= 4 && englishHintRatio >= 0.35);
};

const detectSourceLanguageLocally = async (text) => {
    const stdout = await new Promise((resolve, reject) => {
        const child = spawn("python", [LANGUAGE_DETECTOR_SCRIPT_PATH], {
            stdio: ["pipe", "pipe", "pipe"],
        });
        let stdoutBuffer = "";
        let stderrBuffer = "";

        child.stdout.on("data", (chunk) => {
            stdoutBuffer += chunk.toString();
        });

        child.stderr.on("data", (chunk) => {
            stderrBuffer += chunk.toString();
        });

        child.on("error", reject);
        child.on("close", (code) => {
            if (code === 0) {
                resolve(stdoutBuffer);
                return;
            }

            reject(new Error(stderrBuffer || `Language detector exited with code ${code}`));
        });

        child.stdin.write(text);
        child.stdin.end();
    });

    const payload = JSON.parse(stdout.trim());
    return {
        sourceIsoCode: normalizeLabel(payload?.lang || "en"),
        confidence: typeof payload?.confidence === "number" ? payload.confidence : null,
    };
};

const translateHinglishText = (text = "") => text;

const detectSourceLanguage = async (text) => {
    if (detectLikelyEnglish(text)) {
        return {
            sourceIsoCode: "en",
            sourceNllbCode: ISO_TO_NLLB_LANGUAGE.en,
            sourceLanguage: "English",
            confidence: null,
            detectionModel: "english heuristic",
            detectedByHeuristic: true,
        };
    }

    try {
        const localDetection = await detectSourceLanguageLocally(text);

        if (typeof localDetection.confidence === "number" && localDetection.confidence >= 0.9) {
            return {
                sourceIsoCode: localDetection.sourceIsoCode,
                sourceNllbCode:
                    ISO_TO_NLLB_LANGUAGE[localDetection.sourceIsoCode] || ISO_TO_NLLB_LANGUAGE.en,
                sourceLanguage:
                    LANGUAGE_CODE_TO_NAME[localDetection.sourceIsoCode] ||
                    prettifyLabel(localDetection.sourceIsoCode),
                confidence: localDetection.confidence,
                detectionModel: "langid (local)",
                detectedByHeuristic: false,
            };
        }

        throw new Error("Local language detection confidence too low");
    } catch (error) {
        const predictions = await runTextClassification({
            text,
            model: DEFAULT_LANGUAGE_DETECTION_MODEL,
        });
        const topPrediction = predictions[0];
        const sourceIsoCode = normalizeLabel(topPrediction?.label || "en");

        return {
            sourceIsoCode,
            sourceNllbCode: ISO_TO_NLLB_LANGUAGE[sourceIsoCode] || ISO_TO_NLLB_LANGUAGE.en,
            sourceLanguage: LANGUAGE_CODE_TO_NAME[sourceIsoCode] || prettifyLabel(sourceIsoCode),
            confidence: topPrediction?.score ?? null,
            detectionModel: DEFAULT_LANGUAGE_DETECTION_MODEL,
            detectedByHeuristic: false,
        };
    }
};

export async function translateTextToEnglish({ text }) {
    const detection = await detectSourceLanguage(text);
    const primarySourceCode = getTranslationLanguageCode(
        detection.sourceIsoCode,
        DEFAULT_TRANSLATION_MODEL,
    );
    const primaryTargetCode = getTranslationLanguageCode("en", DEFAULT_TRANSLATION_MODEL);

    if (detection.sourceIsoCode === "en") {
        return {
            checkedAt: new Date().toISOString(),
            models: {
                detection: detection.detectionModel,
                translation: DEFAULT_TRANSLATION_MODEL,
            },
            sourceLanguage: detection.sourceLanguage,
            sourceIsoCode: detection.sourceIsoCode,
            sourceNllbCode: detection.sourceNllbCode,
            targetLanguage: "English",
            targetIsoCode: "en",
            targetNllbCode: primaryTargetCode || ISO_TO_NLLB_LANGUAGE.en,
            confidencePercent:
                detection.confidence == null ? null : toPercent(detection.confidence),
            translatedText: text,
            note: "The message already appears to be in English.",
        };
    }

    const translationAttempts = [];
    const candidateModels = [DEFAULT_TRANSLATION_MODEL, FALLBACK_TRANSLATION_MODEL].filter(
        (model, index, allModels) => allModels.indexOf(model) === index,
    );

    let translatedText = null;
    let usedModel = DEFAULT_TRANSLATION_MODEL;
    let sourceLanguageCode = primarySourceCode;
    let targetLanguageCode = primaryTargetCode;

    for (const model of candidateModels) {
        const srcLang = getTranslationLanguageCode(detection.sourceIsoCode, model);
        const tgtLang = getTranslationLanguageCode("en", model);

        if (!srcLang || !tgtLang) {
            translationAttempts.push(
                `${model}: unsupported language mapping for ${detection.sourceIsoCode}->en`,
            );
            continue;
        }

        try {
            const candidateTranslation = await runTranslation({
                text,
                srcLang,
                tgtLang,
                model,
            });

            if (
                isSuspiciousTranslationResult({
                    sourceText: text,
                    translatedText: candidateTranslation,
                    sourceIsoCode: detection.sourceIsoCode,
                })
            ) {
                translationAttempts.push(`${model}: suspicious translation output`);
                continue;
            }

            translatedText = candidateTranslation;
            usedModel = model;
            sourceLanguageCode = srcLang;
            targetLanguageCode = tgtLang;
            break;
        } catch (error) {
            translationAttempts.push(`${model}: ${error.providerError || error.message}`);
        }
    }

    if (!translatedText) {
        const error = new Error(
            `Translation failed for all configured models: ${translationAttempts.join(" | ")}`,
        );
        error.statusCode = 502;
        error.publicMessage = "Translation could not analyze this message right now";
        throw error;
    }

    return {
        checkedAt: new Date().toISOString(),
        models: {
            detection: detection.detectionModel,
            translation: usedModel,
        },
        sourceLanguage: detection.sourceLanguage,
        sourceIsoCode: detection.sourceIsoCode,
        sourceNllbCode: sourceLanguageCode,
        targetLanguage: "English",
        targetIsoCode: "en",
        targetNllbCode: targetLanguageCode,
        confidencePercent: detection.confidence == null ? null : toPercent(detection.confidence),
        translatedText,
        note: null,
    };
}

export async function describeImageContent({ buffer, mimeType, attachmentName }) {
    const candidateModels = [DEFAULT_IMAGE_DESCRIPTION_MODEL, FALLBACK_IMAGE_DESCRIPTION_MODEL].filter(
        (model, index, allModels) => allModels.indexOf(model) === index,
    );
    const attempts = [];
    let usedModel = DEFAULT_IMAGE_DESCRIPTION_MODEL;
    let usedProvider = null;
    let descriptionText = null;

    for (const model of candidateModels) {
        try {
            const result = await runImageToText({
                buffer,
                mimeType,
                model,
            });
            descriptionText = result.descriptionText;
            usedModel = model;
            usedProvider = result.provider;
            attempts.push({
                model,
                status: "used",
                provider: usedProvider,
                reason: null,
            });
            break;
        } catch (error) {
            attempts.push({
                model,
                status: "failed",
                provider:
                    DEFAULT_IMAGE_DESCRIPTION_PROVIDER === "auto"
                        ? null
                        : DEFAULT_IMAGE_DESCRIPTION_PROVIDER,
                reason: error.providerError || error.message,
            });
        }
    }

    if (!descriptionText) {
        try {
            const localResult = await runLocalImageToText({ buffer, mimeType });
            descriptionText = localResult.descriptionText;
            usedModel = localResult.model;
            usedProvider = localResult.provider;
            attempts.push({
                model: localResult.model,
                status: "used",
                provider: localResult.provider,
                reason: null,
            });
        } catch (error) {
            attempts.push({
                model: LOCAL_IMAGE_DESCRIPTION_MODEL,
                status: "failed",
                provider: "local-transformers",
                reason: error.providerError || error.message,
            });
        }
    }

    if (!descriptionText) {
        const error = new Error(
            `Image description failed for all configured models: ${attempts
                .map((attempt) => `${attempt.model}: ${attempt.reason || attempt.status}`)
                .join(" | ")}`
        );
        error.statusCode = 502;
        error.publicMessage = "Image description could not analyze this image right now";
        throw error;
    }

    return {
        checkedAt: new Date().toISOString(),
        models: {
            imageDescription: usedModel,
        },
        descriptionText,
        provider: {
            preference: DEFAULT_IMAGE_DESCRIPTION_PROVIDER,
            resolved: usedProvider,
        },
        attempts,
        attachmentName: attachmentName || null,
        note: "This is an AI-generated description of the uploaded image.",
    };
}

const phishingLabels = new Set(["phishing", "malicious", "fraud", "unsafe"]);
const safePhishingLabels = new Set(["legitimate", "safe", "benign", "ham", "normal"]);
const spamLabels = new Set(["spam", "junk", "scam"]);
const safeSpamLabels = new Set(["ham", "not spam", "legit", "legitimate", "normal"]);

const summarizePhishingPredictions = (predictions) => {
    const phishingMatch = pickTopMatch(predictions, (label) => {
        if (safePhishingLabels.has(label)) return false;
        return (
            phishingLabels.has(label) ||
            label.includes("phish") ||
            label.includes("malicious") ||
            label.includes("fraud")
        );
    });

    const safeMatch = pickTopMatch(
        predictions,
        (label) =>
            safePhishingLabels.has(label) ||
            label.includes("safe") ||
            label.includes("legit") ||
            label.includes("benign"),
    );

    const phishingScore = phishingMatch?.score || 0;

    return {
        topPrediction: predictions[0] || null,
        phishingScore,
        phishingPercent: toPercent(phishingScore),
        safePercent: toPercent(safeMatch?.score || Math.max(0, 1 - phishingScore)),
        flagged: phishingScore >= 0.55,
        status: phishingScore >= 0.8 ? "high_risk" : phishingScore >= 0.55 ? "review" : "clear",
    };
};

const summarizeSpamPredictions = (predictions) => {
    const spamMatch = pickTopMatch(predictions, (label) => {
        if (safeSpamLabels.has(label)) return false;
        return spamLabels.has(label) || label.includes("spam") || label.includes("scam");
    });

    const safeMatch = pickTopMatch(
        predictions,
        (label) =>
            safeSpamLabels.has(label) ||
            label.includes("ham") ||
            label.includes("not spam") ||
            label.includes("legit"),
    );

    const spamScore = spamMatch?.score || 0;

    return {
        topPrediction: predictions[0] || null,
        spamScore,
        spamPercent: toPercent(spamScore),
        safePercent: toPercent(safeMatch?.score || Math.max(0, 1 - spamScore)),
        flagged: spamScore >= 0.55,
        status: spamScore >= 0.8 ? "high_risk" : spamScore >= 0.55 ? "review" : "clear",
    };
};

const summarizeReputation = (matchesByUrl, links) => {
    const flaggedLinks = links
        .map((link) => ({
            url: link,
            matches: matchesByUrl.get(link) || [],
        }))
        .filter((entry) => entry.matches.length > 0);

    if (flaggedLinks.length === 0) {
        return {
            configured: Boolean(process.env.GOOGLE_SAFE_BROWSING_API_KEY),
            flagged: false,
            flaggedCount: 0,
            reputationPercent: 0,
            status: "clear",
            label: "No reputation flags",
            matches: [],
        };
    }

    const matches = flaggedLinks.flatMap((entry) =>
        entry.matches.map((match) => ({
            url: entry.url,
            threatType: match.threatType,
            platformType: match.platformType,
            cacheDuration: match.cacheDuration,
        })),
    );

    return {
        configured: true,
        flagged: true,
        flaggedCount: flaggedLinks.length,
        reputationPercent: toPercent(flaggedLinks.length / links.length),
        status: flaggedLinks.length === links.length ? "high_risk" : "review",
        label: flaggedLinks.length === links.length ? "Unsafe reputation" : "Some links flagged",
        matches,
    };
};

const summarizeOverallLinkResult = ({ phishingSummary, reputationSummary, links }) => {
    const reputationRisk = reputationSummary.flagged ? 1 : 0;
    const maxRisk = Math.max(phishingSummary.phishingScore, reputationRisk);

    if (maxRisk >= 0.8) {
        return {
            status: "high_risk",
            label: "Likely suspicious link",
            message: reputationSummary.flagged
                ? `Google Safe Browsing flagged at least one extracted link. Review before opening ${
                      links.length > 1 ? "these links" : "this link"
                  }.`
                : `At least one extracted link from this message looks risky. Review before opening ${
                      links.length > 1 ? "these links" : "this link"
                  }.`,
        };
    }

    if (maxRisk >= 0.55) {
        return {
            status: "review",
            label: "Needs review",
            message: reputationSummary.flagged
                ? "A URL reputation service flagged one of the extracted links."
                : "The message contains a link with moderate phishing signals.",
        };
    }

    return {
        status: "clear",
        label: "Looks safer",
        message: reputationSummary.configured
            ? "No strong phishing signal was found, and the extracted links were not flagged by Google Safe Browsing."
            : "No strong phishing signal was found. URL reputation is unavailable until Google Safe Browsing is configured.",
    };
};

const lookupSafeBrowsing = async (links) => {
    if (!process.env.GOOGLE_SAFE_BROWSING_API_KEY) {
        return {
            configured: false,
            matchesByUrl: new Map(),
        };
    }

    const response = await fetch(
        `${SAFE_BROWSING_API_URL}?key=${encodeURIComponent(process.env.GOOGLE_SAFE_BROWSING_API_KEY)}`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
            },
            body: JSON.stringify({
                client: {
                    clientId: "securechat",
                    clientVersion: "1.0.0",
                },
                threatInfo: {
                    threatTypes: [
                        "MALWARE",
                        "SOCIAL_ENGINEERING",
                        "UNWANTED_SOFTWARE",
                        "POTENTIALLY_HARMFUL_APPLICATION",
                    ],
                    platformTypes: ["ANY_PLATFORM"],
                    threatEntryTypes: ["URL"],
                    threatEntries: links.map((url) => ({ url })),
                },
            }),
        },
    );

    if (!response.ok) {
        const errorMessage = await parseInferenceError(response);
        const error = new Error(`Safe Browsing lookup failed: ${errorMessage}`);
        error.statusCode = response.status;
        error.publicMessage = "URL reputation lookup could not analyze this link right now";
        throw error;
    }

    const payload = await response.json();
    const matchesByUrl = new Map();

    for (const match of payload.matches || []) {
        const url = match?.threat?.url;
        if (!url) continue;
        const matches = matchesByUrl.get(url) || [];
        matches.push(match);
        matchesByUrl.set(url, matches);
    }

    return {
        configured: true,
        matchesByUrl,
    };
};

export async function analyzeLinkContent({ text, links }) {
    const [phishingResults, reputationLookup] = await Promise.all([
        Promise.all(
            links.map(async (link) => {
                const predictions = await runTextClassification({
                    text: link,
                    model: DEFAULT_LINK_PHISHING_MODEL,
                });

                return {
                    url: link,
                    predictions: predictions.map((prediction) => ({
                        label: prediction.label,
                        score: prediction.score,
                        percent: toPercent(prediction.score),
                    })),
                    summary: summarizePhishingPredictions(predictions),
                };
            }),
        ),
        lookupSafeBrowsing(links),
    ]);

    const phishingSummary = phishingResults
        .map((result) => result.summary)
        .sort((left, right) => right.phishingScore - left.phishingScore)[0] || {
        topPrediction: null,
        phishingScore: 0,
        phishingPercent: 0,
        safePercent: 100,
        flagged: false,
        status: "clear",
    };
    const reputationSummary = summarizeReputation(reputationLookup.matchesByUrl, links);

    return {
        checkedAt: new Date().toISOString(),
        models: {
            phishing: DEFAULT_LINK_PHISHING_MODEL,
            reputation: reputationLookup.configured
                ? "Google Safe Browsing v4"
                : "Google Safe Browsing (not configured)",
        },
        overall: summarizeOverallLinkResult({
            phishingSummary,
            reputationSummary,
            links,
        }),
        phishing: {
            summary: phishingSummary,
        },
        reputation: reputationSummary,
        links: phishingResults,
        text,
    };
}
