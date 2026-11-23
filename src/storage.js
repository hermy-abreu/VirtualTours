const database = new Promise((resolve, reject) => {
  const request = indexedDB.open('virtualtours', 1);
  request.onupgradeneeded = () => request.result.createObjectStore('tours', { keyPath: 'id' });
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

async function run(mode, operation) {
  const db = await database;
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('tours', mode);
    const request = operation(transaction.objectStore('tours'));
    transaction.oncomplete = () => resolve(request.result);
    transaction.onabort = () => reject(transaction.error ?? request.error);
  });
}

export const toursRepository = {
  list: () => run('readonly', store => store.getAll()),
  save: tour => run('readwrite', store => store.put(tour)),
  remove: id => run('readwrite', store => store.delete(id)),
};
