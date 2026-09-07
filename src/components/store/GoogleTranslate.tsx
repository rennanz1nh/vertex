"use client";

import { useEffect } from "react";

/**
 * Loads the Google Website Translator. We drive it from our own
 * LanguageSelector via the `googtrans` cookie, so the native widget UI is
 * hidden (see globals.css). pageLanguage is English; the included languages
 * mirror the Wix reference site.
 */
export default function GoogleTranslate() {
  useEffect(() => {
    if (document.getElementById("google-translate-script")) return;

    (window as unknown as { googleTranslateElementInit: () => void }).googleTranslateElementInit =
      () => {
        const g = (window as unknown as { google?: { translate?: { TranslateElement: new (o: object, id: string) => void } } }).google;
        if (g?.translate) {
          new g.translate.TranslateElement(
            {
              pageLanguage: "en",
              includedLanguages: "en,es,zh-CN,ar,pt,fr,it,ru",
              autoDisplay: false,
            },
            "google_translate_element"
          );
        }
      };

    const s = document.createElement("script");
    s.id = "google-translate-script";
    s.src =
      "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
    document.body.appendChild(s);
  }, []);

  return <div id="google_translate_element" aria-hidden className="hidden" />;
}
