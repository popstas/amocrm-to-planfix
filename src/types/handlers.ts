export interface ProcessWebhookResult {
  body: any;
  lead: any;
  taskParams: any;
  task?: any;
}

export interface ProcessWebhook {
  (input: { headers: any; body: any }, row?: any): Promise<ProcessWebhookResult>;
}

