'use client';

import { I18nextProvider } from 'react-i18next';
import { useEffect, ReactNode } from 'react';
import createI18nInstance, { initTranslations } from '@/lib/i18n'; // Adjusted path
import { useParams } from 'next/navigation'; // To get locale on client side if needed

interface TranslationsProviderProps {
  children: ReactNode;
  locale: string;
  namespaces: string[];
  resources?: Record<string, Record<string, Record<string, string>>>; // Preloaded resources from server
}

export default function TranslationsProvider({
  children,
  locale,
  namespaces,
  resources
}: TranslationsProviderProps) {
  // Use `useParams` to get the locale on the client. This ensures that even if `locale` prop
  // is somehow stale during client-side navigation, we try to use the most current one from URL.
  const params = useParams();
  const clientLocale = params 
    ? (Array.isArray(params.locale) ? params.locale[0] : params.locale || locale)
    : locale;

  // Create a new i18next instance for this provider. This is important to avoid
  // issues with shared state between requests in server environments or between
  // different parts of the app on the client.
  const i18n = createI18nInstance(clientLocale);

  // If resources are passed from the server, add them to the instance.
  if (resources) {
    Object.keys(resources).forEach((lang) => {
      Object.keys(resources[lang]).forEach((ns) => {
        i18n.addResourceBundle(lang, ns, resources[lang][ns]);
      });
    });
  }

  // Effect to change language if the locale prop changes after initial mount
  // or if clientLocale from URL is different and more up-to-date.
  useEffect(() => {
    if (i18n.language !== clientLocale) {
      i18n.changeLanguage(clientLocale);
    }
  }, [clientLocale, i18n]);

  // Ensure namespaces are loaded on the client if not already present from server pass-through
  useEffect(() => {
    const load = async () => {
      await initTranslations(clientLocale, namespaces, i18n);
    };
    if (!resources) { // Only if resources weren't preloaded
        load();
    }
  }, [clientLocale, namespaces, i18n, resources]);

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
} 