import {
  H3Event,
  HTTPEventSymbol,
  defineMiddleware,
  getRequestIP,
  sendWebResponse,
  toWebRequest
} from "vinxi/server";
import { FetchEvent } from "./types";

const fetchEventSymbol = Symbol("fetchEvent");

export function createFetchEvent(event: H3Event): FetchEvent {
  const request = toWebRequest(event);
  return {
    request: request,
    clientAddress: getRequestIP(event),
    locals: {},
    nativeEvent: event,
    [HTTPEventSymbol]: event
  };
}

export function cloneEvent<T extends FetchEvent>(fetchEvent: T): T {
  return {
    ...fetchEvent,
    [HTTPEventSymbol]: fetchEvent[HTTPEventSymbol]
  };
}

export function getFetchEvent(h3Event: H3Event): FetchEvent {
  if (!h3Event[fetchEventSymbol]) {
    const fetchEvent = createFetchEvent(h3Event);
    h3Event[fetchEventSymbol] = fetchEvent;
    // @ts-ignore
  }

  return h3Event[fetchEventSymbol];
}

/** Function responsible for receiving an observable [operation]{@link Operation} and returning a [result]{@link OperationResult}. */

export type MiddlewareFn = (event: FetchEvent) => Promise<unknown> | unknown;
/** This composes an array of Exchanges into a single ExchangeIO function */

export type RequestMiddleware = (event: FetchEvent) => Response | Promise<Response> | void | Promise<void>;

// copy-pasted from h3/dist/index.d.ts
type EventHandlerResponse<T = any> = T | Promise<T>;
type ResponseMiddlewareResponseParam = { body?: Awaited<EventHandlerResponse> };

export type ResponseMiddleware = (
  event: FetchEvent,
  response: ResponseMiddlewareResponseParam
) => Response | Promise<Response> | void | Promise<void>;

function wrapRequestMiddleware(onRequest: RequestMiddleware) {
  return async (h3Event: H3Event) => {
    const fetchEvent = getFetchEvent(h3Event);
    const response = await onRequest(fetchEvent);
    if (!response) {
      return;
    } else {
      sendWebResponse(h3Event, response);
    }
  };
}

function wrapResponseMiddleware(onBeforeResponse: ResponseMiddleware) {
  return async (h3Event: H3Event, response: ResponseMiddlewareResponseParam) => {
    const fetchEvent = getFetchEvent(h3Event);
    const mwResponse = await onBeforeResponse(fetchEvent, response);
    if (!mwResponse) {
      return;
    } else {
      sendWebResponse(h3Event, mwResponse);
    }
  };
}

export function createMiddleware({
  onRequest,
  onBeforeResponse
}: {
  onRequest?: RequestMiddleware | RequestMiddleware[] | undefined;
  onBeforeResponse?: ResponseMiddleware | ResponseMiddleware[] | undefined;
}) {
  return defineMiddleware({
    onRequest:
      typeof onRequest === "function"
        ? wrapRequestMiddleware(onRequest)
        : Array.isArray(onRequest)
        ? onRequest.map(wrapRequestMiddleware)
        : undefined,
    onBeforeResponse:
      typeof onBeforeResponse === "function"
        ? wrapResponseMiddleware(onBeforeResponse)
        : Array.isArray(onBeforeResponse)
        ? onBeforeResponse.map(wrapResponseMiddleware)
        : undefined
  });
}
