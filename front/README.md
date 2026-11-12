# ContentSync — App en React Native (front/)

App para teléfonos de ContentSync, escrita en **TypeScript (TSX)** con **React Native** y **Expo** (SDK 58). Reemplaza al WebView en Kotlin de `android/`: dibuja sus propias pantallas y habla con la misma API del backend.

## Qué incluye

| Pantalla | Quién la ve | Qué hace |
|---|---|---|
| Acceso | Todos | Iniciar sesión, crear cuenta de agencia, verificar el correo con un código de 6 dígitos y recuperar o crear la contraseña. |
| Cronograma | Todos | Semanas de lunes a domingo; los bloques de cada día se deslizan de costado. La agencia crea semanas y bloques con fotos y videos; el cliente comenta, aprueba, pide cambios, rechaza y confirma la semana. |
| Ideas | Agencia y administrador | Banco privado de ideas con secciones de colores, filtros, búsqueda y las propuestas de los clientes (aceptar, editar y aceptar, rechazar). |
| Clientes | Agencia y administrador | Invitar clientes ("Sí, soy yo"), reenviar la invitación, ver su cronograma o eliminarlos. |
| Ideas (cliente) | Cliente | Proponerle ideas a la agencia y ver la respuesta. |
| Avisos | Todos | Avisos de la otra parte; "Ver" abre el bloque o la propuesta. |
| Ajustes | Todos | Perfil, contraseña, tema claro u oscuro, configuración de la plataforma (administrador) y eliminar la cuenta. |

Los datos se actualizan solos cuando la otra parte hace un cambio (canal `/api/v1/live/events`).

**Todavía no incluye** el acceso con Google, Facebook o GitHub. Quien entró así puede crear una contraseña desde la pantalla de acceso y usar la app con su correo.

## Estructura

```
front/
├── app.json                 Nombre, paquete de Android (com.contentsync.app), permisos y plugins.
└── src/
    ├── app/                 Rutas de Expo Router: cada archivo es una pantalla.
    │   ├── _layout.tsx      Raíz: tema, estado global y acceso o pestañas.
    │   └── (tabs)/          Pestañas del menú inferior.
    ├── api/                 Cliente HTTP (sesión, subida de archivos, tiempo real) y tipos de la API.
    ├── components/          Botones, campos, ventanas y barra superior.
    ├── screens/             Pantallas y sus ventanas.
    ├── state/AppContext.tsx Sesión, datos descargados y selección activa.
    ├── theme/theme.tsx      Colores de los temas oscuro y claro.
    ├── lib/format.tsx       Constantes y formatos de fecha.
    └── config.tsx           Dirección del servidor.
```

## Servidor

Por defecto usa `https://contentsync-app.onrender.com`. Para otro servidor, definí `EXPO_PUBLIC_API_URL` antes de iniciar o compilar, por ejemplo `http://10.0.2.2:3000` para el emulador de Android.

## Comandos

```bash
cd front
npm install
npx expo start          # servidor de desarrollo
npm run typecheck       # chequeo de tipos
npm run lint            # revisión del código
```

## Generar la APK

La forma más simple es compilar en la nube con EAS, que también guarda la clave de firma:

```bash
npx eas-cli login
npx eas-cli build --platform android --profile preview
```

Para compilar en la propia PC hace falta Java 17, el SDK de Android 37 y el NDK 27.1: `npx expo prebuild --platform android` y después `cd android && ./gradlew assembleRelease`.
