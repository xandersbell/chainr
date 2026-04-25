// OpenAI Responses API input item list types (simplified)
export interface ResponseItemList {
  data: Array<Record<string, unknown>>;
  first_id: string;
  has_more: boolean;
  last_id: string;
  object: 'list';
}
