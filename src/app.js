import { categories, navigation, stages } from './es.js';
import { toursRepository } from './storage.js';
import { duplicateTour, exportTour, imageDimensionsAreValid, importTour, newTour, removeSpace } from './tour.js';

const app = document.querySelector('#app');
const status = document.querySelector('#status');
const categoryIcons = {
  casa: '<path d="M2 11 12 3l10 8M5 9v12h14V9M10 21v-7h4v7"/>',
  edificio: '<path d="M3 21h18M5 21V3h14v18M10 21v-4h4v4M9 7h1m4 0h1m-6 4h1m4 0h1"/>',
  lugar: '<path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
};
const imageTypes = ['image/jpeg', 'image/png', 'image/webp'];
const urls = new Map();
let tours = [];
let draft;
const editorRoutes = ['editar', 'espacios', 'conexiones', 'publicacion'];
let stage = 0;
let selectedSpace;
let selectedLink;
let placing = false;
let viewer;
let activeTour;
let history = [];
const initialZoom = 100;
let statusTimer;
let busy = false;
let catalog = [];

const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);
const link = (href, label, style = 'button') => `<a class="${style}" href="#${href}">${label}</a>`;
const button = (action, label, style = 'secondary', value = '') =>
  `<button type="button" class="button ${style}" data-action="${action}" data-value="${escape(value)}">${label}</button>`;

function categoryIcon(category) {
  return `<svg class="category-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"
    fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${categoryIcons[category]}</svg>`;
}

function imageUrl(blob) {
  if (!blob) return '';
  if (!urls.has(blob)) urls.set(blob, URL.createObjectURL(blob));
  return urls.get(blob);
}

function cover(tour) {
  const url = imageUrl(tour.cover || tour.spaces[0]?.image);
  return url ? `<img src="${url}" alt="" loading="lazy">` : `<span class="placeholder" aria-hidden="true">${categoryIcon(tour.category)}</span>`;
}

function announce(message) {
  clearTimeout(statusTimer);
  status.textContent = message;
  statusTimer = setTimeout(() => { status.textContent = ''; }, 5000);
}

function header(route) {
  return `<header class="topbar">
    <a href="#inicio" class="brand"><img src="./assets/logo.svg" alt="">VirtualTours</a>
    <nav aria-label="Navegación principal">${Object.entries(navigation).map(([id, name]) =>
      `<a href="#${id}" ${route === id ? 'aria-current="page"' : ''}>${name}</a>`).join('')}</nav>
  </header>`;
}

function home() {
  return `<main class="hero">
    <img class="hero-logo" src="./assets/logo.svg" alt="">
    <h1>VirtualTours</h1>
    <p class="subtitle">Recorridos virtuales 360°</p>
    <p>Explora casas, edificios y los lugares que visites.</p>
    <div class="categories hero-categories">${Object.entries(categories).map(([id, label]) =>
      link(`explorar/${id}`, `${categoryIcon(id)}${label}`, 'category')).join('')}</div>
    <div class="hero-actions">
      ${link('crear', 'Crear recorrido ＋', 'button primary')}
      ${link('explorar', 'Explorar recorridos ⌕', 'button glass')}
    </div>
  </main>`;
}

function card(tour, editing) {
  const route = tour.publicKey ? `publico/${tour.publicKey}` : `ver/${tour.id}`;
  return `<article class="card" data-title="${escape(`${tour.title} ${tour.description}`.toLowerCase())}" data-category="${tour.category}">
    <a href="#${editing ? 'editar/' + tour.id : route}" class="card-image" aria-label="${escape(tour.title)}">${cover(tour)}</a>
    <div class="card-info"><div><a class="card-title" href="#${editing ? 'editar/' + tour.id : route}">
      ${categoryIcon(tour.category)} ${escape(tour.title)}</a>
      <small>${categories[tour.category]} · ${tour.spaces.length} espacios${editing && tour.published ? ' · Publicado localmente' : ''}</small>
    </div>${editing ? `<details class="menu"><summary aria-label="Opciones de ${escape(tour.title)}">⋮</summary><div>
      ${link('espacios/' + tour.id, 'Gestionar espacios 360°', 'menu-link')}
      ${tour.spaces.length ? [
        link('conexiones/' + tour.id, 'Conectar espacios', 'menu-link'),
        link(route, 'Abrir visor 360°', 'menu-link'),
        link('mapa/' + tour.id, 'Mapa del recorrido', 'menu-link'),
        link('publicacion/' + tour.id, 'Publicación', 'menu-link'),
      ].join('') : ''}
      ${button('duplicate', 'Duplicar', 'text-button', tour.id)}
      ${button('export', 'Exportar archivo', 'text-button', tour.id)}
      ${button('remove', 'Eliminar', 'text-button danger', tour.id)}
    </div></details>` : ''}</div>
  </article>`;
}

