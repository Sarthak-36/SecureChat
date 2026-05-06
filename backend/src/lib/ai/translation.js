import { spawn } from "child_process";

import {
  DEFAULT_LANGUAGE_DETECTION_MODEL,
  DEFAULT_TRANSLATION_MODEL,
  ENGLISH_HINT_WORDS,
  FALLBACK_TRANSLATION_MODEL,
  HINGLISH_HINT_WORDS,
  HINGLISH_PHRASE_TRANSLATIONS,
  HINGLISH_TOKEN_TRANSLATIONS,
  ISO_TO_MBART_LANGUAGE,
  ISO_TO_NLLB_LANGUAGE,
  LANGUAGE_CODE_TO_NAME,
  LANGUAGE_DETECTOR_SCRIPT_PATH,
  NLLB_TRANSLATION_FALLBACK_MODEL,
} from "./config.js";
import { runTextClassification, runTranslation } from "./provider.js";
import {
  escapeRegExp,
  getNormalizedLatinTokens,
  isSuspiciousTranslationResult,
  normalizeComparableText,
  normalizeLabel,
  prettifyLabel,
  toPercent,
} from "./utils.js";

export const getTranslationLanguageCode = (isoCode, model) => {
    if (model.includes("mbart-large-50")) {
        return ISO_TO_MBART_LANGUAGE[isoCode] || null;
    }

    return ISO_TO_NLLB_LANGUAGE[isoCode] || null;
};

export const detectLikelyHinglish = (text = "") => {
    if (!text.trim()) return false;

    if (!/^[\x00-\x7F\s.,!?'"()\-:;@#/&%0-9]+$/.test(text)) {
        return false;
    }

    const normalizedText = normalizeComparableText(text);
    const tokens = getNormalizedLatinTokens(text);

    if (tokens.length === 0) {
        return false;
    }

    for (const phrase of HINGLISH_PHRASE_TRANSLATIONS.keys()) {
        if (normalizedText.includes(normalizeComparableText(phrase))) {
            return true;
        }
    }

    const hinglishMatches = tokens.filter((token) => HINGLISH_HINT_WORDS.has(token)).length;
    const englishMatches = tokens.filter((token) => ENGLISH_HINT_WORDS.has(token)).length;
    const hinglishRatio = hinglishMatches / tokens.length;

    if (tokens.length === 1) {
        return HINGLISH_HINT_WORDS.has(tokens[0]) && !ENGLISH_HINT_WORDS.has(tokens[0]);
    }

    return (
        hinglishMatches >= 2 ||
        (hinglishMatches >= 1 && hinglishRatio >= 0.4 && englishMatches <= hinglishMatches)
    );
};

export const detectLikelyEnglish = (text = "") => {
    if (!text.trim()) return false;

    if (!/^[\x00-\x7F\s.,!?'"()\-:;@#/&%0-9]+$/.test(text)) {
        return false;
    }

    const normalizedTokens = getNormalizedLatinTokens(text);

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

export const detectSourceLanguageLocally = async (text) => {
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

export const translateHinglishText = (text = "") => {
    const normalizedText = normalizeComparableText(text);
    const exactPhraseTranslation = HINGLISH_PHRASE_TRANSLATIONS.get(normalizedText);

    if (exactPhraseTranslation) {
        return exactPhraseTranslation;
    }

    let translatedText = normalizedText;
    const phrasesByLength = [...HINGLISH_PHRASE_TRANSLATIONS.entries()].sort(
        ([leftPhrase], [rightPhrase]) => rightPhrase.length - leftPhrase.length,
    );

    for (const [phrase, translation] of phrasesByLength) {
        const normalizedPhrase = normalizeComparableText(phrase);
        translatedText = translatedText.replace(
            new RegExp(`\\b${escapeRegExp(normalizedPhrase)}\\b`, "g"),
            translation,
        );
    }

    const translatedTokens = translatedText
        .split(/\s+/)
        .map((token) => HINGLISH_TOKEN_TRANSLATIONS.get(token) ?? token)
        .filter(Boolean);

    return translatedTokens.join(" ").replace(/\s+/g, " ").trim();
};

export const getHinglishTranslation = (text = "") => {
    if (!detectLikelyHinglish(text)) {
        return null;
    }

    const translatedText = translateHinglishText(text);

    if (
        !translatedText ||
        isSuspiciousTranslationResult({
            sourceText: text,
            translatedText,
            sourceIsoCode: "hi",
        })
    ) {
        return null;
    }

    return translatedText;
};

export const detectSourceLanguage = async (text) => {
    if (detectLikelyHinglish(text)) {
        return {
            sourceIsoCode: "hi",
            sourceNllbCode: ISO_TO_NLLB_LANGUAGE.hi,
            sourceLanguage: "Hinglish",
            confidence: null,
            detectionModel: "hinglish heuristic",
            detectedByHeuristic: true,
        };
    }

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
        let predictions;
        try {
            predictions = await runTextClassification({
                text,
                model: DEFAULT_LANGUAGE_DETECTION_MODEL,
            });
        } catch (classificationError) {
            classificationError.publicMessage =
                "Translation could not analyze this message right now";
            throw classificationError;
        }

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

    const hinglishTranslation = getHinglishTranslation(text);
    if (hinglishTranslation) {
        return {
            checkedAt: new Date().toISOString(),
            models: {
                detection: detection.detectionModel,
                translation: "hinglish heuristic",
            },
            sourceLanguage: detection.sourceLanguage,
            sourceIsoCode: detection.sourceIsoCode,
            sourceNllbCode: detection.sourceNllbCode,
            targetLanguage: "English",
            targetIsoCode: "en",
            targetNllbCode: primaryTargetCode || ISO_TO_NLLB_LANGUAGE.en,
            confidencePercent:
                detection.confidence == null ? null : toPercent(detection.confidence),
            translatedText: hinglishTranslation,
            note: "Translated common Hinglish wording with the local heuristic.",
        };
    }

    const translationAttempts = [];
    const candidateModels = [
        DEFAULT_TRANSLATION_MODEL,
        FALLBACK_TRANSLATION_MODEL,
        NLLB_TRANSLATION_FALLBACK_MODEL,
    ].filter((model, index, allModels) => allModels.indexOf(model) === index);

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
                const fallbackTranslation = getHinglishTranslation(text);
                if (fallbackTranslation) {
                    translatedText = fallbackTranslation;
                    usedModel = "hinglish heuristic";
                    sourceLanguageCode = detection.sourceNllbCode;
                    targetLanguageCode = primaryTargetCode || ISO_TO_NLLB_LANGUAGE.en;
                    break;
                }

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
