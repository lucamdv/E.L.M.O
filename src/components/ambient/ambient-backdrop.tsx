import styles from "./ambient.module.css";

export function AmbientBackdrop() {
  return (
    <div className={styles.backdrop} aria-hidden="true">
      <div className={styles.sky} />
      <div className={styles.upperLight} />
      <div className={styles.sunbeam} />
      <div className={styles.horizon} />
      <div className={styles.depth} />
      <div className={styles.surfaceReflection} />
      <div className={styles.vignette} />
    </div>
  );
}
