import React from 'react';

export default function TranslateToolsPanel({
  synapseEnabled,
  updateSynapseEnabled,
  liveSign,
  learningFeedback,
  temporalBufferSize,
  formatConfidence,
  sentence,
  copySentence,
  clearSentence,
  latestHistory,
}) {
  return (
    <>
      <section className="toolSummary">
        <div>
          <span>Synapse Engine</span>
          <strong>{synapseEnabled ? 'Active for signs' : 'Off for normal video'}</strong>
        </div>
        <button type="button" onClick={() => updateSynapseEnabled((enabled) => !enabled)}>
          {synapseEnabled ? 'Deactivate' : 'Activate'}
        </button>
      </section>
      <section className="panel livePanel">
        <div className="panelHeader">
          <span>Live detection</span>
          <strong>{liveSign?.phrase || 'Waiting for hands'}</strong>
        </div>
        <div className="confidenceTrack" aria-label="Current prediction confidence">
          <span style={{ width: liveSign ? `${Math.min(100, Math.round(liveSign.confidence * 100))}%` : '0%' }} />
        </div>
        <p className="liveHint">
          {liveSign?.isStable ? 'Sign locked. It is added to your sentence.' : learningFeedback}
        </p>
        <div className="signalGrid">
          <span>Sequence {liveSign?.sequenceLength || 0}/{temporalBufferSize}</span>
          <span>Stability {formatConfidence(liveSign?.stability || 0)}</span>
          <span>Frame {formatConfidence(liveSign?.qualityScore || 0)}</span>
        </div>
      </section>

      <section className="panel sentencePanel">
        <div className="panelHeader">
          <span>Sentence</span>
          <strong>{sentence}</strong>
        </div>
        <div className="actionRow">
          <button type="button" onClick={copySentence}>Copy</button>
          <button type="button" className="secondaryButton" onClick={clearSentence}>Clear</button>
        </div>
      </section>

      <section className="panel historyPanel">
        <div className="panelHeader">
          <span>Recent signs</span>
          <strong>{latestHistory.length ? `${latestHistory.length} detected` : 'Listening'}</strong>
        </div>
        <div className="historyList">
          {latestHistory.length ? latestHistory.map((item) => (
            <div className="historyItem" key={`${item.label}-${item.time}`}>
              <span>{item.phrase}</span>
              <small>{formatConfidence(item.confidence)} - {item.time}</small>
            </div>
          )) : <p>No predictions yet</p>}
        </div>
      </section>
    </>
  );
}