function listing(editing, category = '') {
  const entries = editing ? tours : [...catalog, ...tours.filter(tour => tour.published)];
  return `<main class="panel listing-panel">
    <div class="heading"><h1>${editing ? 'Mis recorridos' : 'Explorar recorridos'}</h1>
      ${editing ? `<div class="actions">${button('import', 'Importar archivo')}${link('crear', '＋ Crear recorrido', 'button primary')}</div>` : ''}
    </div>
    <p class="muted">${editing ? 'Abre el menú ⋮ de cada recorrido para gestionar espacios, conexiones, visor y mapa. Los archivos se guardan en este navegador.' : 'Explora los recorridos del catálogo y los publicados en este navegador.'}</p>
    <div class="filters">
      <input type="search" id="search" placeholder="Buscar recorridos…" aria-label="Buscar recorridos">
      <select id="filter" aria-label="Filtrar por categoría"><option value="">Todas las categorías</option>
      ${Object.entries(categories).map(([id, label]) => `<option value="${id}" ${id === category ? 'selected' : ''}>${label}</option>`).join('')}</select>
    </div>
    <input type="file" id="import-file" accept=".json,application/json" hidden>
    <div class="grid">${entries.map(tour => card(tour, editing)).join('')}</div>
    <div id="empty" class="empty" hidden>
      ${entries.length ? 'No se encontraron recorridos con esos filtros.' : editing
        ? 'Aún no tienes recorridos. Crea uno para empezar.' : 'Aún no hay recorridos publicados en esta categoría.'}
    </div>
  </main>`;
}

function information() {
  return `<form id="information">
    <label for="title">Título del recorrido</label>
    <input id="title" name="title" required maxlength="120" placeholder="Ej. Mi casa, Oficina, Paseo por Punta Cana" value="${escape(draft.title)}">
    <fieldset><legend>Tipo de recorrido</legend><div class="categories">
      ${Object.entries(categories).map(([id, name]) => `<label class="category">
        <input type="radio" name="category" value="${id}" ${draft.category === id ? 'checked' : ''}>
        ${categoryIcon(id)}${name}</label>`).join('')}
    </div></fieldset>
    <label for="description">Descripción</label>
    <textarea id="description" name="description" maxlength="2000" rows="4" placeholder="Describe tu recorrido…">${escape(draft.description)}</textarea>
    <label for="cover">Imagen de portada</label>
    <input id="cover" name="cover" type="file" accept="image/jpeg,image/png,image/webp">
    <p class="muted">${draft.cover ? 'Hay una portada guardada. Puedes sustituirla.' : 'Si omites la portada, se usará la primera foto 360°.'}</p>
    <div class="form-actions">${link('recorridos', 'Cancelar', 'button secondary')}<button class="button primary">Siguiente →</button></div>
  </form>`;
}

