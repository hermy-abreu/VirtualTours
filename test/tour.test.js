import assert from 'node:assert/strict';
import test from 'node:test';
import { duplicateTour, panoramaDimensionsAreValid, importTour, newTour, removeSpace } from '../src/tour.js';

const dataImage = 'data:image/png;base64,AA==';
const bundle = {
  version: 1, title: 'Mi casa', category: 'casa', published: true,
  spaces: [
    { id: 'entrada', name: 'Entrada', image: dataImage, links: [{ target: 'sala', yaw: -15, pitch: 8 }] },
    { id: 'sala', name: 'Sala', image: dataImage },
  ],
};

test('valida los límites de panoramas equirectangulares', () => {
  assert.equal(panoramaDimensionsAreValid(8192, 4096), true);
  assert.equal(panoramaDimensionsAreValid(1024, 513), true);
  assert.equal(panoramaDimensionsAreValid(1024, 540), false);
  assert.equal(panoramaDimensionsAreValid(256, 128), false);
});

test('importa archivos con conexiones y conserva la clave de los espacios públicos', () => {
  const local = importTour(bundle);
  const published = importTour(bundle, { preserveSpaceIds: true });
  assert.equal(local.spaces[0].links[0].target, local.spaces[1].id);
  assert.notEqual(local.spaces[0].id, 'entrada');
  assert.equal(published.spaces[0].links[0].target, 'sala');
  assert.equal(published.spaces[0].image.type, 'image/png');
  assert.throws(() => importTour({ ...bundle, category: 'constructor' }), /VirtualTours/);
});

test('duplica proyectos como borradores y elimina conexiones a espacios borrados', () => {
  const original = importTour(bundle);
  const copy = duplicateTour(original);
  assert.notEqual(copy.id, original.id);
  assert.equal(copy.published, false);
  removeSpace(copy, copy.spaces[1].id);
  assert.deepEqual(copy.spaces[0].links, []);
  assert.equal(original.spaces[0].links.length, 1);
  assert.equal(newTour().published, false);
});
