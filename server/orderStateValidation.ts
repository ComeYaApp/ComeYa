// Order State Validation Middleware
// Valida transiciones de estado y permisos por rol
// Estados canónicos del pedido: pending, accepted, preparing, ready, on_the_way, delivered, cancelled

export const ORDER_STATE_TRANSITIONS = {
  pending: ["accepted", "cancelled"],
  accepted: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["on_the_way", "cancelled"], // El repartidor recoge y sale en camino
  on_the_way: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
} as const;

export const ROLE_ALLOWED_STATES = {
  business_owner: ["accepted", "preparing", "ready", "cancelled"],
  delivery_driver: ["on_the_way", "delivered"],
  admin: [
    "pending",
    "accepted",
    "preparing",
    "on_the_way",
    "delivered",
    "cancelled",
  ],
  super_admin: [
    "pending",
    "accepted",
    "preparing",
    "on_the_way",
    "delivered",
    "cancelled",
  ],
  customer: ["cancelled"], // Solo puede cancelar en periodo de arrepentimiento
} as const;

export function validateStateTransition(
  currentState: string,
  newState: string,
): { valid: boolean; error?: string } {
  const allowedTransitions =
    ORDER_STATE_TRANSITIONS[
      currentState as keyof typeof ORDER_STATE_TRANSITIONS
    ];

  if (!allowedTransitions) {
    return { valid: false, error: `Estado actual inválido: ${currentState}` };
  }

  if (!allowedTransitions.includes(newState as any)) {
    return {
      valid: false,
      error: `No se puede cambiar de "${currentState}" a "${newState}". Transiciones permitidas: ${allowedTransitions.join(", ")}`,
    };
  }

  return { valid: true };
}

export function validateRoleCanChangeToState(
  role: string,
  newState: string,
): { valid: boolean; error?: string } {
  const allowedStates =
    ROLE_ALLOWED_STATES[role as keyof typeof ROLE_ALLOWED_STATES];

  if (!allowedStates) {
    return { valid: false, error: `Rol inválido: ${role}` };
  }

  if (!allowedStates.includes(newState as any)) {
    return {
      valid: false,
      error: `El rol "${role}" no tiene permiso para cambiar a estado "${newState}"`,
    };
  }

  return { valid: true };
}

export function validateOrderOwnership(
  order: any,
  userId: string,
  userRole: string,
): { valid: boolean; error?: string } {
  // Admin y super_admin pueden modificar cualquier pedido
  if (userRole === "admin" || userRole === "super_admin") {
    return { valid: true };
  }

  // Business owner debe ser dueño del negocio
  if (userRole === "business_owner") {
    // Esto se valida en el endpoint verificando que el negocio pertenezca al usuario
    return { valid: true };
  }

  // Delivery driver debe estar asignado al pedido
  if (userRole === "delivery_driver") {
    if (order.deliveryPersonId !== userId) {
      return {
        valid: false,
        error: "Este pedido no está asignado a ti",
      };
    }
    return { valid: true };
  }

  // Customer debe ser el dueño del pedido
  if (userRole === "customer") {
    if (order.userId !== userId) {
      return {
        valid: false,
        error: "Este pedido no te pertenece",
      };
    }
    return { valid: true };
  }

  return { valid: false, error: "Rol no autorizado" };
}
