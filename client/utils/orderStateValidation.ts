// Validación de estados de pedidos para el frontend
export interface StateTransition {
  from: string;
  to: string;
  allowedRoles: string[];
  requiresConfirmation: boolean;
  message: string;
}

export interface SmartButtonInfo {
  canProceed: boolean;
  message: string;
  nextAction: string;
  icon: string;
  color: string;
  disabled: boolean;
  requiresBusinessAction?: boolean;
}

// Estados válidos del sistema
export const ORDER_STATES = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  PREPARING: "preparing",
  READY: "ready",
  PICKED_UP: "picked_up",
  ON_THE_WAY: "on_the_way",
  IN_TRANSIT: "in_transit",
  DELIVERED: "delivered",
  CANCELLED: "cancelled",
} as const;

// Transiciones válidas entre estados
export const VALID_TRANSITIONS: StateTransition[] = [
  // Cliente puede cancelar pedidos pendientes
  {
    from: "pending",
    to: "cancelled",
    allowedRoles: ["customer", "admin"],
    requiresConfirmation: true,
    message: "Cancelar pedido",
  },

  // Negocio puede aceptar o rechazar pedidos
  {
    from: "pending",
    to: "confirmed",
    allowedRoles: ["business_owner", "admin"],
    requiresConfirmation: false,
    message: "Aceptar pedido",
  },
  {
    from: "pending",
    to: "cancelled",
    allowedRoles: ["business_owner", "admin"],
    requiresConfirmation: true,
    message: "Rechazar pedido",
  },

  // Negocio prepara el pedido
  {
    from: "confirmed",
    to: "preparing",
    allowedRoles: ["business_owner", "admin"],
    requiresConfirmation: false,
    message: "Iniciar preparación",
  },
  {
    from: "confirmed",
    to: "cancelled",
    allowedRoles: ["business_owner", "admin"],
    requiresConfirmation: true,
    message: "Cancelar pedido",
  },

  // Negocio marca como listo
  {
    from: "preparing",
    to: "ready",
    allowedRoles: ["business_owner", "admin"],
    requiresConfirmation: false,
    message: "Marcar como listo",
  },
  {
    from: "preparing",
    to: "cancelled",
    allowedRoles: ["business_owner", "admin"],
    requiresConfirmation: true,
    message: "Cancelar pedido",
  },

  // Repartidor recoge el pedido
  {
    from: "ready",
    to: "picked_up",
    allowedRoles: ["delivery_driver", "admin"],
    requiresConfirmation: true,
    message: "Recoger pedido",
  },

  // Repartidor se dirige al cliente
  {
    from: "picked_up",
    to: "on_the_way",
    allowedRoles: ["delivery_driver", "admin"],
    requiresConfirmation: false,
    message: "En camino",
  },
  {
    from: "picked_up",
    to: "in_transit",
    allowedRoles: ["delivery_driver", "admin"],
    requiresConfirmation: false,
    message: "En tránsito",
  },

  // Estados equivalentes de entrega
  {
    from: "on_the_way",
    to: "in_transit",
    allowedRoles: ["delivery_driver", "admin"],
    requiresConfirmation: false,
    message: "Actualizar estado",
  },
  {
    from: "in_transit",
    to: "on_the_way",
    allowedRoles: ["delivery_driver", "admin"],
    requiresConfirmation: false,
    message: "Actualizar estado",
  },

  // Completar entrega
  {
    from: "on_the_way",
    to: "delivered",
    allowedRoles: ["delivery_driver", "admin"],
    requiresConfirmation: true,
    message: "Marcar como entregado",
  },
  {
    from: "in_transit",
    to: "delivered",
    allowedRoles: ["delivery_driver", "admin"],
    requiresConfirmation: true,
    message: "Marcar como entregado",
  },
];