function spaces() {
  return `<div class="heading"><h1>Espacios del recorrido</h1>${button('upload', '＋ Agregar espacio 360°', 'primary')}</div>
    <input id="panoramas" type="file" accept="image/jpeg,image/png,image/webp" multiple hidden>
    <p class="muted">Sube fotos equirectangulares 2:1 exportadas desde Insta360 Studio o la app Insta360. Formatos JPEG, PNG y WebP.</p>
    <ol class="space-list">${draft.spaces.map((space, index) => `<li>
      <img src="${imageUrl(space.image)}" alt="">
      <div class="space-name"><strong>${escape(space.name)}</strong><small>${escape(space.filename)}</small></div>
      <div class="actions">
        ${index > 0 ? button('up', '↑ <span class="sr-only">Subir</span>', 'icon', space.id) : ''}
        ${index < draft.spaces.length - 1 ? button('down', '↓ <span class="sr-only">Bajar</span>', 'icon', space.id) : ''}
        ${button('preview', 'Ver', 'icon', space.id)}
        ${button('rename', 'Editar', 'icon', space.id)}
        ${button('remove-space', 'Eliminar', 'icon danger', space.id)}
      </div></li>`).join('')}</ol>
    ${draft.spaces.length ? '' : '<div class="empty">Agrega la primera foto panorámica para continuar.</div>'}`;
}

function connections() {
  const space = draft.spaces.find(item => item.id === selectedSpace) || draft.spaces[0];
  if (!space) return '<div class="empty">Agrega al menos un espacio para abrir el editor.</div>';
  selectedSpace = space.id;
  const targets = draft.spaces.filter(item => item.id !== space.id);
  const current = space.links.find(item => item.id === selectedLink);
  return `<h1>Conectar espacios</h1>
    <p class="muted">${targets.length ? 'Elige el destino y coloca el punto sobre la puerta o el paso en la panorámica.' : 'Agrega otro espacio para crear una conexión.'}</p>
    <div id="panorama" class="panorama editor" aria-label="Editor panorámico"></div>
    ${spaceStrip(draft, space.id, 'select-space')}
    ${targets.length ? `<div class="connection-controls">
      <label for="connection">Punto interactivo</label>
      <select id="connection"><option value="">Nuevo punto</option>
      ${space.links.map((point, index) => `<option value="${point.id}" ${point.id === current?.id ? 'selected' : ''}>${index + 1}. ${escape(targets.find(item => item.id === point.target)?.name)}</option>`).join('')}
      </select>
      <label for="target">Destino</label>
      <select id="target">${targets.map(item => `<option value="${item.id}" ${item.id === current?.target ? 'selected' : ''}>${escape(item.name)}</option>`).join('')}</select>
      ${button('place', current ? 'Mover punto' : 'Añadir punto', 'primary')}
      ${current ? button('save-target', 'Guardar destino') + button('delete-link', 'Eliminar punto', 'secondary danger') : ''}
    </div>` : ''}`;
}

function publication() {
  return `<h1>Publicación</h1>
    <div class="publication">${cover(draft)}<div><h3>${escape(draft.title)}</h3>
      <p>${categories[draft.category]} · ${draft.spaces.length} espacios</p>
      <p>${escape(draft.description)}</p></div></div>
    <p class="muted">La publicación local añade el recorrido a Explorar en este navegador. Exporta el archivo para compartirlo con otra persona, que puede abrirlo con Importar archivo.</p>
    <div class="actions">
      ${button('publish', draft.published ? 'Retirar de Explorar' : 'Publicar en este navegador', 'primary')}
      ${button('export', 'Exportar archivo', 'secondary', draft.id)}
      ${link('ver/' + draft.id, 'Abrir visor', 'button secondary')}
    </div>`;
}

function wizard() {
  const saved = tours.some(tour => tour.id === draft.id);
  return `<main class="panel wizard">
    ${stage === 0 ? `<h1>${saved ? 'Editar recorrido' : 'Crear recorrido'}</h1>` : ''}
    <nav aria-label="Etapas del recorrido"><ol class="steps">${stages.map((name, index) => {
      const label = `<span>${index + 1}</span>${name}`;
      const available = saved && stage !== index && (index < 2 || draft.spaces.length);
      return `<li class="${index === stage ? 'active' : ''}" ${index === stage ? 'aria-current="step"' : ''}>
        ${available ? link(editorRoutes[index] + '/' + draft.id, label, 'step-link') : `<div class="step-link">${label}</div>`}</li>`;
    }).join('')}</ol></nav>
    ${stage ? `<p class="editor-context">${escape(draft.title)}</p>` : ''}
    ${[information, spaces, connections, publication][stage]()}
    ${stage ? `<div class="form-actions">${link(editorRoutes[stage - 1] + '/' + draft.id, '← Anterior', 'button secondary')}
      ${stage === 3 ? link('recorridos', 'Mis recorridos', 'button secondary') : button('next', 'Siguiente →', 'primary')}</div>` : ''}
  </main>`;
}

