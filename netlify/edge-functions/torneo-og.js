// Edge Function de Netlify: vista previa por torneo al compartir /torneos/:id.
// Los crawlers de WhatsApp/redes NO ejecutan el JS de la app, así que leen el
// HTML tal cual. Acá interceptamos la petición, traemos el torneo del backend
// (endpoint público) e inyectamos los meta Open Graph/Twitter con su nombre,
// descripción y afiche. Para los usuarios normales el HTML es el mismo de
// siempre (la SPA arranca igual); solo cambian los meta del <head>.
//
// Config: se activa solo para /torneos/:id (ver `config.path` abajo).

const API = "https://chosen-sandra-jefernee-f13f70d9.koyeb.app";
const SITIO = "https://salajuegosruiz.netlify.app";
const IMG_DEFAULT = `${SITIO}/logo512.png`;

const escapar = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export default async (request, context) => {
  const response = await context.next();
  try {
    const url = new URL(request.url);
    const match = url.pathname.match(/^\/torneos\/([^/]+)\/?$/);
    if (!match) return response;

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) return response;

    const id = match[1];

    // Traemos el torneo (con timeout corto para no colgar la respuesta si el
    // backend está frío). Si falla, dejamos los meta por defecto.
    let torneo = null;
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 4000);
      const r = await fetch(`${API}/api/torneos/public/${id}`, { signal: ctrl.signal });
      clearTimeout(t);
      if (r.ok) {
        const json = await r.json();
        torneo = json?.data || null;
      }
    } catch {
      /* backend lento o caído: seguimos con los meta por defecto */
    }

    if (!torneo) return response;

    const titulo = `${torneo.nombre} — Torneo · Sala de Juegos Ruiz`;
    const desc =
      torneo.descripcion?.trim() ||
      `Inscribite al torneo ${torneo.nombre}. ¡Cupos limitados, no te quedés afuera!`;
    const img = torneo.imagenUrl || IMG_DEFAULT;
    const canonical = `${SITIO}/torneos/${id}`;

    const bloque =
      `<!-- OG:START -->` +
      `<meta property="og:type" content="website" />` +
      `<meta property="og:site_name" content="Sala de Juegos Ruiz" />` +
      `<meta property="og:title" content="${escapar(titulo)}" />` +
      `<meta property="og:description" content="${escapar(desc)}" />` +
      `<meta property="og:image" content="${escapar(img)}" />` +
      `<meta property="og:url" content="${escapar(canonical)}" />` +
      `<meta name="twitter:card" content="summary_large_image" />` +
      `<meta name="twitter:title" content="${escapar(titulo)}" />` +
      `<meta name="twitter:description" content="${escapar(desc)}" />` +
      `<meta name="twitter:image" content="${escapar(img)}" />` +
      `<!-- OG:END -->`;

    let html = await response.text();
    html = html.replace(/<!-- OG:START -->[\s\S]*?<!-- OG:END -->/, bloque);
    html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapar(titulo)}</title>`);

    const headers = new Headers(response.headers);
    headers.delete("content-length"); // el cuerpo cambió de tamaño
    return new Response(html, { status: response.status, headers });
  } catch {
    // Ante cualquier error, devolvemos la respuesta original intacta.
    return response;
  }
};

export const config = { path: "/torneos/:id" };
