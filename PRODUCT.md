# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

La app Android (`android/`) es la misma web dentro de un WebView, no un diseño nativo.

## Users

- **Cliente (usuario principal):** la marca que contrató a la agencia. Usa ContentSync sobre todo desde el celular, en la web o en la APK, para ver el contenido de su semana, revisarlo pieza por pieza, comentar, aprobar, pedir cambios o rechazar, y confirmar el cronograma. También propone ideas a su agencia.
- **Agencia:** el equipo de marketing o community manager. Arma los cronogramas semanales con bloques de contenido, sube fotos y videos, sigue el estado de producción, guarda ideas privadas por sección y responde las propuestas de sus clientes.
- **Administrador general:** gestiona agencias, clientes y los ajustes de la plataforma.

## Product Purpose

Que agencia y cliente se pongan de acuerdo sobre el contenido de cada semana en un solo lugar: lo que se va a publicar, en qué estado está y qué aprobó el cliente, sin cadenas de mensajes ni archivos sueltos. El éxito es que el cliente revise y apruebe rápido desde el teléfono y que la agencia sepa en todo momento qué falta.

El proyecto tiene dos destinos a la vez: es el proyecto final de la escuela, que se evalúa en una demo, y también está pensado para usarse en serio después de la entrega.

## Positioning

ContentSync organiza la revisión y aprobación del contenido entre agencia y cliente, bloque por bloque y semana por semana. No publica en redes: la agencia publica por su cuenta lo que el cliente aprobó.

## Operating Context

- Semanas de lunes a domingo; cada bloque tiene tipo (reel, carrusel, historia, publicación, video u otro), horario, notas, texto de la publicación, fotos y videos, y una etiqueta de sección con color.
- Estados de revisión por bloque: en revisión, aprobado, cambios pedidos, rechazado. Estados de producción: pendiente, grabado, editado, subido.
- El cliente confirma la semana completa; si después algo cambia, vuelve a revisión.
- La actividad de la otra parte llega a la sección Avisos y por correo; las pantallas abiertas se actualizan solas.
- El cliente queda vinculado a su agencia solo después de confirmar "Sí, soy yo".

## Capabilities and Constraints

- Web de una sola página en JavaScript sin frameworks (`backend/public/index.html`), servida por un backend NestJS con MySQL o TiDB; almacenamiento de archivos en S3 compatible.
- Acceso con correo y contraseña o con Google, Facebook o GitHub.
- La interfaz no usa diálogos nativos del navegador (`alert`, `confirm`, `prompt`).
- Tema oscuro por defecto, con tema claro opcional.

## Brand Commitments

- El nombre es **ContentSync** y no cambia.
- Toda la interfaz está en español rioplatense con voseo (vos, tenés, revisá).
- La app Android sigue siendo la web en un WebView, sin pantallas nativas aparte.

## Evidence on Hand

- Datos de demostración en `backend/prisma/seed.tsx`: agencias Nova y Pulso, y clientes como Kafecito Roasters y UrbanFit. Son ficticios.
- Documentación de entrega en `docs/entrega/`: manual de usuario, guía de instalación y documentación de la API.
- No hay testimonios, clientes reales, métricas de uso ni casos de éxito; no deben inventarse.

## Product Principles

1. **El cliente en el celular manda:** cada pantalla del cliente tiene que poder usarse cómoda y rápido desde el teléfono, porque ahí ocurre la aprobación.
2. **Un estado, una verdad:** que siempre se vea qué está aprobado, qué espera revisión y qué pidió cambios, sin mensajes repetidos fuera de Avisos.
3. **Nada se pierde:** lo que alguien escribe o sube no se borra por una actualización, un error o un cambio de pantalla.
4. **Listo para mostrar y para usar:** funciona prolijo en la demo de la escuela y aguanta el uso real.
