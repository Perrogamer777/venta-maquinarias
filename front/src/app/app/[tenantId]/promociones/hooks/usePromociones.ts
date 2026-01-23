import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useTenant } from '@/contexts/TenantContext';
import type { Promocion } from '@/types';
import { toast } from '@/utils/toast';

export function usePromociones() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  // Fetch promociones
  const { data: promociones = [], isLoading, error } = useQuery({
    queryKey: ['promociones', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const q = query(collection(db, 'clients', tenantId, 'promociones'), orderBy('creadaEn', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Promocion));
    },
    enabled: !!tenantId,
  });

  // Create promocion
  const createPromocion = useMutation({
    mutationFn: async (data: Omit<Promocion, 'id'>) => {
      if (!tenantId) throw new Error('No tenant ID');
      return await addDoc(collection(db, 'clients', tenantId, 'promociones'), data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promociones', tenantId] });
      toast.success('Promoción creada exitosamente');
    },
    onError: () => {
      toast.error('Error al crear la promoción');
    },
  });

  // Update promocion
  const updatePromocion = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Promocion> }) => {
      if (!tenantId) throw new Error('No tenant ID');
      return await updateDoc(doc(db, 'clients', tenantId, 'promociones', id), data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promociones', tenantId] });
      toast.success('Promoción actualizada exitosamente');
    },
    onError: () => {
      toast.error('Error al actualizar la promoción');
    },
  });

  // Delete promocion
  const deletePromocion = useMutation({
    mutationFn: async (id: string) => {
      if (!tenantId) throw new Error('No tenant ID');
      return await deleteDoc(doc(db, 'clients', tenantId, 'promociones', id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promociones', tenantId] });
      toast.success('Promoción eliminada exitosamente');
    },
    onError: () => {
      toast.error('Error al eliminar la promoción');
    },
  });

  return {
    promociones,
    isLoading,
    error,
    createPromocion,
    updatePromocion,
    deletePromocion,
  };
}
