"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import { customerSupportRequest, supportSession, type SupportRecord } from './customer-support-api';
export function identity() {try {return supportSession();} catch {return '';}}
export function useSupportResource(path: string | null, owner?: string) {
  const [value, setValue] = useState<{path: string; owner?: string; data: SupportRecord} | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true; const controller = new AbortController(); setValue(null); setError(''); setBusy(false);
    if (!path || owner === '') return;
    setBusy(true);
    void customerSupportRequest(path, {signal: controller.signal}).then(data => {if (active) setValue({path, owner, data});}).catch(error => {if (active) setError(error instanceof Error ? error.message : 'Support could not load. Retry.');}).finally(() => {if (active) setBusy(false);});
    return () => {active = false; controller.abort();};
  }, [path, owner, attempt]);
  const data = value && value.path === path && value.owner === owner && (owner === undefined || (typeof window !== 'undefined' && identity() === owner)) ? value.data : null;
  const reload = useCallback(() => setAttempt(value => value + 1), []);
  return {data, busy, error, reload};
}
export function useSupportMutation(owner: string) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const work = useRef<AbortController | null>(null);
  useEffect(() => {const lifetime = work; return () => {lifetime.current?.abort(); lifetime.current = null;};}, []);
  async function run(operation: (signal: AbortSignal) => Promise<SupportRecord>, done: (result: SupportRecord) => void, failed?: () => void) {
    if (work.current || identity() !== owner || !navigator.onLine) return;
    const controller = new AbortController(); work.current = controller; setBusy(true); setError('');
    try {const result = await operation(controller.signal); if (!controller.signal.aborted && identity() === owner) done(result);}
    catch (error) {if (!controller.signal.aborted && identity() === owner) {setError(error instanceof Error ? error.message : 'Change was not confirmed. Refresh before retrying.'); failed?.();}}
    finally {if (work.current === controller) {work.current = null; setBusy(false);}}
  }
  return {busy, error, run};
}
