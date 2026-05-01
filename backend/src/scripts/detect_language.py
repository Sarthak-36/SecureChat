import json
import sys

import langid
from langid.langid import LanguageIdentifier, model


IDENTIFIER = LanguageIdentifier.from_modelstring(model, norm_probs=True)


def main():
    text = sys.stdin.read()
    if not text or not text.strip():
        print(json.dumps({"lang": "en", "confidence": 0.0}))
        return

    lang, confidence = IDENTIFIER.classify(text)
    print(json.dumps({"lang": lang, "confidence": float(confidence)}))


if __name__ == "__main__":
    main()