function spaceStrip(tour, id, action) {
  return `<div class="space-strip" aria-label="Espacios del recorrido">${tour.spaces.map(space =>
    `<button type="button" data-action="${action}" data-value="${space.id}" aria-pressed="${space.id === id}">
      <img src="${imageUrl(space.image)}" alt=""><span>${escape(space.name)}</span>
    </button>`).join('')}</div>`;
}

function tourViewer(tour, space) {
  return `<main class="viewer-frame" id="viewer-frame">
    <div class="viewer-heading"><div><h1>${escape(tour.title)}</h1><span>${escape(space.name)} · 360°</span></div>
      <div class="actions">${tour.publicKey ? '' : link('espacios/' + tour.id, 'Editar espacios', 'button glass')}
      ${button('fullscreen', '⛶ <span class="sr-only">Pantalla completa</span>', 'glass')}</div></div>
    <div id="panorama" class="panorama" aria-label="Panorámica de ${escape(space.name)}"></div>
    <div class="viewer-controls">
      ${button('map', '▥ Mapa', 'glass')}${button('show-spaces', '▦ Espacios', 'glass')}
      ${button('previous-space', '← <span class="sr-only">Espacio anterior</span>', 'glass')}
      ${button('next-space', '→ <span class="sr-only">Espacio siguiente</span>', 'glass')}
      ${button('zoom-in', '＋ <span class="sr-only">Acercar</span>', 'glass')}
      ${button('zoom-out', '− <span class="sr-only">Alejar</span>', 'glass')}
      ${tour.publicKey ? button('share', 'Compartir enlace', 'glass') : ''}
    </div>
    <div id="viewer-spaces" hidden>${spaceStrip(tour, space.id, 'open-space')}</div>
  </main>`;
}

function map(tour, space) {
  const columns = Math.min(4, Math.ceil(Math.sqrt(tour.spaces.length)));
  const positions = new Map(tour.spaces.map((item, index) => [item.id, {
    x: 82 + (index % columns) * 144, y: 66 + Math.floor(index / columns) * 126,
  }]));
  const edges = tour.spaces.flatMap(item => item.links.map(point => {
    const from = positions.get(item.id);
    const to = positions.get(point.target);
    if (!to) return '';
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    return `<span class="edge" style="left:${from.x}px;top:${from.y}px;width:${length}px;transform:rotate(${angle}rad)"></span>`;
  })).join('');
  return `<main class="panel"><div class="heading"><h1>Mapa del recorrido: ${escape(tour.title)}</h1>
    ${button('open-space', 'Volver al visor', 'secondary', space.id)}</div>
    <p class="muted">Selecciona un espacio para abrirlo en el visor.</p>
    <div class="map-layout"><ul>${tour.spaces.map(item => `<li>${button('open-space', escape(item.name), item.id === space.id ? 'primary' : 'secondary', item.id)}</li>`).join('')}</ul>
    <div class="map-scroll"><div class="diagram" style="width:${columns * 144 + 20}px;height:${Math.ceil(tour.spaces.length / columns) * 126 + 15}px">
      ${edges}${tour.spaces.map(item => {
        const { x, y } = positions.get(item.id);
        return `<button type="button" class="node ${item.id === space.id ? 'current' : ''}" style="left:${x}px;top:${y}px"
          data-action="open-space" data-value="${item.id}"><img src="${imageUrl(item.image)}" alt=""><span>${escape(item.name)}</span></button>`;
      }).join('')}</div></div></div></main>`;
}

