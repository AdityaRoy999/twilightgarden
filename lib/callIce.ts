import { supabase } from "./supabase";
export interface CallIce {
  iceServers: RTCIceServer[];
  expiresAt: number;
  relayConfigured: boolean;
}
export const STUN_SERVERS: RTCIceServer[] = [
  { urls: ["stun:stun.cloudflare.com:3478", "stun:stun.l.google.com:19302"] },
];

export async function loadCallIce(coupleId: string): Promise<CallIce> {
  const { data, error } = await supabase.functions.invoke("call-credentials", {
    body: { coupleId },
    timeout: 10000,
  });
  if (error) {
    let code: string | undefined;
    if (error.context instanceof Response) {
      try {
        code = (await error.context.clone().json()).code;
      } catch {
        /* No structured error. */
      }
    }
    if (code === "TURN_NOT_CONFIGURED")
      return {
        iceServers: STUN_SERVERS,
        expiresAt: Date.now() + 300000,
        relayConfigured: false,
      };
    throw new Error("Could not prepare the call connection. Please retry.");
  }
  if (
    !Array.isArray(data?.iceServers) ||
    !Number.isFinite(data.expiresAt) ||
    data.expiresAt <= Date.now()
  )
    throw new Error("The relay credentials are unavailable. Please retry.");
  const iceServers: RTCIceServer[] = data.iceServers.flatMap(
    (server: RTCIceServer) => {
      const urls = (
        Array.isArray(server.urls) ? server.urls : [server.urls]
      ).filter(
        (url) =>
          typeof url === "string" &&
          /^(stun|turn|turns):[^\s]+$/i.test(url) &&
          !/:53(?:\?|$)/.test(url),
      );
      if (!urls.length) return [];
      return [
        {
          urls,
          ...(server.username && server.credential
            ? { username: server.username, credential: server.credential }
            : {}),
        },
      ];
    },
  );
  if (
    !iceServers.some((server) =>
      (Array.isArray(server.urls) ? server.urls : [server.urls]).some((url) =>
        /^turns?:/i.test(url),
      ),
    )
  )
    throw new Error("No relay servers are available.");
  return { iceServers, expiresAt: data.expiresAt, relayConfigured: true };
}
