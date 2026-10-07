export function safeEnd(res, status, headers, body) {
  if (res.headersSent || res.writableEnded) return false;
  res.writeHead(status, headers);
  res.end(body);
  return true;
}

export function sendClientError(res, origin, corsHeaders, err) {
  const h = {
    ...corsHeaders(origin),
    "Content-Type": "application/json; charset=utf-8",
  };
  safeEnd(res, err.status, h, JSON.stringify({ message: err.message, nextStep: err.nextStep, code: err.code }));
}

export function sendDukValidationError(res, origin, corsHeaders, payload) {
  const h = {
    ...corsHeaders(origin),
    "Content-Type": "application/json; charset=utf-8",
  };
  safeEnd(res, 422, h, JSON.stringify(payload));
}

export function sendApiError(res, origin, corsHeaders, status, body) {
  const h = {
    ...corsHeaders(origin),
    "Content-Type": "application/json; charset=utf-8",
  };
  safeEnd(res, status, h, JSON.stringify(body));
}
