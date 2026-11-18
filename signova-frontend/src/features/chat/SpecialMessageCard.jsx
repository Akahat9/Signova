import { useEffect, useRef, useState } from 'react';

export default function SpecialMessageCard({
  message,
  isOutgoing,
  onEditContact,
  onAddContact,
  onVotePoll,
  onEditMeet,
  onSaveMeetDetail,
  audioSpeed = 1,
  onAudioSpeedChange,
  onCancelAttachmentUpload,
  IconComponent,
}) {
  const audioRef = useRef(null);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const data = message.attachmentData || {};
  const type = message.attachmentType;
  const Icon = IconComponent || (({ type: iconType }) => <span aria-hidden="true">{iconType}</span>);
  const audioProgress = audioDuration ? Math.min(100, Math.max(0, audioCurrentTime / audioDuration * 100)) : 0;
  const uploadActive = data.uploadStage === 'uploading' || data.uploadStage === 'publishing';
  const uploadProgress = Math.max(0, Math.min(100, Number(data.uploadProgress || 0)));
  const uploadStatus = uploadActive ? `${data.uploadStage === 'publishing' ? 'Publishing' : 'Uploading'} ${uploadProgress}%` : '';
  const uploadPanel = uploadActive ? (
    <div className="attachmentUploadProgress" role="status" aria-label="Attachment upload progress">
      <progress max="100" value={uploadProgress} />
      <span>{uploadStatus}</span>
      {data.uploadStage === 'uploading' ? <button type="button" onClick={onCancelAttachmentUpload}>Cancel</button> : null}
    </div>
  ) : null;
  const audioClock = (seconds = 0) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = Number(audioSpeed) || 1;
  }, [audioSpeed]);

  async function toggleAudioPlayback() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      try {
        await audio.play();
        setAudioPlaying(true);
      } catch {
        setAudioPlaying(false);
      }
      return;
    }
    audio.pause();
    setAudioPlaying(false);
  }

  if (!type) return null;
  if (type === 'document') {
    const sourceLabel = data.durable ? 'Firebase attachment' : (data.previewExpired ? 'local preview expired' : 'local preview');
    return (
      <div className="specialMessageCard specialDocumentCard">
        <Icon type="document" />
        <div><span>Vault Document</span><strong>{data.title || 'Document'}</strong><small>{data.fileType || 'File'} · {data.size || 'Ready'} · {sourceLabel}</small></div>
        {uploadPanel}
        <div className="specialCardActions">
          {data.url ? <a href={data.url} target="_blank" rel="noopener noreferrer">Preview</a> : <button type="button" disabled>Preview unavailable</button>}
          {data.url ? <a href={data.url} download={data.title}>Download</a> : <button type="button" disabled>Download unavailable</button>}
        </div>
      </div>
    );
  }
  if (type === 'image') {
    const sourceLabel = data.durable ? 'Firebase image' : (data.previewExpired ? 'local preview expired' : 'local image preview');
    return (
      <div className="specialMessageCard specialImageCard">
        {data.url ? <img src={data.url} alt={data.title || 'Shared visual'} /> : <Icon type="gallery" />}
        <div><span>{data.mode || 'Image'}</span><strong>{data.title || 'Shared image'}</strong><small>{data.quality || 'Simple'} · {sourceLabel}</small></div>
        {uploadPanel}
        <div className="specialCardActions">
          {data.url ? <a href={data.url} target="_blank" rel="noopener noreferrer">Preview</a> : <button type="button" disabled>Preview unavailable</button>}
          {data.url ? <a href={data.url} download={data.title}>Download</a> : null}
        </div>
      </div>
    );
  }
  if (type === 'audio') {
    return (
      <div className="specialMessageCard specialAudioCard">
        <Icon type="audio" />
        <div>
          <span>Music / Audio Note</span><strong>{data.title || 'Audio note'}</strong>
          {data.url ? (
            <div className="audioListenPanel">
              <button type="button" className="audioPlayButton" onClick={toggleAudioPlayback} aria-label={audioPlaying ? 'Pause voice note' : 'Play voice note'}>{audioPlaying ? 'Ⅱ' : '▶'}</button>
              <div className="audioWavePanel"><span style={{ '--audio-progress': `${audioProgress}%` }} /><small>{audioClock(audioCurrentTime)} / {audioClock(audioDuration || Number(data.durationSeconds || 0))}</small></div>
              <audio ref={audioRef} src={data.url} preload="metadata" onLoadedMetadata={(event) => setAudioDuration(event.currentTarget.duration || 0)} onTimeUpdate={(event) => setAudioCurrentTime(event.currentTarget.currentTime || 0)} onPlay={() => setAudioPlaying(true)} onPause={() => setAudioPlaying(false)} onEnded={() => { setAudioPlaying(false); setAudioCurrentTime(0); }} />
            </div>
          ) : <small className="audioMissingNotice">Audio unavailable - record or upload again</small>}
          <div className="audioSignTranslationPanel" style={{ marginTop: '6px', padding: '6px 8px', background: 'rgba(2, 132, 199, 0.08)', borderRadius: '8px', border: '1px solid rgba(2, 132, 199, 0.2)' }}>
            <span style={{ fontSize: '9px', fontWeight: '800', color: '#0284c7', display: 'flex', alignItems: 'center', gap: '4px', textTransform: 'uppercase' }}>
              🤟 Audio-to-Sign Gloss
            </span>
            <strong style={{ fontSize: '11px', display: 'block', color: 'inherit', marginTop: '2px' }}>
              {data.signGloss || 'VOICE MESSAGE · READY FOR SIGN CONVERSION'}
            </strong>
          </div>
          {uploadPanel}
          <div className="audioSpeedControls">
            <button type="button" className={audioSpeed === 1 ? 'activeAudioSpeed' : ''} onClick={() => onAudioSpeedChange(1)}>1x</button>
            <button type="button" className={audioSpeed === 2 ? 'activeAudioSpeed' : ''} onClick={() => onAudioSpeedChange(2)}>2x</button>
            <button type="button" onClick={() => onAudioSpeedChange('custom')}>Custom</button>
          </div>
        </div>
      </div>
    );
  }
  if (type === 'cameraClip') {
    return <div className="specialMessageCard specialCameraCard"><Icon type="camera" /><div><span>Live Camera Clip</span><strong>{data.title || 'Snap-style camera clip'}</strong><small>{data.camera || 'Front camera'} · switch camera supported</small></div><button type="button">Open</button></div>;
  }
  if (type === 'meet') {
    return (
      <div className="specialMessageCard specialMeetCard">
        <Icon type="event" />
        <div><span>Meet Moment</span><strong>{data.title || 'Signova Meet Moment'}</strong><small>{data.date} · {data.time} · Reminder {data.reminder}</small><em>{isOutgoing ? 'You can edit this meet moment after sending.' : 'Save this to notes, reminders, calendar, or alarms.'}</em></div>
        {isOutgoing ? <button type="button" onClick={onEditMeet}>Edit</button> : <div className="meetReceiverActions"><button type="button" onClick={() => onSaveMeetDetail('notes')}>Notes</button><button type="button" onClick={() => onSaveMeetDetail('reminder')}>Reminder</button><button type="button" onClick={() => onSaveMeetDetail('calendar')}>Calendar</button><button type="button" onClick={() => onSaveMeetDetail('alarm')}>Alarm</button></div>}
      </div>
    );
  }
  if (type === 'poll') {
    const options = data.options || [];
    const votes = data.votes || options.map(() => 0);
    const totalVotes = votes.reduce((total, vote) => total + Number(vote || 0), 0);
    return (
      <div className="specialMessageCard specialPollCard">
        <Icon type="poll" />
        <div><span>Audience Poll</span><strong>{data.title || 'Poll'}</strong><div className="specialPollOptions">{options.map((option, index) => <button type="button" className={data.selectedOption === index ? 'selectedPollOption' : ''} key={`${option}-${index}`} onClick={() => onVotePoll(index)}><span>{index + 1}. {option}</span><i style={{ '--poll-percent': `${totalVotes ? Math.round((votes[index] || 0) / totalVotes * 100) : 0}%` }} /><small>{votes[index] || 0} vote{(votes[index] || 0) === 1 ? '' : 's'} · {totalVotes ? Math.round((votes[index] || 0) / totalVotes * 100) : 0}%</small></button>)}</div><small>{totalVotes ? `${totalVotes} audience response${totalVotes === 1 ? '' : 's'} collected` : 'Waiting for audience responses'}</small></div>
      </div>
    );
  }
  if (type === 'contact') {
    return <div className="specialMessageCard specialContactCard"><Icon type="contact" /><div><span>Signova Contact</span><strong>{data.title || 'Contact'}</strong><small>{data.username}{data.number ? ` · ${data.number}` : ''}</small></div><button type="button" onClick={isOutgoing ? onEditContact : onAddContact}>{isOutgoing ? 'Edit' : 'Add'}</button></div>;
  }
  if (type === 'sticker') {
    return <div className="specialMessageCard specialStickerCard"><Icon type="sticker" /><div><span>Gesture Sticker</span><strong>{data.title}</strong><small>{data.note}</small></div></div>;
  }
  return null;
}
