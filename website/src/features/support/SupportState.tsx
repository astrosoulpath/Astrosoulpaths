import styles from './contact.module.css';
import type { useSupportResource } from './support-hooks';
export function SupportState({resource}: {resource: ReturnType<typeof useSupportResource>}) {
  return <>{resource.busy && <div className={styles.skeleton} role="status" aria-label="Loading support"/>}{resource.error && <div className={styles.notice} role="alert"><p>{resource.error}</p><button className={styles.button} onClick={resource.reload}>Retry loading</button></div>}</>;
}
