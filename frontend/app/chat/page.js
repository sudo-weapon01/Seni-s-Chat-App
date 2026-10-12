'use client';

import { Suspense } from 'react';
import { RequireAuth } from '@/components/RequireAuth';
import { ChatApp } from '@/components/ChatApp';

export default function ChatPage() {
  return (
    <RequireAuth>
      <Suspense fallback={<div className="page-center muted">Loading chat…</div>}>
        <ChatApp />
      </Suspense>
    </RequireAuth>
  );
}
