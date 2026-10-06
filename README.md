<p align="center">
  <img src="logo/logo-transparente.png" alt="Logo de Memoria laboral" width="180">
</p>

<h1 align="center">Memoria laboral</h1>

<p align="center">
  Organiza tus jornadas, rutas y horarios en un calendario claro, desde el móvil o el ordenador.
</p>

<p align="center">
  <a href="https://mvisions.github.io/perfect-proyect/">Abrir aplicación</a> ·
  <a href="https://github.com/mvisions/perfect-proyect/releases">Versiones</a> ·
  <a href="https://mvisions.github.io/perfect-proyect/privacy-policy.html">Privacidad</a>
</p>

<p align="center">
  <a href="https://img.shields.io/github/v/release/mvisions/perfect-proyect?include_prereleases&label=versi%C3%B3n"><img src="https://img.shields.io/github/v/release/mvisions/perfect-proyect?include_prereleases&label=versi%C3%B3n" alt="Última versión"></a>
  <a href="https://img.shields.io/github/actions/workflow/status/mvisions/perfect-proyect/deploy-pages.yml?branch=main&label=despliegue"><img src="https://img.shields.io/github/actions/workflow/status/mvisions/perfect-proyect/deploy-pages.yml?branch=main&label=despliegue" alt="Estado del despliegue"></a>
</p>

## Qué puedes hacer

- Planificar destinos y horarios en un calendario mensual.
- Registrar entradas, salidas, tipo de jornada, horas trabajadas y horas extra.
- Marcar vacaciones, bajas, días propios y festivos; consultar el resumen anual.
- Personalizar colores y fondos, y exportar o compartir el calendario como imagen.
- Instalar la aplicación como PWA; la versión Android también permite configurar recordatorios.
- Sincronizar los datos con Google Drive.

## Usar la aplicación

Abre [Memoria laboral](https://mvisions.github.io/perfect-proyect/) desde el navegador. En dispositivos compatibles puedes instalarla desde la propia aplicación.

## Desarrollo

Requisitos: Node.js 20 o posterior y npm.

### Estructura

- `src/`: aplicación y estilos fuente.
- `tests/`: pruebas automatizadas.
- `scripts/`: herramientas de mantenimiento.
- `assets/`, `intro/` y `logo/`: recursos de la aplicación.
- `public/`: archivos estáticos de la PWA.
- `android/`: proyecto nativo de Capacitor.

```bash
npm ci
npm run dev
```

Para generar la versión web de producción:

```bash
npm run build
```

El resultado se genera en `dist/`.

### Android

Con Android Studio y el SDK de Android instalados:

```bash
npm run android:sync
npm run android:open
```

El primer comando compila la web y sincroniza los recursos nativos; el segundo abre el proyecto Android.

Para generar los artefactos Android firmados de release:

```bash
bash android/firmar-bundle.sh
```

El script genera el AAB para Google Play y el APK de release. Necesita el almacén de claves en `~/.android/keystores/memoria-laboral-upload.p12` y solicita su contraseña.

## Tecnologías

Vite, Capacitor y JavaScript. La aplicación web se publica en GitHub Pages y el código fuente está disponible en este repositorio.

## Privacidad

Consulta la [política de privacidad](https://mvisions.github.io/perfect-proyect/privacy-policy.html).