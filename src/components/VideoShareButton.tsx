'use client';

import { usePathname } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from 'react';
import { LinkIcon, Share2Icon } from 'lucide-react';

type FeedbackState =
  | { kind: 'success'; message: string }
  | { kind: 'error'; message: string }
  | { kind: 'info'; message: string };

type VideoShareButtonProps = {
  title: string;
  description?: string | null;
  path?: string;
  className?: string;
};

const COPY_SUCCESS_MESSAGE = 'Lien copié dans le presse-papiers.';
const COPY_ERROR_MESSAGE =
  'Impossible de copier le lien automatiquement. Veuillez copier manuellement.';
const SHARE_UNAVAILABLE_MESSAGE =
  'Le partage est indisponible pour le moment...';

const normalizePath = (value?: string | null): string | null => {
  if (!value) return null;
  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value;
  }
  return value.startsWith('/') ? value : `/${value}`;
};

const mergeClassNames = (base: string, extra?: string) =>
  extra ? `${base} ${extra}` : base;

const createHiddenTextarea = (text: string) => {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.top = '-1000px';
  textarea.style.opacity = '0';
  textarea.style.pointerEvents = 'none';
  document.body.appendChild(textarea);
  return textarea;
};

type ShareAction = {
  id: string;
  label: string;
  action: () => Promise<void> | void;
  icon: ComponentType<{ className?: string }>;
};

