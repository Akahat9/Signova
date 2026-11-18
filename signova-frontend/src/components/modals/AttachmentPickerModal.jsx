import React from 'react';
import { Attach3DIcon } from '../SignovaIcons';
import { ContactAvatar } from '../AppPresentation';

/**
 * AttachmentPickerModal component
 * Dialog for choosing attachments in chat (Images, Camera Snap Clips, Contacts, Polls, Events, Stickers).
 */
export default function AttachmentPickerModal({
  attachMiniWindow,
  setAttachMiniWindow,
  imageSendMode,
  setImageSendMode,
  openAttachmentPicker,
  cameraClipFacing,
  setCameraClipFacing,
  sendCameraClip,
  contacts = [],
  selectedShareContactId,
  setSelectedShareContactId,
  shareSignovaContact,
  pollForm,
  setPollForm,
  createPulsePoll,
  meetForm,
  setMeetForm,
  createMeetMoment,
  GESTURE_STICKERS = [],
  sendGestureSticker,
}) {
  if (!attachMiniWindow) {
    return null;
  }

  return (
    <div
      className="contactMiniOverlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setAttachMiniWindow('');
      }}
    >
      <section className="contactMiniModal attachMiniModal" role="dialog" aria-modal="true" aria-label="Signova attachment window">
        <button
          type="button"
          className="contactMiniClose"
          onClick={() => setAttachMiniWindow('')}
          aria-label="Close attachment window"
        >
          ×
        </button>
        <div className="modalBrandHeader">
          <Attach3DIcon
            type={
              attachMiniWindow === 'event'
                ? 'event'
                : attachMiniWindow === 'poll'
                ? 'poll'
                : attachMiniWindow === 'contact'
                ? 'contact'
                : attachMiniWindow === 'imageMode'
                ? 'gallery'
                : attachMiniWindow === 'cameraClip'
                ? 'camera'
                : 'sticker'
            }
          />
          <div>
            <span>Signova Attach</span>
            <strong>
              {attachMiniWindow === 'contact'
                ? 'Share contact'
                : attachMiniWindow === 'poll'
                ? 'Audience poll'
                : attachMiniWindow === 'event'
                ? 'Meet Moment'
                : attachMiniWindow === 'imageMode'
                ? 'Image send mode'
                : attachMiniWindow === 'cameraClip'
                ? 'Live camera clip'
                : 'Gesture stickers'}
            </strong>
            <small>
              {attachMiniWindow === 'contact'
                ? 'Share name, username, and optional number'
                : attachMiniWindow === 'poll'
                ? 'Create an audience poll for chat'
                : attachMiniWindow === 'event'
                ? 'Save meet date with reminder'
                : attachMiniWindow === 'imageMode'
                ? 'Choose quality before sending image'
                : attachMiniWindow === 'cameraClip'
                ? 'Snap-style camera clip with front/back switch'
                : 'Sticker picker preview'}
            </small>
          </div>
        </div>

        {attachMiniWindow === 'imageMode' && (
          <div className="attachChoiceGrid">
            {['Simple image', 'HD image', 'Full HD image', 'Send as document'].map((mode) => (
              <button
                type="button"
                className={imageSendMode === mode ? 'activeAttachChoice' : ''}
                key={mode}
                onClick={() => setImageSendMode(mode)}
              >
                <Attach3DIcon type={mode.includes('document') ? 'document' : 'gallery'} />
                <span>{mode}</span>
              </button>
            ))}
            <button
              type="button"
              className="attachWideAction"
              onClick={() => openAttachmentPicker('image/*')}
            >
              Choose image
            </button>
          </div>
        )}

        {attachMiniWindow === 'cameraClip' && (
          <div className="attachCameraClipPanel">
            <div className="cameraClipPreview">
              <Attach3DIcon type="camera" />
              <strong>{cameraClipFacing}</strong>
              <small>Simple snap-style clip preview</small>
            </div>
            <div className="attachChoiceGrid twoChoiceGrid">
              {['Front camera', 'Back camera'].map((camera) => (
                <button
                  type="button"
                  className={cameraClipFacing === camera ? 'activeAttachChoice' : ''}
                  key={camera}
                  onClick={() => setCameraClipFacing(camera)}
                >
                  <Attach3DIcon type="camera" />
                  <span>{camera}</span>
                </button>
              ))}
            </div>
            <button type="button" className="attachWideAction" onClick={sendCameraClip}>
              Send clip
            </button>
          </div>
        )}

        {attachMiniWindow === 'contact' && (
          <form className="contactForm attachMiniForm" onSubmit={shareSignovaContact}>
            <label className="settingField">
              <span>Select Signova contact</span>
              <select
                value={selectedShareContactId}
                onChange={(event) => setSelectedShareContactId(event.target.value)}
              >
                {contacts.map((contact) => (
                  <option key={contact.id} value={contact.id}>
                    {contact.name} · {contact.username}
                  </option>
                ))}
              </select>
            </label>
            <div className="shareContactPreview">
              <ContactAvatar
                contact={
                  contacts.find((item) => item.id === selectedShareContactId) || contacts[0]
                }
              />
              <span>
                <strong>
                  {contacts.find((item) => item.id === selectedShareContactId)?.name ||
                    'Signova Contact'}
                </strong>
                <small>
                  {contacts.find((item) => item.id === selectedShareContactId)?.username ||
                    '@username'}
                </small>
              </span>
            </div>
            <button type="submit">Share contact</button>
          </form>
        )}

        {attachMiniWindow === 'poll' && (
          <form className="contactForm attachMiniForm" onSubmit={createPulsePoll}>
            <input
              className="signSearch"
              value={pollForm.question}
              onChange={(event) => setPollForm({ ...pollForm, question: event.target.value })}
              placeholder="Poll question"
            />
            {pollForm.options.map((option, index) => (
              <input
                className="signSearch"
                key={`poll-option-${index}`}
                value={option}
                onChange={(event) =>
                  setPollForm({
                    ...pollForm,
                    options: pollForm.options.map((item, itemIndex) =>
                      itemIndex === index ? event.target.value : item
                    ),
                  })
                }
                placeholder={`Option ${index + 1}`}
              />
            ))}
            <div className="avatarActionRow">
              <button
                type="button"
                onClick={() => setPollForm({ ...pollForm, options: [...pollForm.options, ''] })}
              >
                Add option
              </button>
              <button type="submit">Create poll</button>
            </div>
          </form>
        )}

        {attachMiniWindow === 'event' && (
          <form className="contactForm attachMiniForm" onSubmit={createMeetMoment}>
            <input
              className="signSearch"
              value={meetForm.title}
              onChange={(event) => setMeetForm({ ...meetForm, title: event.target.value })}
              placeholder="Meet title"
            />
            <div className="miniFormGrid">
              <input
                className="signSearch"
                type="date"
                value={meetForm.date}
                onChange={(event) => setMeetForm({ ...meetForm, date: event.target.value })}
              />
              <input
                className="signSearch"
                type="time"
                value={meetForm.time}
                onChange={(event) => setMeetForm({ ...meetForm, time: event.target.value })}
              />
            </div>
            <label className="settingField">
              <span>Reminder</span>
              <select
                value={meetForm.reminder}
                onChange={(event) => setMeetForm({ ...meetForm, reminder: event.target.value })}
              >
                <option>At time of event</option>
                <option>5 min before</option>
                <option>15 min before</option>
                <option>1 hour before</option>
                <option>1 day before</option>
              </select>
            </label>
            <button type="submit">Save meet moment</button>
          </form>
        )}

        {attachMiniWindow === 'sticker' && (
          <div className="stickerPickerGrid">
            {GESTURE_STICKERS.map((sticker) => (
              <button
                type="button"
                key={sticker.label}
                onClick={() => sendGestureSticker(sticker)}
              >
                <b>{sticker.emoji}</b>
                <span>{sticker.label}</span>
                <small>{sticker.note}</small>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}