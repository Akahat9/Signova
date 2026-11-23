import { useEffect, useRef, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { firestoreDb } from '../../firebase';
import { areContactsDuplicate, formatUniversalPhone } from './contactModel';
import { normalizeUsername } from '../auth/identityValidation';

export function useContactDirectoryLookup({ countryCode, number, username, contacts = [] }) {
  const [lookupStatus, setLookupStatus] = useState({
    loading: false,
    status: 'idle',
    tone: '',
    text: '',
    verifiedUser: null,
    duplicateContact: null,
  });

  const timerRef = useRef(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    const parsedPhone = formatUniversalPhone(countryCode, number);
    const cleanUsername = normalizeUsername(username);

    // 1. Instant duplicate check against in-memory contacts
    if (contacts.length > 0 && (parsedPhone.nationalNumber.length >= 7 || cleanUsername.length >= 3)) {
      const candidate = {
        username: cleanUsername,
        nationalNumber: parsedPhone.nationalNumber,
        number: parsedPhone.fullNumber,
        countryCode: parsedPhone.countryCode,
      };
      const duplicate = contacts.find((c) => areContactsDuplicate(c, candidate));
      if (duplicate) {
        const isUserMatch = cleanUsername && normalizeUsername(duplicate.username) === cleanUsername;
        const detail = isUserMatch
          ? `Username "${cleanUsername}"`
          : `Phone number "${parsedPhone.formattedNumber || parsedPhone.fullNumber}"`;
        setLookupStatus({
          loading: false,
          status: 'duplicate',
          tone: 'warning',
          text: `⚠️ ${detail} is already saved as "${duplicate.name}".`,
          verifiedUser: null,
          duplicateContact: duplicate,
        });
        return;
      }
    }

    const hasPhoneQuery = parsedPhone.nationalNumber.length >= 7;
    const hasUserQuery = cleanUsername.length >= 3;

    if (!hasPhoneQuery && !hasUserQuery) {
      setLookupStatus({
        loading: false,
        status: 'idle',
        tone: '',
        text: '',
        verifiedUser: null,
        duplicateContact: null,
      });
      return;
    }

    setLookupStatus((prev) => ({
      ...prev,
      loading: true,
      tone: 'searching',
      text: 'Checking Signova directory...',
    }));

    timerRef.current = setTimeout(async () => {
      if (!firestoreDb) {
        setLookupStatus({
          loading: false,
          status: 'idle',
          tone: '',
          text: '',
          verifiedUser: null,
          duplicateContact: null,
        });
        return;
      }

      let matchedData = null;

      if (hasPhoneQuery) {
        for (const key of parsedPhone.lookupKeys) {
          try {
            const snap = await getDoc(doc(firestoreDb, 'publicPhoneIdentities', key));
            if (snap.exists() && snap.data()?.username) {
              matchedData = snap.data();
              break;
            }
          } catch {
            // try next key
          }
        }
      }

      if (!matchedData && hasUserQuery) {
        try {
          const docKey = cleanUsername.startsWith('@') ? cleanUsername : `@${cleanUsername}`;
          const uSnap = await getDoc(doc(firestoreDb, 'publicUserIdentities', docKey));
          if (uSnap.exists() && uSnap.data()?.uid) {
            matchedData = uSnap.data();
          }
        } catch {
          // ignore
        }
      }

      if (matchedData) {
        setLookupStatus({
          loading: false,
          status: 'verified',
          tone: 'found',
          text: `✓ Verified Signova account: ${matchedData.username}${matchedData.name ? ` (${matchedData.name})` : ''}`,
          verifiedUser: matchedData,
          duplicateContact: null,
        });
      } else if (hasPhoneQuery && parsedPhone.nationalNumber.length >= 10) {
        setLookupStatus({
          loading: false,
          status: 'unregistered',
          tone: 'note',
          text: 'ℹ️ Unregistered Signova account · Direct call invitations available upon saving',
          verifiedUser: null,
          duplicateContact: null,
        });
      } else {
        setLookupStatus({
          loading: false,
          status: 'idle',
          tone: '',
          text: '',
          verifiedUser: null,
          duplicateContact: null,
        });
      }
    }, 250);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [countryCode, number, username, contacts]);

  return lookupStatus;
}
