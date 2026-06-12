// CORS para multi-host: la PWA instalada en iOS está atada a un único origen
// (el host que la sirvió), pero debe poder hablar con la API y los WebSockets
// de los demás hosts del tailnet. La autenticación es por bearer token (no
// cookies), así que reflejar el Origin de la petición es seguro: el token —no
// el navegador— es lo que protege la API, y un sitio sin la contraseña no
// puede obtener uno (con el throttle de login de por medio).
export function corsHeaders(origin) {
  if (!origin) return {}
  return {
    'Access-Control-Allow-Origin': origin,
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '600'
  }
}
