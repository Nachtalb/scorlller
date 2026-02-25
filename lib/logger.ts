const C = {
  reset:  '\x1b[0m',
  dim:    '\x1b[2m',
  cyan:   '\x1b[36m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  red:    '\x1b[31m',
  blue:   '\x1b[34m',
  magenta:'\x1b[35m',
};

function ts() {
  return C.dim + new Date().toISOString().replace('T', ' ').slice(0, 23) + C.reset;
}

function tag(label: string, color: string) {
  return color + `[${label}]` + C.reset;
}

export const log = {
  info:  (...a: any[]) => console.log(ts(), tag('INFO ', C.cyan),    ...a),
  ok:    (...a: any[]) => console.log(ts(), tag('OK   ', C.green),   ...a),
  hit:   (...a: any[]) => console.log(ts(), tag('CACHE', C.blue),    ...a),
  miss:  (...a: any[]) => console.log(ts(), tag('MISS ', C.yellow),  ...a),
  error: (...a: any[]) => console.error(ts(), tag('ERROR', C.red),   ...a),
  warn:  (...a: any[]) => console.warn(ts(), tag('WARN ', C.yellow), ...a),
};
