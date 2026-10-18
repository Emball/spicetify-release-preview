import { PreviewState } from "../manifest";
import { findAdapter } from "../adapters";
import { log } from "../log";

declare const Spicetify: any;

type StateGetter = () => PreviewState;

const seen = new Set<string>();

function observe(operation: string, variables: any, json: any): void {
  if (seen.has(operation)) return;
  seen.add(operation);
  const dataKeys = json?.data ? Object.keys(json.data) : [];
  log.info("discovered operation", operation, "variables:", Object.keys(variables ?? {}), "data:", dataKeys);
}

function parseJson(text: string | null | undefined): any {
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch (err) {
    log.warn("could not parse request json", err);
    return undefined;
  }
}

function readRequest(input: any, init?: RequestInit): { operation: string; variables: any } | undefined {
  const href: string = typeof input === "string" ? input : input instanceof URL ? input.href : input?.url ?? "";
  if (!href.includes("pathfinder")) return undefined;
  const url = new URL(href, location.href);
  let operation = url.searchParams.get("operationName") ?? undefined;
  let variables = parseJson(url.searchParams.get("variables"));
  if (typeof init?.body === "string") {
    const body = parseJson(init.body);
    operation = body?.operationName ?? operation;
    variables = body?.variables ?? variables;
  }
  if (!operation) return undefined;
  return { operation, variables: variables ?? {} };
}

export async function patchJson(
  operation: string,
  variables: any,
  fetchJson: () => Promise<any>,
  getState: StateGetter,
): Promise<any> {
  const adapter = findAdapter(operation);
  if (adapter?.synthesize) {
    const synthetic = adapter.synthesize(variables, getState());
    if (synthetic) return synthetic;
  }
  const json = await fetchJson();
  observe(operation, variables, json);
  if (!adapter) return json;
  try {
    return adapter.patch(json, variables, getState()) ?? json;
  } catch (err) {
    log.error("adapter failed for", operation, err);
    return json;
  }
}

export function installFetchHook(getState: StateGetter): void {
  const original = window.fetch.bind(window);
  window.fetch = async (input: any, init?: RequestInit) => {
    let request: ReturnType<typeof readRequest>;
    try {
      request = readRequest(input, init);
    } catch (err) {
      log.error("request parse failed", err);
    }
    if (!request) return original(input, init);

    const adapter = findAdapter(request.operation);
    const synthetic = adapter?.synthesize?.(request.variables, getState());
    if (synthetic) {
      log.info("fetch short-circuited for", request.operation);
      return new Response(JSON.stringify(synthetic), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    const response = await original(input, init);
    try {
      const json = await response.clone().json();
      const patched = await patchJson(request.operation, request.variables, async () => json, getState);
      const headers = new Headers(response.headers);
      headers.delete("content-length");
      headers.delete("content-encoding");
      return new Response(JSON.stringify(patched), {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch (err) {
      log.error("response patch failed for", request.operation, err);
      return response;
    }
  };
  log.info("fetch hook installed");
}

export function installGraphQlHook(getState: StateGetter): void {
  const gql = Spicetify.GraphQL;
  if (!gql?.Request) {
    log.warn("Spicetify.GraphQL.Request not found, skipping graphql hook");
    return;
  }
  const original = gql.Request.bind(gql);
  gql.Request = (definition: any, variables: any, ...rest: any[]) =>
    patchJson(definition?.name ?? "", variables, () => original(definition, variables, ...rest), getState);
  log.info("graphql hook installed");
}
