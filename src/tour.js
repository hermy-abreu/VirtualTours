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

export function imageDimensionsAreValid(width, height) {
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
    version: 1,
    cover: await fileAsDataURL(tour.cover),
    spaces: await Promise.all(tour.spaces.map(async space => ({
      ...space, image: await fileAsDataURL(space.image),
    }))),
  };
}

function decodeImage(value) {
  if (typeof value !== 'string' || !/^data:image\/(jpeg|png|webp);base64,[a-z\d+/=]+$/i.test(value)) {
    throw new Error('El archivo contiene una imagen incompatible.');
  }
  const [header, data] = value.split(',');
  return new Blob([Uint8Array.from(atob(data), char => char.charCodeAt(0))], {
    type: header.slice(5, -7),
  });
}

export function importTour(data, { preserveSpaceIds = false } = {}) {
  if (data?.version !== 1 || typeof data.title !== 'string' || !data.title.trim()
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
    cover: data.cover ? decodeImage(data.cover) : null,
    published: Boolean(data.published && data.spaces.length),
    spaces: data.spaces.map(space => ({
      id: ids.get(space.id),
      name: String(space.name || 'Espacio'),
      filename: String(space.filename || ''),
      image: decodeImage(space.image),
      links: (Array.isArray(space.links) ? space.links : [])
        .filter(link => ids.has(link.target) && link.target !== space.id
          && Number.isFinite(link.pitch) && Math.abs(link.pitch) <= 90
          && Number.isFinite(link.yaw) && Math.abs(link.yaw) <= 180)
        .map(link => ({ id: crypto.randomUUID(), target: ids.get(link.target), pitch: link.pitch, yaw: link.yaw })),
    })),
  };
}
