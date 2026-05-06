import { InferenceClient } from "@huggingface/inference";

import {
  HF_API_BASE_URL,
  HF_INFERENCE_TIMEOUT_MS,
  DEFAULT_SUMMARIZATION_PROVIDER,
  MODEL_LABEL_MAPPINGS,
} from "./config.js";
import { normalizeLabel, prettifyLabel } from "./utils.js";

let inferenceClient;

export const getInferenceClient = () => {
  if (!inferenceClient) {
    inferenceClient = new InferenceClient(process.env.HUGGINGFACE_API_KEY);
  }

  return inferenceClient;
};

export const getSummaryProviderInfo = () => ({
  providerPreference: DEFAULT_SUMMARIZATION_PROVIDER,
  resolvedProvider:
    DEFAULT_SUMMARIZATION_PROVIDER === "auto" ? null : DEFAULT_SUMMARIZATION_PROVIDER,
});

export const ensureInferenceConfigured = () => {
    if (!process.env.HUGGINGFACE_API_KEY) {
        const error = new Error("AI detection is not configured");
        error.statusCode = 503;
        error.publicMessage = "AI detection is not configured on the server";
        throw error;
    }
};

export const parseInferenceError = async (response) => {
    const responseText = await response.text();

    try {
        const payload = JSON.parse(responseText);
        return payload?.error || responseText;
    } catch {
        return responseText;
    }
};

export const createProviderRequestError = ({ error, model, publicMessage, timeoutMs }) => {
    const isTimeout =
        error?.name === "AbortError" ||
        error?.cause?.code === "UND_ERR_CONNECT_TIMEOUT" ||
        error?.cause?.code === "UND_ERR_HEADERS_TIMEOUT" ||
        error?.code === "UND_ERR_CONNECT_TIMEOUT";
    const detail = isTimeout
        ? `Timed out after ${timeoutMs}ms`
        : error?.cause?.code || error?.message || "Network request failed";
    const wrappedError = new Error(`Inference request failed for ${model}: ${detail}`);
    wrappedError.statusCode = isTimeout ? 504 : 503;
    wrappedError.publicMessage = publicMessage;
    wrappedError.providerError = detail;
    return wrappedError;
};

export const fetchHuggingFaceInference = async ({ model, body, headers = {}, publicMessage }) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), HF_INFERENCE_TIMEOUT_MS);

    try {
        return await fetch(`${HF_API_BASE_URL}/${model}`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
                Accept: "application/json",
                ...headers,
            },
            body,
            signal: controller.signal,
        });
    } catch (error) {
        throw createProviderRequestError({
            error,
            model,
            publicMessage,
            timeoutMs: HF_INFERENCE_TIMEOUT_MS,
        });
    } finally {
        clearTimeout(timeoutId);
    }
};

export const normalizePredictions = (payload) => {
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

export const prepareTextForModel = (text, model) => {
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

export const mapPredictionLabels = (predictions, model) => {
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

export const runImageClassification = async ({ buffer, mimeType, model }) => {
    ensureInferenceConfigured();

    const response = await fetchHuggingFaceInference({
        model,
        headers: {
            "Content-Type": mimeType || "application/octet-stream",
        },
        body: buffer,
        publicMessage: "AI detection could not analyze this image right now",
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

export const runTextClassification = async ({ text, model }) => {
    ensureInferenceConfigured();
    const preparedText = prepareTextForModel(text, model);

    const response = await fetchHuggingFaceInference({
        model,
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            inputs: preparedText,
            parameters: {
                top_k: 6,
            },
        }),
        publicMessage: "AI detection could not analyze this message right now",
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

export const runTranslation = async ({ text, srcLang, tgtLang, model }) => {
    ensureInferenceConfigured();

    const response = await fetchHuggingFaceInference({
        model,
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            inputs: text,
            parameters: {
                src_lang: srcLang,
                tgt_lang: tgtLang,
                clean_up_tokenization_spaces: true,
            },
        }),
        publicMessage: "Translation could not analyze this message right now",
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
