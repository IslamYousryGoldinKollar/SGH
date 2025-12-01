
'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Game } from '@/lib/types';
import { cn } from '@/lib/utils';
import Header from '@/components/layout/Header';

export default function MainLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [gameId, setGameId] = useState<string | null>(null);

  useEffect(() => {
    const segments = pathname.split('/');
    if (segments[1] === 'game' && segments[2]) {
      setGameId(segments[2].toUpperCase());
    } else {
      setGameId(null);
    }
  }, [pathname]);

  return (
    <>
      <Header />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </>
  );
}
