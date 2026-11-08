import i18next from 'i18next';
import { initReactI18next } from 'react-i18next/initReactI18next';
import resourcesToBackend from 'i18next-resources-to-backend';
import LanguageDetector from 'i18next-browser-languagedetector'; // Optional: if you want browser language detection as a fallback

const createI18nInstance = (locale?: string) => {
  const instance = i18next.createInstance();
  instance
    .use(initReactI18next)
    .use(LanguageDetector) // Optional
    .use(resourcesToBackend((language: string, namespace: string) =>
      import(`../../public/locales/${language}/${namespace}.json`)
    ))
    .init({
      // lng: locale, // Initial language, will be set by provider or layout
      fallbackLng: 'en', // Fallback language if detection or locale is invalid
      supportedLngs: ['en', 'fr'], // Your supported languages
      defaultNS: 'common', // Default namespace to load
      ns: ['common', 'home', 'BetOptions', 'GroupsManager'], // Namespaces your app uses
      interpolation: {
        escapeValue: false, // React already protects from XSS
      },
      detection: { // Optional: configuration for LanguageDetector
        order: ['path', 'navigator', 'localStorage', 'cookie'],
        caches: ['localStorage', 'cookie'],
        lookupFromPathIndex: 0, // To get language from /en/... or /fr/...
      },
      react: {
        useSuspense: false, // Set to true if you use Suspense for translations
      },
    });
  if (locale) {
    instance.changeLanguage(locale);
  }
  return instance;
};

// Export a function to initialize translations, potentially for server components
// or to pass to the client-side provider.
export async function initTranslations(locale: string, namespaces: string[], i18nInstance?: typeof i18next) {
  const i18n = i18nInstance || createI18nInstance();

  if (i18n.language !== locale) {
    await i18n.changeLanguage(locale);
  }

  await Promise.all(
    namespaces.map(ns => {
      if (!i18n.hasResourceBundle(locale, ns)) {
        // This part is tricky with resourcesToBackend and dynamic imports
        // as it expects the backend to load it.
        // For server-side, ensure resources are loaded during init or changeLanguage.
        // For client-side, it will attempt to load them.
        return i18n.loadNamespaces(ns);
      }
      return Promise.resolve();
    })
  );

  return {
    i18n: i18n,
    resources: i18n.services.resourceStore.data,
    t: i18n.t,
  };
}


// Export a default instance for client-side usage if not using the provider pattern explicitly everywhere
// or for simpler cases. However, for App Router, managing instances per request/locale is better.
export const i18n = createI18nInstance(); // Creates a default instance

export default createI18nInstance; // Export the factory 