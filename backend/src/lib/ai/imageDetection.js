import {
  AI_IMAGE_LABELS,
  DEFAULT_AI_IMAGE_MODEL,
  DEFAULT_NSFW_MODEL,
  HUMAN_IMAGE_LABELS,
  NSFW_LABELS,
  SAFE_IMAGE_LABELS,
} from "./config.js";
import { runImageClassification } from "./provider.js";
import { normalizeLabel, pickTopMatch, toPercent } from "./utils.js";

export const summarizeNsfw = (predictions) => {
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

export const summarizeAiGenerated = (predictions) => {
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

export const summarizeOverallImageResult = ({ nsfwSummary, aiSummary }) => {
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
