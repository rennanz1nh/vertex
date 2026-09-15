// Shared booking-status labels/colors — used by the admin Calendar, Dashboard and
// Reservas pages so a status badge reads the same way everywhere it shows up.
export type BookingStatus = 'pending_payment' | 'confirmed' | 'cancelled' | 'completed';

export const BOOKING_STATUS_LABEL: Record<BookingStatus, string> = {
  pending_payment: 'Aguardando pagamento',
  confirmed: 'Confirmada',
  cancelled: 'Cancelada',
  completed: 'Concluída',
};

export const BOOKING_STATUS_COLOR: Record<BookingStatus, { fg: string; bg: string; border: string }> = {
  confirmed: { fg: '#1b8f6b', bg: '#e2f4ec', border: '#1b8f6b59' },
  pending_payment: { fg: '#c07a12', bg: '#fbecd4', border: '#c07a1259' },
  completed: { fg: '#64748b', bg: '#eef1f6', border: '#64748b59' },
  cancelled: { fg: '#b91c1c', bg: '#fee2e2', border: '#b91c1c59' },
};
