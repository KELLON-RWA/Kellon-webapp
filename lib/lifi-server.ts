import "server-only";

const LIFI_API_URL = "https://li.quest/v1";

function getLifiHeaders() {
  const apiKey = process.env.LIFI_API_ID;
  return {
    "x-lifi-integrator": "Kellon",
    ...(apiKey ? { "x-lifi-api-key": apiKey } : {}),
  };
}

async function parseLifiResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => ({}))) as T & {
    message?: string;
  };
  if (!response.ok) {
    throw new Error(
      payload.message || `LI.FI request failed (${response.status})`,
    );
  }
  return payload;
}

export async function lifiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${LIFI_API_URL}${path}`, {
    headers: getLifiHeaders(),
    cache: "no-store",
  });
  return parseLifiResponse<T>(response);
}

export async function lifiRequest<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${LIFI_API_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getLifiHeaders(),
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  return parseLifiResponse<T>(response);
}
