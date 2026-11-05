import { useCallback, useEffect, useRef, useState } from 'react';

const Recognition = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);

// Plain-language explanations for SpeechRecognition error codes.
const ERRORS = {
  'not-allowed': 'Microphone access is blocked. Click the lock icon in the address bar, allow the microphone, then reload the page.',
  'service-not-allowed': 'This browser does not allow speech recognition here. Use Chrome or Edge, and open the app at http://localhost or an https address.',
  'audio-capture': 'No microphone was found. Plug one in or check your system sound settings.',
  network: "Speech recognition needs the internet (Chrome sends audio to Google to recognise it). Check your connection. Brave blocks this, so use Chrome or Edge.",
  'no-speech': "I didn't hear anything. Click the mic and start speaking.",
  'language-not-supported': 'Your browser language is not supported for speech. Try setting it to English.',
};

export function voiceProblem() {
  if (!Recognition) return 'Voice input needs Chrome or Edge. Firefox does not support it, and Brave blocks it.';
  if (!window.isSecureContext) return `Voice input only works on http://localhost or an https address, not ${location.host}.`;
  return null;
}

/** Browser speech-to-text + text-to-speech (Web Speech API). */
export function useVoice({ onResult, onError } = {}) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [speaking, setSpeaking] = useState(false);
  const recRef = useRef(null);
  const cbRef = useRef({ onResult, onError });
  cbRef.current = { onResult, onError };

  useEffect(() => () => recRef.current?.abort(), []);

  const listen = useCallback(() => {
    const problem = voiceProblem();
    if (problem) {
      cbRef.current.onError?.(problem);
      return false;
    }
    const rec = new Recognition();
    rec.lang = navigator.language || 'en-US';
    rec.interimResults = true;
    rec.onresult = (e) => {
      const text = Array.from(e.results).map((r) => r[0].transcript).join('');
      setInterim(text);
      if (e.results[e.results.length - 1].isFinal) {
        cbRef.current.onResult?.(text);
        setInterim('');
      }
    };
    rec.onend = () => setListening(false);
    rec.onerror = (e) => {
      setListening(false);
      if (e.error !== 'aborted') cbRef.current.onError?.(ERRORS[e.error] || `Voice input failed (${e.error}).`);
    };
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
      return true;
    } catch (err) {
      cbRef.current.onError?.(`Couldn't start the microphone: ${err.message}`);
      return false;
    }
  }, []);

  const stop = useCallback(() => recRef.current?.stop(), []);

  const speak = useCallback((text) => {
    if (!('speechSynthesis' in window)) return;
    const clean = text.replace(/[*_`#>]|\[(.*?)\]\(.*?\)/g, '$1').replace(/\p{Extended_Pictographic}/gu, '');
    const u = new SpeechSynthesisUtterance(clean);
    u.onstart = () => setSpeaking(true);
    u.onend = () => setSpeaking(false);
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  }, []);

  return { supported: Boolean(Recognition), listening, interim, speaking, listen, stop, speak };
}
