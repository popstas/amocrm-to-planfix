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

export default { appendDefaults };
