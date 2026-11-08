export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

// This ensures the HTML and BODY tags don't get duplicated
export const metadata = {
  title: 'Centrale Vegas',
}; 