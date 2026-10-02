#!/usr/bin/env bash
set -euo pipefail

directorio_android="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
almacen_claves="${HOME}/.android/keystores/memoria-laboral-upload.p12"
archivo_bundle="${directorio_android}/app/build/outputs/bundle/release/app-release.aab"

if [[ ! -f "$almacen_claves" ]]; then
  printf 'No se encuentra el almacén de claves: %s\n' "$almacen_claves" >&2
  exit 1
fi

read -r -s -p 'Escribe la contraseña que creaste para el almacén y pulsa Intro: ' contrasena_almacen
printf '\n'

if [[ -z "$contrasena_almacen" ]]; then
  printf 'No se introdujo ninguna contraseña. Vuelve a ejecutar el script.\n' >&2
  exit 1
fi

export ANDROID_HOME="${ANDROID_HOME:-/opt/android-sdk}"
export ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-$ANDROID_HOME}"
export MEMORIA_LABORAL_KEYSTORE_PATH="$almacen_claves"
export MEMORIA_LABORAL_KEYSTORE_PASSWORD="$contrasena_almacen"
export MEMORIA_LABORAL_KEY_ALIAS=memoria-laboral-upload
export MEMORIA_LABORAL_KEY_PASSWORD="$contrasena_almacen"

cd "$directorio_android"
./gradlew --no-daemon --rerun-tasks bundleRelease
jarsigner -verify "$archivo_bundle"
printf 'Bundle firmado y verificado: %s\n' "$archivo_bundle"