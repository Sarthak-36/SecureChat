import { DEFAULT_LINK_PHISHING_MODEL, SAFE_BROWSING_API_URL } from "./config.js";
import { parseInferenceError, runTextClassification } from "./provider.js";
import { pickTopMatch, toPercent } from "./utils.js";

const phishingLabels = new Set(["phishing", "malicious", "fraud", "unsafe"]);
const safePhishingLabels = new Set(["legitimate", "safe", "benign", "ham", "normal"]);
const spamLabels = new Set(["spam", "junk", "scam"]);
const safeSpamLabels = new Set(["ham", "not spam", "legit", "legitimate", "normal"]);

export const summarizePhishingPredictions = (predictions) => {
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

export const summarizeSpamPredictions = (predictions) => {
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

export const summarizeReputation = (matchesByUrl, links) => {
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

export const summarizeOverallLinkResult = ({ phishingSummary, reputationSummary, links }) => {
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

export const lookupSafeBrowsing = async (links) => {
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
