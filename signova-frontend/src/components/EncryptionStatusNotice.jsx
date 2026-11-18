import React from 'react';

export default function EncryptionStatusNotice({ capability }) {
  const active = capability?.available === true
    && Boolean(capability.protocol)
    && Number(capability.verifiedDevices) > 0;

  return (
    <details className={`encryptionStatusNotice ${active ? 'encryptionStatusActive' : 'encryptionStatusUnavailable'}`}>
      <summary aria-label={active ? 'End-to-end encryption active' : 'End-to-end encryption unavailable'}>
        <span className="encryptionStatusIcon" aria-hidden="true">{active ? '✓' : '!'}</span>
        <span>{active ? 'E2EE active' : 'E2EE unavailable'}</span>
      </summary>
      <div className="encryptionStatusPopover" role="status">
        <strong>{active ? 'End-to-end encryption is active' : 'End-to-end encryption is not active'}</strong>
        <p>
          {active
            ? `${capability.protocol} protects this conversation across ${capability.verifiedDevices} verified device${capability.verifiedDevices === 1 ? '' : 's'}.`
            : capability?.reason || 'Messages are not currently protected by verified end-to-end encryption.'}
        </p>
        <small>{active ? 'Only verified participants can decrypt messages.' : 'Avoid sharing highly sensitive information in this preview.'}</small>
      </div>
    </details>
  );
}
