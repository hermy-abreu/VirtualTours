import { panoramaDimensionsAreValid } from './tour.js';

export function videoSource(url, preload) {
  const video = document.createElement('video');
  video.playsInline = true;
  video.preload = preload;
  video.src = url;
  return video;
}

export function releaseVideo(video) {
  video.pause();
  video.removeAttribute('src');
  video.load();
  video.remove();
}

export async function validateVideo(file) {
  const url = URL.createObjectURL(file);
  const video = videoSource(url, 'metadata');
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`${file.name}: no se pudo leer el vídeo a tiempo.`)), 15000);
      video.addEventListener('loadedmetadata', () => {
        clearTimeout(timer);
        resolve();
      }, { once: true });
      video.addEventListener('error', () => {
        clearTimeout(timer);
        reject(new Error(`${file.name}: no se pudo leer el MP4. Prueba una exportación en H.264.`));
      }, { once: true });
    });
    if (!panoramaDimensionsAreValid(video.videoWidth, video.videoHeight)) {
      throw new Error(`${file.name}: se requiere un vídeo 360° equirectangular 2:1 de al menos 512 px de ancho.`);
    }
  } finally {
    releaseVideo(video);
    URL.revokeObjectURL(url);
  }
}
