import Link from "next/link";
import { BrandMark } from "@/shared/ui/brand-mark";
import { LegalLinks } from "@/shared/ui/legal-links";
import styles from "./legal.module.css";

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <Link href="/" className="brand">
          <BrandMark />
          Parking Tracker
        </Link>
      </header>
      <main id="main" className={styles.main}>
        <article className={styles.article}>{children}</article>
      </main>
      <footer className={styles.footer}>
        <LegalLinks />
      </footer>
    </div>
  );
}
