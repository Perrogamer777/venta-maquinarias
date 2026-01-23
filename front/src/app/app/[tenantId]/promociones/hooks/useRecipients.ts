import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Reserva } from '@/types';

export type RFMSegment = 'champion' | 'loyal' | 'potential' | 'new' | 'at_risk' | 'lost';

interface Destinatario {
  telefono: string;
  nombre?: string;
  origen: 'chat' | 'reserva';
  selected: boolean;
  totalPaid: number;
  totalNights: number;
  lastVisit?: string;
  visitCount: number;
  rfmSegment: RFMSegment;
  rfmScore: { r: number; f: number; m: number };
}

// RFM Segment Configuration
export const RFM_SEGMENTS: Record<RFMSegment, { label: string; color: string; description: string }> = {
  champion: { label: 'Mejores Clientes', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300', description: 'Compraron recientemente, muy frecuente y alto gasto' },
  loyal: { label: 'Leales', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300', description: 'Gastan bien y vuelven seguido' },
  potential: { label: 'Potenciales', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300', description: 'Clientes recientes con potencial' },
  new: { label: 'Nuevos', color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300', description: 'Clientes que acaban de llegar' },
  at_risk: { label: 'En Riesgo', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300', description: 'Buenos clientes que no vuelven' },
  lost: { label: 'Perdidos', color: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300', description: 'Clientes inactivos por mucho tiempo' },
};

// Calculate RFM scores (1-5 scale)
function calculateRFMScore(
  lastVisit: string | undefined,
  visitCount: number,
  totalPaid: number,
  allDestinatarios: { lastVisit?: string; visitCount: number; totalPaid: number }[]
): { r: number; f: number; m: number } {
  // Calculate percentiles
  const validDates = allDestinatarios.filter(d => d.lastVisit).map(d => new Date(d.lastVisit!).getTime());
  const allVisits = allDestinatarios.map(d => d.visitCount);
  const allSpend = allDestinatarios.map(d => d.totalPaid);

  const getPercentileScore = (value: number, values: number[], ascending = true): number => {
    if (values.length === 0) return 3;
    const sorted = [...values].sort((a, b) => a - b);
    const index = sorted.findIndex(v => v >= value);
    const percentile = index === -1 ? 1 : (index / sorted.length);
    const score = ascending ? Math.ceil(percentile * 5) : Math.ceil((1 - percentile) * 5);
    return Math.max(1, Math.min(5, score)) || 3;
  };

  const recencyValue = lastVisit ? new Date(lastVisit).getTime() : 0;

  return {
    r: getPercentileScore(recencyValue, validDates, true), // More recent = higher score
    f: getPercentileScore(visitCount, allVisits, true),    // More visits = higher score  
    m: getPercentileScore(totalPaid, allSpend, true),      // More spent = higher score
  };
}

// Determine RFM segment based on scores
function determineSegment(r: number, f: number, m: number): RFMSegment {
  const avgFM = (f + m) / 2;

  if (r >= 4 && avgFM >= 4) return 'champion';
  if (r >= 3 && avgFM >= 3) return 'loyal';
  if (r >= 4 && avgFM < 3) return 'potential';
  if (r >= 4 && f <= 2 && m <= 2) return 'new';
  if (r <= 2 && avgFM >= 2) return 'at_risk';
  return 'lost';
}

export function useRecipients() {
  const [minSpent, setMinSpent] = useState(0);
  const [minVisits, setMinVisits] = useState(0);
  const [recencyMonths, setRecencyMonths] = useState(12);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSegments, setSelectedSegments] = useState<Set<RFMSegment>>(new Set());

  // Fetch destinatarios
  const { data: rawDestinatarios = [], isLoading } = useQuery({
    queryKey: ['destinatarios'],
    queryFn: async () => {
      const destinatariosMap = new Map<string, Omit<Destinatario, 'rfmSegment' | 'rfmScore'>>();

      // Helper to normalize phone numbers
      const normalizePhone = (phone: string) => phone.replace(/[^\d+]/g, '');

      // 1. Fetch reservations for RFM calc
      const reservasSnapshot = await getDocs(collection(db, 'reservas'));
      const reservasData = reservasSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Reserva));

      const statsByPhone = new Map<string, { totalPaid: number; totalNights: number; lastVisit: string; visitCount: number }>();

      reservasData.forEach(reserva => {
        const rawTel = reserva.cliente_telefono;
        if (!rawTel) return;

        const tel = normalizePhone(rawTel);
        const current = statsByPhone.get(tel) || { totalPaid: 0, totalNights: 0, lastVisit: '', visitCount: 0 };

        const paid = Number(reserva.precio_total) || 0;
        const nights = Number(reserva.noches) || 0;

        current.totalPaid += paid;
        current.totalNights += nights;
        current.visitCount += 1;

        let fechaStr = '';
        if (reserva.fecha_inicio) {
          if (typeof reserva.fecha_inicio === 'string') {
            fechaStr = reserva.fecha_inicio;
          } else if ((reserva.fecha_inicio as { toDate?: () => Date }).toDate) {
            try {
              fechaStr = (reserva.fecha_inicio as { toDate: () => Date }).toDate().toISOString();
            } catch (e) {
              console.error('Error converting date:', e);
            }
          }
        }

        if (fechaStr && (!current.lastVisit || fechaStr > current.lastVisit)) {
          current.lastVisit = fechaStr;
        }

        statsByPhone.set(tel, current);
      });

      // 2. Fetch from chats
      const chatsSnapshot = await getDocs(collection(db, 'chats'));
      chatsSnapshot.docs.forEach(doc => {
        const rawTelefono = doc.id;
        if (!rawTelefono) return;

        const normalizedTel = normalizePhone(rawTelefono);
        if (!destinatariosMap.has(rawTelefono)) {
          const stats = statsByPhone.get(normalizedTel) || { totalPaid: 0, totalNights: 0, visitCount: 0, lastVisit: '' };
          destinatariosMap.set(rawTelefono, {
            telefono: rawTelefono,
            nombre: doc.data().clientName || undefined,
            origen: 'chat',
            selected: false,
            totalPaid: stats.totalPaid,
            totalNights: stats.totalNights,
            visitCount: stats.visitCount,
            lastVisit: stats.lastVisit || undefined,
          });
        }
      });

      // 3. Ensure all people from reservations are included
      reservasData.forEach(reserva => {
        const rawTelefono = reserva.cliente_telefono;
        if (!rawTelefono) return;

        const normalizedTel = normalizePhone(rawTelefono);
        if (!destinatariosMap.has(rawTelefono)) {
          const stats = statsByPhone.get(normalizedTel)!;
          destinatariosMap.set(rawTelefono, {
            telefono: rawTelefono,
            nombre: reserva.cliente_nombre || undefined,
            origen: 'reserva',
            selected: false,
            totalPaid: stats.totalPaid,
            totalNights: stats.totalNights,
            visitCount: stats.visitCount,
            lastVisit: stats.lastVisit || undefined,
          });
        }
      });

      return Array.from(destinatariosMap.values());
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Add RFM scores to destinatarios
  const destinatarios: Destinatario[] = useMemo(() => {
    return rawDestinatarios.map(dest => {
      const rfmScore = calculateRFMScore(dest.lastVisit, dest.visitCount, dest.totalPaid, rawDestinatarios);
      return {
        ...dest,
        rfmScore,
        rfmSegment: determineSegment(rfmScore.r, rfmScore.f, rfmScore.m),
      };
    });
  }, [rawDestinatarios]);

  // Filtered destinatarios
  const filteredDestinatarios = useMemo(() => {
    return destinatarios.filter(dest => {
      // Search query filter
      const lowerQuery = searchQuery.toLowerCase();
      const matchesSearch = !searchQuery ||
        dest.telefono.includes(searchQuery) ||
        (dest.nombre && dest.nombre.toLowerCase().includes(lowerQuery));

      if (!matchesSearch) return false;

      // Segment filter
      if (selectedSegments.size > 0 && !selectedSegments.has(dest.rfmSegment)) return false;

      // Spent filter (M)
      if (dest.totalPaid < minSpent) return false;

      // Frequency filter (F)
      if (dest.visitCount < minVisits) return false;

      // Recency filter (R)
      if (recencyMonths < 120) {
        if (!dest.lastVisit) return false;
        const lastVisitDate = new Date(dest.lastVisit);
        const cutoffDate = new Date();
        cutoffDate.setMonth(cutoffDate.getMonth() - recencyMonths);
        if (lastVisitDate < cutoffDate) return false;
      }

      return true;
    });
  }, [destinatarios, searchQuery, minSpent, minVisits, recencyMonths, selectedSegments]);

  // Segment counts for UI
  const segmentCounts = useMemo(() => {
    const counts: Record<RFMSegment, number> = {
      champion: 0, loyal: 0, potential: 0, new: 0, at_risk: 0, lost: 0
    };
    destinatarios.forEach(d => counts[d.rfmSegment]++);
    return counts;
  }, [destinatarios]);

  return {
    destinatarios,
    filteredDestinatarios,
    isLoading,
    segmentCounts,
    filters: {
      minSpent,
      setMinSpent,
      minVisits,
      setMinVisits,
      recencyMonths,
      setRecencyMonths,
      searchQuery,
      setSearchQuery,
      selectedSegments,
      setSelectedSegments,
    },
  };
}
