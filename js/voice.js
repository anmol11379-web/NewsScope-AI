/* ═══════════════════════════════════════════════════════
   NewsScope 2.0 — Voice Module
   Web Speech API voice input
   ═══════════════════════════════════════════════════════ */

let recognition = null;
let isRecording = false;
let onTranscript = null;

export function initVoice(callback) {
  onTranscript = callback;

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    // Hide voice button if not supported
    const voiceBtn = document.getElementById('voice-btn');
    if (voiceBtn) voiceBtn.style.display = 'none';
    return;
  }

  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  recognition.onresult = (event) => {
    let transcript = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      transcript += event.results[i][0].transcript;
    }
    if (onTranscript) onTranscript(transcript, event.results[event.results.length - 1].isFinal);
  };

  recognition.onerror = (event) => {
    console.warn('Speech recognition error:', event.error);
    stopRecording();
  };

  recognition.onend = () => {
    stopRecording();
  };

  // Bind button
  const voiceBtn = document.getElementById('voice-btn');
  if (voiceBtn) {
    voiceBtn.addEventListener('click', toggleRecording);
  }
}

export function toggleRecording() {
  if (isRecording) {
    stopRecording();
  } else {
    startRecording();
  }
}

function startRecording() {
  if (!recognition) return;
  try {
    recognition.start();
    isRecording = true;
    updateUI(true);
  } catch (err) {
    console.warn('Could not start recording:', err);
  }
}

function stopRecording() {
  if (!recognition) return;
  try {
    recognition.stop();
  } catch {}
  isRecording = false;
  updateUI(false);
}

function updateUI(recording) {
  const voiceBtn = document.getElementById('voice-btn');
  if (!voiceBtn) return;

  if (recording) {
    voiceBtn.classList.add('recording');
    voiceBtn.setAttribute('data-tooltip', 'Stop recording');
  } else {
    voiceBtn.classList.remove('recording');
    voiceBtn.setAttribute('data-tooltip', 'Voice input');
  }
}

export function isVoiceRecording() {
  return isRecording;
}
