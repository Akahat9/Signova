import { useEffect, useMemo, useState } from 'react';
import Signova3DAvatar from './Signova3DAvatar';
import { resolveSignQueue, SIGN_LANGUAGES, SIGN_TYPES } from './signLearningData';

const SPEEDS = [
  { label: 'Slow', value: 0.55 },
  { label: 'Normal', value: 1 },
  { label: 'Fast', value: 1.35 },
];

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
  const [language, setLanguage] = useState('ISL');
  const [signType, setSignType] = useState('Sentence');
  const [coach, setCoach] = useState('female');
  const [mode, setMode] = useState('text');
  const [prompt, setPrompt] = useState('Are you okay?');
  const [queue, setQueue] = useState(() => resolveSignQueue('Are you okay?'));
  const [queueIndex, setQueueIndex] = useState(0);
  const [poseIndex, setPoseIndex] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [targetFps, setTargetFps] = useState('adaptive');
  const [paused, setPaused] = useState(false);
  const [view, setView] = useState('front');
  const [guideStep, setGuideStep] = useState(0);
  const [practiceMode, setPracticeMode] = useState('practice');
  const [quizAnswer, setQuizAnswer] = useState('');
  const activeSign = queue[queueIndex] || queue[0];
  const poses = activeSign?.poses || [];
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

  const guide = useMemo(() => [
    ['Handshape', activeSign?.handshape || 'Keep fingers relaxed and visible.'],
    ['Movement', activeSign?.movement || 'Follow the highlighted movement path.'],
    ['Expression', activeSign?.expression || 'Match the face and body expression.'],
  ], [activeSign]);

  function presentText() {
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

  return (
    <section className="snvLearnPage min-h-0 h-full bg-signova-mist text-signova-ink" aria-label="Signova Learn">
      <header className="snvLearnHeader">
        <div>
          <span>Signova Learn</span>
          <strong>Learn signs with a live 3D coach</strong>
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
            <select value={coach} onChange={(event) => setCoach(event.target.value)} aria-label="Choose 3D coach">
              <option value="female">Female coach</option>
              <option value="male">Male coach</option>
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
              <div><span>3D coach</span><strong>{activeSign?.label}</strong></div>
              <div className="snvViewSwitch" aria-label="Avatar view">
                <button type="button" className={view === 'front' ? 'active' : ''} onClick={() => setView('front')}>Front</button>
                <button type="button" className={view === 'side' ? 'active' : ''} onClick={() => setView('side')}>Side</button>
              </div>
            </div>
            <div className="snvAvatarStage">
              <Signova3DAvatar
                animation={activeSign}
                poseIndex={poseIndex}
                paused={paused}
                speed={speed}
                view={view}
                targetFps={targetFps}
                coach={coach}
                label={`${language} avatar demonstrating ${activeSign?.label}`}
              />
              <div className="snvAvatarCaption">
                <span>{language} · {activeSign?.type}</span>
                <strong>{activeSign?.label}</strong>
                <small>{activeSign?.meaning}</small>
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
            <div className="snvModeTabs" role="tablist">
              <button type="button" className={mode === 'text' ? 'active' : ''} onClick={() => setMode('text')}>Text to Sign</button>
              <button type="button" className={mode === 'camera' ? 'active' : ''} onClick={() => setMode('camera')}>Sign to Text + Voice</button>
            </div>

            {mode === 'text' ? (
              <>
                <div className="snvPrompt">
                  <label htmlFor="snvLearnPrompt">Type a word or sentence</label>
                  <div>
                    <input id="snvLearnPrompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') presentText(); }} />
                    <button type="button" onClick={presentText}>Show sign</button>
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
                    <button type="button" disabled={!liveSign?.phrase} onClick={() => onSpeak(liveSign?.phrase)}>Speak aloud</button>
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
