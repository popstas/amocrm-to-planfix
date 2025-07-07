export interface ProcessWebhookResult {
  body: any;
  lead: any;
  taskParams: any;
  task?: any;
}

export interface ProcessWebhook {
  (input: { body: any }, row?: any): Promise<ProcessWebhookResult>;
}
