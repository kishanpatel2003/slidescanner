import './globals.css';

export const metadata = {
  title: 'SlideScanner',
  description: 'Turn Google Slides decks into LLM-ready markdown',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
