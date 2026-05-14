import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { JobRecord, DocumentRecord } from '@psp2/shared';

export type JobWithDoc = JobRecord & { documents: DocumentRecord };

export function useJobs() {
  return useQuery({
    queryKey: ['jobs'],
    queryFn: async (): Promise<JobWithDoc[]> => {
      const { data, error } = await supabase
        .from('jobs')
        .select('*, documents(*)')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as JobWithDoc[];
    },
  });
}

/**
 * Escuta mudanças em jobs via Realtime e invalida a query.
 */
export function useJobsRealtime() {
  const qc = useQueryClient();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const channel = supabase
      .channel('jobs-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'jobs' },
        () => qc.invalidateQueries({ queryKey: ['jobs'] }),
      )
      .subscribe((status) => {
        setConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  return connected;
}
