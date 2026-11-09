import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { MeResponse, OwnProfileResponse } from '@2k/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export const keys = {
  me: ['me'] as const,
  profile: ['profile'] as const,
  recommendations: ['recommendations'] as const,
  interests: (direction: string) => ['interests', direction] as const,
  conversations: ['conversations'] as const,
  messages: (id: string) => ['messages', id] as const,
  connections: ['connections'] as const,
  connection: (id: string) => ['connection', id] as const,
  notifications: ['notifications'] as const,
  member: (id: string) => ['member', id] as const,
  explanation: (id: string) => ['explanation', id] as const,
  plans: ['plans'] as const,
  shortlist: ['shortlist'] as const,
};

export function useMe() {
  const { session } = useAuth();
  return useQuery({ queryKey: keys.me, queryFn: () => api.get<MeResponse>('/me'), enabled: !!session });
}

export function useOwnProfile(enabled = true) {
  return useQuery({ queryKey: keys.profile, queryFn: () => api.get<OwnProfileResponse>('/profile'), enabled });
}

/** Invalidate the queries most actions affect (relationship state changes). */
export function useRelationshipInvalidation() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: keys.recommendations });
    void qc.invalidateQueries({ queryKey: ['interests'] });
    void qc.invalidateQueries({ queryKey: keys.connections });
    void qc.invalidateQueries({ queryKey: keys.conversations });
    void qc.invalidateQueries({ queryKey: keys.shortlist });
    void qc.invalidateQueries({ queryKey: ['member'] });
    void qc.invalidateQueries({ queryKey: keys.me });
  };
}

export { useMutation, useQuery, useQueryClient };
