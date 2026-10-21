/**
 * PRIMESELF PRIME SCAN 360 — Cloudflare Worker backend
 *
 * Required Worker secrets/variables:
 *   AI_API_KEY (secret): API key for an OpenAI-compatible vision model provider
 *   AI_MODEL (variable): provider's vision-capable model name
 *   ALLOWED_ORIGIN (variable): exact published PRIMESELF origin, e.g.
 *     https://naudetaljaard01-ship-it.github.io
 *
 * This endpoint accepts multipart/form-data field "photo".
 * It returns concise grooming, image-quality and non-medical skincare guidance.
 * Never deploy with a wildcard origin for a public production app.
 */
const MAX_BYTES = 8 * 1024 * 1024;
const JSON_HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };

function corsHeaders(origin, allowedOrigin) {
  const allowed = origin && allowedOrigin && origin === allowedOrigin ? origin : "null";
  return {
    "access-control-allow-origin": allowed,
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    "vary": "Origin",
  };
}
function json(data, status, cors) {
  return new Response(JSON.stringify(data), { status, headers: { ...JSON_HEADERS, ...cors } });
}
export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(origin, env.ALLOWED_ORIGIN || "");
    if (request.method === "OPTIONS") {
      if (cors["access-control-allow-origin"] === "null") return new Response(null, { status: 403 });
      return new Response(null, { status: 204, headers: cors });
    }
    if (origin !== (env.ALLOWED_ORIGIN || "")) return json({ error: "Origin not allowed" }, 403, cors);
    if (request.method !== "POST") return json({ error: "Use POST with multipart/form-data field photo." }, 405, cors);
    if (!env.AI_API_KEY || !env.AI_MODEL) return json({ error: "AI_API_KEY and AI_MODEL must be configured as Worker secrets/variables." }, 503, cors);
    try {
      const form = await request.formData();
      const photo = form.get("photo");
      if (!(photo instanceof File) || !photo.type.startsWith("image/")) return json({ error: "Please attach an image in the photo field." }, 400, cors);
      if (photo.size > MAX_BYTES) return json({ error: "Image must be 8 MB or smaller." }, 413, cors);
      const bytes = new Uint8Array(await photo.arrayBuffer());
      let binary = "";
      for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      const dataUrl = "data:" + photo.type + ";base64," + btoa(binary);
      const prompt = [
        "You are PRIMESELF's practical, supportive grooming and photo-quality coach.",
        "Do not rate attractiveness, facial beauty, body shape, worth, or compare this person with others.",
        "Do not infer age, identity, race, health diagnoses, personality, or sensitive traits.",
        "Do not diagnose skin conditions from an image. If there may be a medical concern, say an image cannot diagnose it and suggest asking a qualified clinician or pharmacist.",
        "Give only cautious, visible, non-sensitive observations about photo lighting, framing, image clarity, hairstyle presentation, and general grooming/style ideas.",
        "Avoid certainty where the image is unclear. Do not recommend harsh treatments, restrictive diets, or appearance-altering procedures.",
        "Return JSON only with keys: summary (string), observations (array of strings, max 5), suggestions (array of strings, max 5)."
      ].join(" ");
      const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "authorization": "Bearer " + env.AI_API_KEY, "content-type": "application/json" },
        body: JSON.stringify({
          model: env.AI_MODEL,
          temperature: 0.3,
          max_tokens: 500,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: prompt },
            { role: "user", content: [
              { type: "text", text: "Review this photo for practical photo quality and optional grooming/style suggestions. Do not give an attractiveness score. Return the required JSON." },
              { type: "image_url", image_url: { url: dataUrl, detail: "low" } }
            ]}
          ]
        })
      });
      if (!upstream.ok) {
        const detail = await upstream.text();
        console.error("AI provider error", upstream.status, detail.slice(0, 500));
        return json({ error: "AI provider request failed. Check the configured model and provider account." }, 502, cors);
      }
      const result = await upstream.json();
      const content = result?.choices?.[0]?.message?.content;
      if (typeof content !== "string") return json({ error: "AI provider returned no readable result." }, 502, cors);
      let parsed;
      try { parsed = JSON.parse(content); } catch { return json({ error: "AI provider returned invalid JSON." }, 502, cors); }
      const cleanList = (value) => Array.isArray(value) ? value.filter(x => typeof x === "string").slice(0, 5).map(x => x.slice(0, 400)) : [];
      return json({
        summary: typeof parsed.summary === "string" ? parsed.summary.slice(0, 700) : "Analysis complete.",
        observations: cleanList(parsed.observations),
        suggestions: cleanList(parsed.suggestions),
        disclaimer: "AI-generated guidance can be wrong. This is not a medical assessment or attractiveness rating."
      }, 200, cors);
    } catch (error) {
      console.error("PRIME SCAN request failed", String(error));
      return json({ error: "Could not process the photo. Please try again." }, 500, cors);
    }
  }
};
