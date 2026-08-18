import Stripe from "stripe";

let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY no configurado");
  }
  if (!stripeInstance) {
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2026-02-25.clover",
    });
  }
  return stripeInstance;
}

// Traducción legible de los requisitos pendientes de Stripe
const REQUIREMENT_LABELS: Record<string, string> = {
  "individual.first_name": "Nombre del titular",
  "individual.last_name": "Apellidos del titular",
  "individual.dob.day": "Fecha de nacimiento (día)",
  "individual.dob.month": "Fecha de nacimiento (mes)",
  "individual.dob.year": "Fecha de nacimiento (año)",
  "individual.address.line1": "Dirección del titular",
  "individual.address.city": "Ciudad del titular",
  "individual.address.postal_code": "Código postal",
  "individual.phone": "Teléfono del titular",
  "individual.email": "Email del titular",
  "individual.verification.document": "Documento de identidad",
  "business_profile.url": "Web del negocio",
};

export function mapStripeRequirements(currentlyDue: string[]): string[] {
  return (currentlyDue || []).map((r) => REQUIREMENT_LABELS[r] || r);
}
