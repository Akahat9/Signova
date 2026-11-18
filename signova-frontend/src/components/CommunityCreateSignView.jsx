import React from 'react';

export default function CommunityCreateSignView({
  activePanel,
  createCommunitySign,
  communitySignPipelineStep,
  communitySignPipeline,
  setActivePanel,
  communitySignPipelineProgress,
  communitySignPipelineUnlocked,
  setCommunitySignPipelineStep,
  communitySignForm,
  setCommunitySignForm,
  advanceCommunitySignPipeline,
  openCommunityCapture,
  handleCommunitySignMedia,
  communityCaptureError,
  communityCaptureOpen,
  communityCaptureMode,
  stopCommunityCapture,
  communityCaptureVideoRef,
  communityCaptureRecording,
  communityCaptureSeconds,
  stopCommunityVideoRecording,
  recordCommunityVideo,
  captureCommunityPhoto,
  communityMediaQuality,
  communityProfile,
  communitySignDraftSaved,
  saveCommunitySignDraft,
}) {
  if (activePanel !== 'communityCreate') {
    return null;
  }

  return (
    <section className="communityCreateSignPage minimalSignCreatorPage" aria-label="Create a Community Sign">
      <form className="minimalSignCreator" onSubmit={(event) => createCommunitySign(event, 'publish')}>
        <header className="minimalSignCreatorHeader">
          <div className="minimalSignCreatorHeaderIdentity">
            <span className="minimalSignCreatorHeaderIcon" aria-hidden="true"><i /><b /></span>
            <span className="minimalSignCreatorHeaderCopy"><em>Community studio</em><strong>Create a sign</strong><small>Build one clear, useful sign for learners.</small></span>
          </div>
          <div className="minimalSignCreatorHeaderMeta">
            <span><b>{communitySignPipelineStep + 1}</b> of {communitySignPipeline.length}</span>
            <small>{communitySignPipeline[communitySignPipelineStep]?.label}</small>
          </div>
          <button type="button" onClick={() => setActivePanel('community')} aria-label="Close create sign">×</button>
        </header>

        <nav className="communitySignPipeline" aria-label="Sign creation progress">
          <span className="communitySignPipelineTrack" aria-hidden="true">
            <i style={{ '--pipeline-progress': `${communitySignPipelineProgress}%` }} />
          </span>
          {communitySignPipeline.map((stage, index) => {
            const state = index === communitySignPipelineStep ? 'active' : index <= communitySignPipelineUnlocked ? 'complete' : 'locked';
            return (
              <button
                type="button"
                key={stage.label}
                className={`communitySignPipelineStage ${state}`}
                disabled={index > communitySignPipelineUnlocked}
                onClick={() => index <= communitySignPipelineUnlocked && setCommunitySignPipelineStep(index)}
                aria-current={state === 'active' ? 'step' : undefined}
              >
                <span>{state === 'complete' ? '✓' : state === 'locked' ? '⌁' : index + 1}</span>
                <strong>{stage.label}</strong>
                <small>{state === 'active' ? 'Live now' : state === 'complete' ? 'Complete' : stage.note}</small>
              </button>
            );
          })}
        </nav>

        <div className="minimalSignCreatorLayout">
          <main className="minimalSignCreatorForm">
            <fieldset className={`minimalSignSection pipelineSignSection ${communitySignPipelineStep === 0 ? 'activePipelineSection' : 'completePipelineSection'}`} disabled={communitySignPipelineStep !== 0}>
              <header><span>01</span><div><strong>Basics</strong><small>Name and classify the sign.</small></div></header>
              <div className="minimalSignFieldGrid">
                <label><span>Title *</span><input required value={communitySignForm.title} onChange={(event) => setCommunitySignForm({ ...communitySignForm, title: event.target.value })} placeholder="Need help" /></label>
                <label><span>Meaning *</span><input required value={communitySignForm.meaning} onChange={(event) => setCommunitySignForm({ ...communitySignForm, meaning: event.target.value })} placeholder="Request assistance" /></label>
                <label><span>Language</span><select value={communitySignForm.language} onChange={(event) => setCommunitySignForm({ ...communitySignForm, language: event.target.value })}><option value="ISL">Indian Sign Language</option><option value="ASL">American Sign Language</option><option value="BSL">British Sign Language</option><option value="Other">Other</option></select></label>
                <label><span>Category</span><select value={communitySignForm.category} onChange={(event) => setCommunitySignForm({ ...communitySignForm, category: event.target.value })}>{['Daily Use', 'Emergency', 'Education', 'Family', 'Medical', 'Emotion', 'Travel', 'General'].map((item) => <option key={item}>{item}</option>)}</select></label>
              </div>
              <div className="minimalSignChoiceRow" aria-label="Sign type">{['letter', 'word', 'sentence'].map((type) => <button type="button" className={communitySignForm.type === type ? 'activeMinimalChoice' : ''} onClick={() => setCommunitySignForm({ ...communitySignForm, type })} key={type}>{type}</button>)}</div>
              <button type="button" className="pipelineContinueButton" onClick={() => advanceCommunitySignPipeline(0)}>Continue to guidance <span>→</span></button>
            </fieldset>

            <fieldset className={`minimalSignSection pipelineSignSection ${communitySignPipelineStep === 1 ? 'activePipelineSection' : communitySignPipelineUnlocked >= 1 ? 'completePipelineSection' : 'lockedPipelineSection'}`} disabled={communitySignPipelineStep !== 1}>
              <header><span>02</span><div><strong>How to sign it</strong><small>Describe the movement learners should copy.</small></div></header>
              <div className="minimalSignFieldGrid">
                <label><span>Hand shape</span><select value={communitySignForm.handShape} onChange={(event) => setCommunitySignForm({ ...communitySignForm, handShape: event.target.value })}><option value="">Select hand shape</option><option>Open Palm</option><option>Fist</option><option>Pointing</option><option>Curved Hand</option><option>Two Hands</option></select></label>
                <label><span>Expression</span><select value={communitySignForm.facialExpression} onChange={(event) => setCommunitySignForm({ ...communitySignForm, facialExpression: event.target.value })}><option value="">Select expression</option><option>Neutral</option><option>Helpful</option><option>Happy</option><option>Concerned</option><option>Questioning</option></select></label>
              </div>
              <div className="minimalSignChoiceRow" aria-label="Motion">{['Static', 'Moving', 'Repetitive'].map((motion) => <button type="button" className={communitySignForm.motion === motion ? 'activeMinimalChoice' : ''} onClick={() => setCommunitySignForm({ ...communitySignForm, motion })} key={motion}>{motion}</button>)}</div>
              <label className="minimalSignWideField"><span>Instructions *</span><textarea required maxLength="1000" value={communitySignForm.steps} onChange={(event) => setCommunitySignForm({ ...communitySignForm, steps: event.target.value })} placeholder="Describe hand position, direction, movement, and expression…" /><small>{communitySignForm.steps.length}/1000</small></label>
              <label className="minimalSignWideField"><span>Usage note</span><textarea maxLength="500" value={communitySignForm.usageNotes} onChange={(event) => setCommunitySignForm({ ...communitySignForm, usageNotes: event.target.value })} placeholder="When should someone use this sign?" /></label>
              <button type="button" className="pipelineContinueButton" onClick={() => advanceCommunitySignPipeline(1)}>Continue to demo <span>→</span></button>
            </fieldset>

            <fieldset className={`minimalSignSection pipelineSignSection ${communitySignPipelineStep === 2 ? 'activePipelineSection' : communitySignPipelineUnlocked >= 2 ? 'completePipelineSection' : 'lockedPipelineSection'}`} disabled={communitySignPipelineStep !== 2}>
              <header><span>03</span><div><strong>Demonstration</strong><small>Add media only if it makes the sign clearer.</small></div></header>
              <div className="minimalMediaActions">
                <button type="button" onClick={() => openCommunityCapture('video')}>◉ Record video</button>
                <button type="button" onClick={() => openCommunityCapture('photo')}>▣ Take photo</button>
                <label><input type="file" accept="video/mp4,video/webm" onChange={(event) => handleCommunitySignMedia(event, 'video')} /><span>＋ Upload video</span></label>
                <label><input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => handleCommunitySignMedia(event, 'images')} /><span>＋ Upload images</span></label>
                <small>Video limit: 15 seconds · Up to four images.</small>
              </div>
              {communityCaptureError && <p className="communityCaptureError" role="alert">{communityCaptureError}</p>}
              {communityCaptureOpen && (
                <div className="communitySignCapture">
                  <header>
                    <span><strong>{communityCaptureMode === 'video' ? 'Record demonstration' : 'Capture training frame'}</strong><small>Keep face, upper body, and both hands visible.</small></span>
                    <button type="button" onClick={stopCommunityCapture} aria-label="Close camera">×</button>
                  </header>
                  <div className="communitySignCaptureView">
                    <video ref={communityCaptureVideoRef} muted autoPlay playsInline onClick={(event) => event.currentTarget.play().catch(() => {})} />
                    <span className="communityCaptureGuide" aria-hidden="true" />
                    {communityCaptureRecording && <b className="communityCaptureTimer">REC 00:{String(communityCaptureSeconds).padStart(2, '0')} / 00:15</b>}
                  </div>
                  <footer>
                    <small>Even light · plain background · hands inside guide</small>
                    {communityCaptureMode === 'video'
                      ? <button type="button" className={communityCaptureRecording ? 'stopCaptureButton' : ''} onClick={communityCaptureRecording ? stopCommunityVideoRecording : recordCommunityVideo}>{communityCaptureRecording ? 'Stop recording' : 'Start 15s recording'}</button>
                      : <button type="button" onClick={captureCommunityPhoto}>Capture photo</button>}
                  </footer>
                </div>
              )}
              <div className={`communityMediaQuality ${communityMediaQuality.status}`}>
                <span aria-hidden="true">{communityMediaQuality.status === 'ready' ? '✓' : communityMediaQuality.status === 'review' ? '!' : 'i'}</span>
                <div>
                  <strong>{communityMediaQuality.title}</strong>
                  {communityMediaQuality.checks.length > 0
                    ? <ul>{communityMediaQuality.checks.map((check) => <li className={check.pass ? 'pass' : 'fail'} key={check.label}>{check.pass ? '✓' : '×'} {check.label}</li>)}</ul>
                    : <small>Capture or upload media to check resolution, duration, lighting, and contrast.</small>}
                  <small>Technical quality only. Sign correctness still requires model or human review. AI training use remains off unless you explicitly consent.</small>
                </div>
              </div>
              {communitySignForm.imageUrls.length > 0 && <div className="minimalMediaStrip">{communitySignForm.imageUrls.map((url, index) => <button type="button" className={communitySignForm.selectedThumbnail === index ? 'activeMinimalMedia' : ''} onClick={() => setCommunitySignForm({ ...communitySignForm, selectedThumbnail: index })} key={url}><img src={url} alt="" /></button>)}</div>}
              <button type="button" className="pipelineContinueButton" onClick={() => advanceCommunitySignPipeline(2)}>Review publishing <span>→</span></button>
            </fieldset>

            <fieldset className={`minimalSignSection minimalPublishSection pipelineSignSection ${communitySignPipelineStep === 3 ? 'activePipelineSection' : communitySignPipelineUnlocked >= 3 ? 'completePipelineSection' : 'lockedPipelineSection'}`} disabled={communitySignPipelineStep !== 3}>
              <header><span>04</span><div><strong>Publishing</strong><small>Choose visibility and confirm your rights.</small></div></header>
              <div className="minimalSignChoiceRow" aria-label="Visibility">{['Public', 'Community', 'Private'].map((visibility) => <button type="button" className={communitySignForm.visibility === visibility ? 'activeMinimalChoice' : ''} onClick={() => setCommunitySignForm({ ...communitySignForm, visibility })} key={visibility}>{visibility}</button>)}</div>
              <label className="minimalConsentRow"><input type="checkbox" checked={communitySignForm.showCreatorName} onChange={(event) => setCommunitySignForm({ ...communitySignForm, showCreatorName: event.target.checked })} /><span><strong>Show creator credit</strong><small>Display {communityProfile.username} with this sign.</small></span></label>
              <label className="minimalConsentRow"><input type="checkbox" checked={communitySignForm.allowAiTraining} onChange={(event) => setCommunitySignForm({ ...communitySignForm, allowAiTraining: event.target.checked })} /><span><strong>Allow AI training use</strong><small>Optional consent; your profile identity is excluded.</small></span></label>
              <label className="minimalConsentRow"><input type="checkbox" checked={communitySignForm.rulesAccepted} onChange={(event) => setCommunitySignForm({ ...communitySignForm, rulesAccepted: event.target.checked })} /><span><strong>Follow community guidelines *</strong></span></label>
              <label className="minimalConsentRow"><input type="checkbox" checked={communitySignForm.rightsConfirmed} onChange={(event) => setCommunitySignForm({ ...communitySignForm, rightsConfirmed: event.target.checked })} /><span><strong>I have permission to share this content *</strong></span></label>
            </fieldset>
          </main>

          <aside className="minimalSignPreview">
            <div className={communitySignForm.videoUrl ? 'minimalSignPreviewMedia' : 'minimalSignPreviewMedia emptyMinimalSignPreview'}>
              {communitySignForm.videoUrl ? <video src={communitySignForm.videoUrl} controls /> : <><span>＋</span><strong>No demonstration yet</strong></>}
            </div>
            <div className="minimalSignPreviewCopy"><span>{communitySignForm.language} · {communitySignForm.type}</span><strong>{communitySignForm.title || 'Untitled sign'}</strong><p>{communitySignForm.meaning || 'Add a short meaning.'}</p></div>
            <dl><div><dt>Category</dt><dd>{communitySignForm.category}</dd></div><div><dt>Visibility</dt><dd>{communitySignForm.visibility}</dd></div></dl>
          </aside>
        </div>

        <footer className="minimalSignCreatorActions">
          <span>{communitySignDraftSaved ? 'Draft saved on this device' : 'Not published'}</span>
          <button type="button" onClick={saveCommunitySignDraft}>Save draft</button>
          <button type="button" onClick={(event) => createCommunitySign(event, 'library')}>Add to library</button>
          <button type="submit" disabled={!communitySignForm.rulesAccepted || !communitySignForm.rightsConfirmed}>Publish sign</button>
        </footer>
      </form>
    </section>
  );
}

