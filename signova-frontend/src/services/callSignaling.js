import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  CALL_ROOM_STATUSES,
  isIncomingCallStatus,
} from '../features/calls/callStateMachine';

export { CALL_ROOM_STATUSES };

function assertUid(uid, field) {
  const value = String(uid || '').trim();
  if (!value || value.length > 128) throw new Error(`${field} is required`);
  return value;
}

function serializeDescription(description) {
  if (!description?.type || !description?.sdp) throw new Error('A valid session description is required');
  return { type: description.type, sdp: description.sdp };
}

function serializeCandidate(candidate) {
  const value = candidate?.toJSON ? candidate.toJSON() : candidate;
  if (!value?.candidate) throw new Error('A valid ICE candidate is required');
  return {
    candidate: value.candidate,
    sdpMid: value.sdpMid ?? null,
    sdpMLineIndex: value.sdpMLineIndex ?? null,
    usernameFragment: value.usernameFragment ?? null,
  };
}

export async function createCallRoom(db, { callerUid, calleeUid, mediaType = 'video' }) {
  const caller = assertUid(callerUid, 'callerUid');
  const callee = assertUid(calleeUid, 'calleeUid');
  if (caller === callee) throw new Error('Caller and callee must be different users');
  if (!['video', 'voice'].includes(mediaType)) throw new Error('Unsupported call media type');

  const reference = await addDoc(collection(db, 'callRooms'), {
    callerUid: caller,
    calleeUid: callee,
    participantUids: [caller, callee],
    mediaType,
    status: 'ringing',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    expiresAtMillis: Date.now() + (10 * 60 * 1000),
  });
  return reference.id;
}

export function watchIncomingCalls(db, uid, onChange, onError) {
  const calleeUid = assertUid(uid, 'uid');
  return onSnapshot(
    query(collection(db, 'callRooms'), where('calleeUid', '==', calleeUid)),
    (snapshot) => onChange(snapshot.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .filter((room) => isIncomingCallStatus(room.status) && room.expiresAtMillis > Date.now())
      .sort((left, right) => Number(right.expiresAtMillis || 0) - Number(left.expiresAtMillis || 0))),
    onError,
  );
}

export function watchCallRoom(db, roomId, onChange, onError) {
  return onSnapshot(doc(db, 'callRooms', roomId), (snapshot) => {
    onChange(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null);
  }, onError);
}

export async function publishCallOffer(db, roomId, offer) {
  await updateDoc(doc(db, 'callRooms', roomId), {
    offer: serializeDescription(offer),
    status: 'connecting',
    updatedAt: serverTimestamp(),
  });
}

export async function publishCallAnswer(db, roomId, answer) {
  await updateDoc(doc(db, 'callRooms', roomId), {
    answer: serializeDescription(answer),
    status: 'connected',
    updatedAt: serverTimestamp(),
  });
}

export async function setCallRoomStatus(db, roomId, status) {
  if (!CALL_ROOM_STATUSES.includes(status)) throw new Error('Unsupported call status');
  await updateDoc(doc(db, 'callRooms', roomId), { status, updatedAt: serverTimestamp() });
}

export async function publishIceCandidate(db, roomId, ownerUid, candidate) {
  const owner = assertUid(ownerUid, 'ownerUid');
  await addDoc(collection(db, 'callRooms', roomId, 'candidates'), {
    ownerUid: owner,
    ...serializeCandidate(candidate),
    createdAt: serverTimestamp(),
  });
}

export function watchIceCandidates(db, roomId, remoteUid, onCandidate, onError) {
  const ownerUid = assertUid(remoteUid, 'remoteUid');
  return onSnapshot(
    query(collection(db, 'callRooms', roomId, 'candidates'), where('ownerUid', '==', ownerUid)),
    (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') onCandidate(change.doc.data());
      });
    },
    onError,
  );
}
