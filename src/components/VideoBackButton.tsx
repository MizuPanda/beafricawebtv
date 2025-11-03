'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

type VideoBackButtonProps = {
  className?: string;
  label?: string;
  queryHref?: string | null;
  referrerHref?: string | null;
};

type Destination =
  | { kind: 'link'; href: string }
  | { kind: 'history' };

const CANDIDATE_QUERY_KEYS = [
  'from',
  'origin',
  'ref',
  'returnTo',
  'redirect',
] as const;

const sanitizeRelativePath = (value?: string | null): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!trimmed.startsWith('/')) return null;
  if (trimmed.startsWith('//')) return null;
  return trimmed;
};

const sameDestination = (a: Destination | null, b: Destination | null) => {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.kind !== b.kind) return false;
  if (a.kind === 'link' && b.kind === 'link') {
    return a.href === b.href;
  }
  return true;
};

export default function VideoBackButton({
  className,
  label = 'Back',
  queryHref,
  referrerHref,
}: VideoBackButtonProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchParamsSnapshot = searchParams?.toString() ?? '';

  const [destination, setDestination] = useState<Destination | null>(() => {
    const initialPath =
      sanitizeRelativePath(queryHref) ?? sanitizeRelativePath(referrerHref);
    return initialPath ? { kind: 'link', href: initialPath } : null;
  });

  useEffect(() => {
    const params = searchParamsSnapshot
      ? new URLSearchParams(searchParamsSnapshot)
      : null;

    const pickFromParams = () => {
      if (!params) return null;
      for (const key of CANDIDATE_QUERY_KEYS) {
        const candidate = sanitizeRelativePath(params.get(key));
        if (candidate) return candidate;
      }
      return null;
    };

    const pickDocumentRef = () => {
      if (typeof document === 'undefined' || typeof window === 'undefined') {
        return null;
      }

      const ref = document.referrer;
      if (!ref) return null;

      try {
        const refUrl = new URL(ref);
        if (refUrl.origin !== window.location.origin) return null;
        return `${refUrl.pathname}${refUrl.search}${refUrl.hash}`;
      } catch {
        return null;
      }
    };

    const updateDestination = (next: Destination | null) => {
      setDestination((prev) => (sameDestination(prev, next) ? prev : next));
    };

    const queryPath =
      sanitizeRelativePath(queryHref) ?? pickFromParams();
    if (queryPath) {
      updateDestination({ kind: 'link', href: queryPath });
      return;
    }

    const refererPath = sanitizeRelativePath(referrerHref);
    if (refererPath) {
      updateDestination({ kind: 'link', href: refererPath });
      return;
    }

    const documentRef = pickDocumentRef();
    if (documentRef) {
      updateDestination({ kind: 'link', href: documentRef });
      return;
    }

    if (typeof window !== 'undefined' && window.history.length > 1) {
      updateDestination({ kind: 'history' });
      return;
    }

    updateDestination(null);
  }, [queryHref, referrerHref, searchParamsSnapshot]);

  const handleHistoryBack = useCallback(() => {
    router.back();
  }, [router]);

  if (!destination) return null;

  const classes = className ?? 'text-blue-600 underline';
  const content = (
    <span>&larr; {label}</span>
  );

  if (destination.kind === 'link') {
    return (
      <Link href={destination.href} className={classes}>
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      className={classes}
      onClick={handleHistoryBack}
      aria-label={`${label} to previous page`}
    >
      {content}
    </button>
  );
}
