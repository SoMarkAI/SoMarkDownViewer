#!/usr/bin/env bash
set -euo pipefail

TARGET_DIR="./lib/somarkdown"
VERSION_FILE="${TARGET_DIR}/VERSION"
PACKAGE_API="https://data.jsdelivr.com/v1/package/npm/somarkdown"
BASE_CDN="https://cdn.jsdelivr.net/npm/somarkdown"
QUIET=false

while getopts ":k" opt; do
  case "${opt}" in
    k)
      QUIET=true
      ;;
    \?)
      echo "Unknown option: -${OPTARG}" >&2
      exit 1
      ;;
  esac
done

log() {
  if [ "${QUIET}" = false ]; then
    echo "[get_latest_smd] $1"
  fi
}

log "Preparing directory: ${TARGET_DIR}"
mkdir -p "${TARGET_DIR}"

log "Fetching latest somarkdown version"
LATEST_VERSION="$(curl -fsSL "${PACKAGE_API}" | python3 -c 'import json,sys; print(json.load(sys.stdin)["tags"]["latest"])')"
log "Latest version: ${LATEST_VERSION}"

log "Downloading somarkdown.umd.min.js"
curl -fsSL "${BASE_CDN}@${LATEST_VERSION}/dist/somarkdown.umd.min.js" -o "${TARGET_DIR}/somarkdown.umd.min.js"
log "Downloading somarkdown.css"
curl -fsSL "${BASE_CDN}@${LATEST_VERSION}/dist/somarkdown.css" -o "${TARGET_DIR}/somarkdown.css"

log "Writing version file: ${VERSION_FILE}"
printf "%s\n" "${LATEST_VERSION}" > "${VERSION_FILE}"
log "Done"
