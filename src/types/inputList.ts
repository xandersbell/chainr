// OpenAI Responses API 的 input items 列表类型（简化版）
export interface ResponseItemList {
  data: Array<Record<string, unknown>>;
  first_id: string;
  has_more: boolean;
  last_id: string;
  object: 'list';
}
