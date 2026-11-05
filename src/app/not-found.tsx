import Link from "next/link";
export default function NotFound() {
  return (
    <main className="app-main">
      <h1>No encontramos este plan.</h1>
      <p>Puede que ya no exista o que no pertenezcas a su grupo.</p>
      <Link className="button" href="/groups">
        Volver a mis grupos
      </Link>
    </main>
  );
}
