# VirtualTours

PWA en español para crear, editar y visualizar recorridos panorámicos 360° de casas, edificios y lugares visitados. La aplicación usa Pannellum y se sirve como archivos estáticos.

## Ejecutar

Requiere Node.js 22 o posterior.

```sh
npm ci
npm test
npm run build
npm run preview
```

Abre [http://localhost:4173/VirtualTours/](http://localhost:4173/VirtualTours/). La compilación está en `dist/`. El servidor de previsualización se usa durante el desarrollo. GitHub Pages sirve directamente el resultado de la compilación.

## Crear un recorrido

1. Exporta desde Insta360 Studio o la app Insta360 como vídeo 360° equirectangular 2:1 en MP4. H.264 ofrece mayor compatibilidad de reproducción. El navegador comprueba que puede leer el archivo y que mide al menos 512 píxeles de ancho.
2. En **Crear recorrido**, introduce el título, la descripción, el tipo y una portada opcional.
3. En **Espacios del recorrido**, sube los vídeos 360° directamente, ponles nombre y ordénalos. También puedes seguir usando fotos panorámicas JPEG, PNG o WebP.
4. En **Conexiones**, elige el espacio de destino, pulsa **Añadir punto** y selecciona su posición en la panorámica.
5. Abre el visor o publica el recorrido localmente para encontrarlo en **Explorar**.

Los borradores, vídeos y fotos se guardan con IndexedDB en el dispositivo y perfil del navegador donde se crearon. La capacidad está sujeta a la cuota y política del navegador. **Exportar archivo** genera una copia que puedes guardar o enviar. Para clips largos o de alta resolución, usa **Descargar MP4** en Espacios del recorrido para recuperar cada original sin convertirlo o envolverlo en JSON. El destinatario de una exportación JSON puede abrirla mediante **Mis recorridos → Importar archivo**.

## GitHub Pages y enlaces públicos

En el repositorio de GitHub abre **Settings → Pages** y elige **GitHub Actions** como fuente. El workflow se ejecuta al actualizar `main` o desde la pestaña **Actions**. GitHub muestra la URL tras el despliegue.

El catálogo público se gestiona con los archivos estáticos del sitio. Si quieres publicar un recorrido en ese catálogo, exporta su archivo y añade el contenido con el siguiente comando. Las fotografías del recorrido pasarán a ser públicas al publicar estos cambios.

```sh
npm run catalogo -- mi-recorrido ruta/al/recorrido.virtualtours.json
```

Revisa y publica el cambio de `catalog.json` en `main`. El recorrido aparecerá en **Explorar** y podrá abrirse desde la ruta `#publico/mi-recorrido`. En el visor público, **Compartir enlace** copia la dirección del espacio actual. Este mecanismo es provisional y está pensado para un catálogo pequeño.

La aplicación se puede instalar desde navegadores compatibles. En iPhone, abre el sitio con Safari y utiliza **Compartir → Añadir a pantalla de inicio**. Tras la primera carga, el service worker guarda la aplicación para uso sin conexión.

## Arquitectura

- `src/tour.js` contiene el modelo de recorridos, conexiones y formato de intercambio.
- `src/storage.js` proporciona la interfaz de persistencia local. Una futura integración puede implementar el mismo contrato con Firestore para metadatos, Storage para multimedia y Authentication para acceso.
- `src/es.js` centraliza la navegación, las categorías y las etapas del asistente. El resto de los textos de interfaz está en español y puede extraerse al incorporar otro idioma.
- El editor de vídeo futuro puede incorporarse como módulo de procesamiento independiente con entrada y salida de archivos. La vista previa reproduce los clips 360° exportados de la cámara. La generación de recorridos mediante GPU aún requiere una integración que reciba esos originales y procese los clips. La investigación de eliminación del camarógrafo queda pendiente de las pruebas A y B de Insta360 X4.

Fotografía de la pantalla de inicio disponible en [Unsplash](https://images.unsplash.com/photo-1470770841072-f978cf4d019e).
