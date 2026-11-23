import { categories } from './es.js';

export function newTour(category = 'casa') {
  return { id: crypto.randomUUID(), title: '', description: '', category, cover: null, spaces: [], published: false };
}

export function duplicateTour(tour, title = `${tour.title} (copia)`) {
  const copy = structuredClone(tour);
  return { ...copy, id: crypto.randomUUID(), title, published: false };
}

export function removeSpace(tour, id) {
  tour.spaces = tour.spaces.filter(space => space.id !== id);
  for (const space of tour.spaces) {
    space.links = space.links.filter(link => link.target !== id);
  }
}

export function panoramaDimensionsAreValid(width, height) {
  return width >= 512 && Math.abs(width - height * 2) <= 2;
}

function fileAsDataURL(file) {
  if (!file) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export async function exportTour(tour) {
  return {
    ...tour,
    version: tour.spaces.some(space => space.video) ? 2 : 1,
    cover: await fileAsDataURL(tour.cover),
    spaces: await Promise.all(tour.spaces.map(async space => ({
      ...space,
      ...(space.video
        ? { video: await fileAsDataURL(space.video) }
        : { image: await fileAsDataURL(space.image) }),
    }))),
  };
}

function decodeMedia(value, type) {
  const format = type === 'video' ? 'video/mp4' : 'image/(?:jpeg|png|webp)';
  const header = typeof value === 'string' && value.match(new RegExp(`^data:(${format});base64,`, 'i'));
  if (!header) throw new Error('El archivo contiene un formato multimedia incompatible.');
  const data = value.slice(header[0].length);
  if (!data) throw new Error('El archivo contiene un elemento multimedia vacío.');
  const bytes = typeof Uint8Array.fromBase64 === 'function'
    ? Uint8Array.fromBase64(data)
    : Uint8Array.from(atob(data), char => char.charCodeAt(0));
  return new Blob([bytes], { type: header[1] });
}

export function importTour(data, { preserveSpaceIds = false } = {}) {
  if (![1, 2].includes(data?.version) || typeof data.title !== 'string' || !data.title.trim()
      || !Array.isArray(data.spaces) || !Object.hasOwn(categories, data.category)) {
    throw new Error('Selecciona un archivo exportado desde VirtualTours.');
  }
  const ids = new Map(data.spaces.map(space => {
    if (!space || typeof space.id !== 'string' || !/^[a-z0-9-]+$/i.test(space.id)) {
      throw new Error('El archivo contiene un identificador de espacio incompatible.');
    }
    return [space.id, preserveSpaceIds ? space.id : crypto.randomUUID()];
  }));
  if (ids.size !== data.spaces.length) throw new Error('El archivo contiene espacios repetidos.');
  return {
    ...newTour(data.category),
    title: data.title,
    description: typeof data.description === 'string' ? data.description : '',
    cover: data.cover ? decodeMedia(data.cover, 'image') : null,
    published: Boolean(data.published && data.spaces.length),
    spaces: data.spaces.map(space => ({
      id: ids.get(space.id),
      name: String(space.name || 'Espacio'),
      filename: String(space.filename || ''),
      ...(data.version === 2 && space.video
        ? { video: decodeMedia(space.video, 'video') }
        : { image: decodeMedia(space.image, 'image') }),
      links: (Array.isArray(space.links) ? space.links : [])
        .filter(link => ids.has(link.target) && link.target !== space.id
          && Number.isFinite(link.pitch) && Math.abs(link.pitch) <= 90
          && Number.isFinite(link.yaw) && Math.abs(link.yaw) <= 180)
        .map(link => ({ id: crypto.randomUUID(), target: ids.get(link.target), pitch: link.pitch, yaw: link.yaw })),
    })),
  };
}
