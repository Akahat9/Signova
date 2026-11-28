import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ContactAvatar } from '../AppPresentation';

/**
 * Modern CreateGroupModal matching Signova's purple-accented card design.
 * Supports group photo upload, character-counted name & description,
 * Group Privacy / Admin Permissions / Disappearing Messages settings,
 * and live contact search + avatar chips for adding members.
 */
export default function CreateGroupModal({
  groupModalOpen,
  setGroupModalOpen,
  groupCreationContext,
  groupForm,
  setGroupForm,
  createSignovaGroup,
  contacts = [],
}) {
  const [memberSearch, setMemberSearch] = useState('');
  const avatarInputRef = useRef(null);

  useEffect(() => {
    if (!groupModalOpen) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setGroupModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [groupModalOpen, setGroupModalOpen]);

  useEffect(() => {
    if (groupModalOpen) {
      setMemberSearch('');
    }
  }, [groupModalOpen]);

  const selectedHandles = useMemo(() => {
    return String(groupForm.members || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
  }, [groupForm.members]);

  const availableContacts = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    return contacts
      .filter((c) => c.id !== 'signova-ai' && c.number !== 'Signova Group')
      .filter((c) => {
        if (!q) return true;
        return (
          String(c.name || '').toLowerCase().includes(q) ||
          String(c.username || '').toLowerCase().includes(q) ||
          String(c.number || '').toLowerCase().includes(q)
        );
      });
  }, [contacts, memberSearch]);

  if (!groupModalOpen || typeof document === 'undefined') {
    return null;
  }

  const toggleContactMember = (contact) => {
    const handle = String(contact.username || contact.number || contact.name || '').trim();
    if (!handle) return;
    const lower = handle.toLowerCase();
    const exists = selectedHandles.includes(lower);
    const nextList = exists
      ? String(groupForm.members || '')
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s && s.toLowerCase() !== lower)
      : [
          ...String(groupForm.members || '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          handle,
        ];
    setGroupForm({ ...groupForm, members: nextList.join(', ') });
  };

  const handleGroupAvatarPick = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setGroupForm((prev) => ({ ...prev, avatarUrl: reader.result }));
      }
    };
    reader.readAsDataURL(file);
  };

  const nameLen = String(groupForm.name || '').length;
  const descLen = String(groupForm.description || '').length;

  return createPortal(
    <div
      className="modernContactModalOverlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setGroupModalOpen(false);
      }}
    >
      <section
        className="modernCreateGroupCard"
        role="dialog"
        aria-modal="true"
        aria-label="Create Signova group"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="modernCreateGroupHeader">
          <div className="modernGroupTitleRow">
            <div className="modernGroupIconBadge">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.1">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <div>
              <h3>{groupCreationContext === 'community' ? 'Create Community Group' : 'Create Group'}</h3>
              <p>{groupCreationContext === 'community' ? 'Build a learning & community space' : 'Bring people together'}</p>
            </div>
          </div>
          <button
            type="button"
            className="modernModalCloseBtn"
            onClick={() => setGroupModalOpen(false)}
            aria-label="Close group creation"
          >
            ✕
          </button>
        </header>

        <form className="modernCreateGroupBody" onSubmit={createSignovaGroup}>
          {/* Group Avatar Picker */}
          <div className="modernGroupAvatarPickerWrap">
            <button
              type="button"
              className="modernGroupAvatarCircle"
              onClick={() => avatarInputRef.current?.click()}
              title="Upload group photo"
            >
              {groupForm.avatarUrl ? (
                <img src={groupForm.avatarUrl} alt="Group" className="modernGroupAvatarPreview" />
              ) : (
                <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.9">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              )}
              <span className="modernGroupAvatarEditPill" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.4">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
              </span>
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              onChange={handleGroupAvatarPick}
              className="visuallyHidden"
            />
          </div>

          {/* Group Name */}
          <div className="modernGroupFieldBlock">
            <label htmlFor="modern-group-name-input">
              Group Name <span className="reqStar">*</span>
            </label>
            <div className="modernCountedInputWrap">
              <input
                id="modern-group-name-input"
                type="text"
                maxLength={50}
                value={groupForm.name}
                onChange={(event) => setGroupForm({ ...groupForm, name: event.target.value })}
                placeholder="e.g. Study Group"
                className="modernGroupTextInput"
                required
              />
              <span className="modernCharCount">{nameLen}/50</span>
            </div>
          </div>

          {/* Group Description */}
          <div className="modernGroupFieldBlock">
            <label htmlFor="modern-group-desc-input">
              Group Description <span className="optLabel">(Optional)</span>
            </label>
            <div className="modernCountedTextareaWrap">
              <textarea
                id="modern-group-desc-input"
                maxLength={200}
                rows={2}
                value={groupForm.description}
                onChange={(event) => setGroupForm({ ...groupForm, description: event.target.value })}
                placeholder="Add a description for your group..."
                className="modernGroupTextarea"
              />
              <span className="modernCharCount">{descLen}/200</span>
            </div>
          </div>

          {/* Group Settings */}
          <div className="modernGroupSettingsSection">
            <h4>Group Settings</h4>

            <div className="modernGroupSettingItem">
              <div className="settingItemLeft">
                <span className="settingItemIcon">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.1">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                </span>
                <div>
                  <strong>Group Privacy</strong>
                  <small>Choose who can join this group</small>
                </div>
              </div>
              <select
                value={groupForm.privacy || 'private'}
                onChange={(event) => setGroupForm({ ...groupForm, privacy: event.target.value })}
                className="modernGroupSelectPill"
                aria-label="Group Privacy"
              >
                <option value="private">Private</option>
                <option value="approval">Invite Approval</option>
                <option value="public">Public</option>
              </select>
            </div>

            <div className="modernGroupSettingItem">
              <div className="settingItemLeft">
                <span className="settingItemIcon">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.1">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                </span>
                <div>
                  <strong>Admin Permissions</strong>
                  <small>Control what admins can do</small>
                </div>
              </div>
              <select
                value={groupForm.adminPermissions || 'all'}
                onChange={(event) =>
                  setGroupForm({
                    ...groupForm,
                    adminPermissions: event.target.value,
                    adminApproval: event.target.value === 'approve',
                  })
                }
                className="modernGroupSelectPill"
                aria-label="Admin Permissions"
              >
                <option value="all">All Permissions</option>
                <option value="admins">Admins Only</option>
                <option value="approve">Approve Members</option>
              </select>
            </div>

            <div className="modernGroupSettingItem">
              <div className="settingItemLeft">
                <span className="settingItemIcon">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.1">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </span>
                <div>
                  <strong>Disappearing Messages</strong>
                  <small>Messages will disappear after</small>
                </div>
              </div>
              <select
                value={groupForm.disappearingMessages || 'off'}
                onChange={(event) => setGroupForm({ ...groupForm, disappearingMessages: event.target.value })}
                className="modernGroupSelectPill"
                aria-label="Disappearing Messages"
              >
                <option value="off">Off</option>
                <option value="24h">24 Hours</option>
                <option value="7d">7 Days</option>
                <option value="30d">30 Days</option>
              </select>
            </div>
          </div>

          {/* Add Members */}
          <div className="modernGroupMembersSection">
            <h4>Add Members</h4>
            <div className="modernMemberSearchBox">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder="Search contacts or type @username..."
              />
            </div>

            <div className="modernMemberAvatarRow">
              {availableContacts.slice(0, 7).map((contact) => {
                const handle = String(contact.username || contact.number || contact.name || '').trim().toLowerCase();
                const isSelected = selectedHandles.includes(handle);
                return (
                  <button
                    key={contact.id}
                    type="button"
                    className={`modernMemberChipBtn ${isSelected ? 'selected' : ''}`}
                    onClick={() => toggleContactMember(contact)}
                    title={`${contact.name} (${contact.username || contact.number || 'Contact'})`}
                  >
                    <ContactAvatar contact={contact} />
                    {isSelected && <span className="memberSelectedTick">✓</span>}
                  </button>
                );
              })}

              {memberSearch.trim() && !availableContacts.length && (
                <button
                  type="button"
                  className="modernMemberAddManualBtn"
                  onClick={() => {
                    const next = memberSearch.trim();
                    const formatted = next.startsWith('@') ? next : `@${next}`;
                    setGroupForm((prev) => ({
                      ...prev,
                      members: prev.members ? `${prev.members}, ${formatted}` : formatted,
                    }));
                    setMemberSearch('');
                  }}
                >
                  + Add {memberSearch.trim()}
                </button>
              )}
            </div>
          </div>

          {/* Footer */}
          <footer className="modernCreateGroupFooter">
            <button
              type="button"
              className="modernGroupCancelBtn"
              onClick={() => setGroupModalOpen(false)}
            >
              Cancel
            </button>
            <button type="submit" className="modernGroupSubmitBtn">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="8.5" cy="7" r="4" />
                <line x1="20" y1="8" x2="20" y2="14" />
                <line x1="23" y1="11" x2="17" y2="11" />
              </svg>
              <span>Create Group</span>
            </button>
          </footer>
        </form>
      </section>
    </div>,
    document.body
  );
}
