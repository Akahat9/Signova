import React, { useState } from 'react';
import { normalizeUsername } from '../../features/auth/identityValidation';

/**
 * CommunityGatewayModal Component
 * Provides seamless 1-click "Continue with Signova ID" or "Create Dedicated Creator/Developer ID",
 * alongside transparent AI Dataset Contributor terms.
 */
export default function CommunityGatewayModal({
  isOpen,
  onClose,
  settings,
  communityProfile,
  setCommunityProfile,
  saveCommunityProfileToFirestore,
  setStatus,
}) {
  const [mode, setMode] = useState('same'); // 'same' | 'custom'
  const [creatorName, setCreatorName] = useState(communityProfile?.name || settings?.account?.name || 'Signova Creator');
  const [creatorHandle, setCreatorHandle] = useState(communityProfile?.username || settings?.account?.username || '@signova.creator');
  const [creatorRole, setCreatorRole] = useState(communityProfile?.role || 'Sign Language Mentor');
  const [creatorBio, setCreatorBio] = useState(communityProfile?.bio || 'Sharing sign language gestures & building AI datasets.');
  const [aiDatasetConsent, setAiDatasetConsent] = useState(true);
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  async function handleActivate(e) {
    e?.preventDefault();
    setSaving(true);

    const isSameId = mode === 'same';
    const finalName = isSameId ? (settings?.account?.name || 'Signova Member') : creatorName.trim();
    const finalHandle = isSameId
      ? (settings?.account?.username || '@signova.member')
      : normalizeUsername(creatorHandle);
    const finalRole = isSameId ? 'Community Member' : creatorRole;
    const finalBio = isSameId
      ? (settings?.account?.about || 'Signova community member.')
      : creatorBio.trim();

    const updatedProfile = {
      ...communityProfile,
      name: finalName,
      username: finalHandle,
      role: finalRole,
      bio: finalBio,
      aiDatasetConsent,
      initialized: true,
      badges: aiDatasetConsent ? ['AI Dataset Contributor', 'Verified Creator'] : ['Community Member'],
    };

    setCommunityProfile(updatedProfile);

    if (typeof saveCommunityProfileToFirestore === 'function') {
      try {
        await saveCommunityProfileToFirestore(updatedProfile);
      } catch (err) {
        console.warn('Failed to save community profile to cloud:', err);
      }
    }

    setStatus?.(`Community identity activated as ${finalHandle}`);
    setSaving(false);
    onClose();
  }

  return (
    <div
      className="modernContactModalOverlay"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section className="modernAddContactCard communityGatewayModalCard" role="dialog" aria-modal="true" aria-label="Community Identity & AI Dataset Setup">
        {/* Close Button */}
        <button
          type="button"
          className="modernModalCloseBtn"
          onClick={onClose}
          aria-label="Close"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Brand Header */}
        <header className="modernModalHeader">
          <div className="modernModalLogoGlow communityGatewayLogoGlow">
            <span style={{ fontSize: '22px' }}>✦</span>
          </div>
          <div className="modernModalHeaderInfo">
            <h2>Signova Community Hub</h2>
            <p>Choose your public identity & dataset contribution role</p>
          </div>
        </header>

        {/* Choice Toggle: Same ID vs Special Creator ID */}
        <div className="communityGatewayToggleBar">
          <button
            type="button"
            className={`communityGatewayToggleBtn ${mode === 'same' ? 'activeToggle' : ''}`}
            onClick={() => setMode('same')}
          >
            <strong>👤 Same Signova ID</strong>
            <small>1-Click instant link</small>
          </button>
          <button
            type="button"
            className={`communityGatewayToggleBtn ${mode === 'custom' ? 'activeToggle' : ''}`}
            onClick={() => setMode('custom')}
          >
            <strong>✦ Special Creator ID</strong>
            <small>Custom alias & role</small>
          </button>
        </div>

        {mode === 'same' ? (
          /* Option 1 Preview Card */
          <div className="gatewayIdentityPreviewCard">
            <div className="gatewayPreviewAvatar">
              {settings?.account?.profilePhoto ? (
                <img src={settings.account.profilePhoto} alt="" />
              ) : (
                <span>{(settings?.account?.name || 'S').charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div className="gatewayPreviewInfo">
              <strong>{settings?.account?.name || 'Signova Member'}</strong>
              <span>{settings?.account?.username || '@signova.user'}</span>
              <small>Auto-synced from your personal account</small>
            </div>
            <span className="gatewayBadgeSynced">Auto-Synced</span>
          </div>
        ) : (
          /* Option 2 Custom Creator ID Fields */
          <div className="gatewayCustomFormFields">
            <div className="gatewayFormField">
              <label>Creator / Developer Name</label>
              <input
                type="text"
                value={creatorName}
                onChange={(e) => setCreatorName(e.target.value)}
                placeholder="e.g. Krisha Sharma"
              />
            </div>

            <div className="gatewayFormField">
              <label>Public Community Handle (@alias)</label>
              <input
                type="text"
                value={creatorHandle}
                onChange={(e) => setCreatorHandle(e.target.value)}
                placeholder="e.g. @isl.master or @gesture.dev"
              />
            </div>

            <div className="gatewayFormField">
              <label>Community Contribution Role</label>
              <select
                value={creatorRole}
                onChange={(e) => setCreatorRole(e.target.value)}
              >
                <option value="Sign Language Mentor">Sign Language Mentor</option>
                <option value="AI Dataset Contributor">AI Dataset Contributor</option>
                <option value="Content Creator">Content Creator & Signer</option>
                <option value="Developer / Researcher">Developer & Researcher</option>
                <option value="Deaf Advocate">Deaf Community Advocate</option>
              </select>
            </div>

            <div className="gatewayFormField">
              <label>Public Creator Bio</label>
              <input
                type="text"
                value={creatorBio}
                onChange={(e) => setCreatorBio(e.target.value)}
                placeholder="Briefly describe your signs or mission..."
              />
            </div>
          </div>
        )}

        {/* AI Dataset Contributor Agreement & Terms Box */}
        <div className="gatewayAiTermsCard">
          <div className="gatewayAiTermsHeader">
            <span className="gatewaySparkleIcon">🧠</span>
            <div>
              <strong>Signova AI Dataset Training Contribution</strong>
              <small>Empowering open-source sign language AI recognition</small>
            </div>
          </div>
          <p className="gatewayAiTermsText">
            The signs, gestures, and demonstration videos you share in Signova Community can be securely processed into MediaPipe 3D landmark datasets. This data is used to train and refine Signova's AI neural models for accurate, accessible sign language translation.
          </p>
          <label className="gatewayCheckboxRow">
            <input
              type="checkbox"
              checked={aiDatasetConsent}
              onChange={(e) => setAiDatasetConsent(e.target.checked)}
            />
            <span>
              <strong>I agree to contribute gesture videos for AI model training</strong>
              <small>Unlocks the verified ✦ AI Dataset Contributor badge on your profile</small>
            </span>
          </label>
        </div>

        {/* Footer Action */}
        <footer className="gatewayModalFooter">
          <button
            type="button"
            className="gatewayCancelBtn"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="modernPrimaryAddBtn gatewaySubmitBtn"
            onClick={handleActivate}
            disabled={saving}
          >
            <span>{saving ? 'Activating...' : 'Activate Community Identity'}</span>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        </footer>
      </section>
    </div>
  );
}