function help() {
  return `<main class="panel"><h1>Ayuda y configuración</h1><div class="help-layout">
    <nav aria-label="Secciones de ayuda">${link('ayuda', 'Guía rápida', 'button secondary')}${link('ayuda/controles', 'Controles 360°', 'button secondary')}${link('ayuda/configuracion', 'Configuración', 'button secondary')}</nav>
    <div class="help-content">${{
      controles: '<h2>Controles 360°</h2><p>Arrastra para mirar alrededor con el mouse o con un dedo. Usa la rueda, un gesto de pellizco o los botones de zoom para acercar y alejar. Con el panorama enfocado puedes usar las flechas del teclado.</p><p>Selecciona los puntos azules para pasar a otro espacio. También puedes usar las flechas de navegación, el mapa y la lista de espacios.</p>',
      configuracion: '<h2>Configuración</h2><label for="language">Idioma</label><select id="language"><option>Español</option></select><h3>Instalación</h3><p>En Chrome o Edge, usa Instalar desde el menú del navegador. En iPhone, abre Safari y elige Compartir → Añadir a pantalla de inicio.</p><h3>Almacenamiento local</h3><p>Exporta tus recorridos desde Mis recorridos antes de borrar los datos del navegador o cambiar de dispositivo.</p>',
    }[routeParts()[1]] || '<h2>Guía rápida</h2><ol><li>Crea un recorrido y elige una categoría.</li><li>Exporta las fotos cosidas de Insta360 como panoramas equirectangulares 2:1.</li><li>Sube las fotos 360° y asigna un nombre a cada espacio.</li><li>Conecta los espacios mediante puntos interactivos.</li><li>Publica localmente o exporta un archivo para compartir.</li></ol>'}</div>
    </div></main>`;
}

function routeParts() {
  return (location.hash.slice(1) || 'inicio').split('/');
}

function cleanViewer() {
  viewer?.destroy();
  viewer = undefined;
  for (const url of urls.values()) URL.revokeObjectURL(url);
  urls.clear();
}

function showPanorama(tour, space, editing = false) {
  if (!window.pannellum) {
    document.querySelector('#panorama').textContent = 'No se pudo cargar el visor 360°.';
    return;
  }
  const hotspots = space.links.filter(point => tour.spaces.some(item => item.id === point.target));
  viewer = window.pannellum.viewer('panorama', {
    type: 'equirectangular',
    panorama: imageUrl(space.image),
    autoLoad: true,
    showFullscreenCtrl: false,
    showZoomCtrl: editing,
    hfov: initialZoom,
    hotSpots: hotspots.map(point => ({
      pitch: point.pitch,
      yaw: point.yaw,
      type: 'info',
      cssClass: 'tour-hotspot',
      createTooltipFunc(element) {
        const control = document.createElement('button');
        control.type = 'button';
        control.textContent = editing ? '●' : '↑';
        control.setAttribute('aria-label', tour.spaces.find(item => item.id === point.target).name);
        control.title = control.getAttribute('aria-label');
        element.append(control);
      },
      clickHandlerFunc(event) {
        event.stopPropagation();
        if (editing) {
          selectedLink = point.id;
          render();
        } else {
          goToSpace(point.target);
        }
      },
    })),
  });
  if (editing) {
    let pointerStart;
    let pointerEnd;
    const container = viewer.getContainer();
    container.addEventListener('pointerdown', event => { pointerStart = [event.clientX, event.clientY]; });
    container.addEventListener('pointerup', event => { pointerEnd = [event.clientX, event.clientY]; });
    container.addEventListener('click', event => {
      if (!placing || !viewer?.isLoaded() || !pointerStart || !pointerEnd || event.target.closest('button, .pnlm-controls-container')
          || Math.hypot(pointerEnd[0] - pointerStart[0], pointerEnd[1] - pointerStart[1]) > 6) return;
      const [pitch, yaw] = viewer.mouseEventToCoords(event);
      const target = document.querySelector('#target').value;
      perform(async () => {
        await changeDraft(updated => {
          const current = updated.spaces.find(item => item.id === space.id);
          const point = current.links.find(item => item.id === selectedLink);
          if (point) Object.assign(point, { pitch, yaw, target });
          else current.links.push({ id: crypto.randomUUID(), pitch, yaw, target });
        });
        placing = false;
        render();
      });
    });
  }
}

