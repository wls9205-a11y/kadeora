// Global type declarations — browser APIs not in standard TypeScript

interface Window {
  Kakao?: {
    init: (key: string) => void;
    isInitialized: () => boolean;
    Share: {
      sendDefault: (params: Record<string, unknown>) => void;
    };
  };
  __pwaPrompt?: BeforeInstallPromptEvent;
  MSStream?: unknown;
  webkitAudioContext?: typeof AudioContext;
}

interface Navigator {
  standalone?: boolean;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
