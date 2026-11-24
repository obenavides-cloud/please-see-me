const endpoint = "https://api.runpod.io/graphql";

async function graphql(query, variables = {}) {
  const apiKey = process.env.RUNPOD_API_KEY;
  if (!apiKey) throw new Error("RUNPOD_API_KEY is not configured");

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({ query, variables })
  });
  const body = await response.json();
  if (!response.ok || body.errors) {
    throw new Error(body.errors?.[0]?.message || `RunPod HTTP ${response.status}`);
  }
  return body.data;
}

export async function getPods() {
  const data = await graphql(`
    query Pods {
      myself {
        pods {
          id
          name
          desiredStatus
          runtime { uptimeInSeconds }
        }
      }
    }
  `);
  return data.myself.pods;
}

export async function resumePod(podId) {
  const data = await graphql(`
    mutation Resume($podId: String!, $gpuCount: Int) {
      podResume(input: { podId: $podId, gpuCount: $gpuCount }) {
        id
        desiredStatus
      }
    }
  `, { podId, gpuCount: 1 });
  return data.podResume;
}

export async function stopPod(podId) {
  const data = await graphql(`
    mutation Stop($podId: String!) {
      podStop(input: { podId: $podId }) {
        id
        desiredStatus
      }
    }
  `, { podId });
  return data.podStop;
}