function render() {
  cleanViewer();
  const [screen, id, spaceId] = routeParts();
  let content;
  let panorama;
  let nav = screen;
  if (screen === 'inicio') content = home();
  if (screen === 'recorridos' || screen === 'explorar') content = listing(screen === 'recorridos', id);
  if (screen === 'ayuda') content = help();
  if (editorRoutes.includes(screen) && !draft) {
    content = '<main class="panel"><h1>Recorrido no disponible</h1><p>Selecciona un recorrido guardado en este navegador.</p>'
      + link('recorridos', 'Mis recorridos', 'button secondary') + '</main>';
  }
  if ((screen === 'crear' || editorRoutes.includes(screen)) && draft) {
    nav = 'recorridos';
    content = wizard();
    if (stage === 2 && selectedSpace) panorama = [draft, draft.spaces.find(item => item.id === selectedSpace), true];
  }
  if (['ver', 'mapa', 'publico', 'mapa-publico'].includes(screen)) {
    const publicRoute = ['publico', 'mapa-publico'].includes(screen);
    const tour = publicRoute ? catalog.find(item => item.publicKey === id) : tours.find(item => item.id === id);
    const space = tour?.spaces.find(item => item.id === spaceId) || tour?.spaces[0];
    if (space) {
      activeTour = tour;
      selectedSpace = space.id;
      if (screen.startsWith('mapa')) content = map(tour, space);
      else { content = tourViewer(tour, space); panorama = [tour, space]; }
    } else {
      content = '<main class="panel"><h1>Recorrido no disponible</h1><p>Abre un recorrido del catálogo o importa su archivo en Mis recorridos.</p>' + link('recorridos', 'Mis recorridos') + '</main>';
    }
  }
  const frame = document.querySelector('#viewer-frame');
  const keepFrame = panorama && !panorama[2] && frame
    && (document.fullscreenElement === frame || frame.classList.contains('immersive'));
  if (keepFrame) {
    const template = document.createElement('template');
    template.innerHTML = content;
    frame.replaceChildren(...template.content.firstElementChild.childNodes);
  } else {
    app.innerHTML = header(nav) + (content || home());
  }
  if (panorama) showPanorama(...panorama);
  applyFilters();
}

function applyFilters() {
  const search = document.querySelector('#search');
  if (!search) return;
  const category = document.querySelector('#filter').value;
  const query = search.value.trim().toLowerCase();
  const cards = [...document.querySelectorAll('.card')];
  for (const item of cards) item.hidden = !item.dataset.title.includes(query) || Boolean(category && category !== item.dataset.category);
  document.querySelector('#empty').hidden = cards.some(item => !item.hidden);
}

function onRoute() {
  const [screen, id] = routeParts();
  const key = `${screen}/${id || ''}`;
  if (key !== onRoute.key) {
    if (screen === 'crear') draft = newTour();
    if (editorRoutes.includes(screen)) {
      const tour = tours.find(item => item.id === id);
      draft = tour && structuredClone(tour);
      if (draft && editorRoutes.indexOf(screen) > 1 && !draft.spaces.length) {
        location.replace('#espacios/' + id);
        return;
      }
    }
    if (screen === 'crear' || editorRoutes.includes(screen)) {
      stage = screen === 'crear' ? 0 : editorRoutes.indexOf(screen);
      selectedSpace = undefined;
      selectedLink = undefined;
      placing = false;
    }
    if (!['ver', 'publico', 'mapa', 'mapa-publico'].includes(screen) || activeTour?.id !== id && activeTour?.publicKey !== id) {
      history = [];
    }
    onRoute.key = key;
  }
  render();
}

async function save(tour) {
  await toursRepository.save(tour);
  const index = tours.findIndex(item => item.id === tour.id);
  if (index < 0) tours.unshift(structuredClone(tour));
  else tours[index] = structuredClone(tour);
}

async function changeDraft(update) {
  const updated = structuredClone(draft);
  update(updated);
  await save(updated);
  if (draft?.id === updated.id) draft = updated;
}

