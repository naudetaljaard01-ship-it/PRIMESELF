# PRIME SCAN 360 online AI backend

The PRIMESELF GitHub Pages site is a static website, so it cannot safely hold an AI provider API key. This Cloudflare Worker is a backend template that keeps the key on the server.

## Before using it
- You need your own Cloudflare account and an AI provider account with access to a vision-capable model. Provider usage may cost money.
- Do not put an API key in `index.html`, GitHub Pages, a public repository, or a phone app.
- This is a prototype integration. Review provider privacy/data-retention terms and local legal requirements before sending real photos.
- Use a private, adult-reviewed setup if the user is under 18. Do not send photos of other people without their permission.

## Deploy (from a computer or Cloudflare dashboard)
1. Create a Cloudflare Worker and paste `cloudflare-worker.js` into its editor.
2. Add secret `AI_API_KEY` using the Worker secret settings. Never commit this secret.
3. Add variable `AI_MODEL` with a vision-capable model name available to your provider account.
4. Add variable `ALLOWED_ORIGIN` set to the exact origin hosting PRIMESELF, for example `https://naudetaljaard01-ship-it.github.io` (no trailing slash).
5. Deploy the Worker and copy its HTTPS URL.
6. In PRIMESELF > Photo > Online AI, paste the Worker URL and tick the consent checkbox before testing.
7. Test only with a photo you are comfortable sending to that provider. The Worker does not save the uploaded image intentionally, but the provider may process it according to its own terms.

## API contract
- Request: `POST multipart/form-data`, field `photo` (image, max 8 MB).
- Response JSON: `summary`, `observations[]`, `suggestions[]`.
- The Worker uses an OpenAI-compatible Chat Completions vision request. Adjust the upstream URL/payload if your chosen provider uses a different API.
- The endpoint rejects requests without the configured Origin and only returns CORS access for `ALLOWED_ORIGIN`.

## Offline AI
The current website has a real local image-dimensions/file-size check, not an on-device neural model. A true offline vision model must be selected, packaged, and tested for Android performance and privacy; it cannot be downloaded or activated just by setting an endpoint. Keep the offline UI labelled as a basic check until that model is integrated.
