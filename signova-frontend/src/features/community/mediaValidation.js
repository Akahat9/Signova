const SIGNATURE_BYTES = 16;

function startsWith(bytes, signature, offset = 0) {
  return signature.every((value, index) => bytes[offset + index] === value);
}

export function detectCommunityMediaType(bytes) {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return 'image/webp';
  if (startsWith(bytes, [0x66, 0x74, 0x79, 0x70], 4)) return 'video/mp4';
  if (startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3])) return 'video/webm';
  return '';
}

function readBlobBytes(blob) {
  if (typeof blob.arrayBuffer === 'function') return blob.arrayBuffer();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('Could not read media file'));
    reader.readAsArrayBuffer(blob);
  });
}

export async function validateCommunityMediaFile(file) {
  if (!file || typeof file.slice !== 'function') return { valid: false, detectedType: '', error: 'Invalid media file.' };
  const bytes = new Uint8Array(await readBlobBytes(file.slice(0, SIGNATURE_BYTES)));
  const detectedType = detectCommunityMediaType(bytes);
  if (!detectedType) return { valid: false, detectedType: '', error: 'Unsupported or unrecognized media file.' };
  if (file.type && file.type !== detectedType) {
    return { valid: false, detectedType, error: `File contents are ${detectedType}, not ${file.type}.` };
  }
  return { valid: true, detectedType, error: '' };
}
