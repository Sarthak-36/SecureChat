export const normalizeLabel = (label = "") => label.trim().toLowerCase();
export const prettifyLabel = (label = "") =>
    label.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());

export const toPercent = (score = 0) => Number((score * 100).toFixed(2));
export const stripDiacritics = (text = "") => text.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
export const countWords = (text = "") => text.trim().split(/\s+/).filter(Boolean).length;

export const pickTopMatch = (predictions, matcher) =>
    predictions
        .filter((prediction) => matcher(normalizeLabel(prediction.label)))
        .sort((left, right) => right.score - left.score)[0];

export const normalizeComparableText = (text = "") =>
    stripDiacritics(text.toLowerCase())
        .replace(/[^\p{L}\p{N}]+/gu, " ")
        .trim();

export const escapeRegExp = (text = "") => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const getNormalizedLatinTokens = (text = "") =>
    stripDiacritics(text.toLowerCase())
        .split(/[^a-z]+/)
        .filter(Boolean);

export const isSuspiciousSummaryResult = ({ sourceText, summaryText }) => {
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

export const isSuspiciousTranslationResult = ({ sourceText, translatedText, sourceIsoCode }) => {
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
