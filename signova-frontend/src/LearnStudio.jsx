import { useEffect, useMemo, useRef, useState } from 'react';
import Signova3DAvatar from './Signova3DAvatar';
import Signova2DAvatar from './Signova2DAvatar';
import { resolveSignQueue, SIGN_LANGUAGES, SIGN_TYPES } from './signLearningData';

const SPEEDS = [
  { label: 'Slow', value: 0.55 },
  { label: 'Normal', value: 1 },
  { label: 'Fast', value: 1.35 },
];
const LEARN_SETTINGS_STORAGE_KEY = 'signova-learn-settings-v1';
const EMPTY_LESSON = {
  id: 'ready',
  label: 'Choose a sign',
  type: 'Practice',
  meaning: 'Type a word or sentence to begin.',
  handshape: 'Hands relaxed',
  movement: 'Your movement path will appear here.',
  expression: 'Natural eye contact',
  poses: [{ left: [-0.2, 0, -0.2], right: [0.2, 0, 0.2] }],
};

function loadLearnSettings() {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(window.localStorage.getItem(LEARN_SETTINGS_STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

export default function LearnStudio({
  cameraEnabled,
  liveSign,
  learningFeedback,
  onOpenLibrary,
  onOpenProgress,
  onStartCamera,
  onStopCamera,
  onSpeak,
  videoRef,
  canvasRef,
}) {
  const savedSettings = useMemo(loadLearnSettings, []);
  const [language, setLanguage] = useState(() => savedSettings.language || 'ISL');
  const [signType, setSignType] = useState(() => savedSettings.signType || 'Sentence');
  const [coach, setCoach] = useState(() => savedSettings.coach || 'female');
  const [avatarStyle, setAvatarStyle] = useState(() => savedSettings.avatarStyle || '2d');
  const [mode, setMode] = useState(() => savedSettings.mode || 'text');
  const initialPrompt = savedSettings.prompt === 'Are you okay?' ? '' : (savedSettings.prompt || '');
  const [prompt, setPrompt] = useState(initialPrompt);
  const [queue, setQueue] = useState(() => initialPrompt ? resolveSignQueue(initialPrompt) : [EMPTY_LESSON]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [poseIndex, setPoseIndex] = useState(0);
  const [speed, setSpeed] = useState(() => Number(savedSettings.speed) || 1);
  const [targetFps, setTargetFps] = useState(() => savedSettings.targetFps || 'adaptive');
  const [paused, setPaused] = useState(false);
  const [view] = useState(() => savedSettings.view || 'front');
  const [avatarTouch, setAvatarTouch] = useState({ x: 0, y: 0 });
  const avatarTouchRef = useRef(null);
  const [guideStep, setGuideStep] = useState(0);
  const [practiceMode, setPracticeMode] = useState(() => savedSettings.practiceMode || 'practice');
  const [quizAnswer, setQuizAnswer] = useState('');
  const [autoVoice, setAutoVoice] = useState(() => savedSettings.autoVoice !== false);
  const spokenDetectionRef = useRef('');
  const autoVoiceTimerRef = useRef(null);
  const onSpeakRef = useRef(onSpeak);
  onSpeakRef.current = onSpeak;
  const activeSign = queue[queueIndex] || queue[0];
  const detectedAnimation = useMemo(
    () => (liveSign?.phrase ? resolveSignQueue(liveSign.phrase)[0] : null),
    [liveSign?.phrase],
  );
  const presentedSign = mode === 'camera' && liveSign?.phrase
    ? { ...(detectedAnimation || activeSign), label: liveSign.phrase, meaning: learningFeedback }
    : activeSign;
  const poses = presentedSign?.poses || [];
  const progress = poses.length ? ((poseIndex + 1) / poses.length) * 100 : 0;

  useEffect(() => {
    if (paused || poses.length < 2) return undefined;
    const timer = window.setInterval(() => {
      setPoseIndex((current) => {
        if (current < poses.length - 1) return current + 1;
        setQueueIndex((item) => (item + 1) % queue.length);
        return 0;
      });
    }, Math.round(1150 / speed));
    return () => window.clearInterval(timer);
  }, [paused, poses.length, queue.length, speed]);

  useEffect(() => {
    setPoseIndex(0);
  }, [queueIndex]);

  useEffect(() => {
    try {
      window.localStorage.setItem(LEARN_SETTINGS_STORAGE_KEY, JSON.stringify({
        language,
        signType,
        coach,
        avatarStyle,
        mode,
        prompt,
        speed,
        targetFps,
        view,
        practiceMode,
        autoVoice,
      }));
    } catch {
      // Learning remains usable when browser storage is unavailable.
    }
  }, [autoVoice, avatarStyle, coach, language, mode, practiceMode, prompt, signType, speed, targetFps, view]);

  useEffect(() => {
    window.clearTimeout(autoVoiceTimerRef.current);
    if (mode !== 'camera' || !cameraEnabled || !autoVoice) {
      spokenDetectionRef.current = '';
      return undefined;
    }
    if (!liveSign?.phrase) {
      spokenDetectionRef.current = '';
      return undefined;
    }
    const detectionKey = String(liveSign.label || liveSign.phrase).toLowerCase();
    if (spokenDetectionRef.current === detectionKey) return undefined;
    autoVoiceTimerRef.current = window.setTimeout(() => {
      spokenDetectionRef.current = detectionKey;
      onSpeakRef.current?.(liveSign.phrase, language);
    }, 180);
    return () => window.clearTimeout(autoVoiceTimerRef.current);
  }, [autoVoice, cameraEnabled, language, liveSign?.label, liveSign?.phrase, mode]);

  const guide = useMemo(() => [
    ['Handshape', activeSign?.handshape || 'Keep fingers relaxed and visible.'],
    ['Movement', activeSign?.movement || 'Follow the highlighted movement path.'],
    ['Expression', activeSign?.expression || 'Match the face and body expression.'],
  ], [activeSign]);

  function presentText() {
    if (!prompt.trim()) return;
    const nextQueue = resolveSignQueue(prompt);
    setQueue(nextQueue);
    setQueueIndex(0);
    setPoseIndex(0);
    setPaused(false);
    setSignType(nextQueue.length > 1 ? 'Sentence' : nextQueue[0]?.type || 'Word');
  }

  function replay() {
    setQueueIndex(0);
    setPoseIndex(0);
    setPaused(false);
  }

  function activateCameraMode() {
    setMode('camera');
    spokenDetectionRef.current = '';
    onSpeakRef.current?.('Live sign voice ready', language);
  }

  function startAvatarTouch(event) {
    avatarTouchRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, origin: avatarTouch };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function moveAvatarTouch(event) {
    const drag = avatarTouchRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setAvatarTouch({
      x: Math.max(-1, Math.min(1, drag.origin.x + ((event.clientX - drag.x) / 180))),
      y: Math.max(-0.35, Math.min(0.35, drag.origin.y + ((event.clientY - drag.y) / 260))),
    });
  }

  function stopAvatarTouch(event) {
    if (avatarTouchRef.current?.pointerId === event.pointerId) avatarTouchRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  }

  return (
    <section className="snvLearnPage min-h-0 h-full bg-signova-mist text-signova-ink" aria-label="Signova Learn">
      <header className="snvLearnHeader">
        <div>
          <span>Signova Learn</span>
          <strong>Learn signs with a clear animated coach</strong>
        </div>
        <div className="snvLearnSelectors">
          <label>
            <span>Language</span>
            <select value={language} onChange={(event) => setLanguage(event.target.value)}>
              {SIGN_LANGUAGES.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label>
            <span>Sign type</span>
            <select value={signType} onChange={(event) => setSignType(event.target.value)}>
              {SIGN_TYPES.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label>
            <span>Render</span>
            <select value={targetFps} onChange={(event) => setTargetFps(event.target.value)} aria-label="Avatar frame rate">
              <option value="adaptive">Adaptive FPS</option>
              <option value="60">60 FPS</option>
              <option value="90">90 FPS</option>
              <option value="120">120 FPS</option>
            </select>
          </label>
          <label>
            <span>Coach</span>
            <select value={coach} onChange={(event) => {
              setCoach(event.target.value);
              if (event.target.value === 'asl-starter') setLanguage('ASL');
            }} aria-label="Choose signing coach">
              <option value="female">Female coach</option>
              <option value="male">Male coach</option>
              <option value="asl-starter">ASL starter coach · 4 demos</option>
            </select>
          </label>
          <label>
            <span>Avatar</span>
            <select value={avatarStyle} onChange={(event) => setAvatarStyle(event.target.value)} aria-label="Choose avatar style">
              <option value="2d">Clear 2D</option>
              <option value="3d">Rotatable 3D</option>
            </select>
          </label>
          <button type="button" onClick={onOpenLibrary} aria-label="Open library">Library</button>
          <button type="button" onClick={onOpenProgress} aria-label="Open progress">Progress</button>
        </div>
      </header>

      <main className="snvLearnScroll">
        <section className="snvCoachGrid">
          <article className="snvAvatarCard">
            <div className="snvCardHeader">
              <div><span>{coach === 'asl-starter' ? 'ASL starter coach · preview' : avatarStyle === '2d' ? '2D clarity coach' : '3D coach'}</span><strong>{presentedSign?.label}</strong></div>
              <small className="snvTouchCoachHint">Drag coach · double-tap to reset</small>
            </div>
            <div
              className="snvAvatarStage snvTouchAvatarStage"
              onPointerDown={startAvatarTouch}
              onPointerMove={moveAvatarTouch}
              onPointerUp={stopAvatarTouch}
              onPointerCancel={stopAvatarTouch}
              onDoubleClick={() => setAvatarTouch({ x: 0, y: 0 })}
            >
              {avatarStyle === '2d' ? (
                <Signova2DAvatar
                  animation={presentedSign}
                  poseIndex={poseIndex}
                  paused={paused}
                  speed={speed}
                  view={view}
                  coach={coach}
                  interaction={avatarTouch}
                  label={`${language} 2D avatar demonstrating ${presentedSign?.label}`}
                />
              ) : (
                <Signova3DAvatar
                  animation={presentedSign}
                  poseIndex={poseIndex}
                  paused={paused}
                  speed={speed}
                  view={avatarTouch.x < -0.45 || avatarTouch.x > 0.45 ? 'side' : view}
                  targetFps={targetFps}
                  coach={coach}
                  label={`${language} 3D avatar demonstrating ${presentedSign?.label}`}
                />
              )}
              <div className="snvAvatarCaption">
                <span>{language} · {mode === 'camera' ? 'Live detection' : presentedSign?.type}</span>
                <strong>{presentedSign?.label || 'Waiting for a sign'}</strong>
                <small>{mode === 'camera' ? learningFeedback : presentedSign?.meaning}</small>
              </div>
            </div>
            <div className="snvPlayback">
              <button type="button" onClick={replay} aria-label="Replay">↻</button>
              <button type="button" onClick={() => setPaused((value) => !value)} aria-label={paused ? 'Play' : 'Pause'}>{paused ? '▶' : 'Ⅱ'}</button>
              <div><i style={{ width: `${progress}%` }} /></div>
              <span>{poseIndex + 1}/{Math.max(1, poses.length)}</span>
              <select value={speed} onChange={(event) => setSpeed(Number(event.target.value))} aria-label="Playback speed">
                {SPEEDS.map((item) => <option value={item.value} key={item.label}>{item.label}</option>)}
              </select>
            </div>
          </article>

          <section className="snvInteractionCard">
            <div className="snvMiniPipeline" aria-label="Learning pipeline">
              <span className={mode === 'text' ? 'active' : ''}><b>1</b><small>Input</small></span>
              <i />
              <span className={presentedSign?.id !== 'ready' ? 'active' : ''}><b>2</b><small>Watch</small></span>
              <i />
              <span className={mode === 'camera' ? 'active' : ''}><b>3</b><small>Practise</small></span>
            </div>
            <div className="snvModeTabs" role="tablist">
              <button type="button" className={mode === 'text' ? 'active' : ''} onClick={() => setMode('text')}>Text to Sign</button>
              <button type="button" className={mode === 'camera' ? 'active' : ''} onClick={activateCameraMode}>Sign to Text + Voice</button>
            </div>

            {mode === 'text' ? (
              <>
                <div className="snvPrompt">
                  <label htmlFor="snvLearnPrompt">Type a word or sentence</label>
                  <div>
                    <input id="snvLearnPrompt" value={prompt} placeholder="Try “hello”, “help”, or a sentence…" onChange={(event) => setPrompt(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') presentText(); }} />
                    <button type="button" disabled={!prompt.trim()} onClick={presentText}>Show sign</button>
                  </div>
                  <small>{queue.length} queued animation{queue.length === 1 ? '' : 's'} · data-driven sign registry</small>
                </div>
                <div className="snvMeaning">
                  <span>Meaning</span>
                  <strong>{activeSign?.meaning}</strong>
                  <p>Watch the whole movement first, then practise each cue separately.</p>
                </div>
              </>
            ) : (
              <div className="snvCameraWorkspace">
                <div className="snvCameraPreview">
                  {cameraEnabled ? (
                    <>
                      <video autoPlay playsInline muted ref={videoRef} />
                      <canvas ref={canvasRef} aria-label="Sign tracking overlay" />
                    </>
                  ) : (
                    <button type="button" onClick={onStartCamera}><span>Camera off</span><small>Start private on-device sign practice</small></button>
                  )}
                </div>
                <div className="snvDetectionResult">
                  <span>Detected sign</span>
                  <strong>{liveSign?.phrase || 'Waiting for a sign'}</strong>
                  <div><i style={{ width: `${Math.round(Number(liveSign?.confidence || 0) * 100)}%` }} /></div>
                  <small>{Math.round(Number(liveSign?.confidence || 0) * 100)}% confidence · {learningFeedback}</small>
                  <div>
                    <button type="button" disabled={!liveSign?.phrase} onClick={() => onSpeak(liveSign?.phrase, language)}>Speak aloud</button>
                    <button type="button" className={autoVoice ? 'active' : ''} onClick={() => setAutoVoice((enabled) => !enabled)} aria-pressed={autoVoice}>
                      Auto voice {autoVoice ? 'on' : 'off'}
                    </button>
                    {cameraEnabled && <button type="button" onClick={onStopCamera}>Stop camera</button>}
                  </div>
                </div>
              </div>
            )}

            <div className="snvMovementGuide">
              {guide.map(([title, detail], index) => (
                <button type="button" className={guideStep === index ? 'active' : ''} onClick={() => { setGuideStep(index); setPoseIndex(Math.min(index, poses.length - 1)); setPaused(true); }} key={title}>
                  <b>{index + 1}</b><span><strong>{title}</strong><small>{detail}</small></span>
                </button>
              ))}
            </div>
          </section>
        </section>

        <section className="snvPracticeGrid">
          <article>
            <div className="snvSectionTitle"><span>Practice</span><strong>Choose how you want to learn</strong></div>
            <div className="snvPracticeModes">
              {[
                ['practice', 'Mirror practice', 'Copy the avatar movement'],
                ['slow', 'Slow motion', 'Study every transition'],
                ['quiz', 'Quiz mode', 'Test meaning and recall'],
              ].map(([id, title, detail]) => (
                <button type="button" className={practiceMode === id ? 'active' : ''} onClick={() => { setPracticeMode(id); if (id === 'slow') setSpeed(0.55); }} key={id}>
                  <strong>{title}</strong><small>{detail}</small>
                </button>
              ))}
            </div>
          </article>
          <article className="snvQuizCard">
            <div className="snvSectionTitle"><span>Quick check</span><strong>What does this sign mean?</strong></div>
            {['Ask for help', activeSign?.meaning, 'Say goodbye'].map((answer) => (
              <button type="button" className={quizAnswer === answer ? 'selected' : ''} onClick={() => setQuizAnswer(answer)} key={answer}>{answer}</button>
            ))}
            <small>{quizAnswer ? (quizAnswer === activeSign?.meaning ? 'Correct — progress saved locally.' : 'Try again and watch the movement cue.') : 'Choose one answer.'}</small>
          </article>
          <article className="snvProgressCard">
            <div className="snvSectionTitle"><span>Today</span><strong>Learning progress</strong></div>
            <div><strong>3</strong><small>Signs practised</small></div>
            <div><strong>82%</strong><small>Average accuracy</small></div>
            <div><strong>7</strong><small>Day streak</small></div>
            <button type="button" onClick={onOpenProgress}>View full progress</button>
          </article>
        </section>
      </main>
    </section>
  );
}
