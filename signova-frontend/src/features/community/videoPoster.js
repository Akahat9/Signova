export function createVideoPosterBlob(file, options = {}) {
  const maximumWidth = options.maximumWidth || 960;
  const quality = options.quality || 0.82;
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const objectUrl = URL.createObjectURL(file);
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(objectUrl);
      callback(value);
    };
    video.muted = true;
    video.preload = 'metadata';
    video.playsInline = true;
    video.onerror = () => finish(reject, new Error('Video poster could not be generated'));
    video.onloadedmetadata = () => { video.currentTime = Math.min(Math.max(0, video.duration * 0.12), 1); };
    video.onseeked = () => {
      const sourceWidth = video.videoWidth || 1;
      const sourceHeight = video.videoHeight || 1;
      const scale = Math.min(1, maximumWidth / sourceWidth);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(sourceWidth * scale));
      canvas.height = Math.max(1, Math.round(sourceHeight * scale));
      const context = canvas.getContext('2d');
      if (!context) return finish(reject, new Error('Canvas is unavailable'));
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (blob) finish(resolve, blob);
        else finish(reject, new Error('Video poster encoding failed'));
      }, 'image/jpeg', quality);
    };
    video.src = objectUrl;
  });
}
