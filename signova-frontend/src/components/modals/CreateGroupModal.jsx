import React from 'react';
import { Attach3DIcon } from '../SignovaIcons';

/**
 * CreateGroupModal component
 * Dialog for creating a new community learning group or private chat group.
 */
export default function CreateGroupModal({
  groupModalOpen,
  setGroupModalOpen,
  groupCreationContext,
  groupForm,
  setGroupForm,
  createSignovaGroup,
}) {
  if (!groupModalOpen) {
    return null;
  }

  return (
    <div
      className="contactMiniOverlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setGroupModalOpen(false);
      }}
    >
      <section className="contactMiniModal groupCreateModal" role="dialog" aria-modal="true" aria-label="Create Signova group">
        <button
          type="button"
          className="contactMiniClose"
          onClick={() => setGroupModalOpen(false)}
          aria-label="Close group creation"
        >
          ×
        </button>
        <div className="modalBrandHeader">
          <Attach3DIcon type="contact" />
          <div>
            <span>{groupCreationContext === 'community' ? 'Create Community Group' : 'Create Chat Group'}</span>
            <strong>{groupCreationContext === 'community' ? 'Community learning space' : 'Private conversation group'}</strong>
            <small>
              {groupCreationContext === 'community'
                ? 'Discovery, learning, moderation, and members'
                : 'Private messaging preview for selected contacts'}
            </small>
          </div>
        </div>
        <form className="contactForm groupCreateForm" onSubmit={createSignovaGroup}>
          <input
            className="signSearch"
            value={groupForm.name}
            onChange={(event) => setGroupForm({ ...groupForm, name: event.target.value })}
            placeholder="Group name"
          />
          <div className="miniFormGrid">
            <label className="settingField">
              <span>Purpose</span>
              <select
                value={groupForm.purpose}
                onChange={(event) => setGroupForm({ ...groupForm, purpose: event.target.value })}
              >
                <option>Sign language learning</option>
                <option>Classroom</option>
                <option>Family support</option>
                <option>Interpreter team</option>
                <option>Community discussion</option>
                <option>Event planning</option>
              </select>
            </label>
            <label className="settingField">
              <span>Category</span>
              <select
                value={groupForm.category}
                onChange={(event) => setGroupForm({ ...groupForm, category: event.target.value })}
              >
                <option value="learning">Learning</option>
                <option value="classroom">Classroom</option>
                <option value="family">Family</option>
                <option value="work">Work</option>
                <option value="community">Community</option>
                <option value="event">Event</option>
              </select>
            </label>
          </div>
          <textarea
            className="signSearch"
            value={groupForm.description}
            onChange={(event) => setGroupForm({ ...groupForm, description: event.target.value })}
            placeholder="Short group description"
          />
          <input
            className="signSearch"
            value={groupForm.members}
            onChange={(event) => setGroupForm({ ...groupForm, members: event.target.value })}
            placeholder="@usernames or numbers, comma separated"
          />
          <label className="settingField">
            <span>Privacy</span>
            <select
              value={groupForm.privacy}
              onChange={(event) => setGroupForm({ ...groupForm, privacy: event.target.value })}
            >
              <option value="private">Private invite-only</option>
              <option value="approval">Join with admin approval</option>
              <option value="public">Public community group</option>
            </select>
          </label>
          <div className="groupFeatureGrid">
            <label>
              <input
                type="checkbox"
                checked={groupForm.allowMeetings}
                onChange={(event) => setGroupForm({ ...groupForm, allowMeetings: event.target.checked })}
              />{' '}
              Meetings
            </label>
            <label>
              <input
                type="checkbox"
                checked={groupForm.enableAudiencePolls}
                onChange={(event) => setGroupForm({ ...groupForm, enableAudiencePolls: event.target.checked })}
              />{' '}
              Audience polls
            </label>
            <label>
              <input
                type="checkbox"
                checked={groupForm.enableMediaDrive}
                onChange={(event) => setGroupForm({ ...groupForm, enableMediaDrive: event.target.checked })}
              />{' '}
              Media drive
            </label>
            <label>
              <input
                type="checkbox"
                checked={groupForm.adminApproval}
                onChange={(event) => setGroupForm({ ...groupForm, adminApproval: event.target.checked })}
              />{' '}
              Admin approval
            </label>
            <label>
              <input
                type="checkbox"
                checked={groupForm.autoCaptions}
                onChange={(event) => setGroupForm({ ...groupForm, autoCaptions: event.target.checked })}
              />{' '}
              Meeting captions
            </label>
            <label title="Group E2EE is not implemented yet">
              <input type="checkbox" checked={false} disabled /> Group E2EE unavailable
            </label>
          </div>
          {groupCreationContext === 'community' && (
            <div className="miniFormGrid communityGroupAdvancedCreate">
              <label className="settingField">
                <span>Who can post</span>
                <select
                  value={groupForm.postingPermission}
                  onChange={(event) => setGroupForm({ ...groupForm, postingPermission: event.target.value })}
                >
                  <option value="members">All members</option>
                  <option value="approved">Approved members</option>
                  <option value="admins">Admins only</option>
                </select>
              </label>
              <label className="settingField">
                <span>Member list</span>
                <select
                  value={groupForm.memberListVisibility}
                  onChange={(event) => setGroupForm({ ...groupForm, memberListVisibility: event.target.value })}
                >
                  <option value="members">Members can view</option>
                  <option value="admins">Admins only</option>
                  <option value="public">Public</option>
                </select>
              </label>
              <label className="settingField">
                <span>Notifications</span>
                <select
                  value={groupForm.notifications}
                  onChange={(event) => setGroupForm({ ...groupForm, notifications: event.target.value })}
                >
                  <option value="important">Important updates</option>
                  <option value="all">All activity</option>
                  <option value="mentions">Mentions only</option>
                </select>
              </label>
            </div>
          )}
          <div className="categoryComposerActions">
            <button type="button" onClick={() => setGroupModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="primaryCategoryButton">
              Create group
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}