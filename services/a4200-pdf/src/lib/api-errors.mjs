export const RATE_LIMIT_RESPONSE = {
  code: "RATE_LIMIT",
  message: "Prea multe cereri de generare PDF.",
  nextStep: "Așteaptă un minut și încearcă din nou, sau generează PDF-ul local cu DUKIntegrator.",
};

export const REQUEST_TIMEOUT_RESPONSE = {
  code: "REQUEST_TIMEOUT",
  message: "Timpul alocat generării PDF a expirat.",
  nextStep: "Încearcă din nou cu același set de fișiere; dacă problema persistă, rulează DUKIntegrator pe calculator.",
};

export const JAVA_TIMEOUT_RESPONSE = REQUEST_TIMEOUT_RESPONSE;
