import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/auth/', '/api/'],
    },
    sitemap: 'https://centralevegas.com/sitemap.xml',
  }
} 