export default function VideoShareButton({
  title,
  description,
  path,
  className,
}: VideoShareButtonProps) {
  const pathname = usePathname();
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [nativeShareAvailable, setNativeShareAvailable] = useState(false);

  const sharePath = useMemo(
    () => normalizePath(path ?? pathname ?? null),
    [path, pathname],
  );

  const toggleButtonRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const firstActionRef = useRef<HTMLButtonElement | null>(null);

  const resolveShareUrl = useCallback((): string | null => {
    if (!sharePath) {
      if (typeof window === 'undefined') return null;
      return window.location.href;
    }

    if (sharePath.startsWith('http://') || sharePath.startsWith('https://')) {
      return sharePath;
    }

    if (typeof window === 'undefined') return null;
    return `${window.location.origin}${sharePath}`;
  }, [sharePath]);

  const copyToClipboard = useCallback(async (url: string) => {
    if (typeof navigator === 'undefined' || typeof document === 'undefined') {
      return false;
    }

    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      return true;
    }

    const textarea = createHiddenTextarea(url);
    textarea.select();

    try {
      const result = document.execCommand('copy');
      document.body.removeChild(textarea);
      return result;
    } catch {
      document.body.removeChild(textarea);
      return false;
    }
  }, []);

  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      setNativeShareAvailable(true);
    }
  }, []);

  useEffect(() => {
    if (!feedback) return;
    if (typeof window === 'undefined') return;

    const timer = window.setTimeout(() => {
      setFeedback((current) => (current === feedback ? null : current));
    }, 3000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [feedback]);

  useEffect(() => {
    if (!popoverOpen) return;

    const handlePointer = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (
        popoverRef.current?.contains(target) ||
        toggleButtonRef.current?.contains(target)
      ) {
        return;
      }
      setPopoverOpen(false);
    };

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setPopoverOpen(false);
        toggleButtonRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('touchstart', handlePointer);
    document.addEventListener('keydown', handleKey);

    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('touchstart', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [popoverOpen]);

  useEffect(() => {
    if (!popoverOpen) return;

    const nextUrl = resolveShareUrl();
    if (nextUrl) {
      setShareUrl(nextUrl);
    }
  }, [popoverOpen, resolveShareUrl]);

  useEffect(() => {
    if (!popoverOpen) return;

    const focusTimer = window.setTimeout(() => {
      firstActionRef.current?.focus();
    }, 0);

    return () => {
      window.clearTimeout(focusTimer);
    };
  }, [popoverOpen]);

  const trimmedDescription = useMemo(() => description?.trim() ?? '', [description]);

  const shareSummary = useMemo(() => {
    if (!trimmedDescription) return undefined;
    return trimmedDescription.length > 160
      ? `${trimmedDescription.slice(0, 157)}...`
      : trimmedDescription;
  }, [trimmedDescription]);

  const handleTogglePopover = () => {
    setPopoverOpen((prev) => !prev);
  };

  const handleCopyLink = useCallback(async () => {
    const url = shareUrl ?? resolveShareUrl();
    if (!url) {
      setFeedback({ kind: 'error', message: SHARE_UNAVAILABLE_MESSAGE });
      return;
    }

    const copied = await copyToClipboard(url);
    if (copied) {
      setFeedback({ kind: 'success', message: COPY_SUCCESS_MESSAGE });
      setPopoverOpen(false);
    } else {
      setFeedback({ kind: 'error', message: COPY_ERROR_MESSAGE });
    }
  }, [copyToClipboard, resolveShareUrl, shareUrl]);

  const handleNativeShare = useCallback(async () => {
    const url = shareUrl ?? resolveShareUrl();
    if (!url) {
      setFeedback({ kind: 'error', message: SHARE_UNAVAILABLE_MESSAGE });
      return;
    }

    if (
      typeof navigator === 'undefined' ||
      typeof navigator.share !== 'function'
    ) {
      setFeedback({ kind: 'error', message: SHARE_UNAVAILABLE_MESSAGE });
      return;
    }

    const shareData: ShareData = {
      title,
      text: shareSummary ?? title,
      url,
    };

    try {
      await navigator.share(shareData);
      setPopoverOpen(false);
    } catch (error) {
      const isAbort =
        error instanceof DOMException && error.name === 'AbortError';

      if (isAbort) {
        setPopoverOpen(false);
      } else {
        setFeedback({ kind: 'error', message: SHARE_UNAVAILABLE_MESSAGE });
      }
    }
  }, [resolveShareUrl, shareSummary, shareUrl, title]);

  const wrapperClassName = mergeClassNames(
    'relative inline-flex flex-col text-sm text-slate-200',
    className,
  );

  const buttonClassName =
    'inline-flex items-center justify-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:border-white/40 hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white';

  const popoverClasses =
    'absolute left-0 z-20 mt-2 w-72 rounded-2xl border border-white/10 bg-slate-950/95 p-3 shadow-xl backdrop-blur';

  const optionClasses =
    'flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-white transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white';

  const actionItems = useMemo<ShareAction[]>(() => {
    const items: ShareAction[] = [
      {
        id: 'copy',
        label: 'Copier le lien',
        action: handleCopyLink,
        icon: LinkIcon,
      },
    ];

    if (nativeShareAvailable) {
      items.unshift({
        id: 'native',
        label: 'Partager la vidéo',
        action: handleNativeShare,
        icon: Share2Icon,
      });
    }

    return items;
  }, [handleCopyLink, handleNativeShare, nativeShareAvailable]);

  return (
    <div className={wrapperClassName}>
      <button
        ref={toggleButtonRef}
        type="button"
        onClick={handleTogglePopover}
        className={buttonClassName}
        aria-expanded={popoverOpen}
        aria-controls="video-share-options"
      >
        <svg
          aria-hidden="true"
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7" />
          <path d="M16 6l-4-4-4 4" />
          <path d="M12 2v13" />
        </svg>
        <span>Partager</span>
      </button>

      <p
        aria-live="polite"
        className={
          `mt-2 min-h-[1rem] text-xs transition-colors duration-200 ${
            feedback
              ? feedback.kind === 'success'
                ? 'text-emerald-300'
                : feedback.kind === 'error'
                  ? 'text-red-300'
                  : 'text-slate-300'
              : 'text-transparent'
          }`
        }
      >
        {feedback?.message ?? ''}
      </p>

      {popoverOpen ? (
        <div
          ref={popoverRef}
          id="video-share-options"
          role="dialog"
          aria-modal="false"
          aria-label="Options de partage"
          className={popoverClasses}
        >
          <div className="mb-2 text-xs uppercase tracking-wide text-slate-400">
            Sélectionnez une option
          </div>

          <div className="space-y-1">
            {actionItems.map((item, index) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={optionClasses}
                  onClick={item.action}
                  ref={index === 0 ? firstActionRef : null}
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}







