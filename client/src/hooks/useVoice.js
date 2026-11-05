import { useCallback, useEffect, useRef, useState } from 'react';

const Recognition = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);

/** Browser speech-to-text + text-to-speech (Web Speech API). */
export function useVoice({ onResult } = {}) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [speaking, setSpeaking] = useState(false);
  const recRef = useRef(null);
  const cbRef = useRef(onResult);
  cbRef.current = onResult;

  useEffect(() => () => recRef.current?.abort(), []);

  const listen = useCallback(() => {
    if (!Recognition) return false;
    const rec = new Recognition();
    rec.lang = navigator.language || 'en-US';
    rec.interimResults = true;
    rec.onresult = (e) => {
      const text = Array.from(e.results).map((r) => r[0].transcript).join('');
      setInterim(text);
      if (e.results[e.results.length - 1].isFinal) {
        cbRef.current?.(text);
        setInterim('');
      }
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
    return true;
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
