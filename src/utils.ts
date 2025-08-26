export interface WebhookDefaults {
  tags?: string[];
  pipeline?: string;
  project?: string;
  leadSource?: string;
}

export function appendDefaults(taskParams: any, conf: WebhookDefaults | undefined) {
  if (!conf) return taskParams;
  if (conf.tags && taskParams.tags === undefined) {
    taskParams.tags = conf.tags;
  }
  if (conf.pipeline && taskParams.pipeline === undefined) {
    taskParams.pipeline = conf.pipeline;
  }
  if (conf.project && taskParams.project === undefined) {
    taskParams.project = conf.project;
  }
  if (conf.leadSource && taskParams.leadSource === undefined) {
    taskParams.leadSource = conf.leadSource;
  }
  return taskParams;
}

export function normalizeKey(value: string): string {
  const cyrMap: Record<string, string> = {
    'а': 'a',
    'е': 'e',
    'ё': 'e',
    'о': 'o',
    'р': 'p',
    'с': 'c',
    'х': 'x',
    'у': 'y',
    'к': 'k',
    'т': 't',
    'в': 'b',
    'м': 'm',
    'н': 'h',
  };
  return value
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[аёеорсхуктвмн]/g, ch => cyrMap[ch] || ch);
}

export function matchByConfig<T>(map: Record<string, T> | undefined, value: string | undefined): T | undefined {
  if (!map || !value) return undefined;
  const normMap = Object.fromEntries(
    Object.entries(map).map(([k, v]) => [normalizeKey(k), v])
  );
  return normMap[normalizeKey(value)];
}

export function includesByConfig<T>(map: Record<string, T> | undefined, value: string | undefined): T | undefined {
  if (!map || !value) return undefined;
  const normValue = normalizeKey(value);
  for (const [k, v] of Object.entries(map)) {
    if (normValue.includes(normalizeKey(k))) {
      return v;
    }
  }
  return undefined;
}

export default { appendDefaults, normalizeKey, matchByConfig, includesByConfig };