async function validateImage(file, panorama) {
  if (!imageTypes.includes(file.type)) throw new Error(`${file.name}: usa JPEG, PNG o WebP.`);
  const bitmap = await createImageBitmap(file).catch(() => { throw new Error(`${file.name}: no se pudo leer la imagen.`); });
  try {
    if (panorama && !imageDimensionsAreValid(bitmap.width, bitmap.height)) {
      throw new Error(`${file.name}: se requiere un panorama 2:1 de al menos 512 px de ancho.`);
    }
  } finally {
    bitmap.close();
  }
}

function perform(operation) {
  if (busy) return;
  busy = true;
  Promise.resolve().then(operation).catch(error => {
    console.error(error);
    announce(error.name === 'QuotaExceededError' ? 'El navegador se quedó sin espacio. Exporta o elimina recorridos para liberar almacenamiento.' : error.message || 'No se pudo completar la operación.');
  }).finally(() => { busy = false; });
}

function goToSpace(id, record = true) {
  if (!activeTour?.spaces.some(item => item.id === id)) return;
  if (record && selectedSpace && selectedSpace !== id) history.push(selectedSpace);
  const route = activeTour.publicKey ? 'publico/' + activeTour.publicKey : 'ver/' + activeTour.id;
  location.hash = `${route}/${id}`;
}

function moveSpace(offset) {
  if (offset < 0 && history.length) {
    goToSpace(history.pop(), false);
    return;
  }
  const index = activeTour.spaces.findIndex(item => item.id === selectedSpace);
  const next = activeTour.spaces[(index + offset + activeTour.spaces.length) % activeTour.spaces.length];
  goToSpace(next.id, offset > 0);
}

function download(data, name) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

app.addEventListener('submit', event => {
  if (event.target.id !== 'information') return;
  event.preventDefault();
  const form = new FormData(event.target);
  perform(async () => {
    const title = form.get('title').trim();
    if (!title) throw new Error('Escribe el título del recorrido.');
    const file = form.get('cover');
    if (file.size) await validateImage(file, false);
    await changeDraft(updated => {
      Object.assign(updated, { title, description: form.get('description').trim(), category: form.get('category') });
      if (file.size) updated.cover = file;
    });
    location.hash = 'espacios/' + draft.id;
  });
});

app.addEventListener('input', applyFilters);
app.addEventListener('change', event => {
  const input = event.target;
  if (input.id === 'connection') {
    selectedLink = input.value;
    placing = false;
    render();
  }
  if (input.id === 'panoramas') perform(async () => {
    const errors = [];
    const valid = [];
    for (const file of input.files) {
      try {
        await validateImage(file, true);
        valid.push({ id: crypto.randomUUID(), name: file.name.replace(/\.[^.]+$/, ''), filename: file.name, image: file, links: [] });
      } catch (error) {
        errors.push(error.message);
      }
    }
    if (valid.length) {
      await changeDraft(updated => updated.spaces.push(...valid));
    }
    render();
    announce([valid.length ? `${valid.length} espacios agregados.` : '', ...errors].filter(Boolean).join(' '));
  });
  if (input.id === 'import-file' && input.files.length) perform(async () => {
    const tour = importTour(JSON.parse(await input.files[0].text()));
    for (const space of tour.spaces) {
      await validateImage(new File([space.image], space.filename || space.name, { type: space.image.type }), true);
    }
    await save(tour);
    render();
    announce('Recorrido importado.');
  });
});

