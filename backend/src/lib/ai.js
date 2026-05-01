const HF_API_BASE_URL = "https://router.huggingface.co/hf-inference/models";
const SAFE_BROWSING_API_URL = "https://safebrowsing.googleapis.com/v4/threatMatches:find";
const DEFAULT_NSFW_MODEL = process.env.HF_NSFW_MODEL || "Falconsai/nsfw_image_detection";
const DEFAULT_AI_IMAGE_MODEL =
  process.env.HF_AI_IMAGE_MODEL || "prithivMLmods/deepfake-detector-model-v1";
const DEFAULT_TEXT_AI_MODEL =
  process.env.HF_TEXT_AI_MODEL ||
  process.env.HF_TEXT_MODERATION_MODEL ||
  "Hello-SimpleAI/chatgpt-detector-roberta";
const DEFAULT_LINK_PHISHING_MODEL =
  process.env.HF_LINK_PHISHING_MODEL || "ealvaradob/bert-finetuned-phishing";
const NSFW_LABELS = new Set(["nsfw", "porn", "hentai", "sexy", "explicit"]);
const SAFE_IMAGE_LABELS = new Set(["sfw", "safe", "neutral", "normal"]);
const AI_IMAGE_LABELS = new Set([
  "ai",
  "generated",
  "synthetic",
  "fake",
  "artificial",
  "deepfake",
]);
const HUMAN_IMAGE_LABELS = new Set([
  "human",
  "real",
  "authentic",
  "natural",
  "realism",
]);
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

const normalizeLabel = (label = "") => label.trim().toLowerCase();
const prettifyLabel = (label = "") =>
  label
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());

const toPercent = (score = 0) => Number((score * 100).toFixed(2));

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
      label.includes("explicit")
  );

  const safeMatch = pickTopMatch(
    predictions,
    (label) =>
      SAFE_IMAGE_LABELS.has(label) ||
      (label.includes("safe") && !label.includes("unsafe")) ||
      label.includes("neutral") ||
      label.includes("normal")
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
      label.includes("fake")
  );

  const humanMatch = pickTopMatch(
    predictions,
    (label) =>
      HUMAN_IMAGE_LABELS.has(label) ||
      label.includes("human") ||
      label.includes("real") ||
      label.includes("authentic") ||
      label.includes("natural")
  );

  const fallbackTopPrediction = predictions[0] || null;
  const derivedAiScore =
    aiMatch?.score ??
    (fallbackTopPrediction && AI_IMAGE_LABELS.has(normalizeLabel(fallbackTopPrediction.label))
      ? fallbackTopPrediction.score
      : null);
  const derivedHumanScore =
    humanMatch?.score ??
    (fallbackTopPrediction && HUMAN_IMAGE_LABELS.has(normalizeLabel(fallbackTopPrediction.label))
      ? fallbackTopPrediction.score
      : null);
  const aiScore =
    derivedAiScore ??
    (typeof derivedHumanScore === "number" ? Math.max(0, 1 - derivedHumanScore) : 0);
  const humanScore =
    derivedHumanScore ??
    (typeof derivedAiScore === "number" ? Math.max(0, 1 - derivedAiScore) : Math.max(0, 1 - aiScore));

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
      message: "The detector found some signals of AI generation, but confidence is moderate.",
    };
  }

  return {
    status: "clear",
    label: "Looks acceptable",
    message: "No strong NSFW risk was found, and the image looks more likely real than AI-generated.",
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

const AI_TEXT_LABELS = new Set(["chatgpt", "ai", "generated", "machine", "llm", "gpt", "synthetic"]);
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
      label.includes("ai")
  );

  const humanMatch = pickTopMatch(
    predictions,
    (label) =>
      HUMAN_TEXT_LABELS.has(label) ||
      label.includes("human") ||
      label.includes("authentic") ||
      label.includes("organic")
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
    (typeof derivedAiScore === "number" ? Math.max(0, 1 - derivedAiScore) : Math.max(0, 1 - aiScore));

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
      label.includes("benign")
  );

  const phishingScore = phishingMatch?.score || 0;

  return {
    topPrediction: predictions[0] || null,
    phishingScore,
    phishingPercent: toPercent(phishingScore),
    safePercent: toPercent(safeMatch?.score || Math.max(0, 1 - phishingScore)),
    flagged: phishingScore >= 0.55,
    status:
      phishingScore >= 0.8 ? "high_risk" : phishingScore >= 0.55 ? "review" : "clear",
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
      label.includes("legit")
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
    }))
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
    }
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
    })
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
      reputation: reputationLookup.configured ? "Google Safe Browsing v4" : "Google Safe Browsing (not configured)",
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
