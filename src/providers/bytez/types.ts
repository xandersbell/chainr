interface Model {
  task: string;
}

interface BytezResponse {
  error: string;
  output: Model[];
}

export type { BytezResponse, Model };
