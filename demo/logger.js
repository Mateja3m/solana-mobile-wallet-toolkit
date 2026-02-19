const DEBUG = false;

function stringifyMeta(meta) {
  if (!meta) return '';
  try {
    return ` ${JSON.stringify(meta)}`;
  } catch (_error) {
    return ' [meta-unserializable]';
  }
}

export function createLogger(append) {
  const write = (level, message, meta) => {
    if (typeof append === 'function') {
      append(`[${level.toUpperCase()}] ${message}${stringifyMeta(meta)}`);
    }
  };

  return {
    debugEnabled: DEBUG,
    info(message, meta) {
      write('info', message, DEBUG ? meta : null);
    },
    warn(message, meta) {
      write('warn', message, DEBUG ? meta : null);
    },
    error(message, meta) {
      write('error', message, DEBUG ? meta : null);
    },
    debug(message, meta) {
      if (!DEBUG) return;
      write('debug', message, meta);
    }
  };
}