const actions = {
  import: () => document.querySelector('#import-file').click(),
  upload: () => document.querySelector('#panoramas').click(),
  async duplicate(id) {
    await save(duplicateTour(tours.find(item => item.id === id)));
    render();
    announce('Recorrido duplicado.');
  },
  async remove(id) {
    if (!confirm('¿Eliminar este recorrido y sus espacios de este navegador?')) return;
    await toursRepository.remove(id);
    tours = tours.filter(item => item.id !== id);
    render();
    announce('Recorrido eliminado.');
  },
  async export(id) {
    const tour = tours.find(item => item.id === id);
    download(await exportTour(tour), `${tour.title.replace(/[^\p{L}\p{N} -]/gu, '_')}.virtualtours.json`);
  },
  next() {
    if (!draft.spaces.length) throw new Error('Agrega al menos un espacio 360° para continuar.');
    location.hash = editorRoutes[stage + 1] + '/' + draft.id;
  },
  'select-space'(id) { selectedSpace = id; selectedLink = undefined; placing = false; render(); },
  preview(id) { location.hash = `ver/${draft.id}/${id}`; },
  async rename(id) {
    const space = draft.spaces.find(item => item.id === id);
    const name = prompt('Nombre del espacio', space.name)?.trim();
    if (!name) return;
    await changeDraft(updated => { updated.spaces.find(item => item.id === id).name = name.slice(0, 120); });
    render();
  },
  async 'remove-space'(id) {
    if (!confirm('¿Eliminar este espacio y sus conexiones?')) return;
    await changeDraft(updated => {
      removeSpace(updated, id);
      if (!updated.spaces.length) updated.published = false;
    });
    render();
  },
  async reorder(id, offset) {
    await changeDraft(updated => {
      const index = updated.spaces.findIndex(item => item.id === id);
      const [space] = updated.spaces.splice(index, 1);
      updated.spaces.splice(index + offset, 0, space);
    });
    render();
  },
  up: id => actions.reorder(id, -1),
  down: id => actions.reorder(id, 1),
  place() {
    placing = true;
    document.querySelector('#panorama').classList.add('placing');
    announce('Toca o haz clic donde quieras colocar el punto.');
  },
  async 'save-target'() {
    const target = document.querySelector('#target').value;
    await changeDraft(updated => {
      const point = updated.spaces.find(item => item.id === selectedSpace).links.find(item => item.id === selectedLink);
      point.target = target;
    });
    placing = false;
    render();
  },
  async 'delete-link'() {
    await changeDraft(updated => {
      const space = updated.spaces.find(item => item.id === selectedSpace);
      space.links = space.links.filter(item => item.id !== selectedLink);
    });
    selectedLink = undefined;
    placing = false;
    render();
  },
  async publish() {
    await changeDraft(updated => { updated.published = !updated.published; });
    render();
    announce(draft.published ? 'Publicado en Explorar en este navegador.' : 'Retirado de Explorar.');
  },
  map() {
    const route = activeTour.publicKey ? 'mapa-publico/' + activeTour.publicKey : 'mapa/' + activeTour.id;
    location.hash = `${route}/${selectedSpace}`;
  },
  'show-spaces'() {
    const panel = document.querySelector('#viewer-spaces');
    panel.hidden = !panel.hidden;
  },
  'open-space': goToSpace,
  'previous-space': () => moveSpace(-1),
  'next-space': () => moveSpace(1),
  'zoom-in': () => viewer?.setHfov(viewer.getHfov() - 12),
  'zoom-out': () => viewer?.setHfov(viewer.getHfov() + 12),
  async fullscreen() {
    if (document.fullscreenElement) await document.exitFullscreen();
    else {
      const frame = document.querySelector('#viewer-frame');
      if (frame.requestFullscreen && document.fullscreenEnabled) await frame.requestFullscreen();
      else {
        frame.classList.toggle('immersive');
        viewer?.resize();
      }
    }
  },
  async share() {
    await navigator.clipboard.writeText(location.href);
    announce('Enlace copiado.');
  },
};

app.addEventListener('click', event => {
  const target = event.target.closest('button[data-action]');
  const action = actions[target?.dataset.action];
  if (!action) return;
  if (['import', 'upload'].includes(target.dataset.action)) action();
  else perform(() => action(target.dataset.value));
});

document.addEventListener('fullscreenchange', () => viewer?.resize());

try {
  tours = await toursRepository.list();
} catch (error) {
  announce('El navegador bloqueó el almacenamiento local.');
  console.error(error);
}
try {
  const response = await fetch('./catalog.json');
  if (response.ok) {
    const entries = await response.json();
    catalog = entries.map(({ key, tour }) => ({
      ...importTour(tour, { preserveSpaceIds: true }), publicKey: key,
    }));
  }
} catch (error) {
  console.error('No se pudo cargar el catálogo.', error);
}
window.addEventListener('hashchange', onRoute);
onRoute();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(console.error);
