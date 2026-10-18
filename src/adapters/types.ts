import { PreviewState } from "../manifest";

export interface Adapter {
  operations: string[];
  synthesize?(variables: any, state: PreviewState): any | undefined;
  patch(json: any, variables: any, state: PreviewState): any;
}
