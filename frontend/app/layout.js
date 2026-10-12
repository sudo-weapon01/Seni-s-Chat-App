import './globals.css';
import { Providers } from '@/components/Providers';

export const metadata = {
  title: 'Seni Chat — Fast, Modern 1-on-1 Real-Time Messaging',
  description: 'Experience instant, private 1-on-1 messaging with real-time WebSocket delivery, typing indicators, read receipts, and message edit history.',
  keywords: ['chat', 'real-time messaging', 'websocket', 'socket.io', 'seni chat'],
  authors: [{ name: 'Seni Chat Team' }],
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
