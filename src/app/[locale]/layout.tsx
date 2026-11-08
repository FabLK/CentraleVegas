import type { Metadata, Viewport } from 'next'
import { Inter } from "next/font/google"
import "../globals.css"
import { Navbar } from "@/components/Navbar"
import { SupabaseProvider } from '@/lib/supabase/context'
import { GroupProvider } from '@/lib/group/context'
import { UserProvider } from '@/lib/user/context'
import { BalanceProvider } from '@/lib/balance/context'
import { Toaster } from "sonner"
import { UmamiAnalytics } from '@/components/UmamiAnalytics'
import { initTranslations } from '@/lib/i18n'
import TranslationsProvider from './i18n-provider'

const inter = Inter({ subsets: ["latin"] })

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  minimumScale: 1,
  userScalable: false,
}

// Generate metadata function that uses translations
export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const { t } = await initTranslations(locale, ['common']);
  
  return {
    title: {
      default: t('common:metadata.title'),
      template: t('common:metadata.titleTemplate')
    },
    icons: {
      icon: '/logo white big.png',
    },
    description: t('common:metadata.description'),
    keywords: t('common:metadata.keywords').split(', '),
    authors: [{ name: 'Centrale Vegas Team' }],
    creator: 'Centrale Vegas',
    publisher: 'Centrale Vegas',
    formatDetection: {
      email: false,
      address: false,
      telephone: false,
    },
    openGraph: {
      type: 'website',
      locale: locale === 'fr' ? 'fr_FR' : 'en_US',
      url: 'https://centralevegas.com',
      siteName: t('common:metadata.siteName'),
      title: t('common:metadata.openGraph.title'),
      description: t('common:metadata.openGraph.description'),
      
    },
    twitter: {
      card: 'summary_large_image',
      title: t('common:metadata.twitter.title'),
      description: t('common:metadata.twitter.description'),

    },
  };
}

// This function helps Next.js know which languages are available for static generation
export async function generateStaticParams() {
  // This tells Next.js which locales to pre-render
  return [{ locale: 'en' }, { locale: 'fr' }];
}

export default async function RootLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const { resources } = await initTranslations(locale, ['home', 'common', 'navbar', 'auth', 'BetPage', 'BetOptions', 'BetDrawer', 'BetDrawer']);

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className={inter.className}>
        <TranslationsProvider
          locale={locale}
          namespaces={['home', 'common', 'navbar', 'auth', 'BetPage', 'BetOptions', 'BetDrawer', 'BetDrawer']}
          resources={resources as Record<string, Record<string, Record<string, string>>>}
        >
          <SupabaseProvider>
            <GroupProvider>
              <UserProvider>
                <BalanceProvider>
                  <Navbar />
                  <main className="min-h-screen bg-background">
                    {children}
                  </main>
                  <footer className="text-center text-sm text-gray-500 py-4">
                    centralevegas@gmail.com
                  </footer>
                </BalanceProvider>
              </UserProvider>
            </GroupProvider>
          </SupabaseProvider>
        </TranslationsProvider>
        <UmamiAnalytics />
        <Toaster position="bottom-right" />
      </body>
    </html>
  )
}