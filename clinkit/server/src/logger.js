// Structured JSON logs (CloudWatch/Datadog-parseable) with zero deps.
// Levels gate on LOG_LEVEL (debug|info|warn|error), default info.

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const threshold = LEVELS[process.env.LOG_LEVEL] ?? LEVELS.info;

function emit(level, msg, fields) {
  if (LEVELS[level] < threshold) return;
  const line = { level, time: new Date().toISOString(), msg, ...fields };
  (level === 'error' ? console.error : console.log)(JSON.stringify(line));
}

export const log = {
  debug: (msg, fields) => emit('debug', msg, fields),
  info: (msg, fields) => emit('info', msg, fields),
  warn: (msg, fields) => emit('warn', msg, fields),
  error: (msg, fields) => emit('error', msg, fields),
};

/** Express middleware: one JSON line per request with latency + status. */
export function requestLogger() {
  return (req, res, next) => {
    const start = process.hrtime.bigint();
    res.on('finish', () => {
      const ms = Number(process.hrtime.bigint() - start) / 1e6;
      emit(res.statusCode >= 500 ? 'error' : 'info', 'http', {
        method: req.method, path: req.path, status: res.statusCode,
        ms: Math.round(ms * 10) / 10, ip: req.ip,
      });
    });
    next();
  };
}