// Información inteligente para botones según el estado
export const getSmartButtonInfo = (
  status: string,
  userRole: string = "delivery_driver",
): SmartButtonInfo => {
  switch (status) {
    case ORDER_STATES.PENDING:
      return {
        canProceed: false,
        message: "Esperando confirmación del negocio",
        nextAction: "El negocio debe aceptar el pedido",
        icon: "clock",
        color: "#6B7280",
        disabled: true,
        requiresBusinessAction: true,
      };

    case ORDER_STATES.CONFIRMED:
      return {
        canProceed: false,
        message: "Pedido confirmado",
        nextAction: "El negocio iniciará la preparación",
        icon: "check-circle",
        color: "#10B981",
        disabled: true,
        requiresBusinessAction: true,
      };

    case ORDER_STATES.PREPARING:
      return {
        canProceed: false,
        message: "Pedido en preparación",
        nextAction: "Espera a que esté listo para recoger",
        icon: "clock",
        color: "#F59E0B",
        disabled: true,
        requiresBusinessAction: true,
      };

    case ORDER_STATES.READY:
      return {
        canProceed: true,
        message: "¡Listo para recoger!",
        nextAction: "Ve al negocio y recoge el pedido",
        icon: "package",
        color: "#3B82F6",
        disabled: false,
      };

    case ORDER_STATES.PICKED_UP:
      return {
        canProceed: true,
        message: "Pedido recogido",
        nextAction: "Dirígete hacia el cliente",
        icon: "navigation",
        color: "#F59E0B",
        disabled: false,
      };

    case ORDER_STATES.ON_THE_WAY:
    case ORDER_STATES.IN_TRANSIT:
      return {
        canProceed: true,
        message: "En camino al cliente",
        nextAction: "Entrega el pedido al cliente",
        icon: "check-circle",
        color: "#10B981",
        disabled: false,
      };

    case ORDER_STATES.DELIVERED:
      return {
        canProceed: false,
        message: "Pedido entregado",
        nextAction: "¡Entrega completada!",
        icon: "check-circle",
        color: "#10B981",
        disabled: true,
      };

    case ORDER_STATES.CANCELLED:
      return {
        canProceed: false,
        message: "Pedido cancelado",
        nextAction: "Este pedido fue cancelado",
        icon: "x-circle",
        color: "#EF4444",
        disabled: true,
      };

    default:
      return {
        canProceed: false,
        message: "Estado desconocido",
        nextAction: "Contacta con soporte",
        icon: "help-circle",
        color: "#6B7280",
        disabled: true,
      };
  }
};

// Validar si una transición es válida
export const isValidTransition = (
  fromState: string,
  toState: string,
  userRole: string,
): boolean => {
  return VALID_TRANSITIONS.some(
    (transition) =>
      transition.from === fromState &&
      transition.to === toState &&
      transition.allowedRoles.includes(userRole),
  );
};

// Obtener próximas acciones válidas para un estado
export const getValidNextActions = (
  currentState: string,
  userRole: string,
): StateTransition[] => {
  return VALID_TRANSITIONS.filter(
    (transition) =>
      transition.from === currentState &&
      transition.allowedRoles.includes(userRole),
  );
};

// Obtener mensaje de error para transición inválida
export const getTransitionErrorMessage = (
  fromState: string,
  toState: string,
  userRole: string,
): string => {
  const validTransition = VALID_TRANSITIONS.find(
    (t) => t.from === fromState && t.to === toState,
  );

  if (!validTransition) {
    return `No se puede cambiar de "${fromState}" a "${toState}"`;
  }

  if (!validTransition.allowedRoles.includes(userRole)) {
    return `No tienes permisos para realizar esta acción`;
  }

  return "Transición válida";
};

// Etiquetas amigables para los estados
export const STATUS_LABELS: Record<string, string> = {
  [ORDER_STATES.PENDING]: "Pendiente",
  [ORDER_STATES.CONFIRMED]: "Confirmado",
  [ORDER_STATES.PREPARING]: "Preparando",
  [ORDER_STATES.READY]: "Listo para recoger",
  [ORDER_STATES.PICKED_UP]: "Recogido",
  [ORDER_STATES.ON_THE_WAY]: "En camino",
  [ORDER_STATES.IN_TRANSIT]: "En camino",
  [ORDER_STATES.DELIVERED]: "Entregado",
  [ORDER_STATES.CANCELLED]: "Cancelado",
};

// Obtener etiqueta amigable para un estado
export const getStatusLabel = (status: string): string => {
  return STATUS_LABELS[status] || status;
};
